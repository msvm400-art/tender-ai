import fs from "fs";
import path from "path";
import { db } from "./db.js";
import { searchEngine } from "./search.service.js";

// Types for Ingestion Queue and Jobs
export interface IngestionJob {
  id: string;
  portal: string;
  status: "PENDING" | "RUNNING" | "COMPLETED" | "FAILED";
  retryCount: number;
  maxRetries: number;
  errorMessage?: string;
  startedAt?: string;
  completedAt?: string;
  logs: string[];
  recordsIngested: number;
}

export interface PortalStats {
  portalKey: string;
  displayName: string;
  type: "CPPP" | "GEM" | "STATE_PWD" | "RAILWAYS" | "NHAI" | "DEFENSE" | "PSU" | "OTHER";
  lastCrawlAt?: string;
  status: "HEALTHY" | "DEGRADED" | "OFFLINE";
  successRate: number;
  totalIngested: number;
}

export interface IngestionConfig {
  schedulerActive: boolean;
  intervalMinutes: number;
  concurrencyLimit: number;
}

class IngestionService {
  private configPath = path.join(process.cwd(), "server", "data", "ingestion.json");
  private running = false;
  private timer: NodeJS.Timeout | null = null;
  private activeWorkers = 0;

  // Persistent stats & queues
  public config: IngestionConfig = {
    schedulerActive: true,
    intervalMinutes: 15,
    concurrencyLimit: 2,
  };

  public jobs: IngestionJob[] = [];
  public portalCoverage: Record<string, PortalStats> = {};

  // Analytics
  public stats = {
    totalScrapedDocs: 0,
    totalDeduplicated: 0,
    totalFailedAttempts: 0,
    totalRecoveries: 0,
  };

  // Predefined Portal Coverage Matrix
  private PORTAL_DEFS = [
    { portalKey: "gem", displayName: "Government e-Marketplace (GeM)", type: "GEM" },
    { portalKey: "cppp", displayName: "Central Public Procurement Portal (CPPP)", type: "CPPP" },
    { portalKey: "railways", displayName: "Indian Railways (IREPS)", type: "RAILWAYS" },
    { portalKey: "nhai", displayName: "National Highways Authority (NHAI)", type: "NHAI" },
    { portalKey: "bhel", displayName: "Bharat Heavy Electricals (BHEL)", type: "PSU" },
    { portalKey: "ntpc", displayName: "National Thermal Power Corp (NTPC)", type: "PSU" },
    { portalKey: "ongc", displayName: "Oil and Natural Gas Corp (ONGC)", type: "PSU" },
    { portalKey: "powergrid", displayName: "Power Grid Corp of India (PowerGrid)", type: "PSU" },
    { portalKey: "state_pwd", displayName: "State Tender Portals (STATE_PWD)", type: "STATE_PWD" },
  ];

  constructor() {
    this.init();
  }

  private init() {
    // Scaffold database file if not exists
    const dir = path.dirname(this.configPath);
    if (!fs.existsSync(dir)) {
      fs.mkdirSync(dir, { recursive: true });
    }

    // Initialize portal defaults
    for (const d of this.PORTAL_DEFS) {
      this.portalCoverage[d.portalKey] = {
        portalKey: d.portalKey,
        displayName: d.displayName,
        type: d.type as any,
        status: "HEALTHY",
        successRate: 100,
        totalIngested: 0,
      };
    }

    if (fs.existsSync(this.configPath)) {
      try {
        const fileContent = fs.readFileSync(this.configPath, "utf-8");
        const parsed = JSON.parse(fileContent);
        if (parsed.config) this.config = parsed.config;
        if (parsed.stats) this.stats = parsed.stats;
        if (parsed.portalCoverage) this.portalCoverage = parsed.portalCoverage;
        // Keep logs historical, map with default keys
        if (parsed.jobs) this.jobs = parsed.jobs.slice(0, 100); // Only keep recent 100 jobs
      } catch (err) {
        console.error("[Ingestion Service] Failed to load config from disk, using defaults.");
      }
    }

    // Recalculate default total ingested counts from current memory db
    this.reindexIngestedCounts();

    // Spawn scheduler if configured
    if (this.config.schedulerActive) {
      this.startScheduler();
    }
  }

  public saveToDisk() {
    try {
      fs.writeFileSync(
        this.configPath,
        JSON.stringify(
          {
            config: this.config,
            stats: this.stats,
            portalCoverage: this.portalCoverage,
            jobs: this.jobs,
          },
          null,
          2
        ),
        "utf-8"
      );
    } catch (err) {
      console.error("[Ingestion Service] Save config error:", err);
    }
  }

  private reindexIngestedCounts() {
    const tenders = db.data.tenders || [];
    // Reset coverage crawl counts
    for (const key of Object.keys(this.portalCoverage)) {
      this.portalCoverage[key].totalIngested = 0;
    }

    for (const t of tenders) {
      if (t.sourcePortal === "GEM") this.portalCoverage["gem"].totalIngested++;
      else if (t.sourcePortal === "CPPP") this.portalCoverage["cppp"].totalIngested++;
      else if (t.sourcePortal === "RAILWAYS") this.portalCoverage["railways"].totalIngested++;
      else if (t.sourcePortal === "NHAI") this.portalCoverage["nhai"].totalIngested++;
      else if (t.sourcePortal === "STATE_PWD") this.portalCoverage["state_pwd"].totalIngested++;
      else if (t.sourcePortal === "PSU") {
        const dept = (t.department || "").toLowerCase();
        if (dept.includes("bhel")) this.portalCoverage["bhel"].totalIngested++;
        else if (dept.includes("ntpc")) this.portalCoverage["ntpc"].totalIngested++;
        else if (dept.includes("ongc")) this.portalCoverage["ongc"].totalIngested++;
        else if (dept.includes("powergrid")) this.portalCoverage["powergrid"].totalIngested++;
        else this.portalCoverage["bhel"].totalIngested++;
      }
    }
  }

  // Scheduler Management
  public startScheduler() {
    this.stopScheduler();
    this.config.schedulerActive = true;
    console.log(`[Ingestion Service] Scheduler started. Checks triggers every ${this.config.intervalMinutes} minutes.`);
    
    // Set interval loop
    const msInterval = this.config.intervalMinutes * 60 * 1000;
    this.timer = setInterval(() => {
      console.log("[Ingestion Service] Periodic scheduler alarm. Queuing portal crawl jobs.");
      this.triggerIngestionCycle();
    }, msInterval);

    this.saveToDisk();
  }

  public stopScheduler() {
    this.config.schedulerActive = false;
    if (this.timer) {
      clearInterval(this.timer);
      this.timer = null;
    }
    console.log("[Ingestion Service] Scheduler paused.");
    this.saveToDisk();
  }

  public updateInterval(minutes: number) {
    this.config.intervalMinutes = Math.max(1, minutes);
    if (this.config.schedulerActive) {
      this.startScheduler(); // Re-apply interval timer
    } else {
      this.saveToDisk();
    }
  }

  // Queue System / Task Ingestion Run
  public triggerIngestionCycle() {
    // Queue all 9 portals as individual jobs
    for (const p of this.PORTAL_DEFS) {
      this.queueJob(p.portalKey);
    }
    // Kick off worker processor
    this.processQueue();
  }

  public queueJob(portalKey: string) {
    const pDef = this.PORTAL_DEFS.find((d) => d.portalKey === portalKey);
    if (!pDef) return;

    // Check if there is already a PENDING or RUNNING job for this specific portal
    // to avoid queue flooding
    const active = this.jobs.find((j) => j.portal === portalKey && (j.status === "PENDING" || j.status === "RUNNING"));
    if (active) {
      console.log(`[Ingestion Queue] Portal ${portalKey} already has active crawler job. Skipping duplicate.`);
      return;
    }

    const newJob: IngestionJob = {
      id: "job-" + Math.random().toString(36).substring(3, 8).toUpperCase(),
      portal: portalKey,
      status: "PENDING",
      retryCount: 0,
      maxRetries: 3,
      logs: [`[Queue] Job created and scheduled for ${pDef.displayName}.`],
      recordsIngested: 0,
    };

    this.jobs.unshift(newJob);
    if (this.jobs.length > 200) this.jobs.pop(); // Keep manageable size

    this.saveToDisk();
  }

  public clearQueue() {
    this.jobs = [];
    this.saveToDisk();
  }

  private processQueue() {
    if (this.running) return;

    const nextPending = this.jobs.find((j) => j.status === "PENDING");
    if (!nextPending) {
      this.running = false;
      return;
    }

    this.running = true;
    this.runNextJobs();
  }

  private async runNextJobs() {
    const pendingJobs = this.jobs.filter((j) => j.status === "PENDING");
    if (pendingJobs.length === 0) {
      this.running = false;
      return;
    }

    // Respect concurrency boundary limit
    while (this.activeWorkers < this.config.concurrencyLimit && pendingJobs.length > 0) {
      const job = pendingJobs.shift();
      if (!job) break;

      this.activeWorkers++;
      this.executeJob(job).finally(() => {
        this.activeWorkers--;
        this.runNextJobs(); // Chain next pending tasks
      });
    }
  }

  private async executeJob(job: IngestionJob) {
    job.status = "RUNNING";
    job.startedAt = new Date().toISOString();
    job.logs.push(`[Worker] Started worker. Executing simulated scraper for portal: ${job.portal}.`);
    this.saveToDisk();

    try {
      this.portalCoverage[job.portal].status = "HEALTHY";
      
      // Delay to simulate web crawl, page loading and DNS resolution
      await new Promise((resolve) => setTimeout(resolve, 2000));
      
      // Simulated random portal failure behavior to test Error Recovery (e.g. 15% rate)
      // Different portals might have distinct crawl vulnerabilities (Railways has strict captcha, State PWD has timeout issues)
      let isFailedAttempt = this.simulatePortalVulnerability(job);
      
      if (isFailedAttempt) {
        // High Availability DNS & Proxy Failover Logic
        if (job.portal === "state_pwd") {
          job.logs.push(`[Resilience] Warning: Timeout: Dynamic DNS query returned NXDOMAIN for secure portal.`);
          job.logs.push(`[Resilience] Triggering secure DNS fallback (DNS-over-HTTPS) via Primary Cloudflare (1.1.1.1) and Secondary Google (8.8.8.8) resolvents.`);
          job.logs.push(`[Resilience] Hostname IP resolved successfully via backup DNS mesh tunnel: state_pwd.in -> 164.100.22.84`);
          isFailedAttempt = false; // Successfully recovered!
          this.stats.totalRecoveries++;
        } else if (job.portal === "bhel") {
          job.logs.push(`[Resilience] Warning: 502 Gateway Error: Connection pool exhausted. Upstream proxy connection timed out.`);
          job.logs.push(`[Resilience] Reallocating socket pool. Activating backup upstream proxy routing cluster (node-de-srv04.tunnel-mesh.net)...`);
          job.logs.push(`[Resilience] Handshake established with backup proxy node. Traffic successfully re-routed.`);
          isFailedAttempt = false; // Successfully recovered!
          this.stats.totalRecoveries++;
        } else if (job.portal === "railways") {
          job.logs.push(`[Resilience] Warning: 503 Captcha Shield Block: Handshake refused. Session protection triggers.`);
          job.logs.push(`[Resilience] Initializing AI-driven CAPTCHA bypass engine (OCR/Tess3 solver)...`);
          job.logs.push(`[Resilience] CAPTCHA successfully deciphered. Session token generated successfully.`);
          isFailedAttempt = false; // Successfully recovered!
          this.stats.totalRecoveries++;
        }
      }

      if (isFailedAttempt) {
        throw new Error(this.getSimulatedErrorMessage(job.portal));
      }

      job.logs.push(`[Crawl] Connection established securely. Parsing landing index page.`);
      const fetchedItems = this.getSimulatedBidsForPortal(job.portal);
      job.logs.push(`[Crawl] Retrieved ${fetchedItems.length} prospective listings corresponding to current date.`);

      let newlyIngested = 0;

      for (const item of fetchedItems) {
        // Core Deduplication Check
        const alreadyExists = db.data.tenders.some((t) => t.externalId === item.externalId);
        if (alreadyExists) {
          job.logs.push(`[Deduplication] SKIP: Reference ${item.externalId} already exists in local database.`);
          this.stats.totalDeduplicated++;
          continue;
        }

        // Fresh record ingest: Save to local lowdb db
        db.data.tenders.push({
          id: "t-" + (db.data.tenders.length + 1),
          externalId: item.externalId,
          sourcePortal: item.sourcePortal as any,
          title: item.title,
          department: item.department,
          state: item.state,
          category: item.category,
          subCategory: item.subCategory,
          tenderValue: item.tenderValue,
          emdAmount: item.emdAmount,
          publishedDate: item.publishedDate,
          bidSubmissionDeadline: item.bidSubmissionDeadline,
          openingDate: item.openingDate,
          workDescription: item.workDescription,
          eligibilityCriteria: item.eligibilityCriteria,
          technicalSpecs: item.technicalSpecs,
          documents: item.documents,
          rawText: item.rawText,
          aiSummary: null,
          aiEligibilityChecklist: null,
          status: "ACTIVE",
          location: item.location,
          pineconeVectorId: null,
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString(),
        });

        const newDoc = db.data.tenders[db.data.tenders.length - 1];
        try {
          searchEngine.indexTender(newDoc);
        } catch (idxErr) {
          console.error("Failed to index newly ingested tender:", idxErr);
        }

        job.logs.push(`[Database] INGESTED: Created fresh entry ID t-${db.data.tenders.length} for ${item.externalId}.`);
        newlyIngested++;
        this.stats.totalScrapedDocs++;
      }

      db.save(); // Save the lowdb file!

      job.status = "COMPLETED";
      job.recordsIngested = newlyIngested;
      job.completedAt = new Date().toISOString();
      job.logs.push(`[Finished] Job completed successfully. Ingested ${newlyIngested} fresh items.`);
      
      // Update portal aggregates safely
      this.portalCoverage[job.portal].lastCrawlAt = new Date().toISOString();
      this.portalCoverage[job.portal].totalIngested += newlyIngested;
      this.portalCoverage[job.portal].successRate = Math.min(100, Math.floor(((this.portalCoverage[job.portal].successRate * 9) + 100) / 10));

    } catch (err: any) {
      console.error(`[Ingestion Service] Job ${job.id} failed:`, err.message);
      job.logs.push(`[Error] Fallback fail: ${err.message}`);
      this.stats.totalFailedAttempts++;

      // Trigger Error Recovery / Backoff Retries
      if (job.retryCount < job.maxRetries) {
        job.retryCount++;
        job.status = "PENDING"; // Put back to pending to trigger process queue retry
        const backoffSeconds = Math.pow(2, job.retryCount) * 2; // Exponential Backoff: 4s, 8s, 16s
        job.logs.push(`[Recovery-Engine] Automatic Fault Protection activated. Retry #${job.retryCount} scheduled in ${backoffSeconds} seconds.`);
        this.portalCoverage[job.portal].status = "DEGRADED";

        // Wait asynchronously then trigger processQueue
        setTimeout(() => {
          console.log(`[Ingestion Backoff] Re-triggering executeJob for retry of ${job.id}`);
          job.logs.push(`[Recovery-Engine] Retrying crawl node session...`);
          this.stats.totalRecoveries++;
          this.processQueue();
        }, backoffSeconds * 1000);
      } else {
        job.status = "FAILED";
        job.errorMessage = err.message;
        job.completedAt = new Date().toISOString();
        job.logs.push(`[Fatal] Job exhausted max retries (${job.maxRetries}). Aborting task worker.`);
        this.portalCoverage[job.portal].status = "OFFLINE";
        this.portalCoverage[job.portal].successRate = Math.max(0, Math.floor(((this.portalCoverage[job.portal].successRate * 9) + 0) / 10));
      }
    } finally {
      this.saveToDisk();
    }
  }

  // Trigger immediate retry of an individual job
  public async retryJob(jobId: string) {
    const job = this.jobs.find((j) => j.id === jobId);
    if (!job || job.status === "RUNNING") return false;

    job.status = "PENDING";
    job.retryCount = 0;
    job.logs.push(`[Manual Action] Enqueued for manual retry execution.`);
    this.processQueue();
    return true;
  }

  private simulatePortalVulnerability(job: IngestionJob): boolean {
    // First retry or clean run might fail to showcase recovery
    if (job.retryCount > 0) return false; // succeed on retries to verify recovery!

    // Seeded failures based on portal key
    if (job.portal === "railways" && Math.random() < 0.5) return true; // Railways e-Procurement CAPTCHA block
    if (job.portal === "bhel" && Math.random() < 0.45) return true; // BHEL state server gateway 502/Gateway Timeout
    if (job.portal === "state_pwd" && Math.random() < 0.4) return true; // State DNS resolve timed out
    return false;
  }

  private getSimulatedErrorMessage(portal: string): string {
    const errors: Record<string, string> = {
      railways: "503 Captcha Shield Block: Handshake refused. Session protection triggers.",
      bhel: "502 Gateway Error: Connection pool exhausted. Upstream proxy connection timed out.",
      state_pwd: "Timeout: Dynamic DNS query returned NXDOMAIN for secure portal.",
    };
    return errors[portal] || "Network Failure: Ping handshake frame drop.";
  }

  // Purely dynamic simulated data generator reflecting Indian e-Tender portals with high fidelity
  private getSimulatedBidsForPortal(portal: string): any[] {
    const todayStr = new Date().toISOString().split("T")[0];
    const mockRefSuffix = Math.floor(Math.random() * 900) + 100;

    const staticBids: Record<string, any[]> = {
      gem: [
        {
          externalId: `GEM/2026/B/89${mockRefSuffix}`,
          sourcePortal: "GEM",
          title: "Supply, Assembly, and Field Calibration of 45-Unit Acoustic Level Water Sensors",
          department: "Central Ground Water Board (CGWB) / GeM Cell",
          state: "Delhi",
          category: "Electrical",
          subCategory: "Sensors",
          tenderValue: 0.85, 
          emdAmount: 1.7,
          publishedDate: todayStr + "T09:00:00Z",
          bidSubmissionDeadline: new Date(Date.now() + 12*24*60*60*1000).toISOString(),
          openingDate: new Date(Date.now() + 13*24*60*60*1000).toISOString(),
          workDescription: "GeM marketplace request for smart electronic fluid sensors to deploy in watershed grids. Full terminal reporting systems included.",
          eligibilityCriteria: {
            minTurnover: 0.3,
            minExperience: 2,
            requiredCertifications: ["MSME (Udyam)", "ISO 9001"],
            msmeOnly: true,
            statesAllowed: ["Delhi"],
          },
          technicalSpecs: "IP68 waterproof shell, integrated LoRaWAN transmitter modules, 5 years maintenance contract.",
          documents: [{ name: "Notice_Specs.pdf", url: "#", type: "SPECS" }],
          rawText: "CGWB fluid telemetry project. MSME registered. Average turnover above 30L INR.",
          location: "New Delhi",
        }
      ],
      cppp: [
        {
          externalId: `CPPP/2026/CI/${mockRefSuffix}`,
          sourcePortal: "CPPP",
          title: "Rigging and Layout of Commercial Cold Storage Annex at Bihar Agricultural Complex",
          department: "Ministry of Agriculture (CPWD Central Ward)",
          state: "Bihar",
          category: "Construction",
          subCategory: "Refrigeration",
          tenderValue: 3.4,
          emdAmount: 6.8,
          publishedDate: todayStr + "T10:00:00Z",
          bidSubmissionDeadline: new Date(Date.now() + 25*24*60*60*1000).toISOString(),
          openingDate: new Date(Date.now() + 26*24*60*60*1000).toISOString(),
          workDescription: "Layout, masonry construction, thermal proofing insulation, and allied refrigeration machinery setup of 1000MT capacity.",
          eligibilityCriteria: {
            minTurnover: 1.5,
            minExperience: 5,
            requiredCertifications: ["Class A Contractor License"],
            msmeOnly: false,
          },
          technicalSpecs: "Polyurethane insulated panels, freon safety compressors, backup 125kVA generator setup.",
          documents: [{ name: "SBD_ColdStorage.pdf", url: "#", type: "NOTICE" }],
          rawText: "CPWD Agricultural cold storage. Budget 3.4 Crores. Tender class A construction clearance.",
          location: "Muzaffarpur, Bihar",
        }
      ],
      railways: [
        {
          externalId: `RAIL/IREPS/ENGG/31${mockRefSuffix}`,
          sourcePortal: "RAILWAYS",
          title: "Platform Drainage and Concrete Bed Overlay at Patna Station Yards",
          department: "East Central Railways (ECR)",
          state: "Bihar",
          category: "Construction",
          subCategory: "Drainage Work",
          tenderValue: 1.6,
          emdAmount: 3.2,
          publishedDate: todayStr + "T11:00:00Z",
          bidSubmissionDeadline: new Date(Date.now() + 18*24*60*60*1000).toISOString(),
          openingDate: new Date(Date.now() + 19*24*60*60*1000).toISOString(),
          workDescription: "Civil engineering rebuild of rail track drainage lanes using high flow concrete base and robust discharge pathways.",
          eligibilityCriteria: {
            minTurnover: 1.0,
            minExperience: 4,
            requiredCertifications: ["Indian Railways Registered Vendor", "Class A Civil"],
            msmeOnly: false,
          },
          textSpecs: "M30 cement blocks, chemical corrosion resistant concrete coat.",
          documents: [{ name: "PatnaYardsSpecs.pdf", url: "#", type: "DETAILED_NOTICE" }],
          rawText: "ECR Platforms drainage refurbishment, budget 1.6 Crores.",
          location: "Patna, Bihar",
        }
      ],
      nhai: [
        {
          externalId: `NHAI/BH/EXP/2026/${mockRefSuffix}`,
          sourcePortal: "NHAI",
          title: "Deployment of Thermoplastic Road Marking Lines and Retroreflective Cat-Eyes on NH-31",
          department: "National Highways Authority of India (NHAI)",
          state: "Bihar",
          category: "Construction",
          subCategory: "Road Markings",
          tenderValue: 2.5,
          emdAmount: 5.0,
          publishedDate: todayStr + "T12:00:00Z",
          bidSubmissionDeadline: new Date(Date.now() + 20*24*60*60*1000).toISOString(),
          openingDate: new Date(Date.now() + 21*24*60*60*1000).toISOString(),
          workDescription: "Full supply, safety layout, thermal paint coating, and dual aspect retroreflective stud indicators over 40km expressway stretch.",
          eligibilityCriteria: {
            minTurnover: 1.0,
            minExperience: 3,
            requiredCertifications: ["Class A Contractor License"],
            msmeOnly: false,
          },
          documents: [{ name: "NH31_MarkingsSpecs.pdf", url: "#", type: "SPECS" }],
          rawText: "NHAI lane markings contract, budget 2.5 Crore, EMD 5 Lakhs.",
          location: "Begusarai, Bihar",
        }
      ],
      bhel: [
        {
          externalId: `PSU/BHEL/GRID/2026/${mockRefSuffix}`,
          sourcePortal: "PSU", // mapped database type
          title: "Rigging and Panel Cable Layout of High Voltage Power Cabinets at Trichy Complex",
          department: "Bharat Heavy Electricals Limited (BHEL)",
          state: "Tamil Nadu",
          category: "Electrical",
          subCategory: "Switchgears",
          tenderValue: 4.2,
          emdAmount: 8.4,
          publishedDate: todayStr + "T08:30:00Z",
          bidSubmissionDeadline: new Date(Date.now() + 30*24*60*60*1000).toISOString(),
          openingDate: new Date(Date.now() + 31*24*60*60*1000).toISOString(),
          workDescription: "Engineering switchgear bay panels assembly, insulation checkout, and armored copper connections laying within heavy manufacturing complex.",
          eligibilityCriteria: {
            minTurnover: 2.0,
            minExperience: 5,
            requiredCertifications: ["Class A Electrical License", "ISO 9001"],
            msmeOnly: false,
          },
          documents: [{ name: "BHEL_Switchgear_Layout.pdf", url: "#", type: "PLANS" }],
          rawText: "BHEL switchgear engineering installation Trichy plant, value 4.2 Crore.",
          location: "Trichy, Tamil Nadu",
        }
      ],
      ntpc: [
        {
          externalId: `PSU/NTPC/ASH/2026/${mockRefSuffix}`,
          sourcePortal: "PSU", // mapped database type
          title: "Ash Dyke Piping Upgradations and Concrete Laying at Barh Super Power Station",
          department: "National Thermal Power Corporation (NTPC)",
          state: "Bihar",
          category: "Water Supply",
          subCategory: "Slurry Transport",
          tenderValue: 5.9,
          emdAmount: 11.8,
          publishedDate: todayStr + "T10:15:00Z",
          bidSubmissionDeadline: new Date(Date.now() + 22*24*60*60*1000).toISOString(),
          openingDate: new Date(Date.now() + 23*24*60*60*1000).toISOString(),
          workDescription: "Renewal of dynamic high wear steel alloy pipes, reinforcement of retaining concrete structures around slurry ash pond cells.",
          eligibilityCriteria: {
            minTurnover: 2.5,
            minExperience: 5,
            requiredCertifications: ["Class A Civil", "ISO 14001 Environment"],
            msmeOnly: false,
          },
          documents: [{ name: "NTPC_DykePipingspecs.pdf", url: "#", type: "SPECS" }],
          rawText: "NTPC Barh power plant coal ash sludge transport corridors, estimate 5.9 Crores.",
          location: "Barh, Bihar",
        }
      ],
      ongc: [
        {
          externalId: `PSU/ONGC/OFFSHORE/2026/${mockRefSuffix}`,
          sourcePortal: "PSU", // mapped database type
          title: "Precision Piping Welds and Rigging Supports at KG-Basin Deep Water Facility",
          department: "Oil and Natural Gas Corporation (ONGC)",
          state: "Andhra Pradesh",
          category: "Construction",
          subCategory: "Offshore Piping",
          tenderValue: 14.5,
          emdAmount: 29.0,
          publishedDate: todayStr + "T09:45:00Z",
          bidSubmissionDeadline: new Date(Date.now() + 35*24*60*60*1000).toISOString(),
          openingDate: new Date(Date.now() + 36*24*60*60*1000).toISOString(),
          workDescription: "High pressure alloy welding operations, stress checking of risers and platform deck piping systems complying with API standards.",
          eligibilityCriteria: {
            minTurnover: 6.0,
            minExperience: 8,
            requiredCertifications: ["PESO Safety License", "ISO 9001", "AWS Certified Welding Site Spec"],
            msmeOnly: false,
          },
          documents: [{ name: "ONGC_Offshore_KGSpecs.pdf", url: "#", type: "STANDARDS" }],
          rawText: "ONGC KG Deepwater bay piping support, value Rs 14.5 Crore.",
          location: "Kakinada, Andhra Pradesh",
        }
      ],
      powergrid: [
        {
          externalId: `PSU/PGCIL/BAY/2026/${mockRefSuffix}`,
          sourcePortal: "PSU", // mapped database type
          title: "Bay Extensions of 132kV Transformer Substations at Kishanganj Hub",
          department: "Power Grid Corporation of India (PowerGrid)",
          state: "Bihar",
          category: "Electrical",
          subCategory: "Substation Bay",
          tenderValue: 6.8,
          emdAmount: 13.6,
          publishedDate: todayStr + "T07:15:00Z",
          bidSubmissionDeadline: new Date(Date.now() + 28*24*60*60*1000).toISOString(),
          openingDate: new Date(Date.now() + 29*24*60*60*1000).toISOString(),
          workDescription: "Supply, layout, civil foundation, electrical mounting, and grid telemetry integration of 1x fresh 132kV bay corridor.",
          eligibilityCriteria: {
            minTurnover: 3.0,
            minExperience: 6,
            requiredCertifications: ["Class A Electrical License", "PowerGrid Approved Vendor"],
            msmeOnly: false,
          },
          documents: [{ name: "PGCIL_Kishanganj_Layout.pdf", url: "#", type: "CIVIL_ELECTRICAL" }],
          rawText: "PowerGrid substations bay layout additions Kishanganj Bihar, 6.8 Crore INR.",
          location: "Kishanganj, Bihar",
        }
      ],
      state_pwd: [
        {
          externalId: `STATE/BH/RCD_ROAD/2026/${mockRefSuffix}`,
          sourcePortal: "STATE_PWD",
          title: "Pavement Milling and Re-carpeting of Darbhanga Radial Ring Road Stretch",
          department: "Road Construction Department (RCD) Bihar",
          state: "Bihar",
          category: "Construction",
          subCategory: "Road Recarpeting",
          tenderValue: 2.1,
          emdAmount: 4.2,
          publishedDate: todayStr + "T10:30:00Z",
          bidSubmissionDeadline: new Date(Date.now() + 15*24*60*60*1000).toISOString(),
          openingDate: new Date(Date.now() + 16*24*60*60*1000).toISOString(),
          workDescription: "Controlled cold milling of deteriorated bitumen sheets, granular leveling, and heavy dense bituminous concrete layout over 4.8 km section.",
          eligibilityCriteria: {
            minTurnover: 1.0,
            minExperience: 3,
            requiredCertifications: ["Class A Contractor License"],
            msmeOnly: false,
          },
          documents: [{ name: "SBD_DarbhangaRoad.pdf", url: "#", type: "NOTICE" }],
          rawText: "RCD Darbhanga radial rings. Target budget 2.1 Crores. High-density asphalt concrete layout.",
          location: "Darbhanga, Bihar",
        }
      ]
    };

    return staticBids[portal] || [];
  }
}

export const ingestionService = new IngestionService();
