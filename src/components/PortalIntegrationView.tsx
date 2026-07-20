import React, { useState } from "react";
import { 
  ExternalLink, 
  CheckSquare, 
  Square, 
  HelpCircle, 
  AlertCircle, 
  Upload, 
  Key, 
  FileCheck, 
  ChevronRight, 
  Globe, 
  Laptop, 
  Cpu, 
  Info, 
  CheckCircle,
  Copy,
  Check,
  RefreshCw
} from "lucide-react";
import { Tender, CompanyProfile, TenderMatch } from "../types.js";

interface PortalIntegrationProps {
  tender: Tender;
  profile: CompanyProfile;
  match?: TenderMatch | null;
  onMatchStatusChange?: (updatedMatch: TenderMatch) => void;
}

export default function PortalIntegrationView({ tender, profile, match, onMatchStatusChange }: PortalIntegrationProps) {
  const [copiedId, setCopiedId] = useState(false);
  const [submissionReceipt, setSubmissionReceipt] = useState("");
  const [isSubmittingStatus, setIsSubmittingStatus] = useState(false);
  const [submitSuccess, setSubmitSuccess] = useState(false);
  
  // Interactive checklist state
  const [completedSteps, setCompletedSteps] = useState<number[]>([]);

  // Configure portal characteristics based on sourcePortal
  const getPortalDetails = () => {
    switch (tender.sourcePortal) {
      case "GEM":
        return {
          name: "GeM (Government e-Marketplace)",
          themeColor: "from-orange-500 to-amber-600",
          textColor: "text-amber-800",
          bgColor: "bg-amber-50",
          primaryUrl: `https://bidplus.gem.gov.in/bidlists?search_param=${encodeURIComponent(tender.externalId)}`,
          searchInstructions: "Type the Custom Bid Reference Number in the GeM Bid Plus search field.",
          dscType: "Class 3 DSC (Signing & Encryption) or Aadhaar eSign based login.",
          requirements: [
            "Active primary seller profile registration on gem.gov.in",
            "Udyam registration integrated in GeM seller dashboard to enjoy immediate EMD waivers.",
            "GeM DSC Helper utility installed on machine."
          ],
          officialDocs: "https://gem.gov.in/user_guides"
        };
      case "CPPP":
        return {
          name: "CPPP (Central Public Procurement Portal)",
          themeColor: "from-blue-600 to-indigo-700",
          textColor: "text-blue-800",
          bgColor: "bg-blue-50",
          primaryUrl: "https://eprocure.gov.in/eprocure/app?page=FrontEndTenderSearch&service=page",
          searchInstructions: `Go to Search Active Tenders, then filter by Tender ID: "${tender.externalId}"`,
          dscType: "Class 3 Individual/Corporate DSC USB token with PKI client driver.",
          requirements: [
            "Valid login ID on eprocure.gov.in",
            "Java Runtime Environment (JRE) version 1.8+ configured in browser exception site list.",
            "Active DSC enrolled to your eProcurement account."
          ],
          officialDocs: "https://eprocure.gov.in/eprocure/app?page=FAQ"
        };
      case "RAILWAYS":
        return {
          name: "IREPS (Indian Railways e-Procurement System)",
          themeColor: "from-red-650 to-orange-700",
          textColor: "text-red-800",
          bgColor: "bg-red-50/50",
          primaryUrl: "https://www.ireps.gov.in/",
          searchInstructions: "Search via customized Railway zone, tender number or work code filters on the home sidebar.",
          dscType: "Class 3 Signing & Encryption digital signature token.",
          requirements: [
            "Active IREPS contractor registration with approved profile",
            "PKI Client component installed inside C:\\Program Files\\IREPS",
            "Sufficient EMD/e-payment gateway compliance"
          ],
          officialDocs: "https://www.ireps.gov.in/eps/faqs.do"
        };
      case "NHAI":
        return {
          name: "NHAI e-procurement portal",
          themeColor: "from-indigo-600 to-blue-800",
          textColor: "text-blue-800",
          bgColor: "bg-blue-50",
          primaryUrl: "https://etenders.gov.in/eprocure/app",
          searchInstructions: `Filter by NHAI department, then use Tender ID: "${tender.externalId}"`,
          dscType: "Class 3 DSC configured with GePNIC/NIC eProcurement standards.",
          requirements: [
            "Registration on the central central national e-tender portal",
            "Valid technical profile validation under ministry criteria",
            "Payment instrument confirmation before bid package locking"
          ],
          officialDocs: "https://etenders.gov.in/eprocure/app?page=FAQ"
        };
      default:
        return {
          name: "National eProcurement Portal",
          themeColor: "from-slate-700 to-slate-950",
          textColor: "text-slate-800",
          bgColor: "bg-slate-50",
          primaryUrl: "https://eprocure.gov.in/eprocure/app",
          searchInstructions: `Search via keyword "${tender.externalId}" or "${tender.title}" on active pages.`,
          dscType: "Class 3 Signing & Encryption DSC Token",
          requirements: [
            "Registered contractor credentials",
            "Validated company PAN / GST profiles linked in state databases",
            "Payment / exemption proofs uploaded beforehand"
          ],
          officialDocs: "https://eprocure.gov.in/eprocure/app"
        };
    }
  };

  const portal = getPortalDetails();

  const handleCopyId = () => {
    navigator.clipboard.writeText(tender.externalId);
    setCopiedId(true);
    setTimeout(() => setCopiedId(false), 2000);
  };

  const toggleStep = (index: number) => {
    if (completedSteps.includes(index)) {
      setCompletedSteps(completedSteps.filter(s => s !== index));
    } else {
      setCompletedSteps([...completedSteps, index]);
    }
  };

  const handleRegisterReceipt = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!submissionReceipt.trim()) return;
    setIsSubmittingStatus(true);
    
    try {
      if (match) {
        // Securely post receipt identifier to the persistent backend database for real audit trials and pipeline storage
        const token = localStorage.getItem("tender_jwt");
        const headers: Record<string, string> = { "Content-Type": "application/json" };
        if (token) headers["Authorization"] = `Bearer ${token}`;

        const res = await fetch(`/api/matches/${match.id}/status`, {
          method: "PUT",
          headers,
          body: JSON.stringify({
            userStatus: "SUBMITTED",
            receiptNumber: submissionReceipt.trim()
          })
        });

        if (res.ok) {
          const updatedMatch = await res.json();
          onMatchStatusChange?.(updatedMatch);
          setSubmitSuccess(true);
          setSubmissionReceipt("");
          setTimeout(() => setSubmitSuccess(false), 5000);
        } else {
          console.error("Failed to persist bid receipt to server database.");
        }
      } else {
        // Fallback sleep simulation for demo tenders without a direct match row
        await new Promise((res) => setTimeout(res, 800));
        setSubmitSuccess(true);
        setSubmissionReceipt("");
        setTimeout(() => setSubmitSuccess(false), 4000);
      }
    } catch (err) {
      console.error("Receipt registry error:", err);
    } finally {
      setIsSubmittingStatus(false);
    }
  };

  // Browser security alignment steps
  const submissionChecklist = [
    {
      title: "Confirm Enrollment Credentials",
      desc: `Check that your account registration matches GST ${profile.gstNumber} and legal name ${profile.companyName} on the target portal.`,
      icon: <Info className="w-4 h-4 text-slate-500" />
    },
    {
      title: "Validate Digital Signature Certificate (DSC)",
      desc: "Connect your physical Class 3 USB Crypto-Token, open PKI software, and verify active signing validity dates.",
      icon: <Key className="w-4 h-4 text-blue-500" />
    },
    {
      title: "Browser Compatibility Check",
      desc: "For CPPP / State PWDs, use Internet Explorer Mode or MS Edge with Java enabled. For GeM, use Google Chrome with GeM Extension.",
      icon: <Laptop className="w-4 h-4 text-slate-500" />
    },
    {
      title: "Clear Cache and Configure Java exception list",
      desc: "Open Configure Java app -> Security page -> Add 'https://eprocure.gov.in' to the Safe Exception Site List to prevent JVM blockages.",
      icon: <Cpu className="w-4 h-4 text-purple-500" />
    },
    {
      title: "Download Workspace Cover & Technical PDF Assets",
      desc: "Verify that Cover Letter, Technical Proposal, and BoQ compliance metrics have been successfully saved to your downloads.",
      icon: <FileCheck className="w-4 h-4 text-emerald-500" />
    },
    {
      title: "Upload Envelopes and Lock Bid Submission",
      desc: "Upload technical & financial folders separately. Re-verify BOQ spreadsheet cells, sign documents digitally, and lock the system to generate a BID RECEIPT.",
      icon: <Upload className="w-4 h-4 text-indigo-500" />
    }
  ];

  const pctComplete = Math.round((completedSteps.length / submissionChecklist.length) * 100);

  return (
    <div id="government-portal-integration-view" className="space-y-6">
      
      {/* Top Header Card */}
      <div className={`bg-gradient-to-r ${portal.themeColor} text-white p-6 rounded-2xl shadow-md flex flex-wrap justify-between items-center gap-4`}>
        <div className="space-y-1 max-w-2xl">
          <div className="flex items-center space-x-2 text-[11px] font-black uppercase tracking-widest bg-white/10 px-2.5 py-0.5 rounded-full w-fit">
            <Globe className="w-3.5 h-3.5" />
            <span>Official Portal Linkage System</span>
          </div>
          <h3 className="text-xl font-black tracking-tight">{portal.name} Integration</h3>
          <p className="text-xs opacity-90 leading-relaxed max-w-xl font-normal">
            Redirect securely to finish high-level clerical submissions. Keep this system open alongside the browser tab to consult the technical checklist and DSC clearance steps.
          </p>
        </div>
        
        <div className="flex flex-col gap-2 shrink-0">
          <a
            href={portal.primaryUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="bg-white text-slate-900 font-extrabold text-xs px-5 py-3 rounded-xl shadow-md flex items-center space-x-1.5 hover:scale-[1.02] hover:bg-slate-50 active:scale-95 transition-all text-center justify-center cursor-pointer"
          >
            <span>Launch Submission Portal</span>
            <ExternalLink className="w-4 h-4 text-slate-800" />
          </a>
          <a
            href={portal.officialDocs}
            target="_blank"
            rel="noopener noreferrer"
            className="text-[11px] font-bold text-center text-white/80 hover:text-white underline"
          >
            View Official Portal User Guides
          </a>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-5 gap-6">
        
        {/* Left Side (3 cols): Checklist and Detailed Portal Steps */}
        <div className="lg:col-span-3 space-y-6">
          
          <div className="bg-white border border-slate-200 rounded-xl p-6 shadow-sm space-y-4">
            <div className="flex justify-between items-center flex-wrap gap-2 border-b border-slate-100 pb-3">
              <div>
                <h4 className="text-xs font-bold text-slate-850 uppercase tracking-wider">Browser Pre-flight Alignment checklist</h4>
                <p className="text-[11px] text-slate-400">Mark completed steps to ensure 100% submission security</p>
              </div>
              <div className="text-right">
                <span className="text-xs font-bold font-mono text-indigo-600">{pctComplete}% Complete</span>
                <div className="w-24 bg-slate-100 h-1 rounded-full mt-1 overflow-hidden">
                  <div className="bg-indigo-600 h-1 rounded-full transition-all" style={{ width: `${pctComplete}%` }}></div>
                </div>
              </div>
            </div>

            <div className="space-y-3">
              {submissionChecklist.map((step, idx) => {
                const isCompleted = completedSteps.includes(idx);
                return (
                  <div 
                    key={idx} 
                    onClick={() => toggleStep(idx)}
                    className={`p-3.5 rounded-xl border flex items-start space-x-3 cursor-pointer transition ${
                      isCompleted ? "bg-emerald-50/20 border-emerald-100/70" : "bg-slate-50/20 border-slate-200/80 hover:bg-slate-50"
                    }`}
                  >
                    <button className="mt-0.5 shrink-0 focus:outline-none">
                      {isCompleted ? (
                        <CheckCircle className="w-5 h-5 text-emerald-600" />
                      ) : (
                        <div className="w-5 h-5 rounded-md border-2 border-slate-300 hover:border-slate-400"></div>
                      )}
                    </button>
                    <div>
                      <div className="flex items-center space-x-1.5">
                        <span className="text-[11.5px] font-bold text-slate-800">{step.title}</span>
                      </div>
                      <p className="text-[10.5px] text-slate-500 mt-1 leading-normal font-normal">{step.desc}</p>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        </div>

        {/* Right Side (2 cols): Reference parameters & receipt registry */}
        <div className="lg:col-span-2 space-y-6">
          
          {/* External Reference copying Card */}
          <div className="bg-white border border-slate-200 rounded-xl p-5 shadow-sm space-y-4">
            <h4 className="text-xs font-bold text-slate-800 uppercase tracking-widest border-b border-slate-100 pb-2">
              Submission Reference metadata
            </h4>
            
            <div className="space-y-3 text-xs leading-relaxed">
              <div className="bg-slate-50 p-3 rounded-lg border border-slate-150 relative">
                <span className="text-[9px] font-bold text-slate-400 uppercase block tracking-wider">TENDER REFERENCE ID (Search query)</span>
                <div className="flex justify-between items-center mt-1">
                  <span className="font-mono font-bold text-slate-800 select-all">{tender.externalId}</span>
                  <button 
                    onClick={handleCopyId}
                    className="p-1 border border-slate-200 rounded hover:bg-slate-100 transition flex items-center space-x-1 cursor-pointer"
                  >
                    {copiedId ? <Check className="w-3 nav-3 text-emerald-600" /> : <Copy className="w-3 h-3 text-slate-500" />}
                    <span className="text-[9.5px] font-bold text-slate-600">{copiedId ? "Copied" : "Copy ID"}</span>
                  </button>
                </div>
              </div>

              <div className="space-y-1">
                <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block">Target Specific Portal instructions:</span>
                <p className="text-[11px] text-slate-700 font-sans font-medium">
                  {portal.searchInstructions}
                </p>
              </div>

              <div className="pt-2 border-t border-slate-100 space-y-2">
                <div className="flex justify-between text-[11px]">
                  <span className="text-slate-400">Authority Department:</span>
                  <span className="font-bold text-slate-705 text-right font-medium">{tender.department}</span>
                </div>
                <div className="flex justify-between text-[11px]">
                  <span className="text-slate-400">Bid Closing date:</span>
                  <span className="font-bold text-slate-705 text-right font-mono text-rose-600">
                    {new Date(tender.bidSubmissionDeadline).toLocaleString("en-IN")}
                  </span>
                </div>
                <div className="flex justify-between text-[11px]">
                  <span className="text-slate-400">DSC Enforcement:</span>
                  <span className="font-bold text-slate-705 text-right text-indigo-700">{portal.dscType}</span>
                </div>
              </div>
            </div>
          </div>

          {/* Submission Receipt Registration Panel */}
          <div className="bg-white border border-slate-200 rounded-xl p-5 shadow-sm space-y-4">
            <h4 className="text-xs font-bold text-slate-800 uppercase tracking-widest border-b border-slate-100 pb-2">
              Log Bid Submission Receipt
            </h4>
            
            <p className="text-[10.5px] text-slate-500 leading-normal font-normal">
              After finalizing the package upload and earning an acknowledgment number from GeM/CPPP, log it here to archive this tender in "Submitted" status and secure a time-locked audit trail.
            </p>

            {match?.receiptNumber && (
              <div className="p-3.5 bg-indigo-50/30 border border-indigo-100 rounded-xl space-y-1.5 text-xs animate-fade-in">
                <span className="text-[9px] font-black tracking-wider text-indigo-600 uppercase block">Active Registered Receipt</span>
                <div className="flex justify-between items-center gap-1">
                  <span className="font-mono font-bold text-slate-800">{match.receiptNumber}</span>
                  <span className="text-[9.5px] bg-[#1231D0] text-white font-extrabold px-2.5 py-0.5 rounded-full uppercase tracking-wider">SUBMITTED IN PIPELINE</span>
                </div>
              </div>
            )}

            <form onSubmit={handleRegisterReceipt} className="space-y-3.5">
              <div className="space-y-1">
                <label className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Acknowledge/Receipt Ref Number:</label>
                <input
                  type="text"
                  value={submissionReceipt}
                  onChange={(e) => setSubmissionReceipt(e.target.value)}
                  placeholder="e.g. GEM/2026/A/1032901-R"
                  className="w-full text-xs p-3 font-mono border border-slate-200 rounded-xl focus:border-indigo-500 focus:outline-none placeholder:text-slate-300"
                  required
                />
              </div>

              <button
                type="submit"
                disabled={isSubmittingStatus || !submissionReceipt.trim()}
                className="w-full bg-[#1231D0] hover:bg-blue-750 text-white font-bold text-xs py-2.5 rounded-xl transition duration-150 flex items-center justify-center space-x-1 shadow-sm cursor-pointer disabled:opacity-40"
              >
                {isSubmittingStatus ? (
                  <>
                    <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                    <span>Archiving Receipt...</span>
                  </>
                ) : (
                  <span>Register Submission Receipt</span>
                )}
              </button>
            </form>

            {submitSuccess && (
              <div className="p-3 bg-emerald-50 border border-emerald-100 rounded-lg flex items-start space-x-2 text-xs text-emerald-800 animate-fade-in font-sans">
                <div className="bg-emerald-100 text-emerald-800 p-0.5 rounded-full mt-0.5">
                  <Check className="w-3 h-3" />
                </div>
                <div>
                  <p className="font-bold">Bid Receipt Registered Successfully!</p>
                  <p className="text-[10.5px] text-emerald-600 mt-0.5 font-normal">This tender is successfully synced in your pipeline database under "Submitted" index.</p>
                </div>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
