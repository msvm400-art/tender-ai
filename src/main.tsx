import {StrictMode} from 'react';
import {createRoot} from 'react-dom/client';
import App from './App.tsx';
import { FirebaseProvider } from './FirebaseContext.tsx';
import { logAnalyticsEvent } from './firebase.ts';
import ErrorBoundary from './components/ErrorBoundary.tsx';
import './index.css';

// Declare global properties for TypeScript type checking
declare global {
  interface Window {
    logAnalyticsEvent: (eventName: string, params?: Record<string, any>) => void;
  }
}

// Attach the tracking helper to the global window object
window.logAnalyticsEvent = logAnalyticsEvent;

// Trigger the initial app loading/entry milestone event
logAnalyticsEvent("app_load", {
  timestamp: new Date().toISOString(),
  referrer: document.referrer || "direct",
  screen_resolution: `${window.screen.width}x${window.screen.height}`,
  viewport_size: `${window.innerWidth}x${window.innerHeight}`
});

// Monkeypatch fetch to automatically carry JWT session token across all modules seamlessly
const originalFetch = window.fetch;
let cachedCsrf: string | null = sessionStorage.getItem("tender_csrf");

const customFetch = async (input: RequestInfo | URL, init?: RequestInit) => {
  const urlString = typeof input === "string" ? input : (input instanceof URL ? input.toString() : input.url);
  const method = (init?.method || "GET").toUpperCase();

  // Automatically carry JWT token
  const token = localStorage.getItem("tender_jwt");
  if (token) {
    init = init || {};
    init.headers = init.headers || {};
    if (init.headers instanceof Headers) {
      if (!init.headers.has("Authorization")) {
        init.headers.set("Authorization", `Bearer ${token}`);
      }
    } else if (Array.isArray(init.headers)) {
      const hasAuth = init.headers.some(([key]) => key.toLowerCase() === "authorization");
      if (!hasAuth) {
        init.headers.push(["Authorization", `Bearer ${token}`]);
      }
    } else {
      const headers = init.headers as Record<string, string>;
      const hasAuth = Object.keys(headers).some((k) => k.toLowerCase() === "authorization");
      if (!hasAuth) {
        headers["Authorization"] = `Bearer ${token}`;
      }
    }
  }

  // Handle CSRF Protection headers automatically
  const isSafeMethod = ["GET", "HEAD", "OPTIONS"].includes(method);
  const isCsrfUrl = urlString.includes("/api/auth/csrf");

  if (!isSafeMethod && !isCsrfUrl) {
    if (!cachedCsrf) {
      try {
        const csrfRes = await originalFetch("/api/auth/csrf", {
          headers: token ? { "Authorization": `Bearer ${token}` } : {}
        });
        if (csrfRes.ok) {
          const csrfData = await csrfRes.json();
          if (csrfData && csrfData.csrfToken) {
            cachedCsrf = csrfData.csrfToken;
            sessionStorage.setItem("tender_csrf", cachedCsrf as string);
          }
        }
      } catch (e) {
        console.warn("Failed pre-fetching CSRF token:", e);
      }
    }

    if (cachedCsrf) {
      init = init || {};
      init.headers = init.headers || {};
      if (init.headers instanceof Headers) {
        init.headers.set("X-CSRF-Token", cachedCsrf);
      } else if (Array.isArray(init.headers)) {
        init.headers.push(["X-CSRF-Token", cachedCsrf]);
      } else {
        const headers = init.headers as Record<string, string>;
        headers["X-CSRF-Token"] = cachedCsrf;
      }
    }
  }

  const response = await originalFetch(input, init);

  // Intercept authentication responses to cache a fresh CSRF token
  if (urlString.includes("/api/auth/login") || urlString.includes("/api/auth/register")) {
    try {
      const clone = response.clone();
      const body = await clone.json();
      if (body && body.csrfToken) {
        cachedCsrf = body.csrfToken;
        sessionStorage.setItem("tender_csrf", cachedCsrf as string);
      }
    } catch (e) {
      // Ignore clone/read failures
    }
  }

  return response;
};

try {
  Object.defineProperty(window, 'fetch', {
    value: customFetch,
    configurable: true,
    writable: true,
  });
} catch (e) {
  console.warn("Failed to override window.fetch with Object.defineProperty, trying direct assignment:", e);
  try {
    window.fetch = customFetch;
  } catch (err) {
    console.error("Could not override fetch globally:", err);
  }
}

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <ErrorBoundary>
      <FirebaseProvider>
        <App />
      </FirebaseProvider>
    </ErrorBoundary>
  </StrictMode>,
);
