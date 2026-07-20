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
    <div className="bg-slate-900 text-white min-h-screen font-sans selection:bg-blue-600 selection:text-white">
      {/* Navbar */}
      <header className="border-b border-slate-800 backdrop-blur bg-slate-900/80 sticky top-0 z-50">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 h-18 flex items-center justify-between">
          <div className="flex items-center space-x-3">
            <div className="bg-[#1B4FD8] p-2 rounded-xl text-white font-bold text-xl flex items-center justify-center shadow-lg shadow-blue-500/30 w-10 h-10">
              T
            </div>
            <span className="font-bold text-2xl tracking-tight bg-gradient-to-r from-blue-400 to-indigo-400 bg-clip-text text-transparent">
              TenderAI
            </span>
          </div>
          <div className="flex items-center space-x-4">
            <button
              onClick={() => setAuthMode("signin")}
              className="text-slate-300 hover:text-white font-medium text-sm transition-colors cursor-pointer"
            >
              Sign In
            </button>
            <button
              onClick={() => setAuthMode("signup")}
              className="bg-[#1B4FD8] hover:bg-blue-600 text-white font-semibold text-sm px-5 py-2.5 rounded-xl shadow-lg shadow-blue-500/20 transition-all cursor-pointer"
            >
              Get Started
            </button>
          </div>
        </div>
      </header>


      {/* Hero Section */}
      <section className="relative overflow-hidden py-24 md:py-32">
        <div className="absolute inset-0 bg-[radial-gradient(circle_at_top_right,_var(--tw-gradient-stops))] from-blue-900/40 via-transparent to-transparent opacity-70"></div>
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 relative z-10 text-center">
          <div className="inline-flex items-center space-x-2 bg-blue-500/10 border border-blue-500/30 px-3 py-1.5 rounded-full text-blue-400 text-xs font-semibold uppercase tracking-wider mb-8">
            <Radio className="w-3.5 h-3.5 animate-pulse text-blue-500" />
            <span>90+ Portals Monitored Real-time</span>
          </div>

          <h1 className="text-4xl sm:text-6xl font-bold tracking-tight text-white max-w-4xl mx-auto leading-tight">
            Win More Government Tenders with{" "}
            <span className="bg-gradient-to-r from-blue-400 via-indigo-400 to-emerald-400 bg-clip-text text-transparent">
              Enterprise AI
            </span>
          </h1>

          <p className="mt-6 text-lg sm:text-xl text-slate-300 max-w-2xl mx-auto leading-relaxed">
            Discover matching CPPP, GeM, and state PWD contracts, auto-generate bid documents, and complete compliance tasks in minutes.
          </p>

          <div className="mt-10 flex flex-col sm:flex-row items-center justify-center gap-4">
            <button
              onClick={() => setAuthMode("signin")}
              className="w-full sm:w-auto bg-blue-600 hover:bg-blue-500 text-white font-semibold px-8 py-4 rounded-xl shadow-lg hover:shadow-blue-500/20 active:scale-[0.98] transition-all flex items-center justify-center space-x-2 group cursor-pointer"
            >
              <span>Explore Active Tenders</span>
              <ArrowRight className="w-5 h-5 group-hover:translate-x-1 transition-transform" />
            </button>
            <button
              onClick={() => setAuthMode("signup")}
              className="w-full sm:w-auto bg-slate-800 hover:bg-slate-700/80 text-white border border-slate-700 font-semibold px-8 py-4 rounded-xl transition-all cursor-pointer"
            >
              Request Free Consultation
            </button>
          </div>
        </div>
      </section>

      {/* Stats Bar */}
      <section className="border-y border-slate-800 bg-slate-900/50 backdrop-blur-sm py-10">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="grid grid-cols-2 md:grid-cols-4 gap-8 text-center">
            <div>
              <p className="text-3xl sm:text-4xl font-extrabold text-blue-400">1.9M+</p>
              <p className="text-slate-400 text-sm mt-1">Tenders Analyzed Annually</p>
            </div>
            <div>
              <p className="text-3xl sm:text-4xl font-extrabold text-emerald-400">90+</p>
              <p className="text-slate-400 text-sm mt-1">Indian Portals Crawled</p>
            </div>
            <div>
              <p className="text-3xl sm:text-4xl font-extrabold text-yellow-400">₹1.25L Cr</p>
              <p className="text-slate-400 text-sm mt-1">Active Contracts Volume</p>
            </div>
            <div>
              <p className="text-3xl sm:text-4xl font-extrabold text-indigo-400">30,000+</p>
              <p className="text-slate-400 text-sm mt-1">Active SME Bidders</p>
            </div>
          </div>
        </div>
      </section>

      {/* Feature Grid */}
      <section className="py-24 max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="text-center max-w-3xl mx-auto mb-16">
          <h2 className="text-3xl sm:text-4xl font-bold tracking-tight">
            Integrated Suite for Government Bidding
          </h2>
          <p className="text-slate-400 mt-4">
            Replace manual scanning of disjointed state PWD PDFs with unified intelligent RAG workspace.
          </p>
        </div>

        <div className="grid md:grid-cols-3 gap-8">
          {/* Card 1 */}
          <div className="bg-slate-800/40 border border-slate-800 rounded-2xl p-8 hover:border-slate-700 transition-all">
            <div className="bg-blue-500/10 text-blue-400 p-3 rounded-xl w-fit">
              <Search className="w-6 h-6" />
            </div>
            <h3 className="text-xl font-bold mt-6 text-white">Aggregated Discovery Feed</h3>
            <p className="text-slate-300 mt-2 text-sm leading-relaxed">
              Consolidate listings from central CPPP, state-wide Road Construction directories, and public sectors in a standard feed.
            </p>
          </div>

          {/* Card 2 */}
          <div className="bg-slate-800/40 border border-slate-800 rounded-2xl p-8 hover:border-slate-700 transition-all">
            <div className="bg-emerald-500/10 text-emerald-400 p-3 rounded-xl w-fit">
              <TrendingUp className="w-6 h-6" />
            </div>
            <h3 className="text-xl font-bold mt-6 text-white">AI Compatibility Match</h3>
            <p className="text-slate-300 mt-2 text-sm leading-relaxed">
              Verify compatibility based on criteria checks: ISO standards, capital turnovers, operating limits and past project volumes.
            </p>
          </div>

          {/* Card 3 */}
          <div className="bg-slate-800/40 border border-slate-800 rounded-2xl p-8 hover:border-slate-700 transition-all">
            <div className="bg-yellow-500/10 text-yellow-400 p-3 rounded-xl w-fit">
              <FileText className="w-6 h-6" />
            </div>
            <h3 className="text-xl font-bold mt-6 text-white">AI Bid Document Drafts</h3>
            <p className="text-slate-300 mt-2 text-sm leading-relaxed">
              Generate formatted Cover Letters, Technical Compliance grids, and estimate BOQs structured to match Indian bidding codes.
            </p>
          </div>

          {/* Card 4 */}
          <div className="bg-slate-800/40 border border-slate-800 rounded-2xl p-8 hover:border-slate-700 transition-all">
            <div className="bg-purple-500/10 text-purple-400 p-3 rounded-xl w-fit">
              <Database className="w-6 h-6" />
            </div>
            <h3 className="text-xl font-bold mt-6 text-white">Document Compliance Vault</h3>
            <p className="text-slate-300 mt-2 text-sm leading-relaxed">
              Upload company credentials, tax GSTs, MSME sheets, and trace balance balances. Get expiry visual alerts dynamically.
            </p>
          </div>

          {/* Card 5 */}
          <div className="bg-slate-800/40 border border-slate-800 rounded-2xl p-8 hover:border-slate-700 transition-all">
            <div className="bg-indigo-500/10 text-indigo-400 p-3 rounded-xl w-fit">
              <ShieldCheck className="w-6 h-6" />
            </div>
            <h3 className="text-xl font-bold mt-6 text-white">RAG Citations Q&A</h3>
            <p className="text-slate-300 mt-2 text-sm leading-relaxed">
              Ask questions naturally: “What is the EMD?”, “How is payment released?”. See responses highlighted visually in the document source.
            </p>
          </div>

          {/* Card 6 */}
          <div className="bg-slate-800/40 border border-slate-800 rounded-2xl p-8 hover:border-slate-700 transition-all">
            <div className="bg-pink-500/10 text-pink-400 p-3 rounded-xl w-fit">
              <Radio className="w-6 h-6" />
            </div>
            <h3 className="text-xl font-bold mt-6 text-white">WhatsApp & SMS Alerts</h3>
            <p className="text-slate-300 mt-2 text-sm leading-relaxed">
              Get immediate alerts when a high-compatibility tender in your operational sector goes public. Retain top edge.
            </p>
          </div>
        </div>
      </section>

      {/* Pricing Section */}
      <section className="bg-slate-950 py-24 border-t border-slate-800">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 text-center">
          <h2 className="text-3xl sm:text-4xl font-bold tracking-tight text-white mb-4">
            Accelerate Growth with Simple SME Pricing
          </h2>
          <p className="text-slate-400 max-w-2xl mx-auto mb-16">
            Pick a tier built for growing Indian contracting ventures. Cancel or transition anytime.
          </p>

          <div className="grid md:grid-cols-3 gap-8 text-left max-w-5xl mx-auto">
            {/* Starter Tier */}
            <div className="bg-slate-900 border border-slate-800 rounded-2xl p-8 relative flex flex-col justify-between">
              <div>
                <p className="text-sm font-semibold uppercase tracking-wider text-slate-400">Starter</p>
                <div className="mt-4 space-y-1">
                  <div className="flex items-baseline gap-2">
                    <span className="text-sm text-slate-500 line-through font-medium">₹3,000</span>
                    <span className="text-4xl font-extrabold text-white">₹2,000<span className="text-lg font-normal text-slate-400">/mo</span></span>
                  </div>
                  <span className="text-[9px] font-bold bg-amber-500 text-white px-2 py-0.5 rounded uppercase tracking-wider inline-block">
                    Huge Discount Applied (Save 33%)
                  </span>
                </div>
                <ul className="mt-8 space-y-4 text-sm text-slate-300">
                  <li className="flex items-center space-x-2">
                    <CheckCircle className="w-4 h-4 text-blue-500" />
                    <span>Track up to 2 active states</span>
                  </li>
                  <li className="flex items-center space-x-2">
                    <CheckCircle className="w-4 h-4 text-blue-500" />
                    <span>AI tender summary checklists</span>
                  </li>
                  <li className="flex items-center space-x-2">
                    <CheckCircle className="w-4 h-4 text-blue-500" />
                    <span>Weekly WhatsApp notification checks</span>
                  </li>
                </ul>
              </div>
              <button
                onClick={() => setAuthMode("signup")}
                className="w-full mt-8 bg-slate-800 hover:bg-slate-705 text-white font-semibold py-3 rounded-lg transition-colors cursor-pointer"
              >
                Start Free Starter Trial
              </button>
            </div>

            {/* Professional Tier */}
            <div className="bg-slate-900 border-2 border-blue-600 rounded-2xl p-8 relative flex flex-col justify-between shadow-xl shadow-blue-500/10">
              <div className="absolute top-0 right-8 -translate-y-1/2 bg-blue-600 px-3 py-1 rounded-full text-xs font-bold uppercase tracking-wider text-white">
                Best Value
              </div>
              <div>
                <p className="text-sm font-semibold uppercase tracking-wider text-blue-400">Professional</p>
                <div className="mt-4 space-y-1">
                  <div className="flex items-baseline gap-2">
                    <span className="text-sm text-slate-500 line-through font-medium">₹10,000</span>
                    <span className="text-4xl font-extrabold text-white">₹5,000<span className="text-lg font-normal text-slate-400">/mo</span></span>
                  </div>
                  <span className="text-[9px] font-bold bg-amber-500 text-white px-2 py-0.5 rounded uppercase tracking-wider inline-block">
                    Huge Discount Applied (Save 50%)
                  </span>
                </div>
                <ul className="mt-8 space-y-4 text-sm text-slate-300">
                  <li className="flex items-center space-x-2">
                    <CheckCircle className="w-4 h-4 text-emerald-400" />
                    <span>Unlimited Portal Crawling</span>
                  </li>
                  <li className="flex items-center space-x-2">
                    <CheckCircle className="w-4 h-4 text-emerald-400" />
                    <span>Unlimited AI Bid Proposal Drafts</span>
                  </li>
                  <li className="flex items-center space-x-2">
                    <CheckCircle className="w-4 h-4 text-emerald-400" />
                    <span>Full Vector RAG Document Q&A</span>
                  </li>
                  <li className="flex items-center space-x-2">
                    <CheckCircle className="w-4 h-4 text-emerald-400" />
                    <span>Real-time SMS & Email dispatch</span>
                  </li>
                </ul>
              </div>
              <button
                onClick={() => setAuthMode("signup")}
                className="w-full mt-8 bg-blue-600 hover:bg-blue-500 text-white font-semibold py-3 rounded-lg transition-colors cursor-pointer"
              >
                Upgrade to Professional
              </button>
            </div>

            {/* Enterprise Tier */}
            <div className="bg-slate-900 border border-slate-800 rounded-2xl p-8 relative flex flex-col justify-between">
              <div>
                <p className="text-sm font-semibold uppercase tracking-wider text-slate-400">Enterprise</p>
                <div className="mt-4 space-y-1">
                  <div className="flex items-baseline gap-2">
                    <span className="text-sm text-slate-500 line-through font-medium">₹25,000</span>
                    <span className="text-4xl font-extrabold text-white">₹10,000<span className="text-lg font-normal text-slate-400">/mo</span></span>
                  </div>
                  <span className="text-[9px] font-bold bg-amber-500 text-white px-2 py-0.5 rounded uppercase tracking-wider inline-block">
                    Huge Discount Applied (Save 60%)
                  </span>
                </div>
                <ul className="mt-8 space-y-4 text-sm text-slate-300">
                  <li className="flex items-center space-x-2">
                    <CheckCircle className="w-4 h-4 text-blue-500" />
                    <span>All Professional channels included</span>
                  </li>
                  <li className="flex items-center space-x-2">
                    <CheckCircle className="w-4 h-4 text-blue-500" />
                    <span>Dedicated Integration Consultant</span>
                  </li>
                  <li className="flex items-center space-x-2">
                    <CheckCircle className="w-4 h-4 text-blue-500" />
                    <span>Custom API access keys</span>
                  </li>
                </ul>
              </div>
              <button
                onClick={() => setAuthMode("signup")}
                className="w-full mt-8 bg-slate-800 hover:bg-slate-705 text-white font-semibold py-3 rounded-lg transition-colors cursor-pointer"
              >
                Contact Sales Support
              </button>
            </div>
          </div>
        </div>
      </section>

      {/* Footer */}
      <footer className="border-t border-slate-850 py-12 bg-slate-950 text-slate-500 text-sm">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 flex flex-col md:flex-row items-center justify-between gap-6">
          <div className="flex items-center space-x-2">
            <span className="font-bold text-lg text-slate-300">TenderAI</span>
            <span>© 2026. Designed natively for Indian enterprises & contractors.</span>
          </div>
          <div className="flex space-x-6">
            <a href="#" className="hover:text-slate-300">Terms of Use</a>
            <a href="#" className="hover:text-slate-300">Privacy Policy</a>
            <a href="#" className="hover:text-slate-300">CPPP/GeM Compliance</a>
          </div>
        </div>
      </footer>

      {/* Auth Modals Overlay */}
      {authMode !== "none" && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/85 backdrop-blur-sm p-4 transition-all">
          <div className="bg-slate-900 border border-slate-800 rounded-2xl w-full max-w-md p-6 relative shadow-2xl text-slate-100">
            {/* Close button */}
            <button
              onClick={() => {
                setAuthMode("none");
                setErrorMsg(null);
                setSuccessMsg(null);
              }}
              className="absolute top-4 right-4 text-slate-400 hover:text-white transition-colors cursor-pointer"
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
              <div className="mb-4 bg-emerald-950/40 border border-emerald-800/60 p-3 rounded-lg flex items-start space-x-2 text-xs text-emerald-400 animate-pulse">
                <CheckCircle className="w-4 h-4 mt-0.5 shrink-0" />
                <span>{successMsg}</span>
              </div>
            )}

            {authMode === "signin" && (
              <div>
                <div className="flex items-center space-x-2 text-blue-400 mb-2">
                  <Sparkles className="w-5 h-5" />
                  <span className="text-xs font-bold uppercase tracking-wider">Secure Access Port</span>
                </div>
                <h3 className="text-xl font-bold text-white tracking-tight">Welcome to TenderAI</h3>
                <p className="text-xs text-slate-400 mt-1 mb-6">
                  Log in to track central and state government procurement tenders.
                </p>

                <form onSubmit={handleSignInSubmit} className="space-y-4">
                  <div>
                    <label className="block text-xs font-semibold text-slate-400 uppercase tracking-wider mb-1.5">Corporate Email</label>
                    <div className="relative">
                      <Mail className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-500" />
                      <input
                        type="email"
                        required
                        value={email}
                        onChange={(e) => setEmail(e.target.value)}
                        placeholder="e.g. director@company.in"
                        className="w-full bg-slate-950 border border-slate-800 rounded-xl py-2.5 pl-10 pr-4 text-sm text-white placeholder-slate-600 focus:outline-none focus:border-blue-600 focus:ring-1 focus:ring-blue-600 transition-all font-medium"
                      />
                    </div>
                  </div>

                  <div>
                    <div className="flex justify-between items-center mb-1.5">
                      <label className="block text-xs font-semibold text-slate-400 uppercase tracking-wider">Secure Password</label>
                      <button
                        type="button"
                        onClick={() => {
                          setAuthMode("forgot");
                          setErrorMsg(null);
                          setSuccessMsg(null);
                        }}
                        className="text-xs text-blue-400 hover:underline cursor-pointer"
                      >
                        Forgot Password?
                      </button>
                    </div>
                    <div className="relative">
                      <Lock className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-500" />
                      <input
                        type="password"
                        required
                        value={password}
                        onChange={(e) => setPassword(e.target.value)}
                        placeholder="••••••••••••"
                        className="w-full bg-slate-950 border border-slate-800 rounded-xl py-2.5 pl-10 pr-4 text-sm text-white placeholder-slate-600 focus:outline-none focus:border-blue-600 focus:ring-1 focus:ring-blue-600 transition-all"
                      />
                    </div>
                  </div>

                  {/* Demo account button */}
                  <div className="text-right">
                    <button
                      type="button"
                      onClick={loadDemoCredentials}
                      className="text-xs text-blue-400 hover:text-blue-300 transition-colors font-medium cursor-pointer"
                    >
                      Autofill Demo Credentials
                    </button>
                  </div>

                  <button
                    type="submit"
                    disabled={isLoading}
                    className="w-full bg-[#1B4FD8] hover:bg-blue-600 text-white font-semibold py-2.5 rounded-xl text-sm transition-all shadow-lg hover:shadow-blue-500/20 active:scale-98 cursor-pointer flex justify-center items-center"
                  >
                    {isLoading ? "Authenticating session..." : "Verify & Sign In"}
                  </button>

                  <div className="relative my-4 text-center">
                    <hr className="border-slate-800" />
                    <span className="bg-slate-900 px-3 text-[10px] text-slate-500 absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 uppercase tracking-wide">Or connect with</span>
                  </div>

                  <div className="grid grid-cols-2 gap-3">
                    <button
                      type="button"
                      onClick={() => handleOAuthSim("google")}
                      className="bg-slate-950 border border-slate-800 hover:bg-slate-800 text-slate-200 font-semibold py-2 rounded-xl text-xs transition-all cursor-pointer flex items-center justify-center space-x-1.5"
                    >
                      <svg className="w-3.5 h-3.5" viewBox="0 0 24 24">
                        <path fill="currentColor" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" />
                        <path fill="currentColor" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" />
                        <path fill="currentColor" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" />
                        <path fill="currentColor" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" />
                      </svg>
                      <span>Google OAuth</span>
                    </button>

                    <button
                      type="button"
                      onClick={() => handleOAuthSim("microsoft")}
                      className="bg-slate-950 border border-slate-800 hover:bg-slate-800 text-slate-200 font-semibold py-2 rounded-xl text-xs transition-all cursor-pointer flex items-center justify-center space-x-1.5"
                    >
                      <svg className="w-3.5 h-3.5 text-blue-400" viewBox="0 0 23 23">
                        <path fill="currentColor" d="M0 0h11v11H0zM12 0h11v11H12zM0 12h11v11H0zM12 12h11v11H12z" />
                      </svg>
                      <span>Microsoft AD</span>
                    </button>
                  </div>
                </form>

                <div className="mt-5 text-center text-xs text-slate-500">
                  New to TenderAI?{" "}
                  <button
                    onClick={() => {
                      setAuthMode("signup");
                      setErrorMsg(null);
                      setSuccessMsg(null);
                    }}
                    className="text-blue-400 hover:underline font-semibold cursor-pointer"
                  >
                    Register System Account
                  </button>
                </div>
              </div>
            )}

            {authMode === "signup" && (
              <div>
                <div className="flex items-center space-x-2 text-indigo-400 mb-2">
                  <Sparkles className="w-5 h-5" />
                  <span className="text-xs font-bold uppercase tracking-wider">Enterprise Enlistment</span>
                </div>
                <h3 className="text-xl font-bold text-white tracking-tight">Create Enterprise Account</h3>
                <p className="text-xs text-slate-400 mt-1 mb-5">
                  Set up your role-profile business credentials to access and map smart proposals.
                </p>

                <form onSubmit={handleSignUpSubmit} className="space-y-3">
                  <div>
                    <label className="block text-xs font-semibold text-slate-400 uppercase tracking-wider mb-1">Company / Representative Name *</label>
                    <div className="relative">
                      <UserIcon className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-500" />
                      <input
                        type="text"
                        required
                        value={name}
                        onChange={(e) => setName(e.target.value)}
                        placeholder="e.g. Ramesh Sharma"
                        className="w-full bg-slate-950 border border-slate-800 rounded-xl py-2 pl-10 pr-4 text-sm text-white placeholder-slate-600 focus:outline-none focus:border-indigo-600 focus:ring-1 focus:ring-indigo-600 transition-all font-medium"
                      />
                    </div>
                  </div>

                  <div>
                    <label className="block text-xs font-semibold text-slate-400 uppercase tracking-wider mb-1">Corporate Email *</label>
                    <div className="relative">
                      <Mail className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-500" />
                      <input
                        type="email"
                        required
                        value={email}
                        onChange={(e) => setEmail(e.target.value)}
                        placeholder="e.g. director@company.in"
                        className="w-full bg-slate-950 border border-slate-800 rounded-xl py-2 pl-10 pr-4 text-sm text-white placeholder-slate-600 focus:outline-none focus:border-indigo-600 focus:ring-1 focus:ring-indigo-600 transition-all font-medium"
                      />
                    </div>
                  </div>

                  <div className="grid grid-cols-2 gap-2">
                    <div>
                      <label className="block text-xs font-semibold text-slate-400 uppercase tracking-wider mb-1">Mobile Contact</label>
                      <input
                        type="text"
                        value={phone}
                        onChange={(e) => setPhone(e.target.value)}
                        placeholder="e.g. +91 98765"
                        className="w-full bg-slate-950 border border-slate-800 rounded-xl py-2 px-3 text-sm text-white focus:outline-none focus:border-indigo-600 focus:ring-1 focus:ring-indigo-600"
                      />
                    </div>

                    <div>
                      <label className="block text-xs font-semibold text-slate-400 uppercase tracking-wider mb-1">Corporate Organization ID</label>
                      <input
                        type="text"
                        value={organizationId}
                        onChange={(e) => setOrganizationId(e.target.value)}
                        placeholder="e.g. org_sme_1"
                        className="w-full bg-slate-950 border border-slate-800 rounded-xl py-2 px-3 text-sm text-white focus:outline-none focus:border-indigo-600 focus:ring-1 focus:ring-indigo-600"
                      />
                    </div>
                  </div>

                  <div>
                    <label className="block text-xs font-semibold text-slate-400 uppercase tracking-wider mb-1">System Access Profile Role</label>
                    <select
                      value={role}
                      onChange={(e) => setRole(e.target.value as any)}
                      className="w-full bg-slate-950 border border-slate-800 rounded-xl py-2 px-3 text-sm text-slate-100 placeholder-slate-600 focus:outline-none focus:border-indigo-600 focus:ring-1 focus:ring-indigo-600"
                    >
                      <option value="USER">Individual SME Contractor (USER Role)</option>
                      <option value="ORGANIZATION_ADMIN">Corporate Team Manager (ORG_ADMIN Role)</option>
                      <option value="ADMIN">System Auditor Checkpoint (ADMIN Role)</option>
                    </select>
                  </div>

                  <div>
                    <label className="block text-xs font-semibold text-slate-400 uppercase tracking-wider mb-1">Account Password *</label>
                    <div className="relative">
                      <Lock className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-500" />
                      <input
                        type="password"
                        required
                        value={password}
                        onChange={(e) => setPassword(e.target.value)}
                        placeholder="••••••••••••"
                        className="w-full bg-slate-950 border border-slate-800 rounded-xl py-2 pl-10 pr-4 text-sm text-white placeholder-slate-600 focus:outline-none focus:border-indigo-600 focus:ring-1 focus:ring-indigo-600 transition-all font-medium"
                      />
                    </div>
                  </div>

                  <button
                    type="submit"
                    disabled={isLoading}
                    className="w-full mt-2 bg-indigo-600 hover:bg-indigo-500 text-white font-semibold py-2.5 rounded-xl text-sm transition-all shadow-lg hover:shadow-indigo-500/20 active:scale-98 cursor-pointer flex justify-center items-center"
                  >
                    {isLoading ? "Provisioning SME Account..." : "Register & Start Free"}
                  </button>
                </form>

                <div className="mt-4 text-center text-xs text-slate-500">
                  Already have an account?{" "}
                  <button
                    onClick={() => {
                      setAuthMode("signin");
                      setErrorMsg(null);
                      setSuccessMsg(null);
                    }}
                    className="text-indigo-400 hover:underline font-semibold cursor-pointer"
                  >
                    Sign In instead
                  </button>
                </div>
              </div>
            )}

            {authMode === "verify" && (
              <div>
                <div className="flex items-center space-x-2 text-violet-400 mb-2">
                  <ShieldCheck className="w-5 h-5" />
                  <span className="text-xs font-bold uppercase tracking-wider">Verification Secure Gate</span>
                </div>
                <h3 className="text-xl font-bold text-white tracking-tight">Confirm Your Workspace Email</h3>
                <p className="text-xs text-slate-400 mt-1 mb-5">
                  A verification token code has been simulated for <span className="text-white font-semibold">{email || "your account"}</span>. Look in your node server terminal console log trace to retrieve the token!
                </p>

                <form onSubmit={handleVerifySubmit} className="space-y-4">
                  <div>
                    <label className="block text-xs font-semibold text-slate-400 uppercase tracking-wider mb-1.5">Verification Token Code</label>
                    <input
                      type="text"
                      required
                      value={verifyToken}
                      onChange={(e) => setVerifyToken(e.target.value)}
                      placeholder="e.g. paste 32-character hex token from terminal console"
                      className="w-full bg-slate-950 border border-slate-800 rounded-xl py-2.5 px-4 text-center font-mono text-xs text-blue-400 focus:outline-none focus:border-violet-600 focus:ring-1 focus:ring-violet-600"
                    />
                  </div>

                  <button
                    type="submit"
                    disabled={isLoading}
                    className="w-full bg-violet-600 hover:bg-violet-500 text-white font-semibold py-2.5 rounded-xl text-sm transition-all shadow-lg shadow-violet-500/10 cursor-pointer text-center"
                  >
                    {isLoading ? "Validating token..." : "Confirm Verification & Log In"}
                  </button>

                  <div className="flex justify-between text-xs mt-4">
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
                      Resend link
                    </button>
                    <button
                      type="button"
                      onClick={() => setAuthMode("signin")}
                      className="text-violet-400 hover:underline cursor-pointer"
                    >
                      Back to Sign In
                    </button>
                  </div>
                </form>
              </div>
            )}

            {authMode === "forgot" && (
              <div>
                <div className="flex items-center space-x-2 text-amber-400 mb-2">
                  <Lock className="w-4 h-4" />
                  <span className="text-xs font-bold uppercase tracking-wider font-sans">Credentials Recovery</span>
                </div>
                <h3 className="text-xl font-bold text-white tracking-tight">Forgotten Password</h3>
                <p className="text-xs text-slate-400 mt-1 mb-5">
                  Retrieve a development bypass reset linkage simulated for your corporate account.
                </p>

                <form onSubmit={handleForgotSubmit} className="space-y-4">
                  <div>
                    <label className="block text-xs font-semibold text-slate-400 uppercase tracking-wider mb-1.5 font-sans">Registered Corporate Email</label>
                    <div className="relative">
                      <Mail className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-500" />
                      <input
                        type="email"
                        required
                        value={email}
                        onChange={(e) => setEmail(e.target.value)}
                        placeholder="e.g. demo@tenderai.in"
                        className="w-full bg-slate-950 border border-slate-800 rounded-xl py-2.5 pl-10 pr-4 text-sm text-white placeholder-slate-600 focus:outline-none focus:border-amber-600 focus:ring-1 focus:ring-amber-600"
                      />
                    </div>
                  </div>

                  <button
                    type="submit"
                    disabled={isLoading}
                    className="w-full bg-amber-600 hover:bg-amber-500 text-white font-semibold py-2.5 rounded-xl text-sm transition-all cursor-pointer"
                  >
                    {isLoading ? "Generating Link..." : "Generate Reset Token Link"}
                  </button>

                  {resetToken && (
                    <div className="mt-4 p-3 bg-slate-950 rounded-xl border border-amber-800/30 text-center">
                      <span className="block text-[10px] text-slate-500 uppercase font-sans font-bold">Simulated Reset Token</span>
                      <code className="text-xs font-mono text-amber-400 block break-all mt-1">{resetToken}</code>
                      <button
                        type="button"
                        onClick={() => {
                          setAuthMode("reset");
                          setErrorMsg(null);
                          setSuccessMsg(null);
                        }}
                        className="mt-2.5 text-xs text-amber-400 hover:underline font-semibold block mx-auto cursor-pointer"
                      >
                        Proceed to Password Update →
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
                      className="text-xs text-slate-400 hover:text-white cursor-pointer"
                    >
                      Cancel & Return to Login
                    </button>
                  </div>
                </form>
              </div>
            )}

            {authMode === "reset" && (
              <div>
                <div className="flex items-center space-x-2 text-emerald-400 mb-2">
                  <Lock className="w-4 h-4" />
                  <span className="text-xs font-bold uppercase tracking-wider">Update Credentials</span>
                </div>
                <h3 className="text-xl font-bold text-white tracking-tight">Set Secure Password</h3>
                <p className="text-xs text-slate-400 mt-1 mb-5">
                  Confirm the retrieved recovery token code to commit new credentials.
                </p>

                <form onSubmit={handleResetSubmit} className="space-y-4 font-sans">
                  <div>
                    <label className="block text-xs font-semibold text-slate-400 uppercase tracking-wide mb-1">Reset Recovery Token</label>
                    <input
                      type="text"
                      required
                      value={resetToken}
                      onChange={(e) => setResetToken(e.target.value)}
                      placeholder="Enter recovery token"
                      className="w-full bg-slate-950 border border-slate-800 rounded-xl py-2 px-3 text-xs font-mono text-amber-400 text-center"
                    />
                  </div>

                  <div>
                    <label className="block text-xs font-semibold text-slate-400 uppercase tracking-wide mb-1">New Account Password</label>
                    <input
                      type="password"
                      required
                      value={password}
                      onChange={(e) => setPassword(e.target.value)}
                      placeholder="••••••••••••"
                      className="w-full bg-slate-950 border border-slate-800 rounded-xl py-2 px-3 text-sm text-white"
                    />
                  </div>

                  <button
                    type="submit"
                    disabled={isLoading}
                    className="w-full bg-emerald-600 hover:bg-emerald-500 text-white font-semibold py-2.5 rounded-xl text-sm transition-all cursor-pointer"
                  >
                    {isLoading ? "Saving changes..." : "Commit Secure Password"}
                  </button>

                  <div className="text-center mt-3">
                    <button
                      type="button"
                      onClick={() => setAuthMode("signin")}
                      className="text-xs text-slate-400 hover:text-white cursor-pointer"
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
