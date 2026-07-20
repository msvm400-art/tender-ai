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

export const systemRouter = express.Router();

  // -----------------------------------------------------------------
  // API ENDPOINTS: ALERTS
  // -----------------------------------------------------------------
  systemRouter.get("/api/alerts", (req, res) => {
    const user = resolveUser(req);
    if (!user) return res.status(401).json({ error: "Authentication required" });
    let userAlerts = db.data.alerts.filter((a) => a.userId === user.id);
    if (userAlerts.length === 0) {
      // Seed default alerts for this user
      const defaultAlertsTemplate = db.data.alerts.filter((a) => a.userId === "u-1" || !a.userId);
      const userSeededAlerts = defaultAlertsTemplate.map((a) => ({
        ...a,
        id: "al-" + Math.random().toString(36).substring(3, 8),
        userId: user.id,
        createdAt: new Date().toISOString(),
        sentAt: new Date().toISOString(),
      }));
      db.data.alerts.push(...userSeededAlerts);
      db.save();
      userAlerts = userSeededAlerts;
    }
    res.json(userAlerts);
  });

  systemRouter.put("/api/alerts/:id/read", (req, res) => {
    const alert = db.data.alerts.find((a) => a.id === req.params.id);
    if (alert) {
      alert.isRead = true;
      db.save();
      res.json(alert);
    } else {
      res.status(404).json({ error: "Alert not found" });
    }
  });

  systemRouter.put("/api/alerts/read-all", (req, res) => {
    const user = resolveUser(req);
    if (!user) return res.status(401).json({ error: "Authentication required" });
    db.data.alerts
      .filter((a) => a.userId === user.id)
      .forEach((a) => (a.isRead = true));
    db.save();
    res.json({ success: true });
  });

  systemRouter.post("/api/alerts/simulate", (req, res) => {
    const user = resolveUser(req);
    if (!user) return res.status(401).json({ error: "Authentication required" });
    const { type, channels, destinationEmail, destinationPhone } = req.body;
    
    const id = "al-" + Math.random().toString(36).substring(3, 8);
    let message = "";
    let tenderId = "";
    
    const tenders = db.data.tenders;
    const tItem = tenders[Math.floor(Math.random() * tenders.length)] || { id: "t-1", title: "Construction of Academic Block and Hostel Building at IIT Patna", externalId: "TND/2026/8391", state: "Bihar", tenderValue: 25.4, department: "Central PWD" };
    
    const emailTo = destinationEmail || user.email || "msvm220@gmail.com";
    const phoneTo = destinationPhone || "+91 98765 43210";
    
    let emailHtml = "";
    let smsText = "";
    let whatsappText = "";
    let pushText = "";
    
    if (type === "NEW_MATCH") {
      message = `New high compatibility tender match generated (94% Match) for "${tItem.title}". Check details in criteria workspace.`;
      tenderId = tItem.id;
      
      emailHtml = `<div style="font-family: Inter, sans-serif; max-width: 600px; margin: 0 auto; padding: 24px; border: 1px solid #e2e8f0; border-radius: 16px; background-color: #ffffff; color: #1e293b;">
    <div style="display: flex; align-items: center; margin-bottom: 24px; justify-content: space-between;">
      <span style="font-size: 20px; font-weight: 800; color: #2563eb;">TenderAI</span>
      <span style="font-size: 11px; font-weight: bold; padding: 2px 8px; background-color: #eff6ff; border-radius: 9999px; color: #1d4ed8; text-transform: uppercase;">Real-time Matching</span>
    </div>
    <h2 style="font-size: 18px; font-weight: 800; margin-bottom: 8px; color: #0f172a; tracking: -0.025em;">Tender Match Alert</h2>
    <p style="font-size: 13px; line-height: 1.6; margin-bottom: 20px; color: #475569;">Greetings, we identified an extremely strong compliance alignment between your company credentials and a newly published public contract opportunity.</p>
    <div style="padding: 16px; background-color: #f8fafc; border: 1px solid #e2e8f0; border-radius: 12px; margin-bottom: 24px;">
      <div style="font-size: 10px; font-weight: bold; text-transform: uppercase; color: #1e3a8a; margin-bottom: 4px;">Tender Title</div>
      <div style="font-size: 14px; font-weight: bold; color: #0f172a; margin-bottom: 12px;">${tItem.title}</div>
      <div style="font-size: 11px; font-family: monospace;">
        <strong>Value:</strong> ₹${tItem.tenderValue || 8.5} Cr | <strong>Match:</strong> 94% Compliant
      </div>
    </div>
    <a href="#" style="display: inline-block; padding: 10px 20px; background-color: #2563eb; color: #ffffff; font-size: 12px; font-weight: bold; text-decoration: none; border-radius: 8px; text-transform: uppercase; text-align: center;">Analyze tender document</a>
    <hr style="margin-top: 24px; border: 0; border-top: 1px solid #e2e8f0;" />
    <span style="font-size: 10px; color: #94a3b8; display: block; margin-top: 12px;">This is an automated dispatch from TenderAI Compliance Station because you registered ${emailTo} for alert dispatches.</span>
  </div>`;
  
      whatsappText = `*TenderAI Match Alert* 🔔\n\nDear Bidder, we discovered a highly compatible tender matching your profile:\n\n*${tItem.title}*\n• Value: ₹${tItem.tenderValue || 8.5} Cr\n• Match Score: *94%*\n• Authority: ${tItem.department || 'Urban Development'}\n\nClick to review and start smart bid drafting instantly:\n👉 https://ai.studio/build/tender/${tItem.id}`;
      smsText = `[TenderAI] NEW MATCH! 94% compatibility for "${tItem.title}" (₹${tItem.tenderValue || 8.5} Cr). Review RFP & draft bids now: https://tnd.ai/view-${tItem.id}`;
      pushText = `New 94% Match: ${tItem.title}`;
    } else if (type === "DEADLINE_REMINDER") {
      message = `Approaching Deadline: Bid submission for "${tItem.title}" closes in 48 hours! Ensure all EMD documents are ready.`;
      tenderId = tItem.id;
      
      emailHtml = `<div style="font-family: Inter, sans-serif; max-width: 600px; margin: 0 auto; padding: 24px; border: 1px solid #fda4af; border-radius: 16px; background-color: #fffbfa; color: #1e293b;">
    <div style="display: flex; align-items: center; margin-bottom: 24px; justify-content: space-between;">
      <span style="font-size: 20px; font-weight: 800; color: #e11d48;">TenderAI</span>
      <span style="font-size: 11px; font-weight: bold; padding: 2px 8px; background-color: #ffe4e6; border-radius: 9999px; color: #e11d48; text-transform: uppercase;">Closing Soon</span>
    </div>
    <h2 style="font-size: 18px; font-weight: 800; margin-bottom: 8px; color: #9f1239; tracking: -0.025em;">⚠️ Critical Submission Notice</h2>
    <p style="font-size: 13px; line-height: 1.6; margin-bottom: 20px; color: #475569;">Greetings, our e-procurement tracker registers that the bid submission window for the contract below closes in exactly 48 hours.</p>
    <div style="padding: 16px; background-color: #fff1f2; border: 1px solid #fecdd3; border-radius: 12px; margin-bottom: 24px;">
      <div style="font-size: 10px; font-weight: bold; text-transform: uppercase; color: #be123c; margin-bottom: 4px;">Tender Title</div>
      <div style="font-size: 14px; font-weight: bold; color: #0f172a; margin-bottom: 12px;">${tItem.title}</div>
      <div style="font-size: 11px; font-family: monospace; color: #475569;">
        <strong>Deadline Time:</strong> Closes in 48 Hours
      </div>
    </div>
    <a href="#" style="display: inline-block; padding: 10px 20px; background-color: #e11d48; color: #ffffff; font-size: 12px; font-weight: bold; text-decoration: none; border-radius: 8px; text-transform: uppercase; text-align: center;">Finalize Draft Proposal</a>
    <hr style="margin-top: 24px; border: 0; border-top: 1px solid #fecdd3;" />
    <span style="font-size: 10px; color: #94a3b8; display: block; margin-top: 12px;">This is an automated dispatch from TenderAI because you registered ${emailTo} for closing alerts.</span>
  </div>`;
  
      whatsappText = `*TenderAI URGENT DEADLINE* ⏳\n\nDear Bidder, the submission window for *${tItem.title}* is closing in 48 hours.\n\nReview files and finalize your bid response immediately:\n👉 https://ai.studio/build/tender/${tItem.id}`;
      smsText = `[TenderAI URGENT] 48 Hours left to submit bid for "${tItem.title}". Generate proposal documentation now: https://tnd.ai/${tItem.id}`;
      pushText = `Urgent Submission Window closing in 48 Hours for "${tItem.title}".`;
    } else if (type === "DOCUMENT_MISSING") {
      message = `Notice: Your ISO-9001 Compliance Certificate in compliance vault will expire soon on 15-Jul-2026! Please renew to avoid disqualification.`;
      tenderId = "";
      
      emailHtml = `<div style="font-family: Inter, sans-serif; max-width: 600px; margin: 0 auto; padding: 24px; border: 1px solid #fde047; border-radius: 16px; background-color: #fefcf3; color: #1e293b;">
    <div style="display: flex; align-items: center; margin-bottom: 24px; justify-content: space-between;">
      <span style="font-size: 20px; font-weight: 800; color: #ca8a04;">TenderAI</span>
      <span style="font-size: 11px; font-weight: bold; padding: 2px 8px; background-color: #fef9c3; border-radius: 9999px; color: #ca8a04; text-transform: uppercase;">Expirations</span>
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
    <p style="font-size: 12px; color: #475569; margin-bottom: 16px;">This document is required as primary check parameter for 90% of structural mechanical/civil bidding RFPs. Upload a renewal inside core vaults to retain auto-eligibility metrics.</p>
    <a href="#" style="display: inline-block; padding: 10px 20px; background-color: #ca8a04; color: #ffffff; font-size: 12px; font-weight: bold; text-decoration: none; border-radius: 8px; text-transform: uppercase; text-align: center;">Upload To Vault</a>
    <hr style="margin-top: 24px; border: 0; border-top: 1px solid #fef08a;" />
    <span style="font-size: 10px; color: #94a3b8; display: block; margin-top: 12px;">This is an automated dispatch from TenderAI because you registered ${emailTo} for Vault expiry events.</span>
  </div>`;
  
      whatsappText = `*TenderAI Compliance Alert* ⚠️\n\nDear Bidder, your critical compliance document is near expiration in your Vault:\n\n*Document:* *ISO-9001 Quality Certificate*\n*Expiration Date:* 15-Jul-2026\n\nPlease upload your renewed certificate inside compliance vault to avoid disqualification:\n👉 https://ai.studio/build/vault`;
      smsText = `[TenderAI] COMPLIANCE WARNING: Your ISO-9001 Quality Certificate expires on 15-Jul-2026. Please upload renewals in vault: https://tnd.ai/vault`;
      pushText = `Document Expiring soon: ISO-9001 Certificate validity limits check.`;
    } else {
      message = `Subscribing Success! Your plan has been upgraded to the Premium Enterprise Tier.`;
      tenderId = "";
      
      emailHtml = `<div style="font-family: Inter, sans-serif; max-width: 600px; margin: 0 auto; padding: 24px; border: 1px solid #c084fc; border-radius: 16px; background-color: #faf5ff; color: #1e293b;">
    <div style="display: flex; align-items: center; margin-bottom: 24px; justify-content: space-between;">
      <span style="font-size: 20px; font-weight: 800; color: #a855f7;">TenderAI</span>
      <span style="font-size: 11px; font-weight: bold; padding: 2px 8px; background-color: #f3e8ff; border-radius: 9999px; color: #9333ea; text-transform: uppercase;">Subscriptions</span>
    </div>
    <h2 style="font-size: 18px; font-weight: 800; margin-bottom: 8px; color: #6b21a8; tracking: -0.025em;">🎉 Subscription Upgrade Successful!</h2>
    <p style="font-size: 13px; line-height: 1.6; margin-bottom: 20px; color: #475569;">Greetings, we successfully verified your payment and processed subscription credentials swap on our billing engines.</p>
    <div style="padding: 16px; background-color: #f3e8ff; border: 1px solid #e9d5ff; border-radius: 12px; margin-bottom: 24px;">
      <div style="font-size: 10px; font-weight: bold; text-transform: uppercase; color: #7e22ce; margin-bottom: 4px;">Billing tier</div>
      <div style="font-size: 14px; font-weight: bold; color: #0f172a; margin-bottom: 12px;">Premium Enterprise Tier Plan Activated</div>
      <div style="font-size: 11px; font-family: monospace; color: #475569; display: flex; justify-content: space-between;">
        <span><strong>Quotas:</strong> Unlimited Proposals</span>
        <span><strong>Channels:</strong> SMS/WhatsApp/Push/Email</span>
      </div>
    </div>
    <a href="#" style="display: inline-block; padding: 10px 20px; background-color: #9333ea; color: #ffffff; font-size: 12px; font-weight: bold; text-decoration: none; border-radius: 8px; text-transform: uppercase; text-align: center;">Go to Analytics Dashboard</a>
    <hr style="margin-top: 24px; border: 0; border-top: 1px solid #e9d5ff;" />
    <span style="font-size: 10px; color: #94a3b8; display: block; margin-top: 12px;">Billing invoice reference sent successfully to ${emailTo}. Subscription ID: sub-UPGRADE-CONFIRMED</span>
  </div>`;
  
      whatsappText = `*TenderAI Subscription confirmation* 🎉\n\nDear Bidder, your payment was processed successfully! Your *Enterprise Plan* is active.\n\n• Daily Bid Quota: Unlimited AI generations\n• Channels Activated: SMS, WhatsApp, Email, Push\n\nBuild winning proposals with developer features:\n👉 https://ai.studio/build`;
      smsText = `[TenderAI] Upgrade Success! Premium Enterprise Tier is active. Explore matches, consortiums, and unlimited bid proposal generations: https://tnd.ai/billing`;
      pushText = `Enterprise Tier Active: Your billing settings have been updated.`;
    }
    
    const isChannelEnabled = (ch: string) => channels.includes(ch);
    
    const dispatched = {
      email: {
        sent: isChannelEnabled("EMAIL"),
        destination: emailTo,
        timestamp: new Date().toISOString(),
        subject: type === "NEW_MATCH" ? `[TenderAI] High Compatibility Tender Match Discovered (94%)` : 
                 type === "DEADLINE_REMINDER" ? "⚠️ Urgent Notice: Bid submission closes in 48 Hours" :
                 type === "DOCUMENT_MISSING" ? "📄 Compliance Expiration Notice" : "🎉 Plan Upgraded Successfully",
        content: emailHtml
      },
      sms: {
        sent: isChannelEnabled("SMS"),
        destination: phoneTo,
        timestamp: new Date().toISOString(),
        content: smsText
      },
      whatsapp: {
        sent: isChannelEnabled("WHATSAPP"),
        destination: phoneTo,
        timestamp: new Date().toISOString(),
        content: whatsappText
      },
      push: {
        sent: isChannelEnabled("PUSH"),
        destination: "Active Browser Device Sessions",
        timestamp: new Date().toISOString(),
        content: pushText
      },
      in_app: {
        sent: isChannelEnabled("IN_APP"),
        destination: "In-App Feed Station Panel",
        timestamp: new Date().toISOString(),
        content: message
      }
    };
    
    const primaryChannel = channels[0] || "IN_APP";
    
    const newAlert = {
      id,
      userId: user.id,
      tenderId,
      type,
      channel: primaryChannel,
      message,
      isRead: false,
      sentAt: new Date().toISOString(),
      createdAt: new Date().toISOString(),
      channelsDispatched: dispatched
    };
    
    db.data.alerts.unshift(newAlert);
    db.save();
    
    if (ioServerInstance) {
      ioServerInstance.emit("tender_alert", newAlert);
      console.log(`[TenderAI] Simulated alert ${id} emitted to sockets`);
    }
    
    res.json({ success: true, alert: newAlert });
  });

  // -----------------------------------------------------------------
  // API ENDPOINTS: ANALYTICS
  // -----------------------------------------------------------------
  systemRouter.get("/api/analytics/overview", (req, res) => {
    const user = resolveUser(req);
    if (!user) return res.status(401).json({ error: "Authentication required" });
    const profile = db.data.companyProfiles.find((p) => p.userId === user.id) || { id: "cp-1" };
    const tenders = db.data.tenders.length;
    const userMatches = db.data.tenderMatches.filter((m) => m.companyProfileId === profile.id);
    const matches = userMatches.filter((m) => m.matchScore >= 70).length;
    const submitted = userMatches.filter((m) => m.userStatus === "SUBMITTED").length;
    
    // Win Rate calculated exactly as requested: WON / (WON + LOST)
    const wonCount = userMatches.filter((m) => m.userStatus === "WON").length;
    const lostCount = userMatches.filter((m) => m.userStatus === "LOST").length;
    const totalConcluded = wonCount + lostCount;
    const winRate = totalConcluded > 0 ? Math.round((wonCount / totalConcluded) * 100) : 60; // default 60 for seeded visualization

    res.json({
      totalTendersMonitored: tenders,
      highActiveMatchesCount: matches,
      bidsSubmittedCount: submitted,
      winRatePercentage: winRate,
    });
  });

  systemRouter.get("/api/analytics/tender-volume", (req, res) => {
    // Generate lovely time series volume distributions grouped by source Portal
    res.json([
      { month: "Jan", CPPP: 45, GEM: 30, Railways: 12, PWD: 18 },
      { month: "Feb", CPPP: 52, GEM: 42, Railways: 15, PWD: 22 },
      { month: "Mar", CPPP: 60, GEM: 55, Railways: 18, PWD: 30 },
      { month: "Apr", CPPP: 72, GEM: 65, Railways: 24, PWD: 35 },
      { month: "May", CPPP: 85, GEM: 90, Railways: 30, PWD: 45 },
      { month: "Jun", CPPP: 95, GEM: 110, Railways: 38, PWD: 50 },
    ]);
  });

  systemRouter.get("/api/analytics/bid-pipeline", (req, res) => {
    res.json([
      { stage: "Identified", value: 45.5 },
      { stage: "Reviewing", value: 28.2 },
      { stage: "Bidding", value: 15.0 },
      { stage: "Submitted", value: 8.5 },
      { stage: "Won", value: 5.2 },
    ]);
  });

  // -----------------------------------------------------------------
  // INTERNAL INGESTION ENDPOINT: For Python Scraper
  // -----------------------------------------------------------------
  systemRouter.post("/api/internal/tenders/ingest", (req, res) => {
    const authHeader = req.headers.authorization;
    const internalKey = process.env.SCRAPER_INTERNAL_KEY || "scraper_internal_key";
    if (authHeader !== `Bearer ${internalKey}`) {
      return res.status(401).json({ error: "Unauthorized ingestion" });
    }
    const data = req.body;
    db.data.tenders.push({
      id: "t-" + crypto.randomUUID(),
      externalId: data.externalId,
      sourcePortal: data.sourcePortal,
      title: data.title,
      department: data.department,
      state: data.state || "Delhi",
      category: data.category || "General",
      subCategory: data.category || "Laying",
      tenderValue: data.tenderValue || 1.0,
      emdAmount: data.emdAmount || 2.0,
      publishedDate: data.publishedDate || new Date().toISOString(),
      bidSubmissionDeadline: data.submissionDeadline || new Date(Date.now() + 15*24*60*60*1000).toISOString(),
      openingDate: null,
      workDescription: data.workDescription || "",
      eligibilityCriteria: data.eligibilityCriteria || { minTurnover: 0.5, minExperience: 2, requiredCertifications: [], msmeOnly: false },
      technicalSpecs: null,
      documents: data.documents || [],
      rawText: data.rawText || "",
      aiSummary: null,
      aiEligibilityChecklist: null,
      status: "ACTIVE",
      location: data.location || "India",
      pineconeVectorId: null,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    });
    db.save();
    try {
      const addedDoc = db.data.tenders[db.data.tenders.length - 1];
      searchEngine.indexTender(addedDoc);
    } catch (idxErr) {
      console.error("Failed to index manual raw ingested tender:", idxErr);
    }
    res.json({ success: true });
  });

  // -----------------------------------------------------------------
  // TENDER COLLECTION INGESTION MONITOR ENDPOINTS (PHASE 4)
  // -----------------------------------------------------------------
  systemRouter.get("/api/ingestion/stats", (req, res) => {
    res.json({
      config: ingestionService.config,
      stats: ingestionService.stats,
      portalCoverage: Object.values(ingestionService.portalCoverage),
    });
  });

  systemRouter.get("/api/ingestion/jobs", (req, res) => {
    res.json({ jobs: ingestionService.jobs });
  });

  systemRouter.post("/api/ingestion/config", (req, res) => {
    const { schedulerActive, intervalMinutes, concurrencyLimit } = req.body;
    if (typeof schedulerActive === "boolean") {
      if (schedulerActive) {
        ingestionService.startScheduler();
      } else {
        ingestionService.stopScheduler();
      }
    }
    if (typeof intervalMinutes === "number") {
      ingestionService.updateInterval(intervalMinutes);
    }
    if (typeof concurrencyLimit === "number") {
      ingestionService.config.concurrencyLimit = Math.max(1, concurrencyLimit);
      ingestionService.saveToDisk();
    }
    res.json({ success: true, config: ingestionService.config });
  });

  systemRouter.post("/api/ingestion/run-now", (req, res) => {
    ingestionService.triggerIngestionCycle();
    res.json({ success: true, message: "Ingestion scheduled to trigger for all portals." });
  });

  systemRouter.post("/api/ingestion/clear-queue", (req, res) => {
    ingestionService.clearQueue();
    res.json({ success: true, message: "Queue history cleared." });
  });

  systemRouter.post("/api/ingestion/jobs/:id/retry", async (req, res) => {
    const success = await ingestionService.retryJob(req.params.id);
    if (success) {
      res.json({ success: true, message: `Job ${req.params.id} has been enqueued for retry.` });
    } else {
      res.status(400).json({ error: "Job could not be enqueued for retry." });
    }
  });

  // -----------------------------------------------------------------
  // API ENDPOINTS: SUPPORT TICKETS & SYSTEM ADMIN PANEL (PHASE 11)
  // -----------------------------------------------------------------

  systemRouter.get("/api/support-tickets", (req, res) => {
    try {
      const user = resolveUser(req);
      if (!user) return res.status(401).json({ error: "Authentication required" });
      if (!user) return res.status(401).json({ error: "Access denied. Login required." });

      // Admin gets all tickets, regular users get only theirs
      if (user.role === "ADMIN") {
        res.json(db.data.supportTickets || []);
      } else {
        const tickets = (db.data.supportTickets || []).filter(t => t.userId === user.id);
        res.json(tickets);
      }
    } catch (err) {
      console.error("Support tickets fetch error:", err);
      res.status(500).json({ error: "Could not fetch support tickets" });
    }
  });

  systemRouter.post("/api/support-tickets", (req, res) => {
    try {
      const user = resolveUser(req);
      if (!user) return res.status(401).json({ error: "Authentication required" });
      if (!user) return res.status(401).json({ error: "Access denied" });

      const { subject, message, priority, category } = req.body;
      if (!subject || !message) {
        return res.status(400).json({ error: "Subject and Message are required" });
      }

      const newTicket = {
        id: "st-" + Math.floor(100000 + Math.random() * 900000),
        userId: user.id,
        userEmail: user.email,
        userName: user.name,
        subject,
        message,
        status: "OPEN" as const,
        priority: priority || "MEDIUM",
        category: category || "TECHNICAL",
        replies: [
          {
            sender: "USER" as const,
            message,
            timestamp: new Date().toISOString()
          }
        ],
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString()
      };

      if (!db.data.supportTickets) db.data.supportTickets = [];
      db.data.supportTickets.unshift(newTicket);
      db.save();

      res.status(201).json({ success: true, ticket: newTicket });
    } catch (err) {
      console.error("Support ticket creation failed:", err);
      res.status(500).json({ error: "Failed to create support ticket" });
    }
  });

  systemRouter.post("/api/support-tickets/:id/reply", (req, res) => {
    try {
      const user = resolveUser(req);
      if (!user) return res.status(401).json({ error: "Authentication required" });
      if (!user) return res.status(401).json({ error: "Access denied" });

      const { message } = req.body;
      if (!message) return res.status(400).json({ error: "Reply message is required" });

      const ticket = (db.data.supportTickets || []).find(t => t.id === req.params.id);
      if (!ticket) return res.status(404).json({ error: "Ticket not found" });

      // Security check: must be admin, or the owner of the ticket
      if (user.role !== "ADMIN" && ticket.userId !== user.id) {
        return res.status(403).json({ error: "Forbidden" });
      }

      const senderType = user.role === "ADMIN" ? ("ADMIN" as const) : ("USER" as const);
      ticket.replies.push({
        sender: senderType,
        message,
        timestamp: new Date().toISOString()
      });

      if (user.role === "ADMIN") {
        ticket.status = "IN_PROGRESS" as const;
      } else {
        ticket.status = "OPEN" as const;
      }
      ticket.updatedAt = new Date().toISOString();
      db.save();

      res.json({ success: true, ticket });
    } catch (err) {
      console.error("Support ticket reply failed:", err);
      res.status(500).json({ error: "Failed to post reply" });
    }
  });

  // ADMIN-GATED ENDPOINTS
  const requireAdminRole = (req: express.Request, res: express.Response, next: express.NextFunction) => {
    const user = resolveUser(req);
    if (!user) return res.status(401).json({ error: "Authentication required" });
    if (user && user.role === "ADMIN") {
      next();
    } else {
      res.status(403).json({ error: "Access Denied. Administrator role is required." });
    }
  };

  systemRouter.get("/api/admin/users", requireAdminRole, (req, res) => {
    res.json(db.data.users);
  });

  systemRouter.put("/api/admin/users/:id", requireAdminRole, (req, res) => {
    const { plan, role, isTrialActive, trialDaysElapsed } = req.body;
    const target = db.data.users.find(u => u.id === req.params.id);
    if (!target) return res.status(404).json({ error: "User not found" });

    if (plan) target.plan = plan;
    if (role) target.role = role;
    if (isTrialActive !== undefined) target.isTrialActive = isTrialActive;
    if (trialDaysElapsed !== undefined) target.trialDaysElapsed = Number(trialDaysElapsed);

    target.updatedAt = new Date().toISOString();
    db.save();
    res.json({ success: true, user: target });
  });

  systemRouter.get("/api/admin/subscriptions", requireAdminRole, (req, res) => {
    const history = db.data.paymentIntents || [];
    const activeSubscribers = db.data.users.filter(u => u.plan !== "FREE").length;
    const totalRevenue = history
      .filter(p => p.status === "CAPTURED")
      .reduce((sum, p) => sum + p.amount, 0);

    res.json({
      activeSubscribers,
      totalRevenue,
      paymentHistory: history
    });
  });

  systemRouter.get("/api/admin/tenders", requireAdminRole, (req, res) => {
    res.json(db.data.tenders);
  });

  systemRouter.post("/api/admin/tenders", requireAdminRole, (req, res) => {
    const { title, department, state, category, subCategory, tenderValue, emdAmount, bidSubmissionDeadline, workDescription } = req.body;
    
    if (!title || !department || !state || !category || !bidSubmissionDeadline) {
      return res.status(400).json({ error: "Missing required core tender properties." });
    }

    const newTender = {
      id: "t-" + crypto.randomUUID(),
      externalId: `MANUAL/2026/${state.toUpperCase().substring(0, 2)}/${Math.floor(1000 + Math.random() * 9000)}`,
      sourcePortal: "OTHER" as const,
      title,
      department,
      state,
      category,
      subCategory: subCategory || "Civil Work",
      tenderValue: tenderValue !== undefined ? Number(tenderValue) : null,
      emdAmount: emdAmount !== undefined ? Number(emdAmount) : null,
      publishedDate: new Date().toISOString(),
      bidSubmissionDeadline,
      openingDate: new Date(new Date(bidSubmissionDeadline).getTime() + 24 * 60 * 60 * 1000).toISOString(),
      workDescription: workDescription || "Manual Tender Ingested via Administrator console.",
      eligibilityCriteria: {
        minTurnover: tenderValue ? Number((Number(tenderValue) * 0.5).toFixed(2)) : 1.0,
        minExperience: 3,
        requiredCertifications: ["ISO 9001"],
        msmeOnly: false
      },
      technicalSpecs: "As per administrator manual specifications.",
      documents: [],
      rawText: title + " " + workDescription,
      aiSummary: "Manual Admin Tender: " + title,
      aiEligibilityChecklist: null,
      status: "ACTIVE" as const,
      location: state + " Complex",
      pineconeVectorId: null,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString()
    };

    db.data.tenders.unshift(newTender);
    
    // Recalculate matches
    db.data.companyProfiles.forEach(p => {
      db.recalculateMatches(p.id);
    });

    try {
      searchEngine.indexTenders(db.data.tenders);
    } catch (e) {
      console.warn("Index warning: ", e);
    }

    db.save();
    res.status(201).json({ success: true, tender: newTender });
  });

  systemRouter.put("/api/admin/tenders/:id", requireAdminRole, (req, res) => {
    const tender = db.data.tenders.find(t => t.id === req.params.id);
    if (!tender) return res.status(404).json({ error: "Tender not found" });

    const fields = ["title", "department", "state", "category", "subCategory", "tenderValue", "emdAmount", "bidSubmissionDeadline", "workDescription", "status"];
    fields.forEach(f => {
      if (req.body[f] !== undefined) {
        if (f === "tenderValue" || f === "emdAmount") {
          (tender as any)[f] = req.body[f] !== null ? Number(req.body[f]) : null;
        } else {
          (tender as any)[f] = req.body[f];
        }
      }
    });

    tender.updatedAt = new Date().toISOString();
    
    db.data.companyProfiles.forEach(p => {
      db.recalculateMatches(p.id);
    });
    
    try {
      searchEngine.indexTenders(db.data.tenders);
    } catch (e) {
      console.warn("Index update error", e);
    }

    db.save();
    res.json({ success: true, tender });
  });

  systemRouter.delete("/api/admin/tenders/:id", requireAdminRole, (req, res) => {
    const countBefore = db.data.tenders.length;
    db.data.tenders = db.data.tenders.filter(t => t.id !== req.params.id);
    db.data.tenderMatches = db.data.tenderMatches.filter(m => m.tenderId !== req.params.id);

    try {
      searchEngine.indexTenders(db.data.tenders);
    } catch (e) {
      console.warn("Index update warning:", e);
    }

    db.save();
    res.json({ success: true, deletedCount: countBefore - db.data.tenders.length });
  });

  systemRouter.get("/api/admin/documents", requireAdminRole, (req, res) => {
    // Collect all documents across vaults
    const list = db.data.documentVaults || [];
    res.json(list);
  });

  systemRouter.put("/api/admin/documents/:id/verify", requireAdminRole, (req, res) => {
    const doc = db.data.documentVaults.find(d => d.id === req.params.id);
    if (!doc) return res.status(404).json({ error: "Document not found" });

    const { isVerified } = req.body;
    if (isVerified !== undefined) {
      doc.isVerified = isVerified;
    }
    doc.updatedAt = new Date().toISOString();
    db.save();

    res.json({ success: true, document: doc });
  });

  systemRouter.get("/api/admin/ai-usage", requireAdminRole, (req, res) => {
    // Generate simulated stats representing AI usage telemetry
    res.json({
      success: true,
      stats: {
        totalGenerations: 247,
        totalTokensConsumed: 1254900,
        tokensBreakup: [
          { name: "Proposal Drafts", val: 820000, color: "#1B4FD8" },
          { name: "Eligibility Screen", val: 240000, color: "#10B981" },
          { name: "SBD Summarization", val: 120000, color: "#F59E0B" },
          { name: "Compliance QA Chat", val: 74900, color: "#8B5CF6" }
        ],
        userBreakup: [
          { email: "demo@tenderai.in", name: "Ramesh Sharma", percentage: 88, tokens: 1104312 },
          { email: "guest@tenderai.in", name: "Guest User", percentage: 12, tokens: 150588 }
        ]
      }
    });
  });

  systemRouter.get("/api/admin/settings", requireAdminRole, (req, res) => {
    res.json(db.data.systemSettings || {});
  });

  systemRouter.get("/api/admin/audit-logs", requireAdminRole, (req, res) => {
    res.json((db.data as any).auditLogs || []);
  });

  systemRouter.get("/api/admin/backups", requireAdminRole, (req, res) => {
    try {
      res.json(getBackupHistory());
    } catch (err: any) {
      res.status(500).json({ error: err?.message || "Failed to retrieve database backup logs" });
    }
  });

  systemRouter.post("/api/admin/backup", requireAdminRole, (req, res) => {
    try {
      const backup = executeDurableBackup();
      res.json({ success: true, message: `Backup created: ${backup.fileName}`, backup });
    } catch (err: any) {
      res.status(500).json({ error: err?.message || "Failed to execute durable database backup" });
    }
  });

  systemRouter.put("/api/admin/settings", requireAdminRole, (req, res) => {
    if (!db.data.systemSettings) {
      (db.data.systemSettings as any) = {};
    }
    const { liveGatewayActive, aiRateLimitPerMin, customServiceFeeMultiplier, sandboxMode, maintenanceMode } = req.body;

    if (liveGatewayActive !== undefined) db.data.systemSettings.liveGatewayActive = !!liveGatewayActive;
    if (aiRateLimitPerMin !== undefined) db.data.systemSettings.aiRateLimitPerMin = Number(aiRateLimitPerMin);
    if (customServiceFeeMultiplier !== undefined) db.data.systemSettings.customServiceFeeMultiplier = Number(customServiceFeeMultiplier);
    if (sandboxMode !== undefined) db.data.systemSettings.sandboxMode = !!sandboxMode;
    if (maintenanceMode !== undefined) db.data.systemSettings.maintenanceMode = !!maintenanceMode;

    db.save();
    res.json({ success: true, settings: db.data.systemSettings });
  });

  // -----------------------------------------------------------------
  // WEBHOOK AND FAILED PAYMENT RECOVERY BILLING SYSTEMS (PHASE 10)
  // -----------------------------------------------------------------
  
  // Simulated Webhook Endpoint for Razorpay Integration
  systemRouter.post("/api/payments/razorpay/webhook", (req, res) => {
    try {
      const signature = req.headers["x-razorpay-signature"];
      const secret = process.env.RAZORPAY_WEBHOOK_SECRET;
      if (secret && signature) {
        const expectedSignature = crypto.createHmac("sha256", secret).update(JSON.stringify(req.body)).digest("hex");
        if (expectedSignature !== signature) {
          return res.status(401).json({ error: "Invalid signature" });
        }
      }
      const { event, payload } = req.body;
      console.log(`[Razorpay Webhook] Received event: ${event}`);

      if (event === "payment.captured" || event === "order.paid") {
        const payment = payload?.payment?.entity;
        const notes = payment?.notes || {};
        const orderId = payment?.order_id || "simulated_order";
        const email = payment?.email || "demo@tenderai.in";
        const amount = payment?.amount ? (payment.amount / 100) : 4999;

        const targetUser = db.data.users.find(u => u.email.toLowerCase() === email.toLowerCase()) || db.data.users[0];
        if (targetUser) {
          const selectedPlan = notes.planId || "PROFESSIONAL";
          targetUser.plan = selectedPlan;
          (targetUser as any).isTrialActive = false;
          (targetUser as any).trialDaysElapsed = 0;

          // Push into history logs
          const intentId = payment?.id || `rzp_pay_web_${Math.floor(100000 + Math.random() * 900000)}`;
          db.data.paymentIntents.push({
            id: intentId,
            userId: targetUser.id,
            planId: selectedPlan,
            amount: Number(amount),
            billingCycle: notes.billingCycle || "MONTHLY",
            gateway: "RAZORPAY",
            method: "UPI",
            status: "CAPTURED",
            createdAt: new Date().toISOString()
          });

          // Also trigger a welcome alert notification!
          const notificationAlert = {
            id: "al-" + Math.random().toString(36).substring(3, 8),
            userId: targetUser.id,
            tenderId: "",
            type: "SUBSCRIPTION_EVENT" as const,
            channel: "IN_APP" as const,
            message: `Razorpay Webhook Verified: Your subscription has been upgraded to ${selectedPlan}! Welcome to full premium capabilities.`,
            isRead: false,
            sentAt: new Date().toISOString(),
            createdAt: new Date().toISOString()
          };
          db.data.alerts.unshift(notificationAlert);
          db.save();
        }
      } else if (event === "payment.failed") {
        const payment = payload?.payment?.entity;
        const notes = payment?.notes || {};
        const email = payment?.email || "demo@tenderai.in";
        const amount = payment?.amount ? (payment.amount / 100) : 4999;

        const targetUser = db.data.users.find(u => u.email.toLowerCase() === email.toLowerCase()) || db.data.users[0];
        if (targetUser) {
          const intentId = payment?.id || `rzp_pay_fail_${Math.floor(100000 + Math.random() * 900000)}`;
          db.data.paymentIntents.push({
            id: intentId,
            userId: targetUser.id,
            planId: notes.planId || "PROFESSIONAL",
            amount: Number(amount),
            billingCycle: notes.billingCycle || "MONTHLY",
            gateway: "RAZORPAY",
            method: payment?.method || "UPI",
            status: "FAILED",
            createdAt: new Date().toISOString()
          });
          
          // Trigger failed subscription alert!
          const notificationAlert = {
            id: "al-" + Math.random().toString(36).substring(3, 8),
            userId: targetUser.id,
            tenderId: "",
            type: "SUBSCRIPTION_EVENT" as const,
            channel: "IN_APP" as const,
            message: `Payment failed for ₹${amount}. Razorpay reported a network decline. Click here or visit Billing to recover and try again.`,
            isRead: false,
            sentAt: new Date().toISOString(),
            createdAt: new Date().toISOString()
          };
          db.data.alerts.unshift(notificationAlert);
          db.save();
        }
      }

      res.json({ success: true, status: "webhook_processed" });
    } catch (err) {
      console.error("[Webhook Error] Processing failure:", err);
      res.status(500).json({ error: "Internal webhook capture failure" });
    }
  });

  // Failed Payment Recovery Sandbox
  systemRouter.post("/api/payments/recover", (req, res) => {
    try {
      const { paymentIntentId } = req.body;
      if (!paymentIntentId) {
        return res.status(400).json({ error: "PaymentIntent ID is required for recovery" });
      }

      const intent = db.data.paymentIntents.find(p => p.id === paymentIntentId);
      if (!intent) {
        return res.status(404).json({ error: "Payment intent record not found." });
      }

      // Upgrade status to CAPTURED and configure user premium
      intent.status = "CAPTURED";
      intent.method = "UPI";
      intent.createdAt = new Date().toISOString();

      const user = db.data.users.find(u => u.id === intent.userId);
      if (user) {
        user.plan = intent.planId as any;
        (user as any).isTrialActive = false;
        (user as any).trialDaysElapsed = 0;

        // Alerts dispatched
        const recoverAlert = {
          id: "al-" + Math.random().toString(36).substring(3, 8),
          userId: user.id,
          tenderId: "",
          type: "SUBSCRIPTION_EVENT" as const,
          channel: "IN_APP" as const,
          message: `Recovered: Payment of ₹${intent.amount} has been recovered successfully! Premium upgraded to ${intent.planId}.`,
          isRead: false,
          sentAt: new Date().toISOString(),
          createdAt: new Date().toISOString()
        };
        db.data.alerts.unshift(recoverAlert);
      }

      db.save();
      res.json({ success: true, paymentIntent: intent, user });
    } catch (err) {
      console.error("[Recover payment failure]:", err);
      res.status(500).json({ error: "Recovery process crashed" });
    }
  });
