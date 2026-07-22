import fs from "fs";
import path from "path";
import bcryptjs from "bcryptjs";
import { getPrismaClient } from "./prismaClient.js";

export interface User {
  id: string;
  email: string;
  passwordHash: string;
  name: string;
  phone: string;
  plan: "FREE" | "STARTER" | "PROFESSIONAL" | "ENTERPRISE";
  role: "ADMIN" | "USER" | "ORGANIZATION_ADMIN";
  emailVerified: boolean;
  verificationToken?: string | null;
  resetPasswordToken?: string | null;
  resetPasswordExpires?: string | null;
  refreshToken?: string | null;
  organizationId?: string | null;
  trialDaysElapsed?: number;
  isTrialActive?: boolean;
  trialStartDate?: string;
  alertMatrix?: Record<string, Record<string, boolean>>;
  createdAt: string;
  updatedAt: string;
}

export interface CompanyProfile {
  id: string;
  userId: string;
  companyName: string;
  registrationNumber: string;
  gstNumber: string;
  panNumber: string;
  annualTurnover: number; // in Crores
  yearsOfExperience: number;
  categories: string[];
  certifications: string[];
  states: string[];
  msmeRegistered: boolean;
  employeeCount: number;
  pastProjects: { name: string; value: number; client: string; year: number }[];
  isActive: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface Tender {
  id: string;
  externalId: string;
  sourcePortal: "CPPP" | "GEM" | "STATE_PWD" | "RAILWAYS" | "NHAI" | "DEFENSE" | "PSU" | "OTHER";
  title: string;
  department: string;
  state: string;
  category: string;
  subCategory: string;
  tenderValue: number | null; // in Crores
  emdAmount: number | null; // in Lakhs
  publishedDate: string;
  bidSubmissionDeadline: string;
  openingDate: string | null;
  workDescription: string;
  eligibilityCriteria: {
    minTurnover: number; // in Crores
    minExperience: number; // in Years
    requiredCertifications: string[];
    msmeOnly: boolean;
    statesAllowed?: string[];
  };
  technicalSpecs: string | null;
  documents: { name: string; url: string; type: string }[];
  rawText: string;
  aiSummary: string | null;
  aiEligibilityChecklist: any | null;
  status: "ACTIVE" | "CLOSED" | "AWARDED" | "CANCELLED";
  location: string;
  pineconeVectorId: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface TenderMatch {
  id: string;
  tenderId: string;
  companyProfileId: string;
  matchScore: number;
  matchBreakdown: {
    turnoverMatch: boolean;
    certMatch: boolean;
    categoryMatch: boolean;
    stateMatch: boolean;
    experienceMatch: boolean;
    missingItems: string[];
  };
  isBookmarked: boolean;
  userStatus: "NEW" | "REVIEWING" | "BIDDING" | "SUBMITTED" | "WON" | "LOST" | "SKIPPED";
  receiptNumber?: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface BidDocument {
  id: string;
  tenderId: string;
  companyProfileId: string;
  userId: string;
  type: "TECHNICAL_PROPOSAL" | "COVER_LETTER" | "COMPLIANCE_MATRIX" | "BOQ" | "FULL_BID_PACKAGE";
  content: string; // Markdown text
  s3Url: string | null;
  version: number;
  isAiGenerated: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface DocumentVersion {
  versionNumber: number;
  fileName: string;
  s3Url: string;
  createdAt: string;
  ocrText?: string;
  metadata?: Record<string, string>;
}

export interface DocumentVault {
  id: string;
  companyProfileId: string;
  userId: string;
  documentType: "GST_CERTIFICATE" | "PAN_CARD" | "MSME_CERTIFICATE" | "ISO_CERTIFICATE" | "AUDITED_FINANCIALS" | "EXPERIENCE_CERTIFICATE" | "BANK_DETAILS" | "EMD_INSTRUMENT" | "OTHER";
  fileName: string;
  s3Url: string;
  expiryDate: string | null;
  isVerified: boolean;
  year: number | null;
  createdAt: string;
  updatedAt: string;
  
  // Phase 7: Document Management System Support
  currentVersion?: number;
  versions?: DocumentVersion[];
  ocrText?: string;
  metadata?: Record<string, string>;
  aiSummary?: string;
  autoCategorized?: boolean;
}

export interface Alert {
  id: string;
  userId: string;
  tenderId: string;
  type: "NEW_MATCH" | "DEADLINE_REMINDER" | "STATUS_CHANGE" | "DOCUMENT_MISSING" | "SUBSCRIPTION_EVENT";
  channel: "EMAIL" | "WHATSAPP" | "SMS" | "IN_APP" | "PUSH";
  message: string;
  isRead: boolean;
  sentAt: string;
  createdAt: string;
  channelsDispatched?: {
    email?: { sent: boolean; destination: string; timestamp: string; subject?: string; content?: string };
    sms?: { sent: boolean; destination: string; timestamp: string; content?: string };
    whatsapp?: { sent: boolean; destination: string; timestamp: string; content?: string };
    push?: { sent: boolean; destination: string; timestamp: string; content?: string };
    in_app?: { sent: boolean; destination: string; timestamp: string; content?: string };
  };
}

export interface TenderQA {
  id: string;
  tenderId: string;
  userId: string;
  question: string;
  answer: string;
  sourceCitations: { text: string; pageNumber: number; section: string }[];
  createdAt: string;
}

export interface PaymentIntent {
  id: string;
  userId: string;
  planId: string;
  amount: number;
  billingCycle: "MONTHLY" | "ANNUAL";
  gateway: "CASHFREE" | "RAZORPAY";
  method: "UPI" | "CARD" | "NET_BANKING";
  status: "CAPTURED" | "PENDING" | "FAILED";
  createdAt: string;
}

export interface SupportTicketReply {
  sender: "USER" | "ADMIN";
  message: string;
  timestamp: string;
}

export interface SupportTicket {
  id: string;
  userId: string;
  userEmail: string;
  userName: string;
  subject: string;
  message: string;
  status: "OPEN" | "IN_PROGRESS" | "RESOLVED";
  priority: "LOW" | "MEDIUM" | "HIGH" | "CRITICAL";
  category: "BILLING" | "TECHNICAL" | "COMPLIANCE" | "OTHER";
  replies: SupportTicketReply[];
  createdAt: string;
  updatedAt: string;
}

export interface SystemSettings {
  liveGatewayActive: boolean;
  aiRateLimitPerMin: number;
  customServiceFeeMultiplier: number;
  sandboxMode: boolean;
  maintenanceMode: boolean;
}

class LocalDB {
  private fileDir = path.join(process.cwd(), "server", "data");
  private filePath = path.join(this.fileDir, "db.json");

  public data = {
    users: [] as User[],
    companyProfiles: [] as CompanyProfile[],
    tenders: [] as Tender[],
    tenderMatches: [] as TenderMatch[],
    bidDocuments: [] as BidDocument[],
    documentVaults: [] as DocumentVault[],
    alerts: [] as Alert[],
    tenderQAs: [] as TenderQA[],
    paymentIntents: [] as PaymentIntent[],
    supportTickets: [] as SupportTicket[],
    systemSettings: {
      liveGatewayActive: false,
      aiRateLimitPerMin: 60,
      customServiceFeeMultiplier: 1.0,
      sandboxMode: true,
      maintenanceMode: false
    } as SystemSettings
  };

  constructor() {
    this.init();
  }

  private init() {
    if (!fs.existsSync(this.fileDir)) {
      fs.mkdirSync(this.fileDir, { recursive: true });
    }

    if (fs.existsSync(this.filePath)) {
      try {
        const fileContent = fs.readFileSync(this.filePath, "utf-8");
        this.data = JSON.parse(fileContent);
        if (!this.data.supportTickets) {
          this.data.supportTickets = [];
        }
        if (!this.data.systemSettings) {
          this.data.systemSettings = {
            liveGatewayActive: false,
            aiRateLimitPerMin: 60,
            customServiceFeeMultiplier: 1.0,
            sandboxMode: true,
            maintenanceMode: false
          };
        }
        console.log("Local JSON Database initialized from file.");
        return;
      } catch (err) {
        console.error("Failed to parse local DB, reseeding", err);
      }
    }

    // Default Seed Data
    this.seed();
    this.save();
  }

  private saveTimeout: NodeJS.Timeout | null = null;
  private pendingSave = false;

  public save() {
    if (this.saveTimeout) {
      this.pendingSave = true;
      return;
    }

    this.executeSave();

    this.saveTimeout = setTimeout(() => {
      this.saveTimeout = null;
      if (this.pendingSave) {
        this.pendingSave = false;
        this.executeSave();
      }
    }, 2000);
  }

  private executeSave() {
    try {
      fs.writeFileSync(this.filePath, JSON.stringify(this.data, null, 2), "utf-8");
      this.syncChangesToPrisma().catch((err) => {
        console.error("[DB Sync] Background Prisma sync failed:", err);
      });
    } catch (err) {
      console.error("Failed to write database file", err);
    }
  }

  public async syncFromPrisma() {
    const prisma = getPrismaClient();
    if (!prisma) return;

    try {
      console.log("[DB Sync] Loading data from Prisma (PostgreSQL)...");
      const users = await prisma.user.findMany();
      const companyProfiles = await prisma.companyProfile.findMany();
      const tenders = await prisma.tender.findMany();
      const supportTickets = await prisma.supportTicket.findMany();
      const payments = await prisma.payment.findMany();

      if (users.length === 0) {
        console.log("[DB Sync] PostgreSQL is empty. Seeding PostgreSQL...");
        await this.syncAllToPrisma();
        return;
      }

      this.data.users = users.map((u) => ({
        id: u.id,
        email: u.email,
        passwordHash: u.passwordHash,
        name: u.name,
        phone: u.phone || "",
        plan: u.plan as any,
        role: u.role as any,
        emailVerified: u.emailVerified,
        verificationToken: u.verificationToken,
        resetPasswordToken: u.resetPasswordToken,
        resetPasswordExpires: u.resetPasswordExpires ? u.resetPasswordExpires.toISOString() : null,
        refreshToken: u.refreshToken,
        organizationId: u.organizationId,
        createdAt: u.createdAt.toISOString(),
        updatedAt: u.updatedAt.toISOString(),
      }));

      this.data.companyProfiles = companyProfiles.map((cp) => ({
        id: cp.id,
        userId: cp.userId,
        companyName: cp.companyName,
        registrationNumber: cp.registrationNumber,
        gstNumber: cp.gstNumber,
        panNumber: cp.panNumber,
        annualTurnover: cp.annualTurnover,
        yearsOfExperience: cp.yearsOfExperience,
        categories: cp.categories,
        certifications: cp.certifications,
        states: cp.states,
        msmeRegistered: cp.msmeRegistered,
        employeeCount: cp.employeeCount,
        pastProjects: cp.pastProjects as any[],
        isActive: cp.isActive,
        createdAt: cp.createdAt.toISOString(),
        updatedAt: cp.updatedAt.toISOString(),
      }));

      this.data.tenders = tenders.map((t) => ({
        id: t.id,
        externalId: t.externalId,
        sourcePortal: t.sourcePortal as any,
        title: t.title,
        department: t.department,
        state: t.state,
        category: t.category,
        subCategory: t.subCategory,
        tenderValue: t.tenderValue || 0,
        emdAmount: t.emdAmount || 0,
        publishedDate: t.publishedDate.toISOString().split("T")[0],
        bidSubmissionDeadline: t.bidSubmissionDeadline.toISOString().split("T")[0],
        openingDate: t.openingDate ? t.openingDate.toISOString().split("T")[0] : null,
        workDescription: t.workDescription,
        eligibilityCriteria: t.eligibilityCriteria as any,
        technicalSpecs: t.technicalSpecs || "",
        documents: t.documents as any[],
        rawText: t.rawText,
        aiSummary: t.aiSummary || "",
        aiEligibilityChecklist: t.aiEligibilityChecklist as any,
        status: t.status as any,
        location: t.location,
        pineconeVectorId: t.pineconeVectorId,
        createdAt: t.createdAt.toISOString(),
        updatedAt: t.updatedAt.toISOString(),
      }));

      this.data.supportTickets = supportTickets.map((st) => {
        const u = users.find(usr => usr.id === st.userId);
        return {
          id: st.id,
          userId: st.userId,
          userEmail: u?.email || "demo@tenderai.in",
          userName: u?.name || "Ramesh Sharma",
          subject: st.subject,
          message: st.message,
          status: st.status === "CLOSED" ? "RESOLVED" : st.status as any,
          priority: st.priority === "URGENT" ? "CRITICAL" : st.priority as any,
          category: "TECHNICAL" as const,
          replies: [] as any[],
          createdAt: st.createdAt.toISOString(),
          updatedAt: st.updatedAt.toISOString(),
        };
      });

      this.data.paymentIntents = payments.map((p) => ({
        id: p.id,
        userId: p.userId,
        planId: "PROFESSIONAL",
        amount: p.amount,
        billingCycle: "MONTHLY" as const,
        gateway: "RAZORPAY" as const,
        method: "UPI" as const,
        status: p.status === "SUCCESSFUL" ? "CAPTURED" : p.status === "FAILED" ? "FAILED" : "PENDING",
        createdAt: p.createdAt.toISOString(),
      }));

      console.log("[DB Sync] Successfully loaded memory DB from PostgreSQL.");
    } catch (err) {
      console.error("[DB Sync] Failed to load data from Prisma:", err);
    }
  }

  public async syncAllToPrisma() {
    const prisma = getPrismaClient();
    if (!prisma) return;

    try {
      console.log("[DB Sync] Syncing database records to PostgreSQL...");
      
      await prisma.alert.deleteMany();
      await prisma.tenderMatch.deleteMany();
      await prisma.savedTender.deleteMany();
      await prisma.bidDocument.deleteMany();
      await prisma.documentVault.deleteMany();
      await prisma.supportTicket.deleteMany();
      await prisma.payment.deleteMany();
      await prisma.companyProfile.deleteMany();
      await prisma.tender.deleteMany();
      await prisma.user.deleteMany();

      for (const u of this.data.users) {
        await prisma.user.create({
          data: {
            id: u.id,
            email: u.email,
            passwordHash: u.passwordHash,
            name: u.name,
            phone: u.phone || null,
            plan: u.plan || "FREE",
            role: u.role || "USER",
            emailVerified: u.emailVerified || false,
            verificationToken: u.verificationToken || null,
            resetPasswordToken: u.resetPasswordToken || null,
            resetPasswordExpires: u.resetPasswordExpires ? new Date(u.resetPasswordExpires) : null,
            refreshToken: u.refreshToken || null,
            organizationId: u.organizationId || null,
            createdAt: new Date(u.createdAt),
            updatedAt: new Date(u.updatedAt),
          },
        });
      }

      for (const cp of this.data.companyProfiles) {
        const userExists = await prisma.user.findUnique({ where: { id: cp.userId } });
        if (!userExists) {
          await prisma.user.create({
            data: {
              id: cp.userId,
              email: `${cp.userId}@dummypartner.in`,
              passwordHash: "dummy-hash",
              name: cp.companyName,
              role: "USER",
              plan: "FREE",
              emailVerified: true,
            }
          });
        }
        await prisma.companyProfile.create({
          data: {
            id: cp.id,
            userId: cp.userId,
            companyName: cp.companyName,
            registrationNumber: cp.registrationNumber,
            gstNumber: cp.gstNumber,
            panNumber: cp.panNumber,
            annualTurnover: cp.annualTurnover || 0,
            yearsOfExperience: cp.yearsOfExperience || 0,
            categories: cp.categories || [],
            certifications: cp.certifications || [],
            states: cp.states || [],
            msmeRegistered: cp.msmeRegistered || false,
            employeeCount: cp.employeeCount || 0,
            pastProjects: cp.pastProjects || [],
            isActive: cp.isActive !== undefined ? cp.isActive : true,
            createdAt: cp.createdAt ? new Date(cp.createdAt) : new Date(),
            updatedAt: cp.updatedAt ? new Date(cp.updatedAt) : new Date(),
          },
        });
      }

      for (const t of this.data.tenders) {
        await prisma.tender.create({
          data: {
            id: t.id,
            externalId: t.externalId,
            sourcePortal: t.sourcePortal || "OTHER",
            title: t.title,
            department: t.department,
            state: t.state,
            category: t.category,
            subCategory: t.subCategory,
            tenderValue: t.tenderValue || 0,
            emdAmount: t.emdAmount || 0,
            publishedDate: new Date(t.publishedDate),
            bidSubmissionDeadline: new Date(t.bidSubmissionDeadline),
            openingDate: t.openingDate ? new Date(t.openingDate) : null,
            workDescription: t.workDescription || "",
            eligibilityCriteria: t.eligibilityCriteria || {},
            technicalSpecs: t.technicalSpecs || null,
            documents: t.documents || [],
            rawText: t.rawText || "",
            aiSummary: t.aiSummary || null,
            aiEligibilityChecklist: t.aiEligibilityChecklist || null,
            status: t.status || "ACTIVE",
            location: t.location,
            pineconeVectorId: t.pineconeVectorId || null,
            createdAt: t.createdAt ? new Date(t.createdAt) : new Date(),
            updatedAt: t.updatedAt ? new Date(t.updatedAt) : new Date(),
          },
        });
      }

      for (const ticket of this.data.supportTickets) {
        await prisma.supportTicket.create({
          data: {
            id: ticket.id,
            userId: ticket.userId,
            subject: ticket.subject,
            message: ticket.message,
            status: ticket.status === "RESOLVED" ? "RESOLVED" : ticket.status as any,
            priority: ticket.priority === "CRITICAL" ? "URGENT" : ticket.priority as any,
            createdAt: new Date(ticket.createdAt),
            updatedAt: new Date(ticket.updatedAt),
          },
        });
      }

      if (this.data.paymentIntents) {
        for (const pay of this.data.paymentIntents) {
          await prisma.payment.create({
            data: {
              id: pay.id,
              userId: pay.userId,
              amount: pay.amount,
              currency: "INR",
              status: pay.status === "CAPTURED" ? "SUCCESSFUL" : pay.status === "FAILED" ? "FAILED" : "PENDING",
              stripePaymentIntentId: pay.id,
              invoiceNumber: `INV-${pay.id.substring(3, 8).toUpperCase()}`,
              createdAt: new Date(pay.createdAt),
            },
          });
        }
      }

      console.log("[DB Sync] Full synchronization to PostgreSQL complete.");
    } catch (err) {
      console.error("[DB Sync] Full synchronization to PostgreSQL failed:", err);
    }
  }

  public async syncChangesToPrisma() {
    const prisma = getPrismaClient();
    if (!prisma) return;

    try {
      console.log("[DB Sync] Syncing local memory modifications to PostgreSQL...");
      
      for (const u of this.data.users) {
        await prisma.user.upsert({
          where: { id: u.id },
          update: {
            email: u.email,
            passwordHash: u.passwordHash,
            name: u.name,
            phone: u.phone || null,
            plan: u.plan || "FREE",
            role: u.role || "USER",
            emailVerified: u.emailVerified || false,
            verificationToken: u.verificationToken || null,
            resetPasswordToken: u.resetPasswordToken || null,
            resetPasswordExpires: u.resetPasswordExpires ? new Date(u.resetPasswordExpires) : null,
            refreshToken: u.refreshToken || null,
            organizationId: u.organizationId || null,
            updatedAt: new Date(),
          },
          create: {
            id: u.id,
            email: u.email,
            passwordHash: u.passwordHash,
            name: u.name,
            phone: u.phone || null,
            plan: u.plan || "FREE",
            role: u.role || "USER",
            emailVerified: u.emailVerified || false,
            verificationToken: u.verificationToken || null,
            resetPasswordToken: u.resetPasswordToken || null,
            resetPasswordExpires: u.resetPasswordExpires ? new Date(u.resetPasswordExpires) : null,
            refreshToken: u.refreshToken || null,
            organizationId: u.organizationId || null,
            createdAt: new Date(u.createdAt),
            updatedAt: new Date(u.updatedAt),
          }
        });
      }

      for (const cp of this.data.companyProfiles) {
        await prisma.companyProfile.upsert({
          where: { id: cp.id },
          update: {
            companyName: cp.companyName,
            registrationNumber: cp.registrationNumber,
            gstNumber: cp.gstNumber,
            panNumber: cp.panNumber,
            annualTurnover: cp.annualTurnover || 0,
            yearsOfExperience: cp.yearsOfExperience || 0,
            categories: cp.categories || [],
            certifications: cp.certifications || [],
            states: cp.states || [],
            msmeRegistered: cp.msmeRegistered || false,
            employeeCount: cp.employeeCount || 0,
            pastProjects: cp.pastProjects || [],
            isActive: cp.isActive !== undefined ? cp.isActive : true,
            updatedAt: new Date(),
          },
          create: {
            id: cp.id,
            userId: cp.userId,
            companyName: cp.companyName,
            registrationNumber: cp.registrationNumber,
            gstNumber: cp.gstNumber,
            panNumber: cp.panNumber,
            annualTurnover: cp.annualTurnover || 0,
            yearsOfExperience: cp.yearsOfExperience || 0,
            categories: cp.categories || [],
            certifications: cp.certifications || [],
            states: cp.states || [],
            msmeRegistered: cp.msmeRegistered || false,
            employeeCount: cp.employeeCount || 0,
            pastProjects: cp.pastProjects || [],
            isActive: cp.isActive !== undefined ? cp.isActive : true,
            createdAt: cp.createdAt ? new Date(cp.createdAt) : new Date(),
            updatedAt: cp.updatedAt ? new Date(cp.updatedAt) : new Date(),
          }
        });
      }

      for (const t of this.data.tenders) {
        await prisma.tender.upsert({
          where: { id: t.id },
          update: {
            title: t.title,
            department: t.department,
            state: t.state,
            category: t.category,
            subCategory: t.subCategory,
            tenderValue: t.tenderValue || 0,
            emdAmount: t.emdAmount || 0,
            publishedDate: new Date(t.publishedDate),
            bidSubmissionDeadline: new Date(t.bidSubmissionDeadline),
            openingDate: t.openingDate ? new Date(t.openingDate) : null,
            workDescription: t.workDescription || "",
            eligibilityCriteria: t.eligibilityCriteria || {},
            technicalSpecs: t.technicalSpecs || null,
            documents: t.documents || [],
            rawText: t.rawText || "",
            aiSummary: t.aiSummary || null,
            aiEligibilityChecklist: t.aiEligibilityChecklist || null,
            status: t.status || "ACTIVE",
            location: t.location,
            pineconeVectorId: t.pineconeVectorId || null,
            updatedAt: new Date(),
          },
          create: {
            id: t.id,
            externalId: t.externalId,
            sourcePortal: t.sourcePortal || "OTHER",
            title: t.title,
            department: t.department,
            state: t.state,
            category: t.category,
            subCategory: t.subCategory,
            tenderValue: t.tenderValue || 0,
            emdAmount: t.emdAmount || 0,
            publishedDate: new Date(t.publishedDate),
            bidSubmissionDeadline: new Date(t.bidSubmissionDeadline),
            openingDate: t.openingDate ? new Date(t.openingDate) : null,
            workDescription: t.workDescription || "",
            eligibilityCriteria: t.eligibilityCriteria || {},
            technicalSpecs: t.technicalSpecs || null,
            documents: t.documents || [],
            rawText: t.rawText || "",
            aiSummary: t.aiSummary || null,
            aiEligibilityChecklist: t.aiEligibilityChecklist || null,
            status: t.status || "ACTIVE",
            location: t.location,
            pineconeVectorId: t.pineconeVectorId || null,
            createdAt: t.createdAt ? new Date(t.createdAt) : new Date(),
            updatedAt: t.updatedAt ? new Date(t.updatedAt) : new Date(),
          }
        });
      }

      for (const ticket of this.data.supportTickets) {
        await prisma.supportTicket.upsert({
          where: { id: ticket.id },
          update: {
            status: ticket.status === "RESOLVED" ? "RESOLVED" : ticket.status as any,
            priority: ticket.priority === "CRITICAL" ? "URGENT" : ticket.priority as any,
            updatedAt: new Date(),
          },
          create: {
            id: ticket.id,
            userId: ticket.userId,
            subject: ticket.subject,
            message: ticket.message,
            status: ticket.status === "RESOLVED" ? "RESOLVED" : ticket.status as any,
            priority: ticket.priority === "CRITICAL" ? "URGENT" : ticket.priority as any,
            createdAt: new Date(ticket.createdAt),
            updatedAt: new Date(ticket.updatedAt),
          }
        });
      }

      if (this.data.paymentIntents) {
        for (const pay of this.data.paymentIntents) {
          await prisma.payment.upsert({
            where: { id: pay.id },
            update: {
              status: pay.status === "CAPTURED" ? "SUCCESSFUL" : pay.status === "FAILED" ? "FAILED" : "PENDING",
            },
            create: {
              id: pay.id,
              userId: pay.userId,
              amount: pay.amount,
              currency: "INR",
              status: pay.status === "CAPTURED" ? "SUCCESSFUL" : pay.status === "FAILED" ? "FAILED" : "PENDING",
              stripePaymentIntentId: pay.id,
              invoiceNumber: `INV-${pay.id.substring(3, 8).toUpperCase()}`,
              createdAt: new Date(pay.createdAt),
            }
          });
        }
      }

      console.log("[DB Sync] Incremental update successful.");
    } catch (err) {
      console.error("[DB Sync] Incremental sync update failed:", err);
    }
  }

  private seed() {
    console.log("Seeding Database...");

    // 1. Test User
    const user: User = {
      id: "u-1",
      email: "demo@tenderai.in",
      passwordHash: bcryptjs.hashSync("demo123", 10), // For this demo, simple check
      name: "Ramesh Sharma",
      phone: "+91 98765 43210",
      plan: "STARTER",
      role: "ADMIN",
      emailVerified: true,
      verificationToken: null,
      resetPasswordToken: null,
      resetPasswordExpires: null,
      refreshToken: null,
      organizationId: null,
      trialDaysElapsed: 1,
      isTrialActive: true,
      trialStartDate: new Date().toISOString(),
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };
    this.data.users.push(user);

    // 2. Company Profile
    const companyProfile: CompanyProfile = {
      id: "cp-1",
      userId: "u-1",
      companyName: "Sharma Construction & Infra, Pvt Ltd",
      registrationNumber: "U45201BR2015PTC024501",
      gstNumber: "10AAAXX0000Z1Z5",
      panNumber: "AAACX1234F",
      annualTurnover: 5.2, // 5.2 Crores INR average
      yearsOfExperience: 8,
      categories: ["Construction", "Civil", "Roads", "Electrical"],
      certifications: ["ISO 9001", "MSME (Udyam)", "Class A Contractor License"],
      states: ["Bihar", "Jharkhand", "Uttar Pradesh"],
      msmeRegistered: true,
      employeeCount: 45,
      pastProjects: [
        {
          name: "Construction of Bypass Road, Patna Outer Ring",
          value: 3.2, // in Crores
          client: "Bihar PWD",
          year: 2024,
        },
        {
          name: "Electrical Layout and Substations for Ara Complex",
          value: 1.1,
          client: "Power Grid Corp Bihar",
          year: 2023,
        },
        {
          name: "Sewerage Line Construction and Excavation, Muzaffarpur",
          value: 0.85,
          client: "Muzaffarpur Municipal Corp",
          year: 2022,
        },
      ],
      isActive: true,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };
    this.data.companyProfiles.push(companyProfile);

    // Seeding Virtual Partner Profiles for JVs / Consortium Builder
    const partnerTurnover: CompanyProfile = {
      id: "cp-partner-turnover",
      userId: "u-partner-1",
      companyName: "Vardhan Infrastructure & Holdings Ltd",
      registrationNumber: "U45201MH2012PLC230981",
      gstNumber: "27AAACV4891M1Z4",
      panNumber: "AAACV4891M",
      annualTurnover: 25.0, // 25 Crores average
      yearsOfExperience: 12,
      categories: ["Construction", "Civil", "Roads", "Mega Projects"],
      certifications: ["ISO 9001", "Class A civil License", "Class A Electrical License"],
      states: ["Bihar", "Jharkhand", "Delhi", "Maharashtra"],
      msmeRegistered: false,
      employeeCount: 150,
      pastProjects: [
        { name: "NH Road Widening Phase III", value: 18.5, client: "NHAI", year: 2024 },
        { name: "Government Medical College Complex", value: 14.0, client: "CPWD", year: 2023 }
      ],
      isActive: true,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };
    const partnerTech: CompanyProfile = {
      id: "cp-partner-tech",
      userId: "u-partner-2",
      companyName: "Apex Green Energy Technologies",
      registrationNumber: "U40106UP2018PTC105432",
      gstNumber: "09AAACA3321A1Za",
      panNumber: "AAACA3321A",
      annualTurnover: 6.5, // 6.5 Crores
      yearsOfExperience: 5,
      categories: ["Solar", "Electrical", "Technology", "Construction"],
      certifications: ["ISO 14001", "PESO Safety License", "Class A Electrical License", "MNRE Empaneled"],
      states: ["Bihar", "Jharkhand", "Uttar Pradesh", "West Bengal"],
      msmeRegistered: true,
      employeeCount: 30,
      pastProjects: [
        { name: "100kW Rooftop Solar Power Plant Installation", value: 0.95, client: "BREDA", year: 2023 },
        { name: "Industrial Electrical Substations Array", value: 2.1, client: "IOCL", year: 2024 }
      ],
      isActive: true,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };
    const partnerLocal: CompanyProfile = {
      id: "cp-partner-local",
      userId: "u-partner-3",
      companyName: "Mithila Civil Associates",
      registrationNumber: "U45203BR2016PTC031204",
      gstNumber: "10AAACM7741R2ZC",
      panNumber: "AAACM7741R",
      annualTurnover: 3.0, // 3.0 Crores
      yearsOfExperience: 10,
      categories: ["Construction", "Roads", "Civil"],
      certifications: ["Class A Contractor License", "ISO 9001"],
      states: ["Bihar"],
      msmeRegistered: true,
      employeeCount: 20,
      pastProjects: [
        { name: "District Hospital PWD Ward Construction", value: 1.2, client: "Bihar Health Dept", year: 2023 }
      ],
      isActive: true,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };
    this.data.companyProfiles.push(partnerTurnover, partnerTech, partnerLocal);

    // 3. Realistic 20 Indian Tenders across portals
    const sampleTenders: Partial<Tender>[] = [
      {
        id: "t-1",
        externalId: "CPPP/2026/BR/001",
        sourcePortal: "CPPP",
        title: "Construction of Academic Block and Hostel Building at IIT Patna",
        department: "Central Public Works Department (CPWD)",
        state: "Bihar",
        category: "Construction",
        subCategory: "Civil Work",
        tenderValue: 8.5, // 8.5 Crores
        emdAmount: 17.0, // 17 Lakhs
        publishedDate: "2026-05-25T10:00:00Z",
        bidSubmissionDeadline: "2026-06-25T15:00:00Z",
        openingDate: "2026-06-26T15:30:00Z",
        workDescription: "Comprehensive construction of academic block (G+4) and boys hostel building (G+3) with allied internal/external electrification, water supply, sewage treatment plant, and landscape developments at IIT Patna permanent campus.",
        eligibilityCriteria: {
          minTurnover: 4.0, // Needs 4 Crores
          minExperience: 5,
          requiredCertifications: ["Class A Contractor License", "ISO 9001"],
          msmeOnly: false,
          statesAllowed: ["Bihar", "Jharkhand", "Uttar Pradesh"],
        },
        technicalSpecs: "Reinforced cement concrete structure, AAC block masonry, high-end vitrified tile flooring, smart fire security layout, aluminum glazed windows, and structured cabling for IT networks.",
        documents: [
          { name: "Tender Notice.pdf", url: "#", type: "NOTICE" },
          { name: "SBD_Civil_Construction.pdf", url: "#", type: "BOQ" },
          { name: "GCC_CPWD_2024.pdf", url: "#", type: "GENERAL_CONDITIONS" },
        ],
        rawText: "RE-TENDER NOTICE. Central Public Works Department CPWD invites bids for academics block at IIT Patna. Total project budget cost Estimate: Rs. 8,50,00,000/- (Rupees Eight Crores Fifty Lakhs Only). EMD: Rs. 17 Lakhs. The bidder must have completed at least one single road/building civil work of Rs. 4 Crore in last 5 years. Average financial turnover in last 3 financial years must be at least 4.0 Crore. Registration in Class-A under civil category is mandatory. ISO 9001 certification highly preferred.",
        status: "ACTIVE",
        location: "Patna, Bihar",
        pineconeVectorId: null,
      },
      {
        id: "t-2",
        externalId: "GEM/2026/B/88122",
        sourcePortal: "GEM",
        title: "Supply and Commissioning of 200kW Grid-Connected Solar Rooftop Panels",
        department: "Bihar Renewable Energy Development Agency (BREDA)",
        state: "Bihar",
        category: "Electrical",
        subCategory: "Solar Systems",
        tenderValue: 1.2, // 1.2 Crore
        emdAmount: 2.4, // 2.4 Lakhs
        publishedDate: "2026-06-01T09:00:00Z",
        bidSubmissionDeadline: "2026-06-15T17:00:00Z",
        openingDate: "2026-06-16T11:00:00Z",
        workDescription: "Supply, installing testing and commercial commissioning of 200kW grid-interactive SPV power plant at government medical college, Bettiah, Bihar including 5 years of post-commissioning maintenance.",
        eligibilityCriteria: {
          minTurnover: 0.8, // 80 Lakhs
          minExperience: 3,
          requiredCertifications: ["MSME (Udyam)", "ISO 9001", "BREDA Empanelment"],
          msmeOnly: true, // MSME gets strong weightage
          statesAllowed: ["Bihar"],
        },
        technicalSpecs: "Poly-crystalline Tier-1 panels, smart net metering array, hot-dip galvanized mounting structures capable of withstanding 150km/h wind speeds.",
        documents: [
          { name: "GeM_Bid_ItemSpecification.xlsx", url: "#", type: "NOTICE" },
          { name: "SolarSpecsBREDA.pdf", url: "#", type: "TECHNICAL" },
        ],
        rawText: "BREDA Tender Notification on GeM. Solar PV Installation 200 kW Bettiah Medical Hospital. Estimated Tender Cost: INR 1,20,00,000 (INR One Crore Twenty Lakhs). EMD exemption applies for MSME-registered agencies. Required experience is minimum 3 years in Solar operations. Annual turnover must be above 80 Lakhs. Valid BREDA registration as Empanelled A-class solar agency or equivalent national empanelment required.",
        status: "ACTIVE",
        location: "Bettiah, Bihar",
        pineconeVectorId: null,
      },
      {
        id: "t-3",
        externalId: "STATE/BH/PWD/26/4",
        sourcePortal: "STATE_PWD",
        title: "Widening and Amelioration Works of Hajipur-Mahua Roadway Section",
        department: "Bihar Road Construction Department (RCD)",
        state: "Bihar",
        category: "Construction",
        subCategory: "Road Work",
        tenderValue: 4.8, // 4.8 Crores
        emdAmount: 9.6, // 9.6 Lakhs
        publishedDate: "2026-05-30T11:00:00Z",
        bidSubmissionDeadline: "2026-06-10T14:00:00Z",
        openingDate: "2026-06-11T14:30:00Z",
        workDescription: "Widening and overlaying of 6.2 km stretch of road including earthwork, granular sub-base, wet mix macadam, prime coat, tack coat, and dense bituminous macadam.",
        eligibilityCriteria: {
          minTurnover: 2.0, // 2 Crores
          minExperience: 4,
          requiredCertifications: ["Class A Contractor License", "GST registration"],
          msmeOnly: false,
          statesAllowed: ["Bihar", "Jharkhand"],
        },
        technicalSpecs: "Standard highway bituminous concrete layer, drainage construction, and retroreflective safety sign boards.",
        documents: [
          { name: "RoadTender_Hajipur_Mahua.pdf", url: "#", type: "DETAILED_NOTICE" },
        ],
        rawText: "Office of Executive Engineer, Hajipur Division RCD. Tender for Roadway Widening Mahua stretch. Total value: Rs 4,80,00,000. Under Class-A license categories. EMD of Rs 9,60,000 is to be submitted. Required average turnover of last 3 preceding years must exceed Rs 2.0 Crores. MSME incentives applicable as per state policy guidelines.",
        status: "ACTIVE",
        location: "Hajipur, Bihar",
        pineconeVectorId: null,
      },
      {
        id: "t-4",
        externalId: "RAIL/ECR/ENGG/2361",
        sourcePortal: "RAILWAYS",
        title: "Platform Upgradation and Shed Extension at Muzaffarpur Junction Railway Station",
        department: "East Central Railway (ECR)",
        state: "Bihar",
        category: "Construction",
        subCategory: "Civil Structure",
        tenderValue: 2.1, // 2.1 Crores
        emdAmount: 4.2, // 4.2 Lakhs
        publishedDate: "2026-06-02T12:00:00Z",
        bidSubmissionDeadline: "2026-06-28T15:00:00Z",
        openingDate: "2026-06-28T16:00:00Z",
        workDescription: "Civil engineering upgradation works of platform surfaces 2 and 3, installation of steel framing structures for extended passenger weather sheds, and tactile pathway tile embedding.",
        eligibilityCriteria: {
          minTurnover: 1.5,
          minExperience: 5,
          requiredCertifications: ["Indian Railways Registered Vendor", "Class A Civil"],
          msmeOnly: false,
          statesAllowed: [],
        },
        technicalSpecs: "IS-2062 Grade Steel truss, corrugated aluminum sheeting, high-durability polymer concrete.",
        documents: [
          { name: "RailwaysShedDraft.pdf", url: "#", type: "NOTICE" },
        ],
        rawText: "Muzaffarpur Junction Platform Refurbishment under ECR Hajipur division. Estimated budget 2.1 Crore. Experience of completing platform shed structures is mandatory. Registered Railway contractor license is required. Annual turnover requirement is 1.5 Crores or high-value similar project track records.",
        status: "ACTIVE",
        location: "Muzaffarpur, Bihar",
        pineconeVectorId: null,
      },
      {
        id: "t-5",
        externalId: "NHAI/HQ/2026/667",
        sourcePortal: "NHAI",
        title: "Construction of Median Barriers and Solar Powered Blinkers on NH-57 Stretch",
        department: "National Highways Authority of India (NHAI)",
        state: "Bihar",
        category: "Construction",
        subCategory: "Traffic Safety",
        tenderValue: 5.4, // 5.4 Crores
        emdAmount: 11.0, // 11 Lakhs
        publishedDate: "2026-05-28T16:00:00Z",
        bidSubmissionDeadline: "2026-06-20T12:00:00Z",
        openingDate: "2026-06-21T14:00:00Z",
        workDescription: "Implementation of safety measures including Pre-cast RCC New Jersey crash barriers, retroreflective thermoplastic road markings, and installation of solar intelligent blinker lights over 25km stretch of NH-57.",
        eligibilityCriteria: {
          minTurnover: 3.0,
          minExperience: 6,
          requiredCertifications: ["Class A Civil License", "ISO 14001 Environment"],
          msmeOnly: false,
          statesAllowed: [],
        },
        technicalSpecs: "Crash barrier dynamic load resistance of 100kN, high durability polycarbonate blinkers.",
        documents: [
          { name: "NHAI_Specs_CrashBarriers.pdf", url: "#", type: "SPECS" },
        ],
        rawText: "National Highways Authority of India HQ. Bid submission invitation. NH57 safety barrier precast sections. Value Rs 5.4 Crores. EMD of Rs 11 Lakhs. Required Class-A license. Turnovers of 3.0 Cr required. Experience is minimum 6 years of roadway safety or civil infrastructure projects.",
        status: "ACTIVE",
        location: "Darbhanga, Bihar",
        pineconeVectorId: null,
      },
      {
        id: "t-6",
        externalId: "PSU/IOCL/ES-44",
        sourcePortal: "PSU",
        title: "Fire Hydrant and Fire Safety Upgradation at Barauni Refinery Terminal",
        department: "Indian Oil Corporation Limited (IOCL)",
        state: "Bihar",
        category: "Electrical",
        subCategory: "Safety Equipment",
        tenderValue: 2.8, // 2.8 Crores
        emdAmount: 5.6,
        publishedDate: "2026-06-02T10:00:00Z",
        bidSubmissionDeadline: "2026-06-29T13:00:00Z",
        openingDate: "2026-06-30T14:30:00Z",
        workDescription: "Installation of high-pressure motor-driven safety pumps, automatic sprinkler systems, fire proof electrical cabling, clean gas fire control, and centralized warning consoles.",
        eligibilityCriteria: {
          minTurnover: 1.2,
          minExperience: 4,
          requiredCertifications: ["PESO Safety License", "ISO 9001"],
          msmeOnly: false,
        },
        technicalSpecs: "Pumps matching API-610 standards, electrical components Flameproof (Exd Zone 1 class).",
        documents: [
          { name: "IOCL_Barauni_FireHydrant.pdf", url: "#", type: "NOTICE" },
        ],
        rawText: "IOCL Barauni Refinery Security Engineering Division. Fire safety automation grid commissioning. Value 2.8 Cr. Minimum experience of 4 years doing industrial PESO licensed work. Turnover over 1.2 Cr in last 3 years.",
        status: "ACTIVE",
        location: "Begusarai, Bihar",
        pineconeVectorId: null,
      },
      {
        id: "t-7",
        externalId: "DEF/MESE/2026/97",
        sourcePortal: "DEFENSE",
        title: "Rewiring and Substation Renewal at Danapur Cantonment Housing Grid",
        department: "Military Engineer Services (MES)",
        state: "Bihar",
        category: "Electrical",
        subCategory: "Power Grid",
        tenderValue: 0.95, // 95 Lakhs
        emdAmount: 1.9,
        publishedDate: "2026-05-15T08:00:00Z",
        bidSubmissionDeadline: "2026-06-08T15:00:00Z",
        openingDate: "2026-06-09T10:00:00Z",
        workDescription: "Phase-wise replacement of vintage residential overhead cables with LT insulated underground armored cables and replacement of 1x 250kVA transformer.",
        eligibilityCriteria: {
          minTurnover: 0.5,
          minExperience: 3,
          requiredCertifications: ["MES Registered Contractor", "Class A Electrical License"],
          msmeOnly: true,
        },
        technicalSpecs: "XLPE insulation, automatic breaker relays, vacuum circuit breakers.",
        documents: [
          { name: "Danapur_Substation_Layout.pdf", url: "#", type: "DESIGN" },
        ],
        rawText: "MES Danapur Cantonment substation cables replacement. Value 95 Lakhs. Registered Class-A electrical contractor. EMD exemption for general MSME. Experience of 3 years required. MSME specific preferences.",
        status: "ACTIVE",
        location: "Danapur, Bihar",
        pineconeVectorId: null,
      },
      // Adding closed, awarded and other items to complete 20
      {
        id: "t-8",
        externalId: "CPPP/2026/JH/012",
        sourcePortal: "CPPP",
        title: "Construction of District Hospital Ward at Ranchi Campus",
        department: "Jharkhand State PWD",
        state: "Jharkhand",
        category: "Construction",
        subCategory: "Medical Civil",
        tenderValue: 12.0, // 12 Crores
        emdAmount: 24.0,
        publishedDate: "2026-05-10T10:00:00Z",
        bidSubmissionDeadline: "2026-06-01T15:00:00Z", // Expired
        openingDate: "2026-06-02T10:00:00Z",
        workDescription: "Multi-floor building block specialized for state medical treatment facilities.",
        eligibilityCriteria: {
          minTurnover: 8.0,
          minExperience: 7,
          requiredCertifications: ["Class A civil License"],
          msmeOnly: false,
        },
        technicalSpecs: "",
        documents: [],
        rawText: "Ranchi PWD civil construction district hospital",
        status: "CLOSED",
        location: "Ranchi, Jharkhand",
        pineconeVectorId: null,
      },
    ];

    // Let's dynamically construct additional realistic tenders to complete 20 tenders total
    const categories = ["Construction", "Electrical", "IT Support", "Water Supply", "Roads"];
    const departments = [
      "CPWD Central Division",
      "GeM Buyer Cell Infrastructure",
      "Bihar Urban Development Agency",
      "Jharkhand Drinking Water Dept",
      "NTPC Barh Power Complex Group",
      "Braj Construction Corp Ltd",
      "Eastern Railway Engineering",
      "North Bihar Power Distribution (NBPDCL)",
      "South Bihar Power Distribution (SBPDCL)"
    ];
    const states = ["Bihar", "Jharkhand", "Uttar Pradesh", "West Bengal", "Odisha"];
    const scopes = ["Civil Work", "Installation", "Consultancy", "Maintenance", "Materials"];

    for (let i = 9; i <= 20; i++) {
      const cat = categories[i % categories.length];
      const dept = departments[i % departments.length];
      const st = states[i % states.length];
      const sc = scopes[i % scopes.length];
      const value = Number((0.55 + (i * 0.45)).toFixed(2));
      const emd = Number((value * 2.0).toFixed(1)); // EMD standard 2% typically
      const dayOffset = (i * 3) - 15; // some before, some after
      const deadline = new Date(Date.now() + dayOffset * 24 * 60 * 60 * 1000).toISOString();
      const published = new Date(Date.now() - 10 * 24 * 60 * 60 * 1000).toISOString();
      const sources: ("CPPP" | "GEM" | "STATE_PWD" | "RAILWAYS" | "NHAI" | "DEFENSE" | "PSU" | "OTHER")[] = ["CPPP", "GEM", "STATE_PWD", "RAILWAYS", "PSU"];
      const portal = sources[i % sources.length];

      sampleTenders.push({
        id: `t-${i}`,
        externalId: `${portal}/2026/SME/00${i}`,
        sourcePortal: portal,
        title: `Comprehensive ${sc} and Infrastructure Supply Task for ${cat} Utilities at ${st} Regional Complex`,
        department: dept,
        state: st,
        category: cat,
        subCategory: sc,
        tenderValue: value,
        emdAmount: emd,
        publishedDate: published,
        bidSubmissionDeadline: deadline,
        openingDate: new Date(new Date(deadline).getTime() + 24 * 60 * 60 * 1000).toISOString(),
        workDescription: `This is a public tender call issued by ${dept} for execution of high durability ${sc} solutions. Detailed schedule of quantities (BOQ) is enclosed inside the tender bid documents. Strictly conforming to standard public procurement safety norms.`,
        eligibilityCriteria: {
          minTurnover: Number((value * 0.45).toFixed(2)),
          minExperience: i % 4 + 2,
          requiredCertifications: i % 2 === 0 ? ["Class A Contractor License"] : ["ISO 9001"],
          msmeOnly: i % 3 === 0,
          statesAllowed: [st],
        },
        technicalSpecs: `Conforming to certified bureau standardizations under active monitoring. Materials checked by third party supervision before field dispatch.`,
        documents: [
          { name: `Detailed_SBD_${i}.pdf`, url: "#", type: "BID_SPECIFICATION" },
          { name: `BOQ_Template_${i}.xlsx`, url: "#", type: "FINANCIAL_SHEET" },
        ],
        rawText: `Ingested text: ${dept} project with budgeted estimate: Rs ${value} Crore. Full-scale project schedule. Average turnover requested: Rs ${Number((value * 0.45).toFixed(2))} Crore. Standard credentials matching ISO procedures needed.`,
        status: new Date(deadline) < new Date() ? "CLOSED" : "ACTIVE",
        location: `${st} Hub`,
        pineconeVectorId: null,
      });
    }

    // Assign to DB data
    this.data.tenders = sampleTenders as Tender[];

    // 4. Calculate TenderMatch for CP-1 & Tenders
    this.recalculateMatches("cp-1");

    // 5. Pre-generate some Bid Documents for testing
    const bidDocs: BidDocument[] = [
      {
        id: "bd-1",
        tenderId: "t-1", // IIT Patna
        companyProfileId: "cp-1",
        userId: "u-1",
        type: "COVER_LETTER",
        content: `# COVER LETTER

**To,**
The Executive Engineer (Civil), Central division,
Central Public Works Department (CPWD),
Patna, Bihar.

**Subject: Bid Submission for Construction of Academic Block and Hostel Building at IIT Patna (Tender Ref: CPPP/2026/BR/001)**

Respected Sir,

Having analyzed the tender specifications and layout drawings for academic block and hostel building constructions at IIT Patna, we are pleased to present our technical bid document package for your considerations.

Sharma Construction & Infra, Pvt Ltd is a premier Class A engineering contractor licensed with state departments, operating actively in Bihar for over 8 years. We possess average annual financial turnovers of Rs. 5.2 Crores and are an MSME-registered (Udyam) company with certifications of ISO 9001.

Enclosures with this application:
1. Proof of earnest money deposit (EMD) of 17 Lakhs.
2. Experience sheets of outer ring lane bypass roadways and substation utilities.
3. Attested audited financials sheets for three preceding cycles.
4. Active registration credentials of Category A contractor.

We declare all claims are accurate. Our staff and mechanical machinery are fully mobilizable for timely delivery.

Yours Faithfully,

**Ramesh Sharma**
Managing Director,
Sharma Construction & Infra, Pvt Ltd.
Date: 02-Jun-2026`,
        s3Url: null,
        version: 1,
        isAiGenerated: true,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      },
      {
        id: "bd-2",
        tenderId: "t-2", //BREDA Solar
        companyProfileId: "cp-1",
        userId: "u-1",
        type: "TECHNICAL_PROPOSAL",
        content: `# TECHNICAL PROPOSAL & METHODOLOGY STATEMENT

## Executive Summary
This proposal is presented by **Sharma Construction & Infra, Pvt Ltd** for the supply, testing, panel alignment, net-metering synchronization, and long-term grid commissioning of the 200kW Grid-Connected Solar Rooftop system at Hospital Ground Bettiah. As an ISO 9001 and MSME entity registered natively in Bihar, we offer complete site readiness and native engineers.

## Proposed Implementation Plan
* Phase 1: Grid Structural Inspection and Tilt Optimization (Days 1–7)
* Phase 2: Anchored Substructure Mountings Installation (Days 8–18)
* Phase 3: Poly-crystalline Modules Rigging and Inverter Wiring (Days 19–30)
* Phase 4: Bi-Directional Net-Meter Activation with BREDA and DISCOM (Days 31–40)

## Technical Compliance Checklist
* PV Panel Warranty: 25 Years linear performance (Fully Compliant)
* Inverter safety: IP65 cabinet protection with grid diagnostic (Fully Compliant)
* Galvanized Structure: Capable of withstanding gusts up to 150 km/h (Fully Compliant)`,
        s3Url: null,
        version: 1,
        isAiGenerated: true,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      },
    ];
    this.data.bidDocuments = bidDocs;

    // 6. Seed Document Vault
    const vaultItems: DocumentVault[] = [
      {
        id: "dv-1",
        companyProfileId: "cp-1",
        userId: "u-1",
        documentType: "GST_CERTIFICATE",
        fileName: "GSTIN_Certificate_SharmaInfra.pdf",
        s3Url: "https://tenderai-docs.s3.ap-south-1.amazonaws.com/cp-1/GSTIN_Certificate_SharmaInfra.pdf",
        expiryDate: null,
        isVerified: true,
        year: null,
        createdAt: new Date(Date.now() - 100 * 24 * 60 * 60 * 1000).toISOString(),
        updatedAt: new Date().toISOString(),
      },
      {
        id: "dv-2",
        companyProfileId: "cp-1",
        userId: "u-1",
        documentType: "MSME_CERTIFICATE",
        fileName: "Udyam_MSME_Registration_Sharma.pdf",
        s3Url: "https://tenderai-docs.s3.ap-south-1.amazonaws.com/cp-1/Udyam_MSME_Registration_Sharma.pdf",
        expiryDate: "2030-12-31",
        isVerified: true,
        year: null,
        createdAt: new Date(Date.now() - 80 * 24 * 60 * 60 * 1000).toISOString(),
        updatedAt: new Date().toISOString(),
      },
      {
        id: "dv-3",
        companyProfileId: "cp-1",
        userId: "u-1",
        documentType: "PAN_CARD",
        fileName: "Company_PAN_AAACX1234F.pdf",
        s3Url: "https://tenderai-docs.s3.ap-south-1.amazonaws.com/cp-1/Company_PAN_AAACX1234F.pdf",
        expiryDate: null,
        isVerified: true,
        year: null,
        createdAt: new Date(Date.now() - 100 * 24 * 60 * 60 * 1000).toISOString(),
        updatedAt: new Date().toISOString(),
      },
      {
        id: "dv-4",
        companyProfileId: "cp-1",
        userId: "u-1",
        documentType: "AUDITED_FINANCIALS",
        fileName: "FY2024_25_Audited_BalanceSheet.pdf",
        s3Url: "https://tenderai-docs.s3.ap-south-1.amazonaws.com/cp-1/FY2024_25_Audited_BalanceSheet.pdf",
        expiryDate: null,
        isVerified: true,
        year: 2025,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      },
      {
        id: "dv-5",
        companyProfileId: "cp-1",
        userId: "u-1",
        documentType: "EXPERIENCE_CERTIFICATE",
        fileName: "PatnaBypass_RCD_CompletionCert.pdf",
        s3Url: "https://tenderai-docs.s3.ap-south-1.amazonaws.com/cp-1/PatnaBypass_RCD_CompletionCert.pdf",
        expiryDate: null,
        isVerified: true,
        year: 2024,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      },
      {
        id: "dv-6",
        companyProfileId: "cp-1",
        userId: "u-1",
        documentType: "ISO_CERTIFICATE",
        fileName: "ISO_9001_Compliance_ शर्मा.pdf",
        s3Url: "https://tenderai-docs.s3.ap-south-1.amazonaws.com/cp-1/ISO_9001_Compliance.pdf",
        expiryDate: "2026-07-15", // EXPIRING VERY SOON (WARN)
        isVerified: true,
        year: null,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      },
    ];
    this.data.documentVaults = vaultItems;

    // 7. Dummy Alerts
    const alerts: Alert[] = [
      {
        id: "al-1",
        userId: "u-1",
        tenderId: "t-1",
        type: "NEW_MATCH",
        channel: "IN_APP",
        message: "High match score (85%) identified for Academic Block Construction at IIT Patna. Deadline in 23 days.",
        isRead: false,
        sentAt: new Date().toISOString(),
        createdAt: new Date().toISOString(),
        channelsDispatched: {
          in_app: {
            sent: true,
            destination: "In-App Feed Station Panel",
            timestamp: new Date().toISOString(),
            content: "High match score (85%) identified for Academic Block Construction at IIT Patna. Deadline in 23 days."
          },
          email: {
            sent: true,
            destination: "msvm220@gmail.com",
            timestamp: new Date().toISOString(),
            subject: "[TenderAI] High Compatibility Tender Match Discovered (85%)",
            content: `<div style="font-family: Inter, sans-serif; max-width: 600px; margin: 0 auto; padding: 24px; border: 1px solid #e2e8f0; border-radius: 16px; background-color: #ffffff; color: #1e293b;">
    <div style="display: flex; align-items: center; margin-bottom: 24px;">
      <span style="font-size: 20px; font-weight: 800; color: #2563eb;">TenderAI</span>
      <span style="font-size: 11px; margin-left: 8px; font-weight: bold; padding: 2px 8px; background-color: #eff6ff; border-radius: 9999px; color: #1d4ed8; text-transform: uppercase;">Real-time Matching</span>
    </div>
    <h2 style="font-size: 18px; font-weight: 800; margin-bottom: 8px; color: #0f172a; tracking: -0.025em;">Tender Match Alert</h2>
    <p style="font-size: 13px; line-height: 1.6; margin-bottom: 20px; color: #475569;">Greetings, we identified an extremely strong compliance alignment between your company credentials and a newly published public contract opportunity.</p>
    <div style="padding: 16px; background-color: #f8fafc; border: 1px solid #e2e8f0; border-radius: 12px; margin-bottom: 24px;">
      <div style="font-size: 10px; font-weight: bold; text-transform: uppercase; color: #1e3a8a; margin-bottom: 4px;">Tender Title</div>
      <div style="font-size: 14px; font-weight: bold; color: #0f172a; margin-bottom: 12px;">Construction of Academic Block and Hostel Building at IIT Patna</div>
      <div style="display: flex; gap: 24px; font-size: 11px; font-family: monospace;">
        <div><strong>Value:</strong> ₹25.40 Cr</div>
        <div style="margin-left: 16px;"><strong>Match:</strong> 85% Compliant</div>
      </div>
    </div>
    <a href="#" style="display: inline-block; padding: 10px 20px; background-color: #2563eb; color: #ffffff; font-size: 12px; font-weight: bold; text-decoration: none; border-radius: 8px; text-transform: uppercase; text-align: center;">Analyze tender document</a>
    <hr style="margin-top: 24px; border: 0; border-top: 1px solid #e2e8f0;" />
    <span style="font-size: 10px; color: #94a3b8; display: block; margin-top: 12px;">This is an automated dispatch from TenderAI Compliance Station because you registered msvm220@gmail.com for alert dispatches.</span>
  </div>`
          },
          whatsapp: {
            sent: true,
            destination: "+91 98765 43210",
            timestamp: new Date().toISOString(),
            content: "*TenderAI Match Alert* 🔔\n\nDear Bidder, we discovered a highly compatible tender matching your profile:\n\n*IIT Patna Academic Block*\n• Value: ₹25.40 Cr\n• Match Score: *85%*\n• Authority: Central Public Works\n\nClick to review and start smart bid drafting instantly:\n👉 https://ai.studio/build/tender/t-1"
          },
          push: {
            sent: true,
            destination: "Active Browser Device Sessions",
            timestamp: new Date().toISOString(),
            content: "IIT Patna Academic Block (85% Match)"
          },
          sms: {
            sent: false,
            destination: "+91 98765 43210",
            timestamp: new Date().toISOString()
          }
        }
      },
      {
        id: "al-2",
        userId: "u-1",
        tenderId: "t-2",
        type: "NEW_MATCH",
        channel: "WHATSAPP",
        message: "Selected: BREDA Commissioning SPV 200kW Bettiah Solar Grid (90% Match Score). Double match for local state incentives.",
        isRead: true,
        sentAt: new Date().toISOString(),
        createdAt: new Date().toISOString(),
        channelsDispatched: {
          in_app: {
            sent: true,
            destination: "In-App Feed Station Panel",
            timestamp: new Date().toISOString(),
            content: "Selected: BREDA Commissioning SPV Bettiah Solar Grid."
          },
          whatsapp: {
            sent: true,
            destination: "+91 98765 43210",
            timestamp: new Date().toISOString(),
            content: "*TenderAI Match Alert* 🔔\n\nDear Bidder, we discovered a highly compatible tender matching your profile:\n\n*BREDA Commissioning SPV*\n• Value: ₹4.80 Cr\n• Match Score: *90%*\n\nReview and start smart bid drafting instantly:\n👉 https://ai.studio/build/tender/t-2"
          },
          email: {
            sent: true,
            destination: "msvm220@gmail.com",
            timestamp: new Date().toISOString(),
            subject: "[TenderAI] High Compatibility Tender Match Discovered (90%)",
            content: `<div style="font-family: Inter, sans-serif; max-width: 600px; margin: 0 auto; padding: 24px; border: 1px solid #e2e8f0; border-radius: 16px; background-color: #ffffff; color: #1e293b;">
    <div style="display: flex; align-items: center; margin-bottom: 24px;">
      <span style="font-size: 20px; font-weight: 800; color: #2563eb;">TenderAI</span>
      <span style="font-size: 11px; margin-left: 8px; font-weight: bold; padding: 2px 8px; background-color: #eff6ff; border-radius: 9999px; color: #1d4ed8; text-transform: uppercase;">Real-time Matching</span>
    </div>
    <h2 style="font-size: 18px; font-weight: 800; margin-bottom: 8px; color: #0f172a; tracking: -0.025em;">Tender Match Alert</h2>
    <p style="font-size: 13px; line-height: 1.6; margin-bottom: 20px; color: #475569;">Greetings, we identified an extremely strong compliance alignment between your company credentials and a newly published public contract opportunity.</p>
    <div style="padding: 16px; background-color: #f8fafc; border: 1px solid #e2e8f0; border-radius: 12px; margin-bottom: 24px;">
      <div style="font-size: 10px; font-weight: bold; text-transform: uppercase; color: #1e3a8a; margin-bottom: 4px;">Tender Title</div>
      <div style="font-size: 14px; font-weight: bold; color: #0f172a; margin-bottom: 12px;">BREDA Commissioning SPV 200kW Bettiah Solar Grid</div>
      <div style="display: flex; gap: 24px; font-size: 11px; font-family: monospace;">
        <div><strong>Value:</strong> ₹4.80 Cr</div>
        <div style="margin-left: 16px;"><strong>Match:</strong> 90% Compliant</div>
      </div>
    </div>
    <a href="#" style="display: inline-block; padding: 10px 20px; background-color: #2563eb; color: #ffffff; font-size: 12px; font-weight: bold; text-decoration: none; border-radius: 8px; text-transform: uppercase; text-align: center;">Analyze tender document</a>
  </div>`
          }
        }
      },
      {
        id: "al-3",
        userId: "u-1",
        tenderId: "t-3",
        type: "DEADLINE_REMINDER",
        channel: "IN_APP",
        message: "Urgent: Hajipur-Mahua Roadway Section Bid submission deadline is in 8 days (19-Jun-2026). Ensure BOQ validation is completed.",
        isRead: false,
        sentAt: new Date().toISOString(),
        createdAt: new Date().toISOString(),
        channelsDispatched: {
          in_app: {
            sent: true,
            destination: "In-App Feed Station Panel",
            timestamp: new Date().toISOString(),
            content: "Urgent: Hajipur-Mahua Roadway Section Bid submission deadline is in 8 days (19-Jun-2026). Ensure BOQ validation is completed."
          },
          email: {
            sent: true,
            destination: "msvm220@gmail.com",
            timestamp: new Date().toISOString(),
            subject: "⚠️ Urgent Notice: Bid submission closes in 8 Days",
            content: `<div style="font-family: Inter, sans-serif; max-width: 600px; margin: 0 auto; padding: 24px; border: 1px solid #fda4af; border-radius: 16px; background-color: #fffbfa; color: #1e293b;">
    <div style="display: flex; align-items: center; margin-bottom: 24px;">
      <span style="font-size: 20px; font-weight: 800; color: #e11d48;">TenderAI</span>
      <span style="font-size: 11px; margin-left: 8px; font-weight: bold; padding: 2px 8px; background-color: #ffe4e6; border-radius: 9999px; color: #e11d48; text-transform: uppercase;">Closing Soon</span>
    </div>
    <h2 style="font-size: 18px; font-weight: 800; margin-bottom: 8px; color: #9f1239; tracking: -0.025em;">⚠️ Submission Notice</h2>
    <p style="font-size: 13px; line-height: 1.6; margin-bottom: 20px; color: #475569;">Greetings, our e-procurement tracker registers that the bid submission window for the contract below closes in exactly 8 days.</p>
    <div style="padding: 16px; background-color: #fff1f2; border: 1px solid #fecdd3; border-radius: 12px; margin-bottom: 24px;">
      <div style="font-size: 10px; font-weight: bold; text-transform: uppercase; color: #be123c; margin-bottom: 4px;">Tender Title</div>
      <div style="font-size: 14px; font-weight: bold; color: #0f172a; margin-bottom: 12px;">Hajipur-Mahua Roadway Section Bid Submission</div>
      <div style="font-size: 11px; font-family: monospace; color: #475569;">
        <strong>Deadline Time:</strong> 19-Jun-2026
      </div>
    </div>
    <a href="#" style="display: inline-block; padding: 10px 20px; background-color: #e11d48; color: #ffffff; font-size: 12px; font-weight: bold; text-decoration: none; border-radius: 8px; text-transform: uppercase; text-align: center;">Finalize Draft Proposal</a>
  </div>`
          },
          sms: {
            sent: true,
            destination: "+91 98765 43210",
            timestamp: new Date().toISOString(),
            content: "[TenderAI URGENT] 8 Days left to submit bid for Hajipur-Mahua. Complete pre-audits and generate documentation now."
          },
          whatsapp: {
            sent: true,
            destination: "+91 98765 43210",
            timestamp: new Date().toISOString(),
            content: "*TenderAI URGENT DEADLINE* ⏳\n\nDear Bidder, the submission window for Hajipur-Mahua Roadway Section closes in 8 days.\n\n👉 Review: https://ai.studio/build/tender/t-3"
          },
          push: {
            sent: true,
            destination: "Active Browser Device Sessions",
            timestamp: new Date().toISOString(),
            content: "Submission Window closing in 8 days for Hajipur-Mahua Roadway."
          }
        }
      },
      {
        id: "al-4",
        userId: "u-1",
        tenderId: "",
        type: "DOCUMENT_MISSING",
        channel: "EMAIL",
        message: "Alert: Your ISO 9001 Certificate is expiring soon on 15-Jul-2026. Please upload a renewed certification to retain your A-class compliance rating.",
        isRead: false,
        sentAt: new Date().toISOString(),
        createdAt: new Date().toISOString(),
        channelsDispatched: {
          in_app: {
            sent: true,
            destination: "In-App Feed Station Panel",
            timestamp: new Date().toISOString(),
            content: "Alert: Your ISO 9001 Certificate is expiring soon on 15-Jul-2026."
          },
          email: {
            sent: true,
            destination: "msvm220@gmail.com",
            timestamp: new Date().toISOString(),
            subject: "📄 [TenderAI] Compliance Notice: ISO-9001 Certificate Expiring Soon",
            content: `<div style="font-family: Inter, sans-serif; max-width: 600px; margin: 0 auto; padding: 24px; border: 1px solid #fde047; border-radius: 16px; background-color: #fefcf3; color: #1e293b;">
    <div style="display: flex; align-items: center; margin-bottom: 24px;">
      <span style="font-size: 20px; font-weight: 800; color: #ca8a04;">TenderAI</span>
      <span style="font-size: 11px; margin-left: 8px; font-weight: bold; padding: 2px 8px; background-color: #fef9c3; border-radius: 9999px; color: #ca8a04; text-transform: uppercase;">Expirations</span>
    </div>
    <h2 style="font-size: 18px; font-weight: 800; margin-bottom: 8px; color: #854d0e; tracking: -0.025em;">📄 Document Expiration Notice</h2>
    <p style="font-size: 13px; line-height: 1.6; margin-bottom: 20px; color: #475569;">Greetings, we detected a critical document in your Compliance Vault which is nearing its valid expiration bounds.</p>
    <div style="padding: 16px; background-color: #fefef0; border: 1px solid #fef08a; border-radius: 12px; margin-bottom: 24px;">
      <div style="font-size: 10px; font-weight: bold; text-transform: uppercase; color: #854d0e; margin-bottom: 4px;">Document Name</div>
      <div style="font-size: 14px; font-weight: bold; color: #0f172a; margin-bottom: 12px;">ISO-9001 Corporate Quality Compliance Standard Certificate</div>
      <div style="font-size: 11px; font-family: monospace; color: #ca8a04;">
        <strong>Expiration Boundary:</strong> 15-Jul-2026
      </div>
    </div>
    <a href="#" style="display: inline-block; padding: 10px 20px; background-color: #ca8a04; color: #ffffff; font-size: 12px; font-weight: bold; text-decoration: none; border-radius: 8px; text-transform: uppercase; text-align: center;">Upload To Vault</a>
  </div>`
          },
          push: {
            sent: true,
            destination: "Active Browser Device Sessions",
            timestamp: new Date().toISOString(),
            content: "Document Expiring soon: ISO-9001 Certificate validity limits check."
          }
        }
      },
    ];
    this.data.alerts = alerts;

    // Seed default support tickets
    this.data.supportTickets = [
      {
        id: "st-1",
        userId: "u-1",
        userEmail: "demo@tenderai.in",
        userName: "Ramesh Sharma",
        subject: "Razorpay payment got debited but plan didn't upgrade",
        message: "I selected the Professional plan and completed the payment of ₹4,999. The amount got debited from my bank account, but my account status here still shows STARTER. Please look into this urgently as I need to submit a bid today.",
        status: "OPEN",
        priority: "HIGH",
        category: "BILLING",
        replies: [
          {
            sender: "USER",
            message: "I selected the Professional plan and completed the payment of ₹4,999.",
            timestamp: new Date(Date.now() - 4 * 3600000).toISOString()
          }
        ],
        createdAt: new Date(Date.now() - 4 * 3600000).toISOString(),
        updatedAt: new Date(Date.now() - 4 * 3600000).toISOString()
      },
      {
        id: "st-2",
        userId: "u-1",
        userEmail: "demo@tenderai.in",
        userName: "Ramesh Sharma",
        subject: "How does the Joint Venture criteria matching work?",
        message: "Can you clarify how the system evaluates JV bids if we combine our turnovers? Do we need to upload the partner documents as well?",
        status: "RESOLVED",
        priority: "MEDIUM",
        category: "COMPLIANCE",
        replies: [
          {
            sender: "USER",
            message: "Can you clarify how the system evaluates JV bids if we combine our turnovers?",
            timestamp: new Date(Date.now() - 2 * 24 * 3600000).toISOString()
          },
          {
            sender: "ADMIN",
            message: "Hello Ramesh! Yes, our JV builder combines turnovers of all consortium partners. You can add partners dynamically in the Joint Venture console and view a combined suitability score. Each partner's registered documents can be referenced together.",
            timestamp: new Date(Date.now() - 1.8 * 24 * 3600000).toISOString()
          }
        ],
        createdAt: new Date(Date.now() - 2 * 24 * 3600000).toISOString(),
        updatedAt: new Date(Date.now() - 1.8 * 24 * 3600000).toISOString()
      }
    ];

    // Seed default payment history (including a Failed one for recovery)
    this.data.paymentIntents = [
      {
        id: "rzp_pay_999120",
        userId: "u-1",
        planId: "STARTER",
        amount: 1999,
        billingCycle: "MONTHLY",
        gateway: "RAZORPAY",
        method: "CARD",
        status: "CAPTURED",
        createdAt: new Date(Date.now() - 30 * 24 * 3600000).toISOString()
      },
      {
        id: "rzp_pay_failed_88849",
        userId: "u-1",
        planId: "PROFESSIONAL",
        amount: 4999,
        billingCycle: "MONTHLY",
        gateway: "RAZORPAY",
        method: "UPI",
        status: "FAILED",
        createdAt: new Date(Date.now() - 2 * 3600000).toISOString()
      }
    ];

    console.log("Database seeded successfully with 20 tenders and support tickets.");
  }

  // Matching Engine Implementation!
  public recalculateMatches(profileId: string) {
    const profile = this.data.companyProfiles.find((p) => p.id === profileId);
    if (!profile) return;

    // Remove old matches for this profile
    this.data.tenderMatches = this.data.tenderMatches.filter((m) => m.companyProfileId !== profileId);

    // Calculate matches
    this.data.tenders.forEach((tender) => {
      const score = this.calculateMatchScore(profile, tender);
      this.data.tenderMatches.push(score);
    });
  }

  public calculateMatchScore(profile: CompanyProfile, tender: Tender): TenderMatch {
    let score = 0;
    const missingItems: string[] = [];

    // 1. Category Match (30 pts)
    const exactCategoryMatch = profile.categories.some(
      (cat) => cat.toLowerCase() === tender.category.toLowerCase()
    );
    const relatedCategoryMatch = profile.categories.some(
      (cat) =>
        tender.title.toLowerCase().includes(cat.toLowerCase()) ||
        tender.workDescription.toLowerCase().includes(cat.toLowerCase())
    );

    let categoryMatch = false;
    if (exactCategoryMatch) {
      score += 30;
      categoryMatch = true;
    } else if (relatedCategoryMatch) {
      score += 15;
      categoryMatch = true;
    } else {
      missingItems.push("Matching Work Category Category");
    }

    // 2. Turnover Match (20 pts)
    const requiredTurnover = tender.eligibilityCriteria.minTurnover;
    const turnoverMatch = profile.annualTurnover >= requiredTurnover;
    if (turnoverMatch) {
      score += 20;
    } else {
      missingItems.push(`Turnover shortfall: Registered average ${profile.annualTurnover} Cr, requires ${requiredTurnover} Cr`);
    }

    // 3. Experience Match (15 pts)
    const requiredExperience = tender.eligibilityCriteria.minExperience;
    const experienceMatch = profile.yearsOfExperience >= requiredExperience;
    if (experienceMatch) {
      score += 15;
    } else {
      missingItems.push(`Experience shortfall: Registered ${profile.yearsOfExperience} years, requires ${requiredExperience} years`);
    }

    // 4. Certifications match (15 pts)
    const requiredCertifications = tender.eligibilityCriteria.requiredCertifications;
    let matchingCertsCount = 0;
    requiredCertifications.forEach((cert) => {
      // check if company has certificate (case-insensitive)
      const hasCert = profile.certifications.some((pCert) =>
        pCert.toLowerCase().includes(cert.toLowerCase())
      );
      if (hasCert) {
        matchingCertsCount++;
      } else {
        missingItems.push(`Missing certified document: ${cert}`);
      }
    });

    const certMatchFraction = requiredCertifications.length > 0 ? matchingCertsCount / requiredCertifications.length : 1;
    score += Math.round(certMatchFraction * 15);
    const certMatch = certMatchFraction >= 0.5;

    // 5. State Match (10 pts)
    const statesAllowed = tender.eligibilityCriteria.statesAllowed || [];
    const stateMatch = statesAllowed.length === 0 || statesAllowed.some((st) =>
      profile.states.some((pst) => pst.toLowerCase() === st.toLowerCase())
    );
    if (stateMatch) {
      score += 10;
    } else {
      missingItems.push(`Operating territory constraints: Allowed states ${statesAllowed.join(", ")}, registered state ${profile.states.join(", ")}`);
    }

    // 6. MSME Bonus (10 pts)
    const wishesMsme = tender.eligibilityCriteria.msmeOnly;
    const hasMsmeBonus = wishesMsme && profile.msmeRegistered;
    if (hasMsmeBonus) {
      score += 10;
    } else if (wishesMsme && !profile.msmeRegistered) {
      missingItems.push("Tender is prioritised for MSME-registered (Udyam) enterprises.");
    }

    // Match score capped at 100
    const finalScore = Math.min(100, score);

    return {
      id: `tm-${profile.id}-${tender.id}`,
      tenderId: tender.id,
      companyProfileId: profile.id,
      matchScore: finalScore,
      matchBreakdown: {
        turnoverMatch,
        certMatch,
        categoryMatch,
        stateMatch,
        experienceMatch,
        missingItems,
      },
      isBookmarked: false,
      userStatus: "NEW",
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };
  }
}

export const db = new LocalDB();
