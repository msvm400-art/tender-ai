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

export const bidsRouter = express.Router();

  // -----------------------------------------------------------------
  // API ENDPOINTS: BID DOCUMENTS
  // -----------------------------------------------------------------
  bidsRouter.get("/api/bids/:tenderId", (req, res) => {
    const user = resolveUser(req);
    if (!user) return res.status(401).json({ error: "Authentication required" });
    const docs = db.data.bidDocuments.filter((b) => b.tenderId === req.params.tenderId && b.userId === user.id);
    res.json(docs);
  });

  bidsRouter.post("/api/bids/:tenderId/generate", async (req, res) => {
    const { type, customContent } = req.body;
    const user = resolveUser(req);
    if (!user) return res.status(401).json({ error: "Authentication required" });
    const profile = db.data.companyProfiles.find((p) => p.userId === user.id) || db.data.companyProfiles[0];
    const tender = db.data.tenders.find((t) => t.id === req.params.tenderId);
    if (!tender) return res.status(404).json({ error: "Tender source missing" });

    try {
      const generatedContent = customContent || await generateBidDoc(tender, profile, type);
      
      // Check if document of this type already exists for this tender and user
      const existingIdx = db.data.bidDocuments.findIndex(
        (b) => b.tenderId === tender.id && b.type === type && b.userId === user.id
      );

      const bidDocNode = {
        id: existingIdx !== -1 ? db.data.bidDocuments[existingIdx].id : "bid-" + Math.random().toString(36).substring(3, 8),
        tenderId: tender.id,
        companyProfileId: profile.id,
        userId: user.id,
        type,
        content: generatedContent,
        s3Url: null,
        version: existingIdx !== -1 ? db.data.bidDocuments[existingIdx].version + 1 : 1,
        isAiGenerated: true,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      };

      if (existingIdx !== -1) {
        db.data.bidDocuments[existingIdx] = bidDocNode;
      } else {
        db.data.bidDocuments.push(bidDocNode);
      }
      db.save();
      res.json(bidDocNode);
    } catch (err) {
      res.status(500).json({ error: "Generation failure, retry" });
    }
  });

  bidsRouter.post("/api/bids/:tenderId/smart-draft", async (req, res) => {
    const { tone, projectFocus, includeMSMEAcknowledgment } = req.body;
    const user = resolveUser(req);
    if (!user) return res.status(401).json({ error: "Authentication required" });
    const profile = db.data.companyProfiles.find((p) => p.userId === user.id) || db.data.companyProfiles[0];
    const tender = db.data.tenders.find((t) => t.id === req.params.tenderId);
    if (!tender) return res.status(404).json({ error: "Tender source missing" });

    try {
      const draft = await generateSmartBidDraft(
        tender,
        profile,
        tone || "Formal & Administrative",
        projectFocus,
        includeMSMEAcknowledgment !== false
      );
      res.json(draft);
    } catch (err) {
      console.error("Smart bid draft failed:", err);
      res.status(500).json({ error: "Smart draft generation failure, retry" });
    }
  });

  bidsRouter.put("/api/bids/:id", (req, res) => {
    const { content } = req.body;
    const idx = db.data.bidDocuments.findIndex((b) => b.id === req.params.id);
    if (idx !== -1) {
      db.data.bidDocuments[idx].content = content;
      db.data.bidDocuments[idx].updatedAt = new Date().toISOString();
      db.save();
      res.json(db.data.bidDocuments[idx]);
    } else {
      res.status(404).json({ error: "Bid doc not found" });
    }
  });

  bidsRouter.post("/api/bids/:id/export", (req, res) => {
    const { format } = req.body;
    const doc = db.data.bidDocuments.find((b) => b.id === req.params.id);
    if (!doc) return res.status(404).json({ error: "Doc missing" });
    const extension = format === "docx" ? "docx" : "pdf";
    res.json({
      success: true,
      url: `https://tenderai-docs.s3.ap-south-1.amazonaws.com/exports/${doc.id}_v${doc.version}.${extension}`,
      fileName: `${doc.type.toLowerCase().replace(/_/g, "-")}.${extension}`
    });
  });

  bidsRouter.post("/api/tenders/upload-custom", async (req, res) => {
    const { title, department, state, category, tenderValue, emdAmount, workDescription, minTurnover, minExperience, textContext } = req.body;
    const user = resolveUser(req);
    if (!user) return res.status(401).json({ error: "Authentication required" });
    
    // Create new Tender object
    const newTender = {
      id: "tender-custom-" + Math.random().toString(36).substring(3, 8),
      externalId: "TND/" + String(new Date().getFullYear()) + "/" + Math.floor(1000 + Math.random() * 9000),
      sourcePortal: "OTHER" as const,
      title: title || "Custom Tender Contract Request",
      department: department || "State Public Works Department",
      state: state || "Delhi",
      category: category || "Civil Infrastructure",
      subCategory: "General Works",
      tenderValue: tenderValue ? Number(tenderValue) : 5.0, // defaults to 5.0 Cr
      emdAmount: emdAmount ? Number(emdAmount) : 10.0, // defaults to 10 Lakhs
      publishedDate: new Date().toISOString().split("T")[0],
      bidSubmissionDeadline: new Date(Date.now() + 15 * 24 * 60 * 60 * 1000).toISOString().split("T")[0], // 15 days out
      openingDate: new Date(Date.now() + 16 * 24 * 60 * 60 * 1000).toISOString().split("T")[0],
      workDescription: workDescription || textContext || "Execution of requested civil, mechanical, or structural operations under statutory standards.",
      eligibilityCriteria: {
        minTurnover: minTurnover ? Number(minTurnover) : 1.5,
        minExperience: minExperience ? Number(minExperience) : 3,
        requiredCertifications: ["ISO-9001", "GST_REGISTRATION", "PAN_CARD"],
        msmeOnly: false,
        statesAllowed: [state || "Delhi"]
      },
      technicalSpecs: textContext || "All engineering items conform to standard CPWD or ISO benchmarks. Quality clearances are required before billing.",
      documents: [] as { name: string; url: string; type: string }[],
      rawText: workDescription || textContext || "None provided",
      aiSummary: "Analyzed custom uploaded tender. Fully compliant specifications.",
      aiEligibilityChecklist: null,
      status: "ACTIVE" as const,
      location: state || "Delhi",
      pineconeVectorId: null,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString()
    };

    db.data.tenders.unshift(newTender);
    
    // Automatically setup a match item for the user too!
    const profile = db.data.companyProfiles.find((p) => p.userId === user.id) || db.data.companyProfiles[0];
    const matchId = "match-" + Math.random().toString(36).substring(3, 8);
    const hasTurnoverMatch = (profile?.annualTurnover || 0) >= (newTender.eligibilityCriteria.minTurnover);
    const hasExpMatch = (profile?.yearsOfExperience || 0) >= (newTender.eligibilityCriteria.minExperience);
    
    const newMatch = {
      id: matchId,
      tenderId: newTender.id,
      companyProfileId: profile?.id || "cp-1",
      matchScore: hasTurnoverMatch && hasExpMatch ? 90 : 65,
      matchBreakdown: {
        turnoverMatch: hasTurnoverMatch,
        certMatch: true,
        categoryMatch: true,
        stateMatch: true,
        experienceMatch: hasExpMatch,
        missingItems: []
      },
      isBookmarked: false,
      userStatus: "NEW" as const,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString()
    };
    
    db.data.tenderMatches.unshift(newMatch);
    
    // Performance optimization: clear cache
    invalidateRouteCache(["/api/tenders"]);

    recordAuditLog({
      userId: user.id,
      userEmail: user.email,
      action: "TENDER_UPLOAD_CUSTOM",
      description: `Uploaded and matched a custom contract Opportunity: '${newTender.title}'`,
      status: "SUCCESS",
      ipAddress: (req.headers["x-forwarded-for"] as string) || req.socket.remoteAddress || "127.0.0.1"
    });

    db.save();

    res.json({
      success: true,
      tender: newTender,
      match: newMatch
    });
  });

  // -----------------------------------------------------------------
  // API ENDPOINTS: CONSORTIUM & PARTNER MATCHING
  // -----------------------------------------------------------------
  bidsRouter.get("/api/partners", (req, res) => {
    const user = resolveUser(req);
    if (!user) return res.status(401).json({ error: "Authentication required" });
    const profile = db.data.companyProfiles.find((p) => p.userId === user.id) || { id: "cp-1" };
    // Return all profiles that are seeded as potential partners (not current user)
    const partners = db.data.companyProfiles.filter((p) => p.id !== profile.id);
    res.json(partners);
  });

  bidsRouter.post("/api/consortium/draft-agreement", async (req, res) => {
    try {
      const { tenderId, partnerProfileId, responsibilities } = req.body;
      if (!tenderId || !partnerProfileId) {
        return res.status(400).json({ error: "Missing parameter tenderId or partnerProfileId inside the request body" });
      }

      const user = resolveUser(req);

      if (!user) return res.status(401).json({ error: "Authentication required" });
      const tender = db.data.tenders.find((t) => t.id === tenderId);
      const myProfile = db.data.companyProfiles.find((p) => p.userId === user.id) || db.data.companyProfiles.find((p) => p.id === "cp-1");
      const partnerProfile = db.data.companyProfiles.find((p) => p.id === partnerProfileId);

      if (!tender) {
        return res.status(404).json({ error: `Tender with ID '${tenderId}' not found.` });
      }
      if (!myProfile) {
        return res.status(404).json({ error: "Your primary company profile could not be found." });
      }
      if (!partnerProfile) {
        return res.status(404).json({ error: `Partner profile with ID '${partnerProfileId}' not found.` });
      }

      const agreementText = await draftConsortiumAgreement(tender, myProfile, partnerProfile, responsibilities);
      res.json({ agreementText });
    } catch (err: any) {
      console.error("Drafting consortium JV Agreement failed:", err);
      res.status(500).json({ error: "Failed to generate Joint Venture agreement via Gemini" });
    }
  });
