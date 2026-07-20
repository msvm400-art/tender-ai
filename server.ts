import express from "express";
import path from "path";
import { createServer as createViteServer } from "vite";
import dotenv from "dotenv";
import cookieParser from "cookie-parser";
import { Server as SocketIOServer } from "socket.io";
import crypto from "crypto";

// Import local services
import { db } from "./server/db.js";
import { ingestionService } from "./server/ingestion.service.js";
import { searchEngine } from "./server/search.service.js";
import {
  getGeminiAI,
  summarizeTender,
  analyzeEligibility,
  askTenderQuestion,
  generateBidDoc,
  generateSmartBidDraft,
  summarizeProcurementDocument,
  draftConsortiumAgreement,
  analyzeAndOCRDocument,
  chatAboutDocument,
} from "./server/ai.service.js";

import { authRouter } from "./server/routes/auth.routes.js";
import { userRouter } from "./server/routes/user.routes.js";
import { tendersRouter } from "./server/routes/tenders.routes.js";
import { bidsRouter } from "./server/routes/bids.routes.js";
import { vaultRouter } from "./server/routes/vault.routes.js";
import { systemRouter } from "./server/routes/system.routes.js";
import {
  authenticateJWT,
  hashPassword,
  comparePassword,
  generateToken,
  generateAccessAndRefreshTokens,
  requireRole,
  AuthenticatedRequest,
} from "./server/authMiddleware.js";
import { getPrismaClient } from "./server/prismaClient.js";
import {
  rateLimiter,
  csrfProtection,
  generateCSRFToken,
  xssSanitizer,
  sqlInjectionShield,
  recordAuditLog,
  validateUploadedFile,
  validateRegistrationInput
} from "./server/security.js";
import {
  routeCache,
  invalidateRouteCache,
  executeBackgroundJob
} from "./server/performance.js";
import {
  executeDurableBackup,
  getBackupHistory
} from "./server/backupService.js";

// Load env variables
dotenv.config();

import jwt from "jsonwebtoken";

const JWT_SECRET = process.env.JWT_SECRET;
if (!JWT_SECRET) {
  throw new Error("FATAL: JWT_SECRET environment variable must be set");
}


const PORT = 3000;

async function startServer() {
  const app = express();
  app.use(express.json({ limit: "1mb" }));
  app.use(cookieParser());
  app.use(express.urlencoded({ extended: true, limit: "1mb" }));
  let ioServerInstance: any = null;

  // Secure HTTP Defense Headers (OWASP Security Guidance)
  app.use((req, res, next) => {
    res.setHeader("X-Frame-Options", "SAMEORIGIN");
    res.setHeader("X-Content-Type-Options", "nosniff");
    res.setHeader("X-XSS-Protection", "0");
    res.setHeader("Strict-Transport-Security", "max-age=31536000; includeSubDomains");
    res.setHeader("Referrer-Policy", "strict-origin-when-cross-origin");
    // Secure Content-Security-Policy supporting local sandboxes in AI Studio
    res.setHeader(
      "Content-Security-Policy",
      "default-src 'self' https:; script-src 'self' 'unsafe-inline'; style-src 'self' 'unsafe-inline' https://fonts.googleapis.com; font-src 'self' https://fonts.gstatic.com data:; img-src 'self' data: https:; connect-src 'self' ws: wss: https:;"
    );
    next();
  });

  // Global Inputs Sanitization Against XSS
  app.use(xssSanitizer);

  function validateProfileInput(req, res, next) {
  const {
    companyName,
    registrationNumber,
    gstNumber,
    panNumber,
    annualTurnover,
    yearsOfExperience,
    categories,
    certifications,
    states,
    employeeCount
  } = req.body;

  if (!companyName || !registrationNumber || !gstNumber || !panNumber) {
    return res.status(400).json({ error: 'Missing required basic company information fields' });
  }

  if (typeof annualTurnover !== 'number' || typeof yearsOfExperience !== 'number' || typeof employeeCount !== 'number') {
    return res.status(400).json({ error: 'Turnover, experience, and employee count must be numbers' });
  }

  if (!Array.isArray(categories) || !Array.isArray(certifications) || !Array.isArray(states)) {
    return res.status(400).json({ error: 'Categories, certifications, and states must be valid arrays' });
  }
  
  next();
}

  // Global SQL Injection (SQLi) Defense Shield
  app.use(sqlInjectionShield);

  // Global CSRF Protection Middleware
  app.use(csrfProtection);

  // Global IP Rate Limiter
  app.use(rateLimiter({ windowMs: 60 * 1000, maxRequests: 200, routeName: "global" }));

app.use(authRouter);
app.use(userRouter);
app.use(tendersRouter);
app.use(bidsRouter);
app.use(vaultRouter);
app.use(systemRouter);

  // -----------------------------------------------------------------
  // MASTER CLIENT ROUTER MIDDLEWARE
  // -----------------------------------------------------------------
  if (process.env.NODE_ENV !== "production") {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: "spa",
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.join(process.cwd(), "dist");
    app.use(express.static(distPath));
    app.get("*", (req, res) => {
      res.sendFile(path.join(distPath, "index.html"));
    });
  }

  // Listen on standard AI Studio Port 3000
  const server = app.listen(PORT, "0.0.0.0", () => {
    console.log(`[TenderAI Server] Running on http://localhost:${PORT}`);
    // Initialize search engine fast indexing for all tenders
    try {
      searchEngine.indexTenders(db.data.tenders);
    } catch (err) {
      console.error("Failed to build search index:", err);
    }
  });

  // Socket.IO setup
  const io = new SocketIOServer(server, {
    cors: {
      origin: process.env.ALLOWED_ORIGINS ? process.env.ALLOWED_ORIGINS.split(",") : ["http://localhost:3000"],
      methods: ["GET", "POST"]
    }
  });
  ioServerInstance = io;

  // Function to create, persist, and emit the alert
  function handleSimulatedAlert(requestedType?: "NEW_MATCH" | "DEADLINE_REMINDER") {
    const type = requestedType || (Math.random() > 0.5 ? "NEW_MATCH" : "DEADLINE_REMINDER");
    let message = "";
    let tenderId = "";

    if (type === "NEW_MATCH") {
      const mathScore = Math.floor(Math.random() * 20) + 80; // 80 - 100
      const projects = [
        { title: "Solar Rooftop Power Plants in Gaya Subdivisions", id: "t-2" },
        { title: "Sewerage Reinforcement & Excavation in Noida Sector 62", id: "t-3" },
        { title: "Construction of Academic Block and Hostel Building at IIT Patna", id: "t-1" }
      ];
      const selectedProj = projects[Math.floor(Math.random() * projects.length)];
      message = `New high compatibility tender match generated! (${mathScore}% Match Score) for "${selectedProj.title}". Check details in criteria workspace.`;
      tenderId = selectedProj.id;
    } else {
      const days = Math.floor(Math.random() * 5) + 2; // 2 - 6 days
      const projects = [
        { title: "IIT Patna Academic Block G+4 Complex Structure", id: "t-1" },
        { title: "BREDA Commissioning SPV 200kW Bettiah Solar Grid", id: "t-2" },
        { title: "Hajipur-Mahua Roadway Section Bid Submission", id: "t-3" }
      ];
      const selectedProj = projects[Math.floor(Math.random() * projects.length)];
      message = `Approaching Deadline: Bid submission for "${selectedProj.title}" closes in ${days} days! Ensure all EMD documents are ready.`;
      tenderId = selectedProj.id;
    }

    const newAlert = {
      id: "al-" + Math.random().toString(36).substring(3, 8),
      userId: "u-1",
      tenderId,
      type,
      channel: "IN_APP" as const,
      message,
      isRead: false,
      sentAt: new Date().toISOString(),
      createdAt: new Date().toISOString(),
    };

    // Save to database
    db.data.alerts.unshift(newAlert);
    db.save();

    // Broadcast update to sockets
    io.emit("tender_alert", newAlert);
    console.log(`[TenderAI Socket] Tender Alert emitted: ${newAlert.id}`);
  }

  io.on("connection", (socket) => {
    console.log(`[TenderAI Socket] Client connected: ${socket.id}`);

    // Allow client to request a manual mock alert for testing
    socket.on("simulate_alert", (data) => {
      handleSimulatedAlert(data?.type);
    });

    socket.on("disconnect", () => {
      console.log(`[TenderAI Socket] Client disconnected: ${socket.id}`);
    });
  });

  // Setup periodic simulator timers to demonstrate this feature live
  // First simulation alert triggers 10 seconds after server start
  if (process.env.NODE_ENV !== "production") {
    setTimeout(() => {
      handleSimulatedAlert("NEW_MATCH");
    }, 10000);
  }

  // Subsequent simulated alerts trigger every 45 seconds to keep it fresh without overloading
  if (process.env.NODE_ENV !== "production") {
    setInterval(() => {
      handleSimulatedAlert();
    }, 45000);
  }
}

startServer();
