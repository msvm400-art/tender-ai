import express from "express";
import crypto from "crypto";
import { db } from "../db.js";
import { authenticateJWT, requireRole, resolveUser, hashPassword, comparePassword, generateToken, generateAccessAndRefreshTokens } from "../authMiddleware.js";
import { recordAuditLog, generateCSRFToken } from "../security.js";
import { getGeminiAI, summarizeTender, analyzeEligibility, askTenderQuestion, generateBidDoc, generateSmartBidDraft, summarizeProcurementDocument, draftConsortiumAgreement, analyzeAndOCRDocument, chatAboutDocument } from "../ai.service.js";
// @ts-ignore
import Razorpay from "razorpay";


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

export const userRouter = express.Router();

  // -----------------------------------------------------------------
  // API ENDPOINTS: USER PLAN & TRIAL SIMULATION
  // -----------------------------------------------------------------
  userRouter.put("/api/user/plan", (req, res) => {
    const { plan, isTrialActive, trialDaysElapsed, trialStartDate } = req.body;
    const user = resolveUser(req);
    if (!user) return res.status(401).json({ error: "Authentication required" });
    if (user) {
      if (plan) user.plan = plan;
      
      // Store dynamic trial properties for sandbox simulation
      (user as any).isTrialActive = isTrialActive !== undefined ? isTrialActive : true;
      if (trialStartDate) {
        (user as any).trialStartDate = trialStartDate;
        (user as any).trialDaysElapsed = Math.floor((Date.now() - new Date(trialStartDate).getTime()) / 86400000);
      } else if (trialDaysElapsed !== undefined) {
        (user as any).trialDaysElapsed = Number(trialDaysElapsed);
        (user as any).trialStartDate = new Date(Date.now() - Number(trialDaysElapsed) * 86400000).toISOString();
      }
      
      db.save();
      res.json(user);
    } else {
      res.status(404).json({ error: "User not found" });
    }
  });

  userRouter.get("/api/user/plan", (req, res) => {
    const user = resolveUser(req);
    if (!user) return res.status(401).json({ error: "Authentication required" });
    if (user) {
      if (user.trialStartDate) {
        user.trialDaysElapsed = Math.floor((Date.now() - new Date(user.trialStartDate).getTime()) / 86400000);
      }
      res.json(user);
    } else {
      res.status(404).json({ error: "User not found" });
    }
  });

  // -----------------------------------------------------------------
  // API ENDPOINTS: CASHFREE & RAZORPAY SIMULATED PAYMENT INTENTS
  // -----------------------------------------------------------------
  userRouter.post("/api/payments/intent", (req, res) => {
    try {
      const { planId, amount, billingCycle, gateway, method } = req.body;
      
      if (!planId || amount === undefined || !billingCycle || !gateway || !method) {
        return res.status(400).json({ error: "Missing required properties: planId, amount, billingCycle, gateway, method" });
      }

      const intentId = gateway === "CASHFREE" 
        ? `cf_int_${Math.floor(100000 + Math.random() * 900000)}` 
        : `rzp_pay_${Math.floor(100000000 + Math.random() * 900000000)}`;

      const newIntent = {
        id: intentId,
        userId: db.data.users[0]?.id || "u-1",
        planId,
        amount: Number(amount),
        billingCycle,
        gateway,
        method: method.toUpperCase(),
        status: "CAPTURED",
        createdAt: new Date().toISOString()
      };

      if (!db.data.paymentIntents) {
        db.data.paymentIntents = [];
      }
      db.data.paymentIntents.push(newIntent as any);

      // Upgrade active user's plan and reset trial state
      if (db.data.users.length > 0) {
        const user = db.data.users[0];
        user.plan = planId;
        (user as any).isTrialActive = false;
        (user as any).trialDaysElapsed = 0;
      }

      db.save();
      res.status(201).json({ success: true, paymentIntent: newIntent, user: db.data.users[0] });
    } catch (err) {
      console.error("Failed to captured simulated payment intent:", err);
      res.status(500).json({ error: "Could not create payment intent" });
    }
  });

  userRouter.get("/api/payments/history", (req, res) => {
    try {
      if (!db.data.paymentIntents) {
        db.data.paymentIntents = [];
      }
      const userId = db.data.users[0]?.id || "u-1";
      const history = db.data.paymentIntents.filter(x => x.userId === userId);
      res.json(history);
    } catch (err) {
      console.error("Failed to retrieve payments:", err);
      res.status(500).json({ error: "Internal server error" });
    }
  });

  // -----------------------------------------------------------------
  // API ENDPOINTS: REAL & SANDBOXED RAZORPAY & STRIPE ADAPTERS
  // -----------------------------------------------------------------
  userRouter.post("/api/payments/razorpay/create-order", async (req, res) => {
    try {
      const { planId, amount, billingCycle } = req.body;
      if (!planId || amount === undefined) {
        return res.status(400).json({ error: "Missing required properties: planId or amount" });
      }

      const keyId = process.env.RAZORPAY_KEY_ID;
      const keySecret = process.env.RAZORPAY_KEY_SECRET;

      // Real integration logic if secret credentials exist
      if (keyId && keySecret) {
        console.log(`[Payment Gateway] Processing real Razorpay Order creation for ${planId} (₹${amount})`);
        
        const razorpay = new Razorpay({
          key_id: keyId,
          key_secret: keySecret
        });

        const order = await razorpay.orders.create({
          amount: Math.round(Number(amount) * 100), // convert rupees to paise
          currency: "INR",
          receipt: `rcpt_plan_${planId.toLowerCase()}_${Date.now()}`.substring(0, 40)
        });

        return res.json({
          success: true,
          isLive: true,
          razorpayKeyId: keyId,
          orderId: order.id,
          amount: order.amount,
          currency: order.currency,
        });
      }

      // Live Simulator sandbox fallback mode
      const mockOrderId = `order_mock_${Math.random().toString(36).substring(3, 11)}`;
      res.json({
        success: true,
        isLive: false,
        razorpayKeyId: "rzp_test_mock_keys",
        orderId: mockOrderId,
        amount: Math.round(Number(amount) * 100),
        currency: "INR"
      });
    } catch (err) {
      console.error("[Payment Gateway] Failed to create Razorpay checkouts:", err);
      res.status(500).json({ error: "Checkout Order Creation Failed" });
    }
  });

  userRouter.post("/api/payments/razorpay/verify", (req, res) => {
    try {
      const { planId, amount, billingCycle, razorpay_payment_id, razorpay_order_id, razorpay_signature, isLive } = req.body;

      if (isLive) {
        const keySecret = process.env.RAZORPAY_KEY_SECRET;
        if (!keySecret) {
          return res.status(400).json({ error: "Razorpay production signature verification secret key is missing" });
        }
        
        // Cryptographic integrity validation
        const bodyContent = razorpay_order_id + "|" + razorpay_payment_id;
        const expectedSignature = crypto
          .createHmac("sha256", keySecret)
          .update(bodyContent)
          .digest("hex");

        if (expectedSignature !== razorpay_signature) {
          console.error("[Payment Gateway] Cryptographic signature mismatch!");
          return res.status(400).json({ error: "Security Signature Mismatch! Cryptographic verification failed." });
        }
        console.log(`[Payment Gateway] Cryptographic signature verified successfully for Order ${razorpay_order_id}`);
      }

      // Sync user profile plan & reset trial metrics
      if (db.data.users.length > 0) {
        const user = db.data.users[0];
        user.plan = planId;
        (user as any).isTrialActive = false;
        (user as any).trialDaysElapsed = 0;
      }

      const intentId = razorpay_payment_id || `rzp_pay_${Math.floor(100000000 + Math.random() * 900000000)}`;
      const newIntent = {
        id: intentId,
        userId: db.data.users[0]?.id || "u-1",
        planId,
        amount: Number(amount),
        billingCycle,
        gateway: "RAZORPAY",
        method: isLive ? "UPI/CARD (REAL LIVE)" : "UPI/CARD (SANDBOX)",
        status: "CAPTURED",
        createdAt: new Date().toISOString()
      };

      if (!db.data.paymentIntents) {
        db.data.paymentIntents = [];
      }
      db.data.paymentIntents.push(newIntent as any);
      db.save();

      res.json({ success: true, paymentIntent: newIntent, user: db.data.users[0] });
    } catch (err) {
      console.error("[Payment Gateway] Signature verification exception:", err);
      res.status(500).json({ error: "Internal signature verification crash" });
    }
  });


  // -----------------------------------------------------------------
  // API ENDPOINTS: COMPANY PROFILE
  // -----------------------------------------------------------------
  userRouter.get("/api/profiles", (req, res) => {
    const user = resolveUser(req);
    if (!user) return res.status(401).json({ error: "Authentication required" });
    let profiles = db.data.companyProfiles.filter((p) => p.userId === user.id);
    if (profiles.length === 0) {
      const defaultProfile = {
        id: "cp-" + crypto.randomUUID(),
        userId: user.id,
        companyName: `${user.name || "My"} Corporation`,
        registrationNumber: "",
        gstNumber: "",
        panNumber: "",
        annualTurnover: 0,
        yearsOfExperience: 0,
        employeeCount: 0,
        categories: [],
        certifications: [],
        states: [],
        msmeRegistered: false,
        isActive: true,
        pastProjects: [],
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString()
      };
      db.data.companyProfiles.push(defaultProfile);
      db.save();
      profiles = [defaultProfile];
    }
    res.json(profiles);
  });

  userRouter.get("/api/profiles/:id", (req, res) => {
    const profile = db.data.companyProfiles.find((p) => p.id === req.params.id);
    if (profile) {
      res.json(profile);
    } else {
      res.status(404).json({ error: "Profile not found" });
    }
  });

  userRouter.put("/api/profiles/:id", (req, res) => {
    // Cyber Security defense parameter validations
    const { companyName, registrationNumber, gstNumber, panNumber, annualTurnover, yearsOfExperience, employeeCount, categories, certifications, states, pastProjects } = req.body;

    if (companyName && (typeof companyName !== "string" || companyName.length > 255)) {
      return res.status(400).json({ error: "Invalid corporate companyName length limit exceeded" });
    }
    if (registrationNumber && (typeof registrationNumber !== "string" || registrationNumber.length > 100)) {
      return res.status(400).json({ error: "Invalid registrationNumber length limit exceeded" });
    }
    if (gstNumber && (typeof gstNumber !== "string" || gstNumber.length > 50)) {
      return res.status(400).json({ error: "Invalid gstNumber length limit exceeded" });
    }
    if (panNumber && (typeof panNumber !== "string" || panNumber.length > 50)) {
      return res.status(400).json({ error: "Invalid panNumber length limit exceeded" });
    }
    if (annualTurnover !== undefined && (typeof annualTurnover !== "number" || isNaN(annualTurnover) || annualTurnover < 0 || annualTurnover > 1000000)) {
      return res.status(400).json({ error: "Invalid annualTurnover numerical boundaries format" });
    }
    if (yearsOfExperience !== undefined && (typeof yearsOfExperience !== "number" || isNaN(yearsOfExperience) || yearsOfExperience < 0 || yearsOfExperience > 150)) {
      return res.status(400).json({ error: "Invalid yearsOfExperience numerical boundaries format" });
    }
    if (employeeCount !== undefined && (typeof employeeCount !== "number" || isNaN(employeeCount) || employeeCount < 0 || employeeCount > 1000000)) {
      return res.status(400).json({ error: "Invalid employeeCount numerical boundaries format" });
    }
    if (categories && (!Array.isArray(categories) || categories.some(c => typeof c !== "string" || c.length > 100))) {
      return res.status(400).json({ error: "Invalid categories format" });
    }
    if (certifications && (!Array.isArray(certifications) || certifications.some(c => typeof c !== "string" || c.length > 100))) {
      return res.status(400).json({ error: "Invalid certifications format" });
    }
    if (states && (!Array.isArray(states) || states.some(s => typeof s !== "string" || s.length > 100))) {
      return res.status(400).json({ error: "Invalid operating states format" });
    }
    if (pastProjects && !Array.isArray(pastProjects)) {
      return res.status(400).json({ error: "Invalid pastProjects catalog format" });
    }

    const idx = db.data.companyProfiles.findIndex((p) => p.id === req.params.id);
    if (idx !== -1) {
      db.data.companyProfiles[idx] = {
        ...db.data.companyProfiles[idx],
        ...req.body,
        updatedAt: new Date().toISOString(),
      };
      // Recalculate matches whenever target profile finishes saving!
      db.recalculateMatches(req.params.id);
      db.save();
      res.json(db.data.companyProfiles[idx]);
    } else {
      res.status(404).json({ error: "Profile not found" });
    }
  });

  userRouter.post("/api/profiles", (req, res) => {
    // Cyber Security defense parameter validations from body
    const { companyName, registrationNumber, gstNumber, panNumber, annualTurnover, yearsOfExperience, employeeCount, categories, certifications, states, pastProjects } = req.body;

    if (companyName && (typeof companyName !== "string" || companyName.length > 255)) {
      return res.status(400).json({ error: "Invalid corporate companyName length limit exceeded" });
    }
    if (registrationNumber && (typeof registrationNumber !== "string" || registrationNumber.length > 100)) {
      return res.status(400).json({ error: "Invalid registrationNumber length limit exceeded" });
    }
    if (gstNumber && (typeof gstNumber !== "string" || gstNumber.length > 50)) {
      return res.status(400).json({ error: "Invalid gstNumber length limit exceeded" });
    }
    if (panNumber && (typeof panNumber !== "string" || panNumber.length > 50)) {
      return res.status(400).json({ error: "Invalid panNumber length limit exceeded" });
    }
    if (annualTurnover !== undefined && (typeof annualTurnover !== "number" || isNaN(annualTurnover) || annualTurnover < 0 || annualTurnover > 1000000)) {
      return res.status(400).json({ error: "Invalid annualTurnover numerical boundaries format" });
    }
    if (yearsOfExperience !== undefined && (typeof yearsOfExperience !== "number" || isNaN(yearsOfExperience) || yearsOfExperience < 0 || yearsOfExperience > 150)) {
      return res.status(400).json({ error: "Invalid yearsOfExperience numerical boundaries format" });
    }
    if (employeeCount !== undefined && (typeof employeeCount !== "number" || isNaN(employeeCount) || employeeCount < 0 || employeeCount > 1000000)) {
      return res.status(400).json({ error: "Invalid employeeCount numerical boundaries format" });
    }
    if (categories && (!Array.isArray(categories) || categories.some(c => typeof c !== "string" || c.length > 100))) {
      return res.status(400).json({ error: "Invalid categories format" });
    }
    if (certifications && (!Array.isArray(certifications) || certifications.some(c => typeof c !== "string" || c.length > 100))) {
      return res.status(400).json({ error: "Invalid certifications format" });
    }
    if (states && (!Array.isArray(states) || states.some(s => typeof s !== "string" || s.length > 100))) {
      return res.status(400).json({ error: "Invalid operating states format" });
    }
    if (pastProjects && !Array.isArray(pastProjects)) {
      return res.status(400).json({ error: "Invalid pastProjects catalog format" });
    }

    const profile = {
      id: "cp-" + crypto.randomUUID(),
      userId: "u-1",
      companyName: companyName || "New Consulting Firm",
      registrationNumber: registrationNumber || "",
      gstNumber: gstNumber || "",
      panNumber: panNumber || "",
      annualTurnover: Number(annualTurnover) || 1.0,
      yearsOfExperience: Number(yearsOfExperience) || 2,
      categories: categories || ["Civil"],
      certifications: certifications || [],
      states: states || ["Bihar"],
      msmeRegistered: req.body.msmeRegistered === true,
      employeeCount: Number(employeeCount) || 5,
      pastProjects: pastProjects || [],
      isActive: true,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };
    db.data.companyProfiles.push(profile);
    db.recalculateMatches(profile.id);
    db.save();
    res.json(profile);
  });

  userRouter.delete("/api/profiles/:id", (req, res) => {
    const idx = db.data.companyProfiles.findIndex((p) => p.id === req.params.id);
    if (idx !== -1) {
      const deleted = db.data.companyProfiles.splice(idx, 1);
      db.save();
      res.json({ success: true, message: "Profile successfully deleted", deleted: deleted[0] });
    } else {
      res.status(404).json({ error: "Profile not found" });
    }
  });

  userRouter.get("/api/user/alert-matrix", (req, res) => {
    const user = resolveUser(req);
    if (!user) return res.status(401).json({ error: "Authentication required" });
    const targetUser = db.data.users.find(u => u.id === user.id);
    if (!targetUser) return res.status(404).json({ error: "User not found" });
    
    const defaultMatrix = {
      NEW_MATCH: { EMAIL: true, WHATSAPP: true, SMS: false, PUSH: true, IN_APP: true },
      DEADLINE_REMINDER: { EMAIL: true, WHATSAPP: true, SMS: true, PUSH: true, IN_APP: true },
      DOCUMENT_MISSING: { EMAIL: true, WHATSAPP: false, SMS: false, PUSH: true, IN_APP: true },
      SUBSCRIPTION_EVENT: { EMAIL: true, WHATSAPP: true, SMS: false, PUSH: true, IN_APP: true }
    };
    
    res.json(targetUser.alertMatrix || defaultMatrix);
  });

  userRouter.put("/api/user/alert-matrix", (req, res) => {
    const user = resolveUser(req);
    if (!user) return res.status(401).json({ error: "Authentication required" });
    const targetUser = db.data.users.find(u => u.id === user.id);
    if (!targetUser) return res.status(404).json({ error: "User not found" });
    
    targetUser.alertMatrix = req.body;
    db.save();
    res.json({ success: true, alertMatrix: targetUser.alertMatrix });
  });
