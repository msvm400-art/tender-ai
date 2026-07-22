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
      className={`w-66 bg-[#090d16] border-r border-white/5 text-slate-400 flex flex-col justify-between fixed lg:static inset-y-0 left-0 z-40 transition-transform duration-300 transform lg:translate-x-0 ${
        sidebarOpen ? "translate-x-0" : "-translate-x-full"
      } shadow-2xl shadow-black/20`}
    >
      <div>
        {/* Brand / Logo */}
        <div className="h-20 flex items-center px-6 border-b border-white/5 shrink-0">
          <div className="flex items-center space-x-3">
            <div className="w-9 h-9 bg-gradient-to-tr from-blue-600 to-indigo-600 rounded-xl flex items-center justify-center shadow-lg shadow-blue-500/20 text-white font-black text-base border border-white/10">
              T
            </div>
            <span className="font-black text-xl tracking-tight text-white font-heading">
              TenderAI
            </span>
          </div>
        </div>

        {/* User Card */}
        {user && (
          <div className="px-5 py-4.5 border-b border-white/5 bg-white/[0.02]">
            <div className="flex items-center space-x-3">
              <div className="bg-white/5 text-slate-200 p-2.5 rounded-xl border border-white/10">
                <UserCheck className="w-4 h-4 text-indigo-400" />
              </div>
              <div className="text-xs truncate">
                <p className="font-black text-white">{user.name}</p>
                <p className="text-[10px] text-slate-500 mt-0.5 font-medium">{user.email}</p>
              </div>
            </div>

            {/* SME Subscription Tag */}
            <div className="mt-3 flex items-center justify-between bg-black/35 p-2 rounded-xl border border-white/5 shadow-inner">
              <span className="text-[9px] font-black text-slate-500 tracking-widest uppercase">
                {!isProfileCompleted 
                  ? "PROFILE PENDING" 
                  : isTrialExpired 
                    ? "TRIAL EXPIRED" 
                    : "10-DAY TRIAL"}
              </span>
              <span className={`text-[8.5px] font-black px-2.5 py-0.5 rounded border uppercase tracking-wider ${
                !isProfileCompleted
                  ? "text-amber-500 bg-amber-500/10 border-amber-500/20"
                  : isTrialExpired 
                    ? "text-rose-500 bg-rose-500/10 border-rose-500/20" 
                    : "text-emerald-500 bg-emerald-500/10 border-emerald-500/20"
              }`}>
                {user.plan}
              </span>
            </div>
          </div>
        )}

        {/* Navigation list */}
        <nav className="p-4 space-y-1.5 pt-5 text-xs">
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
            className={`w-full flex items-center justify-between px-4 py-3 rounded-xl transition-all cursor-pointer font-black uppercase tracking-wider border ${
              currentPage === "tenders"
                ? "bg-white/10 text-white border-white/10 shadow-lg shadow-black/10"
                : "text-slate-400 hover:text-white hover:bg-white/[0.03] border-transparent"
            } ${isTrialExpired ? "opacity-55 hover:bg-rose-500/5" : ""}`}
          >
            <div className="flex items-center space-x-3">
              <Compass className="w-4 h-4 text-indigo-400 shrink-0" />
              <span>Discovery Feed</span>
            </div>
            {isTrialExpired && <span className="text-[8.5px] text-rose-500 font-black bg-rose-500/10 px-1.5 py-0.2 rounded border border-rose-500/20">LOCKED</span>}
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
            className={`w-full flex items-center justify-between px-4 py-3 rounded-xl transition-all cursor-pointer font-black uppercase tracking-wider border ${
              currentPage === "search"
                ? "bg-white/10 text-white border-white/10 shadow-lg shadow-black/10"
                : "text-slate-400 hover:text-white hover:bg-white/[0.03] border-transparent"
            } ${isTrialExpired ? "opacity-55 hover:bg-rose-500/5" : ""}`}
          >
            <div className="flex items-center space-x-3">
              <Search className="w-4 h-4 text-indigo-400 shrink-0" />
              <span>Advanced Search</span>
            </div>
            {isTrialExpired && <span className="text-[8.5px] text-rose-500 font-black bg-rose-500/10 px-1.5 py-0.2 rounded border border-rose-500/20">LOCKED</span>}
          </button>

          <button
            onClick={() => {
              setCurrentPage("profile");
              setSidebarOpen(false);
            }}
            className={`w-full flex items-center space-x-3 px-4 py-3 rounded-xl transition-all cursor-pointer font-black uppercase tracking-wider border ${
              currentPage === "profile"
                ? "bg-white/10 text-white border-white/10 shadow-lg shadow-black/10"
                : "text-slate-400 hover:text-white hover:bg-white/[0.03] border-transparent"
            }`}
          >
            <Building className="w-4 h-4 text-indigo-400 shrink-0" />
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
            className={`w-full flex items-center justify-between px-4 py-3 rounded-xl transition-all cursor-pointer font-black uppercase tracking-wider border ${
              currentPage === "vault"
                ? "bg-white/10 text-white border-white/10 shadow-lg shadow-black/10"
                : "text-slate-400 hover:text-white hover:bg-white/[0.03] border-transparent"
            } ${isTrialExpired ? "opacity-55 hover:bg-rose-500/5" : ""}`}
          >
            <div className="flex items-center space-x-3">
              <Database className="w-4 h-4 text-indigo-400 shrink-0" />
              <span>Document Vault</span>
            </div>
            {isTrialExpired && <span className="text-[8.5px] text-rose-500 font-black bg-rose-500/10 px-1.5 py-0.2 rounded border border-rose-500/20">LOCKED</span>}
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
            className={`w-full flex items-center justify-between px-4 py-3 rounded-xl transition-all cursor-pointer font-black uppercase tracking-wider border ${
              currentPage === "bids"
                ? "bg-white/10 text-white border-white/10 shadow-lg shadow-black/10"
                : "text-slate-400 hover:text-white hover:bg-white/[0.03] border-transparent"
            } ${isTrialExpired ? "opacity-55 hover:bg-rose-500/5" : ""}`}
          >
            <div className="flex items-center space-x-3">
              <FileText className="w-4 h-4 text-indigo-400 shrink-0" />
              <span>AI Bid Assistant</span>
            </div>
            {isTrialExpired && <span className="text-[8.5px] text-rose-500 font-black bg-rose-500/10 px-1.5 py-0.2 rounded border border-rose-500/20">LOCKED</span>}
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
            className={`w-full flex items-center justify-between px-4 py-3 rounded-xl transition-all cursor-pointer font-black uppercase tracking-wider border ${
              currentPage === "alerts"
                ? "bg-white/10 text-white border-white/10 shadow-lg shadow-black/10"
                : "text-slate-400 hover:text-white hover:bg-white/[0.03] border-transparent"
            } ${isTrialExpired ? "opacity-55 hover:bg-rose-500/5" : ""}`}
          >
            <div className="flex items-center space-x-3">
              <BellRing className="w-4 h-4 text-indigo-400 shrink-0" />
              <span>Alerts Station</span>
            </div>
            {isTrialExpired && <span className="text-[8.5px] text-rose-500 font-black bg-rose-500/10 px-1.5 py-0.2 rounded border border-rose-500/20">LOCKED</span>}
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
            className={`w-full flex items-center justify-between px-4 py-3 rounded-xl transition-all cursor-pointer font-black uppercase tracking-wider border ${
              currentPage === "analytics"
                ? "bg-white/10 text-white border-white/10 shadow-lg shadow-black/10"
                : "text-slate-400 hover:text-white hover:bg-white/[0.03] border-transparent"
            } ${isTrialExpired ? "opacity-55 hover:bg-rose-500/5" : ""}`}
          >
            <div className="flex items-center space-x-3">
              <BarChart4 className="w-4 h-4 text-indigo-400 shrink-0" />
              <span>Intelligence Analytics</span>
            </div>
            {isTrialExpired && <span className="text-[8.5px] text-rose-500 font-black bg-rose-500/10 px-1.5 py-0.2 rounded border border-rose-500/20">LOCKED</span>}
          </button>

          <button
            onClick={() => {
              setCurrentPage("upgrade");
              setSidebarOpen(false);
            }}
            className={`w-full flex items-center justify-between px-4 py-3 rounded-xl transition-all cursor-pointer font-black uppercase tracking-wider border ${
              currentPage === "upgrade"
                ? "bg-gradient-to-r from-amber-500/10 to-orange-500/10 text-amber-400 shadow-sm border-amber-500/30"
                : "bg-amber-500/5 hover:bg-amber-500/10 text-amber-400 border border-amber-500/15"
            }`}
          >
            <div className="flex items-center space-x-3">
              <Sparkles className="w-4 h-4 text-amber-500 fill-amber-500/25 animate-pulse shrink-0" />
              <span>Upgrade Premium</span>
            </div>
            <span className="text-[8.5px] bg-amber-500 text-[#090d16] font-black px-1.5 py-0.2 rounded shrink-0">SAVE 20%</span>
          </button>

          <button
            onClick={() => {
              setCurrentPage("billing");
              setSidebarOpen(false);
            }}
            className={`w-full flex items-center space-x-3 px-4 py-3 rounded-xl transition-all cursor-pointer font-black uppercase tracking-wider border ${
              currentPage === "billing"
                ? "bg-white/10 text-white border-white/10 shadow-lg shadow-black/10"
                : "text-slate-400 hover:text-white hover:bg-white/[0.03] border-transparent"
            }`}
          >
            <CreditCard className="w-4 h-4 text-indigo-400 shrink-0" />
            <span>Subscriptions</span>
          </button>

          <button
            onClick={() => {
              setCurrentPage("ingestion");
              setSidebarOpen(false);
            }}
            className={`w-full flex items-center space-x-3 px-4 py-3 rounded-xl transition-all cursor-pointer font-black uppercase tracking-wider border ${
              currentPage === "ingestion"
                ? "bg-white/10 text-white border-white/10 shadow-lg shadow-black/10"
                : "text-slate-400 hover:text-white hover:bg-white/[0.03] border-transparent"
            }`}
          >
            <Database className="w-4 h-4 text-indigo-400 shrink-0" />
            <span>Ingestion Monitor</span>
          </button>

          <button
            onClick={() => {
              setCurrentPage("support");
              setSidebarOpen(false);
            }}
            className={`w-full flex items-center space-x-3 px-4 py-3 rounded-xl transition-all cursor-pointer font-black uppercase tracking-wider border ${
              currentPage === "support"
                ? "bg-white/10 text-white border-white/10 shadow-lg shadow-black/10"
                : "text-slate-400 hover:text-white hover:bg-white/[0.03] border-transparent"
            }`}
          >
            <MessageSquare className="w-4 h-4 text-indigo-400 shrink-0" />
            <span>Help Desk Support</span>
          </button>

          {user?.role === "ADMIN" && (
            <button
              onClick={() => {
                setCurrentPage("admin");
                setSidebarOpen(false);
              }}
              className={`w-full flex items-center space-x-3 px-4 py-3 rounded-xl transition-all cursor-pointer font-black uppercase tracking-wider border ${
                currentPage === "admin"
                  ? "bg-white/10 text-white border-white/10 shadow-lg shadow-black/10"
                  : "text-slate-400 hover:text-white hover:bg-white/[0.03] border-transparent"
              }`}
            >
              <Shield className="w-4 h-4 text-indigo-400 shrink-0" />
              <span>Admin Panel</span>
            </button>
          )}
        </nav>
      </div>

      <div className="space-y-4">
        {/* Firebase Cloud Sync segment */}
        <div className="mx-4 p-3.5 bg-black/20 rounded-2xl border border-white/5 shadow-inner">
          <div className="flex items-center gap-2 mb-2">
            <Cloud className="w-4 h-4 text-sky-400 animate-pulse shrink-0" />
            <span className="text-[9px] font-black text-slate-500 tracking-widest uppercase">Firebase Cloud</span>
          </div>
          
          {firebaseUser ? (
            <div className="space-y-2">
              <div className="flex items-center gap-2">
                <div className="w-5 h-5 bg-sky-600 rounded-full text-[9px] font-bold flex items-center justify-center uppercase text-white shrink-0">
                  {firebaseUser.email?.slice(0, 2) || "FB"}
                </div>
                <span className="text-[10px] truncate font-mono max-w-[130px] text-slate-350 font-bold">
                  {firebaseUser.email}
                </span>
              </div>
              <div className="text-[8.5px] text-emerald-400 font-black uppercase flex items-center gap-1.5 bg-emerald-500/5 px-2 py-1 rounded border border-emerald-500/10">
                <div className="w-1.5 h-1.5 bg-emerald-400 rounded-full animate-ping shrink-0" />
                <span>Sync Active</span>
              </div>
              <button
                onClick={logOutFirebase}
                className="w-full text-center py-1 bg-white/5 hover:bg-white/10 transition-all rounded text-[9.5px] font-black uppercase text-slate-300 cursor-pointer border border-white/5"
              >
                Disconnect
              </button>
            </div>
          ) : (
            <div className="space-y-2.5">
              <p className="text-[10px] text-slate-500 leading-normal font-semibold">
                Backup presets and profile criteria to Firebase.
              </p>
              <button
                onClick={signInWithGoogle}
                className="w-full py-2 bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-500 hover:to-indigo-500 active:scale-95 transition-all text-white font-black text-[9.5px] uppercase tracking-wider rounded-lg shadow-md cursor-pointer text-center border border-white/10"
              >
                Connect Cloud
              </button>
            </div>
          )}
        </div>

        {/* Profile strength widget */}
        <div className="p-4 bg-white/[0.01] m-4 rounded-2xl border border-white/5">
          <p className="text-[9px] text-slate-500 font-black uppercase tracking-wider mb-1.5">Profile Strength</p>
          <div className="w-full bg-slate-900 h-2 rounded-full mb-1.5 border border-white/5 overflow-hidden">
            <div className="bg-emerald-500 h-full rounded-full" style={{ width: "82%" }}></div>
          </div>
          <p className="text-[9.5px] text-slate-500 font-bold">Missing: Registered ISO Certificate</p>
        </div>

        {/* Log Out */}
        <div className="p-4 border-t border-white/5">
          <button
            onClick={handleLogOut}
            className="w-full flex items-center space-x-3 px-4 py-2.5 rounded-xl text-xs font-black uppercase tracking-wider text-rose-500 hover:bg-rose-500/5 transition-all cursor-pointer"
          >
            <LogOut className="w-4 h-4 shrink-0" />
            <span>Sign Out</span>
          </button>
        </div>
      </div>
    </aside>
  );
}
