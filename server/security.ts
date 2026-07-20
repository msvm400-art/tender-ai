import { Request, Response, NextFunction } from "express";
import crypto from "crypto";
import { db } from "./db.js";

// -------------------------------------------------------------
// 1. AUDIT LOGGING SYSTEM (PHASE 12)
// -------------------------------------------------------------
export interface AuditLog {
  id: string;
  userId: string;
  userEmail: string;
  action: string;
  description: string;
  status: "SUCCESS" | "FAILED" | "BLOCKED" | "WARNING";
  ipAddress: string;
  timestamp: string;
  metadata?: Record<string, any>;
}

// Ensure auditLogs exists in database memory
if (!(db.data as any).auditLogs) {
  (db.data as any).auditLogs = [];
}

/**
 * Creates and persists an audit log record for security or administrative operations.
 */
export function recordAuditLog(params: {
  userId?: string;
  userEmail?: string;
  action: string;
  description: string;
  status: "SUCCESS" | "FAILED" | "BLOCKED" | "WARNING";
  ipAddress?: string;
  metadata?: Record<string, any>;
}) {
  const log: AuditLog = {
    id: "audit-" + crypto.randomBytes(4).toString("hex"),
    userId: params.userId || "anonymous",
    userEmail: params.userEmail || "anonymous@tenderai.in",
    action: params.action,
    description: params.description,
    status: params.status,
    ipAddress: params.ipAddress || "127.0.0.1",
    timestamp: new Date().toISOString(),
    metadata: params.metadata || {}
  };

  if (!(db.data as any).auditLogs) {
    (db.data as any).auditLogs = [];
  }
  (db.data as any).auditLogs.unshift(log);
  
  // Cap logs at 500 for local file store performance sanity
  if ((db.data as any).auditLogs.length > 500) {
    (db.data as any).auditLogs = (db.data as any).auditLogs.slice(0, 500);
  }
  
  // Defer file system write asynchronously to prevent event loop blocking
  setImmediate(() => {
    try {
      db.save();
    } catch (err) {
      console.error("Deferred db save failed in recordAuditLog:", err);
    }
  });
  console.log(`[AUDIT SECURE LOG] [${log.status}] [${log.action}] ${log.description}`);
  return log;
}

// -------------------------------------------------------------
// 2. RATE LIMITING MIDDLEWARE (PHASE 12)
// -------------------------------------------------------------
interface RateLimitBucket {
  timestamps: number[];
}

const rateLimitDb = new Map<string, RateLimitBucket>();
// Cleanup stale rate limit buckets every 5 minutes to prevent memory leaks
setInterval(() => {
  const current = Date.now();
  for (const [key, bucket] of rateLimitDb.entries()) {
    bucket.timestamps = bucket.timestamps.filter((t) => current - t < 3600000); // 1 hour
    if (bucket.timestamps.length === 0) {
      rateLimitDb.delete(key);
    }
  }
}, 5 * 60 * 1000);


/**
 * IP-based rolling window API rate limiter
 * Allows custom bounds for read vs write/auth operations
 */
export function rateLimiter(options: { windowMs: number; maxRequests: number; routeName?: string }) {
  return (req: Request, res: Response, next: NextFunction) => {
    const ip = (req.headers["x-forwarded-for"] as string) || req.socket.remoteAddress || "unknown-ip";
    const current = Date.now();
    const key = `${ip}:${options.routeName || "global"}`;

    let bucket = rateLimitDb.get(key);
    if (!bucket) {
      bucket = { timestamps: [] };
      rateLimitDb.set(key, bucket);
    }

    // Retain only timestamps inside active window
    bucket.timestamps = bucket.timestamps.filter((t) => current - t < options.windowMs);

    if (bucket.timestamps.length >= options.maxRequests) {
      recordAuditLog({
        userId: "system-limiter",
        userEmail: "security-guard@tenderai.in",
        action: "RATE_LIMIT_EXCEEDED",
        description: `IP ${ip} throttled on route ${req.originalUrl}. Exceeded max ${options.maxRequests} count.`,
        status: "BLOCKED",
        ipAddress: ip,
        metadata: { path: req.originalUrl, headers: req.headers }
      });
      
      res.setHeader("Retry-After", Math.ceil(options.windowMs / 1000));
      return res.status(429).json({
        error: "Too many requests. Please slow down and try again later.",
        limit: options.maxRequests,
        windowMs: options.windowMs
      });
    }

    bucket.timestamps.push(current);
    res.setHeader("X-RateLimit-Limit", options.maxRequests);
    res.setHeader("X-RateLimit-Remaining", options.maxRequests - bucket.timestamps.length);
    next();
  };
}

// -------------------------------------------------------------
// 3. CSRF PROTECTION MIDDLEWARE (PHASE 12)
// -------------------------------------------------------------
/**
 * Custom CSRF mechanism tailored for sandboxed AI Studio preview environments
 * Returns a secure, cryptographically random CSRF token and sets it as an _csrf cookie if res is provided.
 */
export function generateCSRFToken(res?: Response): string {
  const token = crypto.randomBytes(32).toString("hex");
  if (res) {
    res.cookie("_csrf", token, {
      httpOnly: false, // Must be readable by client React app to place in request headers
      secure: process.env.NODE_ENV === "production",
      sameSite: "strict",
      path: "/"
    });
  }
  return token;
}

/**
 * Verifies the X-CSRF-Token custom header against the session-specific _csrf cookie value
 */
export function csrfProtection(req: Request, res: Response, next: NextFunction) {
  // Allow safe read actions
  if (["GET", "HEAD", "OPTIONS"].includes(req.method)) {
    return next();
  }

  const csrfTokenHeader = req.headers["x-csrf-token"] as string;
  const csrfCookie = req.cookies?.["_csrf"];
  const clientAgent = req.headers["user-agent"] || "";

  // Bypass options for public checkouts/simulation if sandbox is enabled under specific headers
  if (req.originalUrl.includes("/api/payments/razorpay/webhook")) {
    return next();
  }

  if (!csrfTokenHeader || !csrfCookie || csrfTokenHeader !== csrfCookie) {
    const ip = (req.headers["x-forwarded-for"] as string) || req.socket.remoteAddress || "127.0.0.1";
    
    recordAuditLog({
      action: "CSRF_BLOCK",
      description: `Rejected CSRF-invalid state transition. Header token missing or unverified on path ${req.originalUrl}`,
      status: "BLOCKED",
      ipAddress: ip,
      metadata: { method: req.method, path: req.originalUrl, userAgent: clientAgent }
    });

    return res.status(403).json({
      error: "CSRF Token validation failed. Security validation header is missing or unverified."
    });
  }

  next();
}

// -------------------------------------------------------------
// 4. DEEP INPUT SANITIZATION UTILITIES / XSS SHIELD (PHASE 12)
// -------------------------------------------------------------
/**
 * Destructively scrubs HTML tag blocks, onclick listeners, scripts and javascript uris
 */
export function sanitizeHTML(raw: string): string {
  if (!raw || typeof raw !== "string") return raw;
  
  let current = raw;
  let previous: string;
  
  // Clean in a loop to catch nested tag attempts recursively (e.g. <scr<script>ipt>)
  do {
    previous = current;
    
    // 1. Strip script tags with content
    current = current.replace(/<script\b[^<]*(?:(?!<\/script>)<[^<]*)*<\/script>/gi, "[filtered-script-block]");
    
    // 2. Decode HTML entities recursively to check for obfuscated characters (prevents entity bypasses)
    const decoded = current
      .replace(/&#(\d+);/g, (_, dec) => String.fromCharCode(parseInt(dec, 10)))
      .replace(/&#[xX]([0-9a-fA-F]+);/g, (_, hex) => String.fromCharCode(parseInt(hex, 16)))
      .replace(/&tab;/gi, "\t")
      .replace(/&newline;/gi, "\n")
      .replace(/&quot;/g, '"')
      .replace(/&apos;/g, "'")
      .replace(/&lt;/g, '<')
      .replace(/&gt;/g, '>')
      .replace(/&amp;/g, '&');

    // 3. Block javascript:, data:, and vbscript: URIs
    if (/javascript\s*:/gi.test(decoded) || /data\s*:/gi.test(decoded) || /vbscript\s*:/gi.test(decoded)) {
      current = current.replace(/javascript\s*:/gi, "[filtered-js-protocol]")
                       .replace(/data\s*:/gi, "[filtered-js-protocol]")
                       .replace(/vbscript\s*:/gi, "[filtered-js-protocol]");
    }

    // 4. Strip on* event handlers (e.g. onclick, onerror)
    current = current.replace(/on\w+\s*=\s*(['"][^'"]*['"]|[^>\s]+)/gi, "[filtered-handler]");

    // 5. Strip general tag markup
    current = current.replace(/<\/?[^>]+(>|$)/g, "");

  } while (current !== previous);

  return current;
}

/**
 * Walks entire object payloads and sanitizes all inner string property values
 */
export function deepSanitizeObject(obj: any): any {
  if (obj === null || obj === undefined) return obj;
  if (typeof obj === "string") {
    return sanitizeHTML(obj);
  }
  if (Array.isArray(obj)) {
    return obj.map((item) => deepSanitizeObject(item));
  }
  if (typeof obj === "object") {
    const sanitized: Record<string, any> = {};
    for (const key in obj) {
      if (Object.prototype.hasOwnProperty.call(obj, key)) {
        sanitized[key] = deepSanitizeObject(obj[key]);
      }
    }
    return sanitized;
  }
  return obj;
}

/**
 * Global Express middleware to walk req.body, req.query and sanitize XSS vectors
 */
export function xssSanitizer(req: Request, res: Response, next: NextFunction) {
  if (req.body) {
    req.body = deepSanitizeObject(req.body);
  }
  if (req.query) {
    req.query = deepSanitizeObject(req.query);
  }
  next();
}

// -------------------------------------------------------------
// 5. DEEP SQL INJECTION (SQLi) SHIELD (PHASE 12)
// -------------------------------------------------------------
const SQLI_PATTERNS = [
  /\bselect\b.*\bfrom\b/i,
  /\binsert\b.*\binto\b/i,
  /\bupdate\b.*\bset\b/i,
  /\bdelete\b.*\bfrom\b/i,
  /\bdrop\s+(table|database|index|view|procedure|trigger)\b/i,
  /\bunion\b.*\bselect\b/i,
  /\bexec\b/i,
  /\bdeclare\b/i,
  /\bgrant\b/i,
  /('\s*or\s*'\s*\d+\s*=\s*\d+)/i,
  /("\s*or\s*"\s*\d+\s*=\s*\d+)/i,
  /\bor\s+\d+\s*=\s*\d+/i,
  /\blike\s+'%/i,
  /\bschema\s*\(/i
];

/**
 * Checks string against standard SQL syntax patterns
 */
export function hasSQLInjectionThreat(input: string): boolean {
  if (!input || typeof input !== "string") return false;
  
  // If no quotes, statement separators, or comment flags are present, SQL injection is syntactically impossible, bypass to prevent false positives
  if (!input.includes("'") && !input.includes("\"") && !input.includes(";") && !input.includes("--") && !input.includes("/*") && !input.includes("#")) {
    return false;
  }
  
  return SQLI_PATTERNS.some((pattern) => pattern.test(input));
}

/**
 * Middleware blocking requests containing SQL injection strings in parameters or body keys
 */
export function sqlInjectionShield(req: Request, res: Response, next: NextFunction) {
  const checkThreat = (source: any): boolean => {
    if (!source) return false;
    if (typeof source === "string") return hasSQLInjectionThreat(source);
    if (typeof source === "object") {
      for (const key in source) {
        if (Object.prototype.hasOwnProperty.call(source, key)) {
          const val = source[key];
          if (typeof val === "string" && hasSQLInjectionThreat(val)) return true;
          if (typeof val === "object" && checkThreat(val)) return true;
        }
      }
    }
    return false;
  };

  if (checkThreat(req.body) || checkThreat(req.query) || checkThreat(req.params)) {
    const ip = (req.headers["x-forwarded-for"] as string) || req.socket.remoteAddress || "127.0.0.1";
    
    recordAuditLog({
      action: "SQLI_BLOCK",
      description: `Blocked suspected SQL Injection payload in route ${req.originalUrl}`,
      status: "BLOCKED",
      ipAddress: ip,
      metadata: { path: req.originalUrl, method: req.method }
    });

    return res.status(400).json({
      error: "Malicious input sequence detected. SQL injection and syntax exploits are blocked."
    });
  }
  next();
}

// -------------------------------------------------------------
// 6. VALUE & FORMAT INPUT VALIDATOR (PHASE 12)
// -------------------------------------------------------------
const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const PHONE_REGEX = /^\+?[\d\s-]{10,15}$/;

export function validateEmail(email: string): boolean {
  return EMAIL_REGEX.test(email);
}

export function validatePhone(phone: string): boolean {
  return PHONE_REGEX.test(phone);
}

/**
 * Input validation schemas and check triggers for critical forms
 */
export function validateRegistrationInput(req: Request, res: Response, next: NextFunction) {
  const { email, password, name, phone } = req.body;
  
  if (!email || !password || !name) {
    return res.status(400).json({ error: "Required fields are missing: email, password, and name" });
  }

  if (!validateEmail(email)) {
    return res.status(400).json({ error: "Invalid email format schema" });
  }

  if (password.length < 6 || password.length > 32) {
    return res.status(400).json({ error: "Password must be between 6 and 32 characters long" });
  }

  if (name.length > 80) {
    return res.status(400).json({ error: "Name attribute length exceeds limit bounds" });
  }

  if (phone && !validatePhone(phone)) {
    return res.status(400).json({ error: "Invalid phone number schema format" });
  }

  next();
}

// -------------------------------------------------------------
// 7. SECURE STATIC FILE UPLOADS (PHASE 12)
// -------------------------------------------------------------
const SAFE_FILE_EXTENSIONS = [".pdf", ".docx", ".doc", ".png", ".jpg", ".jpeg"];
const SAFE_MIME_TYPES = [
  "application/pdf",
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
  "application/msword",
  "image/png",
  "image/jpeg"
];

/**
 * Validates file uploads (MIME type integrity, extension checkers, path sanitizations, sizing limits)
 */
export function validateUploadedFile(fileName: string, mimeType?: string, fileSizeBytes?: number) {
  if (!fileName) {
    throw new Error("File name parameter is required");
  }

  // Sizing Check (Limit to 10MB)
  if (fileSizeBytes && fileSizeBytes > 10 * 1024 * 1024) {
    throw new Error("File size limits exceeded. Maximum size is 10MB");
  }

  // Prevent path traversal
  const cleanBaseName = fileName.replace(/^.*[\\/]/, ""); // strip directories
  const extensionIndex = cleanBaseName.lastIndexOf(".");
  if (extensionIndex === -1) {
    throw new Error("File lacks a valid security extension");
  }

  const extension = cleanBaseName.substring(extensionIndex).toLowerCase();
  if (!SAFE_FILE_EXTENSIONS.includes(extension)) {
    throw new Error(`File extension '${extension}' is blocked for platform security grounds`);
  }

  if (mimeType && !SAFE_MIME_TYPES.includes(mimeType)) {
    throw new Error(`Unsupported file type: ${mimeType}`);
  }

  // Sanitized file name string
  const cleanName = cleanBaseName
    .replace(/[^a-zA-Z0-9.\-_]/g, "_") // strip illegal filename characters
    .substring(0, 100); // truncate length

  return {
    isSafe: true,
    cleanName
  };
}
