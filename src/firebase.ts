import { initializeApp } from "firebase/app";
import { getAuth } from "firebase/auth";
import { getFirestore, doc, getDocFromServer } from "firebase/firestore";
import { getAnalytics, isSupported, logEvent } from "firebase/analytics";
import { initializeAppCheck, ReCaptchaV3Provider } from "firebase/app-check";
import firebaseConfigJson from "../firebase-applet-config.json";

const firebaseConfig = {
  apiKey: (import.meta as any).env.VITE_FIREBASE_API_KEY || firebaseConfigJson.apiKey,
  authDomain: (import.meta as any).env.VITE_FIREBASE_AUTH_DOMAIN || firebaseConfigJson.authDomain,
  projectId: (import.meta as any).env.VITE_FIREBASE_PROJECT_ID || firebaseConfigJson.projectId,
  storageBucket: (import.meta as any).env.VITE_FIREBASE_STORAGE_BUCKET || firebaseConfigJson.storageBucket,
  messagingSenderId: (import.meta as any).env.VITE_FIREBASE_MESSAGING_SENDER_ID || firebaseConfigJson.messagingSenderId,
  appId: (import.meta as any).env.VITE_FIREBASE_APP_ID || firebaseConfigJson.appId,
  measurementId: (import.meta as any).env.VITE_FIREBASE_MEASUREMENT_ID || firebaseConfigJson.measurementId,
  firestoreDatabaseId: (import.meta as any).env.VITE_FIREBASE_FIRESTORE_DATABASE_ID || firebaseConfigJson.firestoreDatabaseId,
};

export const app = initializeApp(firebaseConfig);

// Initialize App Check safely for browser contexts
export let appCheck: any = null;

if (typeof window !== "undefined") {
  const host = window.location.hostname;
  const isDev = process.env.NODE_ENV !== "production" || host === "localhost" || host === "127.0.0.1" || host.includes("run.app");
  if (isDev) {
    (window as any).FIREBASE_APPCHECK_DEBUG_TOKEN = true;
    console.log("[FirebaseAppCheck] Development or sandboxed staging environment detected. Activated App Check Debug Provider.");
  }

  // Uses a configurable reCAPTCHA v3 siteKey from the environment, defaulting to a secure structure
  const siteKey = (import.meta as any).env.VITE_RECAPTCHA_SITE_KEY || "6Ld7e3IpAAAAAA_CgpxXJ9V7fI7vK0E8qM9Z7C7c";
  
  try {
    appCheck = initializeAppCheck(app, {
      provider: new ReCaptchaV3Provider(siteKey),
      isTokenAutoRefreshEnabled: true,
    });
    console.log("[FirebaseAppCheck] Loaded successfully with siteKey:", siteKey);
  } catch (err) {
    console.warn("[FirebaseAppCheck] App Check failed to initialize (this is normal in some sandbox iframes):", err);
  }
}

// Initialize Analytics safely
export let analytics: any = null;

isSupported().then((supported) => {
  if (supported && firebaseConfig.measurementId) {
    analytics = getAnalytics(app);
    console.log("[FirebaseAnalytics] Initialized successfully with measurementId:", firebaseConfig.measurementId);
  } else {
    console.warn(
      "[FirebaseAnalytics] Analytics is disabled or not supported in this sandboxed environment (iframe/privacy blockers) or measurementId is missing."
    );
  }
}).catch((err) => {
  console.error("[FirebaseAnalytics] Failed to check support:", err);
});

export function logAnalyticsEvent(eventName: string, params?: Record<string, any>) {
  if (analytics) {
    try {
      logEvent(analytics, eventName, params);
      console.log(`[FirebaseAnalytics Event] ${eventName}:`, params);
    } catch (e) {
      console.warn(`[FirebaseAnalytics Error] Failed to logEvent ${eventName}:`, e);
    }
  } else {
    // Beautiful, custom fallback so analytics calls still print and track nicely during development/iframe nesting
    console.log(`[FirebaseAnalytics Event (Fallback console logging)] ${eventName}:`, params);
  }
}

// CRITICAL: The app will break without this line
export const db = getFirestore(app, firebaseConfig.firestoreDatabaseId);
export const auth = getAuth();

export enum OperationType {
  CREATE = "create",
  UPDATE = "update",
  DELETE = "delete",
  LIST = "list",
  GET = "get",
  WRITE = "write",
}

export interface FirestoreErrorInfo {
  error: string;
  operationType: OperationType;
  path: string | null;
  authInfo: {
    userId?: string | null;
    email?: string | null;
    emailVerified?: boolean | null;
    isAnonymous?: boolean | null;
    tenantId?: string | null;
    providerInfo?: {
      providerId?: string | null;
      email?: string | null;
    }[];
  };
}

export function handleFirestoreError(error: unknown, operationType: OperationType, path: string | null) {
  const errInfo: FirestoreErrorInfo = {
    error: error instanceof Error ? error.message : String(error),
    authInfo: {
      userId: auth.currentUser?.uid,
      email: auth.currentUser?.email,
      emailVerified: auth.currentUser?.emailVerified,
      isAnonymous: auth.currentUser?.isAnonymous,
      tenantId: auth.currentUser?.tenantId,
      providerInfo: auth.currentUser?.providerData?.map(provider => ({
        providerId: provider.providerId,
        email: provider.email,
      })) || []
    },
    operationType,
    path
  };
  console.error("Firestore Error: ", JSON.stringify(errInfo));
  throw new Error(JSON.stringify(errInfo));
}

// CRITICAL CONSTRAINT: Validate connection on boot
export async function testConnection() {
  try {
    await getDocFromServer(doc(db, "test", "connection"));
    console.log("Firebase connection loaded successfully.");
  } catch (error) {
    if (error instanceof Error && (error.message.includes("client is offline") || error.message.includes("the client is offline"))) {
      console.warn("Please check your Firebase configuration.");
    }
  }
}

testConnection();
