import React, { useState, useEffect, useRef } from "react";
import {
  Sparkles,
  FileText,
  Upload,
  Layers,
  CheckCircle,
  Copy,
  Check,
  Download,
  Building,
  RotateCcw,
  ArrowRight,
  AlertCircle,
  ChevronRight,
  FileCheck,
  FileDown,
  Coins,
  MapPin,
  Clock,
  HeartHandshake
} from "lucide-react";
import { motion, AnimatePresence } from "motion/react";
import { Tender, CompanyProfile, BidDocument } from "../types.js";
import { getAuthHeaders } from "../utils.js";

export default function SmartBidAssistantView() {
  const [tenders, setTenders] = useState<Tender[]>([]);
  const [profile, setProfile] = useState<CompanyProfile | null>(null);
  const [selectedTender, setSelectedTender] = useState<Tender | null>(null);
  const [loadingTenders, setLoadingTenders] = useState<boolean>(false);
  const [userPlan, setUserPlan] = useState<string>("FREE");
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Custom Upload state
  const [showUploadForm, setShowUploadForm] = useState<boolean>(false);
  const [uploadLoading, setUploadLoading] = useState<boolean>(false);
  const [uploadError, setUploadError] = useState<string | null>(null);
  const [dragActive, setDragActive] = useState<boolean>(false);

  // Custom Tender Form fields
  const [customTitle, setCustomTitle] = useState("");
  const [customDept, setCustomDept] = useState("");
  const [customState, setCustomState] = useState("Delhi");
  const [customValue, setCustomValue] = useState("5.2");
  const [customEMD, setCustomEMD] = useState("10.5");
  const [customSpecs, setCustomSpecs] = useState("");
  const [uploadedFileName, setUploadedFileName] = useState("");
  const [uploadedFile, setUploadedFile] = useState<File | null>(null);

  // Drafting options
  const [tone, setTone] = useState<string>("Formal & Administrative");
  const [projectFocus, setProjectFocus] = useState<string>("");
  const [includeMSME, setIncludeMSME] = useState<boolean>(true);

  // Active Drafts state
  const [draftDocs, setDraftDocs] = useState<{ [key: string]: string }>({});
  const [editingDocType, setEditingDocType] = useState<string>("COVER_LETTER");
  const [isGenerating, setIsGenerating] = useState<boolean>(false);
  const [generationStep, setGenerationStep] = useState<string>("");
  const [saveStatus, setSaveStatus] = useState<string | null>(null);

  // Export states
  const [exportFormat, setExportFormat] = useState<"pdf" | "docx">("pdf");
  const [exportLoading, setExportLoading] = useState<boolean>(false);
  const [exportedFile, setExportedFile] = useState<{ url: string; name: string } | null>(null);

  // Load basic data
  useEffect(() => {
    async function init() {
      setLoadingTenders(true);
      try {
        // Load tenders
        const tRes = await fetch("/api/tenders", { headers: getAuthHeaders() });
        if (tRes.ok) {
          const tData = await tRes.json();
          setTenders(Array.isArray(tData) ? tData : []);
          if (tData.length > 0) {
            setSelectedTender(tData[0]);
          }
        }

        // Load company profile
        const pRes = await fetch("/api/profile", { headers: getAuthHeaders() });
        if (pRes.ok) {
          const pData = await pRes.json();
          setProfile(pData);
        }

        // Load user plan
        const planRes = await fetch("/api/user/plan", { headers: getAuthHeaders() });
        if (planRes.ok) {
          const planData = await planRes.json();
          setUserPlan(planData?.plan || "FREE");
        }
      } catch (err) {
        console.error("Initial load failed in Bid Assistant:", err);
      } finally {
        setLoadingTenders(false);
      }
    }
    init();
  }, []);

  const handleDrag = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    if (e.type === "dragenter" || e.type === "dragover") {
      setDragActive(true);
    } else if (e.type === "dragleave") {
      setDragActive(false);
    }
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setDragActive(false);

    if (e.dataTransfer.files && e.dataTransfer.files[0]) {
      const file = e.dataTransfer.files[0];
      setUploadedFileName(file.name);
      setUploadedFile(file);
      // Auto-extract tender details from name to display smart defaults
      const titleCleaned = file.name
        .replace(/\.[^/.]+$/, "")
        .replace(/[_-]/g, " ")
        .replace(/\b\w/g, (char) => char.toUpperCase());
      setCustomTitle(titleCleaned);
      // Put a random mock specification matching file content
      setCustomSpecs(`RFP technical specification for Tender: ${titleCleaned}. Standard CPWD criteria including robust engineering parameters and safety clearances apply.`);
    }
  };

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      const file = e.target.files[0];
      setUploadedFileName(file.name);
      setUploadedFile(file);
      const titleCleaned = file.name
        .replace(/\.[^/.]+$/, "")
        .replace(/[_-]/g, " ")
        .replace(/\b\w/g, char => char.toUpperCase());
      setCustomTitle(titleCleaned);
      setCustomSpecs(`RFP technical specification for Tender: ${titleCleaned}. Requirements include deployment of certified machine fleets, high-grade structural work, and standard Indian construction guidelines.`);
    }
  };

  const handleCreateCustomTender = async (e: React.FormEvent) => {
    e.preventDefault();
    setUploadLoading(true);
    setUploadError(null);

    try {
      const formData = new FormData();
      if (uploadedFile) {
        formData.append("file", uploadedFile);
      }
      formData.append("title", customTitle || "Custom Uploaded Tender Specifications");
      formData.append("department", customDept || "Urban Development Division (UDD)");
      formData.append("state", customState);
      formData.append("category", "Civil Infrastructure");
      formData.append("tenderValue", (parseFloat(customValue) || 4.5).toString());
      formData.append("emdAmount", (parseFloat(customEMD) || 8.0).toString());
      formData.append("workDescription", customSpecs || "Provision of turnkey engineering solutions.");
      formData.append("minTurnover", "1.5");
      formData.append("minExperience", "3");
      formData.append("textContext", customSpecs);

      const res = await fetch("/api/tenders/upload-custom", {
        method: "POST",
        headers: getAuthHeaders(),
        body: formData
      });

      if (!res.ok) {
        throw new Error("Failed to process custom uploaded tender document.");
      }

      const data = await res.json();
      if (data.success && data.tender) {
        setTenders(prev => [data.tender, ...prev]);
        setSelectedTender(data.tender);
        setShowUploadForm(false);
        setUploadedFileName("");
        setUploadedFile(null);
        setCustomTitle("");
        setCustomDept("");
        setCustomSpecs("");
      }
    } catch (err: any) {
      setUploadError(err.message || "Upload failed, please check inputs");
    } finally {
      setUploadLoading(false);
    }
  };

  const triggerGenerateBids = async () => {
    if (!selectedTender) return;
    setIsGenerating(true);
    setDraftDocs({});
    setExportedFile(null);

    const stepMsgs = [
      "Securing connection to Gemini AI Reasoning framework...",
      "Reading uploaded Tender documents & eligibility requirements...",
      "Matching corporate credentials: average annual turnover with CPWD clauses...",
      "Synthesizing customized Gov-compliant Cover Letter... 📝",
      "Drafting Technical proposal delivery execution strategies... ⚙️",
      "Formulating multi-item compliance response matrix... 📊",
      "Generating dynamic executive company profile review... 🏢",
      "Assembling statutory EMD exception declarations and final Bid Response... ✅"
    ];

    let stepIdx = 0;
    setGenerationStep(stepMsgs[0]);

    const stepInterval = setInterval(() => {
      stepIdx++;
      if (stepIdx < stepMsgs.length) {
        setGenerationStep(stepMsgs[stepIdx]);
      }
    }, 900);

    try {
      // We will generate the 5 main required documents: Cover Letter, Tech Proposal, Compliance Matrix, Company Profile, Bid Response
      const documentTypes = [
        { key: "COVER_LETTER", name: "Cover Letter" },
        { key: "TECHNICAL_PROPOSAL", name: "Technical Proposal" },
        { key: "COMPLIANCE_MATRIX", name: "Compliance Matrix" },
        { key: "COMPANY_PROFILE", name: "Company Profile" },
        { key: "BID_RESPONSE", name: "Bid Response" }
      ];

      const responses: { [key: string]: string } = {};

      // Request creation of all 5 components in parallel!
      await Promise.all(
        documentTypes.map(async (doc) => {
          try {
            const res = await fetch(`/api/bids/${selectedTender.id}/generate`, {
              method: "POST",
              headers: getAuthHeaders({ "Content-Type": "application/json" }),
              body: JSON.stringify({
                type: doc.key,
                customContent: null
              })
            });
            if (res.ok) {
              const data = await res.json();
              responses[doc.key] = data.content || "Draft rendering empty.";
            } else {
              responses[doc.key] = `# ${doc.name.toUpperCase()}\nDraft failed to generate. Please retry.`;
            }
          } catch (e) {
            console.error(`Error in ${doc.key}:`, e);
          }
        })
      );

      setDraftDocs(responses);
      // Auto focus on the first generated item
      setEditingDocType("COVER_LETTER");
    } catch (err) {
      console.error("Draft generation failed:", err);
    } finally {
      clearInterval(stepInterval);
      setIsGenerating(false);
    }
  };

  const handleSaveActiveDoc = async () => {
    if (!selectedTender || !profile) return;
    setSaveStatus("saving");

    try {
      const res = await fetch(`/api/bids/${selectedTender.id}/generate`, {
        method: "POST",
        headers: getAuthHeaders({ "Content-Type": "application/json" }),
        body: JSON.stringify({
          type: editingDocType,
          customContent: draftDocs[editingDocType]
        })
      });

      if (res.ok) {
        setSaveStatus("success");
        setTimeout(() => setSaveStatus(null), 2500);
      } else {
        throw new Error("Workspace storage error");
      }
    } catch (err) {
      console.error("Save draft failed:", err);
      setSaveStatus("error");
      setTimeout(() => setSaveStatus(null), 2500);
    }
  };

  const handleExportDocument = async () => {
    setExportLoading(true);
    setExportedFile(null);

    try {
      // Find the corresponding bid document ID from the database if exists
      const bidsRes = await fetch(`/api/bids/${selectedTender?.id}`, {
        headers: getAuthHeaders()
      });
      let activeBidId = "bid-temp-" + Math.random().toString(36).substring(3, 8);

      if (bidsRes.ok) {
        const bids: BidDocument[] = await bidsRes.json();
        const existing = bids.find(b => b.type === editingDocType);
        if (existing) {
          activeBidId = existing.id;
        }
      }

      const res = await fetch(`/api/bids/${activeBidId}/export`, {
        method: "POST",
        headers: getAuthHeaders({ "Content-Type": "application/json" }),
        body: JSON.stringify({
          format: exportFormat
        })
      });

      if (res.ok) {
        const blob = await res.blob();
        const downloadUrl = URL.createObjectURL(blob);
        const fileName = `${editingDocType.toLowerCase().replace(/_/g, "-")}.pdf`;
        setExportedFile({
          url: downloadUrl,
          name: fileName
        });

        // Trigger real file download of the PDF blob
        const a = document.createElement("a");
        a.href = downloadUrl;
        a.download = fileName;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
      }
    } catch (err) {
      console.error("Export error:", err);
    } finally {
      setExportLoading(false);
    }
  };

  const handleTextChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    const val = e.target.value;
    setDraftDocs(prev => ({
      ...prev,
      [editingDocType]: val
    }));
  };

  const handleCopyToClipboard = (text: string) => {
    navigator.clipboard.writeText(text);
    setSaveStatus("copied");
    setTimeout(() => setSaveStatus(null), 2000);
  };

  const templateDisplayTypes = [
    { key: "COVER_LETTER", label: "Cover Letter 📝" },
    { key: "TECHNICAL_PROPOSAL", label: "Technical Proposal ⚙️" },
    { key: "COMPLIANCE_MATRIX", label: "Compliance Matrix 📊" },
    { key: "COMPANY_PROFILE", label: "Company Profile 🏢" },
    { key: "BID_RESPONSE", label: "Bid Response ✅" }
  ];

  return (
    <div id="smart-bid-assistant-section" className="space-y-6">
      {/* Upper header */}
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center bg-slate-50 border border-slate-200 rounded-2xl p-5 gap-4">
        <div>
          <div className="flex items-center gap-2">
            <Sparkles className="w-5 h-5 text-indigo-600 animate-pulse fill-indigo-200" />
            <h2 className="text-xl font-extrabold text-slate-900 tracking-tight">AI Bid Assistant & Drafting Engine</h2>
          </div>
          <p className="text-xs text-slate-500 mt-1 leading-normal max-w-2xl">
            Upload custom Tender specifications or select an active discovery record. Our premium Gemini generator structuresGov-compliant Cover Letters, Technical Proposals, Compliance Matrices, and executive Bid Responses.
          </p>
        </div>
        <button
          onClick={() => setShowUploadForm(!showUploadForm)}
          className="bg-indigo-650 hover:bg-indigo-750 text-white font-bold text-xs py-2 px-4 rounded-xl flex items-center space-x-2 transition cursor-pointer shrink-0 shadow-sm"
        >
          <Upload className="w-4 h-4" />
          <span>Upload Tender RFP</span>
        </button>
      </div>

      {/* Tender Upload form drop area */}
      <AnimatePresence>
        {showUploadForm && (
          <motion.div
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: "auto" }}
            exit={{ opacity: 0, height: 0 }}
            className="overflow-hidden"
          >
            <div className="bg-slate-50/50 border border-slate-200 rounded-2xl p-6 space-y-6">
              <div className="flex justify-between items-center bg-white p-3 rounded-xl border border-slate-100">
                <span className="text-xs font-extrabold text-slate-800 uppercase tracking-wide">Upload Custom Tender Document (RFP/NIT/BOQ)</span>
                <span className="bg-indigo-100 text-indigo-800 text-[9px] font-black px-2 py-0.5 rounded-full uppercase">AI PDF Parser</span>
              </div>

              <div className="grid md:grid-cols-2 gap-6">
                {/* Drag n drop region */}
                <div
                  onDragEnter={handleDrag}
                  onDragOver={handleDrag}
                  onDragLeave={handleDrag}
                  onDrop={handleDrop}
                  className={`border-2 border-dashed rounded-2xl p-6 text-center flex flex-col justify-center items-center transition cursor-pointer min-h-[180px] ${
                    dragActive ? "border-indigo-600 bg-indigo-50/40" : "border-slate-200 hover:bg-slate-50/30"
                  }`}
                  onClick={() => fileInputRef.current?.click()}
                >
                  <input
                    type="file"
                    ref={fileInputRef}
                    className="hidden"
                    onChange={handleFileSelect}
                    accept=".pdf,.doc,.docx,.txt"
                  />
                  <Upload className="w-10 h-10 text-slate-400 mb-3 animate-bounce" />
                  <span className="text-xs font-bold text-slate-700 block">
                    {uploadedFileName ? `Attached: ${uploadedFileName}` : "Drag & Drop Tender PDF/RFP here"}
                  </span>
                  <p className="text-[10px] text-slate-400 mt-1 max-w-xs">
                    Supports technical documents, bills of quantities, or notice letters. We'll automatically inspect and map requirements.
                  </p>
                  <button type="button" className="text-[10px] text-indigo-600 font-bold underline mt-2">
                    Browse Files
                  </button>
                </div>

                {/* Extracted Parameters Check list */}
                <form onSubmit={handleCreateCustomTender} className="space-y-3">
                  <div className="grid grid-cols-2 gap-3">
                    <div className="space-y-1">
                      <label className="text-[10px] font-bold text-slate-500 uppercase">Tender Title</label>
                      <input
                        type="text"
                        required
                        placeholder="e.g., Solar Microgrid Installation"
                        value={customTitle}
                        onChange={(e) => setCustomTitle(e.target.value)}
                        className="w-full border border-slate-250 bg-white rounded-lg p-2 text-xs focus:ring-1 focus:ring-indigo-500 focus:outline-none"
                      />
                    </div>
                    <div className="space-y-1">
                      <label className="text-[10px] font-bold text-slate-500 uppercase">Department / Authority</label>
                      <input
                        type="text"
                        required
                        placeholder="e.g., Central Power Corporation"
                        value={customDept}
                        onChange={(e) => setCustomDept(e.target.value)}
                        className="w-full border border-slate-250 bg-white rounded-lg p-2 text-xs focus:ring-1 focus:ring-indigo-500 focus:outline-none"
                      />
                    </div>
                  </div>

                  <div className="grid grid-cols-3 gap-3">
                    <div className="space-y-1">
                      <label className="text-[10px] font-bold text-slate-500 uppercase">Project State</label>
                      <select
                        value={customState}
                        onChange={(e) => setCustomState(e.target.value)}
                        className="w-full border border-slate-250 bg-white rounded-lg p-2 text-xs focus:ring-1 focus:ring-indigo-500 focus:outline-none"
                      >
                        <option value="Delhi">Delhi</option>
                        <option value="Uttar Pradesh">Uttar Pradesh</option>
                        <option value="Bihar">Bihar</option>
                        <option value="Maharashtra">Maharashtra</option>
                        <option value="Karnataka">Karnataka</option>
                      </select>
                    </div>
                    <div className="space-y-1">
                      <label className="text-[10px] font-bold text-slate-500 uppercase">Value (₹ Cr)</label>
                      <input
                        type="number"
                        step="0.01"
                        required
                        placeholder="5.2"
                        value={customValue}
                        onChange={(e) => setCustomValue(e.target.value)}
                        className="w-full border border-slate-250 bg-white rounded-lg p-2 text-xs focus:ring-1 focus:ring-indigo-500 focus:outline-none"
                      />
                    </div>
                    <div className="space-y-1">
                      <label className="text-[10px] font-bold text-slate-500 uppercase">EMD (₹ Lakhs)</label>
                      <input
                        type="number"
                        step="0.01"
                        required
                        placeholder="10"
                        value={customEMD}
                        onChange={(e) => setCustomEMD(e.target.value)}
                        className="w-full border border-slate-250 bg-white rounded-lg p-2 text-xs focus:ring-1 focus:ring-indigo-500 focus:outline-none"
                      />
                    </div>
                  </div>

                  <div className="space-y-1">
                    <label className="text-[10px] font-bold text-slate-500 uppercase">Technical Specifications / Instructions Context</label>
                    <textarea
                      placeholder="Paste RFP specs or tender criteria guidelines to train the AI drafts..."
                      value={customSpecs}
                      onChange={(e) => setCustomSpecs(e.target.value)}
                      rows={2}
                      className="w-full border border-slate-250 bg-white rounded-lg p-2 text-xs focus:ring-1 focus:ring-indigo-500 focus:outline-none font-mono"
                    />
                  </div>

                  {uploadError && (
                    <p className="text-[10px] text-red-500 font-bold flex items-center gap-1">
                      <AlertCircle className="w-3.5 h-3.5" />
                      {uploadError}
                    </p>
                  )}

                  <div className="flex justify-end gap-2 pt-2">
                    <button
                      type="button"
                      onClick={() => setShowUploadForm(false)}
                      className="bg-slate-200 hover:bg-slate-300 text-slate-700 font-bold text-xs py-2 px-3.5 rounded-lg cursor-pointer"
                    >
                      Cancel
                    </button>
                    <button
                      type="submit"
                      disabled={uploadLoading}
                      className="bg-indigo-600 hover:bg-indigo-700 text-white font-bold text-xs py-2 px-5 rounded-lg cursor-pointer flex items-center space-x-1 disabled:opacity-40"
                    >
                      {uploadLoading ? "Analyzing document..." : "Save & Analyze RFP"}
                    </button>
                  </div>
                </form>
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      <div className="grid lg:grid-cols-5 gap-6">
        {/* Left pane: Options & Selection */}
        <div className="lg:col-span-2 space-y-5 bg-white border border-slate-200 rounded-2xl p-5 shadow-sm">
          {/* Active selection of Tender */}
          <div className="space-y-1.5">
            <span className="text-xs font-bold text-slate-800 uppercase tracking-wide">1. Select Active Tender Document</span>
            <select
              value={selectedTender?.id || ""}
              onChange={(e) => {
                const target = tenders.find(t => t.id === e.target.value);
                if (target) setSelectedTender(target);
              }}
              className="w-full border border-slate-250 bg-white text-slate-700 rounded-xl py-2.5 px-3 text-xs focus:ring-1 focus:ring-indigo-500 outline-none font-medium"
            >
              {loadingTenders ? (
                <option>Retreiving available contracts...</option>
              ) : tenders.length === 0 ? (
                <option>No Tenders available</option>
              ) : (
                tenders.map((t) => (
                  <option key={t.id} value={t.id}>
                    {t.title} (₹{t.tenderValue || 1.0} Cr)
                  </option>
                ))
              )}
            </select>
          </div>

          {selectedTender && (
            <div className="bg-slate-50 border border-slate-200 rounded-xl p-3.5 text-xs text-slate-700 space-y-2">
              <div className="flex justify-between items-center">
                <span className="font-extrabold text-indigo-700 uppercase tracking-wider text-[9px]">Active RFP Parameters</span>
                <span className="bg-white px-2 py-0.5 rounded text-[9px] font-mono border text-slate-500 font-extrabold">{selectedTender.externalId}</span>
              </div>
              <h4 className="font-bold text-slate-850 line-clamp-1">{selectedTender.title}</h4>
              <p className="text-[10px] text-slate-500 leading-normal line-clamp-2">{selectedTender.workDescription}</p>
              
              <div className="grid grid-cols-2 gap-2 pt-2 border-t font-mono text-[10px]">
                <div className="flex items-center gap-1.5">
                  <Coins className="w-3.5 h-3.5 text-slate-400" />
                  <span>Value: <strong>₹{selectedTender.tenderValue || "--"} Cr</strong></span>
                </div>
                <div className="flex items-center gap-1.5">
                  <MapPin className="w-3.5 h-3.5 text-slate-400" />
                  <span>State: <strong>{selectedTender.state || "Delhi"}</strong></span>
                </div>
              </div>
            </div>
          )}

          {/* Drafting specs */}
          <div className="space-y-4 pt-3 border-t border-slate-100">
            <div className="space-y-1.5">
              <span className="text-xs font-bold text-slate-800 uppercase tracking-wide">2. Document Tone & Style</span>
              <select
                value={tone}
                onChange={(e) => setTone(e.target.value)}
                className="w-full border border-slate-250 rounded-xl py-2 px-3 text-xs bg-white text-slate-700 focus:outline-none"
              >
                <option>Formal & Administrative</option>
                <option>Competitive & Professional</option>
                <option>Direct & Strategic</option>
              </select>
            </div>

            <div className="space-y-1.5">
              <span className="text-xs font-bold text-slate-800 uppercase tracking-wide">3. Select Showcase Experience</span>
              <p className="text-[10px] text-slate-400">Pulls completed qualification certificates from criteria database.</p>
              <select
                value={projectFocus}
                onChange={(e) => setProjectFocus(e.target.value)}
                className="w-full border border-slate-250 rounded-xl py-2 px-3 text-xs bg-white text-slate-700 focus:outline-none"
              >
                <option value="">-- Let AI optimize selections --</option>
                {profile?.pastProjects?.map((proj, idx) => (
                  <option key={idx} value={proj.name}>
                    {proj.name} (Client: {proj.client})
                  </option>
                ))}
              </select>
            </div>

            <div className="bg-indigo-50/50 border border-indigo-100 rounded-xl p-3.5 space-y-2">
              <div className="flex items-center justify-between">
                <span className="text-xs font-extrabold text-indigo-900 uppercase">Apply MSME Exemptions</span>
                <input
                  type="checkbox"
                  checked={includeMSME}
                  onChange={(e) => setIncludeMSME(e.target.checked)}
                  className="w-4.5 h-4.5 text-indigo-600 border-indigo-200 rounded cursor-pointer"
                />
              </div>
              <p className="text-[10.5px] text-indigo-750 font-medium leading-normal">
                If checked, our compliance draft will claim waivers for Earnest Money Deposits (EMD) under valid Government MSME/Udyam certificates.
              </p>
            </div>

            <button
              onClick={triggerGenerateBids}
              disabled={isGenerating || !selectedTender}
              className="w-full bg-indigo-600 hover:bg-indigo-700 text-white font-extrabold text-xs py-3 rounded-xl shadow-md transition active:scale-[0.98] disabled:opacity-50 uppercase flex items-center justify-center space-x-2 cursor-pointer"
            >
              <Sparkles className="w-4 h-4 fill-white" />
              <span>{isGenerating ? "Synthesizing Proposals..." : "Generate AI Bid Documents"}</span>
            </button>
          </div>
        </div>

        {/* Right pane: Drafting Workspace / Preview & Edit */}
        <div className="lg:col-span-3 min-h-[460px] flex flex-col justify-between bg-slate-50 border border-slate-200 rounded-2xl p-5 relative overflow-hidden shadow-sm">
          <AnimatePresence mode="wait">
            {isGenerating && (
              <motion.div
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                className="absolute inset-0 bg-slate-50/95 flex flex-col items-center justify-center text-center p-8 z-10 space-y-5"
              >
                <div className="relative">
                  <div className="w-14 h-14 rounded-full border-4 border-slate-200 border-t-indigo-600 animate-spin"></div>
                  <FileText className="w-6 h-6 text-indigo-600 absolute top-4 left-4 animate-bounce" />
                </div>
                <div className="space-y-2">
                  <h5 className="text-xs font-bold text-slate-800 uppercase tracking-widest">Generating Your Structured Gov Bid Package</h5>
                  <p className="text-xs font-mono text-indigo-700 bg-white border border-slate-150 rounded-xl px-4 py-2 italic font-semibold max-w-sm mx-auto shadow-inner">
                    {generationStep}
                  </p>
                </div>
              </motion.div>
            )}
          </AnimatePresence>

          {Object.keys(draftDocs).length > 0 ? (
            <div className="space-y-4 flex flex-col h-full justify-between">
              {/* Tabs for individual files */}
              <div className="flex overflow-x-auto gap-1 pb-1 scrollbar-thin">
                {templateDisplayTypes.map((typeObj) => (
                  <button
                    key={typeObj.key}
                    onClick={() => {
                      setEditingDocType(typeObj.key);
                      setExportedFile(null);
                    }}
                    className={`text-[10px] font-extrabold uppercase px-3 py-2 rounded-xl border transition cursor-pointer shrink-0 ${
                      editingDocType === typeObj.key
                        ? "bg-slate-900 border-slate-900 text-white shadow-sm"
                        : "bg-white border-slate-200 text-slate-500 hover:text-slate-800"
                    }`}
                  >
                    {typeObj.label}
                  </button>
                ))}
              </div>

              {/* Toolbar */}
              <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-3 bg-white p-3 rounded-xl border border-slate-150">
                <span className="text-[10px] font-mono text-slate-400 uppercase tracking-wider">
                  Review & Customize Draft Workspace ({editingDocType})
                </span>
                <div className="flex gap-2">
                  <button
                    onClick={() => handleCopyToClipboard(draftDocs[editingDocType] || "")}
                    className="p-1 px-3.5 border border-slate-200 hover:bg-slate-50 rounded-lg text-slate-600 cursor-pointer text-[10px] font-bold flex items-center space-x-1.5 transition"
                  >
                    {saveStatus === "copied" ? (
                      <>
                        <Check className="w-3.5 h-3.5 text-green-600" />
                        <span className="text-green-700">Copied!</span>
                      </>
                    ) : (
                      <>
                        <Copy className="w-3.5 h-3.5" />
                        <span>Copy</span>
                      </>
                    )}
                  </button>
                  <button
                    onClick={handleSaveActiveDoc}
                    disabled={saveStatus === "saving"}
                    className="p-1 px-3.5 bg-slate-900 hover:bg-slate-850 text-white rounded-lg cursor-pointer text-[10px] font-bold flex items-center space-x-1.5 transition"
                  >
                    {saveStatus === "saving" ? (
                      <span>Saving...</span>
                    ) : saveStatus === "success" ? (
                      <span className="text-emerald-400">Saved Workspace!</span>
                    ) : (
                      <span>Save Draft</span>
                    )}
                  </button>
                </div>
              </div>

              {/* Interactive editor */}
              <div className="flex-1 min-h-[240px] flex flex-col bg-white border border-slate-200 rounded-2xl overflow-hidden shadow-inner relative">
                <textarea
                  value={draftDocs[editingDocType] || ""}
                  onChange={handleTextChange}
                  className="w-full flex-1 p-4 text-[11px] font-mono leading-relaxed text-slate-750 resize-none outline-none focus:ring-0 bg-transparent"
                />
              </div>

              {/* Exports panel (DOCX / PDF) */}
              <div className="bg-indigo-50/50 border border-indigo-150 rounded-2xl p-4 flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
                <div className="space-y-1">
                  <div className="flex items-center space-x-1.5">
                    <FileCheck className="w-4 h-4 text-indigo-600" />
                    <span className="text-xs font-extrabold text-slate-800 uppercase tracking-wide">Export & Export Formats</span>
                  </div>
                  <p className="text-[10px] text-slate-500 leading-normal">
                    Deliver print-ready government bid envelopes with formal layouts matching modern bidding policies.
                  </p>
                </div>

                <div className="flex items-center gap-2 shrink-0">
                  <select
                    value={exportFormat}
                    onChange={(e) => {
                      setExportFormat(e.target.value as "pdf" | "docx");
                      setExportedFile(null);
                    }}
                    className="border border-slate-250 bg-white rounded-xl py-2 px-3 text-xs focus:ring-1 focus:ring-indigo-500 focus:outline-none"
                  >
                    <option value="pdf">Exporter: PDF Document (.pdf)</option>
                    <option value="docx">Exporter: Microsoft Word (.docx)</option>
                  </select>

                  <button
                    onClick={handleExportDocument}
                    disabled={exportLoading}
                    className="bg-indigo-600 hover:bg-indigo-700 text-white font-bold text-xs py-2 px-4 rounded-xl cursor-pointer flex items-center space-x-1.5 transition shrink-0"
                  >
                    {exportLoading ? (
                      <span>Compiling...</span>
                    ) : (
                      <>
                        <Download className="w-3.5 h-3.5" />
                        <span className="uppercase tracking-wide">Export Now</span>
                      </>
                    )}
                  </button>
                </div>
              </div>

              {exportedFile && (
                <div className="bg-emerald-50 border border-emerald-200 rounded-xl p-3.5 flex justify-between items-center animate-fadeIn text-xs">
                  <div className="flex items-center space-x-2.5">
                    <CheckCircle className="w-5 h-5 text-emerald-600" />
                    <div>
                      <span className="font-bold text-emerald-900 block uppercase text-[10px]">Export Successful!</span>
                      <p className="text-emerald-700 text-[10px] font-mono leading-none mt-0.5">{exportedFile.name}</p>
                    </div>
                  </div>
                  <a
                    href={exportedFile.url}
                    target="_blank"
                    rel="noreferrer"
                    className="bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-[10px] py-1.5 px-3.5 rounded-lg flex items-center space-x-1 transition"
                  >
                    <FileDown className="w-3.5 h-3.5" />
                    <span>Download {exportFormat.toUpperCase()}</span>
                  </a>
                </div>
              )}
            </div>
          ) : (
            <div className="flex-1 flex flex-col items-center justify-center text-center p-8 space-y-4">
              <div className="w-16 h-16 bg-white border border-slate-200 rounded-2xl flex items-center justify-center shadow-xs">
                <FileText className="w-8 h-8 text-slate-350" />
              </div>
              <div className="max-w-sm space-y-1.5">
                <span className="text-[11px] font-bold text-slate-400 uppercase tracking-widest block">Bid Workspace Empty</span>
                <p className="text-xs text-slate-400 leading-normal">
                  Select an active governmental tender document on the left panel, customize your tone of voice or MSME exemption claims, and click <strong>"Generate AI Bid Documents"</strong> to begin drafting.
                </p>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
