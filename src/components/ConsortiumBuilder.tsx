import React, { useState, useEffect } from "react";
import { Users, CheckCircle2, ChevronRight, AlertTriangle, FileSignature, Sparkles, RefreshCw, Copy, Check, Printer, FileDown } from "lucide-react";
import { Tender, CompanyProfile } from "../types.js";
import { formatIndianCurrency, getAuthHeaders } from "../utils.js";

interface ConsortiumBuilderProps {
  tender: Tender;
  profile: CompanyProfile;
}

export default function ConsortiumBuilder({ tender, profile }: ConsortiumBuilderProps) {
  const [partners, setPartners] = useState<CompanyProfile[]>([]);
  const [selectedPartnerId, setSelectedPartnerId] = useState<string>("");
  const [responsibilities, setResponsibilities] = useState<string>("");
  const [loading, setLoading] = useState<boolean>(false);
  const [draftedAgreement, setDraftedAgreement] = useState<string>("");
  const [copied, setCopied] = useState<boolean>(false);

  // Load complementary joint venture partners
  useEffect(() => {
    async function loadPartners() {
      try {
        const res = await fetch("/api/partners", {
          headers: getAuthHeaders()
        });
        if (res.ok) {
          const data = await res.json();
          setPartners(Array.isArray(data) ? data : []);
          
          // Preselect first partner
          if (Array.isArray(data) && data.length > 0) {
            setSelectedPartnerId(data[0].id);
          }
        }
      } catch (err) {
        console.error("Failed to load joint venture candidate partners:", err);
      }
    }
    loadPartners();
  }, []);

  const selectedPartner = partners.find(p => p.id === selectedPartnerId);

  // Recalculate combined stats
  const preTurnover = profile.annualTurnover || 0;
  const partnerTurnover = selectedPartner ? selectedPartner.annualTurnover : 0;
  const combinedTurnover = preTurnover + partnerTurnover;

  const preExperience = profile.yearsOfExperience || 0;
  const partnerExperience = selectedPartner ? selectedPartner.yearsOfExperience : 0;
  const combinedExperience = Math.max(preExperience, partnerExperience);

  const reqTurnover = tender.eligibilityCriteria.minTurnover || 0;
  const reqExperience = tender.eligibilityCriteria.minExperience || 0;

  const preTurnoverCompliant = preTurnover >= reqTurnover;
  const combinedTurnoverCompliant = combinedTurnover >= reqTurnover;

  const preExperienceCompliant = preExperience >= reqExperience;
  const combinedExperienceCompliant = combinedExperience >= reqExperience;

  const handleCopy = () => {
    navigator.clipboard.writeText(draftedAgreement);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const handleDraftAgreement = async () => {
    if (!selectedPartnerId) return;
    setLoading(true);
    try {
      const res = await fetch("/api/consortium/draft-agreement", {
        method: "POST",
        headers: getAuthHeaders({ "Content-Type": "application/json" }),
        body: JSON.stringify({
          tenderId: tender.id,
          partnerProfileId: selectedPartnerId,
          responsibilities: responsibilities || undefined
        })
      });
      if (res.ok) {
        const data = await res.json();
        setDraftedAgreement(data.agreementText || "");
      } else {
        const errorData = await res.json();
        console.error("Failed to draft agreement:", errorData);
      }
    } catch (err) {
      console.error("Consortium drafting error:", err);
    } finally {
      setLoading(false);
    }
  };

  const handlePrint = () => {
    const printWindow = window.open("", "_blank");
    if (printWindow) {
      printWindow.document.write(`
        <html>
          <head>
            <title>Joint Venture Consortium agreement Draft</title>
            <style>
              body { font-family: system-ui, sans-serif; padding: 2.5cm; line-height: 1.6; color: #111; }
              pre { white-space: pre-wrap; font-family: inherit; font-size: 14px; }
              hr { border: 0; border-top: 1px solid #ddd; margin: 20px 0; }
            </style>
          </head>
          <body>
            <pre>${draftedAgreement}</pre>
          </body>
        </html>
      `);
      printWindow.document.close();
      printWindow.focus();
      printWindow.print();
    }
  };

  return (
    <div id="consortium-builder-module" className="space-y-6">
      {/* Overview Block */}
      <div className="bg-gradient-to-br from-[#1231D0]/10 to-indigo-50 border border-[#1231D0]/20 p-5 rounded-xl flex flex-wrap items-center justify-between gap-4">
        <div className="space-y-1 max-w-xl">
          <div className="flex items-center space-x-2">
            <Users className="w-5 h-5 text-[#1231D0]" />
            <h4 className="text-sm font-extrabold text-slate-900 tracking-tight">Joint Venture Optimization & Consortium Matcher</h4>
          </div>
          <p className="text-[11px] text-slate-650 leading-relaxed font-normal">
            Bypassing qualifying hurdles is easiest when bidding collaboratively. Partner with high-turnover or elite certified sector players. When you form a joint venture (JV), the tender authority evaluates your pooled qualifications seamlessly!
          </p>
        </div>
        <div className="text-xs bg-white border border-slate-200/80 rounded-xl p-3 py-2.5 font-mono text-slate-500 shadow-sm grow-0 shrink-0">
          <span>JV Legal Scheme: CPWD / PWD Clause 18 Compliant</span>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        
        {/* Left Side: Selecting Partner & Recalculating combined eligibility */}
        <div className="space-y-5">
          <div className="bg-white border border-slate-200 rounded-xl p-5 space-y-4 shadow-sm">
            <h5 className="text-xs font-bold text-slate-800 uppercase tracking-widest border-b border-slate-100 pb-2">
              1. Choose a complementary bidder partner
            </h5>
            
            <div className="space-y-3.5">
              <label className="block text-[11px] font-bold text-slate-500 uppercase">Complimentary Firms Registered for Collaboration:</label>
              <div className="grid grid-cols-1 gap-2.5">
                {partners.map((partner) => {
                  const isSelected = partner.id === selectedPartnerId;
                  return (
                    <button
                      key={partner.id}
                      onClick={() => {
                        setSelectedPartnerId(partner.id);
                        setDraftedAgreement(""); // reset outdated agreement draft
                      }}
                      className={`text-left p-3.5 rounded-xl border transition-all flex justify-between items-center cursor-pointer ${
                        isSelected 
                          ? "border-[#1231D0] bg-blue-50/20 shadow-sm ring-1 ring-[#1231D0]/30" 
                          : "border-slate-200 hover:bg-slate-50"
                      }`}
                    >
                      <div className="space-y-1">
                        <p className="text-xs font-bold text-slate-900">{partner.companyName}</p>
                        <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-[10.5px] text-slate-400">
                          <span>Experience: <b>{partner.yearsOfExperience} yrs</b></span>
                          <span>Turnover: <b>₹{partner.annualTurnover} Cr</b></span>
                          <span>MSME: <b>{partner.msmeRegistered ? "Yes" : "No"}</b></span>
                        </div>
                      </div>
                      <span className={`text-[10px] font-black tracking-wider uppercase px-2 py-0.5 rounded ${
                        isSelected ? "bg-[#1231D0] text-white" : "bg-slate-100 text-slate-400"
                      }`}>
                        {isSelected ? "Selected" : "Select"}
                      </span>
                    </button>
                  );
                })}
              </div>
            </div>
          </div>

          {/* Recalculated Matrix Panel */}
          {selectedPartner && (
            <div className="bg-white border border-slate-200 rounded-xl p-5 space-y-4 shadow-sm">
              <h5 className="text-xs font-bold text-slate-800 uppercase tracking-widest border-b border-slate-100 pb-2">
                2. Real-Time Joint Venture Qualification Impact
              </h5>

              <div className="space-y-3.5">
                <div className="space-y-2">
                  <div className="flex justify-between text-xs font-bold text-slate-700">
                    <span>Combined Annual Capital Turnover</span>
                    <span className="font-mono text-slate-500">Required: ₹{reqTurnover} Cr</span>
                  </div>
                  <div className="grid grid-cols-3 gap-2 text-center text-[11px] font-medium">
                    <div className="bg-slate-50 border border-slate-150 p-2.5 rounded-xl">
                      <p className="text-slate-400 text-[9px] uppercase font-bold">Your Share</p>
                      <p className="font-bold text-slate-700 mt-0.5 font-mono">₹{preTurnover} Cr</p>
                    </div>
                    <div className="bg-slate-50 border border-slate-150 p-2.5 rounded-xl">
                      <p className="text-slate-400 text-[9px] uppercase font-bold">Partner</p>
                      <p className="font-bold text-slate-700 mt-0.5 font-mono">₹{partnerTurnover} Cr</p>
                    </div>
                    <div className={`p-2.5 rounded-xl border ${
                      combinedTurnoverCompliant ? "bg-emerald-50 border-emerald-100" : "bg-rose-50 border-rose-100"
                    }`}>
                      <p className={`text-[9px] uppercase font-bold ${combinedTurnoverCompliant ? "text-emerald-500" : "text-rose-500"}`}>Combined</p>
                      <span className="font-black text-[11.5px] mt-0.5 font-mono text-slate-900">₹{combinedTurnover} Cr</span>
                      <span className={`inline-block ml-1 font-black ${combinedTurnoverCompliant ? "text-emerald-700" : "text-rose-700"}`}>
                        {combinedTurnoverCompliant ? "✓" : "⚠️"}
                      </span>
                    </div>
                  </div>
                  <p className="text-[10px] text-slate-500 mt-1 leading-normal italic">
                    {combinedTurnoverCompliant 
                      ? `✓ Consortium completely resolves your ₹${(reqTurnover - preTurnover).toFixed(2)} Cr turnover deficit! You are 100% compliant.` 
                      : "Joint turnover remains below requirements."}
                  </p>
                </div>

                <div className="space-y-2">
                  <div className="flex justify-between text-xs font-bold text-slate-700">
                    <span>Peak Technical Experience Tenure</span>
                    <span className="font-mono text-slate-500">Required: {reqExperience} Years</span>
                  </div>
                  <div className="grid grid-cols-3 gap-2 text-center text-[11px] font-medium">
                    <div className="bg-slate-50 border border-slate-150 p-2.5 rounded-xl">
                      <p className="text-slate-400 text-[9px] uppercase font-bold">Your Exp</p>
                      <p className="font-bold text-slate-700 mt-0.5 font-mono">{preExperience} Yrs</p>
                    </div>
                    <div className="bg-slate-50 border border-slate-150 p-2.5 rounded-xl">
                      <p className="text-slate-400 text-[9px] uppercase font-bold">Partner</p>
                      <p className="font-bold text-slate-700 mt-0.5 font-mono">{partnerExperience} Yrs</p>
                    </div>
                    <div className={`p-2.5 rounded-xl border ${
                      combinedExperienceCompliant ? "bg-emerald-50 border-emerald-100" : "bg-rose-50 border-rose-100"
                    }`}>
                      <p className={`text-[9px] uppercase font-bold ${combinedExperienceCompliant ? "text-emerald-500" : "text-rose-500"}`}>Combined JV</p>
                      <span className="font-black text-[11.5px] mt-0.5 font-mono text-slate-900">{combinedExperience} Yrs</span>
                      <span className={`inline-block ml-1 font-black ${combinedExperienceCompliant ? "text-emerald-700" : "text-rose-700"}`}>
                        {combinedExperienceCompliant ? "✓" : "⚠️"}
                      </span>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          )}
        </div>

        {/* Right Side: Agreement Generator and Text Box */}
        <div className="space-y-5">
          <div className="bg-white border border-slate-200 rounded-xl p-5 space-y-4 shadow-sm flex flex-col justify-between min-h-[220px]">
            <div className="space-y-3">
              <h5 className="text-xs font-bold text-slate-800 uppercase tracking-widest border-b border-slate-100 pb-2">
                3. Custom Division of Responsibilities
              </h5>
              <p className="text-[10px] text-slate-400 leading-normal">
                Indicate physical & technical work parameters for each party, or leave blank to auto-distribute based on matching profiles.
              </p>
              <textarea
                value={responsibilities}
                onChange={(e) => setResponsibilities(e.target.value)}
                placeholder="Example: Lead Member takes primary execution of civil concrete work. Selected Partner Vardhan Infra delivers heavy machinery, capital guarantees, and ISO-certified technical compliance."
                className="w-full min-h-[85px] p-3 text-xs border border-slate-200 rounded-xl focus:border-[#1231D0] focus:ring-1 focus:ring-[#1231D0]/30 outline-none placeholder:text-slate-300 font-sans leading-relaxed"
              />
            </div>

            <button
              onClick={handleDraftAgreement}
              disabled={loading || !selectedPartnerId}
              className="w-full mt-3 bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-700 hover:to-indigo-700 text-white text-xs font-bold py-3 px-4 rounded-xl flex items-center justify-center space-x-1.5 shadow-md hover:scale-[1.01] active:scale-95 transition cursor-pointer disabled:opacity-50"
            >
              {loading ? (
                <>
                  <RefreshCw className="w-4 h-4 animate-spin text-white" />
                  <span>Drafting Legally Bundled JV Agreement via Gemini...</span>
                </>
              ) : (
                <>
                  <FileSignature className="w-4 h-4" />
                  <span>Draft Co-Bid JV Agreement (SBD Clause 18)</span>
                </>
              )}
            </button>
          </div>

          {/* Beautiful Crafted Draft Preview Card */}
          {draftedAgreement && (
            <div className="bg-white border border-slate-250 rounded-2xl overflow-hidden shadow-lg border-t-4 border-indigo-600 flex flex-col">
              <div className="p-4 px-5 bg-slate-50 border-b border-slate-200 flex justify-between items-center flex-wrap gap-2">
                <div className="flex items-center space-x-1.5 text-indigo-700">
                  <Sparkles className="w-4 h-4" />
                  <span className="text-[11px] font-black tracking-wider uppercase">Gemini AI Legal Drafter Ready</span>
                </div>
                <div className="flex items-center space-x-1 text-xs">
                  <button
                    onClick={handleCopy}
                    className="p-1 px-2.5 rounded-lg border border-slate-200 bg-white hover:bg-slate-50 text-slate-600 text-[10.5px] font-bold flex items-center space-x-1 cursor-pointer transition active:scale-95"
                  >
                    {copied ? <Check className="w-3 h-3 text-emerald-600" /> : <Copy className="w-3 h-3" />}
                    <span>{copied ? "Copied" : "Copy Draft"}</span>
                  </button>
                  <button
                    onClick={handlePrint}
                    className="p-1 px-2.5 rounded-lg border border-slate-250 bg-white hover:bg-slate-50 text-slate-600 text-[10.5px] font-bold flex items-center space-x-1 cursor-pointer transition active:scale-95"
                  >
                    <Printer className="w-3 h-3" />
                    <span>Print</span>
                  </button>
                </div>
              </div>

              <div className="p-6 overflow-y-auto max-h-[380px] bg-slate-950 font-mono text-[11px] text-indigo-200 p-4 rounded-b-2xl whitespace-pre-wrap leading-relaxed shadow-inner border border-slate-900">
                {draftedAgreement}
              </div>
            </div>
          )}

        </div>
      </div>
    </div>
  );
}
