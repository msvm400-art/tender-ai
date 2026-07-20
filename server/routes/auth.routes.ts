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

export const authRouter = express.Router();

  // -----------------------------------------------------------------
  // API ENDPOINTS: AUTH (PHASE 3 COMPLETE SPEC)
  // -----------------------------------------------------------------
  
  // LOGIN ENDPOINT (Supports Role retrieval, verification status, and dual tokens)
  authRouter.post("/api/auth/login", async (req, res) => {
    try {
      const { email, password } = req.body;
      if (!email || !password) {
        return res.status(400).json({ error: "Email and password are required fields" });
      }

      let user: any = null;
      const prisma = getPrismaClient();

      if (prisma) {
        try {
          user = await prisma.user.findUnique({ where: { email } });
        } catch (err) {
          console.warn("Prisma user findUnique checked, reverting to memory DB lookup:", err);
        }
      }

      if (!user) {
        user = db.data.users.find((u) => u.email.toLowerCase() === email.toLowerCase());
      }

      if (!user) {
        recordAuditLog({
          action: "USER_LOGIN_FAILED",
          description: `Authentication failed: email ${email} not found`,
          status: "FAILED",
          ipAddress: (req.headers["x-forwarded-for"] as string) || req.socket.remoteAddress || "127.0.0.1"
        });
        return res.status(401).json({ error: "Invalid email or credentials" });
      }

      const isValid = await comparePassword(password, user.passwordHash);
      if (!isValid) {
        recordAuditLog({
          userId: user.id,
          userEmail: user.email,
          action: "USER_LOGIN_FAILED",
          description: `Authentication failed: incorrect credentials for email ${email}`,
          status: "FAILED",
          ipAddress: (req.headers["x-forwarded-for"] as string) || req.socket.remoteAddress || "127.0.0.1"
        });
        return res.status(401).json({ error: "Invalid email or credentials" });
      }

      // Generate both access and refresh tokens
      const { accessToken, refreshToken } = generateAccessAndRefreshTokens({
        userId: user.id,
        email: user.email,
        role: user.role || "USER"
      });

      // Update refresh token in DB for active session tracking
      user.refreshToken = refreshToken;
      if (prisma) {
        try {
          await prisma.user.update({
            where: { id: user.id },
            data: { refreshToken }
          });
        } catch (e) {
          console.warn("Could not save refresh token to Prisma database:", e);
        }
      }
      db.save();

      // Set cookie for refresh token session management
      res.cookie("refreshToken", refreshToken, {
        httpOnly: true,
        secure: process.env.NODE_ENV === "production",
        sameSite: "strict",
        maxAge: 7 * 24 * 60 * 60 * 1000 // 7 days
      });

      const csrfToken = generateCSRFToken(res);

      recordAuditLog({
        userId: user.id,
        userEmail: user.email,
        action: "USER_LOGIN_SUCCESS",
        description: `User successfully logged in and generated session token`,
        status: "SUCCESS",
        ipAddress: (req.headers["x-forwarded-for"] as string) || req.socket.remoteAddress || "127.0.0.1"
      });

      res.json({
        token: accessToken, // backward compatibility with client
        accessToken,
        refreshToken,
        csrfToken,
        user: {
          id: user.id,
          email: user.email,
          name: user.name,
          phone: user.phone,
          plan: user.plan,
          role: user.role || "USER",
          emailVerified: user.emailVerified || false,
          organizationId: user.organizationId || null
        }
      });
    } catch (err) {
      console.error("Login route failed:", err);
      res.status(500).json({ error: "Internal server error" });
    }
  });

  // REGISTER ENDPOINT (Supports standard signups with verification token generation)
  authRouter.post("/api/auth/register", validateRegistrationInput, async (req, res) => {
    try {
      const { email, name, password, phone, role, organizationId } = req.body;
      if (!email || !password || !name) {
        return res.status(400).json({ error: "Required fields: email, name, password values are missing" });
      }

      let existingUser = null;
      const prisma = getPrismaClient();

      if (prisma) {
        try {
          existingUser = await prisma.user.findUnique({ where: { email } });
        } catch (err) {
          console.warn("Prisma duplicate email checked, local db lookup follows:", err);
        }
      }

      if (!existingUser) {
        existingUser = db.data.users.find((u) => u.email.toLowerCase() === email.toLowerCase());
      }

      if (existingUser) {
        return res.status(400).json({ error: "Email already registered on system" });
      }

      const hashedPassword = await hashPassword(password);
      const newUserId = "u-" + crypto.randomUUID();
      const verificationToken = crypto.randomBytes(32).toString("hex");

      const newUserPayload = {
        id: newUserId,
        email,
        passwordHash: hashedPassword,
        name,
        phone: phone || "",
        plan: "STARTER" as const,
        role: (role === "ADMIN" || role === "ORGANIZATION_ADMIN" ? role : "USER") as any,
        emailVerified: false,
        verificationToken,
        resetPasswordToken: null,
        resetPasswordExpires: null,
        refreshToken: null,
        organizationId: organizationId || null,
      };

      let createdUser = null;
      if (prisma) {
        try {
          createdUser = await prisma.user.create({
            data: {
              id: newUserPayload.id,
              email: newUserPayload.email,
              passwordHash: newUserPayload.passwordHash,
              name: newUserPayload.name,
              phone: newUserPayload.phone,
              plan: "STARTER",
              role: newUserPayload.role,
              emailVerified: false,
              verificationToken: newUserPayload.verificationToken,
              organizationId: newUserPayload.organizationId
            },
            select: {
              id: true,
              email: true,
              name: true,
              phone: true,
              plan: true,
              role: true,
              emailVerified: true,
              organizationId: true
            }
          });
        } catch (err) {
          console.error("Prisma user creation failure:", err);
        }
      }

      const savedUser = {
        ...newUserPayload,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      };
      db.data.users.push(savedUser);
      db.save();

      console.log(`[AUTH SERVICE] Verification email simulated or dispatched to ${email}: code=${verificationToken}`);

      const userResponse = createdUser || {
        id: savedUser.id,
        email: savedUser.email,
        name: savedUser.name,
        phone: savedUser.phone,
        plan: savedUser.plan,
        role: savedUser.role,
        emailVerified: savedUser.emailVerified,
        organizationId: savedUser.organizationId
      };

      const { accessToken, refreshToken } = generateAccessAndRefreshTokens({
        userId: userResponse.id,
        email: userResponse.email,
        role: userResponse.role
      });

      // Update refresh token
      const inMem = db.data.users.find(u => u.id === userResponse.id);
      if (inMem) inMem.refreshToken = refreshToken;
      db.save();

      const csrfToken = generateCSRFToken(res);

      recordAuditLog({
        userId: userResponse.id,
        userEmail: userResponse.email,
        action: "USER_REGISTERED",
        description: `User ${userResponse.name} successfully registered a new profile`,
        status: "SUCCESS",
        ipAddress: (req.headers["x-forwarded-for"] as string) || req.socket.remoteAddress || "127.0.0.1"
      });

      res.status(201).json({
        token: accessToken,
        accessToken,
        refreshToken,
        csrfToken,
        user: userResponse,
        message: "Registration successful! A simulated verification link has been generated."
      });
    } catch (err) {
      console.error("Register endpoint failed:", err);
      res.status(500).json({ error: "Internal server error" });
    }
  });

  // EMAIL VERIFICATION ENDPOINT
  authRouter.post("/api/auth/verify-email", async (req, res) => {
    try {
      const { token } = req.body;
      if (!token) {
        return res.status(400).json({ error: "Verification token is required" });
      }

      const user = db.data.users.find(u => u.verificationToken === token);
      if (!user) {
        return res.status(400).json({ error: "Invalid or expired verification token." });
      }

      user.emailVerified = true;
      user.verificationToken = null;

      const prisma = getPrismaClient();
      if (prisma) {
        try {
          await prisma.user.update({
            where: { id: user.id },
            data: {
              emailVerified: true,
              verificationToken: null
            }
          });
        } catch (e) {
          console.warn("Could not sync verification to Prisma database:", e);
        }
      }
      db.save();

      res.json({ success: true, message: "Your email has been successfully verified! You may continue using TenderAI." });
    } catch (err) {
      console.error("Email verification failed:", err);
      res.status(500).json({ error: "Internal server error" });
    }
  });

  // RESEND EMAIL VERIFICATION TO END-USER
  authRouter.post("/api/auth/resend-verification", async (req, res) => {
    try {
      const { email } = req.body;
      if (!email) {
        return res.status(400).json({ error: "Email is required to dispatch verification linkage." });
      }

      const user = db.data.users.find(u => u.email.toLowerCase() === email.toLowerCase());
      if (!user) {
        return res.status(404).json({ error: "No accounts found matching this specified email address." });
      }

      const newToken = crypto.randomBytes(32).toString("hex");
      user.verificationToken = newToken;

      const prisma = getPrismaClient();
      if (prisma) {
        try {
          await prisma.user.update({
            where: { id: user.id },
            data: { verificationToken: newToken }
          });
        } catch (err) {
          console.warn("Prisma verification code update failed:", err);
        }
      }
      db.save();

      console.log(`[AUTH SERVICE RESEND] Dispatching verification token to ${email}: code=${newToken}`);
      res.json({ success: true, message: "A fresh verification link has been dispatched to your inbox." });
    } catch (err) {
      console.error("Resend verification process failed:", err);
      res.status(500).json({ error: "Internal server error" });
    }
  });

  // FORGOT PASSWORD RESET REQUEST (Generates temporary token and logs link)
  authRouter.post("/api/auth/forgot-password", async (req, res) => {
    try {
      const { email } = req.body;
      if (!email) {
        return res.status(400).json({ error: "Email is required to lookup reset targets." });
      }

      const user = db.data.users.find(u => u.email.toLowerCase() === email.toLowerCase());
      if (!user) {
        return res.json({ success: true, message: "If the email exists, a password reset linkage has been generated for your profile." });
      }

      const resetToken = crypto.randomBytes(32).toString("hex");
      const expirationTime = new Date(Date.now() + 3600000).toISOString(); // 1 hour

      user.resetPasswordToken = resetToken;
      user.resetPasswordExpires = expirationTime;

      const prisma = getPrismaClient();
      if (prisma) {
        try {
          await prisma.user.update({
            where: { id: user.id },
            data: {
              resetPasswordToken: resetToken,
              resetPasswordExpires: new Date(expirationTime)
            }
          });
        } catch (err) {
          console.warn("Prisma reset fields sync failed:", err);
        }
      }
      db.save();

      const resetLink = `/auth/reset-password?token=${resetToken}`;
      console.log(`[AUTH SERVICE PASSWORD RESET] Password reset simulated for ${email}: URL=${resetLink}`);

      res.json({
        success: true,
        message: "If the email exists, a password reset linkage has been generated for your profile."
      });
    } catch (err) {
      console.error("Forgot password flow failed:", err);
      res.status(500).json({ error: "Internal server error" });
    }
  });

  // RESET PASSWORD ACTION (Executes password update with token)
  authRouter.post("/api/auth/reset-password", async (req, res) => {
    try {
      const { token, password } = req.body;
      if (!token || !password) {
        return res.status(400).json({ error: "Reset token and new password are required." });
      }

      const user = db.data.users.find(u => {
        if (u.resetPasswordToken !== token) return false;
        if (!u.resetPasswordExpires) return false;
        return new Date(u.resetPasswordExpires).getTime() > Date.now();
      });

      if (!user) {
        return res.status(400).json({ error: "Reset token is invalid or has expired." });
      }

      const hashedPassword = await hashPassword(password);
      user.passwordHash = hashedPassword;
      user.resetPasswordToken = null;
      user.resetPasswordExpires = null;

      const prisma = getPrismaClient();
      if (prisma) {
        try {
          await prisma.user.update({
            where: { id: user.id },
            data: {
              passwordHash: hashedPassword,
              resetPasswordToken: null,
              resetPasswordExpires: null
            }
          });
        } catch (err) {
          console.warn("Prisma reset password failed:", err);
        }
      }
      db.save();

      res.json({ success: true, message: "Your password has been successfully updated. You may now login." });
    } catch (err) {
      console.error("Reset password failed:", err);
      res.status(500).json({ error: "Internal server error" });
    }
  });

  // REFRESH TOKEN ROTATION (Swaps expired short JWTs for fresh ones with valid session tokens)
  authRouter.post("/api/auth/refresh-token", async (req, res) => {
    try {
      const { refreshToken } = req.body || req.cookies;
      if (!refreshToken) {
        return res.status(401).json({ error: "Refresh token is missing or session expired." });
      }

      const decoded = jwt.verify(refreshToken, JWT_SECRET) as { userId: string };
      const user = db.data.users.find(u => u.id === decoded.userId);

      if (!user || user.refreshToken !== refreshToken) {
        return res.status(401).json({ error: "Invalid refresh token or session revoked." });
      }

      const { accessToken: newAccess, refreshToken: newRefresh } = generateAccessAndRefreshTokens({
        userId: user.id,
        email: user.email,
        role: user.role || "USER"
      });

      user.refreshToken = newRefresh;
      const prisma = getPrismaClient();
      if (prisma) {
        try {
          await prisma.user.update({
            where: { id: user.id },
            data: { refreshToken: newRefresh }
          });
        } catch (err) {
          console.warn("Prisma refresh token update failed:", err);
        }
      }
      db.save();

      res.cookie("refreshToken", newRefresh, {
        httpOnly: true,
        secure: process.env.NODE_ENV === "production",
        sameSite: "strict",
        maxAge: 7 * 24 * 60 * 60 * 1000
      });

      res.json({
        token: newAccess,
        accessToken: newAccess,
        refreshToken: newRefresh
      });
    } catch (err) {
      console.error("Token renewal failed:", err);
      res.status(401).json({ error: "Session token expired or is invalid." });
    }
  });

  // LOGOUT (Terminates session tokens)
  authRouter.post("/api/auth/logout", async (req, res) => {
    try {
      const authHeader = req.headers.authorization;
      if (authHeader) {
        const parts = authHeader.split(" ");
        if (parts.length === 2 && parts[0] === "Bearer") {
          try {
            const decoded = jwt.verify(parts[1], JWT_SECRET) as { userId: string };
            const user = db.data.users.find(u => u.id === decoded.userId);
            if (user) {
              user.refreshToken = null;
              const prisma = getPrismaClient();
              if (prisma) {
                await prisma.user.update({
                  where: { id: user.id },
                  data: { refreshToken: null }
                }).catch(() => {});
              }
              db.save();
            }
          } catch (e) {}
        }
      }
      res.clearCookie("refreshToken");
      res.json({ success: true, message: "Logged out successfully" });
    } catch (err) {
      console.error("Logout failed:", err);
      res.status(500).json({ error: "Internal server error" });
    }
  });

  // GOOGLE OAUTH INITIATION (Simulated secure OAuth redirect)
  authRouter.post("/api/auth/google", (req, res) => {
    const oAuthRedirect = `/api/auth/google/callback?code=sim_google_auth_code_xyz&state=tenderai_safe`;
    res.json({ redirectUrl: oAuthRedirect });
  });

  // GOOGLE OAUTH CALLBACK (Simulates the actual user creation or synchronization on google oauth callback)
  authRouter.get("/api/auth/google/callback", async (req, res) => {
    try {
      // Simulate OAuth exchanges
      const user = db.data.users[0]; // Ramesh user
      const { accessToken, refreshToken } = generateAccessAndRefreshTokens({
        userId: user.id,
        email: user.email,
        role: user.role || "ADMIN"
      });

      user.refreshToken = refreshToken;
      db.save();

      // Return unified interface callback page or redirect page back to the parent iframe
      res.send(`
        <html>
          <body>
            <h2>OAuth authentication complete. Syncing profile...</h2>
            <script>
              const payload = {
                token: "${accessToken}",
                accessToken: "${accessToken}",
                refreshToken: "${refreshToken}",
                user: ${JSON.stringify({ id: user.id, email: user.email, name: user.name, role: user.role, plan: user.plan })}
              };
              if (window.opener) {
                window.opener.postMessage({ type: "OAUTH_SUCCESS", payload }, window.location.origin);
                window.close();
              } else {
                localStorage.setItem("tenderai_token", "${accessToken}");
                localStorage.setItem("tenderai_user", JSON.stringify(payload.user));
                window.location.href = "/";
              }
            </script>
          </body>
        </html>
      `);
    } catch (err) {
      res.status(500).send("OAuth authentication failure during user synchronization.");
    }
  });

  // MICROSOFT OAUTH INITIATION (Simulated secure MS OAuth redirect)
  authRouter.post("/api/auth/microsoft", (req, res) => {
    const oAuthRedirect = `/api/auth/microsoft/callback?code=sim_ms_auth_code_def&state=tenderai_safe`;
    res.json({ redirectUrl: oAuthRedirect });
  });

  // MICROSOFT OAUTH CALLBACK (Simulates user mapping on MS OAuth callback)
  authRouter.get("/api/auth/microsoft/callback", async (req, res) => {
    try {
      const user = db.data.users[0]; // Ramesh user
      const { accessToken, refreshToken } = generateAccessAndRefreshTokens({
        userId: user.id,
        email: user.email,
        role: user.role || "ADMIN"
      });

      user.refreshToken = refreshToken;
      db.save();

      res.send(`
        <html>
          <body>
            <h2>Microsoft Active Directory Sync Complete...</h2>
            <script>
              const payload = {
                token: "${accessToken}",
                accessToken: "${accessToken}",
                refreshToken: "${refreshToken}",
                user: ${JSON.stringify({ id: user.id, email: user.email, name: user.name, role: user.role, plan: user.plan })}
              };
              if (window.opener) {
                window.opener.postMessage({ type: "OAUTH_SUCCESS", payload }, window.location.origin);
                window.close();
              } else {
                localStorage.setItem("tenderai_token", "${accessToken}");
                localStorage.setItem("tenderai_user", JSON.stringify(payload.user));
                window.location.href = "/";
              }
            </script>
          </body>
        </html>
      `);
    } catch (err) {
      res.status(500).send("Microsoft directory authentication failed.");
    }
  });

  // ROLE TESTING SECURE ENDPOINTS
  authRouter.get("/api/auth/csrf", (req, res) => {
    res.json({ csrfToken: generateCSRFToken(res) });
  });

  authRouter.get("/api/auth/me", (req, res) => {
    const user = resolveUser(req);
    if (!user) return res.status(401).json({ error: "Authentication required" });
    res.json(user);
  });

  authRouter.get("/api/admin/system-stats", authenticateJWT, requireRole(["ADMIN"]), (req, res) => {
    res.json({
      success: true,
      message: "Access granted for Admin system console.",
      metrics: {
        activeBidsCount: 142,
        totalTendersIndexed: 8092,
        systemLoad: "Normal 12%",
        lastMigrationCheck: "June 2026"
      }
    });
  });

  authRouter.get("/api/organization/teams", authenticateJWT, requireRole(["ORGANIZATION_ADMIN", "ADMIN"]), (req, res) => {
    res.json({
      success: true,
      message: "Access granted for Organization control portal.",
      departments: ["Civil Project Bidding", "Core Engineering", "Compliance Coordination Audit"]
    });
  });

