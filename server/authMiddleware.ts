import dotenv from "dotenv";
dotenv.config();
import jwt from "jsonwebtoken";
import bcryptjs from "bcryptjs";
import { Request, Response, NextFunction } from "express";
import { db } from "./db.js";
import { getPrismaClient } from "./prismaClient.js";

const JWT_SECRET = process.env.JWT_SECRET;
if (!JWT_SECRET) {
  throw new Error("FATAL: JWT_SECRET environment variable must be set");
}

// Helper function to resolve user of incoming request
export function resolveUser(req: Request) {
  const authHeader = req.headers.authorization;
  if (!authHeader) {
    return null;
  }
  const parts = authHeader.split(" ");
  if (parts.length !== 2 || parts[0] !== "Bearer") {
    return null;
  }
  try {
    const decoded = jwt.verify(parts[1], JWT_SECRET) as { userId: string; email: string; type?: string };
    if (decoded.type !== "access") {
      return null;
    }
    const user = db.data.users.find((u) => u.id === decoded.userId);
    return user || null;
  } catch (err) {
    return null;
  }
}

// Hashing Helpers
export async function hashPassword(password: string): Promise<string> {
  return bcryptjs.hash(password, 10);
}

export async function comparePassword(password: string, hash: string): Promise<boolean> {
  try {
    return await bcryptjs.compare(password, hash);
  } catch (err) {
    console.error("Cryptographic comparor error:", err);
    return false;
  }
}

// Token Helpers
export function generateToken(payload: { userId: string; email: string }): string {
  return jwt.sign({ ...payload, type: "access" }, JWT_SECRET, { expiresIn: "24h" });
}

export function generateAccessAndRefreshTokens(payload: { userId: string; email: string; role: string }) {
  const accessToken = jwt.sign({ ...payload, type: "access" }, JWT_SECRET, { expiresIn: "15m" });
  const refreshToken = jwt.sign({ userId: payload.userId, type: "refresh" }, JWT_SECRET, { expiresIn: "7d" });
  return { accessToken, refreshToken };
}

export interface AuthenticatedRequest extends Request {
  user?: {
    id: string;
    email: string;
    name: string;
    phone?: string | null;
    plan: "FREE" | "STARTER" | "PROFESSIONAL" | "ENTERPRISE";
    role: "ADMIN" | "USER" | "ORGANIZATION_ADMIN";
    emailVerified: boolean;
    organizationId?: string | null;
  };
}

export async function authenticateJWT(req: AuthenticatedRequest, res: Response, next: NextFunction) {
  const authHeader = req.headers.authorization;

  if (!authHeader) {
    return res.status(401).json({ error: "Access token is missing or unauthorized" });
  }

  const parts = authHeader.split(" ");
  if (parts.length !== 2 || parts[0] !== "Bearer") {
    return res.status(401).json({ error: "Invalid Authorization header format. Expected Bearer <token>" });
  }

  const token = parts[1];

  try {
    const decoded = jwt.verify(token, JWT_SECRET) as { userId: string; email: string; type?: string };
    if (decoded.type !== "access") {
      return res.status(401).json({ error: "Invalid token type. Expected access token" });
    }
    
    // First try database queries via Prisma Client
    const prisma = getPrismaClient();
    if (prisma) {
      try {
        const user = await prisma.user.findUnique({
          where: { id: decoded.userId },
          select: {
            id: true,
            email: true,
            name: true,
            phone: true,
            plan: true,
            role: true,
            emailVerified: true,
            organizationId: true,
          }
        });
        if (user) {
          req.user = {
            id: user.id,
            email: user.email,
            name: user.name,
            phone: user.phone,
            plan: user.plan as any,
            role: user.role as any,
            emailVerified: user.emailVerified,
            organizationId: user.organizationId,
          };
          return next();
        }
      } catch (err) {
        console.warn("Prisma failed to retrieve active user, falling back to JSON memory store:", err);
      }
    }

    // Fallback lookup in memory data pool
    const memUser = db.data.users.find((u) => u.id === decoded.userId);
    if (!memUser) {
      return res.status(401).json({ error: "User session not active or revoked" });
    }

    req.user = {
      id: memUser.id,
      email: memUser.email,
      name: memUser.name,
      phone: memUser.phone,
      plan: memUser.plan,
      role: memUser.role || "USER",
      emailVerified: memUser.emailVerified || false,
      organizationId: memUser.organizationId || null,
    };
    next();
  } catch (err) {
    console.error("JWT Authorization Check failed:", err);
    return res.status(401).json({ error: "Invalid token or expired signature" });
  }
}

export function requireRole(roles: Array<"ADMIN" | "USER" | "ORGANIZATION_ADMIN">) {
  return (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
    if (!req.user) {
      return res.status(401).json({ error: "Unauthorized. Authentication is required." });
    }
    if (!roles.includes(req.user.role)) {
      return res.status(403).json({ error: `Forbidden. Requires one of these roles: ${roles.join(", ")}` });
    }
    next();
  };
}
