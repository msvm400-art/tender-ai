import React, { useState, useEffect, useRef, lazy, Suspense } from "react";
import { io } from "socket.io-client";
import {
  Compass,
  Search,
  FileText,
  Database,
  BellRing,
  BarChart4,
  LogOut,
  Building,
  Menu,
  X,
  CreditCard,
  UserCheck,
  Sparkles,
  AlertTriangle,
  Bell,
  CheckCircle2,
  ShieldAlert,
  Cloud,
  MessageSquare,
  Shield
} from "lucide-react";
import { useFirebase } from "./FirebaseContext.js";

// Import custom views
import LandingView from "./components/LandingView.jsx";
import TenderFeed from "./components/TenderFeed.jsx";
import TenderDetailView from "./components/TenderDetailView.jsx";
import DocumentVaultView from "./components/DocumentVaultView.jsx";
import ProfileView from "./components/ProfileView.jsx";
import AlertsView from "./components/AlertsView.jsx";
import Sidebar from "./components/Sidebar.js";

const AnalyticsView = lazy(() => import("./components/AnalyticsView.jsx"));
const SmartBidAssistantView = lazy(() => import("./components/SmartBidAssistantView.jsx"));

import BillingView from "./components/BillingView.js";
import UpgradeView from "./components/UpgradeView.jsx";
import { User, CompanyProfile, Tender, TenderMatch } from "./types.js";
const IngestionView = lazy(() => import("./components/IngestionView.jsx"));
const AdvancedSearchView = lazy(() => import("./components/AdvancedSearchView.jsx"));
const AdminPanel = lazy(() => import("./components/AdminPanel.jsx"));
const SupportTicketsView = lazy(() => import("./components/SupportTicketsView.jsx"));

type CurrentPage = "tenders" | "profile" | "vault" | "alerts" | "analytics" | "billing" | "upgrade" | "ingestion" | "search" | "bids" | "admin" | "support";

export default function App() {
  const { 
    firebaseUser, 
    firestoreUser, 
    firestoreProfile, 
    signInWithGoogle, 
    logOutFirebase, 
    saveProfileToFirestore, 
    saveUserToFirestore, 
    saveAlertToFirestore 
  } = useFirebase();

  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [user, setUser] = useState<User | null>(null);
  const [profile, setProfile] = useState<CompanyProfile | null>(null);

  // Load token and fetch /api/auth/me on mount for persistent login
  useEffect(() => {
    async function autoLogin() {
      const token = localStorage.getItem("tender_jwt");
      if (token) {
        try {
          const res = await fetch("/api/auth/me", {
            headers: {
              Authorization: `Bearer ${token}`
            }
          });
          if (res.ok) {
            const data = await res.json();
            setUser(data);
            setIsAuthenticated(true);
          } else {
            localStorage.removeItem("tender_jwt");
          }
        } catch (e) {
          console.error("Auto login error:", e);
        }
      }
    }
    autoLogin();
  }, []);

  // Sync state if Google popup or Firebase changes auth state
  useEffect(() => {
    if (firebaseUser) {
      setIsAuthenticated(true);
    }
  }, [firebaseUser]);

  // Synchronize local states with Firestore values when present to ensure cross-device consistency
  useEffect(() => {
    if (firebaseUser && firestoreUser) {
      setUser((current) => {
        if (!current) {
          return {
            id: firestoreUser.id,
            email: firestoreUser.email,
            name: firestoreUser.name,
            phone: firestoreUser.phone,
            plan: firestoreUser.plan,
            trialDaysElapsed: 0
          };
        }
        if (
          current.plan === firestoreUser.plan && 
          current.phone === firestoreUser.phone && 
          current.name === firestoreUser.name
        ) {
          return current;
        }
        return {
          ...current,
          name: firestoreUser.name || current.name,
          phone: firestoreUser.phone || current.phone,
          plan: firestoreUser.plan || current.plan
        };
      });
    }
  }, [firebaseUser, firestoreUser]);

  useEffect(() => {
    if (firebaseUser && firestoreProfile) {
      setProfile((current) => {
        if (!current) return firestoreProfile;
        if (JSON.stringify(current) === JSON.stringify(firestoreProfile)) {
          return current;
        }
        return firestoreProfile;
      });
    }
  }, [firebaseUser, firestoreProfile]);
  
  // Navigation states
  const [currentPage, setCurrentPage] = useState<CurrentPage>("tenders");
  const [selectedTenderId, setSelectedTenderId] = useState<string | null>(null);
  const [sidebarOpen, setSidebarOpen] = useState(true);
  const [selectedPlanIdForBilling, setSelectedPlanIdForBilling] = useState<string | null>(null);

  // Synchronically log page routing and tender detail funnels to Firebase Analytics
  useEffect(() => {
    if (currentPage) {
      window.logAnalyticsEvent("view_page", {
        page_name: currentPage,
        userId: user?.id || null,
        plan: user?.plan || "FREE",
        timestamp: new Date().toISOString()
      });
    }
  }, [currentPage, user?.id, user?.plan]);

  useEffect(() => {
    if (selectedTenderId) {
      window.logAnalyticsEvent("view_tender_details", {
        tenderId: selectedTenderId,
        userId: user?.id || null,
        timestamp: new Date().toISOString()
      });
    }
  }, [selectedTenderId, user?.id]);

  const isProfileCompleteValue = (p: CompanyProfile | null): boolean => {
    if (!p) return false;
    const hasCompany = !!p.companyName && p.companyName.trim() !== "" && !p.companyName.includes("New Consulting Firm");
    const hasReg = !!p.registrationNumber && p.registrationNumber.trim() !== "";
    const hasGst = !!p.gstNumber && p.gstNumber.trim() !== "";
    const hasPan = !!p.panNumber && p.panNumber.trim() !== "";
    const hasTurnover = p.annualTurnover > 0;
    const hasExp = p.yearsOfExperience > 0;
    const hasCats = Array.isArray(p.categories) && p.categories.length > 0;
    const hasStates = Array.isArray(p.states) && p.states.length > 0;
    const hasProjects = Array.isArray(p.pastProjects) && p.pastProjects.length > 0;
    
    return !!(hasCompany && hasReg && hasGst && hasPan && hasTurnover && hasExp && hasCats && hasStates && hasProjects);
  };

  const isProfileCompleted = isProfileCompleteValue(profile);
  const isTrialExpired = user?.trialDaysElapsed !== undefined && Number(user.trialDaysElapsed) >= 10;

  // Reactively check trial duration and automatically redirect to UpgradeView if expired
  useEffect(() => {
    if (!isAuthenticated || !user) return;
    const expired = user.trialDaysElapsed !== undefined && Number(user.trialDaysElapsed) >= 10;
    if (expired && currentPage !== "upgrade" && currentPage !== "billing" && currentPage !== "profile") {
      setCurrentPage("upgrade");
      addToast(
        "Your 10-day Starter Plan trial has expired. You have been redirected to the Premium commercial upgrades overview.",
        "DEADLINE_REMINDER"
      );
    }
  }, [user, currentPage, isAuthenticated]);

  // Db state items
  const [tenders, setTenders] = useState<Tender[]>([]);
  const [matches, setMatches] = useState<TenderMatch[]>([]);
  const [loadingTenders, setLoadingTenders] = useState(false);

  // Real-time notification Toast structure
  interface ToastItem {
    id: string;
    type: "NEW_MATCH" | "DEADLINE_REMINDER" | "STATUS_CHANGE" | "DOCUMENT_MISSING";
    message: string;
    tenderId?: string;
    timestamp: string;
  }

  // Real-time alerts state and socket reference
  const [toasts, setToasts] = useState<ToastItem[]>([]);
  
  const addToast = (message: string, type: "NEW_MATCH" | "DEADLINE_REMINDER" | "STATUS_CHANGE" | "DOCUMENT_MISSING" = "STATUS_CHANGE") => {
    const id = Math.random().toString(36).substring(3, 9);
    setToasts((prev) => [
      {
        id,
        type,
        message,
        timestamp: new Date().toISOString(),
      },
      ...prev,
    ]);
  };

  const socketRef = useRef<any>(null);

  // Initialize Socket.IO connection
  useEffect(() => {
    if (!isAuthenticated) {
      if (socketRef.current) {
        socketRef.current.disconnect();
        socketRef.current = null;
      }
      return;
    }

    // Connect to the same server port (Vite proxies to Express on port 3000)
    const socket = io();
    socketRef.current = socket;

    socket.on("connect", () => {
      console.log("[TenderAI Client] Connected to Socket.IO server");
    });

    // Listen for realtime tender alerts from server
    socket.on("tender_alert", (newAlert: any) => {
      console.log("[TenderAI Client] Received tender alert:", newAlert);

      // Trigger browser native notification if permitted
      if ("Notification" in window && Notification.permission === "granted") {
        try {
          new Notification("TenderAI Match & Alert System 🔔", {
            body: newAlert.message,
          });
        } catch (e) {
          console.warn("Native Notification click failed:", e);
        }
      }

      // Trigger toast update
      const toastId = Math.random().toString(36).substring(3, 9);
      const toastObj: ToastItem = {
        id: toastId,
        type: newAlert.type,
        message: newAlert.message,
        tenderId: newAlert.tenderId,
        timestamp: newAlert.sentAt || new Date().toISOString(),
      };

      setToasts((prev) => [toastObj, ...prev]);

      if (firebaseUser) {
        saveAlertToFirestore({
          id: toastId,
          tenderId: newAlert.tenderId || "",
          type: newAlert.type,
          channel: "IN_APP",
          message: newAlert.message,
          isRead: false,
          sentAt: newAlert.sentAt || new Date().toISOString(),
          createdAt: new Date().toISOString()
        });
      }

      // Automatically fetch matches list since match criteria might be updated
      const fetchLatestAlertsAndMatches = async () => {
        try {
          const token = localStorage.getItem("tender_jwt");
          const headers: Record<string, string> = {};
          if (token) headers["Authorization"] = `Bearer ${token}`;

          const resMatches = await fetch("/api/matches", { headers });
          const matchesData = await resMatches.json();
          setMatches(matchesData);
        } catch (err) {
          console.warn("Failed to update matches automatically:", err);
        }
      };
      fetchLatestAlertsAndMatches();
    });

    socket.on("disconnect", () => {
      console.log("[TenderAI Client] Disconnected from Socket.IO server");
    });

    return () => {
      socket.disconnect();
      socketRef.current = null;
    };
  }, [isAuthenticated]);

  // Handle manual mock alerts trigger
  const triggerManualSimulation = () => {
    if (socketRef.current) {
      socketRef.current.emit("simulate_alert");
    }
  };

  // Sync DB records from express
  useEffect(() => {
    async function loadBootstrapConfig() {
      if (!isAuthenticated) return;
      setLoadingTenders(true);
      try {
        const token = localStorage.getItem("tender_jwt");
        const headers: Record<string, string> = {};
        if (token) {
          headers["Authorization"] = `Bearer ${token}`;
        }

        // Fetch current active logged-in user
        const resUser = await fetch("/api/auth/me", { headers });
        if (resUser.ok) {
          const userData = await resUser.json();
          setUser(userData || null);
        }

        // Fetch company profile cp-1
        const resProfile = await fetch("/api/profiles", { headers });
        if (resProfile.ok) {
          const profilesData = await resProfile.json();
          if (Array.isArray(profilesData) && profilesData.length > 0) {
            setProfile(profilesData[0] || null);
          }
        }

        // Fetch interactive tenders
        const resTenders = await fetch("/api/tenders", { headers });
        if (resTenders.ok) {
          const tendersData = await resTenders.json();
          setTenders(Array.isArray(tendersData?.tenders) ? tendersData.tenders : []);
        }

        // Fetch matches associated
        const resMatches = await fetch("/api/matches", { headers });
        if (resMatches.ok) {
          const matchesData = await resMatches.json();
          setMatches(Array.isArray(matchesData) ? matchesData : []);
        }
      } catch (err) {
        console.error("Critical Express fetch synchronization failure:", err);
      } finally {
        setLoadingTenders(false);
      }
    }
    loadBootstrapConfig();
  }, [isAuthenticated]);

  // Fast profile update callback
  const handleSaveProfile = async (updated: CompanyProfile) => {
    try {
      const res = await fetch(`/api/profiles/${updated.id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(updated),
      });
      if (res.ok) {
        const data = await res.json();
        setProfile(data || null);
      }

      if (firebaseUser) {
        saveProfileToFirestore(updated);
      }

      // Instantly refresh matches since profile details changed EMD and score quotients
      const resMatches = await fetch("/api/matches");
      if (resMatches.ok) {
        const matchesData = await resMatches.json();
        setMatches(Array.isArray(matchesData) ? matchesData : []);
      }
    } catch (err) {
      console.error("Error saving profile details:", err);
    }
  };

  // Log Out helper
  const handleLogOut = async () => {
    try {
      await fetch("/api/auth/logout", { method: "POST" });
    } catch (err) {
      console.error(err);
    }
    localStorage.removeItem("tender_jwt");
    if (firebaseUser) {
      try {
        await logOutFirebase();
      } catch (err) {
        console.error("Firebase logout failed:", err);
      }
    }
    setIsAuthenticated(false);
    setUser(null);
    setProfile(null);
    setSelectedTenderId(null);
    setCurrentPage("tenders");
  };

  // Render landing layout if not logged in
  if (!isAuthenticated) {
    return <LandingView onStart={() => setIsAuthenticated(true)} />;
  }

  return (
    <div className="relative bg-slate-50/50 text-slate-900 h-screen w-full flex font-sans antialiased selection:bg-blue-600 selection:text-white overflow-hidden lg:border-[8px] lg:border-slate-200/40">
      {/* Premium ambient glassmorphic background meshes */}
      <div className="absolute -top-32 -left-32 w-[35rem] h-[35rem] sm:w-[45rem] sm:h-[45rem] rounded-full bg-indigo-200/40 blur-3xl pointer-events-none animate-pulse" style={{ animationDuration: "14s" }} />
      <div className="absolute -bottom-48 -right-48 w-[45rem] h-[45rem] sm:w-[55rem] sm:h-[55rem] rounded-full bg-sky-200/40 blur-3xl pointer-events-none animate-pulse" style={{ animationDuration: "18s" }} />
      <div className="absolute top-[30%] right-[10%] w-[30rem] h-[30rem] rounded-full bg-purple-200/25 blur-3xl pointer-events-none" />
      <div className="absolute bottom-[20%] left-[20%] w-[35rem] h-[35rem] rounded-full bg-cyan-200/20 blur-3xl pointer-events-none" />

      {/* Interactive Mobile Top Navigation Bar */}
      <div className="lg:hidden w-full bg-white/70 backdrop-blur-md text-slate-800 h-16 fixed top-0 left-0 z-50 flex items-center justify-between px-4 border-b border-white/20 shadow-sm">
        <div className="flex items-center space-x-2">
          <div className="w-8 h-8 bg-[#1B4FD8] rounded-lg flex items-center justify-center text-white font-bold text-sm shadow">
            T
          </div>
          <span className="font-bold text-lg text-slate-800 tracking-tight">TenderAI</span>
        </div>
        <button
          onClick={() => setSidebarOpen(!sidebarOpen)}
          className="p-1.5 hover:bg-slate-100/50 rounded-xl focus:outline-none transition-colors"
        >
          {sidebarOpen ? <X className="w-6 h-6 text-slate-800" /> : <Menu className="w-6 h-6 text-slate-800" />}
        </button>
      </div>

      {/* Sidebar Backdrop for Mobile */}
      {sidebarOpen && (
        <div
          id="mobile-sidebar-backdrop"
          onClick={() => setSidebarOpen(false)}
          className="lg:hidden fixed inset-0 bg-slate-900/20 backdrop-blur-xs z-30 transition-opacity cursor-pointer"
        />
      )}

      {/* Primary Sidebar Rail (Desktop Fixed, Mobile Absolute Draw) */}
      <Sidebar
        currentPage={currentPage}
        setCurrentPage={setCurrentPage}
        sidebarOpen={sidebarOpen}
        setSidebarOpen={setSidebarOpen}
        isTrialExpired={isTrialExpired}
        firebaseUser={firebaseUser}
        signInWithGoogle={signInWithGoogle}
        logOutFirebase={logOutFirebase}
        handleLogOut={handleLogOut}
        profile={profile}
        user={user}
        addToast={addToast}
        isProfileCompleted={isProfileCompleted}
        setSelectedTenderId={setSelectedTenderId}
      />

      {/* Main Panel Frame Wrapper */}
      <div className="flex-1 min-w-0 flex flex-col pt-16 lg:pt-0 overflow-hidden bg-transparent">
        {/* Top Header matching Sleek Interface design */}
        <header className="h-16 bg-white/45 backdrop-blur-md border-b border-white/25 hidden lg:flex items-center justify-between px-8 shrink-0 shadow-xs z-10">
          <h1 className="text-sm font-bold text-slate-700 uppercase tracking-wider">
            {currentPage === "tenders" ? (selectedTenderId ? "Active Tender Workspace" : "Competitive Discovery Portal") : ""}
            {currentPage === "profile" ? "E-Procurement Verification Criteria" : ""}
            {currentPage === "vault" ? "Intelligent Compliance Vault" : ""}
            {currentPage === "alerts" ? "Broadcast & Notification Station" : ""}
            {currentPage === "analytics" ? "Procurement Intel & Statistics" : ""}
            {currentPage === "billing" ? "Subscription Premium Tiers & Invoicing" : ""}
            {currentPage === "bids" ? "AI Proposal & Bid Drafting Engine" : ""}
          </h1>
          <div className="flex items-center gap-6">
            {/* Real-time Socket Event trigger button */}
            <button
              onClick={triggerManualSimulation}
              className="group flex items-center space-x-1.5 bg-gradient-to-r from-blue-50 to-indigo-50 border border-blue-250 hover:border-blue-350 text-[11px] font-extrabold text-blue-700 px-3 py-1.5 rounded-lg active:scale-95 transition-all cursor-pointer shadow-sm shadow-blue-50/50"
              title="Test real-time socket.io transmission with simulation"
            >
              <Sparkles className="w-3.5 h-3.5 text-blue-600 animate-pulse group-hover:rotate-12 transition-transform" />
              <span>Simulate Real-Time Alert</span>
            </button>

            <div className="flex items-center gap-3 pl-6 border-l border-slate-200">
              <div className="text-right">
                <p className="text-sm font-extrabold text-slate-800">{profile?.companyName || "Arjun Infra Ltd."}</p>
                <p className="text-[10px] text-slate-400 font-medium">Empaneled Civil Bidder</p>
              </div>
              <div className="w-10 h-10 bg-gradient-to-br from-blue-600 to-indigo-600 text-white rounded-full border-2 border-white shadow-md flex items-center justify-center font-bold text-sm uppercase">
                {user?.name?.slice(0, 2) || "CO"}
              </div>
            </div>
          </div>
        </header>

        {/* Scrollable Container wrapper to prevent double page scrolls */}
        <div className="flex-1 overflow-y-auto">
          <main className="p-4 sm:p-6 lg:p-8 w-full max-w-7xl mx-auto space-y-6">
            {/* Reactive Page Routing Switches */}
            {(!isProfileCompleted && (currentPage === "tenders" || currentPage === "vault" || currentPage === "alerts" || currentPage === "analytics")) ? (
              <div className="bg-slate-50 min-h-[60vh] flex items-center justify-center p-4 md:p-8 rounded-3xl border border-slate-200/60 shadow-sm animate-fade-in">
                <div className="bg-white rounded-2xl border border-slate-200 p-6 md:p-10 shadow-lg max-w-xl w-full text-center space-y-6">
                  <div className="w-14 h-14 bg-amber-50 text-amber-600 rounded-full flex items-center justify-center mx-auto border border-amber-200 shadow-xs">
                    <Building className="w-7 h-7" />
                  </div>
                  
                  <div className="space-y-2">
                    <h3 className="text-xl font-black tracking-tight text-slate-800">
                      Company Profile Completion Required
                    </h3>
                    <p className="text-xs text-slate-500 max-w-md mx-auto leading-relaxed">
                      You must complete your Company Criteria Profile to activate your <strong>10-Day free Starter Plan Trial</strong>. This enables accurate contract eligibility matching and removes the initial onboarding lock.
                    </p>
                  </div>

                  {/* Verification Criteria Checklist */}
                  <div className="bg-slate-50 rounded-xl p-5 border border-slate-200/50 text-left space-y-3">
                    <h4 className="text-[10px] font-black text-slate-450 tracking-wider uppercase">
                      Required Onboarding Criteria Checklist
                    </h4>
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 text-xs">
                      <div className="flex items-center space-x-2">
                        <div className={`w-4 h-4 rounded-full flex items-center justify-center text-[9px] font-bold ${profile?.companyName && !profile.companyName.includes("New Consulting Firm") ? "bg-emerald-100 text-emerald-700" : "bg-red-50 text-red-505"}`}>
                          {profile?.companyName && !profile.companyName.includes("New Consulting Firm") ? "✓" : "✗"}
                        </div>
                        <span className={profile?.companyName && !profile.companyName.includes("New Consulting Firm") ? "text-slate-700 font-medium" : "text-slate-400"}>Company Name</span>
                      </div>
                      <div className="flex items-center space-x-2">
                        <div className={`w-4 h-4 rounded-full flex items-center justify-center text-[9px] font-bold ${profile?.registrationNumber ? "bg-emerald-100 text-emerald-700" : "bg-red-50 text-red-505"}`}>
                          {profile?.registrationNumber ? "✓" : "✗"}
                        </div>
                        <span className={profile?.registrationNumber ? "text-slate-700 font-medium" : "text-slate-400"}>CIN (Corporate No.)</span>
                      </div>
                      <div className="flex items-center space-x-2">
                        <div className={`w-4 h-4 rounded-full flex items-center justify-center text-[9px] font-bold ${profile?.gstNumber ? "bg-emerald-100 text-emerald-700" : "bg-red-50 text-red-505"}`}>
                          {profile?.gstNumber ? "✓" : "✗"}
                        </div>
                        <span className={profile?.gstNumber ? "text-slate-700 font-medium" : "text-slate-400"}>GSTIN Certificate</span>
                      </div>
                      <div className="flex items-center space-x-2">
                        <div className={`w-4 h-4 rounded-full flex items-center justify-center text-[9px] font-bold ${profile?.panNumber ? "bg-emerald-100 text-emerald-700" : "bg-red-50 text-red-505"}`}>
                          {profile?.panNumber ? "✓" : "✗"}
                        </div>
                        <span className={profile?.panNumber ? "text-slate-700 font-medium" : "text-slate-400"}>PAN Card Number</span>
                      </div>
                      <div className="flex items-center space-x-2">
                        <div className={`w-4 h-4 rounded-full flex items-center justify-center text-[9px] font-bold ${profile && profile.annualTurnover > 0 ? "bg-emerald-100 text-emerald-700" : "bg-red-50 text-red-505"}`}>
                          {profile && profile.annualTurnover > 0 ? "✓" : "✗"}
                        </div>
                        <span className={profile && profile.annualTurnover > 0 ? "text-slate-700 font-medium" : "text-slate-400"}>Annual Turnover</span>
                      </div>
                      <div className="flex items-center space-x-2">
                        <div className={`w-4 h-4 rounded-full flex items-center justify-center text-[9px] font-bold ${profile && profile.yearsOfExperience > 0 ? "bg-emerald-100 text-emerald-700" : "bg-red-50 text-red-505"}`}>
                          {profile && profile.yearsOfExperience > 0 ? "✓" : "✗"}
                        </div>
                        <span className={profile && profile.yearsOfExperience > 0 ? "text-slate-700 font-medium" : "text-slate-400"}>Years of Experience</span>
                      </div>
                      <div className="flex items-center space-x-2">
                        <div className={`w-4 h-4 rounded-full flex items-center justify-center text-[9px] font-bold ${profile?.categories && profile.categories.length > 0 ? "bg-emerald-100 text-emerald-700" : "bg-red-50 text-red-505"}`}>
                          {profile?.categories && profile.categories.length > 0 ? "✓" : "✗"}
                        </div>
                        <span className={profile?.categories && profile.categories.length > 0 ? "text-slate-700 font-medium" : "text-slate-400"}>Operating Trades</span>
                      </div>
                      <div className="flex items-center space-x-2">
                        <div className={`w-4 h-4 rounded-full flex items-center justify-center text-[9px] font-bold ${profile?.states && profile.states.length > 0 ? "bg-emerald-100 text-emerald-700" : "bg-red-50 text-red-505"}`}>
                          {profile?.states && profile.states.length > 0 ? "✓" : "✗"}
                        </div>
                        <span className={profile?.states && profile.states.length > 0 ? "text-slate-700 font-medium" : "text-slate-400"}>Operating States</span>
                      </div>
                      <div className="flex items-center space-x-2 col-span-1 sm:col-span-2">
                        <div className={`w-4 h-4 rounded-full flex items-center justify-center text-[9px] font-bold ${profile?.pastProjects && profile.pastProjects.length > 0 ? "bg-emerald-100 text-emerald-700" : "bg-red-50 text-red-505"}`}>
                          {profile?.pastProjects && profile.pastProjects.length > 0 ? "✓" : "✗"}
                        </div>
                        <span className={profile?.pastProjects && profile.pastProjects.length > 0 ? "text-slate-700 font-medium" : "text-slate-400"}>Past Projects logged (minimum 1)</span>
                      </div>
                    </div>
                  </div>

                  <div className="flex flex-col sm:flex-row justify-center gap-2.5">
                    <button
                      type="button"
                      onClick={() => setCurrentPage("profile")}
                      className="bg-blue-600 hover:bg-blue-700 text-white font-extrabold text-[11px] px-5 py-3 rounded-xl shadow-xs cursor-pointer active:scale-95 transition-all"
                    >
                      Complete My Profile Now
                    </button>
                    <button
                      type="button"
                      onClick={async () => {
                        if (!profile) return;
                        const seedComplete = {
                          ...profile,
                          companyName: "Sharma Construction & Infra, Pvt Ltd",
                          registrationNumber: "U45201BR2015PTC024501",
                          gstNumber: "10AAAXX0000Z1Z5",
                          panNumber: "AAACX1234F",
                          annualTurnover: 5.2,
                          yearsOfExperience: 8,
                          categories: ["Construction", "Civil", "Roads", "Electrical"],
                          states: ["Bihar", "Jharkhand", "Uttar Pradesh"],
                          certifications: ["ISO 9001"],
                          pastProjects: [{ name: "Patna Outer Bypass Expressway", value: 3.5, client: "PWD Bihar", year: 2024 }]
                        };
                        await handleSaveProfile(seedComplete);
                        addToast("Company Criteria Profile populated! 10-day Starter Trial activated.", "STATUS_CHANGE");
                      }}
                      className="bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold text-[11px] px-5 py-3 rounded-xl transition-all"
                    >
                      ⚡ Quick-Unlock 10-Day Starter Trial
                    </button>
                  </div>
                </div>
              </div>
            ) : (
              <Suspense fallback={
                <div className="flex flex-col items-center justify-center py-20 min-h-[400px]">
                  <div className="w-10 h-10 border-4 border-blue-600 border-t-transparent rounded-full animate-spin mb-4"></div>
                  <p className="text-sm font-semibold text-slate-500">Loading module workspace...</p>
                </div>
              }>
                {currentPage === "tenders" && (
                  selectedTenderId ? (
                    <TenderDetailView
                      tenderId={selectedTenderId}
                      onBack={() => setSelectedTenderId(null)}
                      user={user}
                      onNavigateToBilling={() => setCurrentPage("billing")}
                      profile={profile || {
                        id: "cp-1",
                        userId: "u-1",
                        companyName: "Placeholder",
                        registrationNumber: "",
                        gstNumber: "",
                        panNumber: "",
                        annualTurnover: 1.0,
                        yearsOfExperience: 2,
                        categories: ["Industrial civil"],
                        certifications: [],
                        states: ["Bihar"],
                        msmeRegistered: false,
                        employeeCount: 5,
                        pastProjects: [],
                        isActive: true,
                      }}
                    />
                  ) : (
                    <TenderFeed
                      tenders={tenders}
                      matches={matches}
                      onSelectTender={(id) => setSelectedTenderId(id)}
                      isLoading={loadingTenders}
                      user={user}
                      profile={profile}
                      onNavigateToBilling={() => setCurrentPage("billing")}
                    />
                  )
                )}

                {currentPage === "profile" && (
                  <ProfileView profile={profile} onSave={handleSaveProfile} />
                )}

                {currentPage === "vault" && <DocumentVaultView />}

                {currentPage === "alerts" && <AlertsView />}

                {currentPage === "analytics" && <AnalyticsView />}

                {currentPage === "ingestion" && <IngestionView />}
                {currentPage === "search" && <AdvancedSearchView />}
                {currentPage === "bids" && <SmartBidAssistantView />}
                {currentPage === "support" && (
                  <SupportTicketsView user={user} onToast={addToast} />
                )}
                {currentPage === "admin" && (
                  <AdminPanel
                    user={user}
                    onToast={addToast}
                    onBackToFeed={() => setCurrentPage("tenders")}
                  />
                )}
              </Suspense>
            )}

            {currentPage === "billing" && (
              <BillingView
                user={user}
                profile={profile}
                onUpdateUser={(updatedUser) => setUser(updatedUser)}
                onToast={addToast}
                initialSelectedPlanId={selectedPlanIdForBilling}
                onClearInitialPlan={() => setSelectedPlanIdForBilling(null)}
              />
            )}

            {currentPage === "upgrade" && (
              <UpgradeView
                user={user}
                onNavigateToBilling={(planId) => {
                  setSelectedPlanIdForBilling(planId || null);
                  setCurrentPage("billing");
                }}
              />
            )}
          </main>
        </div>
      </div>

      {/* Real-Time Toast Notifications Overlay */}
      <div className="fixed bottom-6 right-6 z-[1000] pointer-events-none flex flex-col gap-3 max-w-sm w-full">
        {toasts.map((toast) => (
          <div
            key={toast.id}
            className="pointer-events-auto bg-white border border-slate-200/90 shadow-2xl rounded-xl p-4 flex gap-3.5 transition-all duration-300 relative overflow-hidden"
            style={{ animation: "slideIn 0.35s cubic-bezier(0.16, 1, 0.3, 1) forwards" }}
          >
            {/* Color accent bar on the left */}
            <div
              className={`absolute top-0 bottom-0 left-0 w-1 ${
                toast.type === "NEW_MATCH"
                  ? "bg-[#1B4FD8]"
                  : toast.type === "DEADLINE_REMINDER"
                  ? "bg-amber-500"
                  : toast.type === "STATUS_CHANGE"
                  ? "bg-emerald-500"
                  : "bg-rose-500"
              }`}
            />

            <div className="shrink-0">
              {toast.type === "NEW_MATCH" ? (
                <div className="bg-blue-50 text-blue-600 p-2 rounded-lg">
                  <Compass className="w-5 h-5 animate-spin" style={{ animationDuration: "12s" }} />
                </div>
              ) : toast.type === "DEADLINE_REMINDER" ? (
                <div className="bg-amber-50 text-amber-600 p-2 rounded-lg">
                  <AlertTriangle className="w-5 h-5" />
                </div>
              ) : toast.type === "STATUS_CHANGE" ? (
                <div className="bg-emerald-50 text-emerald-600 p-2 rounded-lg">
                  <CheckCircle2 className="w-5 h-5" />
                </div>
              ) : (
                <div className="bg-rose-50 text-rose-600 p-2 rounded-lg">
                  <ShieldAlert className="w-5 h-5" />
                </div>
              )}
            </div>

            <div className="flex-1 text-xs space-y-1">
              <div className="flex items-center justify-between">
                <span className="font-extrabold text-[#1B4FD8] uppercase tracking-wider text-[9px]">
                  {toast.type === "NEW_MATCH"
                    ? "Tender Match Found"
                    : toast.type === "DEADLINE_REMINDER"
                    ? "Deadline Alert"
                    : toast.type === "STATUS_CHANGE"
                    ? "Status Transition"
                    : "Compliance Notice"}
                </span>
                <span className="text-[9px] text-slate-400 font-medium shrink-0">Just now</span>
              </div>
              <p className="text-slate-650 leading-relaxed font-semibold">{toast.message}</p>
              
              <div className="pt-2 flex items-center gap-2">
                {toast.tenderId && (
                  <button
                    onClick={() => {
                      setSelectedTenderId(toast.tenderId || null);
                      setCurrentPage("tenders");
                      // Dismiss this toast after navigating
                      setToasts((prev) => prev.filter((t) => t.id !== toast.id));
                    }}
                    className="text-[10px] font-bold text-white bg-blue-600 hover:bg-blue-700 px-2.5 py-1 rounded transition-colors cursor-pointer border border-blue-700 shadow-sm"
                  >
                    View Workspace
                  </button>
                )}
                <button
                  onClick={() => setToasts((prev) => prev.filter((t) => t.id !== toast.id))}
                  className="text-[10px] font-bold text-slate-500 hover:text-slate-800 bg-slate-50 border border-slate-150 hover:bg-slate-100 px-2.5 py-1 rounded transition-colors cursor-pointer"
                >
                  Dismiss
                </button>
              </div>
            </div>

            <button
              onClick={() => setToasts((prev) => prev.filter((t) => t.id !== toast.id))}
              className="absolute top-2.5 right-2.5 text-slate-400 hover:text-slate-605 p-0.5 rounded hover:bg-slate-50 transition-colors cursor-pointer"
            >
              <X className="w-3.5 h-3.5" />
            </button>
          </div>
        ))}
      </div>
    </div>
  );
}
