import React, { useState } from "react";
import { Sparkles, FileText, CheckCircle2, ChevronRight, Copy, Check, Download, Layers, ShieldAlert, ArchiveRestore } from "lucide-react";
import { motion, AnimatePresence } from "motion/react";
import { Tender, CompanyProfile } from "../types.js";
import { getAuthHeaders } from "../utils.js";

interface SmartBidDraftProps {
  tender: Tender;
  profile: CompanyProfile;
  onRefreshBids?: () => void;
}

export default function SmartBidDraft({ tender, profile, onRefreshBids }: SmartBidDraftProps) {
  const [tone, setTone] = useState<string>("Formal & Administrative");
  const [projectFocus, setProjectFocus] = useState<string>("");
  const [includeMSME, setIncludeMSME] = useState<boolean>(true);
  
  const [loading, setLoading] = useState<boolean>(false);
  const [stepMsg, setStepMsg] = useState<string>("");
  const [copiedText, setCopiedText] = useState<string | null>(null);
  
  // Results
  const [draft, setDraft] = useState<{ coverLetter: string; proposalOutline: string } | null>(null);
  const [activeResultTab, setActiveResultTab] = useState<"cover" | "outline">("cover");
  const [saveStatus, setSaveStatus] = useState<{ [key: string]: "idle" | "saving" | "success" | "error" }>({
    cover: "idle",
    outline: "idle"
  });

  const triggerDraftGeneration = async () => {
    setLoading(true);
    setDraft(null);

    const steps = [
      "Establishing connection to Gemini AI Engine...",
      "Cross-referencing company credentials with tender ID...",
      "Structuring professional cover letter...",
      "Configuring detailed technical proposal outline...",
      "Polishing structural milestones based on CPWD criteria..."
    ];

    let currentStep = 0;
    setStepMsg(steps[0]);
    
    const interval = setInterval(() => {
      currentStep++;
      if (currentStep < steps.length) {
        setStepMsg(steps[currentStep]);
      }
    }, 750);

    try {
      const res = await fetch(`/api/bids/${tender.id}/smart-draft`, {
        method: "POST",
        headers: getAuthHeaders({ "Content-Type": "application/json" }),
        body: JSON.stringify({
          tone,
          projectFocus,
          includeMSMEAcknowledgment: includeMSME
        })
      });

      if (!res.ok) {
        throw new Error("Draft server error");
      }

      const data = await res.json();
      setDraft(data);
    } catch (err) {
      console.error("Draft generation failed:", err);
    } finally {
      clearInterval(interval);
      setLoading(false);
    }
  };

  const handleCopyToClipboard = (text: string, type: string) => {
    navigator.clipboard.writeText(text);
    setCopiedText(type);
    setTimeout(() => setCopiedText(null), 2000);
  };

  const handleDownloadDraft = (text: string, filename: string) => {
    const blob = new Blob([text], { type: "text/plain;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = filename;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  };

  // Publishes this draft document as an active document inside the standard workspace list!
  const publishToWorkspace = async (docType: "cover" | "outline") => {
    if (!draft) return;
    
    setSaveStatus(prev => ({ ...prev, [docType]: "saving" }));
    const actualType = docType === "cover" ? "COVER_LETTER" : "TECHNICAL_PROPOSAL";
    const content = docType === "cover" ? draft.coverLetter : draft.proposalOutline;

    try {
      const res = await fetch(`/api/bids/${tender.id}/generate`, {
        method: "POST",
        headers: getAuthHeaders({ "Content-Type": "application/json" }),
        body: JSON.stringify({
          type: actualType,
          customContent: content
        })
      });

      if (res.ok) {
        setSaveStatus(prev => ({ ...prev, [docType]: "success" }));
        onRefreshBids?.();
        setTimeout(() => {
          setSaveStatus(prev => ({ ...prev, [docType]: "idle" }));
        }, 3600);
      } else {
        throw new Error("Save error");
      }
    } catch (err) {
      console.error("Publishing bid document failed:", err);
      setSaveStatus(prev => ({ ...prev, [docType]: "error" }));
    }
  };

  return (
    <div id="smart-bid-draft-card" className="bg-white border border-slate-200 rounded-xl overflow-hidden shadow-sm">
      {/* Primary Header */}
      <div className="bg-gradient-to-r from-blue-700 to-indigo-805 text-white px-6 py-4 flex flex-col sm:flex-row justify-between items-start sm:items-center gap-3">
        <div className="flex items-center space-x-2">
          <Sparkles className="w-5 h-5 text-amber-400 animate-pulse" />
          <div>
            <h4 className="text-sm font-bold tracking-tight uppercase">Smart Bid Draft Assistant</h4>
            <p className="text-[11px] text-slate-200 font-normal">
              Generate structured, government-ready cover letters & technical bid outlines instantly
            </p>
          </div>
        </div>
      </div>

      <div className="p-6 grid lg:grid-cols-5 gap-6">
        {/* Left Side: Parameters / Settings */}
        <div className="lg:col-span-2 space-y-5 border-r border-slate-100 pr-0 lg:pr-6">
          <div className="space-y-1.5">
            <span className="text-xs font-bold text-slate-800 uppercase tracking-wide">1. Select Tone of Voice</span>
            <p className="text-[11px] text-slate-400">Determines vocabulary complexity & statutory style.</p>
            <select
              value={tone}
              onChange={(e) => setTone(e.target.value)}
              className="w-full border border-slate-250 rounded-lg py-2 px-3 text-xs bg-white text-slate-700 focus:outline-none focus:ring-1 focus:ring-blue-500 font-medium"
            >
              <option>Formal & Administrative</option>
              <option>Competitive & Professional</option>
              <option>Direct & Strategic</option>
            </select>
          </div>

          <div className="space-y-1.5">
            <span className="text-xs font-bold text-slate-800 uppercase tracking-wide">2. Highlight Portfolio Project</span>
            <p className="text-[11px] text-slate-400">Select a project from your active profile to showcase.</p>
            <select
              value={projectFocus}
              onChange={(e) => setProjectFocus(e.target.value)}
              className="w-full border border-slate-250 rounded-lg py-2 px-3 text-xs bg-white text-slate-700 focus:outline-none focus:ring-1 focus:ring-blue-500 font-medium"
            >
              <option value="">-- No Specific Emphasis (Use General profile) --</option>
              {profile.pastProjects?.map((proj, idx) => (
                <option key={idx} value={proj.name}>
                  {proj.name} ({proj.client} • ₹{proj.value} Cr)
                </option>
              ))}
            </select>
          </div>

          {profile.msmeRegistered && (
            <div className="bg-slate-50 border border-slate-150 rounded-lg p-3.5 space-y-3">
              <div className="flex items-center justify-between">
                <div className="flex items-center space-x-2">
                  <span className="text-xs font-bold text-slate-800 uppercase">MSME Waiver Option</span>
                  <span className="bg-emerald-100 text-emerald-800 text-[8px] font-black px-1.5 py-0.5 rounded-full">ACTIVE</span>
                </div>
                <input
                  type="checkbox"
                  checked={includeMSME}
                  onChange={(e) => setIncludeMSME(e.target.checked)}
                  className="w-4.5 h-4.5 text-blue-600 border-slate-300 rounded focus:ring-blue-500 cursor-pointer"
                />
              </div>
              <p className="text-[10px] text-slate-500 leading-normal">
                If checked, Gemini will automatically append CPWD/UDYAM directives explicitly requesting the standard exemption on Earnest Money Deposit (EMD) and tender fees.
              </p>
            </div>
          )}

          <button
            onClick={triggerDraftGeneration}
            disabled={loading}
            className="w-full bg-blue-600 hover:bg-blue-700 text-white font-bold text-xs py-2.5 rounded-lg shadow-md transition-all active:scale-[0.98] disabled:opacity-55 cursor-pointer uppercase tracking-wider flex items-center justify-center space-x-2"
          >
            <Sparkles className="w-3.5 h-3.5" />
            <span>{loading ? "Generating Draft..." : "Generate Smart Draft"}</span>
          </button>
        </div>

        {/* Right Side: Response Workspace representation */}
        <div className="lg:col-span-3 min-h-[360px] flex flex-col justify-between bg-slate-50 border border-slate-150 rounded-xl p-4.5 relative overflow-hidden">
          <AnimatePresence mode="wait">
            {loading ? (
              <motion.div
                key="loading"
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                className="absolute inset-0 bg-slate-50/95 flex flex-col items-center justify-center text-center p-8 z-10 space-y-4"
              >
                <div className="relative">
                  <div className="w-12 h-12 rounded-full border-4 border-slate-200 border-t-blue-600 animate-spin"></div>
                  <FileText className="w-5 h-5 text-blue-500 absolute top-3.5 left-3.5 animate-bounce" />
                </div>
                <div className="space-y-1.5">
                  <h5 className="text-xs font-bold text-slate-750 uppercase">Synthesizing Proposal Proposal Parameters</h5>
                  <p className="text-xs text-slate-500 font-mono italic max-w-sm mx-auto">{stepMsg}</p>
                </div>
              </motion.div>
            ) : null}
          </AnimatePresence>

          {draft ? (
            <div className="space-y-4 flex flex-col h-full justify-between">
              {/* Draft Section Switcher Tabs */}
              <div className="flex justify-between items-center bg-white p-1 rounded-lg border border-slate-200">
                <div className="flex space-x-1">
                  <button
                    onClick={() => setActiveResultTab("cover")}
                    className={`text-xs font-bold px-3 py-1.5 rounded-md cursor-pointer transition ${
                      activeResultTab === "cover" ? "bg-slate-900 text-white" : "text-slate-500 hover:text-slate-800"
                    }`}
                  >
                    Structured Cover Letter
                  </button>
                  <button
                    onClick={() => setActiveResultTab("outline")}
                    className={`text-xs font-bold px-3 py-1.5 rounded-md cursor-pointer transition ${
                      activeResultTab === "outline" ? "bg-slate-900 text-white" : "text-slate-500 hover:text-slate-800"
                    }`}
                  >
                    Technical Proposal Outline
                  </button>
                </div>

                <div className="flex items-center space-x-2">
                  <button
                    onClick={() => {
                      const text = activeResultTab === "cover" ? draft.coverLetter : draft.proposalOutline;
                      handleCopyToClipboard(text, activeResultTab);
                    }}
                    className="p-1.5 border border-slate-200 hover:bg-slate-50 rounded-lg text-slate-500 cursor-pointer text-xs flex items-center space-x-1"
                    title="Copy to Clipboard"
                  >
                    {copiedText === activeResultTab ? (
                      <>
                        <Check className="w-3.5 h-3.5 text-green-600" />
                        <span className="text-[10px] text-green-700 font-bold">Copied!</span>
                      </>
                    ) : (
                      <>
                        <Copy className="w-3.5 h-3.5" />
                      </>
                    )}
                  </button>
                  <button
                    onClick={() => {
                      const text = activeResultTab === "cover" ? draft.coverLetter : draft.proposalOutline;
                      const name = activeResultTab === "cover" ? "Smart_Cover_Letter.txt" : "Technical_Proposal_Outline.txt";
                      handleDownloadDraft(text, name);
                    }}
                    className="p-1.5 border border-slate-200 hover:bg-slate-50 rounded-lg text-slate-500 cursor-pointer"
                    title="Download Text File"
                  >
                    <Download className="w-3.5 h-3.5" />
                  </button>
                </div>
              </div>

              {/* Draft Render Textbox (Read only) */}
              <div className="flex-1 bg-white border border-slate-200 rounded-xl p-4 overflow-y-auto max-h-[320px] text-xs font-mono whitespace-pre-wrap leading-relaxed text-slate-700 shadow-inner">
                {activeResultTab === "cover" ? draft.coverLetter : draft.proposalOutline}
              </div>

              {/* Direct Save Option */}
              <div className="bg-indigo-50/50 border border-indigo-100 rounded-lg p-3 flex flex-col sm:flex-row justify-between items-start sm:items-center gap-3">
                <div className="space-y-0.5">
                  <span className="text-[10px] font-bold text-indigo-800 uppercase block">Synchronized Workspace</span>
                  <p className="text-[10px] text-slate-500">Inject this AI proposal directly into your active Workspace editor.</p>
                </div>
                <button
                  onClick={() => publishToWorkspace(activeResultTab)}
                  disabled={saveStatus[activeResultTab] === "saving"}
                  className="bg-indigo-600 hover:bg-indigo-700 text-white font-bold text-[10px] px-3.5 py-2 rounded-lg cursor-pointer transition active:scale-95 disabled:opacity-40 uppercase"
                >
                  {saveStatus[activeResultTab] === "saving" ? (
                    "Syncing..."
                  ) : saveStatus[activeResultTab] === "success" ? (
                    <span className="flex items-center gap-1 text-white">
                      <Check className="w-3 h-3" /> Published to Workspace!
                    </span>
                  ) : (
                    "Apply to Workspace"
                  )}
                </button>
              </div>
            </div>
          ) : (
            <div className="flex-1 flex flex-col items-center justify-center text-center p-8 space-y-3.5">
              <FileText className="w-12 h-12 text-slate-300" />
              <div className="max-w-xs space-y-1">
                <span className="text-[11px] font-bold text-slate-400 uppercase tracking-wider block">No Draft Generated</span>
                <p className="text-[11px] text-slate-400">
                  Configure the tone and client parameters on the left, then click <strong>"Generate Smart Draft"</strong> to invoke Gemini intelligence.
                </p>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
