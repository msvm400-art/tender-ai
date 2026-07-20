import React from 'react';
import {
  Compass, Search, FileText, Database, BellRing, BarChart4, LogOut,
  Building, Menu, X, CreditCard, UserCheck, Sparkles, AlertTriangle,
  Bell, CheckCircle2, ShieldAlert, Cloud, MessageSquare, Shield
} from "lucide-react";

export default function Sidebar({
  currentPage, setCurrentPage,
  sidebarOpen, setSidebarOpen,
  isTrialExpired,
  firebaseUser, signInWithGoogle, logOutFirebase,
  handleLogOut,
  profile, user, addToast,
  isProfileCompleted, setSelectedTenderId
}: any) {
  return (
          <aside
        className={`w-64 bg-white/65 backdrop-blur-xl border-r border-white/30 text-slate-600 flex flex-col justify-between fixed lg:static inset-y-0 left-0 z-40 transition-transform duration-300 transform lg:translate-x-0 ${
          sidebarOpen ? "translate-x-0" : "-translate-x-full"
        } shadow-lg shadow-slate-100/40`}
      >
        <div>
          {/* Logo element with Sleek Interface design icon */}
          <div className="h-16 flex items-center px-6 border-b border-white/25 shrink-0">
            <div className="flex items-center space-x-3">
              <div className="w-9 h-9 bg-gradient-to-tr from-blue-600 to-indigo-600 rounded-xl flex items-center justify-center shadow-md shadow-blue-500/20 text-white font-bold text-base">
                T
              </div>
              <span className="font-extrabold text-xl tracking-tight text-slate-800">
                TenderAI
              </span>
            </div>
          </div>

          {/* User profile capsule card - Crisp SaaS design */}
          {user && (
            <div className="px-5 py-4 border-b border-white/25 bg-white/30 backdrop-blur-md">
              <div className="flex items-center space-x-3">
                <div className="bg-blue-50/70 text-[#1B4FD8] p-2 rounded-xl border border-white/40">
                  <UserCheck className="w-4 h-4" />
                </div>
                <div className="text-xs truncate">
                  <p className="font-bold text-slate-800">{user.name}</p>
                  <p className="text-[10px] text-slate-500 mt-0.5">{user.email}</p>
                </div>
              </div>

              {/* SME Premium membership label */}
              <div className="mt-3 flex items-center justify-between bg-white/60 backdrop-blur-xs p-2 rounded-xl border border-white/30 shadow-xs">
                <span className="text-[9px] font-extrabold text-slate-400 tracking-wider">
                  {!isProfileCompleted 
                    ? "PROFILE PENDING 🔒" 
                    : isTrialExpired 
                      ? "TRIAL EXPIRED ⚠️" 
                      : "10-DAY STARTER TRIAL 🚀"}
                </span>
                <span className={`text-[9px] font-extrabold px-2.5 py-0.5 rounded-lg border ${
                  !isProfileCompleted
                    ? "text-amber-600 bg-amber-50/70 border-amber-150"
                    : isTrialExpired 
                      ? "text-red-600 bg-red-50/70 border-red-150" 
                      : "text-emerald-600 bg-emerald-50/70 border-emerald-150"
                }`}>
                  {user.plan} PLAN
                </span>
              </div>
            </div>
          )}

          {/* Sidebar Nav Buttons lists - Styled like sleek SaaS tabs */}
          <nav className="p-4 space-y-1.5 pt-4 text-[13px]">
            <button
              onClick={() => {
                if (isTrialExpired) {
                  setCurrentPage("upgrade");
                  addToast("Premium Trial Expired: Discovery Feed is locked. Please upgrade your plan to unlock.", "DEADLINE_REMINDER");
                } else {
                  setCurrentPage("tenders");
                  setSelectedTenderId(null);
                }
                setSidebarOpen(false);
              }}
              className={`w-full flex items-center justify-between px-4 py-2.5 rounded-xl transition-all cursor-pointer font-bold ${
                currentPage === "tenders"
                  ? "bg-white/70 text-[#1B4FD8] shadow-xs border border-white/50"
                  : "text-slate-650 hover:text-slate-900 hover:bg-white/40 border border-transparent"
              } ${isTrialExpired ? "opacity-60 hover:bg-red-50/20" : ""}`}
            >
              <div className="flex items-center space-x-3">
                <Compass className="w-4.5 h-4.5 text-blue-600" />
                <span>Discovery Feed</span>
              </div>
              {isTrialExpired && <span className="text-[9.5px] text-red-500 font-extrabold bg-red-50 px-1.5 py-0.5 rounded border border-red-100">🔒 LOCKED</span>}
            </button>

            <button
              id="sidebar-nav-search-button"
              onClick={() => {
                if (isTrialExpired) {
                  setCurrentPage("upgrade");
                  addToast("Premium Trial Expired: Advanced Search is locked. Please upgrade to unlock.", "DEADLINE_REMINDER");
                } else {
                  setCurrentPage("search");
                }
                setSidebarOpen(false);
              }}
              className={`w-full flex items-center justify-between px-4 py-2.5 rounded-xl transition-all cursor-pointer font-bold ${
                currentPage === "search"
                  ? "bg-white/70 text-[#1B4FD8] shadow-xs border border-white/50"
                  : "text-slate-650 hover:text-slate-900 hover:bg-white/40 border border-transparent"
              } ${isTrialExpired ? "opacity-60 hover:bg-red-50/20" : ""}`}
            >
              <div className="flex items-center space-x-3">
                <Search className="w-4.5 h-4.5 text-blue-600" />
                <span>Advanced Search 🔍</span>
              </div>
              {isTrialExpired && <span className="text-[9.5px] text-red-500 font-extrabold bg-red-50 px-1.5 py-0.5 rounded border border-red-100">🔒 LOCKED</span>}
            </button>

            <button
              onClick={() => {
                setCurrentPage("profile");
                setSidebarOpen(false);
              }}
              className={`w-full flex items-center space-x-3 px-4 py-2.5 rounded-xl transition-all cursor-pointer font-bold border ${
                currentPage === "profile"
                  ? "bg-white/70 text-[#1B4FD8] shadow-xs border-white/50"
                  : "text-slate-650 hover:text-slate-900 hover:bg-white/40 border-transparent"
              }`}
            >
              <Building className="w-4.5 h-4.5 text-blue-600" />
              <span>Company Criteria</span>
            </button>

            <button
              onClick={() => {
                if (isTrialExpired) {
                  setCurrentPage("upgrade");
                  addToast("Premium Trial Expired: Compliance Vault is locked. Please upgrade your plan to unlock.", "DEADLINE_REMINDER");
                } else {
                  setCurrentPage("vault");
                }
                setSidebarOpen(false);
              }}
              className={`w-full flex items-center justify-between px-4 py-2.5 rounded-xl transition-all cursor-pointer font-bold ${
                currentPage === "vault"
                  ? "bg-white/70 text-[#1B4FD8] shadow-xs border border-white/50"
                  : "text-slate-650 hover:text-slate-900 hover:bg-white/40 border border-transparent"
              } ${isTrialExpired ? "opacity-60 hover:bg-red-50/20" : ""}`}
            >
              <div className="flex items-center space-x-3">
                <Database className="w-4.5 h-4.5 text-blue-600" />
                <span>Document Vault</span>
              </div>
              {isTrialExpired && <span className="text-[9.5px] text-red-500 font-extrabold bg-red-50 px-1.5 py-0.5 rounded border border-red-100">🔒 LOCKED</span>}
            </button>

            <button
              onClick={() => {
                if (isTrialExpired) {
                  setCurrentPage("upgrade");
                  addToast("Premium Trial Expired: Bid Drafting Engine is locked. Please upgrade your plan to unlock.", "DEADLINE_REMINDER");
                } else {
                  setCurrentPage("bids");
                }
                setSidebarOpen(false);
              }}
              className={`w-full flex items-center justify-between px-4 py-2.5 rounded-xl transition-all cursor-pointer font-bold ${
                currentPage === "bids"
                  ? "bg-white/70 text-[#1B4FD8] shadow-xs border border-white/50"
                  : "text-slate-650 hover:text-slate-900 hover:bg-white/40 border border-transparent"
              } ${isTrialExpired ? "opacity-60 hover:bg-red-50/20" : ""}`}
            >
              <div className="flex items-center space-x-3">
                <FileText className="w-4.5 h-4.5 text-blue-600" />
                <span>AI Bid Assistant ✍️</span>
              </div>
              {isTrialExpired && <span className="text-[9.5px] text-red-500 font-extrabold bg-red-50 px-1.5 py-0.5 rounded border border-red-100">🔒 LOCKED</span>}
            </button>

            <button
              onClick={() => {
                if (isTrialExpired) {
                  setCurrentPage("upgrade");
                  addToast("Premium Trial Expired: Alerts Station is locked. Please upgrade your plan to unlock.", "DEADLINE_REMINDER");
                } else {
                  setCurrentPage("alerts");
                }
                setSidebarOpen(false);
              }}
              className={`w-full flex items-center justify-between px-4 py-2.5 rounded-xl transition-all cursor-pointer font-bold ${
                currentPage === "alerts"
                  ? "bg-white/70 text-[#1B4FD8] shadow-xs border border-white/50"
                  : "text-slate-650 hover:text-slate-900 hover:bg-white/40 border border-transparent"
              } ${isTrialExpired ? "opacity-60 hover:bg-red-50/20" : ""}`}
            >
              <div className="flex items-center space-x-3">
                <BellRing className="w-4.5 h-4.5 text-blue-600" />
                <span>Alerts Station</span>
              </div>
              {isTrialExpired && <span className="text-[9.5px] text-red-500 font-extrabold bg-red-50 px-1.5 py-0.5 rounded border border-red-100">🔒 LOCKED</span>}
            </button>

            <button
              onClick={() => {
                if (isTrialExpired) {
                  setCurrentPage("upgrade");
                  addToast("Premium Trial Expired: Intelligence Analytics is locked. Please upgrade your plan to unlock.", "DEADLINE_REMINDER");
                } else {
                  setCurrentPage("analytics");
                }
                setSidebarOpen(false);
              }}
              className={`w-full flex items-center justify-between px-4 py-2.5 rounded-xl transition-all cursor-pointer font-bold ${
                currentPage === "analytics"
                  ? "bg-white/70 text-[#1B4FD8] shadow-xs border border-white/50"
                  : "text-slate-650 hover:text-slate-900 hover:bg-white/40 border border-transparent"
              } ${isTrialExpired ? "opacity-60 hover:bg-red-50/20" : ""}`}
            >
              <div className="flex items-center space-x-3">
                <BarChart4 className="w-4.5 h-4.5 text-blue-600" />
                <span>Intelligence Analytics</span>
              </div>
              {isTrialExpired && <span className="text-[9.5px] text-red-500 font-extrabold bg-red-50 px-1.5 py-0.5 rounded border border-red-100">🔒 LOCKED</span>}
            </button>

            <button
              onClick={() => {
                setCurrentPage("upgrade");
                setSidebarOpen(false);
              }}
              className={`w-full flex items-center justify-between px-4 py-2.5 rounded-xl transition-all cursor-pointer font-bold ${
                currentPage === "upgrade"
                  ? "bg-gradient-to-r from-amber-50 to-orange-50 text-amber-800 shadow-sm border border-amber-200"
                  : "bg-amber-500/10 hover:bg-amber-500/15 text-amber-900 border border-amber-500/20"
              }`}
            >
              <div className="flex items-center space-x-3">
                <Sparkles className="w-4.5 h-4.5 text-amber-600 fill-amber-300 animate-pulse" />
                <span>Upgrade Premium ⭐</span>
              </div>
              <span className="text-[9px] bg-amber-200 text-amber-900 font-extrabold px-1.5 py-0.5 rounded">SAVE 20%</span>
            </button>

            <button
              onClick={() => {
                setCurrentPage("billing");
                setSidebarOpen(false);
              }}
              className={`w-full flex items-center space-x-3 px-4 py-2.5 rounded-xl transition-all cursor-pointer font-bold border ${
                currentPage === "billing"
                  ? "bg-white/70 text-[#1B4FD8] shadow-xs border-white/50"
                  : "text-slate-650 hover:text-slate-900 hover:bg-white/40 border-transparent"
              }`}
            >
              <CreditCard className="w-4.5 h-4.5 text-blue-600" />
              <span>Subscriptions & Billing</span>
            </button>

            <button
              onClick={() => {
                setCurrentPage("ingestion");
                setSidebarOpen(false);
              }}
              className={`w-full flex items-center space-x-3 px-4 py-2.5 rounded-xl transition-all cursor-pointer font-bold border ${
                currentPage === "ingestion"
                  ? "bg-white/70 text-[#1B4FD8] shadow-xs border-white/50"
                  : "text-slate-650 hover:text-slate-900 hover:bg-white/40 border-transparent"
              }`}
            >
              <Database className="w-4.5 h-4.5 text-indigo-600" />
              <span>Ingestion Monitor ⚙️</span>
            </button>

            <button
              onClick={() => {
                setCurrentPage("support");
                setSidebarOpen(false);
              }}
              className={`w-full flex items-center space-x-3 px-4 py-2.5 rounded-xl transition-all cursor-pointer font-bold border ${
                currentPage === "support"
                  ? "bg-white/70 text-[#1B4FD8] shadow-xs border-white/50"
                  : "text-slate-650 hover:text-slate-900 hover:bg-white/40 border-transparent"
              }`}
            >
              <MessageSquare className="w-4.5 h-4.5 text-blue-600" />
              <span>Help Desk Support 💬</span>
            </button>

            {user?.role === "ADMIN" && (
              <button
                onClick={() => {
                  setCurrentPage("admin");
                  setSidebarOpen(false);
                }}
                className={`w-full flex items-center space-x-3 px-4 py-2.5 rounded-xl transition-all cursor-pointer font-bold border ${
                  currentPage === "admin"
                    ? "bg-white/70 text-[#1B4FD8] shadow-xs border-white/50"
                    : "text-slate-650 hover:text-slate-900 hover:bg-white/40 border-transparent"
                }`}
              >
                <Shield className="w-4.5 h-4.5 text-blue-700" />
                <span>Admin Panel 🛡️</span>
              </button>
            )}
          </nav>
        </div>

        <div>
          {/* Firebase Cloud Sync segment */}
          <div className="mx-4 my-2 p-3.5 bg-gradient-to-br from-slate-900 to-indigo-950 text-white rounded-xl border border-indigo-950/20 shadow-md">
            <div className="flex items-center gap-2 mb-2">
              <Cloud className="w-4 h-4 text-sky-400 animate-pulse" />
              <span className="text-[10px] font-extrabold text-[#94A3B8] tracking-wider uppercase">Firebase Cloud Sync</span>
            </div>
            
            {firebaseUser ? (
              <div className="space-y-2">
                <div className="flex items-center gap-2">
                  <div className="w-5 h-5 bg-sky-600 rounded-full text-[9px] font-semibold flex items-center justify-center uppercase">
                    {firebaseUser.email?.slice(0, 2) || "FB"}
                  </div>
                  <span className="text-[10px] truncate font-mono max-w-[140px] text-slate-300">
                    {firebaseUser.email}
                  </span>
                </div>
                <div className="text-[9px] text-emerald-400 font-bold flex items-center gap-1.5 bg-emerald-950/50 px-2 py-1 rounded border border-emerald-800/30">
                  <div className="w-1.5 h-1.5 bg-emerald-400 rounded-full animate-ping" />
                  <span>Real-time Sync Active</span>
                </div>
                <button
                  onClick={logOutFirebase}
                  className="w-full text-center py-1 bg-white/10 hover:bg-white/20 transition-all rounded text-[9px] font-bold text-slate-200 cursor-pointer"
                >
                  Disconnect Sync
                </button>
              </div>
            ) : (
              <div className="space-y-2">
                <p className="text-[10px] text-slate-350 leading-relaxed">
                  Backup your filter presets and profile parameters to Firebase securely.
                </p>
                <button
                  onClick={signInWithGoogle}
                  className="w-full py-1.5 bg-sky-600 hover:bg-sky-500 active:scale-95 transition-all text-white font-extrabold text-[10px] rounded-lg tracking-wide shadow cursor-pointer text-center"
                >
                  Connect Cloud
                </button>
              </div>
            )}
          </div>

          {/* Profile strength capsule right from Sleek HTML */}
          <div className="p-4 bg-white/40 m-4 rounded-2xl border border-white/30 backdrop-blur-xs">
            <p className="text-[10px] text-slate-500 font-bold uppercase mb-1.5">Profile Strength</p>
            <div className="w-full bg-slate-200/60 h-2 rounded-full mb-1.5">
              <div className="bg-emerald-500 h-2 rounded-full" style={{ width: "82%" }}></div>
            </div>
            <p className="text-[10px] text-slate-500">Missing: Registered ISO Certificate</p>
          </div>

          {/* Log Out segment bottom */}
          <div className="p-4 border-t border-white/20">
            <button
              onClick={handleLogOut}
              className="w-full flex items-center space-x-3 px-4 py-2.5 rounded-xl text-xs font-bold text-red-500 hover:text-red-700 hover:bg-red-50/50 transition-colors cursor-pointer"
            >
              <LogOut className="w-4 h-4" />
              <span>Sign Out Session</span>
            </button>
          </div>
        </div>
      </aside>
  );
}
