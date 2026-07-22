import React, { useState, useEffect } from "react";
import { ShieldCheck, TrendingUp, Search, FileText, Database, Radio, CheckCircle, ArrowRight, X, Mail, Lock, User as UserIcon, Phone, AlertCircle, Sparkles } from "lucide-react";
import { useFirebase } from "../FirebaseContext.js";

interface LandingProps {
  onStart: () => void;
}

export default function LandingView({ onStart }: LandingProps) {
  const { signInWithGoogle, firebaseUser } = useFirebase();
  const [authMode, setAuthMode] = useState<"none" | "signin" | "signup" | "forgot" | "verify" | "reset">("none");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [name, setName] = useState("");
  const [phone, setPhone] = useState("");
  const [role, setRole] = useState<"USER" | "ADMIN" | "ORGANIZATION_ADMIN">("USER");
  const [organizationId, setOrganizationId] = useState("");
  const [verifyToken, setVerifyToken] = useState("");
  const [resetToken, setResetToken] = useState("");
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [successMsg, setSuccessMsg] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);

  // Auto-usher inside if Google firebase authentication reports success
  useEffect(() => {
    if (firebaseUser) {
      onStart();
    }
  }, [firebaseUser]);

  const handleSignInSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!email || !password) {
      setErrorMsg("Email and password fields are required");
      return;
    }

    setIsLoading(true);
    setErrorMsg(null);
    try {
      const res = await fetch("/api/auth/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email, password }),
      });
      const data = await res.json();
      if (res.ok && data?.token) {
        localStorage.setItem("tender_jwt", data.token);
        onStart();
      } else {
        setErrorMsg(data?.error || "Invalid user credentials combination");
      }
    } catch (err) {
      console.error(err);
      setErrorMsg("Error communicating with security authentication gateway.");
    } finally {
      setIsLoading(false);
    }
  };

  const handleSignUpSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!email || !password || !name) {
      setErrorMsg("Please fill in all mandatory fields (Name, Email, Password)");
      return;
    }

    setIsLoading(true);
    setErrorMsg(null);
    setSuccessMsg(null);
    try {
      const res = await fetch("/api/auth/register", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name, email, password, phone, role, organizationId }),
      });
      const data = await res.json();
      if (res.status === 201 && data?.token) {
        localStorage.setItem("tender_jwt", data.token);
        setSuccessMsg(data.message || "Registration successful!");
        setIsLoading(false);
        // Automatically pivot to the token verification view for validation demo
        setAuthMode("verify");
      } else {
        setErrorMsg(data?.error || "Registration rejected. Please verify details.");
      }
    } catch (err) {
      console.error(err);
      setErrorMsg("Error communicating with registration portal.");
    } finally {
      setIsLoading(false);
    }
  };

  const handleVerifySubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!verifyToken) {
      setErrorMsg("Verification token code required.");
      return;
    }

    setIsLoading(true);
    setErrorMsg(null);
    setSuccessMsg(null);
    try {
      const res = await fetch("/api/auth/verify-email", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ token: verifyToken }),
      });
      const data = await res.json();
      if (res.ok) {
        setSuccessMsg(data.message || "Email verified!");
        setTimeout(() => {
          onStart();
        }, 1500);
      } else {
        setErrorMsg(data.error || "Verification failed. Inspect console or try again.");
      }
    } catch (err) {
      setErrorMsg("Failed to communicate with verification servers.");
    } finally {
      setIsLoading(false);
    }
  };

  const handleForgotSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!email) {
      setErrorMsg("Corporate email target is required.");
      return;
    }

    setIsLoading(true);
    setErrorMsg(null);
    setSuccessMsg(null);
    try {
      const res = await fetch("/api/auth/forgot-password", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email }),
      });
      const data = await res.json();
      if (res.ok) {
        setSuccessMsg(data.message || "Password link sent!");
        if (data.devResetToken) {
          setResetToken(data.devResetToken); // Autofill for simple testing!
        }
      } else {
        setErrorMsg(data.error || "Reset request failed.");
      }
    } catch (err) {
      setErrorMsg("Failed to communicate with credentials servers.");
    } finally {
      setIsLoading(false);
    }
  };

  const handleResetSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!resetToken || !password) {
      setErrorMsg("Reset token and new secure password are required.");
      return;
    }

    setIsLoading(true);
    setErrorMsg(null);
    setSuccessMsg(null);
    try {
      const res = await fetch("/api/auth/reset-password", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ token: resetToken, password }),
      });
      const data = await res.json();
      if (res.ok) {
        setSuccessMsg(data.message || "Password successfully updated!");
        setTimeout(() => {
          setAuthMode("signin");
        }, 1800);
      } else {
        setErrorMsg(data.error || "Failed to update password.");
      }
    } catch (err) {
      setErrorMsg("Password update connection error.");
    } finally {
      setIsLoading(false);
    }
  };

  const handleOAuthSim = async (provider: "google" | "microsoft") => {
    setIsLoading(true);
    setErrorMsg(null);
    setSuccessMsg(null);
    try {
      const res = await fetch(`/api/auth/${provider}`, { method: "POST" });
      const data = await res.json();
      if (res.ok && data.redirectUrl) {
        window.location.href = data.redirectUrl;
      } else {
        setErrorMsg(`Failed to delegate ${provider} OAuth redirect.`);
      }
    } catch (e) {
      setErrorMsg(`Failed to connect with ${provider} OAuth port.`);
    } finally {
      setIsLoading(false);
    }
  };

  const loadDemoCredentials = () => {
    setEmail("demo@tenderai.in");
    setPassword("demo123");
    setErrorMsg(null);
    setSuccessMsg(null);
  };

  return (
    <div className="bg-[#0b0f19] text-slate-100 min-h-screen relative overflow-hidden font-sans selection:bg-indigo-600 selection:text-white">
      {/* Decorative gradient glowing mesh overlays */}
      <div className="absolute top-[-20%] left-[-10%] w-[50rem] h-[50rem] rounded-full bg-indigo-900/20 blur-[150px] pointer-events-none animate-pulse-glow" style={{ animationDuration: "12s" }} />
      <div className="absolute bottom-[-10%] right-[-10%] w-[60rem] h-[60rem] rounded-full bg-blue-900/15 blur-[180px] pointer-events-none animate-pulse-glow" style={{ animationDuration: "16s" }} />
      <div className="absolute top-[25%] right-[5%] w-[35rem] h-[35rem] rounded-full bg-violet-900/10 blur-[120px] pointer-events-none" />

      {/* Grid Pattern Overlay */}
      <div className="absolute inset-0 bg-[linear-gradient(rgba(255,255,255,0.015)_1px,transparent_1px),linear-gradient(90deg,rgba(255,255,255,0.015)_1px,transparent_1px)] bg-[size:40px_40px] [mask-image:radial-gradient(ellipse_60%_50%_at_50%_0%,#000_70%,transparent_100%)] pointer-events-none" />

      {/* Navbar Header */}
      <header className="border-b border-white/5 backdrop-blur bg-[#0b0f19]/75 sticky top-0 z-50">
        <div className="max-w-7xl mx-auto px-6 sm:px-8 h-20 flex items-center justify-between">
          <div className="flex items-center space-x-3.5">
            <div className="bg-gradient-to-tr from-blue-600 to-indigo-600 p-2.5 rounded-xl text-white font-black text-2xl flex items-center justify-center shadow-lg shadow-blue-500/20 w-11 h-11 border border-white/10">
              T
            </div>
            <span className="font-extrabold text-2xl tracking-tight bg-gradient-to-r from-white via-slate-100 to-slate-350 bg-clip-text text-transparent">
              TenderAI
            </span>
          </div>
          <div className="flex items-center space-x-6">
            <button
              onClick={() => setAuthMode("signin")}
              className="text-slate-300 hover:text-white font-black text-xs uppercase tracking-widest transition-colors cursor-pointer"
            >
              Sign In
            </button>
            <button
              onClick={() => setAuthMode("signup")}
              className="bg-white hover:bg-slate-100 text-[#0b0f19] font-black text-xs uppercase tracking-widest px-6 py-3 rounded-xl shadow-lg transition-all active:scale-95 cursor-pointer border border-white/10"
            >
              Get Started
            </button>
          </div>
        </div>
      </header>

      {/* Hero Section */}
      <section className="relative py-24 md:py-36 text-center max-w-7xl mx-auto px-6 sm:px-8">
        <div className="inline-flex items-center space-x-2 bg-gradient-to-r from-blue-500/10 to-indigo-500/10 border border-blue-500/20 px-4 py-2 rounded-full text-blue-400 text-[10px] font-black uppercase tracking-widest mb-10 shadow-inner">
          <Radio className="w-3.5 h-3.5 animate-pulse text-indigo-500 shrink-0" />
          <span>Real-time crawler online over 90+ systems</span>
        </div>

        <h1 className="text-4xl sm:text-7xl font-extrabold tracking-tight text-white max-w-5xl mx-auto leading-[1.08] mb-8 font-heading">
          Win More Public Tenders with{" "}
          <span className="bg-gradient-to-r from-blue-400 via-indigo-300 to-violet-400 bg-clip-text text-transparent block mt-2">
            Automated Bid Intelligence
          </span>
        </h1>

        <p className="text-base sm:text-lg text-slate-400 max-w-2xl mx-auto leading-relaxed mb-12 font-medium">
          Consolidate central CPPP, GeM, and state-wide PWD contracts. Generate high-compliance bids, analyze criteria, and manage credentials instantly with RAG AI Counsel.
        </p>

        <div className="flex flex-col sm:flex-row items-center justify-center gap-4.5">
          <button
            onClick={() => setAuthMode("signin")}
            className="w-full sm:w-auto bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-500 hover:to-indigo-500 text-white font-black text-xs uppercase tracking-widest px-8 py-4.5 rounded-xl shadow-xl shadow-indigo-600/15 active:scale-95 transition-all flex items-center justify-center space-x-2.5 group cursor-pointer border border-white/10"
          >
            <span>Explore Tender Workspace</span>
            <ArrowRight className="w-4 h-4 group-hover:translate-x-1 transition-transform" />
          </button>
          <button
            onClick={() => setAuthMode("signup")}
            className="w-full sm:w-auto bg-white/5 hover:bg-white/10 text-white border border-white/10 font-black text-xs uppercase tracking-widest px-8 py-4.5 rounded-xl transition-all active:scale-95 cursor-pointer"
          >
            Request Consultant Call
          </button>
        </div>
      </section>

      {/* Stats Bar */}
      <section className="border-y border-white/5 bg-[#0b0f19]/35 backdrop-blur-md py-14">
        <div className="max-w-7xl mx-auto px-6 sm:px-8">
          <div className="grid grid-cols-2 md:grid-cols-4 gap-10 text-center">
            <div className="space-y-1">
              <p className="text-4xl sm:text-5xl font-black text-blue-400 tracking-tight font-heading">1.9M+</p>
              <p className="text-slate-400 text-[10px] font-black uppercase tracking-widest">Tenders Tracked</p>
            </div>
            <div className="space-y-1">
              <p className="text-4xl sm:text-5xl font-black text-indigo-400 tracking-tight font-heading">90+</p>
              <p className="text-slate-400 text-[10px] font-black uppercase tracking-widest">National Portals</p>
            </div>
            <div className="space-y-1">
              <p className="text-4xl sm:text-5xl font-black text-emerald-400 tracking-tight font-heading">₹1.25L Cr</p>
              <p className="text-slate-400 text-[10px] font-black uppercase tracking-widest">Active Pool Volume</p>
            </div>
            <div className="space-y-1">
              <p className="text-4xl sm:text-5xl font-black text-violet-400 tracking-tight font-heading">30,000+</p>
              <p className="text-slate-400 text-[10px] font-black uppercase tracking-widest">Active SME Bidders</p>
            </div>
          </div>
        </div>
      </section>

      {/* Feature Grid */}
      <section className="py-28 max-w-7xl mx-auto px-6 sm:px-8">
        <div className="text-center max-w-3xl mx-auto mb-20">
          <h2 className="text-3xl sm:text-5xl font-black tracking-tight text-white font-heading">
            Enterprise Bid-Suite Features
          </h2>
          <p className="text-slate-400 mt-4 font-medium text-sm max-w-xl mx-auto">
            Ditch the chaos of disjointed state portal websites. Use one clean, fast, unified dashboard with full compliance indices.
          </p>
        </div>

        <div className="grid md:grid-cols-3 gap-8">
          {/* Card 1 */}
          <div className="glass-panel-dark rounded-2xl p-8 hover-glow">
            <div className="bg-blue-500/10 text-blue-400 p-3.5 rounded-xl w-fit border border-blue-500/20">
              <Search className="w-5 h-5" />
            </div>
            <h3 className="text-lg font-black mt-6 text-white uppercase tracking-wider">Aggregated Discovery</h3>
            <p className="text-slate-400 mt-2 text-xs leading-relaxed font-semibold">
              Consolidated listings from CPPP, PWD, and major municipal boards. Filter, bookmark, and save searches with lightning fast queries.
            </p>
          </div>

          {/* Card 2 */}
          <div className="glass-panel-dark rounded-2xl p-8 hover-glow">
            <div className="bg-emerald-500/10 text-emerald-400 p-3.5 rounded-xl w-fit border border-emerald-500/20">
              <TrendingUp className="w-5 h-5" />
            </div>
            <h3 className="text-lg font-black mt-6 text-white uppercase tracking-wider">AI Eligibility Match</h3>
            <p className="text-slate-400 mt-2 text-xs leading-relaxed font-semibold">
              Instantly check compatibility. Match credentials, MSME fee preferences, and turnover thresholds dynamically.
            </p>
          </div>

          {/* Card 3 */}
          <div className="glass-panel-dark rounded-2xl p-8 hover-glow">
            <div className="bg-yellow-500/10 text-yellow-400 p-3.5 rounded-xl w-fit border border-yellow-500/20">
              <FileText className="w-5 h-5" />
            </div>
            <h3 className="text-lg font-black mt-6 text-white uppercase tracking-wider">AI Document Drafting</h3>
            <p className="text-slate-400 mt-2 text-xs leading-relaxed font-semibold">
              Draft Cover Letters, Compliance Sheets, and technical outlines matching strict Indian procurement codes with Gemini templates.
            </p>
          </div>

          {/* Card 4 */}
          <div className="glass-panel-dark rounded-2xl p-8 hover-glow">
            <div className="bg-purple-500/10 text-purple-400 p-3.5 rounded-xl w-fit border border-purple-500/20">
              <Database className="w-5 h-5" />
            </div>
            <h3 className="text-lg font-black mt-6 text-white uppercase tracking-wider">Compliance Vault</h3>
            <p className="text-slate-400 mt-2 text-xs leading-relaxed font-semibold">
              Upload GSTs, MSME certs, and balance sheets. The AI extracts metadata, dates, and alerts you about expirations automatically.
            </p>
          </div>

          {/* Card 5 */}
          <div className="glass-panel-dark rounded-2xl p-8 hover-glow">
            <div className="bg-indigo-500/10 text-indigo-400 p-3.5 rounded-xl w-fit border border-indigo-500/20">
              <ShieldCheck className="w-5 h-5" />
            </div>
            <h3 className="text-lg font-black mt-6 text-white uppercase tracking-wider">AI Context Q&A</h3>
            <p className="text-slate-400 mt-2 text-xs leading-relaxed font-semibold">
              Ask questions directly against long RFP files. Find details about EMDs, warranty clauses, and payment schedules instantly.
            </p>
          </div>

          {/* Card 6 */}
          <div className="glass-panel-dark rounded-2xl p-8 hover-glow">
            <div className="bg-pink-500/10 text-pink-400 p-3.5 rounded-xl w-fit border border-pink-500/20">
              <Radio className="w-5 h-5" />
            </div>
            <h3 className="text-lg font-black mt-6 text-white uppercase tracking-wider">SMS & In-App Alerts</h3>
            <p className="text-slate-400 mt-2 text-xs leading-relaxed font-semibold">
              Get notified immediately on WhatsApp, SMS, or email when a highly compatible project in your sector goes public.
            </p>
          </div>
        </div>
      </section>

      {/* Pricing Section */}
      <section className="bg-[#070a12] py-28 border-t border-white/5">
        <div className="max-w-7xl mx-auto px-6 sm:px-8 text-center">
          <h2 className="text-3xl sm:text-5xl font-black tracking-tight text-white mb-4 font-heading">
            Simple SME Pricing Tiers
          </h2>
          <p className="text-slate-400 max-w-2xl mx-auto mb-20 font-medium text-sm">
            Unlock professional procurement intelligence. Upgrade, downgrade, or cancel anytime.
          </p>

          <div className="grid md:grid-cols-3 gap-8 text-left max-w-5xl mx-auto">
            {/* Starter Tier */}
            <div className="glass-panel-dark rounded-3xl p-8 flex flex-col justify-between border-white/5 relative hover:border-white/10 transition-all">
              <div>
                <p className="text-xs font-black uppercase tracking-wider text-slate-400">Starter</p>
                <div className="mt-4 space-y-1.5">
                  <div className="flex items-baseline gap-2">
                    <span className="text-xs text-slate-505 line-through font-bold">₹3,000</span>
                    <span className="text-4xl font-black text-white font-heading">₹2,000<span className="text-sm font-semibold text-slate-500">/mo</span></span>
                  </div>
                  <span className="text-[8.5px] font-black bg-amber-500 text-white px-2 py-0.5 rounded uppercase tracking-widest inline-block">
                    Save 33% (Special Introductory Offer)
                  </span>
                </div>
                <ul className="mt-8 space-y-4 text-xs font-bold text-slate-350">
                  <li className="flex items-center space-x-2.5">
                    <CheckCircle className="w-4 h-4 text-indigo-500 shrink-0" />
                    <span>Track up to 2 active states</span>
                  </li>
                  <li className="flex items-center space-x-2.5">
                    <CheckCircle className="w-4 h-4 text-indigo-500 shrink-0" />
                    <span>AI tender summary checklists</span>
                  </li>
                  <li className="flex items-center space-x-2.5">
                    <CheckCircle className="w-4 h-4 text-indigo-500 shrink-0" />
                    <span>Weekly WhatsApp notification checks</span>
                  </li>
                </ul>
              </div>
              <button
                onClick={() => setAuthMode("signup")}
                className="w-full mt-8 bg-white/5 hover:bg-white/10 text-white font-black text-xs uppercase tracking-widest py-3.5 rounded-xl transition-colors cursor-pointer border border-white/10 active:scale-95"
              >
                Start 10-day trial
              </button>
            </div>

            {/* Professional Tier */}
            <div className="bg-[#0b0f19] border-2 border-indigo-500 rounded-3xl p-8 relative flex flex-col justify-between shadow-2xl shadow-indigo-600/10">
              <div className="absolute top-0 right-8 -translate-y-1/2 bg-gradient-to-r from-blue-600 to-indigo-600 px-3.5 py-1.5 rounded-full text-[9px] font-black uppercase tracking-widest text-white border border-white/10">
                Most Emplaneled
              </div>
              <div>
                <p className="text-xs font-black uppercase tracking-wider text-indigo-400">Professional</p>
                <div className="mt-4 space-y-1.5">
                  <div className="flex items-baseline gap-2">
                    <span className="text-xs text-slate-505 line-through font-bold">₹10,000</span>
                    <span className="text-4xl font-black text-white font-heading">₹5,000<span className="text-sm font-semibold text-slate-500">/mo</span></span>
                  </div>
                  <span className="text-[8.5px] font-black bg-amber-500 text-white px-2 py-0.5 rounded uppercase tracking-widest inline-block">
                    Save 50% (SME Growth Exemption)
                  </span>
                </div>
                <ul className="mt-8 space-y-4 text-xs font-bold text-slate-300">
                  <li className="flex items-center space-x-2.5">
                    <CheckCircle className="w-4 h-4 text-indigo-500 shrink-0" />
                    <span>Unlimited Portal Crawling</span>
                  </li>
                  <li className="flex items-center space-x-2.5">
                    <CheckCircle className="w-4 h-4 text-indigo-500 shrink-0" />
                    <span>Unlimited AI Bid Proposal Drafts</span>
                  </li>
                  <li className="flex items-center space-x-2.5">
                    <CheckCircle className="w-4 h-4 text-indigo-500 shrink-0" />
                    <span>Full Vector RAG Document Q&A</span>
                  </li>
                  <li className="flex items-center space-x-2.5">
                    <CheckCircle className="w-4 h-4 text-indigo-500 shrink-0" />
                    <span>Real-time SMS & WhatsApp alerts</span>
                  </li>
                </ul>
              </div>
              <button
                onClick={() => setAuthMode("signup")}
                className="w-full mt-8 bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-500 hover:to-indigo-500 text-white font-black text-xs uppercase tracking-widest py-3.5 rounded-xl transition-all cursor-pointer border border-white/10 active:scale-95 shadow-md shadow-indigo-600/10"
              >
                Go Professional
              </button>
            </div>

            {/* Enterprise Tier */}
            <div className="glass-panel-dark rounded-3xl p-8 flex flex-col justify-between border-white/5 relative hover:border-white/10 transition-all">
              <div>
                <p className="text-xs font-black uppercase tracking-wider text-slate-400">Enterprise</p>
                <div className="mt-4 space-y-1.5">
                  <div className="flex items-baseline gap-2">
                    <span className="text-xs text-slate-505 line-through font-bold">₹25,000</span>
                    <span className="text-4xl font-black text-white font-heading">₹10,000<span className="text-sm font-semibold text-slate-500">/mo</span></span>
                  </div>
                  <span className="text-[8.5px] font-black bg-amber-500 text-white px-2 py-0.5 rounded uppercase tracking-widest inline-block">
                    Save 60% (Consortium rate)
                  </span>
                </div>
                <ul className="mt-8 space-y-4 text-xs font-bold text-slate-350">
                  <li className="flex items-center space-x-2.5">
                    <CheckCircle className="w-4 h-4 text-indigo-500 shrink-0" />
                    <span>All Professional channels included</span>
                  </li>
                  <li className="flex items-center space-x-2.5">
                    <CheckCircle className="w-4 h-4 text-indigo-500 shrink-0" />
                    <span>Dedicated Integration Consultant</span>
                  </li>
                  <li className="flex items-center space-x-2.5">
                    <CheckCircle className="w-4 h-4 text-indigo-500 shrink-0" />
                    <span>Custom API access & direct webhook feeds</span>
                  </li>
                </ul>
              </div>
              <button
                onClick={() => setAuthMode("signup")}
                className="w-full mt-8 bg-white/5 hover:bg-white/10 text-white font-black text-xs uppercase tracking-widest py-3.5 rounded-xl transition-colors cursor-pointer border border-white/10 active:scale-95"
              >
                Contact Sales Support
              </button>
            </div>
          </div>
        </div>
      </section>

      {/* Footer */}
      <footer className="border-t border-white/5 py-14 bg-[#070a12] text-slate-500 text-[11px] font-bold uppercase tracking-wider">
        <div className="max-w-7xl mx-auto px-6 sm:px-8 flex flex-col md:flex-row items-center justify-between gap-6">
          <div className="flex items-center space-x-2">
            <span className="font-extrabold text-slate-300 tracking-tight text-sm uppercase">TenderAI</span>
            <span>© 2026. Made for Indian e-procurement agencies & vendors.</span>
          </div>
          <div className="flex space-x-6">
            <a href="#" className="hover:text-slate-300">Terms</a>
            <a href="#" className="hover:text-slate-300">Privacy</a>
            <a href="#" className="hover:text-slate-300">Compliance guidelines</a>
          </div>
        </div>
      </footer>

      {/* Auth Modals Overlay */}
      {authMode !== "none" && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/85 backdrop-blur-md p-4 transition-all">
          <div className="bg-[#0b0f19] border border-white/10 rounded-2xl w-full max-w-md p-7 relative shadow-2xl text-slate-100 animate-slide-up">
            {/* Close button */}
            <button
              onClick={() => {
                setAuthMode("none");
                setErrorMsg(null);
                setSuccessMsg(null);
              }}
              className="absolute top-4.5 right-4.5 text-slate-400 hover:text-white transition-colors cursor-pointer"
            >
              <X className="w-5 h-5" />
            </button>

            {/* ERROR AND SUCCESS ALERTS */}
            {errorMsg && (
              <div className="mb-4 bg-red-950/40 border border-red-800/60 p-3 rounded-lg flex items-start space-x-2 text-xs text-red-400">
                <AlertCircle className="w-4 h-4 mt-0.5 shrink-0" />
                <span>{errorMsg}</span>
              </div>
            )}
            {successMsg && (
              <div className="mb-4 bg-emerald-950/40 border border-emerald-800/60 p-3 rounded-lg flex items-start space-x-2 text-xs text-emerald-400">
                <CheckCircle className="w-4 h-4 mt-0.5 shrink-0" />
                <span>{successMsg}</span>
              </div>
            )}

            {authMode === "signin" && (
              <div>
                <div className="flex items-center space-x-2 text-blue-400 mb-2">
                  <Sparkles className="w-4 h-4 text-blue-400" />
                  <span className="text-[10px] font-black uppercase tracking-widest">Secure Client Access</span>
                </div>
                <h3 className="text-xl font-black text-white tracking-tight font-heading">WELCOME TO TENDERAI</h3>
                <p className="text-xs text-slate-450 mt-1 mb-6 font-semibold">
                  Log in to search and coordinate public sector tenders.
                </p>

                <form onSubmit={handleSignInSubmit} className="space-y-4">
                  <div>
                    <label className="block text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1.5">Corporate Email Address</label>
                    <div className="relative">
                      <Mail className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-500" />
                      <input
                        type="email"
                        required
                        value={email}
                        onChange={(e) => setEmail(e.target.value)}
                        placeholder="e.g. director@company.in"
                        className="w-full bg-[#070a12] border border-white/5 rounded-xl py-3 pl-11 pr-4 text-xs text-white placeholder-slate-600 focus:outline-none focus:border-indigo-500 transition-all font-semibold"
                      />
                    </div>
                  </div>

                  <div>
                    <div className="flex justify-between items-center mb-1.5">
                      <label className="block text-[10px] font-black text-slate-400 uppercase tracking-widest">Secret Password</label>
                      <button
                        type="button"
                        onClick={() => {
                          setAuthMode("forgot");
                          setErrorMsg(null);
                          setSuccessMsg(null);
                        }}
                        className="text-[10px] text-indigo-400 font-extrabold uppercase hover:underline cursor-pointer"
                      >
                        Forgot?
                      </button>
                    </div>
                    <div className="relative">
                      <Lock className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-500" />
                      <input
                        type="password"
                        required
                        value={password}
                        onChange={(e) => setPassword(e.target.value)}
                        placeholder="••••••••••••"
                        className="w-full bg-[#070a12] border border-white/5 rounded-xl py-3 pl-11 pr-4 text-xs text-white placeholder-slate-600 focus:outline-none focus:border-indigo-500 transition-all font-mono"
                      />
                    </div>
                  </div>

                  {/* Demo account button */}
                  <div className="text-right">
                    <button
                      type="button"
                      onClick={loadDemoCredentials}
                      className="text-[10px] text-indigo-400 hover:text-indigo-300 font-extrabold uppercase tracking-wider transition-colors cursor-pointer"
                    >
                      Use Demo Credentials
                    </button>
                  </div>

                  <button
                    type="submit"
                    disabled={isLoading}
                    className="w-full bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-500 hover:to-indigo-500 text-white font-black text-xs uppercase tracking-widest py-3.5 rounded-xl transition-all shadow-lg hover:shadow-indigo-500/20 active:scale-95 cursor-pointer flex justify-center items-center h-11 border border-white/10"
                  >
                    {isLoading ? "Authenticating Session..." : "Verify & Sign In"}
                  </button>

                  <div className="relative my-4 text-center">
                    <hr className="border-white/5" />
                    <span className="bg-[#0b0f19] px-3 text-[9px] text-slate-550 absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 uppercase tracking-widest font-black">Or secure link</span>
                  </div>

                  <div className="grid grid-cols-2 gap-3">
                    <button
                      type="button"
                      onClick={() => handleOAuthSim("google")}
                      className="bg-[#070a12] border border-white/5 hover:bg-white/5 text-slate-200 font-black py-2.5 rounded-xl text-[10px] uppercase tracking-widest transition-all cursor-pointer flex items-center justify-center space-x-1.5"
                    >
                      <svg className="w-3.5 h-3.5" viewBox="0 0 24 24">
                        <path fill="currentColor" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" />
                        <path fill="currentColor" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" />
                        <path fill="currentColor" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" />
                        <path fill="currentColor" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" />
                      </svg>
                      <span>Google API</span>
                    </button>

                    <button
                      type="button"
                      onClick={() => handleOAuthSim("microsoft")}
                      className="bg-[#070a12] border border-white/5 hover:bg-white/5 text-slate-200 font-black py-2.5 rounded-xl text-[10px] uppercase tracking-widest transition-all cursor-pointer flex items-center justify-center space-x-1.5"
                    >
                      <svg className="w-3.5 h-3.5 text-blue-400" viewBox="0 0 23 23">
                        <path fill="currentColor" d="M0 0h11v11H0zM12 0h11v11H12zM0 12h11v11H0zM12 12h11v11H12z" />
                      </svg>
                      <span>Microsoft AD</span>
                    </button>
                  </div>
                </form>

                <div className="mt-6 text-center text-[10.5px] text-slate-500 font-bold uppercase tracking-wider">
                  New to TenderAI?{" "}
                  <button
                    onClick={() => {
                      setAuthMode("signup");
                      setErrorMsg(null);
                      setSuccessMsg(null);
                    }}
                    className="text-indigo-400 hover:underline font-black cursor-pointer ml-1"
                  >
                    Register Account
                  </button>
                </div>
              </div>
            )}

            {authMode === "signup" && (
              <div>
                <div className="flex items-center space-x-2 text-indigo-400 mb-2">
                  <Sparkles className="w-4 h-4 text-indigo-400" />
                  <span className="text-[10px] font-black uppercase tracking-widest">Enterprise Registration</span>
                </div>
                <h3 className="text-xl font-black text-white tracking-tight font-heading">CREATE COMPANY PROFILE</h3>
                <p className="text-xs text-slate-450 mt-1 mb-5 font-semibold">
                  Register your business details to enable smart contract indexing.
                </p>

                <form onSubmit={handleSignUpSubmit} className="space-y-3.5">
                  <div>
                    <label className="block text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1">Your Full Name *</label>
                    <div className="relative">
                      <UserIcon className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-500" />
                      <input
                        type="text"
                        required
                        value={name}
                        onChange={(e) => setName(e.target.value)}
                        placeholder="e.g. Ramesh Sharma"
                        className="w-full bg-[#070a12] border border-white/5 rounded-xl py-2.5 pl-11 pr-4 text-xs text-white placeholder-slate-600 focus:outline-none focus:border-indigo-500 transition-all font-semibold"
                      />
                    </div>
                  </div>

                  <div>
                    <label className="block text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1">Corporate Email Address *</label>
                    <div className="relative">
                      <Mail className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-500" />
                      <input
                        type="email"
                        required
                        value={email}
                        onChange={(e) => setEmail(e.target.value)}
                        placeholder="e.g. director@company.in"
                        className="w-full bg-[#070a12] border border-white/5 rounded-xl py-2.5 pl-11 pr-4 text-xs text-white placeholder-slate-600 focus:outline-none focus:border-indigo-500 transition-all font-semibold"
                      />
                    </div>
                  </div>

                  <div className="grid grid-cols-2 gap-3.5">
                    <div>
                      <label className="block text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1">Contact Phone</label>
                      <input
                        type="text"
                        value={phone}
                        onChange={(e) => setPhone(e.target.value)}
                        placeholder="e.g. +91 98765"
                        className="w-full bg-[#070a12] border border-white/5 rounded-xl py-2.5 px-3 text-xs text-white placeholder-slate-600 focus:outline-none focus:border-indigo-500 transition-all font-semibold"
                      />
                    </div>

                    <div>
                      <label className="block text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1">Organization ID</label>
                      <input
                        type="text"
                        value={organizationId}
                        onChange={(e) => setOrganizationId(e.target.value)}
                        placeholder="e.g. org_sme_1"
                        className="w-full bg-[#070a12] border border-white/5 rounded-xl py-2.5 px-3 text-xs text-white placeholder-slate-600 focus:outline-none focus:border-indigo-500 transition-all font-semibold"
                      />
                    </div>
                  </div>

                  <div>
                    <label className="block text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1">Default Platform Role</label>
                    <select
                      value={role}
                      onChange={(e) => setRole(e.target.value as any)}
                      className="w-full bg-[#070a12] border border-white/5 rounded-xl py-2.5 px-3.5 text-xs text-slate-200 focus:outline-none focus:border-indigo-500 transition-all font-semibold cursor-pointer"
                    >
                      <option value="USER">Individual SME Contractor</option>
                      <option value="ORGANIZATION_ADMIN">Corporate Team Manager</option>
                      <option value="ADMIN">System Auditor Account</option>
                    </select>
                  </div>

                  <div>
                    <label className="block text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1">Secure Account Password *</label>
                    <div className="relative">
                      <Lock className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-500" />
                      <input
                        type="password"
                        required
                        value={password}
                        onChange={(e) => setPassword(e.target.value)}
                        placeholder="••••••••••••"
                        className="w-full bg-[#070a12] border border-white/5 rounded-xl py-2.5 pl-11 pr-4 text-xs text-white placeholder-slate-600 focus:outline-none focus:border-indigo-500 transition-all font-mono"
                      />
                    </div>
                  </div>

                  <button
                    type="submit"
                    disabled={isLoading}
                    className="w-full bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-500 hover:to-indigo-500 text-white font-black text-xs uppercase tracking-widest py-3.5 rounded-xl transition-all shadow-lg hover:shadow-indigo-500/20 active:scale-95 cursor-pointer flex justify-center items-center h-11 border border-white/10 mt-4"
                  >
                    {isLoading ? "Provisioning Profile..." : "Register & Start Onboarding"}
                  </button>
                </form>

                <div className="mt-5 text-center text-[10.5px] text-slate-500 font-bold uppercase tracking-wider">
                  Already registered?{" "}
                  <button
                    onClick={() => {
                      setAuthMode("signin");
                      setErrorMsg(null);
                      setSuccessMsg(null);
                    }}
                    className="text-indigo-400 hover:underline font-black cursor-pointer ml-1"
                  >
                    Sign In instead
                  </button>
                </div>
              </div>
            )}

            {authMode === "verify" && (
              <div>
                <div className="flex items-center space-x-2 text-violet-400 mb-2">
                  <ShieldCheck className="w-4 h-4 text-violet-400" />
                  <span className="text-[10px] font-black uppercase tracking-widest">Verification Required</span>
                </div>
                <h3 className="text-xl font-black text-white tracking-tight font-heading">CONFIRM WORKSPACE EMAIL</h3>
                <p className="text-xs text-slate-450 mt-1 mb-5 font-semibold leading-relaxed">
                  A verification token code has been simulated for <strong className="text-indigo-400">{email || "your account"}</strong>. Check the node server terminal trace console log to copy the token!
                </p>

                <form onSubmit={handleVerifySubmit} className="space-y-4">
                  <div>
                    <label className="block text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1.5 text-center">Enter Verification Code</label>
                    <input
                      type="text"
                      required
                      value={verifyToken}
                      onChange={(e) => setVerifyToken(e.target.value)}
                      placeholder="Paste 32-character hex token from terminal log"
                      className="w-full bg-[#070a12] border border-white/5 rounded-xl py-3 px-4 text-center font-mono text-xs text-blue-400 focus:outline-none focus:border-indigo-500"
                    />
                  </div>

                  <button
                    type="submit"
                    disabled={isLoading}
                    className="w-full bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-500 hover:to-indigo-500 text-white font-black text-xs uppercase tracking-widest py-3.5 rounded-xl transition-all shadow-lg active:scale-95 cursor-pointer h-11 border border-white/10"
                  >
                    {isLoading ? "Confirming Code..." : "Confirm Verification"}
                  </button>

                  <div className="flex justify-between items-center text-[10.5px] font-bold uppercase tracking-wider mt-4">
                    <button
                      type="button"
                      onClick={async () => {
                        setIsLoading(true);
                        setErrorMsg(null);
                        setSuccessMsg(null);
                        try {
                          const res = await fetch("/api/auth/resend-verification", {
                            method: "POST",
                            headers: { "Content-Type": "application/json" },
                            body: JSON.stringify({ email })
                          });
                          const d = await res.json();
                          if (res.ok) setSuccessMsg(d.message);
                          else setErrorMsg(d.error);
                        } catch(e) {
                          setErrorMsg("Error communicating with servers.");
                        } finally {
                          setIsLoading(false);
                        }
                      }}
                      className="text-slate-400 hover:text-white cursor-pointer"
                    >
                      Resend Link
                    </button>
                    <button
                      type="button"
                      onClick={() => setAuthMode("signin")}
                      className="text-indigo-400 hover:underline cursor-pointer"
                    >
                      Return to Sign In
                    </button>
                  </div>
                </form>
              </div>
            )}

            {authMode === "forgot" && (
              <div>
                <div className="flex items-center space-x-2 text-amber-400 mb-2">
                  <Lock className="w-4 h-4 text-amber-450" />
                  <span className="text-[10px] font-black uppercase tracking-widest">Credentials Recovery</span>
                </div>
                <h3 className="text-xl font-black text-white tracking-tight font-heading">FORGOTTEN PASSWORD</h3>
                <p className="text-xs text-slate-455 mt-1 mb-5 font-semibold leading-relaxed">
                  Enter your corporate email. The server will simulate a development credentials recovery link.
                </p>

                <form onSubmit={handleForgotSubmit} className="space-y-4">
                  <div>
                    <label className="block text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1.5">Corporate Email Address</label>
                    <div className="relative">
                      <Mail className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-500" />
                      <input
                        type="email"
                        required
                        value={email}
                        onChange={(e) => setEmail(e.target.value)}
                        placeholder="e.g. demo@tenderai.in"
                        className="w-full bg-[#070a12] border border-white/5 rounded-xl py-3 pl-11 pr-4 text-xs text-white placeholder-slate-600 focus:outline-none focus:border-indigo-500 transition-all font-semibold"
                      />
                    </div>
                  </div>

                  <button
                    type="submit"
                    disabled={isLoading}
                    className="w-full bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-500 hover:to-indigo-500 text-white font-black text-xs uppercase tracking-widest py-3.5 rounded-xl transition-all shadow-lg active:scale-95 cursor-pointer h-11 border border-white/10"
                  >
                    {isLoading ? "Generating Link..." : "Retrieve Recovery Link"}
                  </button>

                  {resetToken && (
                    <div className="mt-4 p-4 bg-[#070a12] rounded-xl border border-white/5 text-center space-y-2">
                      <span className="block text-[9px] text-slate-550 uppercase font-black tracking-widest">Recovery Token Log</span>
                      <code className="text-[10.5px] font-mono text-amber-400 block break-all leading-normal bg-black/35 p-2 rounded border border-white/5">{resetToken}</code>
                      <button
                        type="button"
                        onClick={() => {
                          setAuthMode("reset");
                          setErrorMsg(null);
                          setSuccessMsg(null);
                        }}
                        className="mt-2 text-[10.5px] text-indigo-400 hover:underline font-black uppercase tracking-wider block mx-auto cursor-pointer"
                      >
                        Commit password update →
                      </button>
                    </div>
                  )}

                  <div className="text-center mt-4">
                    <button
                      type="button"
                      onClick={() => {
                        setAuthMode("signin");
                        setErrorMsg(null);
                        setSuccessMsg(null);
                      }}
                      className="text-[10.5px] text-slate-400 hover:text-white font-bold uppercase tracking-wider cursor-pointer"
                    >
                      Cancel & Return
                    </button>
                  </div>
                </form>
              </div>
            )}

            {authMode === "reset" && (
              <div>
                <div className="flex items-center space-x-2 text-emerald-400 mb-2">
                  <Lock className="w-4 h-4 text-emerald-450" />
                  <span className="text-[10px] font-black uppercase tracking-widest">Update Credentials</span>
                </div>
                <h3 className="text-xl font-black text-white tracking-tight font-heading">SET SECURE PASSWORD</h3>
                <p className="text-xs text-slate-455 mt-1 mb-5 font-semibold">
                  Confirm the recovery token log values to submit new credentials.
                </p>

                <form onSubmit={handleResetSubmit} className="space-y-4">
                  <div>
                    <label className="block text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1.5 text-center">Reset Token</label>
                    <input
                      type="text"
                      required
                      value={resetToken}
                      onChange={(e) => setResetToken(e.target.value)}
                      placeholder="Enter recovery token"
                      className="w-full bg-[#070a12] border border-white/5 rounded-xl py-3 px-4 text-xs font-mono text-amber-400 text-center"
                    />
                  </div>

                  <div>
                    <label className="block text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1.5">New Account Password</label>
                    <input
                      type="password"
                      required
                      value={password}
                      onChange={(e) => setPassword(e.target.value)}
                      placeholder="••••••••••••"
                      className="w-full bg-[#070a12] border border-white/5 rounded-xl py-3 px-4 text-xs text-white"
                    />
                  </div>

                  <button
                    type="submit"
                    disabled={isLoading}
                    className="w-full bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-500 hover:to-indigo-500 text-white font-black text-xs uppercase tracking-widest py-3.5 rounded-xl transition-all shadow-lg active:scale-95 cursor-pointer h-11 border border-white/10"
                  >
                    {isLoading ? "Saving changes..." : "Commit Secure Password"}
                  </button>

                  <div className="text-center mt-4">
                    <button
                      type="button"
                      onClick={() => setAuthMode("signin")}
                      className="text-[10.5px] text-slate-400 hover:text-white font-bold uppercase tracking-wider cursor-pointer"
                    >
                      Back to Sign In
                    </button>
                  </div>
                </form>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
