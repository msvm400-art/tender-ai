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

export const vaultRouter = express.Router();

  // -----------------------------------------------------------------
  // API ENDPOINTS: DOCUMENT VAULT
  // -----------------------------------------------------------------
  // API ENDPOINTS: DOCUMENT VAULT (PHASE 7 — DOCUMENT MANAGEMENT SYSTEM)
  // -----------------------------------------------------------------
  vaultRouter.get("/api/vault", routeCache(10 * 1000), (req, res) => {
    const user = resolveUser(req);
    if (!user) return res.status(401).json({ error: "Authentication required" });
    const userDocs = db.data.documentVaults.filter((d) => d.userId === user.id);
    res.json(userDocs);
  });

  vaultRouter.post("/api/vault/upload", async (req, res) => {
    try {
      const user = resolveUser(req);
      if (!user) return res.status(401).json({ error: "Authentication required" });
      const { documentType, fileName, expiryDate, year, parentDocId } = req.body;
      
      // Perform security check and sanitization on uploaded filename parameters
      const { cleanName } = validateUploadedFile(fileName);
      const safeFileName = cleanName;

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
      }

      // Run AI Document Scan immediately (Simulates real OCR and Extracts Metadata)
      const scanResult = await analyzeAndOCRDocument(safeFileName, documentType || "OTHER");

      // Versioning check: Is this a new version of an existing document?
      if (parentDocId) {
        const existingDoc = db.data.documentVaults.find(
          (d) => d.id === parentDocId && d.userId === user.id
        );
        if (existingDoc) {
          // Archive previous active version into the historical version stack
          const prevVer = {
            versionNumber: existingDoc.currentVersion || 1,
            fileName: existingDoc.fileName,
            s3Url: existingDoc.s3Url,
            createdAt: existingDoc.updatedAt || existingDoc.createdAt || new Date().toISOString(),
            ocrText: existingDoc.ocrText || "",
            metadata: existingDoc.metadata || {}
          };
          if (!existingDoc.versions) existingDoc.versions = [];
          existingDoc.versions.push(prevVer);
          
          // Update primary fields with new upload and scan results
          existingDoc.fileName = safeFileName;
          existingDoc.s3Url = `https://tenderai-docs.s3.ap-south-1.amazonaws.com/${profile.id}/${safeFileName}`;
          existingDoc.ocrText = scanResult.ocrText;
          existingDoc.metadata = scanResult.metadata;
          existingDoc.aiSummary = scanResult.aiSummary;
          existingDoc.expiryDate = scanResult.expiryDate || existingDoc.expiryDate;
          existingDoc.year = scanResult.year || existingDoc.year;
          existingDoc.currentVersion = (existingDoc.currentVersion || 1) + 1;
          existingDoc.updatedAt = new Date().toISOString();

          // Performance clear route cache
          invalidateRouteCache(["/api/vault"]);

          recordAuditLog({
            userId: user.id,
            userEmail: user.email,
            action: "SECURE_FILE_VERSION",
            description: `Uploaded and scanned version ${existingDoc.currentVersion} of '${safeFileName}'`,
            status: "SUCCESS",
            ipAddress: (req.headers["x-forwarded-for"] as string) || req.socket.remoteAddress || "127.0.0.1"
          });

          db.save();
          return res.json(existingDoc);
        }
      }

      // If regular brand new document upload
      const newDocNode = {
        id: "dv-" + Math.random().toString(36).substring(3, 8),
        companyProfileId: profile.id,
        userId: user.id,
        documentType: scanResult.documentType || documentType || "OTHER",
        fileName: safeFileName,
        s3Url: `https://tenderai-docs.s3.ap-south-1.amazonaws.com/${profile.id}/${safeFileName}`,
        expiryDate: scanResult.expiryDate || expiryDate || null,
        isVerified: true,
        year: scanResult.year || (year ? Number(year) : null),
        currentVersion: 1,
        versions: [],
        ocrText: scanResult.ocrText,
        metadata: scanResult.metadata,
        aiSummary: scanResult.aiSummary,
        autoCategorized: true,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      };

      db.data.documentVaults.push(newDocNode);
      
      // Performance clear route cache
      invalidateRouteCache(["/api/vault"]);

      recordAuditLog({
        userId: user.id,
        userEmail: user.email,
        action: "SECURE_FILE_UPLOAD",
        description: `Uploaded and scanned brand new compliance document '${safeFileName}'`,
        status: "SUCCESS",
        ipAddress: (req.headers["x-forwarded-for"] as string) || req.socket.remoteAddress || "127.0.0.1"
      });

      db.save();
      res.json(newDocNode);
    } catch (err: any) {
      console.error("Failed to process document vault upload:", err);
      res.status(500).json({ error: err?.message || "Backend failure processing file upload." });
    }
  });

  // End Point: Query/Chat context about document
  vaultRouter.post("/api/vault/chat", async (req, res) => {
    try {
      const user = resolveUser(req);
      if (!user) return res.status(401).json({ error: "Authentication required" });
      const { documentId, message } = req.body;
      if (!documentId || !message) {
        return res.status(400).json({ error: "Missing documentId or chat message in request body" });
      }

      const docObj = db.data.documentVaults.find((d) => d.id === documentId && d.userId === user.id);
      if (!docObj) {
        return res.status(404).json({ error: "Document not found in your vault" });
      }

      const answer = await chatAboutDocument(
        docObj.fileName,
        docObj.ocrText || "",
        docObj.metadata || {},
        message
      );
      res.json({ answer });
    } catch (err) {
      console.error("AI Document Chat error:", err);
      res.status(500).json({ error: "Failed to communicate with AI Counsel." });
    }
  });

  // End Point: Trigger Manual AI Scan/Re-analyze
  vaultRouter.post("/api/vault/re-analyze/:id", async (req, res) => {
    try {
      const user = resolveUser(req);
      if (!user) return res.status(401).json({ error: "Authentication required" });
      const docObj = db.data.documentVaults.find((d) => d.id === req.params.id && d.userId === user.id);
      if (!docObj) {
        return res.status(404).json({ error: "Document not found" });
      }

      const scanResult = await analyzeAndOCRDocument(docObj.fileName, docObj.documentType);
      docObj.ocrText = scanResult.ocrText;
      docObj.metadata = scanResult.metadata;
      docObj.aiSummary = scanResult.aiSummary;
      docObj.expiryDate = scanResult.expiryDate || docObj.expiryDate;
      docObj.year = scanResult.year || docObj.year;
      docObj.updatedAt = new Date().toISOString();

      db.save();
      res.json(docObj);
    } catch (err) {
      console.error("Re-analysis backchannel failed:", err);
      res.status(500).json({ error: "Re-analysis failed." });
    }
  });

  // End Point: Swap active version with historical version (Restore Version)
  vaultRouter.post("/api/vault/restore-version", (req, res) => {
    const user = resolveUser(req);
    if (!user) return res.status(401).json({ error: "Authentication required" });
    const { documentId, versionNumber } = req.body;

    const docObj = db.data.documentVaults.find((d) => d.id === documentId && d.userId === user.id);
    if (!docObj) {
      return res.status(404).json({ error: "Document node not found." });
    }

    if (!docObj.versions || docObj.versions.length === 0) {
      return res.status(400).json({ error: "This document has no historical versions." });
    }

    const versionIdx = docObj.versions.findIndex((v) => v.versionNumber === versionNumber);
    if (versionIdx === -1) {
      return res.status(404).json({ error: "Specified version history not found." });
    }

    const versionToRestore = docObj.versions[versionIdx];

    // Preserve current state as a historical option
    const backupCurrent = {
      versionNumber: docObj.currentVersion || 1,
      fileName: docObj.fileName,
      s3Url: docObj.s3Url,
      createdAt: docObj.updatedAt || docObj.createdAt || new Date().toISOString(),
      ocrText: docObj.ocrText || "",
      metadata: docObj.metadata || {}
    };

    // Swap
    docObj.fileName = versionToRestore.fileName;
    docObj.s3Url = versionToRestore.s3Url;
    docObj.ocrText = versionToRestore.ocrText || "";
    docObj.metadata = versionToRestore.metadata || {};
    docObj.updatedAt = new Date().toISOString();

    // Replace version stack index with the backed up old active version
    docObj.versions[versionIdx] = backupCurrent;

    db.save();
    res.json(docObj);
  });

  vaultRouter.delete("/api/vault/:id", (req, res) => {
    const user = resolveUser(req);
    if (!user) return res.status(401).json({ error: "Authentication required" });
    const vaultItem = db.data.documentVaults.find(d => d.id === req.params.id);
    if (!vaultItem) return res.status(404).json({ error: "Document not found" });
    if (vaultItem.userId !== user.id) return res.status(403).json({ error: "Forbidden" });
    
    db.data.documentVaults = db.data.documentVaults.filter((d) => d.id !== req.params.id);
    db.save();
    res.json({ success: true });
  });

  vaultRouter.get("/api/vault/presigned/:id", (req, res) => {
    const file = db.data.documentVaults.find((d) => d.id === req.params.id);
    if (!file) return res.status(404).json({ error: "File not found" });
    res.json({ presignedUrl: file.s3Url });
  });
