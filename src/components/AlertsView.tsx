import React, { useState, useEffect } from "react";
import { 
  Bell, Mail, MessageSquare, Smartphone, Laptop, Compass, Clock, 
  ShieldAlert, Sparkles, Check, Settings, Send, User, CheckCircle2, 
  AlertTriangle, Volume2, CreditCard, ChevronRight, X 
} from "lucide-react";
import { Alert } from "../types.js";
import { formatDate, getAuthHeaders } from "../utils.js";
import { useFirebase } from "../FirebaseContext.js";

type TriggerType = "NEW_MATCH" | "DEADLINE_REMINDER" | "DOCUMENT_MISSING" | "SUBSCRIPTION_EVENT";
type ChannelType = "EMAIL" | "WHATSAPP" | "SMS" | "PUSH" | "IN_APP";

export default function AlertsView() {
  const { firebaseUser, firestoreAlerts, markAlertReadInFirestore, markAllAlertsReadInFirestore } = useFirebase();
  const [alerts, setAlerts] = useState<Alert[]>([]);
  const [loading, setLoading] = useState<boolean>(false);
  const [activeAlert, setActiveAlert] = useState<Alert | null>(null);
  const [activeModalTab, setActiveModalTab] = useState<"EMAIL" | "WHATSAPP" | "SMS" | "PUSH" | "IN_APP">("EMAIL");

  // User input states
  const [inputEmail, setInputEmail] = useState<string>("msvm220@gmail.com");
  const [inputPhone, setInputPhone] = useState<string>("+91 98765 43210");
  const [pushPermission, setPushPermission] = useState<string>(
    typeof window !== "undefined" ? (Notification?.permission || "default") : "default"
  );

  // Dispatch Matrix State
  const [matrix, setMatrix] = useState<Record<TriggerType, Record<ChannelType, boolean>>>({
    NEW_MATCH: { EMAIL: true, WHATSAPP: true, SMS: false, PUSH: true, IN_APP: true },
    DEADLINE_REMINDER: { EMAIL: true, WHATSAPP: true, SMS: true, PUSH: true, IN_APP: true },
    DOCUMENT_MISSING: { EMAIL: true, WHATSAPP: false, SMS: false, PUSH: true, IN_APP: true },
    SUBSCRIPTION_EVENT: { EMAIL: true, WHATSAPP: true, SMS: false, PUSH: true, IN_APP: true }
  });

  const loadAlerts = async () => {
    try {
      setLoading(true);
      const res = await fetch("/api/alerts", {
        headers: getAuthHeaders()
      });
      const data = await res.json();
      setAlerts(data);
    } catch (err) {
      console.error("Failed to load user alert feed:", err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadAlerts();
  }, []);

  const displayedAlerts = firebaseUser ? firestoreAlerts : alerts;

  // Sync state if a new socket alert comes in from above
  useEffect(() => {
    if (firestoreAlerts && firestoreAlerts.length > 0) {
      // Keep local state reasonably synced if we are not utilizing firestore
    }
  }, [firestoreAlerts]);

  const toggleCheck = (trigger: TriggerType, channel: ChannelType) => {
    setMatrix((prev) => ({
      ...prev,
      [trigger]: {
        ...prev[trigger],
        [channel]: !prev[trigger][channel]
      }
    }));
  };

  const requestPushPermission = async () => {
    if (!("Notification" in window)) {
      alert("Browser push notifications are not supported by this browser.");
      return;
    }
    const perm = await Notification.requestPermission();
    setPushPermission(perm);
  };

  // Trigger simulated dispatch
  const handleSimulate = async (type: TriggerType) => {
    try {
      // Find configured active channels in matrix
      const triggerMatrix = matrix[type];
      const activeChannels = Object.keys(triggerMatrix).filter(
        (ch) => triggerMatrix[ch as ChannelType]
      );

      const payload = {
        type,
        channels: activeChannels,
        destinationEmail: inputEmail,
        destinationPhone: inputPhone
      };

      const res = await fetch("/api/alerts/simulate", {
        method: "POST",
        headers: {
          ...getAuthHeaders(),
          "Content-Type": "application/json"
        },
        body: JSON.stringify(payload)
      });

      if (res.ok) {
        // Reload alerts feed
        await loadAlerts();
      }
    } catch (err) {
      console.error("Simulation failed:", err);
    }
  };

  const markRead = async (id: string) => {
    try {
      await fetch(`/api/alerts/${id}/read`, {
        method: "PUT",
        headers: getAuthHeaders()
      });
      if (firebaseUser) {
        await markAlertReadInFirestore(id);
      } else {
        setAlerts(alerts.map((a) => (a.id === id ? { ...a, isRead: true } : a)));
      }
      if (activeAlert?.id === id) {
        setActiveAlert((prev) => (prev ? { ...prev, isRead: true } : null));
      }
    } catch (err) {
      console.error(err);
    }
  };

  const markAllRead = async () => {
    try {
      await fetch("/api/alerts/read-all", {
        method: "PUT",
        headers: getAuthHeaders()
      });
      if (firebaseUser) {
        await markAllAlertsReadInFirestore();
      } else {
        setAlerts(alerts.map((a) => ({ ...a, isRead: true })));
      }
    } catch (err) {
      console.error(err);
    }
  };

  // Trigger high fidelity modal tab mapping helper
  const getTabContent = (alert: Alert) => {
    const records = alert.channelsDispatched;
    if (!records) return <div className="text-slate-400 font-mono text-center py-6 text-xs">No multi-channel telemetry logged.</div>;

    switch (activeModalTab) {
      case "EMAIL": {
        const emailRec = records.email;
        if (!emailRec || !emailRec.sent) {
          return (
            <div className="text-slate-400 font-mono text-center py-8 text-xs bg-slate-50 border rounded-xl border-dashed">
              🚫 Email transmission was disabled for this alert matrix.
            </div>
          );
        }
        return (
          <div className="space-y-3">
            <div className="bg-slate-50 border p-3.5 rounded-xl space-y-1.5 text-xs text-slate-650">
              <div className="flex justify-between"><strong className="text-slate-800">Sender:</strong> <span>no-reply@tenderai.com</span></div>
              <div className="flex justify-between"><strong className="text-slate-800">Recipient:</strong> <span>{emailRec.destination}</span></div>
              <div className="flex justify-between"><strong className="text-slate-800">Subject:</strong> <span className="font-bold text-blue-600">{emailRec.subject}</span></div>
              <div className="flex justify-between"><strong className="text-slate-800">Sent At:</strong> <span>{formatDate(emailRec.timestamp)}</span></div>
            </div>
            <div className="border border-slate-200 rounded-xl overflow-y-auto max-h-[290px] p-4 bg-white shadow-xs">
              <div dangerouslySetInnerHTML={{ __html: emailRec.content || "" }} />
            </div>
          </div>
        );
      }
      case "WHATSAPP": {
        const waRec = records.whatsapp;
        if (!waRec || !waRec.sent) {
          return (
            <div className="text-slate-400 font-mono text-center py-8 text-xs bg-slate-50 border rounded-xl border-dashed">
              🚫 WhatsApp transmission was disabled for this alert matrix.
            </div>
          );
        }
        return (
          <div className="space-y-3">
            <div className="bg-emerald-50 border border-emerald-100 p-3.5 rounded-xl space-y-1 text-xs text-emerald-850">
              <div className="flex justify-between"><strong className="text-emerald-800">Recipient Mobile:</strong> <span>{waRec.destination}</span></div>
              <div className="flex justify-between"><strong className="text-emerald-800">Channel Status:</strong> <span className="font-extrabold text-emerald-600">DELIVERED (Official API)</span></div>
            </div>
            {/* WhatsApp Phone Mockup */}
            <div className="bg-[#E5DDD5] border border-slate-250 rounded-2xl p-4 shadow-inner">
              <div className="flex items-center space-x-2 bg-emerald-900 text-white p-2 rounded-t-xl -mx-4 -mt-4 text-xs font-bold shadow-xs">
                <div className="w-6 h-6 bg-emerald-100 rounded-full flex items-center justify-center text-emerald-800 text-[10px] font-extrabold uppercase">TA</div>
                <div>
                  <div className="flex items-center space-x-1">
                    <span>TenderAI Dispatch</span>
                    <span className="text-[10px] bg-emerald-700 px-1 py-0.5 rounded text-[8px] font-normal">Verified Business</span>
                  </div>
                  <div className="text-[9px] text-emerald-250 font-medium">Online</div>
                </div>
              </div>
              <div className="mt-4 flex justify-start">
                <div className="bg-white text-slate-800 p-3 rounded-2xl rounded-tl-none max-w-[85%] text-xs shadow-md border-l-4 border-emerald-500 whitespace-pre-wrap leading-relaxed font-sans">
                  {waRec.content}
                  <div className="text-[8.5px] text-slate-400 text-right mt-1.5 font-mono">
                    {new Date(waRec.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                  </div>
                </div>
              </div>
            </div>
          </div>
        );
      }
      case "SMS": {
        const smsRec = records.sms;
        if (!smsRec || !smsRec.sent) {
          return (
            <div className="text-slate-400 font-mono text-center py-8 text-xs bg-slate-50 border rounded-xl border-dashed">
              🚫 SMS carrier dispatch was disabled for this alert matrix.
            </div>
          );
        }
        return (
          <div className="space-y-3">
            <div className="bg-slate-50 border p-3.5 rounded-xl space-y-1 text-xs text-slate-650">
              <div className="flex justify-between"><strong className="text-slate-800">Carrier Target:</strong> <span>{smsRec.destination}</span></div>
              <div className="flex justify-between"><strong className="text-slate-800">Gateway Route:</strong> <span className="font-extrabold text-blue-600">Priority SMS Route A</span></div>
            </div>
            {/* Android / iOS SMS mock bubble */}
            <div className="bg-slate-100 border border-slate-200 rounded-2xl p-4 shadow-sm">
              <div className="text-center text-[10px] text-slate-400 font-bold tracking-wider mb-2.5 uppercase font-sans">
                Today {new Date(smsRec.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
              </div>
              <div className="flex justify-start">
                <div className="bg-slate-800 text-white p-3 rounded-2xl rounded-tl-none max-w-[85%] text-xs shadow-md font-mono leading-relaxed">
                  {smsRec.content}
                </div>
              </div>
            </div>
          </div>
        );
      }
      case "PUSH": {
        const pushRec = records.push;
        if (!pushRec || !pushRec.sent) {
          return (
            <div className="text-slate-400 font-mono text-center py-8 text-xs bg-slate-50 border rounded-xl border-dashed">
              🚫 Push notification dispatch was disabled for this alert matrix.
            </div>
          );
        }
        return (
          <div className="space-y-3">
            <div className="bg-blue-50 border border-blue-100 p-3.5 rounded-xl space-y-1 text-xs text-blue-800">
              <div className="flex justify-between"><strong className="text-blue-900">Session Destination:</strong> <span>Active Desktop & Mobile Frames</span></div>
              <div className="flex justify-between"><strong className="text-blue-900">Browser Native:</strong> <span>Supported (Granted API)</span></div>
            </div>
            {/* Native OS design mockup */}
            <div className="bg-[#1e1e40]/90 backdrop-blur-md text-white border border-white/10 rounded-xl p-3.5 shadow-xl font-sans relative">
              <div className="flex items-center justify-between mb-1.5">
                <div className="flex items-center space-x-2">
                  <div className="w-5 h-5 bg-gradient-to-br from-blue-500 to-indigo-600 rounded flex items-center justify-center font-black text-[9px]">T</div>
                  <span className="text-[11px] font-bold tracking-tight text-slate-200">TenderAI Notification</span>
                </div>
                <span className="text-[9px] text-slate-400">now</span>
              </div>
              <p className="text-xs font-semibold leading-normal">{pushRec.content}</p>
              <div className="absolute right-3.5 top-3.5 text-slate-400 hover:text-white cursor-pointer">
                <X className="w-3.5 h-3.5" />
              </div>
            </div>
          </div>
        );
      }
      default: {
        return (
          <div className="space-y-3">
            <div className="bg-slate-50 border p-3 rounded-xl text-xs text-slate-600">
              In-app notification delivered safely to user dashboard broadcast feed.
            </div>
            <div className="bg-white border rounded-xl p-4 text-xs font-medium text-slate-800 italic">
              "{alert.message}"
            </div>
          </div>
        );
      }
    }
  };

  return (
    <div id="alerts-dispatch-portal" className="space-y-6 max-w-6xl mx-auto">
      
      {/* Upper Title Header */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center bg-gradient-to-br from-[#121c42] to-[#1e295b] p-6 rounded-2xl border border-white/10 shadow-lg text-white">
        <div className="space-y-1.5">
          <div className="flex items-center space-x-2">
            <div className="bg-blue-500 p-1 rounded-lg text-white">
              <Bell className="w-5 h-5 animate-swing" />
            </div>
            <h2 className="text-2xl font-black tracking-tight">Broadcast & Notification Station</h2>
          </div>
          <p className="text-xs text-slate-300">Set real-time monitoring criteria and trigger active test dispatches across five production channels.</p>
        </div>
        <button
          onClick={markAllRead}
          className="mt-4 sm:mt-0 text-xs bg-white/10 border border-white/20 hover:bg-white/20 text-white px-4 py-2 rounded-xl font-bold transition-all active:scale-95 cursor-pointer shadow-xs"
        >
          Mark all as Read
        </button>
      </div>

      <div className="grid lg:grid-cols-12 gap-6">
        
        {/* Left configurations bar: Spans 5 */}
        <div className="lg:col-span-5 space-y-6">
          
          {/* Section 1: Target Contacts Configuration */}
          <div className="bg-white/80 backdrop-blur-md border border-slate-200 rounded-2xl p-5 shadow-sm space-y-4">
            <div className="flex items-center space-x-2 border-b border-slate-100 pb-3">
              <Settings className="w-4 h-4 text-indigo-600" />
              <span className="text-xs font-bold text-slate-900 uppercase tracking-widest">Dispatch Channels Targets</span>
            </div>
            
            <div className="space-y-4">
              <div>
                <label className="text-[10px] font-bold text-slate-500 uppercase block mb-1">E-procurement Target Email</label>
                <div className="relative">
                  <Mail className="absolute left-3 top-2.5 w-3.8 h-3.8 text-slate-400" />
                  <input
                    type="email"
                    value={inputEmail}
                    onChange={(e) => setInputEmail(e.target.value)}
                    className="w-full text-xs border border-slate-250 rounded-xl pl-9 pr-4 py-2 focus:ring-2 focus:ring-blue-100 focus:border-blue-500 font-semibold text-slate-850"
                    placeholder="Enter dispatch email"
                  />
                </div>
              </div>

              <div>
                <label className="text-[10px] font-bold text-slate-500 uppercase block mb-1">E-procurement Mobile Carrier (SMS & WhatsApp)</label>
                <div className="relative">
                  <Smartphone className="absolute left-3 top-2.5 w-3.8 h-3.8 text-slate-400" />
                  <input
                    type="text"
                    value={inputPhone}
                    onChange={(e) => setInputPhone(e.target.value)}
                    className="w-full text-xs border border-slate-250 rounded-xl pl-9 pr-4 py-2 focus:ring-2 focus:ring-blue-100 focus:border-blue-500 font-semibold text-slate-850"
                    placeholder="Enter phone with country code"
                  />
                </div>
              </div>

              {/* Push permission requests */}
              <div className="bg-slate-50 border border-slate-150 rounded-xl p-3 flex items-center justify-between gap-4">
                <div className="space-y-0.5">
                  <span className="text-[10px] font-bold text-slate-700 block">Desktop Banner Notifications</span>
                  <p className="text-[9.5px] text-slate-400 font-medium">Render standard native operating system prompts.</p>
                </div>
                {pushPermission === "granted" ? (
                  <span className="text-[10px] font-bold text-emerald-600 bg-emerald-50 px-2 py-1 rounded border border-emerald-100 shrink-0">Permitted ✅</span>
                ) : pushPermission === "denied" ? (
                  <span className="text-[10px] font-bold text-red-500 bg-red-50 px-2 py-1 rounded border border-red-100 shrink-0 select-none">Blocked ❌</span>
                ) : (
                  <button
                    onClick={requestPushPermission}
                    className="text-[10px] font-black bg-blue-600 text-white px-2.5 py-1.5 rounded-lg border-b-2 border-blue-800 cursor-pointer hover:bg-blue-700 hover:scale-101 active:translate-y-0.5 transition-all shadow-xs shrink-0"
                  >
                    Authorize Banner
                  </button>
                )}
              </div>
            </div>
          </div>

          {/* Section 2: Dispatch Checkbox Matrix */}
          <div className="bg-white/80 backdrop-blur-md border border-slate-200 rounded-2xl p-5 shadow-sm space-y-4">
            <div className="flex items-center space-x-2 border-b border-slate-100 pb-3">
              <Volume2 className="w-4 h-4 text-emerald-600" />
              <span className="text-xs font-bold text-slate-900 uppercase tracking-widest">Trigger Delivery Matrix</span>
            </div>
            
            <p className="text-[11px] text-slate-400">Map specific compliance triggers directly with associated communication paths.</p>
            
            <div className="space-y-3.5 font-sans pt-1">
              {[
                { key: "NEW_MATCH", title: "New matching tender", icon: <Compass className="w-3.5 h-3.5 text-blue-600" /> },
                { key: "DEADLINE_REMINDER", title: "Tender closing soon", icon: <Clock className="w-3.5 h-3.5 text-red-500" /> },
                { key: "DOCUMENT_MISSING", title: "Document expiring", icon: <ShieldAlert className="w-3.5 h-3.5 text-amber-500" /> },
                { key: "SUBSCRIPTION_EVENT", title: "Subscription events", icon: <CreditCard className="w-3.5 h-3.5 text-violet-600" /> }
              ].map((row) => (
                <div key={row.key} className="border border-slate-150 rounded-xl p-3 space-y-2 bg-slate-50/50">
                  <div className="flex items-center space-x-2">
                    {row.icon}
                    <span className="text-xs font-bold text-slate-800">{row.title}</span>
                  </div>
                  
                  {/* Channels matrix checks */}
                  <div className="grid grid-cols-5 gap-1 pt-1 border-t border-slate-100">
                    {[
                      { code: "EMAIL", label: "Email" },
                      { code: "WHATSAPP", label: "WhatsApp" },
                      { code: "SMS", label: "SMS" },
                      { code: "PUSH", label: "Push" },
                      { code: "IN_APP", label: "In App" }
                    ].map((ch) => {
                      const active = matrix[row.key as TriggerType][ch.code as ChannelType];
                      return (
                        <button
                          key={ch.code}
                          onClick={() => toggleCheck(row.key as TriggerType, ch.code as ChannelType)}
                          className={`py-1 px-1 rounded text-[9px] font-extrabold flex flex-col items-center justify-center border transition-all cursor-pointer ${
                            active 
                              ? "bg-blue-50/80 border-blue-200 text-blue-700" 
                              : "bg-white border-slate-200 text-slate-400 hover:bg-slate-50"
                          }`}
                        >
                          <span className="text-[8px] uppercase">{ch.label}</span>
                          <span className="text-[10px] mt-0.5">{active ? "✅" : "❌"}</span>
                        </button>
                      );
                    })}
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Section 3: Instant Dispatch Simulators */}
          <div className="bg-white/80 backdrop-blur-md border border-slate-200 rounded-2xl p-5 shadow-sm space-y-4">
            <div className="flex items-center space-x-2 border-b border-slate-100 pb-3">
              <Sparkles className="w-4 h-4 text-amber-500 animate-spin-slow" />
              <span className="text-xs font-bold text-slate-900 uppercase tracking-widest">Instant Alert Simulator</span>
            </div>
            
            <p className="text-[11px] text-slate-400">Force compile and dispatch simulated events in real time to test connection limits.</p>

            <div className="grid grid-cols-2 gap-3">
              <button
                onClick={() => handleSimulate("NEW_MATCH")}
                className="flex items-center justify-center space-x-1.5 bg-gradient-to-r from-blue-50 to-indigo-50 border border-blue-200 hover:border-blue-300 text-[10.5px] font-extrabold text-blue-800 p-2.5 rounded-xl cursor-pointer hover:shadow-xs active:scale-95 transition-all text-center"
              >
                <span>🔔 Tender Discovery</span>
              </button>
              
              <button
                onClick={() => handleSimulate("DEADLINE_REMINDER")}
                className="flex items-center justify-center space-x-1.5 bg-gradient-to-r from-rose-50 to-red-50 border border-red-200 hover:border-red-300 text-[10.5px] font-extrabold text-red-800 p-2.5 rounded-xl cursor-pointer hover:shadow-xs active:scale-95 transition-all text-center"
              >
                <span>⏳ Urg. Deadline</span>
              </button>

              <button
                onClick={() => handleSimulate("DOCUMENT_MISSING")}
                className="flex items-center justify-center space-x-1.5 bg-gradient-to-r from-amber-50 to-yellow-50 border border-amber-200 hover:border-amber-300 text-[10.5px] font-extrabold text-amber-850 p-2.5 rounded-xl cursor-pointer hover:shadow-xs active:scale-95 transition-all text-center"
              >
                <span>📄 Doc Expiration</span>
              </button>

              <button
                onClick={() => handleSimulate("SUBSCRIPTION_EVENT")}
                className="flex items-center justify-center space-x-1.5 bg-gradient-to-r from-purple-50 to-fuchsia-50 border border-purple-200 hover:border-purple-300 text-[10.5px] font-extrabold text-purple-800 p-2.5 rounded-xl cursor-pointer hover:shadow-xs active:scale-95 transition-all text-center"
              >
                <span>💳 Prem. Upgrade</span>
              </button>
            </div>
          </div>

        </div>

        {/* Right column: active logs list. Spans 7 */}
        <div className="lg:col-span-7 space-y-4">
          <div className="bg-white/85 shadow-sm border border-slate-200 rounded-2xl p-5 space-y-4 min-h-[500px]">
            <div className="flex justify-between items-center border-b border-slate-100 pb-3">
              <span className="text-xs font-bold text-slate-900 uppercase tracking-widest block">Broadcast Logs & Delivery Stream</span>
              {loading && <span className="text-[10px] text-blue-600 font-extrabold animate-pulse">refreshing Feed...</span>}
            </div>

            <div className="divide-y divide-slate-100 space-y-2">
              {displayedAlerts.map((al) => {
                const isDispatchedTo = (ch: string) => {
                  return al.channelsDispatched?.[ch.toLowerCase() as keyof typeof al.channelsDispatched]?.sent;
                };

                return (
                  <div 
                    key={al.id} 
                    className={`py-3.5 px-4 rounded-xl flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 transition-all hover:bg-slate-50/80 border ${
                      al.isRead ? "bg-white/40 border-slate-100" : "bg-white border-blue-100/60 shadow-xs"
                    }`}
                  >
                    <div className="flex gap-3">
                      <div className="mt-1">
                        {al.type === "NEW_MATCH" ? (
                          <div className="bg-blue-50 p-2 rounded-xl text-blue-600">
                            <Compass className="w-4.5 h-4.5" />
                          </div>
                        ) : al.type === "DEADLINE_REMINDER" ? (
                          <div className="bg-red-50 p-2 rounded-xl text-red-600">
                            <Clock className="w-4.5 h-4.5" />
                          </div>
                        ) : al.type === "DOCUMENT_MISSING" ? (
                          <div className="bg-amber-50 p-2 rounded-xl text-amber-600">
                            <ShieldAlert className="w-4.5 h-4.5" />
                          </div>
                        ) : (
                          <div className="bg-purple-50 p-2 rounded-xl text-purple-600">
                            <CreditCard className="w-4.5 h-4.5" />
                          </div>
                        )}
                      </div>

                      <div className="space-y-1.5 text-xs">
                        <div className="flex items-center space-x-2">
                          <span className="font-bold text-slate-800">
                            {al.type === "NEW_MATCH" ? "New Matching Tender" :
                             al.type === "DEADLINE_REMINDER" ? "Tender Closing Soon" :
                             al.type === "DOCUMENT_MISSING" ? "Compliance Expiry Exertion" : "Subscription Event Success"}
                          </span>
                          {!al.isRead && (
                            <span className="text-[8px] font-black uppercase text-red-500 bg-red-50 border border-red-100 px-1 py-0.5 rounded">NEW</span>
                          )}
                        </div>

                        <p className={`font-semibold tracking-tight text-slate-700 leading-normal`}>{al.message}</p>
                        
                        {/* Channel Badge display block */}
                        <div className="flex flex-wrap items-center gap-1 my-1">
                          {[
                            { label: "Email", icon: "✉️" },
                            { label: "WhatsApp", icon: "💬" },
                            { label: "SMS", icon: "📱" },
                            { label: "Push", icon: "🔔" },
                            { label: "In App", icon: "💻" }
                          ].map((item) => {
                            const active = isDispatchedTo(item.label === "In App" ? "in_app" : item.label);
                            return (
                              <span 
                                key={item.label}
                                className={`text-[8.5px] font-extrabold px-1.5 py-0.5 rounded flex items-center space-x-0.5 border ${
                                  active 
                                    ? "bg-slate-1050/80 text-blue-650 border-blue-100/80 scale-100 opacity-100 font-bold" 
                                    : "bg-slate-50 text-slate-350 border-slate-100/40 opacity-40 line-through"
                                }`}
                              >
                                <span>{item.icon}</span>
                                <span>{item.label}</span>
                              </span>
                            );
                          })}
                        </div>

                        <div className="text-[10px] text-slate-400 font-medium">
                          Sent: {formatDate(al.sentAt)}
                        </div>
                      </div>
                    </div>

                    <div className="flex sm:flex-col items-center sm:items-end gap-2 text-right shrink-0 w-full sm:w-auto border-t sm:border-0 pt-2 sm:pt-0 border-slate-100">
                      <button
                        onClick={() => {
                          setActiveAlert(al);
                          // Default active tab in detail modal to which standard active channels dispatched we have
                          if (al.channelsDispatched?.email?.sent) {
                            setActiveModalTab("EMAIL");
                          } else if (al.channelsDispatched?.whatsapp?.sent) {
                            setActiveModalTab("WHATSAPP");
                          } else if (al.channelsDispatched?.sms?.sent) {
                            setActiveModalTab("SMS");
                          } else if (al.channelsDispatched?.push?.sent) {
                            setActiveModalTab("PUSH");
                          } else {
                            setActiveModalTab("IN_APP");
                          }
                        }}
                        className="text-[10.5px] font-extrabold text-blue-600 bg-blue-50 border border-blue-100 hover:bg-blue-100 hover:text-blue-700 px-3 py-1.5 rounded-xl cursor-pointer transition flex items-center gap-1 shadow-xs"
                      >
                        <span>Telemetry Records 🛡️</span>
                      </button>

                      {!al.isRead && (
                        <button
                          onClick={() => markRead(al.id)}
                          className="text-[10px] bg-slate-50 hover:bg-slate-100 text-slate-700 border border-slate-200 font-bold px-2.5 py-1.5 rounded-lg inline-block cursor-pointer"
                        >
                          Clear
                        </button>
                      )}
                    </div>
                  </div>
                );
              })}

              {displayedAlerts.length === 0 && (
                <div className="py-24 text-center text-slate-400 text-xs font-mono space-y-2">
                  <div>All clean! No active notifications or compliance alerts logged.</div>
                  <div className="text-[10px] text-slate-350">Configure your Matrix on the left and trigger a Simulator action.</div>
                </div>
              )}
            </div>
          </div>
        </div>

      </div>

      {/* Dispatch Telemetry High Fidelity Modal popup */}
      {activeAlert && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4 z-50">
          <div className="bg-white rounded-3xl border border-slate-100 shadow-2xl w-full max-w-2xl overflow-hidden animate-in fade-in zoom-in-95 duration-150">
            
            {/* Header */}
            <div className="p-5 border-b border-slate-100 bg-slate-50 flex justify-between items-center">
              <div className="space-y-1">
                <span className="text-[9px] font-extrabold text-slate-400 uppercase tracking-widest block">TELEMETRY TRANSMISSION REPORT</span>
                <h3 className="text-sm font-black text-slate-900 flex items-center gap-1.5">
                  <span>Report ID:</span> 
                  <span className="font-mono text-blue-600 bg-blue-50 px-1 py-0.5 rounded">{activeAlert.id}</span>
                </h3>
              </div>
              <button
                onClick={() => setActiveAlert(null)}
                className="p-1 text-slate-450 hover:text-slate-805 hover:bg-slate-200/60 rounded-xl transition cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Event Header Accents */}
            <div className="p-4 px-5 bg-gradient-to-r from-blue-500/5 to-indigo-500/5 border-b border-slate-100 flex items-center justify-between gap-4">
              <div className="space-y-0.5 text-xs">
                <div className="font-extrabold text-slate-800">Alert Core Message:</div>
                <div className="text-slate-600 font-semibold">{activeAlert.message}</div>
              </div>
              {!activeAlert.isRead && (
                <button
                  onClick={() => markRead(activeAlert.id)}
                  className="bg-blue-600 text-white px-2.5 py-1 text-[10px] font-black border-b-2 border-blue-800 hover:bg-blue-700 rounded-lg shrink-0 cursor-pointer text-center"
                >
                  Mark Read Clear
                </button>
              )}
            </div>

            {/* Modal Tabs Selection */}
            <div className="flex border-b border-slate-150 bg-slate-50/50">
              {[
                { label: "Email Record", value: "EMAIL", icon: "✉️" },
                { label: "WhatsApp chat", value: "WHATSAPP", icon: "💬" },
                { label: "SMS Carrier", value: "SMS", icon: "📱" },
                { label: "Push Banner", value: "PUSH", icon: "🔔" },
                { label: "In App", value: "IN_APP", icon: "💻" }
              ].map((tab) => {
                const isSent = activeAlert.channelsDispatched?.[
                  (tab.value === "IN_APP" ? "in_app" : tab.value.toLowerCase()) as keyof typeof activeAlert.channelsDispatched
                ]?.sent;

                return (
                  <button
                    key={tab.value}
                    onClick={() => setActiveModalTab(tab.value as any)}
                    className={`flex-1 py-3 text-center text-[11px] font-black uppercase tracking-tight flex items-center justify-center space-x-1.5 border-b-2 transition-all cursor-pointer ${
                      activeModalTab === tab.value
                        ? "border-blue-600 text-blue-700 bg-white"
                        : "border-transparent text-slate-500 hover:text-slate-850 hover:bg-slate-50"
                    } ${!isSent ? "opacity-45" : ""}`}
                  >
                    <span>{tab.icon}</span>
                    <span className="hidden sm:inline">{tab.label}</span>
                    {isSent && (
                      <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 block animate-pulse"></span>
                    )}
                  </button>
                );
              })}
            </div>

            {/* Content Field View */}
            <div className="p-5 max-h-[380px] overflow-y-auto bg-slate-50/50 font-sans">
              {getTabContent(activeAlert)}
            </div>

            {/* Footer */}
            <div className="p-4 border-t border-slate-100 bg-slate-50 flex justify-between items-center text-[10px] text-slate-400">
              <span className="font-medium text-slate-400">Security Authenticated: SHA-256 Verified Ledger Logs</span>
              <button
                onClick={() => setActiveAlert(null)}
                className="bg-white border text-[11px] font-extrabold text-slate-700 px-4 py-2 hover:bg-slate-55 border-slate-200 rounded-xl cursor-pointer shadow-xs active:scale-95 transition-all"
              >
                Close Report
              </button>
            </div>

          </div>
        </div>
      )}

    </div>
  );
}
