import React, { useState, useEffect, useRef } from "react";
import {
  Upload,
  Trash,
  HelpCircle,
  AlertCircle,
  CheckCircle,
  Check,
  FileText,
  Layers,
  Activity,
  Sparkles,
  Clock,
  ArrowUpRight,
  ShieldAlert,
  ListChecks,
  MessageSquare,
  Calendar,
  Building,
  Database,
  RefreshCw,
  RotateCcw,
  Plus
} from "lucide-react";
import { DocumentVault, DocumentVersion } from "../types.js";
import { formatDate, getAuthHeaders } from "../utils.js";
import { useFirebase } from "../FirebaseContext.js";
import { motion, AnimatePresence } from "motion/react";

const SUPPORTED_DOCS_FILTER = [
  { key: "ALL", label: "All Documents" },
  { key: "GST_CERTIFICATE", label: "GST State Registration" },
  { key: "PAN_CARD", label: "PAN Card" },
  { key: "MSME_CERTIFICATE", label: "MSME Udyam Card" },
  { key: "ISO_CERTIFICATE", label: "ISO Certificates" },
  { key: "AUDITED_FINANCIALS", label: "Balance Sheets (ITR)" },
  { key: "EXPERIENCE_CERTIFICATE", label: "Experience Certificates" },
  { key: "TECHNICAL_DOCUMENT", label: "Technical Documents" },
  { key: "OTHER", label: "Other Papers" }
];

export default function DocumentVaultView() {
  const { firebaseUser, firestoreVaultFiles, saveDocumentVaultToFirestore, deleteDocumentVaultFromFirestore } = useFirebase();
  const [vaultFiles, setVaultFiles] = useState<DocumentVault[]>([]);
  const [activeFilter, setActiveFilter] = useState("ALL");
  
  // States for uploading
  const [isUploading, setIsUploading] = useState(false);
  const [userPlan, setUserPlan] = useState<string>("FREE");
  const [documentType, setDocumentType] = useState<string>("GST_CERTIFICATE");
  const [fileName, setFileName] = useState("");
  const [expiryDate, setExpiryDate] = useState("");
  const [year, setYear] = useState("2025");
  const [dragActive, setDragActive] = useState(false);
  const [uploadError, setUploadError] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // States for the Active Selected Inspector Document
  const [selectedDoc, setSelectedDoc] = useState<DocumentVault | null>(null);
  const [inspectorTab, setInspectorTab] = useState<"summary" | "ocr" | "metadata" | "history" | "chat">("summary");
  
  // Interactive Chat State
  const [chatInput, setChatInput] = useState("");
  const [chatMessages, setChatMessages] = useState<{ sender: "user" | "ai"; text: string; time: string }[]>([]);
  const [chatLoading, setChatLoading] = useState(false);

  // Re-analysis lock state
  const [reanalyzingId, setReanalyzingId] = useState<string | null>(null);

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
      console.error("Failed to load document vault:", err);
    }
  }

  useEffect(() => {
    async function loadUserPlan() {
      try {
        const res = await fetch("/api/user/plan", {
          headers: getAuthHeaders()
        });
        if (res.ok) {
          const user = await res.json();
          setUserPlan(user?.plan || "FREE");
        }
      } catch (err) {
        console.error("Failed to load plan state in vault:", err);
      }
    }

    loadVault();
    loadUserPlan();
  }, []);

  // Sync displayed files with Firebase if authenticated
  const displayedVaultFiles = firebaseUser ? firestoreVaultFiles : vaultFiles;

  // Filter list
  const filteredVaultFiles = displayedVaultFiles.filter((f) => {
    if (activeFilter === "ALL") return true;
    return f.documentType === activeFilter;
  });

  // Countdowns & Expiry calculations
  const getExpiryStatus = (expiryStr: string | null) => {
    if (!expiryStr) return { label: "INDIFINITE", color: "text-emerald-600 bg-emerald-50 border-emerald-200" };
    const expDate = new Date(expiryStr);
    const today = new Date();
    const diffTime = expDate.getTime() - today.getTime();
    const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));

    if (diffDays < 0) {
      return { label: "EXPIRED", color: "text-red-700 bg-red-50 border-red-200", isExpired: true };
    } else if (diffDays <= 90) {
      return { label: `EXPIRES IN ${diffDays} DAYS`, color: "text-amber-700 bg-amber-50 border-amber-200", isWarning: true };
    } else {
      return { label: "VALID / ACTIVE", color: "text-emerald-700 bg-emerald-50 border-emerald-150" };
    }
  };

  const getVaultExpiryCounts = () => {
    let active = 0;
    let warning = 0;
    let expired = 0;

    displayedVaultFiles.forEach((file) => {
      const stat = getExpiryStatus(file.expiryDate);
      if (stat.isExpired) expired++;
      else if (stat.isWarning) warning++;
      else active++;
    });

    return { active, warning, expired };
  };

  const expiryStats = getVaultExpiryCounts();

  // Handling drag/drop files
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
      const droppedFile = e.dataTransfer.files[0];
      setFileName(droppedFile.name);
    }
  };

  const handleFileInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      const file = e.target.files[0];
      setFileName(file.name);
    }
  };

  // Submit Upload Action (Triggers AI scanning backend)
  const handleManualUploadSubmit = async (e: React.FormEvent, parentDocId?: string) => {
    if (e) e.preventDefault();
    if (!fileName) {
      setUploadError("Please select, write, or drop a file first.");
      setTimeout(() => setUploadError(null), 5000);
      return;
    }

    const slotLimit = userPlan === "FREE" ? 3 : (userPlan === "STARTER" ? 20 : 9999);
    if (!parentDocId && displayedVaultFiles.length >= slotLimit) {
      setUploadError(`Upload Blocked: Your active ${userPlan === "FREE" ? "Bharat (Free)" : "Starter"} Plan restricts Compliance Vault capacity to ${slotLimit} active documents. Upgrade or clear slots.`);
      setTimeout(() => setUploadError(null), 10000);
      return;
    }

    setUploadError(null);
    setIsUploading(true);
    try {
      const res = await fetch("/api/vault/upload", {
        method: "POST",
        headers: getAuthHeaders({ "Content-Type": "application/json" }),
        body: JSON.stringify({
          documentType,
          fileName,
          expiryDate,
          year,
          parentDocId // If this is a historical version upload
        }),
      });

      if (res.ok) {
        const fileNode = await res.json();
        if (fileNode && fileNode.id) {
          if (firebaseUser) {
            await saveDocumentVaultToFirestore(fileNode);
          } else {
            // Update node in state
            if (parentDocId) {
              setVaultFiles(vaultFiles.map((f) => (f.id === parentDocId ? fileNode : f)));
            } else {
              setVaultFiles([...vaultFiles, fileNode]);
            }
          }
          
          setFileName("");
          setExpiryDate("");
          
          // Focus inspector on updated document
          setSelectedDoc(fileNode);
          setInspectorTab("summary");
          setChatMessages([]);
          loadVault(); // Recalculate local list cleanly
        } else {
          setUploadError("Failure parsing server document response.");
        }
      } else {
        setUploadError("Server refused connection or encountered internal parser error.");
      }
    } catch (err) {
      console.error("Upload error:", err);
      setUploadError("Could not join document storage channel.");
    } finally {
      setIsUploading(false);
    }
  };

  // Delete Action
  const handleDelete = async (id: string) => {
    try {
      await fetch(`/api/vault/${id}`, {
        method: "DELETE",
        headers: getAuthHeaders()
      });
      if (firebaseUser) {
        await deleteDocumentVaultFromFirestore(id);
      } else {
        setVaultFiles(vaultFiles.filter((f) => f.id !== id));
      }
      if (selectedDoc?.id === id) {
        setSelectedDoc(null);
      }
      loadVault();
    } catch (err) {
      console.error("Delete failed:", err);
    }
  };

  // Trigger Manual AI Recalculation
  const handleReanalyze = async (id: string) => {
    setReanalyzingId(id);
    try {
      const res = await fetch(`/api/vault/re-analyze/${id}`, {
        method: "POST",
        headers: getAuthHeaders()
      });
      if (res.ok) {
        const updated = await res.json();
        if (firebaseUser) {
          await saveDocumentVaultToFirestore(updated);
        } else {
          setVaultFiles(vaultFiles.map((doc) => (doc.id === id ? updated : doc)));
        }
        setSelectedDoc(updated);
        loadVault();
      }
    } catch (err) {
      console.error("Re-analysis connection error:", err);
    } finally {
      setReanalyzingId(null);
    }
  };

  // Chat/QA with the selected Document
  const handleChatSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!chatInput.trim() || !selectedDoc) return;

    const userEntry = { sender: "user" as const, text: chatInput, time: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) };
    setChatMessages((prev) => [...prev, userEntry]);
    setChatInput("");
    setChatLoading(true);

    try {
      const res = await fetch("/api/vault/chat", {
        method: "POST",
        headers: getAuthHeaders({ "Content-Type": "application/json" }),
        body: JSON.stringify({
          documentId: selectedDoc.id,
          message: userEntry.text
        })
      });
      if (res.ok) {
        const data = await res.json();
        setChatMessages((prev) => [
          ...prev,
          {
            sender: "ai" as const,
            text: data.answer || "Document counsel processed response cleanly.",
            time: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
          }
        ]);
      } else {
        throw new Error("Chat response failed");
      }
    } catch (err) {
      setChatMessages((prev) => [
        ...prev,
        {
          sender: "ai" as const,
          text: "AI Counsel connection went offline. Please check your network credentials.",
          time: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
        }
      ]);
    } finally {
      setChatLoading(false);
    }
  };

  // Rollback to historical version
  const handleRestoreVersion = async (docId: string, verNo: number) => {
    try {
      const res = await fetch("/api/vault/restore-version", {
        method: "POST",
        headers: getAuthHeaders({ "Content-Type": "application/json" }),
        body: JSON.stringify({
          documentId: docId,
          versionNumber: verNo
        })
      });
      if (res.ok) {
        const revertedDoc = await res.json();
        if (firebaseUser) {
          await saveDocumentVaultToFirestore(revertedDoc);
        } else {
          setVaultFiles(vaultFiles.map((f) => (f.id === docId ? revertedDoc : f)));
        }
        setSelectedDoc(revertedDoc);
        loadVault();
      }
    } catch (err) {
      console.error("Could not complete version swap:", err);
    }
  };

  return (
    <div className="space-y-6 max-w-7xl mx-auto px-1">
      
      {/* Target Header Layout */}
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
        <div>
          <h2 className="text-2xl font-black text-slate-900 tracking-tight flex items-center gap-2">
            <Building className="w-6 h-6 text-indigo-600" />
            Bharat Compliance Document Vault
          </h2>
          <p className="text-xs text-slate-550 max-w-2xl font-medium mt-1">
            Securely save corporate licenses, GST certificates, and tax records. 
            The AI engine extracts compliance parameters, tracks expirations, and answers legal eligibility questions.
          </p>
        </div>
        
        {/* Expiry Tracking Dashboard Summary Widget */}
        <div className="flex items-center gap-2 bg-slate-900 text-white rounded-xl p-1.5 border border-slate-800 shadow-sm grow-0 shrink-0">
          <div className="px-3 py-1 text-center">
            <span className="block text-[9px] text-slate-400 font-extrabold uppercase">Valid</span>
            <span className="font-extrabold text-xs text-emerald-400">{expiryStats.active}</span>
          </div>
          <div className="h-6 w-[1px] bg-slate-800" />
          <div className="px-3 py-1 text-center">
            <span className="block text-[9px] text-slate-400 font-extrabold uppercase">Warning</span>
            <span className="font-extrabold text-xs text-amber-400">{expiryStats.warning}</span>
          </div>
          <div className="h-6 w-[1px] bg-slate-800" />
          <div className="px-3 py-1 text-center">
            <span className="block text-[9px] text-slate-400 font-extrabold uppercase">Expired</span>
            <span className="font-extrabold text-xs text-rose-400">{expiryStats.expired}</span>
          </div>
        </div>
      </div>

      {/* FILTER PILL NAVIGATION TABS */}
      <div className="flex items-center gap-2 overflow-x-auto pb-1 scrollbar-thin">
        {SUPPORTED_DOCS_FILTER.map((item) => (
          <button
            key={item.key}
            onClick={() => {
              setActiveFilter(item.key);
              if (selectedDoc && selectedDoc.documentType !== item.key && item.key !== "ALL") {
                setSelectedDoc(null);
              }
            }}
            className={`px-3 py-1.5 rounded-lg text-[11px] font-black uppercase tracking-wide border transition-all shrink-0 cursor-pointer ${
              activeFilter === item.key
                ? "bg-slate-900 text-white border-slate-900"
                : "bg-white text-slate-600 border-slate-200 hover:bg-slate-50"
            }`}
          >
            {item.label}
          </button>
        ))}
      </div>

      {/* MAIN TWO-COLUMN DASHBOARD */}
      <div className="grid lg:grid-cols-12 gap-6 items-start">
        
        {/* Left Column: List + Upload Panel (cols 7) */}
        <div className="lg:col-span-7 space-y-6">
          
          {/* UPLOAD DRAG BOX */}
          <div className="bg-white border border-slate-200 rounded-xl overflow-hidden shadow-xs">
            <div className="bg-slate-50 border-b border-slate-200 px-5 py-3 flex justify-between items-center">
              <span className="text-xs font-black text-slate-800 uppercase tracking-wider flex items-center gap-1.5">
                <Upload className="w-4 h-4 text-slate-400" />
                Upload Supporting Bid Document
              </span>
              <span className="text-[10px] font-bold text-slate-500 uppercase bg-slate-200/60 px-2.5 py-0.5 rounded border border-slate-300">
                {displayedVaultFiles.length} / {userPlan === "FREE" ? "3" : (userPlan === "STARTER" ? "20" : "∞")} SLOTS
              </span>
            </div>

            <div className="p-5 space-y-4">
              {uploadError && (
                <div className="p-3 text-xs bg-red-50 text-red-700 border border-red-200 rounded-lg flex items-center gap-2 font-medium">
                  <AlertCircle className="w-4 h-4 shrink-0 text-red-500" />
                  <span>{uploadError}</span>
                </div>
              )}

              {/* Upload Dropzone */}
              <div
                onDragEnter={handleDrag}
                onDragOver={handleDrag}
                onDragLeave={handleDrag}
                onDrop={handleDrop}
                onClick={() => fileInputRef.current?.click()}
                className={`border-2 border-dashed rounded-xl p-6 text-center cursor-pointer transition-all ${
                  dragActive ? "border-indigo-500 bg-indigo-50" : "border-slate-300 hover:border-indigo-400 hover:bg-slate-50/50"
                }`}
              >
                <div className="flex flex-col items-center space-y-2">
                  <div className="w-10 h-10 rounded-full bg-slate-100 flex items-center justify-center text-slate-500">
                    <Upload className="w-5 h-5" />
                  </div>
                  <span className="text-xs font-black text-slate-800 uppercase tracking-wide">Drag & Drop Scanned Document</span>
                  <p className="text-[10px] text-slate-500 max-w-sm leading-normal">
                    Drag PDFs or image snapshots here. The AI is trained to scan regional Indian registry paperwork.
                  </p>
                </div>

                <div className="mt-4 max-w-md mx-auto">
                  <input
                    type="text"
                    placeholder="Or type manual local file path (e.g., gst-form-06.pdf)..."
                    value={fileName}
                    onClick={(e) => e.stopPropagation()} 
                    onChange={(e) => setFileName(e.target.value)}
                    className="w-full bg-white border border-slate-200 rounded-lg px-3 py-1.5 text-xs text-center cursor-text font-semibold focus:border-indigo-500 focus:outline-none focus:ring-1 focus:ring-indigo-500"
                  />
                </div>

                <input
                  type="file"
                  ref={fileInputRef}
                  className="hidden"
                  onChange={handleFileInputChange}
                  accept=".pdf,.doc,.docx,.jpg,.png,application/pdf"
                />
              </div>

              {/* Classification Inputs Row */}
              <div className="grid md:grid-cols-3 gap-4 text-xs font-medium">
                
                <div className="flex flex-col space-y-1">
                  <label className="text-slate-500 font-extrabold uppercase tracking-wider text-[9px]">Classification Type</label>
                  <select
                    value={documentType}
                    onChange={(e) => setDocumentType(e.target.value)}
                    className="bg-white border border-slate-200 rounded-lg px-2.5 py-1.5 text-slate-700 font-bold focus:outline-none focus:ring-1 focus:ring-indigo-500"
                  >
                    <option value="GST_CERTIFICATE">GST Registration (REG-06)</option>
                    <option value="PAN_CARD">Permanent Account Number (PAN)</option>
                    <option value="MSME_CERTIFICATE">MSME Udyam Card</option>
                    <option value="ISO_CERTIFICATE">ISO Standards Certificate</option>
                    <option value="AUDITED_FINANCIALS">Audited Financials Balance Sheet</option>
                    <option value="EXPERIENCE_CERTIFICATE">Contract Work Completion Receipt</option>
                    <option value="TECHNICAL_DOCUMENT">Technical Proposal/RFP Specification</option>
                    <option value="OTHER">Other Credentials (Bank/EMD)</option>
                  </select>
                </div>

                <div className="flex flex-col space-y-1">
                  <label className="text-slate-500 font-extrabold uppercase tracking-wider text-[9px]">Financial Year (If any)</label>
                  <input
                    type="number"
                    value={year}
                    onChange={(e) => setYear(e.target.value)}
                    placeholder="e.g. 2025"
                    className="border border-slate-200 rounded-lg px-2.5 py-1 text-slate-700 font-bold"
                  />
                </div>

                <div className="flex flex-col space-y-1">
                  <label className="text-slate-500 font-extrabold uppercase tracking-wider text-[9px]">Expiry Date (Manual Entry)</label>
                  <input
                    type="date"
                    value={expiryDate}
                    onChange={(e) => setExpiryDate(e.target.value)}
                    className="border border-slate-200 rounded-lg px-2 py-1 text-slate-700 font-mono font-bold"
                  />
                </div>

              </div>

              <button
                type="button"
                onClick={(e) => handleManualUploadSubmit(e)}
                disabled={isUploading}
                className="w-full bg-slate-900 hover:bg-slate-800 text-white font-extrabold text-xs uppercase tracking-wider py-2.5 rounded-xl transition-all flex items-center justify-center gap-2 disabled:opacity-55 cursor-pointer h-10 shadow-xs"
              >
                {isUploading ? (
                  <>
                    <RefreshCw className="w-4 h-4 animate-spin text-white" />
                    <span>Processing Document Scan on Gemini...</span>
                  </>
                ) : (
                  <>
                    <Sparkles className="w-4 h-4 text-amber-400" />
                    <span>Scan and Categorize Certificate with AI</span>
                  </>
                )}
              </button>

            </div>
          </div>

          {/* FILED DOCUMENTS DIRECTORY */}
          <div className="bg-white border border-slate-205 rounded-xl p-5 shadow-xs space-y-3">
            <div className="flex items-center justify-between border-b border-slate-100 pb-2.5">
              <span className="text-xs font-black text-slate-800 uppercase tracking-wider flex items-center gap-1">
                <Database className="w-4 h-4 text-indigo-500" />
                Secured Stored Certificates ({filteredVaultFiles.length})
              </span>
              <span className="text-[10.5px] font-bold text-slate-400">
                Filter: <strong className="text-indigo-600 font-black">{activeFilter}</strong>
              </span>
            </div>

            <div className="divide-y divide-slate-150">
              {filteredVaultFiles.map((file) => {
                const ageInfo = getExpiryStatus(file.expiryDate);
                const isSelected = selectedDoc?.id === file.id;

                return (
                  <div
                    key={file.id}
                    onClick={() => {
                      setSelectedDoc(file);
                      setInspectorTab("summary");
                      setChatMessages([]);
                    }}
                    className={`p-3.5 -mx-2 rounded-xl transition-all flex justify-between items-center text-xs cursor-pointer group ${
                      isSelected
                        ? "bg-slate-50 border border-slate-300"
                        : "hover:bg-slate-50/50"
                    }`}
                  >
                    <div className="space-y-1.5 pr-4 flex-grow">
                      <div className="flex flex-wrap items-center gap-2">
                        <span className="font-bold text-slate-900 group-hover:text-indigo-600 transition-colors">
                          {file.fileName}
                        </span>
                        <span className="bg-slate-100 text-slate-700 text-[9px] font-bold border border-slate-250 px-2 py-0.5 rounded-full uppercase col shrink-0">
                          {file.documentType.replace("_", " ")}
                        </span>
                        {file.currentVersion && file.currentVersion > 1 && (
                          <span className="bg-indigo-50 text-indigo-600 text-[8.5px] font-extrabold border border-indigo-200 px-1.5 py-0.5 rounded uppercase font-mono tracking-tighter">
                            V{file.currentVersion}
                          </span>
                        )}
                      </div>
                      
                      <div className="flex flex-wrap gap-x-4 gap-y-1 text-[10px] text-slate-550 font-medium">
                        {file.year && (
                          <span>FY: <strong className="text-slate-850">{file.year}</strong></span>
                        )}
                        <span className={`inline-flex items-center px-1.5 py-0.2 rounded font-extrabold text-[8.5px] uppercase border ${ageInfo.color}`}>
                          {ageInfo.label}
                        </span>
                        {file.createdAt && (
                          <span className="text-slate-400 font-bold uppercase tracking-wider text-[8px]">
                            Added {formatDate(file.createdAt)}
                          </span>
                        )}
                      </div>
                    </div>

                    <div className="flex items-center space-x-3 grow-0 shrink-0">
                      {/* Interactive Inspect Indicator */}
                      <span className="text-[10px] text-indigo-500 font-extrabold uppercase tracking-wide opacity-0 group-hover:opacity-100 transition-all flex items-center">
                        Inspect
                        <ArrowUpRight className="w-3.5 h-3.5 ml-0.5" />
                      </span>

                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          handleDelete(file.id);
                        }}
                        className="text-slate-300 hover:text-rose-600 p-2 hover:bg-rose-50 rounded-lg transition-all cursor-pointer inline-flex"
                      >
                        <Trash className="w-4 h-4" />
                      </button>
                    </div>
                  </div>
                );
              })}

              {filteredVaultFiles.length === 0 && (
                <div className="py-12 text-center text-slate-400 text-xs font-mono space-y-1">
                  <FileText className="w-8 h-8 mx-auto text-slate-300 stroke-1" />
                  <p>Your Document Vault directory is empty.</p>
                  <p className="text-[10px] text-slate-400 font-semibold font-sans">Upload your first compliance record above to begin scans.</p>
                </div>
              )}
            </div>
          </div>

        </div>

        {/* Right Column: AI Document Analysis Inspector (cols 5) */}
        <div className="lg:col-span-5">
          <AnimatePresence mode="wait">
            {selectedDoc ? (
              <motion.div
                key={selectedDoc.id}
                initial={{ opacity: 0, scale: 0.98 }}
                animate={{ opacity: 1, scale: 1 }}
                exit={{ opacity: 0, scale: 0.95 }}
                className="bg-white border-2 border-indigo-200/80 rounded-xl overflow-hidden shadow-md flex flex-col min-h-[580px]"
              >
                {/* Inspector Header */}
                <div className="bg-gradient-to-r from-slate-900 to-indigo-950 text-white p-5 space-y-1.5 relative">
                  <div className="absolute top-4 right-4 flex items-center gap-1.5">
                    <button
                      onClick={() => handleReanalyze(selectedDoc.id)}
                      disabled={reanalyzingId === selectedDoc.id}
                      className="border border-slate-700 bg-slate-800 hover:bg-slate-700 font-bold text-[9px] px-2 py-1 rounded-md transition-all inline-flex items-center gap-1 active:scale-95 disabled:opacity-40"
                    >
                      <RefreshCw className={`w-2.5 h-2.5 ${reanalyzingId === selectedDoc.id ? "animate-spin" : ""}`} />
                      <span>{reanalyzingId === selectedDoc.id ? "Scanning..." : "Re-Scan"}</span>
                    </button>
                  </div>

                  <span className="bg-indigo-600 font-black tracking-wider text-[8.5px] uppercase px-2.5 py-0.5 rounded-full border border-indigo-400 block w-fit">
                    AI Scan Verified
                  </span>
                  <h4 className="text-sm font-black tracking-tight uppercase max-w-[80%] truncate">
                    {selectedDoc.fileName}
                  </h4>
                  <p className="text-[10px] text-slate-300 font-medium font-mono">
                    System ID: {selectedDoc.id}
                  </p>
                </div>

                {/* INSPECTOR CATEGORIES TAB TICKER */}
                <div className="bg-slate-50 border-b border-slate-200 flex overflow-x-auto text-[10px] font-black uppercase tracking-wider shrink-0">
                  <button
                    onClick={() => setInspectorTab("summary")}
                    className={`py-3 px-3 border-b-2 font-black shrink-0 transition-colors flex items-center gap-1 cursor-pointer ${
                      inspectorTab === "summary"
                        ? "border-indigo-600 text-indigo-700 bg-white"
                        : "border-transparent text-slate-500 hover:text-slate-700"
                    }`}
                  >
                    <Activity className="w-3.5 h-3.5 text-indigo-500" />
                    AI Overview
                  </button>
                  <button
                    onClick={() => setInspectorTab("metadata")}
                    className={`py-3 px-3 border-b-2 font-black shrink-0 transition-colors flex items-center gap-1 cursor-pointer ${
                      inspectorTab === "metadata"
                        ? "border-indigo-600 text-indigo-700 bg-white"
                        : "border-transparent text-slate-500 hover:text-slate-700"
                    }`}
                  >
                    <ListChecks className="w-3.5 h-3.5 text-indigo-500" />
                    Metadata
                  </button>
                  <button
                    onClick={() => setInspectorTab("ocr")}
                    className={`py-3 px-3 border-b-2 font-black shrink-0 transition-colors flex items-center gap-1 cursor-pointer ${
                      inspectorTab === "ocr"
                        ? "border-indigo-600 text-indigo-700 bg-white"
                        : "border-transparent text-slate-500 hover:text-slate-700"
                    }`}
                  >
                    <FileText className="w-3.5 h-3.5 text-indigo-500" />
                    OCR Text
                  </button>
                  <button
                    onClick={() => setInspectorTab("history")}
                    className={`py-3 px-3 border-b-2 font-black shrink-0 transition-colors flex items-center gap-1 cursor-pointer ${
                      inspectorTab === "history"
                        ? "border-indigo-600 text-indigo-700 bg-white"
                        : "border-transparent text-slate-500 hover:text-slate-700"
                    }`}
                  >
                    <Layers className="w-3.5 h-3.5 text-indigo-500" />
                    Versions ({selectedDoc.versions?.length || 0})
                  </button>
                  <button
                    onClick={() => setInspectorTab("chat")}
                    className={`py-3 px-3 border-b-2 font-black shrink-0 transition-colors flex items-center gap-1 cursor-pointer ${
                      inspectorTab === "chat"
                        ? "border-indigo-600 text-indigo-700 bg-white"
                        : "border-transparent text-slate-500 hover:text-slate-700"
                    }`}
                  >
                    <MessageSquare className="w-3.5 h-3.5 text-indigo-500 font-extrabold animate-pulse" />
                    Ask Counsel
                  </button>
                </div>

                {/* INSPECTOR CONTEXT SPACE */}
                <div className="p-5 flex-grow overflow-y-auto max-h-[450px]">
                  
                  {/* TAB 1: SUMMARY REPORT */}
                  {inspectorTab === "summary" && (
                    <div className="space-y-4">
                      
                      <div className="border border-indigo-100 bg-indigo-50/20 p-4 rounded-xl space-y-2.5">
                        <span className="text-[10px] font-extrabold text-indigo-700 flex items-center gap-1 uppercase tracking-wider block">
                          <Sparkles className="w-3.5 h-3.5 text-amber-500" />
                          Expert AI Audit Summary
                        </span>
                        <p className="text-xs text-slate-800 leading-relaxed font-semibold">
                          {selectedDoc.aiSummary || "Scanned successfully. Full dynamic metadata audit indices compiled on database pipeline."}
                        </p>
                      </div>

                      {/* Expiry Counting and Track Warning */}
                      <div className="border border-slate-150 p-4 rounded-xl space-y-2">
                        <span className="text-[9px] font-extrabold text-slate-400 uppercase tracking-wider block">Expiry Timelines</span>
                        <div className="flex items-center justify-between text-xs font-bold text-slate-800">
                          <span className="flex items-center gap-1.5 text-slate-550">
                            <Calendar className="w-4 h-4 text-purple-500" />
                            Registry Expiry Date
                          </span>
                          <span className="font-mono">
                            {selectedDoc.expiryDate ? formatDate(selectedDoc.expiryDate) : "Indefinite / Permanent"}
                          </span>
                        </div>
                        <div className="flex justify-between items-center text-xs pt-1.5 border-t border-slate-100 font-bold">
                          <span className="text-slate-550">Evaluation Status</span>
                          <span className={`px-2 py-0.5 rounded text-[10px] uppercase font-black ${getExpiryStatus(selectedDoc.expiryDate).color}`}>
                            {getExpiryStatus(selectedDoc.expiryDate).label}
                          </span>
                        </div>
                      </div>

                      {/* Verification Status Banner */}
                      <div className="flex items-center gap-3 border border-emerald-100 bg-emerald-50/25 p-4 rounded-xl">
                        <CheckCircle className="w-5 h-5 text-emerald-600 shrink-0" />
                        <div>
                          <strong className="text-xs text-emerald-950 font-bold block uppercase tracking-wide">Verification Verified</strong>
                          <p className="text-[10px] text-slate-500 leading-normal font-semibold">
                            This document satisfies technical authority standards. No legal warnings flag active checks.
                          </p>
                        </div>
                      </div>

                      {/* Info Panel */}
                      <div className="text-[10.5px] text-slate-400 font-medium leading-normal italic text-center text-balance">
                        Tip: Open the <strong className="text-indigo-600 uppercase font-black">"Ask Counsel"</strong> tab to verify if this certificate complies with your upcoming tender proposals.
                      </div>

                    </div>
                  )}

                  {/* TAB 2: DETAILED METADATA TABLE */}
                  {inspectorTab === "metadata" && (
                    <div className="space-y-4">
                      <div className="text-xs font-black text-slate-700 uppercase tracking-wider">
                        Extracted Credential Metadata
                      </div>

                      <div className="overflow-hidden border border-slate-200 rounded-lg">
                        <table className="w-full text-left text-xs border-collapse">
                          <thead>
                            <tr className="bg-slate-50 text-slate-500 font-extrabold border-b border-slate-200 uppercase text-[9px]">
                              <th className="py-2.5 px-4 font-bold">Key Indicator</th>
                              <th className="py-2.5 px-4 font-bold">Extracted Registry Property</th>
                            </tr>
                          </thead>
                          <tbody className="divide-y divide-slate-150 font-medium text-slate-700">
                            {selectedDoc.metadata && Object.keys(selectedDoc.metadata).length > 0 ? (
                              Object.entries(selectedDoc.metadata).map(([key, val]) => (
                                <tr key={key} className="hover:bg-slate-50/40">
                                  <td className="py-3 px-4 font-bold text-slate-800">
                                    {key}
                                  </td>
                                  <td className="py-3 px-4 text-slate-600 font-mono text-[11px] font-bold">
                                    {val}
                                  </td>
                                </tr>
                              ))
                            ) : (
                              <tr>
                                <td colSpan={2} className="py-6 text-center text-slate-400 font-medium italic text-[11px]">
                                  No metadata parameters extracted. Click Re-Scan to analyze.
                                </td>
                              </tr>
                            )}
                          </tbody>
                        </table>
                      </div>
                    </div>
                  )}

                  {/* TAB 3: COMPLETE OCR parsed output TEXT */}
                  {inspectorTab === "ocr" && (
                    <div className="space-y-2">
                      <div className="text-xs font-black text-slate-700 uppercase tracking-wider flex justify-between items-center">
                        <span>Digital Parsed OCR Log</span>
                        <span className="text-[10px] text-indigo-600 font-bold capitalize">Simulated via scan</span>
                      </div>
                      <div className="bg-slate-900 text-slate-350 p-4 rounded-xl text-[10px] font-mono leading-normal overflow-x-auto border border-slate-800 shadow-inner h-[320px] whitespace-pre-wrap">
                        {selectedDoc.ocrText || `Simulated standard parsed logs for ${selectedDoc.fileName}.`}
                      </div>
                    </div>
                  )}

                  {/* TAB 4: COMPLETE VERSIONING & ARCHIVED COPIES HISTORY */}
                  {inspectorTab === "history" && (
                    <div className="space-y-4">
                      
                      {/* Upload new version to this specific node */}
                      <div className="bg-slate-50 p-4 border border-slate-200 rounded-xl space-y-3">
                        <span className="text-[10.5px] font-black text-slate-700 uppercase tracking-wide flex items-center gap-1">
                          <Plus className="w-3.5 h-3.5 text-indigo-600" />
                          Commit New File Version
                        </span>
                        <div className="flex gap-2">
                          <input
                            type="text"
                            placeholder="Version file designation..."
                            value={fileName}
                            onChange={(e) => setFileName(e.target.value)}
                            className="bg-white border border-slate-250 rounded px-2.5 py-1 text-xs font-semibold flex-grow"
                          />
                          <button
                            onClick={(e) => handleManualUploadSubmit(e, selectedDoc.id)}
                            className="bg-indigo-600 hover:bg-indigo-700 text-white font-bold text-[10px] uppercase tracking-wide px-3 rounded text-center transition-all cursor-pointer inline-flex items-center shadow-xs"
                          >
                            Upload Version
                          </button>
                        </div>
                        <p className="text-[9px] text-slate-450 italic font-medium">
                          Commiting archives moving current V{selectedDoc.currentVersion || 1} into background backups, activating new files seamlessly.
                        </p>
                      </div>

                      <div className="text-xs font-black text-slate-700 uppercase tracking-wider">
                        Archived Version Stack ({selectedDoc.versions?.length || 0})
                      </div>

                      <div className="space-y-3">
                        {selectedDoc.versions && selectedDoc.versions.length > 0 ? (
                          selectedDoc.versions.map((ver, idx) => (
                            <div key={idx} className="border border-slate-200 p-3 rounded-lg flex items-center justify-between bg-white text-xs">
                              <div className="space-y-1">
                                <div className="flex items-center gap-1.5">
                                  <span className="font-extrabold text-indigo-700 font-mono">V{ver.versionNumber}</span>
                                  <span className="font-bold text-slate-850 truncate max-w-[200px]">{ver.fileName}</span>
                                </div>
                                <div className="text-[10px] text-slate-400 font-medium">
                                  Archived on {formatDate(ver.createdAt)}
                                </div>
                              </div>
                              <button
                                onClick={() => handleRestoreVersion(selectedDoc.id, ver.versionNumber)}
                                className="inline-flex items-center gap-1 bg-white hover:bg-slate-50 border border-slate-300 text-slate-700 font-extrabold text-[10px] px-2.5 py-1 rounded transition-all active:scale-95 cursor-pointer"
                              >
                                <RotateCcw className="w-3 h-3 text-indigo-600" />
                                <span>Restore</span>
                              </button>
                            </div>
                          ))
                        ) : (
                          <div className="p-8 text-center text-slate-400 text-xs italic font-medium border border-dashed rounded-lg">
                            No older versions archived. Upload a revised copy above.
                          </div>
                        )}
                      </div>

                    </div>
                  )}

                  {/* TAB 5: AI LEGAL COUNSEL CHAT VIEW */}
                  {inspectorTab === "chat" && (
                    <div className="flex flex-col h-[320px]">
                      
                      {/* Chats panel */}
                      <div className="flex-grow overflow-y-auto space-y-3.5 pr-1 pb-4 scrollbar-thin">
                        <div className="bg-slate-50 p-2.5 rounded-lg border border-slate-200 text-[10.5px] leading-relaxed text-slate-650 font-medium">
                          <strong>💡 AI Counsel Guide:</strong> Query any specific terms about this draft. 
                          <em> E.g., "Verify matches for Class A registration limits" or "Check if valid until Nov 2026."</em>
                        </div>

                        {chatMessages.map((msg, index) => (
                          <div
                            key={index}
                            className={`flex flex-col max-w-[85%] rounded-xl p-3 text-xs gap-1 font-semibold leading-relaxed ${
                              msg.sender === "user"
                                ? "bg-slate-900 border border-slate-800 text-white ml-auto"
                                : "bg-indigo-50/50 border border-indigo-155 text-slate-900 mr-auto"
                            }`}
                          >
                            <p>{msg.text}</p>
                            <span className="text-[8px] opacity-60 self-end font-mono">{msg.time}</span>
                          </div>
                        ))}

                        {chatLoading && (
                          <div className="bg-slate-50 border border-slate-200 text-slate-500 rounded-lg p-3 text-xs font-medium mr-auto animate-pulse flex items-center gap-2">
                            <RefreshCw className="w-3 h-3 animate-spin text-indigo-500" />
                            <span>AI Counsel is scanning indices...</span>
                          </div>
                        )}
                      </div>

                      {/* Chat Input form footer */}
                      <form onSubmit={handleChatSubmit} className="flex gap-2 border-t border-slate-100 pt-3 mt-auto shrink-0">
                        <input
                          type="text"
                          placeholder="Type query to expert counsel..."
                          value={chatInput}
                          onChange={(e) => setChatInput(e.target.value)}
                          className="flex-grow border border-slate-200 rounded-lg px-3 py-1.5 text-xs font-semibold focus:border-indigo-500 focus:outline-none"
                        />
                        <button
                          type="submit"
                          disabled={!chatInput.trim()}
                          className="bg-indigo-600 hover:bg-indigo-700 text-white font-extrabold text-[10.5px] px-3 rounded uppercase transition-all disabled:opacity-50 cursor-pointer h-8 shadow-xs"
                        >
                          Send
                        </button>
                      </form>

                    </div>
                  )}

                </div>

                {/* Footer file accessor check link */}
                <div className="bg-slate-50 border-t border-slate-200 p-4 flex justify-between items-center text-xs shrink-0">
                  <span className="text-[10px] text-slate-400 font-bold uppercase tracking-wide">Secure Document Storage</span>
                  <a
                    href={selectedDoc.s3Url}
                    target="_blank"
                    referrerPolicy="no-referrer"
                    rel="noopener noreferrer"
                    className="inline-flex items-center text-indigo-600 hover:text-indigo-800 font-extrabold uppercase text-[10px] transition-all hover:translate-x-0.5"
                  >
                    <span>Fetch original PDF</span>
                    <ArrowUpRight className="w-3.5 h-3.5 ml-0.5" />
                  </a>
                </div>

              </motion.div>
            ) : (
              <motion.div
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                className="bg-slate-100 border-2 border-dashed border-slate-300 rounded-xl p-8 text-center text-slate-400 text-xs font-mono h-[550px] flex flex-col items-center justify-center space-y-2.5 shadow-sm"
              >
                <HelpCircle className="w-12 h-12 text-slate-350 stroke-1" />
                <p className="font-sans font-black text-slate-700 uppercase tracking-wide">Document Scanner Standby</p>
                <p className="max-w-[280px] leading-relaxed mx-auto font-sans font-medium text-slate-450 text-[10px]">
                  Click on any filed record in your compliance vault directory to inspect computed OCR text, version details, and triggers.
                </p>
              </motion.div>
            )}
          </AnimatePresence>
        </div>

      </div>

    </div>
  );
}
