import React, { useState, useEffect } from "react";
import { 
  Sparkles, 
  CheckCircle, 
  AlertTriangle, 
  RefreshCw, 
  Award, 
  ShieldAlert, 
  ListChecks, 
  HelpCircle,
  TrendingUp,
  FileCheck2,
  Building,
  DollarSign,
  Calendar
} from "lucide-react";
import { motion, AnimatePresence } from "motion/react";
import { Tender, CompanyProfile } from "../types.js";
import { getAuthHeaders } from "../utils.js";

interface BidMatchAnalysisProps {
  tender: Tender;
  profile: CompanyProfile;
}

interface AnalysisResult {
  overallScore: number;
  eligibilityScore: number;
  verdict: "GO" | "NO-GO" | "BORDERLINE";
  verdictReason: string;
  criteriaBreakdown: {
    criterion_name: string;
    requirement: string;
    company_value: string;
    status: string;
    explanation: string;
  }[];
  missingRequirements: string[];
  riskIndicators: string[];
  improvementRecommendations: string[];
}

export default function BidMatchAnalysis({ tender, profile }: BidMatchAnalysisProps) {
  const [analysis, setAnalysis] = useState<AnalysisResult | null>(null);
  const [loading, setLoading] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);
  const [stepMsg, setStepMsg] = useState<string>("");

  const triggerAnalysis = async () => {
    setLoading(true);
    setError(null);
    
    const steps = [
      "Connecting to Gemini AI Matching Engine...",
      "Extracting minimum eligibility requirements from Tender...",
      "Mapping company's turnover and experience benchmarks...",
      "Checking required certifications & operating state validity...",
      "Computing exact compatibility and eligibility scoring parameters...",
      "Synthesizing risk indicators and remediation plans..."
    ];

    let stepIndex = 0;
    setStepMsg(steps[0]);
    const interval = setInterval(() => {
      stepIndex++;
      if (stepIndex < steps.length) {
        setStepMsg(steps[stepIndex]);
      }
    }, 700);

    try {
      const response = await fetch("/api/analysis/match", {
        method: "POST",
        headers: getAuthHeaders({ "Content-Type": "application/json" }),
        body: JSON.stringify({
          tenderId: tender.id,
          companyProfileId: profile.id
        })
      });

      if (!response.ok) {
        throw new Error(`Server returned error status: ${response.status}`);
      }

      const data = await response.json();
      
      // Map API outputs back to strict format
      const normalizedData: AnalysisResult = {
        overallScore: data.overallScore || 0,
        eligibilityScore: data.eligibilityScore !== undefined ? data.eligibilityScore : (data.overallScore || 0),
        verdict: data.verdict || "BORDERLINE",
        verdictReason: data.verdictReason || "Calculations successfully processed.",
        criteriaBreakdown: data.criteriaBreakdown || [],
        missingRequirements: data.missingRequirements || data.missingItems || [],
        riskIndicators: data.riskIndicators || data.risks || [],
        improvementRecommendations: data.improvementRecommendations || data.strengths || []
      };

      setAnalysis(normalizedData);
    } catch (err: any) {
      console.error("AI Bid-Match Analysis failed:", err);
      setError("Unable to complete live Gemini AI bid-match analysis. Please try again.");
    } finally {
      clearInterval(interval);
      setLoading(false);
    }
  };

  useEffect(() => {
    triggerAnalysis();
  }, [tender.id, profile.id]);

  const getVerdictStyle = (verdict: string) => {
    switch (verdict) {
      case "GO":
        return {
          bg: "bg-emerald-50 border-emerald-200",
          text: "text-emerald-800",
          iconColor: "text-emerald-600",
          badge: "bg-emerald-600 text-white",
          label: "HIGH COMPLIANCE (GO BID)"
        };
      case "BORDERLINE":
        return {
          bg: "bg-amber-50 border-amber-200",
          text: "text-amber-800",
          iconColor: "text-amber-600",
          badge: "bg-amber-500 text-white",
          label: "BORDERLINE COMPLIANCE"
        };
      case "NO-GO":
        return {
          bg: "bg-red-50 border-red-200",
          text: "text-red-800",
          iconColor: "text-red-600",
          badge: "bg-red-600 text-white",
          label: "LOW COMPLIANCE (NO-GO)"
        };
      default:
        return {
          bg: "bg-slate-50 border-slate-200",
          text: "text-slate-800",
          iconColor: "text-slate-600",
          badge: "bg-slate-600 text-white",
          label: "ANALYSIS COMPLETED"
        };
    }
  };

  return (
    <div id="ai-bid-match-section" className="bg-slate-50 border border-slate-200 rounded-xl overflow-hidden shadow-sm">
      
      {/* Target Heading */}
      <div className="bg-slate-900 text-white px-6 py-4 flex flex-col sm:flex-row justify-between items-start sm:items-center gap-3">
        <div className="flex items-center space-x-2">
          <Sparkles className="w-5 h-5 text-amber-400 animate-pulse" />
          <div>
            <h4 className="text-sm font-bold tracking-tight uppercase">
              Gemini AI Match & Compliance Engine
            </h4>
            <p className="text-[11px] text-slate-300 font-normal">
              Direct suitability checker using company financials, certifications, and past works
            </p>
          </div>
        </div>
        <button
          onClick={triggerAnalysis}
          disabled={loading}
          className="inline-flex items-center space-x-1 border border-slate-700 bg-slate-800 hover:bg-slate-700 text-white text-[10px] font-bold px-3 py-1.5 rounded-lg transition-all active:scale-95 disabled:opacity-55 cursor-pointer uppercase h-8"
        >
          <RefreshCw className={`w-3 h-3 ${loading ? "animate-spin" : ""}`} />
          <span>{loading ? "Calculating..." : "Re-Run Matcher"}</span>
        </button>
      </div>

      {/* INPUT VERIFICATION BAR */}
      <div className="bg-white border-b border-slate-200 px-6 py-3 flex flex-wrap gap-x-6 gap-y-2 items-center text-xs text-slate-600 font-medium">
        <span className="text-slate-400 font-bold uppercase tracking-wider text-[10px] mr-1">Verified Inputs:</span>
        <span className="flex items-center gap-1">
          <Building className="w-3.5 h-3.5 text-blue-500" />
          <span>Profile: <strong className="text-slate-900">{profile.companyName}</strong></span>
        </span>
        <span className="flex items-center gap-1">
          <DollarSign className="w-3.5 h-3.5 text-emerald-500" />
          <span>Turnover: <strong className="text-slate-900">₹{profile.annualTurnover} Cr</strong></span>
        </span>
        <span className="flex items-center gap-1">
          <Calendar className="w-3.5 h-3.5 text-purple-500" />
          <span>Experience: <strong className="text-slate-900">{profile.yearsOfExperience} Years</strong></span>
        </span>
        <span className="flex items-center gap-1">
          <FileCheck2 className="w-3.5 h-3.5 text-amber-500" />
          <span>Certs: <strong className="text-slate-900">{profile.certifications.length} Listed</strong></span>
        </span>
      </div>

      <AnimatePresence mode="wait">
        {loading ? (
          <motion.div
            key="loading-state"
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -10 }}
            className="p-12 flex flex-col items-center justify-center text-center space-y-4 bg-white"
          >
            <div className="relative">
              <div className="w-12 h-12 rounded-full border-4 border-slate-100 border-t-slate-900 animate-spin"></div>
              <Sparkles className="w-5 h-5 text-indigo-500 absolute top-3.5 left-3.5 animate-bounce" />
            </div>
            <div className="space-y-1">
              <h5 className="text-xs font-bold text-slate-800 uppercase tracking-wider">Analyzing RFP Metadata</h5>
              <p className="text-xs font-semibold text-slate-500 font-mono italic max-w-md">
                {stepMsg}
              </p>
            </div>
          </motion.div>
        ) : error ? (
          <motion.div
            key="error"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            className="p-10 text-center space-y-4 bg-white"
          >
            <AlertTriangle className="w-12 h-12 text-rose-500 mx-auto animate-bounce" />
            <div className="max-w-sm mx-auto space-y-2">
              <p className="text-xs font-black text-slate-800 uppercase">Operational Threshold Met</p>
              <p className="text-xs text-slate-500 leading-relaxed font-semibold">{error}</p>
              <button
                onClick={triggerAnalysis}
                className="mt-2 text-white bg-slate-900 font-bold text-xs px-4 py-2 rounded-lg hover:bg-slate-800"
              >
                Retry Match connection
              </button>
            </div>
          </motion.div>
        ) : analysis ? (
          <motion.div
            key="result-state"
            initial={{ opacity: 0, y: 15 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.3, ease: "easeOut" }}
            className="p-6 space-y-6 bg-white"
          >
            {/* Split row: Verdict Summary + Score Dials */}
            <div className={`border p-5 rounded-xl flex flex-col lg:flex-row justify-between items-stretch gap-6 ${getVerdictStyle(analysis.verdict).bg}`}>
              
              <div className="space-y-2 flex-grow">
                <span className={`text-[9px] font-black px-2.5 py-0.5 rounded-full uppercase tracking-wider block w-fit ${getVerdictStyle(analysis.verdict).badge}`}>
                  {getVerdictStyle(analysis.verdict).label}
                </span>
                <h5 className="text-sm font-bold text-slate-900">Verdict Analysis</h5>
                <p className={`text-xs font-medium leading-relaxed ${getVerdictStyle(analysis.verdict).text}`}>
                  {analysis.verdictReason}
                </p>
              </div>

              {/* Dials Column */}
              <div className="flex items-center justify-center gap-8 self-center lg:self-auto grow-0 shrink-0 border-t lg:border-t-0 lg:border-l border-slate-200 pt-4 lg:pt-0 lg:pl-6">
                
                {/* Dial 1: Match Score */}
                <div className="flex flex-col items-center space-y-2">
                  <div className="relative flex items-center justify-center">
                    <svg className="w-16 h-16 transform -rotate-90">
                      <circle cx="32" cy="32" r="26" className="text-slate-100/80 fill-transparent" strokeWidth="5" />
                      <circle
                        cx="32"
                        cy="32"
                        r="26"
                        className={
                          analysis.overallScore >= 75
                            ? "text-emerald-500 fill-transparent"
                            : analysis.overallScore >= 50
                            ? "text-amber-500 fill-transparent"
                            : "text-rose-500 fill-transparent"
                        }
                        strokeWidth="5"
                        strokeDasharray={`${2 * Math.PI * 26}`}
                        strokeDashoffset={`${2 * Math.PI * 26 * (1 - analysis.overallScore / 100)}`}
                        strokeLinecap="round"
                        stroke="currentColor"
                      />
                    </svg>
                    <span className="absolute text-xs font-extrabold text-slate-800 font-mono">
                      {analysis.overallScore}%
                    </span>
                  </div>
                  <div className="text-center">
                    <span className="text-[10px] text-slate-400 font-extrabold uppercase tracking-wider block">AI Match</span>
                    <span className="text-[10px] font-bold text-slate-700 uppercase">Compatibility</span>
                  </div>
                </div>

                {/* Dial 2: Eligibility Score */}
                <div className="flex flex-col items-center space-y-2">
                  <div className="relative flex items-center justify-center">
                    <svg className="w-16 h-16 transform -rotate-90">
                      <circle cx="32" cy="32" r="26" className="text-slate-100/80 fill-transparent" strokeWidth="5" />
                      <circle
                        cx="32"
                        cy="32"
                        r="26"
                        className={
                          analysis.eligibilityScore >= 75
                            ? "text-emerald-500 fill-transparent"
                            : analysis.eligibilityScore >= 50
                            ? "text-amber-500 fill-transparent"
                            : "text-rose-500 fill-transparent"
                        }
                        strokeWidth="5"
                        strokeDasharray={`${2 * Math.PI * 26}`}
                        strokeDashoffset={`${2 * Math.PI * 26 * (1 - analysis.eligibilityScore / 100)}`}
                        strokeLinecap="round"
                        stroke="currentColor"
                      />
                    </svg>
                    <span className="absolute text-xs font-extrabold text-slate-800 font-mono">
                      {analysis.eligibilityScore}%
                    </span>
                  </div>
                  <div className="text-center">
                    <span className="text-[10px] text-slate-400 font-extrabold uppercase tracking-wider block">Compliance</span>
                    <span className="text-[10px] font-bold text-slate-700 uppercase">Eligibility</span>
                  </div>
                </div>

              </div>
            </div>

            {/* THREE OUTCOMES OF INTEREST */}
            <div className="grid lg:grid-cols-3 gap-6">
              
              {/* Missing Requirements List */}
              <div className="border border-red-150 bg-red-50/10 rounded-xl p-5 space-y-3">
                <div className="flex items-center space-x-2 border-b border-red-100 pb-2">
                  <AlertTriangle className="w-4 h-4 text-red-600" />
                  <h5 className="text-xs font-extrabold text-red-800 uppercase tracking-wide">
                    Missing Requirements ({analysis.missingRequirements?.length || 0})
                  </h5>
                </div>
                <ul className="space-y-2.5 text-xs">
                  {analysis.missingRequirements && analysis.missingRequirements.length > 0 ? (
                    analysis.missingRequirements.map((item, idx) => (
                      <li key={idx} className="flex items-start gap-2 text-slate-700">
                        <span className="w-1.5 h-1.5 rounded-full bg-rose-500 mt-1.5 shrink-0" />
                        <span className="leading-relaxed text-[11px] font-medium text-slate-800">{item}</span>
                      </li>
                    ))
                  ) : (
                    <li className="text-slate-450 italic font-medium py-1 text-[11px]">
                      Excellent. Bidding profile fully complies with requirements.
                    </li>
                  )}
                </ul>
              </div>

              {/* Risk Indicators Card */}
              <div className="border border-amber-150 bg-amber-50/10 rounded-xl p-5 space-y-3">
                <div className="flex items-center space-x-2 border-b border-amber-100 pb-2">
                  <ShieldAlert className="w-4 h-4 text-amber-600" />
                  <h5 className="text-xs font-extrabold text-amber-800 uppercase tracking-wide">
                    Risk Indicators ({analysis.riskIndicators?.length || 0})
                  </h5>
                </div>
                <ul className="space-y-2.5 text-xs col">
                  {analysis.riskIndicators && analysis.riskIndicators.length > 0 ? (
                    analysis.riskIndicators.map((item, idx) => (
                      <li key={idx} className="flex items-start gap-2 text-slate-700">
                        <AlertTriangle className="w-3.5 h-3.5 text-amber-500 shrink-0 mt-0.5" />
                        <span className="leading-relaxed text-[11px] font-medium text-slate-800">{item}</span>
                      </li>
                    ))
                  ) : (
                    <li className="text-slate-450 italic font-medium py-1 text-[11px]">
                      No critical technical risk flags identified during audit.
                    </li>
                  )}
                </ul>
              </div>

              {/* Improvement Recommendations Card */}
              <div className="border border-indigo-150 bg-indigo-50/15 rounded-xl p-5 space-y-3">
                <div className="flex items-center space-x-2 border-b border-indigo-100 pb-2">
                  <TrendingUp className="w-4 h-4 text-indigo-600" />
                  <h5 className="text-xs font-extrabold text-indigo-800 uppercase tracking-wide">
                    Improvement Recommendations ({analysis.improvementRecommendations?.length || 0})
                  </h5>
                </div>
                <ul className="space-y-2.5 text-xs col">
                  {analysis.improvementRecommendations && analysis.improvementRecommendations.length > 0 ? (
                    analysis.improvementRecommendations.map((item, idx) => (
                      <li key={idx} className="flex items-start gap-2 text-slate-700">
                        <CheckCircle className="w-3.5 h-3.5 text-indigo-500 shrink-0 mt-0.5" />
                        <span className="leading-relaxed text-[11px] font-semibold text-indigo-950">{item}</span>
                      </li>
                    ))
                  ) : (
                    <li className="text-slate-450 italic font-medium py-1 text-[11px]">
                      Your application matches maximum capability. No improvement required.
                    </li>
                  )}
                </ul>
              </div>

            </div>

            {/* Criteria Checklist Breakdown Grid */}
            <div className="space-y-3 pt-2">
              <div className="flex items-center space-x-2 border-b border-slate-100 pb-2">
                <ListChecks className="w-4 h-4 text-slate-500" />
                <h5 className="text-xs font-bold text-slate-800 uppercase tracking-wide">
                  Detailed Criteria Compliance Matrices
                </h5>
              </div>
              <div className="overflow-x-auto border border-slate-200 rounded-lg">
                <table className="w-full text-left text-xs border-collapse">
                  <thead>
                    <tr className="bg-slate-50 text-slate-500 font-extrabold border-b border-slate-200 uppercase text-[10px]">
                      <th className="py-2.5 px-4 font-bold">Metric / Specification</th>
                      <th className="py-2.5 px-3 font-bold">Required Threshold</th>
                      <th className="py-2.5 px-3 font-bold">Company Profile Value</th>
                      <th className="py-2.5 px-3 text-center font-bold">Status</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-150 font-medium text-slate-700">
                    {analysis.criteriaBreakdown && analysis.criteriaBreakdown.length > 0 ? (
                      analysis.criteriaBreakdown.map((row, idx) => (
                        <tr key={idx} className="hover:bg-slate-50/40">
                          <td className="py-3 px-4 font-bold text-slate-800">
                            {row.criterion_name}
                          </td>
                          <td className="py-3 px-3 text-slate-600 font-mono text-[11px]">
                            {row.requirement}
                          </td>
                          <td className="py-3 px-3 text-slate-600 font-mono text-[11px]">
                            {row.company_value}
                          </td>
                          <td className="py-3 px-3 text-center">
                            <span
                              className={`inline-block px-2.5 py-0.5 rounded-full text-[9px] font-black uppercase ${
                                row.status === "MATCH" || row.status === "PASSED" || row.status === "PASS"
                                  ? "bg-emerald-50 text-emerald-700 border border-emerald-150"
                                  : row.status === "PARTIAL" || row.status.includes("WARN")
                                  ? "bg-amber-50 text-amber-700 border border-amber-150"
                                  : "bg-rose-50 text-rose-700 border border-rose-150"
                              }`}
                            >
                              {row.status}
                            </span>
                          </td>
                        </tr>
                      ))
                    ) : (
                      <tr>
                        <td colSpan={4} className="py-6 text-center text-slate-400 font-medium italic text-[11px]">
                          No manual criteria breakdowns produced for fallback. Refer to general scores above.
                        </td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>
            </div>

          </motion.div>
        ) : (
          <div className="p-8 text-center text-slate-400 text-xs font-mono bg-white">
            Click "Re-run Live Match" to begin calculations.
          </div>
        )}
      </AnimatePresence>
    </div>
  );
}
