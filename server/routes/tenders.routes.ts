import express from "express";
import crypto from "crypto";
import { db } from "../db.js";
import { authenticateJWT, requireRole, resolveUser, hashPassword, comparePassword, generateToken, generateAccessAndRefreshTokens } from "../authMiddleware.js";
import { recordAuditLog, generateCSRFToken } from "../security.js";
import { getGeminiAI, summarizeTender, analyzeEligibility, askTenderQuestion, generateBidDoc, generateSmartBidDraft, summarizeProcurementDocument, draftConsortiumAgreement, analyzeAndOCRDocument, chatAboutDocument } from "../ai.service.js";


import jwt from "jsonwebtoken";
import { getPrismaClient } from "../prismaClient.js";
import { validateRegistrationInput, validateUploadedFile } from "../security.js";
import { routeCache, invalidateRouteCache } from "../performance.js";
import { searchEngine } from "../search.service.js";
import { ingestionService } from "../ingestion.service.js";
import { executeDurableBackup, getBackupHistory } from "../backupService.js";

// We need JWT_SECRET
const JWT_SECRET = process.env.JWT_SECRET || "tenderai-super-secret-key-123";

// We need a dummy ioServerInstance if it's missing, or we can import it.
// Actually, ioServerInstance is instantiated in server.ts.
// For now, let's mock ioServerInstance to prevent TS errors, or just let it be any.
let ioServerInstance: any = null;
export function setIoServerInstance(io: any) {
  ioServerInstance = io;
}

export const tendersRouter = express.Router();

  // -----------------------------------------------------------------
  // API ENDPOINTS: TENDERS
  // -----------------------------------------------------------------
  tendersRouter.get("/api/tenders", routeCache(30 * 1000), (req, res) => {
    const { search, sourcePortal, state, category, msmeOnly, minAmount, maxAmount, status } = req.query;

    let items = [...db.data.tenders];

    if (search) {
      const q = String(search).toLowerCase();
      items = items.filter(
        (t) =>
          t.title.toLowerCase().includes(q) ||
          t.department.toLowerCase().includes(q) ||
          t.workDescription.toLowerCase().includes(q)
      );
    }

    if (sourcePortal) {
      const portals = String(sourcePortal).split(",");
      items = items.filter((t) => portals.includes(t.sourcePortal));
    }

    if (state) {
      const states = String(state).split(",");
      items = items.filter((t) => states.includes(t.state));
    }

    if (category) {
      const cats = String(category).split(",");
      items = items.filter((t) => cats.includes(t.category));
    }

    if (msmeOnly === "true") {
      items = items.filter((t) => t.eligibilityCriteria.msmeOnly === true);
    }

    if (minAmount) {
      items = items.filter((t) => (t.tenderValue || 0) >= Number(minAmount));
    }

    if (maxAmount) {
      items = items.filter((t) => (t.tenderValue || 0) <= Number(maxAmount));
    }

    if (status) {
      items = items.filter((t) => t.status === status);
    }

    res.json({
      tenders: items,
      totalCount: items.length,
    });
  });

  // -----------------------------------------------------------------
  // ADVANCED FAST INDEXED SEARCH API
  // -----------------------------------------------------------------
  tendersRouter.get("/api/search", (req, res) => {
    const { 
      q, 
      category, 
      location, 
      department, 
      minAmount, 
      maxAmount, 
      publishedAfter, 
      publishedBefore, 
      deadlineAfter, 
      deadlineBefore, 
      status 
    } = req.query;

    const parsedCategories = category ? String(category).split(",").map(c => c.trim()).filter(Boolean) : undefined;
    const parsedLocations = location ? String(location).split(",").map(l => l.trim()).filter(Boolean) : undefined;

    try {
      const searchResult = searchEngine.search({
        q: q ? String(q) : undefined,
        category: parsedCategories,
        location: parsedLocations,
        department: department ? String(department) : undefined,
        minAmount: minAmount ? Number(minAmount) : undefined,
        maxAmount: maxAmount ? Number(maxAmount) : undefined,
        publishedAfter: publishedAfter ? String(publishedAfter) : undefined,
        publishedBefore: publishedBefore ? String(publishedBefore) : undefined,
        deadlineAfter: deadlineAfter ? String(deadlineAfter) : undefined,
        deadlineBefore: deadlineBefore ? String(deadlineBefore) : undefined,
        status: status ? String(status) : undefined
      });

      res.json({
        success: true,
        tenders: searchResult.results,
        scoreDetails: searchResult.scoreDetails,
        totalCount: searchResult.results.length,
        timestamp: new Date().toISOString()
      });
    } catch (err: any) {
      console.error("Advanced search query error:", err);
      res.status(500).json({ error: "Failed to query the fast search index", details: err.message });
    }
  });

  tendersRouter.get("/api/search/index-status", (req, res) => {
    try {
      const info = searchEngine.getIndexStatus();
      res.json({
        success: true,
        ...info,
        status: "ACTIVE"
      });
    } catch (err: any) {
      res.status(500).json({ error: "Failed to read search index status", details: err.message });
    }
  });

  tendersRouter.get("/api/tenders/:id", (req, res) => {
    const tender = db.data.tenders.find((t) => t.id === req.params.id);
    if (tender) {
      res.json(tender);
    } else {
      res.status(404).json({ error: "Tender not found with given identifier" });
    }
  });

  tendersRouter.get("/api/tenders/:id/summary", async (req, res) => {
    const tender = db.data.tenders.find((t) => t.id === req.params.id);
    if (!tender) return res.status(404).json({ error: "Tender not found for AI summarization" });

    if (tender.aiSummary) {
      return res.json({ aiSummary: tender.aiSummary });
    }

    try {
      const summary = await summarizeTender(tender);
      // Cache in record
      tender.aiSummary = summary.summary;
      tender.aiEligibilityChecklist = summary.eligibilityCriteria;
      db.save();
      res.json(summary);
    } catch (err) {
      res.status(500).json({ error: "Gemini summarization failure" });
    }
  });

  tendersRouter.get("/api/tenders/:id/eligibility/:profileId", async (req, res) => {
    const tender = db.data.tenders.find((t) => t.id === req.params.id);
    const profile = db.data.companyProfiles.find((p) => p.id === req.params.profileId);
    if (!tender || !profile) {
      return res.status(404).json({ error: "Tender or PROFILE entities missing" });
    }

    try {
      const analysis = await analyzeEligibility(profile, tender);
      res.json(analysis);
    } catch (err) {
      res.status(500).json({ error: "Gemini match analysis failure" });
    }
  });

  tendersRouter.post("/api/tenders/:id/documents/summarize", async (req, res) => {
    const { documentName, documentUrl } = req.body;
    const tender = db.data.tenders.find((t) => t.id === req.params.id);
    if (!tender) {
      return res.status(404).json({ error: "Tender record not found for document summarization" });
    }
    if (!documentName) {
      return res.status(400).json({ error: "documentName is a required request parameter inside the body" });
    }

    try {
      const docSummary = await summarizeProcurementDocument(tender, documentName, documentUrl || "#");
      res.json(docSummary);
    } catch (err) {
      console.error("Gemini document analysis route failure:", err);
      res.status(500).json({ error: "Failed to parse procurement document. Please try again." });
    }
  });

  tendersRouter.post("/api/analysis/match", async (req, res) => {
    try {
      const { tenderId, companyProfileId } = req.body;
      if (!tenderId) {
        return res.status(400).json({ error: "tenderId is a required parameter inside the body" });
      }

      // Fallback profile if companyProfileId is not specified
      const user = resolveUser(req);
      if (!user) return res.status(401).json({ error: "Authentication required" });
      const userProfile = db.data.companyProfiles.find((p) => p.userId === user.id) || db.data.companyProfiles[0];
      const profileToUse = companyProfileId || (userProfile ? userProfile.id : "cp-1");
      const tender = db.data.tenders.find((t) => t.id === tenderId);
      const profile = db.data.companyProfiles.find((p) => p.id === profileToUse) || userProfile;

      if (!tender) {
        return res.status(404).json({ error: `Tender with ID '${tenderId}' can not be retrieved` });
      }
      if (!profile) {
        return res.status(404).json({ error: `Company Profile with ID '${profileToUse}' can not be retrieved` });
      }

      const analysis = await analyzeEligibility(profile, tender);
      res.json(analysis);
    } catch (err) {
      console.error("Gemini AI analysis proxy endpoint '/api/analysis/match' failed:", err);
      res.status(500).json({ error: "Failed to perform AI Bid Match analysis with Gemini" });
    }
  });

  tendersRouter.post("/api/tenders/:id/qa", async (req, res) => {
    const { question } = req.body;
    const tender = db.data.tenders.find((t) => t.id === req.params.id);
    if (!tender) return res.status(404).json({ error: "Tender not found" });

    try {
      const response = await askTenderQuestion(tender, question);
      // Post to local chat history for logging
      db.data.tenderQAs.push({
        id: "qa-" + Math.random().toString(36).substring(3, 8),
        tenderId: tender.id,
        userId: "u-1",
        question,
        answer: response.answer,
        sourceCitations: response.citations,
        createdAt: new Date().toISOString(),
      });
      db.save();
      res.json(response);
    } catch (err) {
      res.status(500).json({ error: "Gemini Q&A failure" });
    }
  });

  tendersRouter.get("/api/tenders/:id/qa", (req, res) => {
    const history = db.data.tenderQAs.filter((q) => q.tenderId === req.params.id);
    res.json(history);
  });

  // -----------------------------------------------------------------
  // API ENDPOINTS: TENDER MATCHES
  // -----------------------------------------------------------------
  tendersRouter.get("/api/matches", (req, res) => {
    // Returns full matches linked with Tenders
    const user = resolveUser(req);
    if (!user) return res.status(401).json({ error: "Authentication required" });
    let profile = db.data.companyProfiles.find((p) => p.userId === user.id);
    if (!profile) {
      profile = {
        id: "cp-" + crypto.randomUUID(),
        userId: user.id,
        companyName: `${user.name || "My"} Corporation`,
        registrationNumber: "",
        gstNumber: "",
        panNumber: "",
        annualTurnover: 1.0,
        yearsOfExperience: 2,
        employeeCount: 5,
        categories: ["Civil"],
        certifications: [],
        states: ["Bihar"],
        msmeRegistered: false,
        isActive: true,
        pastProjects: [],
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString()
      };
      db.data.companyProfiles.push(profile);
      db.recalculateMatches(profile.id);
      db.save();
    } else {
      const hasMatches = db.data.tenderMatches.some((m) => m.companyProfileId === profile!.id);
      if (!hasMatches) {
        db.recalculateMatches(profile.id);
        db.save();
      }
    }

    const matches = db.data.tenderMatches.filter((m) => m.companyProfileId === profile!.id);
    const populated = matches.map((match) => {
      const tender = db.data.tenders.find((t) => t.id === match.tenderId);
      return {
        ...match,
        tender,
      };
    });
    res.json(populated);
  });

  tendersRouter.post("/api/matches/:id/bookmark", (req, res) => {
    const match = db.data.tenderMatches.find((m) => m.id === req.params.id);
    if (match) {
      match.isBookmarked = !match.isBookmarked;
      db.save();
      res.json(match);
    } else {
      res.status(404).json({ error: "Match correlation profile missing" });
    }
  });

  tendersRouter.put("/api/matches/:id/status", (req, res) => {
    const { userStatus, receiptNumber } = req.body;
    const match = db.data.tenderMatches.find((m) => m.id === req.params.id);
    if (match) {
      match.userStatus = userStatus;
      if (receiptNumber !== undefined) {
        match.receiptNumber = receiptNumber;
      }
      match.updatedAt = new Date().toISOString();
      db.save();

      // Trigger automatic socket alert and save to DB on real submission log
      if (userStatus === "SUBMITTED") {
        const user = resolveUser(req);
        if (!user) return res.status(401).json({ error: "Authentication required" });
        const tender = db.data.tenders.find((t) => t.id === match.tenderId);
        if (tender) {
          const newAlert = {
            id: "al-" + Math.random().toString(36).substring(3, 8),
            userId: user.id,
            tenderId: tender.id,
            type: "STATUS_CHANGE" as const,
            channel: "IN_APP" as const,
            message: `Bid submission logged successfully for "${tender.title}". Reference receipt: ${receiptNumber || 'N/A'}.`,
            isRead: false,
            sentAt: new Date().toISOString(),
            createdAt: new Date().toISOString(),
          };
          db.data.alerts.unshift(newAlert);
          db.save();
          if (ioServerInstance) {
            ioServerInstance.emit("tender_alert", newAlert);
            console.log(`[TenderAI Socket] Custom status change alert emitted for bid receipt: ${newAlert.id}`);
          }
        }
      }

      res.json(match);
    } else {
      res.status(404).json({ error: "Match not found" });
    }
  });

  // -----------------------------------------------------------------
  // API ENDPOINTS: NEW PREMIUM BID INTELLIGENCE FEATURES
  // -----------------------------------------------------------------

  // 1. Corrigenda & Pre-bid Bulletins
  tendersRouter.get("/api/tenders/:id/corrigenda", (req, res) => {
    // Return existing simulated corrigenda for this tender
    const tenderId = req.params.id;
    const dbData = db.data as any;
    dbData.corrigenda = dbData.corrigenda || [];
    
    // Find corrigenda for this tender
    let results = dbData.corrigenda.filter((c: any) => c.tenderId === tenderId);
    
    // If empty, generate a couple of default simulated ones
    if (results.length === 0) {
      results = [
        {
          id: `corr-${tenderId}-1`,
          tenderId,
          title: "Corrigendum I: Extension of Tender Submission Date",
          publishedDate: new Date(Date.now() - 3 * 24 * 60 * 60 * 1000).toISOString(),
          description: "Due to server maintenance on CPPP portal, the closing date is extended by 5 days. Technical specs remain unaltered.",
          impactAnalysis: "CRITICAL: The original bid deadline has been extended by 5 days. You now have extra time to finish your technical compliance matrices and obtain your Bank Guarantee."
        },
        {
          id: `corr-${tenderId}-2`,
          tenderId,
          title: "Pre-Bid Clarification Meeting Highlights",
          publishedDate: new Date(Date.now() - 1 * 24 * 60 * 60 * 1000).toISOString(),
          description: "Query 1: Joint Venture turnover criteria clarification. Answer: Joint Venture partner can contribute up to 40% of standard turnover requirements.",
          impactAnalysis: "HIGH: Joint Venture partnering is now much more flexible. Sharma Construction can easily partner with a local contractor to fulfill the 100% turnover criterion if needed."
        }
      ];
      dbData.corrigenda.push(...results);
      db.save();
    }
    res.json(results);
  });

  tendersRouter.post("/api/tenders/:id/corrigenda", async (req, res) => {
    const tenderId = req.params.id;
    const { title, description } = req.body;
    const user = resolveUser(req);
    if (!user) return res.status(401).json({ error: "Authentication required" });
    const profile = db.data.companyProfiles.find((p) => p.userId === user.id) || db.data.companyProfiles[0];
    const tender = db.data.tenders.find((t) => t.id === tenderId);
    
    if (!title || !description) {
      return res.status(400).json({ error: "Title and Description are required parameters." });
    }

    const dbData = db.data as any;
    dbData.corrigenda = dbData.corrigenda || [];

    let impactText = "The AI evaluated this amendment and concluded: Minimum administrative impact. No deadline shifts nor eligibility requirement changes detected.";
    
    // Call Gemini if key is valid
    const ai = getGeminiAI();
    if (ai) {
      try {
        const prompt = `You are an expert e-Procurement attorney and pricing analyst in India.
Review this newly published corrigendum/amendment for a tender and our bidding company profile.
Explain the exact strategic/operational impact on our bid in 2-3 precise sentences.
Tender: ${tender?.title || "Tender Project"}
Turnover Req: ${tender?.eligibilityCriteria?.minTurnover || 1} Cr, Exp Req: ${tender?.eligibilityCriteria?.minExperience || 2} years
Company Profile: ${profile.companyName}, Turnover: ${profile.annualTurnover} Cr, Experience: ${profile.yearsOfExperience} years.
New Corrigendum Title: ${title}
New Corrigendum Description: ${description}
Provide your strategic evaluation:`;
        
        const response = await ai.models.generateContent({
          model: "gemini-3.5-flash",
          contents: prompt
        });
        if (response.text) {
          impactText = response.text.trim();
        }
      } catch (err) {
        console.error("Gemini failed corrigenda evaluation:", err);
      }
    } else {
      // Local fallback simulator logic using basic parameters
      if (description.toLowerCase().includes("extension") || description.toLowerCase().includes("date")) {
        impactText = "CRITICAL ADVICE: The bid submission date is modified. Immediately alert the technical compiling team to adjust their schedule and ensure DSC digital key validation is active.";
      } else if (description.toLowerCase().includes("turnover") || description.toLowerCase().includes("experience")) {
        impactText = "HIGH COMPLIANCE ADVICE: Changes in the turnover or experience ratios are registered. Re-run your BidMatch Analysis to review if your eligibility rating increased or decreased.";
      } else {
        impactText = "ALERT: General specification update. Review if the technical bill of materials needs modification in light of these clarifications.";
      }
    }

    const newCorr = {
      id: `corr-${tenderId}-${Math.random().toString(36).substring(3, 8)}`,
      tenderId,
      title,
      publishedDate: new Date().toISOString(),
      description,
      impactAnalysis: impactText
    };

    dbData.corrigenda.unshift(newCorr);
    db.save();
    res.json(newCorr);
  });

  // 2. Collaborative Comments
  tendersRouter.get("/api/tenders/:id/collaboration", (req, res) => {
    const tenderId = req.params.id;
    const dbData = db.data as any;
    dbData.comments = dbData.comments || [];
    
    let results = dbData.comments.filter((c: any) => c.tenderId === tenderId);
    if (results.length === 0) {
      results = [
        {
          id: `c-${tenderId}-1`,
          tenderId,
          userName: "Anil Mehta (Senior Bid Manager)",
          text: "Double check the Class 3 DSC helper utility is active. CPPP portal has updated Java runtimes.",
          createdAt: new Date(Date.now() - 2 * 24 * 60 * 60 * 1000).toISOString()
        },
        {
          id: `c-${tenderId}-2`,
          tenderId,
          userName: "Vikram Sharma (Finance Lead)",
          text: "EMD is 2 Lakhs. We can request a waiver if we attach our MSME dynamic certificate. I've uploaded the certificate in the system document vault.",
          createdAt: new Date(Date.now() - 12 * 60 * 60 * 1000).toISOString()
        }
      ];
      dbData.comments.push(...results);
      db.save();
    }
    res.json(results);
  });

  tendersRouter.post("/api/tenders/:id/collaboration", (req, res) => {
    const tenderId = req.params.id;
    const { text } = req.body;
    const user = resolveUser(req);
    if (!user) return res.status(401).json({ error: "Authentication required" });

    if (!text || !text.trim()) {
      return res.status(400).json({ error: "Comment text cannot be empty." });
    }

    const dbData = db.data as any;
    dbData.comments = dbData.comments || [];

    const newComment = {
      id: `c-${tenderId}-${Math.random().toString(36).substring(3, 8)}`,
      tenderId,
      userName: `${user.name || "Anonymous Team Member"} (${user.plan} Account)`,
      text,
      createdAt: new Date().toISOString()
    };

    dbData.comments.push(newComment);
    db.save();
    res.json(newComment);
  });

  // 3. Bid Pricing & BOQ Advisor
  tendersRouter.post("/api/tenders/:id/pricing", async (req, res) => {
    const tenderId = req.params.id;
    const { materialCost, laborCost, equipmentCost, overheadMargin, totalEstimate } = req.body;
    const user = resolveUser(req);
    if (!user) return res.status(401).json({ error: "Authentication required" });
    const tender = db.data.tenders.find((t) => t.id === tenderId);

    if (!tender) {
      return res.status(404).json({ error: "Tender record not found." });
    }

    const ai = getGeminiAI();
    let pricingReview = "";
    let baseValue = tender.tenderValue || 1.5; // in Crores
    const estimateInCrores = totalEstimate / 10000000; // convert INR Rs to Crores

    if (ai) {
      try {
        const prompt = `You are a professional government contracting pricing advisor in India.
Analyze our proposed budget for Tender: "${tender.title}" which has an estimated value of ${baseValue} Crores.
Our Bidding Budget Details (in INR Rupees):
- Material Costs: ₹${materialCost.toLocaleString()}
- Labour Costs: ₹${laborCost.toLocaleString()}
- Equipment & Machinery: ₹${equipmentCost.toLocaleString()}
- Overhead & Margin (%): ${overheadMargin}%
- Our Combined Bid Offer: ₹${totalEstimate.toLocaleString()} (approx ${estimateInCrores.toFixed(3)} Cr)

Write a professional evaluation of this bid:
1. Is our price too high? (Will we lose L1 pricing ranking?)
2. Is our price too low? (Will we risk executing at a loss / getting disqualified as an unviable low rate?)
3. Risk Score: Estimate a risk level (Low, Medium, High).
4. Optimization suggestions (e.g., labor optimization or lower overhead margin).
Be direct, professional, and reference typical Indian e-procurement guidelines. Return 3 bullets and a Summary.`;

        const response = await ai.models.generateContent({
          model: "gemini-3.5-flash",
          contents: prompt
        });
        pricingReview = response.text ? response.text.trim() : "Failed to compile advice.";
      } catch (err) {
        console.error("Gemini failed pricing evaluation:", err);
      }
    }

    if (!pricingReview) {
      // Local premium logic
      const diffpct = ((estimateInCrores - baseValue) / baseValue) * 100;
      if (diffpct > 15) {
        pricingReview = `**ANALYSIS BULLETIN (SIMULATED): HIGH PRICING ERROR**\n\n- **Pricing Competitiveness**: Your estimate of ₹${totalEstimate.toLocaleString()} is **${diffpct.toFixed(1)}% above** the published tender value of ₹${(baseValue*10000000).toLocaleString()}. Under standard L1 guidelines, your proposal is extremely likely to be outbid.\n- **Risk Score: Low Risk of Loss, but High Risk of rejections**.\n- **Operational Strategy**: Consider reducing the overhead margin or re-negotiating supplier materials bulk pricing to match closely with standard district schedule of rates (DSR).`;
      } else if (diffpct < -25) {
        pricingReview = `**ANALYSIS BULLETIN (SIMULATED): UNVIABLE LOW BID WARNING**\n\n- **Pricing Competitiveness**: Your estimate of ₹${totalEstimate.toLocaleString()} is **${Math.abs(diffpct).toFixed(1)}% below** the published tender value of ₹${(baseValue*10000000).toLocaleString()}. Some departments disqualify bids that are >20% lower than estimation, treating them as unviable low-rates.\n- **Risk Score: High Execution Risk**.\n- **Operational Strategy**: Verify that labor costs and statutory benefits are covered. Increase contingency allocations to prevent liquid damages.`;
      } else {
        pricingReview = `**ANALYSIS BULLETIN (SIMULATED): OPTIMAL BID PROFILER**\n\n- **Pricing Competitiveness**: Your estimate of ₹${totalEstimate.toLocaleString()} is **${diffpct.toFixed(1)}% variant** compared to the reference tender. This puts you in a highly competitive bracket for the bidding rounds.\n- **Risk Score: Low-Medium**.\n- **Operational Strategy**: Ensure that your Technical Cover Letter and MSME forms are pristine to avoid administrative rejections during Phase 1 technical bid opening.`;
      }
    }

    res.json({
      success: true,
      proposedBidInRs: totalEstimate,
      tenderReferenceInRs: baseValue * 10000000,
      variancePercentage: ((estimateInCrores - baseValue) / baseValue) * 100,
      pricingReview
    });
  });

  // 4. Milestone Checklists
  tendersRouter.get("/api/matches/:id/milestones", (req, res) => {
    const matchId = req.params.id;
    const dbData = db.data as any;
    dbData.milestones = dbData.milestones || {};
    
    // Default milestones for a new match
    if (!dbData.milestones[matchId]) {
      dbData.milestones[matchId] = [
        { id: "m1", label: "Enroll/Verify Class 3 DSC Token", status: "completed", date: new Date(Date.now() - 4*24*60*60*1000).toISOString() },
        { id: "m2", label: "Download Complete Tender Documents", status: "completed", date: new Date(Date.now() - 3*24*60*60*1000).toISOString() },
        { id: "m3", label: "Request MSME/Udyam EMD Fee Waiver", status: "pending", date: null },
        { id: "m4", label: "Compile Technical Compliance Matrix", status: "pending", date: null },
        { id: "m5", label: "Draft BOQ Cost Estimation Formula", status: "pending", date: null },
        { id: "m6", label: "Validate Consortium JV Signatures", status: "pending", date: null },
        { id: "m7", label: "Verify Integrity check & Submit Bid", status: "pending", date: null }
      ];
      db.save();
    }
    res.json(dbData.milestones[matchId]);
  });

  tendersRouter.put("/api/matches/:id/milestones", (req, res) => {
    const matchId = req.params.id;
    const { milestones } = req.body;
    
    if (!Array.isArray(milestones)) {
      return res.status(400).json({ error: "Milestones must be a valid list." });
    }

    const dbData = db.data as any;
    dbData.milestones = dbData.milestones || {};
    dbData.milestones[matchId] = milestones;
    db.save();
    res.json({ success: true, milestones: dbData.milestones[matchId] });
  });
