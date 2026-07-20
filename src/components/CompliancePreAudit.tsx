import React, { useState, useEffect } from "react";
import { 
  ShieldCheck, 
  AlertTriangle, 
  CheckCircle, 
  FileText, 
  Sparkles, 
  RefreshCw, 
  AlertCircle, 
  FileSpreadsheet, 
  Lock,
  TrendingUp,
  Briefcase,
  Coins,
  Scale
} from "lucide-react";
import { Tender, CompanyProfile, DocumentVault } from "../types.js";
import { formatIndianCurrency, getAuthHeaders } from "../utils.js";

interface CompliancePreAuditProps {
  tender: Tender;
  profile: CompanyProfile;
  onUpgradeClick: () => void;
  userPlan: string;
}

export default function CompliancePreAudit({ tender, profile, onUpgradeClick, userPlan }: CompliancePreAuditProps) {
  const [vaultFiles, setVaultFiles] = useState<DocumentVault[]>([]);
  const [loading, setLoading] = useState(false);
  const [auditAdvice, setAuditAdvice] = useState<string>("");
  const [triggerCount, setTriggerCount] = useState(0);

  // Define critical administrative requirements we'll audit
  const turnoverReq = tender.eligibilityCriteria.minTurnover || 0;
  const turnoverComp = profile.annualTurnover || 0;
  const turnoverDeficit = Math.max(0, turnoverReq - turnoverComp);

  const experienceReq = tender.eligibilityCriteria.minExperience || 0;
  const experienceComp = profile.yearsOfExperience || 0;
  const experienceDeficit = Math.max(0, experienceReq - experienceComp);

  // EMD Criteria Audit
  const emdReqAmount = tender.emdAmount || 0; // standard format usually represents Lakhs or raw depending on model source.
  const hasEmdInstrument = vaultFiles.some(f => f.documentType === "EMD_INSTRUMENT");
  const isEmdExempt = profile.msmeRegistered;
  const emdStatus = emdReqAmount === 0 || isEmdExempt || hasEmdInstrument ? "PASSED" : "PENDING";

  // Load user files from the Vault to cross-audit presence
  useEffect(() => {
    async function loadVault() {
      try {
        const res = await fetch("/api/vault", {
          headers: getAuthHeaders()
        });
        if (res.ok) {
          const data = await res.json();
          setVaultFiles(Array.isArray(data) ? data : []);
        }
      } catch (err) {
        console.error("Failed to fetch vault items for audit check:", err);
      }
    }
    loadVault();
  }, []);

  // Fetch specialized AI advice for mitigating deficits
  useEffect(() => {
    if (userPlan === "FREE") return;

    async function fetchAiAuditAdvices() {
      setLoading(true);
      try {
        const response = await fetch("/api/tenders/" + tender.id + "/qa", {
          method: "POST",
          headers: getAuthHeaders({ "Content-Type": "application/json" }),
          body: JSON.stringify({
            question: `As Sharma Construction with ${profile.annualTurnover} Cr turnover and ${profile.yearsOfExperience} years experience, provide strategic tactical recommendation bidding advice on this tender needing ${turnoverReq} Cr turnover, ${experienceReq} years exp. Give 3 professional bullet points for compliance/mitigation.`
          })
        });
        if (response.ok) {
          const data = await response.json();
          setAuditAdvice(data.answer || "");
        }
      } catch (err) {
        console.error("Failed to generate custom audit advice:", err);
      } finally {
        setLoading(false);
      }
    }

    fetchAiAuditAdvices();
  }, [tender.id, profile.id, triggerCount, userPlan]);

  // Auditor list
  const requiredCertifications = tender.eligibilityCriteria.requiredCertifications || [];
  
  const complianceChecks = [
    {
      id: "turnover",
      name: "Minimum Annual Turnover",
      required: `${turnoverReq} Cr average`,
      provided: `${turnoverComp} Cr`,
      status: turnoverDeficit === 0 ? "PASSED" : "FAILED",
      icon: <TrendingUp className="w-5 h-5 text-indigo-600" />,
      detail: turnoverDeficit === 0 
        ? "Exceeds tender margin specifications comfortable buffer." 
        : `Deficit of ₹${turnoverDeficit.toFixed(2)} Cr in audited corporate parameters. Recommended to form Joint Venture (JV).`,
    },
    {
      id: "experience",
      name: "Sector Work Experience",
      required: `${experienceReq} Years`,
      provided: `${experienceComp} Years`,
      status: experienceDeficit === 0 ? "PASSED" : "FAILED",
      icon: <Briefcase className="w-5 h-5 text-sky-600" />,
      detail: experienceDeficit === 0 
        ? "Satisfies the sector expertise threshold guidelines." 
        : `Deficit of ${experienceDeficit} Years of certified work completion.`,
    },
    {
      id: "emd",
      name: "Earnest Money Deposit (EMD)",
      required: emdReqAmount === 0 ? "No EMD" : `${emdReqAmount} Lakhs`,
      provided: isEmdExempt ? "MSME Exempted" : hasEmdInstrument ? "Instrument Uploaded" : "Instrument Pending",
      status: emdStatus,
      icon: <Coins className="w-5 h-5 text-amber-600" />,
      detail: emdReqAmount === 0
        ? "No earnest money deposit required for this work."
        : isEmdExempt
          ? `Fully exempted from ₹${formatIndianCurrency(emdReqAmount * 100000)} deposit via valid MSME Udyam status!`
          : hasEmdInstrument
            ? `Verified physical instrument of ₹${formatIndianCurrency(emdReqAmount * 100000)} is ready in your Vault.`
            : `Draft or BG of ₹${formatIndianCurrency(emdReqAmount * 100000)} required. Claim MSME exemption or upload EMD.`,
    },
    {
      id: "msme",
      name: "MSME Scheme Eligibility",
      required: tender.eligibilityCriteria.msmeOnly ? "Reserved exclusively" : "Open category",
      provided: profile.msmeRegistered ? "Udyam registered SME" : "General Corporation",
      status: (tender.eligibilityCriteria.msmeOnly && !profile.msmeRegistered) ? "FAILED" : "PASSED",
      icon: <Scale className="w-5 h-5 text-emerald-600" />,
      detail: profile.msmeRegistered 
        ? "Eligible for standard bid fee waivers and EMD exemptions."
        : "Standard deposits and earnest money criteria apply.",
    },
  ];

  // Document matching from vault
  const documentAudit = [
    {
      type: "GST_CERTIFICATE",
      name: "Good & Services Tax Verification (Form GST REG-06)",
      mandatory: true,
      found: vaultFiles.some(f => f.documentType === "GST_CERTIFICATE"),
    },
    {
      type: "PAN_CARD",
      name: "Mandatory Corporate PAN Card (Income Tax Dept)",
      mandatory: true,
      found: vaultFiles.some(f => f.documentType === "PAN_CARD"),
    },
    {
      type: "AUDITED_FINANCIALS",
      name: "3 Years Audited Financial Balance Sheets",
      mandatory: turnoverReq > 0,
      found: vaultFiles.some(f => f.documentType === "AUDITED_FINANCIALS"),
    },
    {
      type: "EXPERIENCE_CERTIFICATE",
      name: "Completion Certificate for Similar Nature Works",
      mandatory: experienceReq > 0,
      found: vaultFiles.some(f => f.documentType === "EXPERIENCE_CERTIFICATE"),
    }
  ];

  const overallFailures = complianceChecks.filter(c => c.status === "FAILED").length + documentAudit.filter(d => d.mandatory && !d.found).length;

  return (
    <div id="compliance-pre-audit-module" className="bg-white border border-slate-200 rounded-xl overflow-hidden shadow-sm">
      {/* Top Banner Alert */}
      <div className={`p-4 px-6 flex items-start space-x-3 border-b border-slate-150 ${overallFailures > 0 ? "bg-amber-50" : "bg-emerald-50"}`}>
        <div className={`p-1.5 rounded-lg mt-0.5 ${overallFailures > 0 ? "bg-amber-100 text-amber-800" : "bg-emerald-100 text-emerald-800"}`}>
          {overallFailures > 0 ? <AlertTriangle className="w-5 h-5" /> : <ShieldCheck className="w-5 h-5" />}
        </div>
        <div className="grow">
          <div className="flex justify-between items-center flex-wrap gap-2">
            <h4 className="text-sm font-extrabold text-slate-900 tracking-tight">
              Pre-Flight Administrative & Clerical Audit Score
            </h4>
            <span className={`text-[10px] font-black tracking-wide px-2.5 py-0.5 rounded-full ${overallFailures > 0 ? "bg-amber-600 text-white" : "bg-emerald-600 text-white"}`}>
              {overallFailures > 0 ? `⚠️ ATTENTION: ${overallFailures} DEFICITS FOUND` : "✅ 100% REGULATORY READY"}
            </span>
          </div>
          <p className="text-[11px] text-slate-650 font-normal mt-1 leading-relaxed">
            {overallFailures > 0 
              ? "We detected specific financial threshold shortfalls or missing mandatory administrative certificates in your vault. Secure JVs or upload credentials to avoid automated technical rejection."
              : "Excellent! Your company profiles and uploaded documents completely satisfy all statutory thresholds for this tender bid."}
          </p>
        </div>
      </div>

      <div className="p-6 space-y-8">
        {/* Section 1: Financial & Technical Threshold Margin Audit */}
        <div className="space-y-3">
          <div className="flex items-center space-x-2">
            <FileSpreadsheet className="w-4.5 h-4.5 text-slate-500" />
            <h5 className="text-xs font-bold text-slate-800 uppercase tracking-widest">Financial, Technical & EMD Compliance Scorecard</h5>
          </div>
          
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
            {complianceChecks.map((row) => {
              const isPassed = row.status === "PASSED";
              const isExempted = row.status === "EXEMPTED";
              const isPending = row.status === "PENDING";
              
              let cardBg = "bg-rose-50/25 border-rose-100";
              let statusText = "⚠️ GAP WARNING";
              let badgeColor = "bg-rose-100 text-rose-800";
              
              if (isPassed) {
                cardBg = "bg-emerald-50/20 border-emerald-110";
                statusText = "✓ CERTIFIED";
                badgeColor = "bg-emerald-100 text-emerald-800";
              } else if (isExempted) {
                cardBg = "bg-blue-50/20 border-blue-110";
                statusText = "✧ EXEMPTED";
                badgeColor = "bg-blue-100 text-blue-800";
              } else if (isPending) {
                cardBg = "bg-amber-50/20 border-amber-110";
                statusText = "⏳ ACTION REQUIRED";
                badgeColor = "bg-amber-100 text-amber-800";
              }

              return (
                <div 
                  key={row.id} 
                  className={`p-4 rounded-xl border flex flex-col justify-between ${cardBg} shadow-sm hover:shadow transition`}
                >
                  <div className="space-y-1.5">
                    <div className="flex justify-between items-start gap-1">
                      <div className="flex items-center space-x-1.5">
                        {row.icon}
                        <span className="text-[11px] font-bold text-slate-500 uppercase tracking-tight leading-none">{row.name}</span>
                      </div>
                    </div>
                    
                    <div className="pt-1">
                      <span className={`inline-block text-[9px] font-black px-2 py-0.5 rounded-md ${badgeColor}`}>
                        {statusText}
                      </span>
                    </div>

                    <div className="flex flex-col py-1">
                      <div className="flex justify-between items-baseline text-[11px] text-slate-500">
                        <span>Your profile:</span>
                        <span className="font-bold text-slate-800 font-mono">{row.provided}</span>
                      </div>
                      <div className="flex justify-between items-baseline text-[11px] text-slate-500">
                        <span>Required:</span>
                        <span className="font-sans font-medium text-slate-600">{row.required}</span>
                      </div>
                    </div>
                  </div>
                  <p className={`text-[10.5px] mt-2.5 font-medium leading-relaxed ${isPassed ? "text-slate-600" : isExempted ? "text-blue-700" : isPending ? "text-amber-700 font-semibold" : "text-rose-700 font-semibold"}`}>
                    {row.detail}
                  </p>
                </div>
              );
            })}
          </div>
        </div>

        {/* Section 2: Vault Statutory Document Pre-Flight Scan */}
        <div className="space-y-3">
          <div className="flex flex-wrap justify-between items-center gap-2">
            <div className="flex items-center space-x-2">
              <FileText className="w-4.5 h-4.5 text-slate-500" />
              <h5 className="text-xs font-bold text-slate-800 uppercase tracking-widest">Administrative Document Pre-flight Scan</h5>
            </div>
            <span className="text-[10px] text-slate-500 font-mono">Scanned directly from your active Document Vault</span>
          </div>

          <div className="border border-slate-200 rounded-xl overflow-hidden">
            <table className="w-full text-left text-xs">
              <thead className="bg-slate-50 font-mono font-bold text-[10px] text-slate-500 border-b border-slate-200 uppercase">
                <tr>
                  <th className="py-2.5 px-4">Verification Checkpoint Item</th>
                  <th className="py-2.5 px-4">Requirement</th>
                  <th className="py-2.5 px-4 text-center">Vault Status</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 text-slate-700 font-medium font-sans">
                {documentAudit.map((doc, idx) => (
                  <tr key={idx} className="hover:bg-slate-50/30">
                    <td className="py-3 px-4">
                      <div>
                        <p className="font-bold text-slate-800 text-[11.5px]">{doc.name}</p>
                        <p className="text-[10px] text-slate-400 mt-0.5">Category category: {doc.type}</p>
                      </div>
                    </td>
                    <td className="py-3 px-4">
                      <span className={`inline-block text-[9px] font-black tracking-wide px-2 py-0.5 rounded-full ${
                        doc.mandatory ? "bg-slate-800 text-slate-100" : "bg-slate-100 text-slate-500"
                      }`}>
                        {doc.mandatory ? "MANDATORY" : "OPTIONAL BENEFIT"}
                      </span>
                    </td>
                    <td className="py-3 px-4 text-center">
                      {doc.found ? (
                        <span className="inline-flex items-center space-x-1 text-emerald-700 bg-emerald-50 border border-emerald-100 font-extrabold text-[10.5px] px-2.5 py-1 rounded-lg">
                          <CheckCircle className="w-3.5 h-3.5 text-emerald-600" />
                          <span>Ready in Vault</span>
                        </span>
                      ) : (
                        <span className={`inline-flex items-center space-x-1 font-extrabold text-[10.5px] px-2.5 py-1 rounded-lg ${
                          doc.mandatory ? "text-rose-700 bg-rose-50 border border-rose-100" : "text-amber-700 bg-amber-50 border border-amber-100"
                        }`}>
                          <AlertCircle className="w-3.5 h-3.5" />
                          <span>{doc.mandatory ? "Missing (Auto Reject)" : "Not Uploaded"}</span>
                        </span>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>

        {/* Section 3: AI Compliance Risk Assessment & Tactics */}
        <div id="ai-strategic-tactics" className="border border-indigo-150 bg-indigo-50/15 p-5 rounded-2xl relative overflow-hidden">
          <div className="absolute top-0 right-0 p-8 text-indigo-100 transform translate-x-4 -translate-y-4 font-black text-6xl pointer-events-none select-none opacity-20">
            AI
          </div>
          <div className="flex items-center space-x-2 border-b border-indigo-100/50 pb-2.5 mb-3.5">
            <Sparkles className="w-4 h-4 text-indigo-600 animate-pulse" />
            <h5 className="text-xs font-bold text-indigo-800 uppercase tracking-widest">
              AI Deficit Mitigation Recommendations & Bidding Tactics
            </h5>
          </div>

          {userPlan === "FREE" ? (
            <div className="flex flex-col items-center justify-center py-4 text-center">
              <Lock className="w-8 h-8 text-indigo-400 mb-2" />
              <p className="text-xs text-slate-500 max-w-md">
                Tactical AI Mitigation audits are locked. Upgrade your account plan to unlock automated strategic action steps tailored specifically to your company gaps.
              </p>
              <button 
                onClick={onUpgradeClick}
                className="mt-3 bg-indigo-600 hover:bg-indigo-700 text-white font-bold text-xs px-4 py-2 rounded-lg transition"
              >
                Unlock Audit Tactics
              </button>
            </div>
          ) : (
            <div className="text-xs leading-relaxed text-slate-700 space-y-3">
              {loading ? (
                <div className="flex items-center justify-center space-x-2 py-4">
                  <RefreshCw className="w-4 h-4 text-indigo-600 animate-spin" />
                  <span className="font-mono text-[11px] text-slate-500">Generating compliance recommendations via Gemini AI...</span>
                </div>
              ) : auditAdvice ? (
                <div className="whitespace-pre-line text-slate-755 font-normal">
                  {auditAdvice}
                </div>
              ) : (
                <div className="text-slate-400 italic">
                  Run high-level match analysis on the main summary screen to activate recommendation engine routing.
                </div>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
