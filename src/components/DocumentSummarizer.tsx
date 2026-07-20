import React, { useState, useEffect } from "react";
import { FileText, Sparkles, AlertCircle, Calendar, Clock, FileCheck, Layers, ClipboardList, CheckSquare, Square } from "lucide-react";
import { motion, AnimatePresence } from "motion/react";
import { Tender } from "../types.js";
import { getAuthHeaders } from "../utils.js";

interface DocumentSummarizerProps {
  tender: Tender;
}

interface DocSummaryResult {
  documentName: string;
  documentType: string;
  executiveSummary: string;
  submissionDeadline: string;
  keyTerms: { term: string; explanation: string }[];
  complianceChecklist: string[];
}

export default function DocumentSummarizer({ tender }: DocumentSummarizerProps) {
  const [selectedDoc, setSelectedDoc] = useState<{ name: string; url: string } | null>(null);
  const [summary, setSummary] = useState<DocSummaryResult | null>(null);
  const [loading, setLoading] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);
  const [stepMsg, setStepMsg] = useState<string>("");
  const [checkedItems, setCheckedItems] = useState<{ [key: string]: boolean }>({});

  const handleSummarize = async (doc: { name: string; url: string }) => {
    setSelectedDoc(doc);
    setLoading(true);
    setError(null);
    setSummary(null);
    setCheckedItems({});

    const steps = [
      "Accessing document metadata...",
      "Reading tender specification rules...",
      "Extracting critical statutory clauses...",
      "Synthesizing submission deadlines & Milestones...",
      "Structuring compliance checker guide..."
    ];

    let stepIndex = 0;
    setStepMsg(steps[0]);
    const interval = setInterval(() => {
      stepIndex++;
      if (stepIndex < steps.length) {
        setStepMsg(steps[stepIndex]);
      }
    }, 850);

    try {
      const response = await fetch(`/api/tenders/${tender.id}/documents/summarize`, {
        method: "POST",
        headers: getAuthHeaders({ "Content-Type": "application/json" }),
        body: JSON.stringify({
          documentName: doc.name,
          documentUrl: doc.url
        })
      });

      if (!response.ok) {
        throw new Error(`Server returned error: ${response.status}`);
      }

      const data = await response.json();
      setSummary(data);
    } catch (err: any) {
      console.error("Failed to summarize document:", err);
      setError("Unable to analyze selected procurement file. Please try again.");
    } finally {
      clearInterval(interval);
      setLoading(false);
    }
  };

  const handleToggleCheck = (item: string) => {
    setCheckedItems(prev => ({
      ...prev,
      [item]: !prev[item]
    }));
  };

  const handleToggleAllCheck = () => {
    if (!summary || !summary.complianceChecklist) return;
    const allChecked = summary.complianceChecklist.every(item => !!checkedItems[item]);
    const nextState: { [key: string]: boolean } = {};
    if (!allChecked) {
      summary.complianceChecklist.forEach(item => {
        nextState[item] = true;
      });
    }
    setCheckedItems(nextState);
  };

  // Default selection of the first document on mount if available
  useEffect(() => {
    if (tender.documents && tender.documents.length > 0 && !selectedDoc && !summary && !loading) {
      handleSummarize(tender.documents[0]);
    }
  }, [tender.id]);

  return (
    <div id="procurement-document-summarizer" className="bg-white border border-slate-250 rounded-xl overflow-hidden shadow-sm">
      {/* Header Banner */}
      <div className="bg-slate-900 text-white px-6 py-4 flex flex-col sm:flex-row justify-between items-start sm:items-center gap-3">
        <div className="flex items-center space-x-2">
          <Layers className="w-5 h-5 text-blue-400 animate-pulse" />
          <div>
            <h4 className="text-sm font-bold tracking-tight uppercase">
              Gemini Document Summarizer
            </h4>
            <p className="text-[11px] text-slate-300 font-normal">
              Parse linked procurement PDFs to instantly extract deadlines, statutory terms, and check compliance schemas
            </p>
          </div>
        </div>
      </div>

      <div className="p-6 grid lg:grid-cols-5 gap-6">
        {/* Document Selection Side Panel */}
        <div className="lg:col-span-2 space-y-4 lg:border-r lg:border-slate-100 pr-0 lg:pr-6">
          <div className="space-y-1">
            <span className="text-xs font-bold text-slate-800 uppercase tracking-wider block">Available Tender Files</span>
            <p className="text-[11px] text-slate-400 leading-normal">
              Select one of the linked attachments below to process it through the Gemini analyzer.
            </p>
          </div>

          <div className="space-y-2.5">
            {tender.documents && tender.documents.length > 0 ? (
              tender.documents.map((doc, idx) => {
                const isSelected = selectedDoc?.name === doc.name;
                return (
                  <button
                    key={idx}
                    onClick={() => handleSummarize(doc)}
                    disabled={loading}
                    className={`w-full text-left p-3.5 rounded-xl border transition-all flex items-start gap-3 cursor-pointer ${
                      isSelected
                        ? "bg-blue-50/50 border-blue-200 shadow-sm"
                        : "bg-slate-50/55 border-slate-200/80 hover:bg-slate-50 hover:border-slate-300"
                    }`}
                  >
                    <FileText className={`w-4 h-4 mt-0.5 shrink-0 ${isSelected ? "text-blue-600" : "text-slate-400"}`} />
                    <div className="space-y-0.5">
                      <span className={`text-xs font-bold block ${isSelected ? "text-blue-900" : "text-slate-700"}`}>
                        {doc.name}
                      </span>
                      <span className="text-[10px] text-slate-400 font-mono uppercase tracking-wide block">
                        Format: PDF • Class: {doc.type}
                      </span>
                    </div>
                  </button>
                );
              })
            ) : (
              <div className="text-center py-8 border border-dashed border-slate-200 rounded-xl bg-slate-50/50 animate-pulse">
                <Clock className="w-8 h-8 text-slate-300 mx-auto mb-2" />
                <span className="text-xs text-slate-400 font-mono block">No direct attachments linked.</span>
              </div>
            )}
          </div>
        </div>

        {/* Output Section */}
        <div className="lg:col-span-3 min-h-[300px] flex flex-col relative justify-center bg-slate-50/20 rounded-xl border border-slate-150 p-5 overflow-hidden">
          <AnimatePresence mode="wait">
            {loading ? (
              <motion.div
                key="loading"
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                className="absolute inset-0 bg-slate-50/95 flex flex-col items-center justify-center text-center p-6 z-10 space-y-4"
              >
                <div className="relative">
                  <div className="w-12 h-12 rounded-full border-4 border-slate-200 border-t-blue-600 animate-spin"></div>
                  <Sparkles className="w-5 h-5 text-indigo-500 absolute top-3.5 left-3.5 animate-bounce" />
                </div>
                <div className="space-y-1">
                  <h5 className="text-xs font-bold text-slate-800 uppercase tracking-wider">AI Document Parsing Active</h5>
                  <p className="text-xs text-slate-500 font-mono italic max-w-sm mx-auto">{stepMsg}</p>
                </div>
              </motion.div>
            ) : null}
          </AnimatePresence>

          {error ? (
            <div className="text-center py-10 space-y-3">
              <AlertCircle className="w-10 h-10 text-rose-500 mx-auto animate-bounce" />
              <div className="max-w-xs mx-auto space-y-2">
                <span className="text-xs font-bold text-slate-750 uppercase">Analysis connection met obstacle</span>
                <p className="text-xs text-slate-400 leading-relaxed">{error}</p>
                {selectedDoc && (
                  <button
                    onClick={() => handleSummarize(selectedDoc)}
                    className="mt-2 text-xs bg-slate-900 hover:bg-slate-850 text-white font-bold px-3 py-1.5 rounded-lg uppercase cursor-pointer"
                  >
                    Retry Parse
                  </button>
                )}
              </div>
            </div>
          ) : summary ? (
            <motion.div
              key="result"
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              className="space-y-6"
            >
              {/* Document Header Metadata */}
              <div className="bg-white border border-slate-200 rounded-xl p-4 flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 shadow-sm">
                <div className="space-y-1">
                  <span className="bg-indigo-50 text-indigo-700 text-[9px] font-black tracking-wide px-2.5 py-0.5 rounded-full border border-indigo-150 uppercase">
                    {summary.documentType}
                  </span>
                  <h5 className="text-xs font-bold text-slate-800 font-mono">Parsed: {summary.documentName}</h5>
                </div>

                {summary.submissionDeadline && (
                  <div className="flex items-center space-x-2 text-rose-700 bg-rose-50 border border-rose-100 rounded-lg py-1.5 px-3">
                    <Calendar className="w-3.5 h-3.5 shrink-0 animate-pulse" />
                    <div className="font-sans leading-none">
                      <span className="text-[8px] font-black text-rose-450 block uppercase tracking-wide">Submission Deadline</span>
                      <span className="text-[10px] font-bold font-mono">{summary.submissionDeadline}</span>
                    </div>
                  </div>
                )}
              </div>

              {/* Executive Summary Box */}
              <div className="space-y-1.5">
                <span className="text-xs font-bold text-slate-800 uppercase tracking-wider block">Document Executive Summary</span>
                <div className="bg-white border border-slate-150 rounded-xl p-4 text-xs leading-relaxed text-slate-600 shadow-sm font-medium">
                  {summary.executiveSummary}
                </div>
              </div>

              {/* Key terms list & details */}
              <div className="space-y-2.5">
                <span className="text-xs font-bold text-slate-800 uppercase tracking-wide block">Key Clauses & Regulations</span>
                <div className="grid md:grid-cols-2 gap-4">
                  {summary.keyTerms?.map((item, idx) => (
                    <div key={idx} className="bg-white border border-slate-150 p-4 rounded-xl shadow-sm space-y-1">
                      <span className="text-xs font-bold text-slate-800 block">{item.term}</span>
                      <p className="text-[11px] text-slate-500 leading-normal font-mono font-normal">{item.explanation}</p>
                    </div>
                  ))}
                  {(!summary.keyTerms || summary.keyTerms.length === 0) && (
                    <div className="text-xs text-slate-400 italic font-mono block">No specific terminology cataloged in file.</div>
                  )}
                </div>
              </div>

              {/* compliance check table */}
              <div className="space-y-2.5">
                <div className="flex items-center justify-between">
                  <div className="flex items-center space-x-2">
                    <ClipboardList className="w-4 h-4 text-slate-500" />
                    <span className="text-xs font-bold text-slate-800 uppercase tracking-wide">Statutory Bid Checklist</span>
                  </div>
                  {summary.complianceChecklist && summary.complianceChecklist.length > 0 && (
                    <button
                      type="button"
                      onClick={handleToggleAllCheck}
                      className="text-[10px] font-bold text-blue-600 hover:text-blue-800 bg-blue-50 hover:bg-blue-100 px-2 py-1 rounded transition flex items-center gap-1 cursor-pointer select-none"
                    >
                      <CheckSquare className="w-3 h-3" />
                      <span>{summary.complianceChecklist.every(item => !!checkedItems[item]) ? "Uncheck All" : "Check/Do All"}</span>
                    </button>
                  )}
                </div>
                <div className="bg-white border border-slate-150 rounded-xl overflow-hidden shadow-sm">
                  <div className="bg-slate-50 p-3 border-b border-slate-150 flex justify-between items-center">
                    <span className="text-[10px] font-bold text-slate-500 uppercase tracking-wide">Requirement Description</span>
                    <span className="text-[10px] font-bold text-slate-500 uppercase tracking-wide mr-3">Completed</span>
                  </div>
                  <div className="p-1 divide-y divide-slate-100">
                    {summary.complianceChecklist?.map((item, idx) => {
                      const isChecked = !!checkedItems[item];
                      return (
                        <div
                          key={idx}
                          onClick={() => handleToggleCheck(item)}
                          className="py-3 flex justify-between items-center gap-4 cursor-pointer hover:bg-slate-50/40 rounded px-1.5 transition"
                        >
                          <span className={`text-xs pl-1 leading-normal ${isChecked ? "text-slate-400 line-through font-normal" : "text-slate-700 font-medium"}`}>
                            {item}
                          </span>
                          <div className="mr-3 scale-110">
                            <input
                              type="checkbox"
                              checked={isChecked}
                              onChange={() => {}} // Controlled by outer clicking row
                              className="w-4 h-4 border-slate-350 text-blue-600 rounded focus:ring-blue-500 cursor-pointer"
                            />
                          </div>
                        </div>
                      );
                    })}
                    {(!summary.complianceChecklist || summary.complianceChecklist.length === 0) && (
                      <div className="text-xs text-slate-400 italic text-center py-4 block">No checklist elements mapped.</div>
                    )}
                  </div>
                </div>
              </div>
            </motion.div>
          ) : (
            <div className="text-center py-10 space-y-3">
              <FileCheck className="w-12 h-12 text-slate-300 mx-auto" />
              <div className="max-w-xs mx-auto space-y-1">
                <span className="text-xs font-bold text-slate-500 uppercase block">No Document Selected</span>
                <p className="text-[11px] text-slate-400">
                  Select a document from the left-hand rail to generate a smart, focused Gemini parsing analysis.
                </p>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
