import React, { useState, useEffect } from "react";
import { 
  MessageSquare, Plus, HelpCircle, Send, CheckCircle2, 
  AlertTriangle, Clock, RefreshCw, ChevronRight, X, User
} from "lucide-react";

interface SupportTicketsViewProps {
  user: any;
  onToast: (msg: string, type?: "NEW_MATCH" | "DEADLINE_REMINDER" | "STATUS_CHANGE" | "DOCUMENT_MISSING" | "SUBSCRIPTION_EVENT") => void;
}

export default function SupportTicketsView({ user, onToast }: SupportTicketsViewProps) {
  const [tickets, setTickets] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);
  const [selectedTicket, setSelectedTicket] = useState<any | null>(null);
  const [replyText, setReplyText] = useState("");
  const [isOpeningForm, setIsOpeningForm] = useState(false);
  
  // Submit Ticket fields
  const [subject, setSubject] = useState("");
  const [message, setMessage] = useState("");
  const [category, setCategory] = useState("TECHNICAL");
  const [priority, setPriority] = useState("MEDIUM");

  useEffect(() => {
    fetchTickets();
  }, []);

  const fetchTickets = async () => {
    setLoading(true);
    try {
      const res = await fetch("/api/support-tickets");
      if (res.ok) {
        const data = await res.json();
        setTickets(data);
        // If there was a selected ticket, synchronize its content
        if (selectedTicket) {
          const fresh = data.find((t: any) => t.id === selectedTicket.id);
          if (fresh) setSelectedTicket(fresh);
        }
      }
    } catch (e) {
      console.error("Failed to load tickets:", e);
    } finally {
      setLoading(false);
    }
  };

  const handleCreateTicket = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!subject.trim() || !message.trim()) return;

    try {
      const res = await fetch("/api/support-tickets", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ subject, message, category, priority })
      });
      if (res.ok) {
        onToast("Support ticket raised successfully!", "STATUS_CHANGE");
        setSubject("");
        setMessage("");
        setCategory("TECHNICAL");
        setPriority("MEDIUM");
        setIsOpeningForm(false);
        fetchTickets();
      } else {
        onToast("Failed to post help ticket", "DEADLINE_REMINDER");
      }
    } catch (err) {
      onToast("Network connection error", "DEADLINE_REMINDER");
    }
  };

  const handlePostReply = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!replyText.trim() || !selectedTicket) return;

    try {
      const res = await fetch(`/api/support-tickets/${selectedTicket.id}/reply`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ message: replyText })
      });
      if (res.ok) {
        const payload = await res.json();
        setSelectedTicket(payload.ticket);
        setReplyText("");
        onToast("Reply delivered successfully", "STATUS_CHANGE");
        fetchTickets();
      }
    } catch (err) {
      onToast("Could not send reply", "DEADLINE_REMINDER");
    }
  };

  const getPriorityColor = (priority: string) => {
    switch (priority) {
      case "CRITICAL": return "bg-rose-50 text-rose-850 border-rose-200";
      case "HIGH": return "bg-orange-50 text-orange-850 border-orange-200";
      case "MEDIUM": return "bg-amber-50 text-amber-800 border-amber-200";
      default: return "bg-slate-50 text-slate-705 border-slate-200";
    }
  };

  return (
    <div className="bg-white rounded-3xl border border-slate-200 shadow-xs overflow-hidden max-w-5xl mx-auto font-sans">
      <div className="p-6 md:p-8">
        
        {/* Helpdesk Introductory panel */}
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between border-b border-slate-150 pb-6 mb-6 gap-4">
          <div>
            <h1 className="text-2xl font-black text-slate-900 tracking-tight flex items-center gap-2">
              <MessageSquare className="w-6 h-6 text-blue-620" />
              Corporate Helpdesk & SLA Support
            </h1>
            <p className="text-xs text-slate-500 mt-1">
              Ask about e-tender EMD queries, compliance filings, automated matching guidelines or billing declines.
            </p>
          </div>
          <button
            onClick={() => setIsOpeningForm(true)}
            className="px-4.5 py-2.2 bg-blue-600 hover:bg-blue-700 text-white rounded-xl font-bold text-sm shadow-xs transition-colors flex items-center shrink-0 cursor-pointer"
          >
            <Plus className="w-4.5 h-4.5 mr-1.5" />
            Raise Support Request
          </button>
        </div>

        {loading && tickets.length === 0 ? (
          <div className="p-12 text-center text-slate-500 flex justify-center items-center gap-2">
            <RefreshCw className="w-5 h-5 animate-spin text-blue-600" />
            <span className="font-semibold text-sm">Parsing feedback logs...</span>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-12 gap-8">
            
            {/* Tickets Left column */}
            <div className="md:col-span-5 space-y-3 max-h-[520px] overflow-y-auto pr-1">
              <h3 className="text-xs font-black text-slate-400 uppercase tracking-widest mb-3.5">My raised requests ({tickets.length})</h3>
              
              {tickets.length === 0 ? (
                <div className="p-8 text-center text-slate-400 bg-slate-50 border border-dashed border-slate-200 rounded-2xl">
                  <HelpCircle className="w-8 h-8 text-slate-300 mx-auto mb-2" />
                  <p className="font-bold text-sm text-slate-700">No Active Support Tickets</p>
                  <p className="text-xs mt-1 text-slate-455">Need assistance with SBD drafts or billing? Raise a request above.</p>
                </div>
              ) : (
                tickets.map((t) => (
                  <div
                    key={t.id}
                    onClick={() => {
                      setSelectedTicket(t);
                      setReplyText("");
                    }}
                    className={`p-4 rounded-2xl border cursor-pointer transition-all ${
                      selectedTicket?.id === t.id
                        ? "bg-blue-50/70 border-blue-400 hover:bg-blue-50/90"
                        : "bg-white border-slate-200 hover:bg-slate-50/40"
                    }`}
                  >
                    <div className="flex justify-between items-start gap-2">
                      <span className="text-[10.5px] font-mono text-slate-450 font-bold">Ref: {t.id}</span>
                      <span className={`text-[9.5px] font-black uppercase px-2 py-0.5 rounded border ${
                        t.status === "RESOLVED" ? "bg-emerald-50 text-emerald-800 border-emerald-100" :
                        t.status === "IN_PROGRESS" ? "bg-blue-50 text-blue-800 border-blue-100" :
                        "bg-red-50 text-red-800 border-red-105"
                      }`}>
                        {t.status}
                      </span>
                    </div>

                    <h4 className="font-bold text-slate-850 mt-2 line-clamp-1">{t.subject}</h4>
                    <p className="text-[12.5px] text-slate-500 line-clamp-2 mt-1">{t.message}</p>

                    <div className="flex justify-between items-center mt-3 pt-3 border-t border-slate-100 text-[10px] text-slate-450 uppercase font-black">
                      <span>{t.category}</span>
                      <span className={`px-2 py-0.5 rounded border ${getPriorityColor(t.priority)}`}>
                        {t.priority}
                      </span>
                    </div>
                  </div>
                ))
              )}
            </div>

            {/* Ticket discussion details Right Column */}
            <div className="md:col-span-7 bg-slate-50 rounded-2xl p-5 border border-slate-200 flex flex-col justify-between min-h-[440px] max-h-[560px]">
              {selectedTicket ? (
                <div className="flex flex-col h-full justify-between">
                  
                  {/* Selected header info */}
                  <div className="border-b border-slate-200 pb-3 mb-4 flex justify-between items-start gap-4">
                    <div>
                      <div className="text-[11px] font-black text-blue-700 uppercase tracking-wider">[{selectedTicket.category}] SUPPORT TICKET</div>
                      <h3 className="font-black text-slate-850 text-sm mt-1">{selectedTicket.subject}</h3>
                      <p className="text-[11px] text-slate-400 font-medium mt-1">Ticket placed: {new Date(selectedTicket.createdAt).toLocaleDateString()}</p>
                    </div>
                    <span className={`text-xs px-2.5 py-0.5 rounded-full font-bold uppercase tracking-wider ${
                      selectedTicket.status === "RESOLVED" ? "bg-emerald-100 text-emerald-800" : "bg-red-100 text-red-800"
                    }`}>
                      {selectedTicket.status}
                    </span>
                  </div>

                  {/* Replies list bubble container */}
                  <div className="flex-1 space-y-3.5 overflow-y-auto mb-4 pr-1 text-xs">
                    
                    {/* Parent ticket content detail */}
                    <div className="bg-white p-4 rounded-2xl border border-slate-200 text-slate-800">
                      <div className="flex items-center space-x-1.5 text-xs text-blue-700 font-bold mb-1.5 uppercase">
                        <User className="w-3.5 h-3.5" />
                        <span>Submitted query description</span>
                      </div>
                      <p className="text-[12.5px] text-slate-700 font-medium leading-relaxed">{selectedTicket.message}</p>
                    </div>

                    {/* Replies thread messages */}
                    {selectedTicket.replies?.slice(1).map((rep: any, idx: number) => (
                      <div 
                        key={idx} 
                        className={`flex flex-col max-w-[85%] ${
                          rep.sender === "ADMIN" ? "mr-auto items-start" : "ml-auto items-end"
                        }`}
                      >
                        <div className={`p-3 rounded-2xl leading-relaxed text-[12.5px] font-medium ${
                          rep.sender === "ADMIN" 
                            ? "bg-slate-200 border border-slate-300 text-slate-800 rounded-tl-none" 
                            : "bg-blue-600 text-white rounded-tr-none"
                        }`}>
                          {rep.message}
                        </div>
                        <span className="text-[9.5px] text-slate-400 font-semibold mt-1">
                          {rep.sender === "ADMIN" ? "Support Executive Response" : "You"} • {new Date(rep.timestamp).toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'})}
                        </span>
                      </div>
                    ))}
                  </div>

                  {/* Posting Reply Form */}
                  <form onSubmit={handlePostReply} className="flex gap-2">
                    <input
                      type="text"
                      value={replyText}
                      onChange={(e) => setReplyText(e.target.value)}
                      disabled={selectedTicket.status === "RESOLVED"}
                      placeholder={selectedTicket.status === "RESOLVED" ? "Ticket resolved. Raise a new query if you have further questions." : "Type reply message to Help Desk..."}
                      className="flex-1 px-4 py-2 bg-white border border-slate-350 rounded-xl text-sm focus:outline-hidden focus:border-blue-500 disabled:opacity-60"
                    />
                    <button
                      type="submit"
                      disabled={selectedTicket.status === "RESOLVED"}
                      className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white font-extrabold rounded-xl text-sm transition-colors flex items-center justify-center shrink-0 cursor-pointer disabled:opacity-50"
                    >
                      <Send className="w-3.5 h-3.5" />
                    </button>
                  </form>

                </div>
              ) : (
                <div className="flex flex-col items-center justify-center h-full text-slate-400 text-center py-10 space-y-2">
                  <HelpCircle className="w-10 h-10 text-slate-300 animate-pulse" />
                  <p className="font-bold text-sm text-slate-700">No active Ticket Selected</p>
                  <p className="text-xs max-w-xs">Select a corporate help ticket from the panel list on the left to read messages and post replies.</p>
                </div>
              )}
            </div>

          </div>
        )}

      </div>

      {/* RAISING TICKET FORM MODAL OVERLAY */}
      {isOpeningForm && (
        <div className="fixed inset-0 bg-slate-900/40 backdrop-blur-xs flex items-center justify-center z-[1100]">
          <div className="bg-white rounded-3xl border border-slate-200 p-6 max-w-md w-full mx-4 shadow-2xl relative">
            <button 
              onClick={() => setIsOpeningForm(false)}
              className="absolute top-4 right-4 text-slate-400 hover:text-slate-600 cursor-pointer"
            >
              <X className="w-5 h-5" />
            </button>

            <h3 className="text-lg font-black text-slate-900 mb-1 flex items-center gap-1.5">
              Raise Help Desk Request
            </h3>
            <p className="text-xs text-slate-500 mb-5 font-semibold">Our operational SLA team responds to priorities in under 2 hours.</p>

            <form onSubmit={handleCreateTicket} className="space-y-4 text-xs font-semibold text-slate-605">
              <div>
                <label className="block mb-1 font-bold text-slate-700">Subject Description</label>
                <input
                  type="text"
                  required
                  value={subject}
                  onChange={(e) => setSubject(e.target.value)}
                  placeholder="e.g. Failed transaction error code RZP-300"
                  className="w-full px-3 py-2 bg-slate-50 border border-slate-350 rounded-xl text-sm font-semibold text-slate-800"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block mb-1 font-bold text-slate-700">Help Category</label>
                  <select
                    value={category}
                    onChange={(e) => setCategory(e.target.value)}
                    className="w-full px-3 py-2 bg-slate-50 border border-slate-350 rounded-xl text-sm font-semibold"
                  >
                    <option value="BILLING">BILLING & WEBHOOKS</option>
                    <option value="COMPLIANCE">COMPLIANCE FILING</option>
                    <option value="TECHNICAL">TECHNICAL / CRASH</option>
                    <option value="OTHER">GENERAL ENQUIRY</option>
                  </select>
                </div>

                <div>
                  <label className="block mb-1 font-bold text-slate-700">Priority Level</label>
                  <select
                    value={priority}
                    onChange={(e) => setPriority(e.target.value)}
                    className="w-full px-3 py-2 bg-slate-50 border border-slate-350 rounded-xl text-sm font-semibold"
                  >
                    <option value="LOW">LOW</option>
                    <option value="MEDIUM">MEDIUM</option>
                    <option value="HIGH">HIGH</option>
                    <option value="CRITICAL">CRITICAL (SLA)</option>
                  </select>
                </div>
              </div>

              <div>
                <label className="block mb-1 font-bold text-slate-700">Detail your query</label>
                <textarea
                  required
                  value={message}
                  onChange={(e) => setMessage(e.target.value)}
                  placeholder="Describe your error message, tender reference ID, or payment difficulties..."
                  rows={4}
                  className="w-full px-3 py-2 bg-slate-50 border border-slate-350 rounded-xl text-sm font-medium text-slate-800"
                />
              </div>

              <button
                type="submit"
                className="w-full py-2.5 bg-blue-600 hover:bg-blue-700 text-white rounded-xl text-sm font-black transition-colors cursor-pointer mt-2"
              >
                Dispatch Ticket to SLA Team
              </button>
            </form>
          </div>
        </div>
      )}

    </div>
  );
}
