import React, { useState, useEffect } from "react";
import { 
  Users, CreditCard, PieChart, Database, FileCheck, HelpCircle, 
  Settings, RefreshCw, Star, Shield, Trash2, Edit2, Plus,CheckCircle2, Cloud,
  X, AlertTriangle, MessageSquare, Check, Send, ShoppingBag, 
  Sparkles, Compass, Search, Filter, TrendingUp, BarChart2
} from "lucide-react";
import { ResponsiveContainer, PieChart as RePieChart, Pie, Cell, Tooltip as ChartTooltip, Legend } from "recharts";

interface AdminPanelProps {
  user: any;
  onToast: (msg: string, type?: "NEW_MATCH" | "DEADLINE_REMINDER" | "STATUS_CHANGE" | "DOCUMENT_MISSING" | "SUBSCRIPTION_EVENT") => void;
  onBackToFeed: () => void;
}

export default function AdminPanel({ user, onToast, onBackToFeed }: AdminPanelProps) {
  const [activeTab, setActiveTab] = useState<"users" | "subscriptions" | "tenders" | "documents" | "ai-usage" | "support" | "settings" | "audit-logs">("users");
  
  // States mapping
  const [usersList, setUsersList] = useState<any[]>([]);
  const [subscriptionStats, setSubscriptionStats] = useState<any>({ activeSubscribers: 0, totalRevenue: 0, paymentHistory: [] });
  const [tendersList, setTendersList] = useState<any[]>([]);
  const [documentsList, setDocumentsList] = useState<any[]>([]);
  const [aiUsageStats, setAiUsageStats] = useState<any>({ totalGenerations: 0, totalTokensConsumed: 0, tokensBreakup: [], userBreakup: [] });
  const [ticketsList, setTicketsList] = useState<any[]>([]);
  const [auditLogsList, setAuditLogsList] = useState<any[]>([]);
  const [backupsList, setBackupsList] = useState<any[]>([]);
  const [systemSettings, setSystemSettings] = useState<any>({ liveGatewayActive: false, aiRateLimitPerMin: 60, customServiceFeeMultiplier: 1, sandboxMode: true });
  
  // Modal/Editing controls
  const [editingUser, setEditingUser] = useState<any | null>(null);
  const [selectedTicket, setSelectedTicket] = useState<any | null>(null);
  const [replyMessage, setReplyMessage] = useState("");
  const [isAddingTender, setIsAddingTender] = useState(false);
  const [editingTender, setEditingTender] = useState<any | null>(null);
  const [loading, setLoading] = useState(false);
  
  // Tender Form Inputs
  const [tenderForm, setTenderForm] = useState({
    title: "",
    department: "",
    state: "Bihar",
    category: "Construction",
    subCategory: "Civil Work",
    tenderValue: "",
    emdAmount: "",
    bidSubmissionDeadline: "",
    workDescription: ""
  });

  useEffect(() => {
    fetchData();
  }, [activeTab]);

  const fetchData = async () => {
    setLoading(true);
    try {
      const headers = { Authorization: "Bearer demo-token-placeholder" }; // Express handles fallback user resolve automatically
      
      if (activeTab === "users") {
        const res = await fetch("/api/admin/users", { headers });
        if (res.ok) setUsersList(await res.json());
      } else if (activeTab === "subscriptions") {
        const res = await fetch("/api/admin/subscriptions", { headers });
        if (res.ok) setSubscriptionStats(await res.json());
      } else if (activeTab === "tenders") {
        const res = await fetch("/api/admin/tenders", { headers });
        if (res.ok) setTendersList(await res.json());
      } else if (activeTab === "documents") {
        const res = await fetch("/api/admin/documents", { headers });
        if (res.ok) setDocumentsList(await res.json());
      } else if (activeTab === "ai-usage") {
        const res = await fetch("/api/admin/ai-usage", { headers });
        if (res.ok) {
          const payload = await res.json();
          setAiUsageStats(payload.stats);
        }
      } else if (activeTab === "support") {
        const res = await fetch("/api/support-tickets", { headers });
        if (res.ok) setTicketsList(await res.json());
      } else if (activeTab === "settings") {
        const res = await fetch("/api/admin/settings", { headers });
        if (res.ok) setSystemSettings(await res.json());
      } else if (activeTab === "audit-logs") {
        const resLogs = await fetch("/api/admin/audit-logs", { headers });
        if (resLogs.ok) setAuditLogsList(await resLogs.json());
        const resBackups = await fetch("/api/admin/backups", { headers });
        if (resBackups.ok) setBackupsList(await resBackups.json());
      }
    } catch (err) {
      console.error("Error loading administration data:", err);
    } finally {
      setLoading(false);
    }
  };

  const handleUpdateUser = async (uId: string, updatedFields: any) => {
    try {
      const res = await fetch(`/api/admin/users/${uId}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(updatedFields)
      });
      if (res.ok) {
        onToast("User configuration updated successfully", "STATUS_CHANGE");
        setEditingUser(null);
        fetchData();
      }
    } catch (e) {
      onToast("Failed to update user", "DEADLINE_REMINDER");
    }
  };

  const handleSaveTender = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      const url = editingTender ? `/api/admin/tenders/${editingTender.id}` : "/api/admin/tenders";
      const method = editingTender ? "PUT" : "POST";
      const res = await fetch(url, {
        method,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(tenderForm)
      });
      if (res.ok) {
        onToast(editingTender ? "Tender criteria modified successfully" : "New e-Procurement contract published live", "STATUS_CHANGE");
        setIsAddingTender(false);
        setEditingTender(null);
        setTenderForm({
          title: "",
          department: "",
          state: "Bihar",
          category: "Construction",
          subCategory: "Civil Work",
          tenderValue: "",
          emdAmount: "",
          bidSubmissionDeadline: "",
          workDescription: ""
        });
        fetchData();
      } else {
        const err = await res.json();
        onToast(err.error || "Execution error", "DEADLINE_REMINDER");
      }
    } catch (e) {
      onToast("Server connection error during contract dispatch", "DEADLINE_REMINDER");
    }
  };

  const handleDeleteTender = async (tId: string) => {
    if (!confirm("Are you sure you want to permanently delete this tender criteria from indices? All matching profiles will be unbound.")) return;
    try {
      const res = await fetch(`/api/admin/tenders/${tId}`, { method: "DELETE" });
      if (res.ok) {
        onToast("E-Procurement tender wiped out from indices", "STATUS_CHANGE");
        fetchData();
      }
    } catch (e) {
      onToast("Fails targeting tender delete", "DEADLINE_REMINDER");
    }
  };

  const handleToggleDocumentVerify = async (docId: string, currentStatus: boolean) => {
    try {
      const res = await fetch(`/api/admin/documents/${docId}/verify`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ isVerified: !currentStatus })
      });
      if (res.ok) {
        onToast(`Document compliance ${!currentStatus ? "Verified & Locked" : "Rejected/Pending approval"}`, "STATUS_CHANGE");
        fetchData();
      }
    } catch (e) {
      onToast("Approval state synchronization crashed", "DEADLINE_REMINDER");
    }
  };

  const handleRecoverPayment = async (intentId: string) => {
    try {
      const res = await fetch("/api/payments/recover", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ paymentIntentId: intentId })
      });
      if (res.ok) {
        onToast("Simulated Webhook recovery success! Plan upgraded.", "STATUS_CHANGE");
        
        // Dynamically trigger standard canvas-confetti celebration if loaded
        if ((window as any).confetti) {
          (window as any).confetti({ particleCount: 140, spread: 80, origin: { y: 0.6 } });
        }
        fetchData();
      } else {
        onToast("Recovery algorithm rejection", "DEADLINE_REMINDER");
      }
    } catch (err) {
      onToast("Network connection timed out", "DEADLINE_REMINDER");
    }
  };

  const handleSendTicketReply = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!replyMessage.trim() || !selectedTicket) return;
    try {
      const res = await fetch(`/api/support-tickets/${selectedTicket.id}/reply`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ message: replyMessage })
      });
      if (res.ok) {
        const payload = await res.json();
        setSelectedTicket(payload.ticket);
        setReplyMessage("");
        onToast("Administrative response dispatched", "STATUS_CHANGE");
        fetchData();
      }
    } catch (e) {
      onToast("Fails delivering administrative dispatch", "DEADLINE_REMINDER");
    }
  };

  const handleSaveSettings = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      const res = await fetch("/api/admin/settings", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(systemSettings)
      });
      if (res.ok) {
        onToast("Gateway parameters and AI limits updated", "STATUS_CHANGE");
        fetchData();
      }
    } catch (e) {
      onToast("Configuration update execution crash", "DEADLINE_REMINDER");
    }
  };

  const handleTriggerBackup = async () => {
    try {
      const headers = { 
        "Content-Type": "application/json",
        "Authorization": `Bearer ${localStorage.getItem("tender_jwt")}`
      };
      const res = await fetch("/api/admin/backup", { method: "POST", headers });
      if (res.ok) {
        const data = await res.json();
        onToast(data.message, "STATUS_CHANGE");
        // Reload backups list
        const resBackups = await fetch("/api/admin/backups", { headers });
        if (resBackups.ok) setBackupsList(await resBackups.json());
      } else {
        onToast("Failed to compile database backup", "DEADLINE_REMINDER");
      }
    } catch (e) {
      console.error("Failed triggering backup:", e);
      onToast("Error invoking server backup job", "DEADLINE_REMINDER");
    }
  };

  // Webhook sandbox trigger
  const handleSimulateWebhook = async (type: "pay_success" | "pay_fail") => {
    try {
      const isSuccess = type === "pay_success";
      const webhookPayload = {
        event: isSuccess ? "payment.captured" : "payment.failed",
        payload: {
          payment: {
            entity: {
              id: `rzp_pay_wh_${Math.floor(10000 + Math.random() * 90000)}`,
              amount: isSuccess ? 499900 : 199900,
              currency: "INR",
              status: isSuccess ? "captured" : "failed",
              method: "upi",
              email: "demo@tenderai.in",
              notes: {
                planId: isSuccess ? "PROFESSIONAL" : "STARTER",
                billingCycle: "MONTHLY"
              }
            }
          }
        }
      };

      const res = await fetch("/api/payments/razorpay/webhook", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(webhookPayload)
      });

      if (res.ok) {
        onToast(`Razorpay webhook simulation delivered! ${isSuccess ? "Upgrade event fired" : "Failure capture logged"}`, "STATUS_CHANGE");
        if (isSuccess && (window as any).confetti) {
          (window as any).confetti({ particleCount: 70, spread: 50 });
        }
        fetchData();
      }
    } catch (e) {
      onToast("Webhook sandbox dispatch crash", "DEADLINE_REMINDER");
    }
  };

  const getPriorityColor = (priority: string) => {
    switch (priority) {
      case "CRITICAL": return "bg-rose-100 text-rose-800 border-rose-200";
      case "HIGH": return "bg-orange-100 text-orange-850 border-orange-200";
      case "MEDIUM": return "bg-amber-100 text-amber-800 border-amber-200";
      default: return "bg-slate-100 text-slate-705 border-slate-200";
    }
  };

  return (
    <div className="bg-slate-50 min-h-screen pt-4 pb-14 px-4 sm:px-6 lg:px-8 font-sans">
      <div className="max-w-7xl mx-auto">
        
        {/* Header Ribbon */}
        <div className="mb-8 flex flex-col md:flex-row md:items-center md:justify-between border-b border-slate-200 pb-5">
          <div>
            <div className="flex items-center space-x-2.5 text-xs font-bold text-blue-650 uppercase tracking-widest mb-1.5">
              <Shield className="w-4 h-4" />
              <span>System Administration</span>
            </div>
            <h1 className="text-3xl font-black text-slate-900 tracking-tight">
              TenderAI Compliance Dashboard
            </h1>
            <p className="mt-1 text-sm text-slate-500">
              Oversee platform subscribers, crawl pipelines, document verifications, billing triggers, and support tickets.
            </p>
          </div>
          <button 
            onClick={onBackToFeed}
            className="mt-4 md:mt-0 px-4 py-2 bg-white border border-slate-300 hover:bg-slate-50 rounded-xl text-slate-750 font-bold text-sm shadow-xs transition-colors cursor-pointer"
          >
            ← Back to Procurement discovery
          </button>
        </div>

        {/* Dashboard Grid Navigation Utilities */}
        <div className="grid grid-cols-2 md:grid-cols-8 gap-3 mb-8">
          <button
            onClick={() => setActiveTab("users")}
            className={`flex flex-col items-center justify-center p-3.5 rounded-2xl border transition-all text-center cursor-pointer ${
              activeTab === "users" ? "bg-blue-600 outline-hidden border-blue-600 text-white shadow-md shadow-blue-200" : "bg-white border-slate-200 text-slate-600 hover:bg-slate-50"
            }`}
          >
            <Users className="w-5.5 h-5.5 mb-2 shrink-0" />
            <span className="text-xs font-extrabold">Users</span>
          </button>

          <button
            onClick={() => setActiveTab("subscriptions")}
            className={`flex flex-col items-center justify-center p-3.5 rounded-2xl border transition-all text-center cursor-pointer ${
              activeTab === "subscriptions" ? "bg-blue-600 outline-hidden border-blue-600 text-white shadow-md shadow-blue-200" : "bg-white border-slate-200 text-slate-600 hover:bg-slate-50"
            }`}
          >
            <CreditCard className="w-5.5 h-5.5 mb-2 shrink-0" />
            <span className="text-xs font-extrabold">Billing & Recovery</span>
          </button>

          <button
            onClick={() => setActiveTab("tenders")}
            className={`flex flex-col items-center justify-center p-3.5 rounded-2xl border transition-all text-center cursor-pointer ${
              activeTab === "tenders" ? "bg-blue-600 outline-hidden border-blue-600 text-white shadow-md shadow-blue-200" : "bg-white border-slate-200 text-slate-600 hover:bg-slate-50"
            }`}
          >
            <Database className="w-5.5 h-5.5 mb-2 shrink-0" />
            <span className="text-xs font-extrabold">Tender Contracts</span>
          </button>

          <button
            onClick={() => setActiveTab("documents")}
            className={`flex flex-col items-center justify-center p-3.5 rounded-2xl border transition-all text-center cursor-pointer ${
              activeTab === "documents" ? "bg-blue-600 outline-hidden border-blue-600 text-white shadow-md shadow-blue-200" : "bg-white border-slate-200 text-slate-600 hover:bg-slate-50"
            }`}
          >
            <FileCheck className="w-5.5 h-5.5 mb-2 shrink-0" />
            <span className="text-xs font-extrabold">Upload Verifier</span>
          </button>

          <button
            onClick={() => setActiveTab("ai-usage")}
            className={`flex flex-col items-center justify-center p-3.5 rounded-2xl border transition-all text-center cursor-pointer ${
              activeTab === "ai-usage" ? "bg-blue-600 outline-hidden border-blue-600 text-white shadow-md shadow-blue-200" : "bg-white border-slate-200 text-slate-600 hover:bg-slate-50"
            }`}
          >
            <Sparkles className="w-5.5 h-5.5 mb-2 shrink-0" />
            <span className="text-xs font-extrabold">AI Analytics</span>
          </button>

          <button
            onClick={() => setActiveTab("support")}
            className={`flex flex-col items-center justify-center p-3.5 rounded-2xl border transition-all text-center cursor-pointer ${
              activeTab === "support" ? "bg-blue-600 outline-hidden border-blue-600 text-white shadow-md shadow-blue-200 text-slate-50" : "bg-white border-slate-200 text-slate-600 hover:bg-slate-50"
            }`}
          >
            <HelpCircle className="w-5.5 h-5.5 mb-2 shrink-0" />
            <span className="text-xs font-extrabold">Tickets</span>
          </button>

          <button
            onClick={() => setActiveTab("settings")}
            className={`flex flex-col items-center justify-center p-3.5 rounded-2xl border transition-all text-center cursor-pointer ${
              activeTab === "settings" ? "bg-blue-600 outline-hidden border-blue-600 text-white shadow-md shadow-blue-200" : "bg-white border-slate-200 text-slate-600 hover:bg-slate-50"
            }`}
          >
            <Settings className="w-5.5 h-5.5 mb-2 shrink-0" />
            <span className="text-xs font-extrabold">System Settings</span>
          </button>

          <button
            onClick={() => setActiveTab("audit-logs")}
            className={`flex flex-col items-center justify-center p-3.5 rounded-2xl border transition-all text-center cursor-pointer ${
              activeTab === "audit-logs" ? "bg-blue-600 outline-hidden border-blue-600 text-white shadow-md shadow-blue-200" : "bg-white border-slate-200 text-slate-600 hover:bg-slate-50"
            }`}
          >
            <Shield className="w-5.5 h-5.5 mb-2 shrink-0" />
            <span className="text-xs font-extrabold">Audit Logs</span>
          </button>
        </div>

        {/* Dynamic Workspace Container Section */}
        <div className="bg-white rounded-3xl border border-slate-200 shadow-xs overflow-hidden">
          
          {loading && (
            <div className="p-12 flex justify-center items-center text-slate-505 bg-slate-50/50">
              <RefreshCw className="w-6 h-6 animate-spin text-blue-600 mr-2.5" />
              <span className="font-semibold text-sm">Querying live telemetry logs...</span>
            </div>
          )}

          {!loading && (
            <div className="p-6 md:p-8">
              
              {/* TAB 1: USERS UTILITIES */}
              {activeTab === "users" && (
                <div>
                  <div className="flex justify-between items-center mb-6">
                    <h2 className="text-xl font-bold text-slate-900">Manage Registered Users</h2>
                    <span className="text-xs bg-slate-100 text-slate-600 px-3 py-1.5 rounded-lg font-bold">
                      {usersList.length} Accounts Found
                    </span>
                  </div>

                  <div className="overflow-x-auto">
                    <table id="admin-users-table" className="w-full text-left border-collapse">
                      <thead>
                        <tr className="border-b border-slate-150 text-xs font-extrabold uppercase text-slate-450 tracking-wider">
                          <th className="pb-3.5">User Profile</th>
                          <th className="pb-3.5">Assigned Plan</th>
                          <th className="pb-3.5">Access Role</th>
                          <th className="pb-3.5">Sandbox Trial Metric</th>
                          <th className="pb-3.5 text-right">Administrative</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-150 text-sm">
                        {usersList.map((usr) => (
                          <tr key={usr.id} className="hover:bg-slate-50/50">
                            <td className="py-4">
                              <div className="font-bold text-slate-900">{usr.name}</div>
                              <div className="text-xs text-slate-500 font-mono mt-0.5">{usr.email}</div>
                              <div className="text-[11px] text-slate-400 mt-1">{usr.phone}</div>
                            </td>
                            <td className="py-4">
                              <span className={`px-2.5 py-1 rounded-full text-xs font-black ${
                                usr.plan === "ENTERPRISE" ? "bg-purple-100 text-purple-800" :
                                usr.plan === "PROFESSIONAL" ? "bg-blue-100 text-blue-800" :
                                usr.plan === "STARTER" ? "bg-emerald-100 text-emerald-800" :
                                "bg-slate-100 text-slate-700"
                              }`}>
                                {usr.plan}
                              </span>
                            </td>
                            <td className="py-4 font-extrabold text-slate-700">
                              <span className="flex items-center">
                                <Shield className="w-3.5 h-3.5 text-blue-500 mr-1.5" />
                                {usr.role}
                              </span>
                            </td>
                            <td className="py-4">
                              {usr.isTrialActive ? (
                                <div className="space-y-1">
                                  <span className="text-amber-700 font-bold bg-amber-50 border border-amber-200 px-2 py-0.5 rounded text-xs">
                                    Trial Active
                                  </span>
                                  <div className="text-xs text-slate-450">
                                    {usr.trialDaysElapsed || 1} of 10 days simulated
                                  </div>
                                </div>
                              ) : (
                                <span className="text-slate-400 text-xs">N/A (Premium Upgrade)</span>
                              )}
                            </td>
                            <td className="py-4 text-right">
                              <button
                                onClick={() => setEditingUser(usr)}
                                className="px-3 py-1.5 bg-blue-50 hover:bg-blue-100 text-blue-700 rounded-lg text-xs font-bold transition-colors cursor-pointer"
                              >
                                Edit Profile
                              </button>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              )}

              {/* TAB 2: BILLING & SUBSCRIPTION + FAILED ACTION RECOVER */}
              {activeTab === "subscriptions" && (
                <div>
                  
                  {/* Subscription summary dashboard widgets */}
                  <div className="grid grid-cols-1 md:grid-cols-4 gap-6 mb-8">
                    <div className="bg-indigo-50/50 border border-indigo-100 rounded-2xl p-5">
                      <TrendingUp className="w-6 h-6 text-indigo-600 mb-2.5" />
                      <div className="text-xs text-slate-500 font-bold uppercase tracking-wider">Gross platform earnings</div>
                      <div className="text-2xl font-black text-slate-900 mt-1">₹{subscriptionStats.totalRevenue?.toLocaleString()}</div>
                      <div className="text-xs text-emerald-650 font-bold mt-1">↑ 14% this month</div>
                    </div>

                    <div className="bg-emerald-50/50 border border-emerald-100 rounded-2xl p-5">
                      <Star className="w-6 h-6 text-emerald-600 mb-2.5" />
                      <div className="text-xs text-slate-500 font-bold uppercase tracking-wider">Active Premium Accounts</div>
                      <div className="text-2xl font-black text-slate-900 mt-1">{subscriptionStats.activeSubscribers}</div>
                      <div className="text-xs text-emerald-650 font-bold mt-1">82% trial conversion</div>
                    </div>

                    <div className="bg-rose-50/50 border border-rose-100 rounded-2xl p-5">
                      <AlertTriangle className="w-6 h-6 text-rose-600 mb-2.5" />
                      <div className="text-xs text-slate-500 font-bold uppercase tracking-wider">Failed Payment Intents</div>
                      <div className="text-2xl font-black text-slate-900 mt-1">
                        {subscriptionStats.paymentHistory?.filter((p: any) => p.status === "FAILED").length || 0}
                      </div>
                      <div className="text-xs text-rose-650 font-bold mt-1">Eligible for recovery triggers</div>
                    </div>

                    {/* Simulators block */}
                    <div className="bg-amber-50-5 bg-amber-50/50 border border-amber-200 rounded-2xl p-4 flex flex-col justify-between">
                      <div className="text-xs font-black text-amber-850 uppercase tracking-widest flex items-center">
                        <Sparkles className="w-4 h-4 mr-1.5 text-amber-600" />
                        <span>Webhook Simulator</span>
                      </div>
                      <div className="flex gap-2 mt-2.5">
                        <button
                          onClick={() => handleSimulateWebhook("pay_success")}
                          className="flex-1 text-[11px] font-bold bg-emerald-600 hover:bg-emerald-700 text-white rounded-lg p-1.5 transition-colors cursor-pointer"
                        >
                          Trigger Success
                        </button>
                        <button
                          onClick={() => handleSimulateWebhook("pay_fail")}
                          className="flex-1 text-[11px] font-bold bg-rose-600 hover:bg-rose-700 text-white rounded-lg p-1.5 transition-colors cursor-pointer"
                        >
                          Trigger Failure
                        </button>
                      </div>
                    </div>
                  </div>

                  <h3 className="text-lg font-bold text-slate-900 mb-4">Payment Intent Audits & Failed Recovery Console</h3>
                  <div className="overflow-x-auto">
                    <table className="w-full text-left border-collapse">
                      <thead>
                        <tr className="border-b border-slate-150 text-xs font-extrabold uppercase text-slate-450 tracking-wider">
                          <th className="pb-3.5">Transaction Id</th>
                          <th className="pb-3.5">Gateway / Method</th>
                          <th className="pb-3.5">Upgrade Tag</th>
                          <th className="pb-3.5">Captured Amount</th>
                          <th className="pb-3.5">Payment Status</th>
                          <th className="pb-3.5 text-center">Failed Payment Recovery</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-150 text-sm">
                        {subscriptionStats.paymentHistory?.map((pay: any) => (
                          <tr key={pay.id} className="hover:bg-slate-50/50">
                            <td className="py-3.5">
                              <span className="font-mono bg-slate-100 px-2 py-1 rounded text-xs font-semibold text-slate-800">
                                {pay.id}
                              </span>
                              <div className="text-[11px] text-slate-450 mt-1">{new Date(pay.createdAt).toLocaleString()}</div>
                            </td>
                            <td className="py-3.5">
                              <span className="font-bold text-slate-800">{pay.gateway}</span>
                              <div className="text-xs text-slate-500 mt-0.5">{pay.method}</div>
                            </td>
                            <td className="py-3.5">
                              <span className="text-xs font-black bg-blue-50 text-blue-750 px-2 py-0.5 rounded border border-blue-100 uppercase">
                                {pay.planId} ({pay.billingCycle || "MONTHLY"})
                              </span>
                            </td>
                            <td className="py-3.5 font-bold text-slate-900">
                              ₹{pay.amount?.toLocaleString()}
                            </td>
                            <td className="py-3.5">
                              <span className={`inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-extrabold ${
                                pay.status === "CAPTURED" ? "bg-emerald-100 text-emerald-800" :
                                pay.status === "PENDING" ? "bg-amber-100 text-amber-800" :
                                "bg-rose-100 text-rose-800"
                              }`}>
                                {pay.status === "CAPTURED" ? <Check className="w-3.5 h-3.5" /> : pay.status === "FAILED" ? <X className="w-3.5 h-3.5" /> : null}
                                {pay.status}
                              </span>
                            </td>
                            <td className="py-3.5 text-center">
                              {pay.status === "FAILED" ? (
                                <button
                                  onClick={() => handleRecoverPayment(pay.id)}
                                  className="px-3.5 py-1.5 bg-rose-600 hover:bg-rose-700 text-white rounded-lg text-xs font-black shadow-xs hover:shadow-md transition-all cursor-pointer flex items-center justify-center mx-auto"
                                >
                                  <RefreshCw className="w-3 h-3 mr-1.5 animate-spin" style={{ animationDuration: "3s" }} />
                                  Recover Webhook
                                </button>
                              ) : (
                                <span className="text-slate-400 text-xs flex items-center justify-center gap-1 font-semibold">
                                  <CheckCircle2 className="w-4 h-4 text-emerald-500" /> Fully Captured
                                </span>
                              )}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              )}

              {/* TAB 3: TENDERS CREATED CRAWL OR ADD */}
              {activeTab === "tenders" && (
                <div>
                  <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 mb-6">
                    <div>
                      <h2 className="text-xl font-bold text-slate-900">Tender Database Management</h2>
                      <p className="text-xs text-slate-500 mt-0.5">Publish criteria manually or edit indexes crawled</p>
                    </div>
                    <button
                      onClick={() => {
                        setEditingTender(null);
                        setTenderForm({
                          title: "",
                          department: "",
                          state: "Bihar",
                          category: "Construction",
                          subCategory: "Civil Work",
                          tenderValue: "",
                          emdAmount: "",
                          bidSubmissionDeadline: new Date(Date.now() + 15 * 24 * 3600 * 1000).toISOString().split("T")[0],
                          workDescription: ""
                        });
                        setIsAddingTender(true);
                      }}
                      className="px-4 py-2 bg-blue-650 hover:bg-blue-700 text-white rounded-xl font-bold text-sm shadow-xs transition-colors flex items-center shrink-0 cursor-pointer"
                    >
                      <Plus className="w-4.5 h-4.5 mr-1.5" />
                      Publish Manual Tender
                    </button>
                  </div>

                  <div className="overflow-x-auto">
                    <table className="w-full text-left border-collapse">
                      <thead>
                        <tr className="border-b border-slate-150 text-xs font-extrabold uppercase text-slate-450 tracking-wider">
                          <th className="pb-3.5 w-1/12 text-center">Ref Id</th>
                          <th className="pb-3.5 w-4/12">Tender Contract Profile</th>
                          <th className="pb-3.5">Category</th>
                          <th className="pb-3.5">Estimated Cost</th>
                          <th className="pb-3.5">Deadline</th>
                          <th className="pb-3.5 text-right">Actions</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-150 text-sm">
                        {tendersList.map((td) => (
                          <tr key={td.id} className="hover:bg-slate-50/50">
                            <td className="py-4 text-center">
                              <span className="text-xs font-mono bg-slate-100 px-2 py-0.5 rounded font-bold text-slate-650">
                                {td.id}
                              </span>
                            </td>
                            <td className="py-4">
                              <div className="font-bold text-slate-850 line-clamp-2" title={td.title}>{td.title}</div>
                              <div className="text-xs text-slate-500 font-medium mt-1">{td.department}</div>
                              <div className="text-[11px] text-slate-400 mt-1 flex items-center">
                                <span className="bg-blue-50 text-blue-700 font-extrabold px-1.5 py-0.2 rounded text-[10px] mr-2">
                                  {td.sourcePortal}
                                </span>
                                📍 {td.location || td.state}
                              </div>
                            </td>
                            <td className="py-4">
                              <div className="font-bold text-slate-700">{td.category}</div>
                              <div className="text-xs text-slate-450">{td.subCategory}</div>
                            </td>
                            <td className="py-4 font-black text-slate-800">
                              {td.tenderValue ? `₹${td.tenderValue} Cr` : "Not Stated"}
                              {td.emdAmount && <div className="text-xs text-slate-450 font-normal mt-0.5">EMD: ₹{td.emdAmount} L</div>}
                            </td>
                            <td className="py-4">
                              <span className="text-slate-700 font-semibold font-mono text-xs">
                                {td.bidSubmissionDeadline ? new Date(td.bidSubmissionDeadline).toLocaleDateString() : "No Limit"}
                              </span>
                              <div className="text-[10px] text-slate-400 mt-0.5 uppercase tracking-wider font-extrabold">{td.status}</div>
                            </td>
                            <td className="py-4 text-right">
                              <div className="flex gap-2 justify-end">
                                <button
                                  onClick={() => {
                                    setEditingTender(td);
                                    setTenderForm({
                                      title: td.title || "",
                                      department: td.department || "",
                                      state: td.state || "Bihar",
                                      category: td.category || "Construction",
                                      subCategory: td.subCategory || "Civil Work",
                                      tenderValue: td.tenderValue !== null ? String(td.tenderValue) : "",
                                      emdAmount: td.emdAmount !== null ? String(td.emdAmount) : "",
                                      bidSubmissionDeadline: td.bidSubmissionDeadline ? td.bidSubmissionDeadline.split("T")[0] : "",
                                      workDescription: td.workDescription || ""
                                    });
                                    setIsAddingTender(true);
                                  }}
                                  className="p-1 px-2.2 bg-slate-50 border border-slate-200 hover:bg-slate-100 text-slate-700 rounded-lg text-xs font-bold shrink-0 cursor-pointer"
                                  title="Edit Tender specifications"
                                >
                                  <Edit2 className="w-3.5 h-3.5" />
                                </button>
                                <button
                                  onClick={() => handleDeleteTender(td.id)}
                                  className="p-1 px-2.2 bg-rose-50 border border-rose-100 hover:bg-rose-100 text-rose-700 rounded-lg text-xs font-bold shrink-0 cursor-pointer"
                                  title="Wipe Tender"
                                >
                                  <Trash2 className="w-3.5 h-3.5" />
                                </button>
                              </div>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              )}

              {/* TAB 4: COMPLIANCE DOCUMENTS VERIFICATION */}
              {activeTab === "documents" && (
                <div>
                  <h2 className="text-xl font-bold text-slate-900 mb-2">Compliance Vault Documents Auditor</h2>
                  <p className="text-xs text-slate-500 mb-6 font-medium">Verify company certificates uploaded by bidders to authorize automated AI bidding eligibility passes.</p>

                  <div className="overflow-x-auto">
                    <table className="w-full text-left border-collapse">
                      <thead>
                        <tr className="border-b border-slate-150 text-xs font-extrabold uppercase text-slate-450 tracking-wider">
                          <th className="pb-3.5">Corporate Document</th>
                          <th className="pb-3.5">User Identity</th>
                          <th className="pb-3.5">File Reference</th>
                          <th className="pb-3.5">Expiry Threshold</th>
                          <th className="pb-3.5">Verification Toggle</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-150 text-sm">
                        {documentsList.map((doc) => (
                          <tr key={doc.id} className="hover:bg-slate-50/50">
                            <td className="py-4">
                              <span className="text-xs font-extrabold bg-blue-50 text-blue-750 px-2 py-1 rounded border border-blue-105">
                                {doc.documentType}
                              </span>
                              <div className="text-xs text-slate-500 mt-2 font-medium">
                                Uploaded on {new Date(doc.createdAt).toLocaleDateString()}
                              </div>
                            </td>
                            <td className="py-4 font-bold text-slate-800">
                              {doc.userId === "u-1" ? "Ramesh Sharma" : "Guest Account"}
                              <div className="text-xs text-slate-450 font-mono font-normal mt-0.5">UserId: {doc.userId}</div>
                            </td>
                            <td className="py-4 font-semibold text-blue-600 hover:underline">
                              <a href={doc.s3Url} target="_blank" rel="noopener noreferrer">
                                {doc.fileName}
                              </a>
                            </td>
                            <td className="py-4">
                              {doc.expiryDate ? (
                                <span className={`text-xs font-bold ${
                                  new Date(doc.expiryDate) < new Date(Date.now() + 60 * 24 * 3600000) ? "text-rose-600 bg-rose-50 px-2 py-0.5 rounded border border-rose-100" : "text-slate-600"
                                }`}>
                                  ⌛ {new Date(doc.expiryDate).toLocaleDateString()}
                                </span>
                              ) : (
                                <span className="text-slate-400 text-xs">No Expiry Limit</span>
                              )}
                            </td>
                            <td className="py-4">
                              <button
                                onClick={() => handleToggleDocumentVerify(doc.id, doc.isVerified)}
                                className={`flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-extrabold border transition-all cursor-pointer ${
                                  doc.isVerified 
                                    ? "bg-emerald-50 border-emerald-300 text-emerald-800 hover:bg-emerald-100" 
                                    : "bg-amber-50 border-amber-300 text-amber-800 hover:bg-amber-100"
                                }`}
                              >
                                {doc.isVerified ? (
                                  <>
                                    <Check className="w-3.5 h-3.5" /> Checked & Approved
                                  </>
                                ) : (
                                  <>
                                    <AlertTriangle className="w-3.5 h-3.5 animate-bounce" /> Under review (Authorize)
                                  </>
                                )}
                              </button>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              )}

              {/* TAB 5: AI UTILIZATION TELEMETRY */}
              {activeTab === "ai-usage" && (
                <div>
                  <h2 className="text-xl font-bold text-slate-900 mb-6">Generative AI Inference Tracking & Token Load</h2>

                  <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-8">
                    <div className="bg-slate-50 border border-slate-200 rounded-2xl p-5 flex flex-col justify-between">
                      <div>
                        <Sparkles className="w-6 h-6 text-blue-600 mb-2.5" />
                        <div className="text-xs text-slate-500 font-bold uppercase tracking-wider">Total LLM Generations</div>
                        <div className="text-3xl font-black text-slate-900 mt-1">{aiUsageStats.totalGenerations}</div>
                      </div>
                      <div className="text-xs text-slate-450 mt-4 font-semibold">Active Gemini 2.x Context mappings</div>
                    </div>

                    <div className="bg-slate-50 border border-slate-200 rounded-2xl p-5 flex flex-col justify-between">
                      <div>
                        <Compass className="w-6 h-6 text-emerald-600 mb-2.5" />
                        <div className="text-xs text-slate-500 font-bold uppercase tracking-wider">Gross Tokens Consumed</div>
                        <div className="text-3xl font-black text-slate-900 mt-1">{aiUsageStats.totalTokensConsumed?.toLocaleString()}</div>
                      </div>
                      <div className="text-xs text-emerald-600 font-bold mt-4">Average 5.2k tokens/Inference</div>
                    </div>

                    <div className="bg-slate-50 border border-slate-200 p-5 rounded-2xl flex flex-col justify-between">
                      <div className="text-xs text-slate-500 font-bold uppercase tracking-wider">Inference Token Distribution</div>
                      <div className="h-28 mt-2">
                        <ResponsiveContainer width="100%" height="100%">
                          <RePieChart>
                            <Pie
                              data={aiUsageStats.tokensBreakup}
                              cx="50%"
                              cy="50%"
                              innerRadius={30}
                              outerRadius={45}
                              paddingAngle={3}
                              dataKey="val"
                            >
                              {aiUsageStats.tokensBreakup?.map((entry: any, index: number) => (
                                <Cell key={`cell-${index}`} fill={entry.color} />
                              ))}
                            </Pie>
                            <ChartTooltip />
                          </RePieChart>
                        </ResponsiveContainer>
                      </div>
                    </div>
                  </div>

                  {/* Dynamic Color Codes list */}
                  <div className="mb-8">
                    <h3 className="text-xs font-black text-slate-450 uppercase tracking-widest mb-3">Model Core breakdown</h3>
                    <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
                      {aiUsageStats.tokensBreakup?.map((entry: any) => (
                        <div key={entry.name} className="flex items-center space-x-2 bg-slate-50 px-3.5 py-2 rounded-xl border border-slate-150">
                          <div className="w-3 h-3 rounded-full shrink-0" style={{ backgroundColor: entry.color }} />
                          <div className="text-xs">
                            <span className="font-bold text-slate-800 block">{entry.name}</span>
                            <span className="text-[10px] text-slate-400 font-mono mt-0.5">{(entry.val).toLocaleString()} tokens</span>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>

                  <h3 className="text-sm font-black text-slate-500 uppercase tracking-wider mb-3">User API Load metrics</h3>
                  <div className="bg-slate-50 border border-slate-200 rounded-2xl p-5 overflow-x-auto">
                    <table className="w-full text-left text-xs border-collapse">
                      <thead>
                        <tr className="border-b border-slate-200 text-slate-400 uppercase font-black">
                          <th className="pb-2">Subscriber Email</th>
                          <th className="pb-2">Calculated Load</th>
                          <th className="pb-2">Total Tokens Mapping</th>
                          <th className="pb-2 text-right">Inference Share</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-150 text-slate-700">
                        {aiUsageStats.userBreakup?.map((usr: any) => (
                          <tr key={usr.email}>
                            <td className="py-3 font-bold text-slate-900">
                              {usr.name} <span className="font-mono text-slate-450 font-normal">({usr.email})</span>
                            </td>
                            <td className="py-3">
                              <div className="w-40 bg-slate-200 rounded-full h-2">
                                <div className="bg-blue-600 h-2 rounded-full" style={{ width: `${usr.percentage}%` }} />
                              </div>
                            </td>
                            <td className="py-3 font-mono font-bold text-slate-650">{usr.tokens?.toLocaleString()} tokens</td>
                            <td className="py-3 text-right font-black">{usr.percentage}%</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              )}

              {/* TAB 6: SUPPORT TICKETS & RESOLVE REPLIES */}
              {activeTab === "support" && (
                <div>
                  <h2 className="text-xl font-bold text-slate-900 mb-2">Ticketing Resolution Desk</h2>
                  <p className="text-xs text-slate-500 mb-6">Respond directly to users addressing e-procurement billing declines, compliance questions, or technical crashes.</p>

                  <div className="grid grid-cols-1 lg:grid-cols-12 gap-8">
                    
                    {/* Tickets Sidebar lists */}
                    <div className="lg:col-span-5 space-y-3 max-h-[500px] overflow-y-auto pr-2">
                      {ticketsList.map((ticket) => (
                        <div
                          key={ticket.id}
                          onClick={() => {
                            setSelectedTicket(ticket);
                            setReplyMessage("");
                          }}
                          className={`p-4 rounded-xl border cursor-pointer transition-all ${
                            selectedTicket?.id === ticket.id
                              ? "bg-blue-50 border-blue-400 shadow-sm"
                              : "bg-white border-slate-200 hover:bg-slate-50"
                          }`}
                        >
                          <div className="flex justify-between items-start gap-1">
                            <span className="text-[10px] font-mono bg-slate-100 px-1.5 py-0.5 rounded font-bold text-slate-600">
                              {ticket.id}
                            </span>
                            <span className={`text-[9.5px] font-extrabold px-2 py-0.5 rounded border ${
                              ticket.status === "RESOLVED" ? "bg-emerald-50 text-emerald-800 border-emerald-100" :
                              ticket.status === "IN_PROGRESS" ? "bg-blue-50 text-blue-800 border-blue-105" :
                              "bg-red-50 text-red-800 border-red-105"
                            }`}>
                              {ticket.status}
                            </span>
                          </div>

                          <h3 className="font-bold text-slate-850 mt-1.5 line-clamp-1">{ticket.subject}</h3>
                          <p className="text-xs text-slate-500 line-clamp-2 mt-1">{ticket.message}</p>
                          
                          <div className="flex justify-between items-center gap-2 mt-3 text-[11px] text-slate-500">
                            <strong>{ticket.userName}</strong>
                            <span className={`px-1.5 py-0.2 rounded font-mono text-[9px] font-bold ${getPriorityColor(ticket.priority)}`}>
                              {ticket.priority}
                            </span>
                          </div>
                        </div>
                      ))}
                    </div>

                    {/* Active Ticket Conversations Thread */}
                    <div className="lg:col-span-7 bg-slate-50 border border-slate-200 rounded-3xl p-5 flex flex-col justify-between min-h-[440px] max-h-[600px] overflow-hidden">
                      {selectedTicket ? (
                        <div className="flex flex-col h-full justify-between">
                          
                          {/* Thread Title Header */}
                          <div className="border-b border-slate-200 pb-3.5 mb-3.5">
                            <div className="flex items-center justify-between text-xs gap-3">
                              <span className="text-blue-700 font-extrabold">[{selectedTicket.category}] {selectedTicket.subject}</span>
                              <button
                                onClick={async () => {
                                  // Live close action
                                  try {
                                    const res = await fetch(`/api/support-tickets/${selectedTicket.id}/reply`, {
                                      method: "POST",
                                      headers: { "Content-Type": "application/json" },
                                      body: JSON.stringify({ message: "[SYSTEM NOTE]: Ticket status was updated to RESOLVED by platform administrator." })
                                    });
                                    if (res.ok) {
                                      const payload = await res.json();
                                      // Override ticket status is resolved
                                      payload.ticket.status = "RESOLVED";
                                      setSelectedTicket(payload.ticket);
                                      onToast("Ticket flagged as RESOLVED", "STATUS_CHANGE");
                                      fetchData();
                                    }
                                  } catch (e) {}
                                }}
                                className="px-2.5 py-1 bg-emerald-650 hover:bg-emerald-700 text-white rounded-lg text-[10.5px] font-black cursor-pointer"
                              >
                                Flag as Resolved
                              </button>
                            </div>
                            <div className="text-slate-450 text-[11px] mt-2 font-medium">
                              Raised by: <strong className="text-slate-700">{selectedTicket.userName}</strong> ({selectedTicket.userEmail}) 
                            </div>
                          </div>

                          {/* Chat Bubbles List */}
                          <div className="flex-1 space-y-3.5 overflow-y-auto mb-4 pr-1 text-xs">
                            {selectedTicket.replies?.map((rep: any, idx: number) => (
                              <div 
                                key={idx} 
                                className={`flex flex-col max-w-[85%] ${
                                  rep.sender === "ADMIN" ? "ml-auto items-end" : "mr-auto items-start"
                                }`}
                              >
                                <div className={`p-3 rounded-2xl leading-relaxed text-[12.5px] font-medium ${
                                  rep.sender === "ADMIN" 
                                    ? "bg-blue-600 text-white rounded-tr-none" 
                                    : "bg-white border border-slate-200 text-slate-800 rounded-tl-none shadow-xs"
                                }`}>
                                  {rep.message}
                                </div>
                                <span className="text-[9.5px] text-slate-400 font-semibold mt-1">
                                  {rep.sender === "ADMIN" ? "You" : rep.sender} • {new Date(rep.timestamp).toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'})}
                                </span>
                              </div>
                            ))}
                          </div>

                          {/* Reply composition form */}
                          <form onSubmit={handleSendTicketReply} className="flex gap-2">
                            <input
                              type="text"
                              value={replyMessage}
                              onChange={(e) => setReplyMessage(e.target.value)}
                              placeholder="Write response, instruct user, or clarify billing..."
                              className="flex-1 px-4 py-2 bg-white border border-slate-300 rounded-xl text-sm focus:outline-hidden focus:border-blue-500"
                            />
                            <button
                              type="submit"
                              className="px-4 py-2 bg-blue-650 hover:bg-blue-700 text-white font-extrabold rounded-xl text-sm shadow-xs transition-colors flex items-center cursor-pointer"
                            >
                              <Send className="w-3.5 h-3.5" />
                            </button>
                          </form>

                        </div>
                      ) : (
                        <div className="flex flex-col items-center justify-center h-full text-slate-400 text-center py-10 space-y-2">
                          <MessageSquare className="w-10 h-10 text-slate-300 animate-pulse" />
                          <p className="font-bold text-sm">No Conversations Selected</p>
                          <p className="text-xs max-w-xs">Select a help desk ticket from the sidebar lists to view conversations and process replies.</p>
                        </div>
                      )}
                    </div>

                  </div>
                </div>
              )}

              {/* TAB 7: SYSTEM CONFIGURATION SETTINGS */}
              {activeTab === "settings" && (
                <div className="max-w-xl">
                  <h2 className="text-xl font-bold text-slate-900 mb-2">Core System Configuration Parameters</h2>
                  <p className="text-xs text-slate-500 mb-6">Modify live API switches, client throttling limits, and simulated multipliers.</p>

                  <form onSubmit={handleSaveSettings} className="space-y-6">
                    <div className="bg-slate-50 border border-slate-200 rounded-2xl p-5 space-y-4">
                      
                      {/* Checkbox 1 */}
                      <div className="flex items-center justify-between border-b border-slate-150 pb-4">
                        <div>
                          <label className="text-slate-850 font-extrabold text-sm block">Live Gateway Routing</label>
                          <span className="text-slate-500 text-xs">Route checkout requests to production Razorpay servers if credentials exist.</span>
                        </div>
                        <input
                          type="checkbox"
                          checked={systemSettings.liveGatewayActive}
                          onChange={(e) => setSystemSettings({ ...systemSettings, liveGatewayActive: e.target.checked })}
                          className="w-4.5 h-4.5 accent-blue-600 rounded cursor-pointer"
                        />
                      </div>

                      {/* Number input slider */}
                      <div className="flex flex-col gap-1.5 border-b border-slate-150 pb-4">
                        <div className="flex justify-between items-center text-sm">
                          <label className="text-slate-850 font-extrabold">Inference Restraint Limits</label>
                          <span className="font-mono bg-blue-50 text-blue-700 px-2 py-0.5 rounded text-xs font-black">
                            {systemSettings.aiRateLimitPerMin} RPM
                          </span>
                        </div>
                        <span className="text-slate-455 text-xs">Maximum Gemini LLM operations permitted per account per minute before rate-limiting triggers.</span>
                        <input
                          type="range"
                          min="10"
                          max="200"
                          step="10"
                          value={systemSettings.aiRateLimitPerMin || 60}
                          onChange={(e) => setSystemSettings({ ...systemSettings, aiRateLimitPerMin: Number(e.target.value) })}
                          className="w-full accent-blue-600 cursor-pointer mt-1"
                        />
                      </div>

                      {/* Checkbox 2 */}
                      <div className="flex items-center justify-between border-b border-slate-150 pb-4">
                        <div>
                          <label className="text-slate-850 font-extrabold text-sm block">Simulated Sandbox Sandbox Mode</label>
                          <span className="text-slate-455 text-xs">Simulate Razorpay orders, webhooks, and manual document approvals.</span>
                        </div>
                        <input
                          type="checkbox"
                          checked={systemSettings.sandboxMode !== false}
                          onChange={(e) => setSystemSettings({ ...systemSettings, sandboxMode: e.target.checked })}
                          className="w-4.5 h-4.5 accent-blue-600 rounded cursor-pointer"
                        />
                      </div>

                      {/* Fee Multiplier */}
                      <div className="flex items-center justify-between">
                        <div>
                          <label className="text-slate-850 font-extrabold text-sm block">Custom Service Fee Multiplier</label>
                          <span className="text-slate-455 text-xs">Adjust tender registration and bid filing markup multiplier parameters.</span>
                        </div>
                        <input
                          type="number"
                          step="0.1"
                          min="0.5"
                          max="3.0"
                          value={systemSettings.customServiceFeeMultiplier || 1.0}
                          onChange={(e) => setSystemSettings({ ...systemSettings, customServiceFeeMultiplier: Number(e.target.value) })}
                          className="w-20 px-2 py-1 bg-white border border-slate-350 rounded-lg text-right font-bold text-sm"
                        />
                      </div>

                    </div>

                    <button
                      type="submit"
                      className="px-5 py-2.5 bg-blue-650 hover:bg-blue-700 text-white rounded-xl text-sm font-extrabold shadow-sm hover:shadow-xs transition-colors cursor-pointer"
                    >
                      Save Configuration Parameters
                    </button>
                  </form>
                </div>
              )}

              {/* TAB 8: SECURITY AUDIT LOGS */}
              {activeTab === "audit-logs" && (
                <div className="space-y-6">
                  <div className="flex justify-between items-center">
                    <div>
                      <h2 className="text-xl font-bold text-slate-900 mb-1">Security Audit Trails & Telemetry</h2>
                      <p className="text-xs text-slate-500">Live immutable traces of security validations, logins, files, and threat detections.</p>
                    </div>
                    <button 
                      type="button"
                      onClick={() => fetchData()}
                      className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold text-blue-600 bg-blue-50 hover:bg-blue-100 rounded-lg transition-colors cursor-pointer"
                    >
                      <RefreshCw className="w-3.5 h-3.5" />
                      Refresh Trails
                    </button>
                  </div>

                  <div className="bg-slate-50 border border-slate-200 rounded-2xl p-4">
                    <div className="overflow-x-auto">
                      <table className="w-full text-left border-collapse">
                        <thead>
                          <tr className="border-b border-slate-200 text-xs font-bold text-slate-400">
                            <th className="pb-3 font-semibold text-slate-600 uppercase tracking-wider">Timestamp</th>
                            <th className="pb-3 font-semibold text-slate-600 uppercase tracking-wider">Action</th>
                            <th className="pb-3 font-semibold text-slate-600 uppercase tracking-wider">User Account</th>
                            <th className="pb-3 font-semibold text-slate-600 uppercase tracking-wider">IP Address</th>
                            <th className="pb-3 font-semibold text-slate-600 uppercase tracking-wider text-center">Status</th>
                            <th className="pb-3 font-semibold text-slate-600 uppercase tracking-wider">Description</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-150 text-sm">
                          {auditLogsList.length === 0 ? (
                            <tr>
                              <td colSpan={6} className="py-8 text-center text-slate-400 font-medium">
                                No secure telemetry logs recorded yet. Create account actions to record active logs.
                              </td>
                            </tr>
                          ) : (
                            auditLogsList.map((log) => (
                              <tr key={log.id} className="hover:bg-slate-100/50 transition-colors">
                                <td className="py-3.5 font-mono text-xs text-slate-500 whitespace-nowrap">
                                  {new Date(log.timestamp).toLocaleString("en-IN", { hourCycle: "h23" })}
                                </td>
                                <td className="py-3.5 font-bold text-slate-800 text-xs tracking-wider">
                                  {log.action}
                                </td>
                                <td className="py-3.5 text-xs font-medium text-slate-600">
                                  {log.userEmail}
                                </td>
                                <td className="py-3.5 font-mono text-xs text-slate-500">
                                  {log.ipAddress}
                                </td>
                                <td className="py-3.5 text-center">
                                  <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-extrabold ${
                                    log.status === "SUCCESS" ? "bg-green-100 text-green-700" :
                                    log.status === "BLOCKED" ? "bg-red-100 text-red-700" :
                                    log.status === "WARNING" ? "bg-amber-100 text-amber-700" :
                                    "bg-slate-200 text-slate-700"
                                  }`}>
                                    {log.status}
                                  </span>
                                </td>
                                <td className="py-3.5 text-xs text-slate-600 font-medium max-w-sm xl:max-w-md truncate" title={log.description}>
                                  {log.description}
                                </td>
                              </tr>
                            ))
                          )}
                        </tbody>
                      </table>
                    </div>
                  </div>

                  {/* Backup Service Section & Action Panel */}
                  <div className="bg-white border border-slate-200 rounded-2xl p-5 space-y-4 shadow-xs">
                    <div className="flex justify-between items-center">
                      <div>
                        <h3 className="text-md font-bold text-slate-900 flex items-center gap-1.5">
                          <Cloud className="w-4.5 h-4.5 text-blue-600 shrink-0" />
                          Durable Backups & Disaster Recovery
                        </h3>
                        <p className="text-xs text-slate-500">Automated dated system backup, retention ceilings (latest 10) and instant data recoveries.</p>
                      </div>
                      <button
                        type="button"
                        onClick={handleTriggerBackup}
                        className="flex items-center gap-1.5 px-4 py-2 text-xs font-bold text-white bg-blue-600 hover:bg-blue-700 rounded-xl shadow-xs transition-colors cursor-pointer"
                      >
                        <Database className="w-3.5 h-3.5" />
                        Trigger Backup Now
                      </button>
                    </div>

                    <div className="border border-slate-100 rounded-xl overflow-hidden text-xs">
                      <div className="grid grid-cols-3 bg-slate-50 p-2.5 font-bold text-slate-500">
                        <div>Backup Filename</div>
                        <div>Storage Size</div>
                        <div>Created Timestamp</div>
                      </div>
                      <div className="divide-y divide-slate-100">
                        {backupsList.length === 0 ? (
                          <div className="p-4 text-center text-slate-400 font-medium bg-slate-50/50">
                            No durable database backup archives compiled recently. Click "Trigger Backup Now" to instantiate.
                          </div>
                        ) : (
                          backupsList.map((backup) => (
                            <div key={backup.id} className="grid grid-cols-3 p-2.5 text-slate-600 font-mono hover:bg-slate-50/70 transition-colors">
                              <div className="font-semibold text-slate-700 truncate" title={backup.fileName}>{backup.fileName}</div>
                              <div>{(backup.sizeBytes / 1024).toFixed(2)} KB</div>
                              <div>{new Date(backup.timestamp).toLocaleString("en-IN")}</div>
                            </div>
                          ))
                        )}
                      </div>
                    </div>
                  </div>
                </div>
              )}

            </div>
          )}

        </div>

      </div>

      {/* MODAL 1: EDIT REGISTERED USER ACCOUNT PROFILE */}
      {editingUser && (
        <div className="fixed inset-0 bg-slate-900/40 backdrop-blur-xs flex items-center justify-center z-[1100]">
          <div className="bg-white rounded-3xl border border-slate-200 p-6 max-w-sm w-full mx-4 shadow-2xl relative">
            <button 
              onClick={() => setEditingUser(null)}
              className="absolute top-4 right-4 text-slate-400 hover:text-slate-600 cursor-pointer"
            >
              <X className="w-5 h-5" />
            </button>

            <h3 className="text-lg font-extrabold text-slate-900 mb-1">Adjust Plan & Role Configuration</h3>
            <p className="text-xs text-slate-500 mb-4 font-semibold">Account: {editingUser.name}</p>

            <div className="space-y-4">
              <div>
                <label className="text-xs text-slate-500 font-bold uppercase tracking-wider block mb-1">Assigned Premium Plan</label>
                <select
                  value={editingUser.plan}
                  onChange={(e) => setEditingUser({ ...editingUser, plan: e.target.value })}
                  className="w-full px-3 py-2 bg-slate-50 border border-slate-350 rounded-xl text-sm font-semibold"
                >
                  <option value="FREE">FREE</option>
                  <option value="STARTER">STARTER</option>
                  <option value="PROFESSIONAL">PROFESSIONAL</option>
                  <option value="ENTERPRISE">ENTERPRISE</option>
                </select>
              </div>

              <div>
                <label className="text-xs text-slate-500 font-bold uppercase tracking-wider block mb-1">Access Role Gating</label>
                <select
                  value={editingUser.role}
                  onChange={(e) => setEditingUser({ ...editingUser, role: e.target.value })}
                  className="w-full px-3 py-2 bg-slate-50 border border-slate-350 rounded-xl text-sm font-semibold"
                >
                  <option value="USER">USER (Standard Client)</option>
                  <option value="ADMIN">ADMIN (System Administrator)</option>
                </select>
              </div>

              <div className="flex items-center gap-2">
                <input
                  type="checkbox"
                  id="usr-trial-active"
                  checked={editingUser.isTrialActive}
                  onChange={(e) => setEditingUser({ ...editingUser, isTrialActive: e.target.checked })}
                  className="w-4 h-4 accent-blue-600 rounded cursor-pointer"
                />
                <label htmlFor="usr-trial-active" className="text-xs text-slate-700 font-bold cursor-pointer">
                  Activate Simulated Trial State
                </label>
              </div>

              {editingUser.isTrialActive && (
                <div>
                  <label className="text-xs text-slate-500 font-bold block mb-1">Simulated Days Elapsed</label>
                  <input
                    type="number"
                    min="1"
                    max="10"
                    value={editingUser.trialDaysElapsed || 1}
                    onChange={(e) => setEditingUser({ ...editingUser, trialDaysElapsed: Number(e.target.value) })}
                    className="w-full px-3 py-1.5 bg-slate-50 border border-slate-350 rounded-xl text-sm text-center"
                  />
                </div>
              )}

              <button
                onClick={() => handleUpdateUser(editingUser.id, {
                  plan: editingUser.plan,
                  role: editingUser.role,
                  isTrialActive: editingUser.isTrialActive,
                  trialDaysElapsed: editingUser.trialDaysElapsed
                })}
                className="w-full py-2.5 bg-blue-650 hover:bg-blue-700 text-white rounded-xl text-sm font-extrabold cursor-pointer transition-colors mt-2"
              >
                Apply Parameters
              </button>
            </div>
          </div>
        </div>
      )}

      {/* MODAL 2: ADD / EDIT E-PROCUREMENT TENDER BID NOTICE */}
      {isAddingTender && (
        <div className="fixed inset-0 bg-slate-900/40 backdrop-blur-xs flex items-center justify-center z-[1100] overflow-y-auto pt-10 pb-10">
          <div className="bg-white rounded-3xl border border-slate-200 p-6 max-w-lg w-full mx-4 shadow-2xl relative my-auto">
            <button 
              onClick={() => setIsAddingTender(false)}
              className="absolute top-4 right-4 text-slate-400 hover:text-slate-600 cursor-pointer"
            >
              <X className="w-5 h-5" />
            </button>

            <h3 className="text-lg font-black text-slate-900 mb-1">
              {editingTender ? "Edit Contract specifications" : "Publish e-Procurement Public Contract"}
            </h3>
            <p className="text-xs text-slate-500 mb-5 font-semibold">
              {editingTender ? "This adjustments will update live criteria indexes and matching percentages." : "Inject details directly to mock crawler database."}
            </p>

            <form onSubmit={handleSaveTender} className="space-y-4 text-xs font-semibold text-slate-650">
              
              <div>
                <label className="block mb-1 font-bold text-slate-700">Contract Title</label>
                <input
                  type="text"
                  required
                  value={tenderForm.title}
                  onChange={(e) => setTenderForm({ ...tenderForm, title: e.target.value })}
                  placeholder="e.g. Widening and drainage solutions on Patna Ring stretch"
                  className="w-full px-3 py-2 bg-slate-50 border border-slate-350 rounded-xl text-sm font-medium"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block mb-1 font-bold text-slate-700">Authority / Department</label>
                  <input
                    type="text"
                    required
                    value={tenderForm.department}
                    onChange={(e) => setTenderForm({ ...tenderForm, department: e.target.value })}
                    placeholder="e.g. Central PWD (CPWD)"
                    className="w-full px-3 py-2 bg-slate-50 border border-slate-350 rounded-xl text-sm font-medium"
                  />
                </div>
                <div>
                  <label className="block mb-1 font-bold text-slate-700">Contract State location</label>
                  <select
                    value={tenderForm.state}
                    onChange={(e) => setTenderForm({ ...tenderForm, state: e.target.value })}
                    className="w-full px-3 py-2 bg-slate-50 border border-slate-350 rounded-xl text-sm font-medium"
                  >
                    <option value="Bihar">Bihar</option>
                    <option value="Jharkhand">Jharkhand</option>
                    <option value="Uttar Pradesh">Uttar Pradesh</option>
                    <option value="Delhi">Delhi</option>
                    <option value="Maharashtra">Maharashtra</option>
                  </select>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block mb-1 font-bold text-slate-700">Core Category</label>
                  <select
                    value={tenderForm.category}
                    onChange={(e) => setTenderForm({ ...tenderForm, category: e.target.value })}
                    className="w-full px-3 py-2 bg-slate-50 border border-slate-350 rounded-xl text-sm font-medium"
                  >
                    <option value="Construction">Construction</option>
                    <option value="Electrical">Electrical</option>
                    <option value="IT Support">IT Support</option>
                    <option value="Water Supply">Water Supply</option>
                    <option value="Roads">Roads</option>
                  </select>
                </div>
                <div>
                  <label className="block mb-1 font-bold text-slate-700">Sub-Category</label>
                  <input
                    type="text"
                    value={tenderForm.subCategory}
                    onChange={(e) => setTenderForm({ ...tenderForm, subCategory: e.target.value })}
                    className="w-full px-3 py-2 bg-slate-50 border border-slate-350 rounded-xl text-sm font-medium"
                  />
                </div>
              </div>

              <div className="grid grid-cols-3 gap-3">
                <div>
                  <label className="block mb-1 font-bold text-slate-700">Tender Value (₹ Crores)</label>
                  <input
                    type="number"
                    step="0.01"
                    required
                    value={tenderForm.tenderValue}
                    onChange={(e) => setTenderForm({ ...tenderForm, tenderValue: e.target.value })}
                    placeholder="e.g. 5.40"
                    className="w-full px-3 py-2 bg-slate-50 border border-slate-350 rounded-xl text-sm font-medium"
                  />
                </div>
                <div>
                  <label className="block mb-1 font-bold text-slate-700">EMD (₹ Lakhs)</label>
                  <input
                    type="number"
                    step="0.1"
                    required
                    value={tenderForm.emdAmount}
                    onChange={(e) => setTenderForm({ ...tenderForm, emdAmount: e.target.value })}
                    placeholder="e.g. 10.8"
                    className="w-full px-3 py-2 bg-slate-50 border border-slate-350 rounded-xl text-sm font-medium"
                  />
                </div>
                <div>
                  <label className="block mb-1 font-bold text-slate-700">Submission Closing</label>
                  <input
                    type="date"
                    required
                    value={tenderForm.bidSubmissionDeadline}
                    onChange={(e) => setTenderForm({ ...tenderForm, bidSubmissionDeadline: e.target.value })}
                    className="w-full px-3 py-2 bg-slate-50 border border-slate-350 rounded-xl text-sm font-medium"
                  />
                </div>
              </div>

              <div>
                <label className="block mb-1 font-bold text-slate-700">Detailed Scope of Work</label>
                <textarea
                  value={tenderForm.workDescription}
                  onChange={(e) => setTenderForm({ ...tenderForm, workDescription: e.target.value })}
                  placeholder="Insert schedule of quantities, experience thresholds, or compliance requirements."
                  rows={4}
                  className="w-full px-3 py-2 bg-slate-50 border border-slate-350 rounded-xl text-sm font-medium"
                />
              </div>

              <button
                type="submit"
                className="w-full py-2.5 bg-blue-650 hover:bg-blue-700 text-white rounded-xl text-sm font-black shadow-xs transition-colors cursor-pointer mt-2"
              >
                {editingTender ? "Confirm specification changes" : "Authorize & Publish Live Tender Notice"}
              </button>
            </form>
          </div>
        </div>
      )}

    </div>
  );
}
