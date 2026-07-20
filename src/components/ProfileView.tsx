import React, { useState } from "react";
import { 
  Plus, 
  Trash, 
  Check, 
  AlertCircle, 
  Building, 
  CreditCard, 
  Briefcase, 
  MapPin, 
  CheckCircle2, 
  HelpCircle, 
  FileCheck2, 
  TrendingUp, 
  Users, 
  Calendar,
  AlertTriangle
} from "lucide-react";
import { CompanyProfile } from "../types.js";
import { formatToLakhCrore } from "../utils.js";

interface ProfileProps {
  profile: CompanyProfile | null;
  onSave: (updated: CompanyProfile) => void;
}

export default function ProfileView({ profile, onSave }: ProfileProps) {
  if (!profile) {
    return (
      <div className="flex flex-col items-center justify-center p-12 bg-white rounded-2xl border border-slate-200">
        <div className="w-12 h-12 rounded-full bg-blue-50 flex items-center justify-center animate-spin">
          <Building className="w-6 h-6 text-[#1B4FD8]" />
        </div>
        <p className="mt-4 text-sm font-bold text-slate-700">Synchronizing database profile details...</p>
      </div>
    );
  }

  const [activeTab, setActiveTab] = useState<"basic" | "financial" | "certs" | "projects">("basic");
  
  // Local state mirroring the profile model
  const [companyName, setCompanyName] = useState(profile.companyName || "");
  const [registrationNumber, setRegistrationNumber] = useState(profile.registrationNumber || "");
  const [gstNumber, setGstNumber] = useState(profile.gstNumber || "");
  const [panNumber, setPanNumber] = useState(profile.panNumber || "");
  const [annualTurnover, setAnnualTurnover] = useState(profile.annualTurnover || 0);
  const [yearsOfExperience, setYearsOfExperience] = useState(profile.yearsOfExperience || 0);
  const [employeeCount, setEmployeeCount] = useState(profile.employeeCount || 0);
  const [msmeRegistered, setMsmeRegistered] = useState(profile.msmeRegistered || false);
  
  const [categories, setCategories] = useState<string[]>(profile.categories || []);
  const [operationalStates, setOperationalStates] = useState<string[]>(profile.states || []);
  const [certifications, setCertifications] = useState<string[]>(profile.certifications || []);
  
  const [projects, setProjects] = useState<any[]>(profile.pastProjects || []);
  const [newProject, setNewProject] = useState({ name: "", value: "", client: "", year: "" });

  const [saveStatus, setSaveStatus] = useState<string | null>(null);

  // States support in India
  const indianStates = [
    "Bihar", "Jharkhand", "Uttar Pradesh", "West Bengal", "Odisha", 
    "Delhi", "Maharashtra", "Karnataka", "Tamil Nadu", "Gujarat"
  ];
  // Standard bidder categories
  const bidderCategories = [
    "Construction", "Civil", "Roads", "Electrical", "IT Support", 
    "Water Supply", "Pipes", "Security", "Solar Systems", "Power Grid"
  ];

  const handleCheckboxToggle = (list: string[], setList: React.Dispatch<React.SetStateAction<string[]>>, val: string) => {
    if (list.includes(val)) {
      setList(list.filter((x) => x !== val));
    } else {
      setList([...list, val]);
    }
  };

  const addProject = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newProject.name || !newProject.value || !newProject.client || !newProject.year) return;

    setProjects([
      ...projects,
      {
        name: newProject.name,
        value: parseFloat(newProject.value),
        client: newProject.client,
        year: parseInt(newProject.year),
      },
    ]);
    setNewProject({ name: "", value: "", client: "", year: "" });
  };

  const removeProject = (index: number) => {
    setProjects(projects.filter((_, idx) => idx !== index));
  };

  const handleSave = () => {
    setSaveStatus("saving");
    const updatedModel: CompanyProfile = {
      ...profile,
      companyName,
      registrationNumber,
      gstNumber: gstNumber.toUpperCase(),
      panNumber: panNumber.toUpperCase(),
      annualTurnover: Number(annualTurnover),
      yearsOfExperience: Number(yearsOfExperience),
      employeeCount: Number(employeeCount),
      msmeRegistered,
      categories,
      states: operationalStates,
      certifications,
      pastProjects: projects,
    };

    onSave(updatedModel);
    setTimeout(() => {
      setSaveStatus("saved");
      setTimeout(() => setSaveStatus(null), 3000);
    }, 800);
  };

  // Profile Completeness Checklist Configuration
  const checklists = [
    { label: "Company Name", isMet: !!companyName, tab: "basic" as const, hint: "Required for bid header documents" },
    { label: "CIN Number (Corporate No.)", isMet: !!registrationNumber, tab: "basic" as const, hint: "U45201BR2015PTC024501 pattern" },
    { label: "GSTIN Certificate code", isMet: !isNaN(Number(gstNumber)) ? gstNumber.length >= 15 : gstNumber.length >= 15, tab: "basic" as const, hint: "15-digit unique identification" },
    { label: "PAN Card Registration", isMet: panNumber.length >= 10, tab: "basic" as const, hint: "10-digit tax permanent account" },
    { label: "Annual Financial Turnover", isMet: annualTurnover > 0, tab: "financial" as const, hint: "Verified in ₹ Crores" },
    { label: "Years of Experience Work", isMet: yearsOfExperience > 0, tab: "financial" as const, hint: "Used for eligibility screening" },
    { label: "Active Operational Trades", isMet: categories.length > 0, tab: "certs" as const, hint: "Used for matching AI Suggested Feed" },
    { label: "operational State Territories", isMet: operationalStates.length > 0, tab: "certs" as const, hint: "Region boundaries limits" },
    { label: "Professional Certifications", isMet: certifications.length > 0, tab: "certs" as const, hint: "E.g. ISO-9001 and vendor licenses" },
    { label: "Past Executed Projects Logs", isMet: projects.length > 0, tab: "projects" as const, hint: "At least one reference project required" },
  ];

  const metCount = checklists.filter(item => item.isMet).length;
  const completeness = Math.round((metCount / checklists.length) * 100);

  return (
    <div className="space-y-6 max-w-5xl">
      {/* Title banner matching "Sleek Interface" theme */}
      <div className="flex flex-col md:flex-row items-start md:items-center justify-between gap-4 bg-white/60 backdrop-blur-md p-6 rounded-2xl border border-white/20 shadow-sm">
        <div className="space-y-1">
          <div className="flex items-center space-x-2">
            <span className="bg-blue-50 text-[#1B4FD8] rounded-lg p-1.5 border border-blue-100">
              <Building className="w-5 h-5" />
            </span>
            <h2 className="text-xl font-bold text-slate-800 tracking-tight">Bidder Qualification Profile</h2>
          </div>
          <p className="text-xs text-slate-500 max-w-2xl leading-relaxed">
            Verify and complete your organization's criteria. Our automated compatibility engine contrasts these parameters in real-time with official CPPP, GeM & Railway SBD tenders.
          </p>
        </div>
        <div className="flex items-center space-x-3 w-full md:w-auto shrink-0">
          {saveStatus === "saving" && (
            <span className="text-xs font-bold text-blue-600 animate-pulse bg-blue-50 border border-blue-100 px-3 py-1.5 rounded-xl">Recalculating Match Matrix...</span>
          )}
          {saveStatus === "saved" && (
            <span className="inline-flex items-center space-x-1 text-xs text-emerald-600 bg-emerald-50 px-3 py-1.5 rounded-xl font-bold border border-emerald-100">
              <Check className="w-3.5 h-3.5" />
              <span>Synched to Discovery feed</span>
            </span>
          )}
          <button
            onClick={handleSave}
            className="w-full md:w-auto bg-[#1B4FD8] hover:bg-blue-700 text-white font-bold px-5 py-2.5 rounded-xl text-xs tracking-wide shadow-md shadow-blue-200 transition-all cursor-pointer"
          >
            Apply & Save Profile
          </button>
        </div>
      </div>

      {/* Structured Completeness Track Segment split into visual metric + detailed checklist */}
      <div className="grid md:grid-cols-3 gap-6 bg-white/60 backdrop-blur-md rounded-2xl border border-white/20 shadow-sm overflow-hidden">
        {/* Left Side Scoreboard */}
        <div className="p-6 bg-white/45 border-r border-slate-200/50 flex flex-col justify-between space-y-4">
          <div>
            <span className="text-[10px] font-extrabold text-slate-400 uppercase tracking-widest block">Completeness Metric</span>
            <h4 className="text-sm font-bold text-slate-700 mt-1">E-Procurement Readiness</h4>
          </div>
          <div className="flex items-center space-x-4">
            <div className="relative flex items-center justify-center">
              {/* Simple visual ring */}
              <div className="w-16 h-16 rounded-full border-4 border-slate-200 flex items-center justify-center">
                <span className="font-extrabold text-sm text-[#1B4FD8]">{completeness}%</span>
              </div>
              {/* Dynamic decorative outline */}
              <div className="absolute inset-0 rounded-full border-4 border-blue-500 border-t-transparent animate-spin duration-3000 opacity-25"></div>
            </div>
            <div>
              <span className={`text-xs font-extrabold px-2.5 py-0.5 rounded-full ${
                completeness === 100 
                  ? "bg-emerald-50 text-emerald-700 border border-emerald-100" 
                  : "bg-amber-50 text-amber-700 border border-amber-100"
              }`}>
                {completeness === 100 ? "Ready For VIP Bidding" : "Incomplete Info"}
              </span>
              <p className="text-[11px] text-slate-500 mt-1 leading-relaxed">
                {completeness === 100 
                  ? "Your profile is 100% indexed! Tender RAG summaries and AI checks are fully active." 
                  : `${10 - metCount} credential fields remain empty. This limits GeM eligibility exemption scoring.`}
              </p>
            </div>
          </div>
          {/* Progress Bar container */}
          <div className="w-full bg-slate-200 h-2 rounded-full overflow-hidden">
            <div 
              className="bg-gradient-to-r from-blue-600 to-indigo-600 h-2 rounded-full transition-all duration-500"
              style={{ width: `${completeness}%` }}
            ></div>
          </div>
        </div>

        {/* Right Side 2-Column interactive audit Checklist */}
        <div className="md:col-span-2 p-6">
          <span className="text-[10px] font-extrabold text-slate-400 uppercase tracking-widest block mb-3">Live Completeness audit</span>
          <div className="grid sm:grid-cols-2 gap-x-6 gap-y-2 text-xs">
            {checklists.map((item, idx) => (
              <button
                key={idx}
                onClick={() => setActiveTab(item.tab)}
                className="flex items-start text-left space-x-2 py-1.5 px-2.5 rounded-xl hover:bg-slate-50 transition-all text-slate-600 group cursor-pointer"
              >
                {item.isMet ? (
                  <CheckCircle2 className="w-4 h-4 text-emerald-500 shrink-0 mt-0.5" />
                ) : (
                  <AlertTriangle className="w-4 h-4 text-amber-500 shrink-0 mt-0.5 group-hover:animate-bounce" />
                )}
                <div>
                  <p className={`font-bold transition-colors ${item.isMet ? "text-slate-700" : "text-amber-700 group-hover:text-amber-800"}`}>
                    {item.label}
                  </p>
                  <p className="text-[9px] text-slate-400 mt-0.5 hidden sm:inline-block truncate leading-none max-w-[200px]">
                    {item.hint}
                  </p>
                </div>
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* Primary configuration frame */}
      <div className="grid md:grid-cols-4 gap-6 items-start">
        {/* Sleek Vertical tab rail */}
        <div className="bg-white/55 backdrop-blur-md border border-white/20 rounded-2xl overflow-hidden shadow-xs h-fit">
          <div className="p-4 bg-slate-50/50 border-b border-slate-200">
            <span className="text-[10px] font-extrabold text-slate-400 uppercase tracking-widest">Section Index</span>
          </div>
          <ul className="divide-y divide-slate-150">
            <li>
              <button
                onClick={() => setActiveTab("basic")}
                className={`w-full text-left px-5 py-4 font-bold text-xs uppercase tracking-wide flex items-center justify-between transition-all ${
                  activeTab === "basic" 
                    ? "bg-blue-50 text-[#1B4FD8] border-l-4 border-[#1B4FD8]" 
                    : "text-slate-600 hover:bg-slate-50 hover:text-slate-900"
                }`}
              >
                <div className="flex items-center space-x-2.5">
                  <Building className="w-4 h-4" />
                  <span>Corporate Identity</span>
                </div>
              </button>
            </li>
            <li>
              <button
                onClick={() => setActiveTab("financial")}
                className={`w-full text-left px-5 py-4 font-bold text-xs uppercase tracking-wide flex items-center justify-between transition-all ${
                  activeTab === "financial" 
                    ? "bg-blue-50 text-[#1B4FD8] border-l-4 border-[#1B4FD8]" 
                    : "text-slate-600 hover:bg-slate-50 hover:text-slate-900"
                }`}
              >
                <div className="flex items-center space-x-2.5">
                  <TrendingUp className="w-4 h-4" />
                  <span>Financial Criteria</span>
                </div>
              </button>
            </li>
            <li>
              <button
                onClick={() => setActiveTab("certs")}
                className={`w-full text-left px-5 py-4 font-bold text-xs uppercase tracking-wide flex items-center justify-between transition-all ${
                  activeTab === "certs" 
                    ? "bg-blue-50 text-[#1B4FD8] border-l-4 border-[#1B4FD8]" 
                    : "text-slate-600 hover:bg-slate-50 hover:text-slate-900"
                }`}
              >
                <div className="flex items-center space-x-2.5">
                  <MapPin className="w-4 h-4" />
                  <span>Trade & Territory</span>
                </div>
              </button>
            </li>
            <li>
              <button
                onClick={() => setActiveTab("projects")}
                className={`w-full text-left px-5 py-4 font-bold text-xs uppercase tracking-wide flex items-center justify-between transition-all ${
                  activeTab === "projects" 
                    ? "bg-blue-50 text-[#1B4FD8] border-l-4 border-[#1B4FD8]" 
                    : "text-slate-600 hover:bg-slate-50 hover:text-slate-900"
                }`}
              >
                <div className="flex items-center space-x-2.5">
                  <Briefcase className="w-4 h-4" />
                  <span>Project Credentials</span>
                </div>
              </button>
            </li>
          </ul>
        </div>

        {/* Dynamic form container sheet */}
        <div className="md:col-span-3 bg-white/60 backdrop-blur-md border border-white/25 rounded-2xl p-6 shadow-sm min-h-[400px]">
          {activeTab === "basic" && (
            <div className="space-y-6">
              <div className="border-b border-slate-100 pb-3">
                <h3 className="text-base font-extrabold text-slate-800">Corporate Incorporation details</h3>
                <p className="text-[11px] text-slate-400 mt-1">Official identification details as registered on the Ministry of Corporate Affairs (MCA).</p>
              </div>
              <div className="grid md:grid-cols-2 gap-5 text-slate-700">
                <div className="flex flex-col space-y-1.5">
                  <label className="text-[11px] font-bold text-slate-500 uppercase tracking-wider flex items-center space-x-1.5">
                    <span>Registered Enterprise Name</span>
                    <span title="Legal name printed on your GST certificates">
                      <HelpCircle className="w-3.5 h-3.5 text-slate-300" />
                    </span>
                  </label>
                  <input
                    type="text"
                    value={companyName}
                    onChange={(e) => setCompanyName(e.target.value)}
                    className="border border-slate-200 hover:border-slate-300 rounded-xl px-3.5 py-2.5 text-xs text-slate-800 font-medium focus:outline-none focus:ring-2 focus:ring-blue-500 bg-slate-50/20"
                    placeholder="Enter Private Ltd or LLP registered identity"
                  />
                </div>
                <div className="flex flex-col space-y-1.5">
                  <label className="text-[11px] font-bold text-slate-500 uppercase tracking-wider flex items-center space-x-1.5">
                    <span>Corporate CIN number</span>
                  </label>
                  <input
                    type="text"
                    value={registrationNumber}
                    onChange={(e) => setRegistrationNumber(e.target.value)}
                    placeholder="U45201BR2015PTC024501"
                    className="border border-slate-200 hover:border-slate-300 rounded-xl px-3.5 py-2.5 text-xs font-mono text-slate-800 uppercase focus:outline-none focus:ring-2 focus:ring-blue-500 bg-slate-50/20"
                  />
                  <p className="text-[9px] text-slate-400">Must conform to the 21-character alphanumeric coding format.</p>
                </div>
                <div className="flex flex-col space-y-1.5">
                  <label className="text-[11px] font-bold text-slate-500 uppercase tracking-wider flex items-center space-x-1.5">
                    <span>GST Identification Code (GSTIN)</span>
                  </label>
                  <input
                    type="text"
                    value={gstNumber}
                    onChange={(e) => setGstNumber(e.target.value)}
                    placeholder="10AAAXX0000Z1Z5"
                    className="border border-slate-200 hover:border-slate-300 rounded-xl px-3.5 py-2.5 text-xs font-mono text-slate-800 uppercase focus:outline-none focus:ring-2 focus:ring-blue-500 bg-slate-50/20"
                  />
                </div>
                <div className="flex flex-col space-y-1.5">
                  <label className="text-[11px] font-bold text-slate-500 uppercase tracking-wider flex items-center space-x-1.5">
                    <span>Permanent Account Number (PAN)</span>
                  </label>
                  <input
                    type="text"
                    value={panNumber}
                    onChange={(e) => setPanNumber(e.target.value)}
                    placeholder="AAACX1234F"
                    className="border border-slate-200 hover:border-slate-300 rounded-xl px-3.5 py-2.5 text-xs font-mono text-slate-800 uppercase focus:outline-none focus:ring-2 focus:ring-blue-500 bg-slate-50/20"
                  />
                </div>
              </div>
            </div>
          )}

          {activeTab === "financial" && (
            <div className="space-y-6">
              <div className="border-b border-slate-100 pb-3">
                <h3 className="text-base font-extrabold text-slate-800">Financial Benchmarks & Resources</h3>
                <p className="text-[11px] text-slate-400 mt-1">Numerical capabilities checked automatically by SBD minimum eligibility thresholds.</p>
              </div>
              <div className="grid md:grid-cols-2 gap-5 text-slate-700">
                <div className="flex flex-col space-y-1.5">
                  <label className="text-[11px] font-bold text-slate-500 uppercase tracking-wider flex items-center space-x-1.5">
                    <span>Average Annual Turnover (₹ Crores)</span>
                  </label>
                  <div className="relative">
                    <span className="absolute left-3.5 top-2.5 text-xs font-bold text-slate-400 font-mono">₹</span>
                    <input
                      type="number"
                      step="0.1"
                      value={annualTurnover || ""}
                      onChange={(e) => setAnnualTurnover(parseFloat(e.target.value) || 0)}
                      className="w-full border border-slate-200 hover:border-slate-300 rounded-xl pl-8 pr-16 py-2.5 text-xs font-mono text-slate-800 focus:outline-none focus:ring-2 focus:ring-blue-500 bg-slate-50/20"
                      placeholder="e.g. 5.2"
                    />
                    <span className="absolute right-3.5 top-2.5 text-[10px] font-bold text-slate-400 tracking-wider">CRORES</span>
                  </div>
                  <p className="text-[9px] text-slate-400 leading-normal">Specify average audited turnover across the preceding three consecutive financial accounting cycles.</p>
                </div>
                <div className="flex flex-col space-y-1.5">
                  <label className="text-[11px] font-bold text-slate-500 uppercase tracking-wider flex items-center space-x-1.5">
                    <span>Active Years of Civil experience</span>
                  </label>
                  <div className="relative">
                    <input
                      type="number"
                      value={yearsOfExperience || ""}
                      onChange={(e) => setYearsOfExperience(parseInt(e.target.value) || 0)}
                      className="w-full border border-slate-200 hover:border-slate-300 rounded-xl px-3.5 py-2.5 text-xs font-mono text-slate-800 focus:outline-none focus:ring-2 focus:ring-blue-500 bg-slate-50/20"
                      placeholder="e.g. 8"
                    />
                    <span className="absolute right-3.5 top-2.5 text-[10px] font-bold text-slate-400 tracking-wider">YEARS</span>
                  </div>
                </div>
                <div className="flex flex-col space-y-1.5">
                  <label className="text-[11px] font-bold text-slate-500 uppercase tracking-wider flex items-center space-x-1.5">
                    <span>Total Registered Employees</span>
                  </label>
                  <div className="relative">
                    <span className="absolute left-3.5 top-2.5 text-xs font-bold text-slate-400">
                      <Users className="w-3.5 h-3.5 text-slate-400" />
                    </span>
                    <input
                      type="number"
                      value={employeeCount || ""}
                      onChange={(e) => setEmployeeCount(parseInt(e.target.value) || 0)}
                      className="w-full border border-slate-200 hover:border-slate-300 rounded-xl pl-9 pr-12 py-2.5 text-xs font-mono text-slate-800 focus:outline-none focus:ring-2 focus:ring-blue-500 bg-slate-50/20"
                      placeholder="e.g. 45"
                    />
                    <span className="absolute right-3.5 top-2.5 text-[10px] font-bold text-slate-400 tracking-wider">MEMBERS</span>
                  </div>
                </div>
              </div>
            </div>
          )}

          {activeTab === "certs" && (
            <div className="space-y-6">
              {/* Category selector */}
              <div>
                <div className="border-b border-slate-100 pb-2 mb-3">
                  <h4 className="text-xs font-bold text-slate-800 uppercase tracking-wider">Target Operational Industries & Sectors</h4>
                  <p className="text-[10px] text-slate-400 mt-0.5">Select category codes you wish to be alerted on inside your custom Feed.</p>
                </div>
                <div className="grid grid-cols-2 md:grid-cols-3 gap-2.5">
                  {bidderCategories.map((cat) => (
                    <label 
                      key={cat} 
                      className={`flex items-center space-x-2.5 px-3 py-2.5 rounded-xl border cursor-pointer select-none transition-all ${
                        categories.includes(cat) 
                          ? "bg-blue-50/30 border-[#1B4FD8] text-[#1B4FD8] font-bold" 
                          : "border-slate-200 hover:bg-slate-50 text-slate-600"
                      }`}
                    >
                      <input
                        type="checkbox"
                        checked={categories.includes(cat)}
                        onChange={() => handleCheckboxToggle(categories, setCategories, cat)}
                        className="rounded border-slate-300 text-blue-600 focus:ring-[#1B4FD8] w-4 h-4 cursor-pointer"
                      />
                      <span className="text-xs">{cat}</span>
                    </label>
                  ))}
                </div>
              </div>

              {/* States selector */}
              <div>
                <div className="border-b border-slate-100 pb-2 mb-3">
                  <h4 className="text-xs font-bold text-slate-800 uppercase tracking-wider">Territories of Active Operation</h4>
                  <p className="text-[10px] text-slate-400 mt-0.5">Filters tenders by allowed bidding and state physical locations.</p>
                </div>
                <div className="grid grid-cols-2 md:grid-cols-3 gap-2.5">
                  {indianStates.map((st) => (
                    <label 
                      key={st} 
                      className={`flex items-center space-x-2.5 px-3 py-2.5 rounded-xl border cursor-pointer select-none transition-all ${
                        operationalStates.includes(st) 
                          ? "bg-blue-50/30 border-[#1B4FD8] text-[#1B4FD8] font-bold" 
                          : "border-slate-200 hover:bg-slate-50 text-slate-600"
                      }`}
                    >
                      <input
                        type="checkbox"
                        checked={operationalStates.includes(st)}
                        onChange={() => handleCheckboxToggle(operationalStates, setOperationalStates, st)}
                        className="rounded border-slate-300 text-blue-600 focus:ring-[#1B4FD8] w-4 h-4 cursor-pointer"
                      />
                      <span className="text-xs">{st}</span>
                    </label>
                  ))}
                </div>
              </div>

              {/* MSME Advantage check */}
              <div>
                <div className="border-b border-slate-100 pb-2 mb-3">
                  <h4 className="text-xs font-bold text-[#1B4FD8] uppercase tracking-wider flex items-center space-x-1.5">
                    <span>MSME Preferential Incentives Exemption</span>
                  </h4>
                </div>
                <div className="flex items-start space-x-3 bg-emerald-50/30 border border-emerald-100 rounded-2xl p-4">
                  <input
                    type="checkbox"
                    id="msmeCheck"
                    checked={msmeRegistered}
                    onChange={(e) => setMsmeRegistered(e.target.checked)}
                    className="rounded border-emerald-300 text-emerald-600 focus:ring-emerald-500 w-5 h-5 cursor-pointer mt-0.5"
                  />
                  <div className="space-y-0.5">
                    <label htmlFor="msmeCheck" className="text-xs font-extrabold text-emerald-800 cursor-pointer block">
                      Enable MSME/Udyam registered agency advantages
                    </label>
                    <span className="text-[10px] text-emerald-700 leading-normal block">
                      Checking this automatically toggles EMD exemptions checklist rules for tenders categorized under MSME set-asides, boosting compatibility score matches.
                    </span>
                  </div>
                </div>
              </div>

              {/* Certifications Selection */}
              <div>
                <div className="border-b border-slate-100 pb-2 mb-3">
                  <h4 className="text-xs font-bold text-slate-800 uppercase tracking-wider">Company Accredited Certifications</h4>
                </div>
                <div className="flex flex-wrap gap-2">
                  {["ISO 9001", "Class A Contractor License", "BREDA Empanelment", "ISO 14001 Environment"].map((acc) => {
                    const hasAcc = certifications.includes(acc);
                    return (
                      <button
                        key={acc}
                        type="button"
                        onClick={() => handleCheckboxToggle(certifications, setCertifications, acc)}
                        className={`text-xs font-bold px-3.5 py-2 rounded-xl border transition-all cursor-pointer ${
                          hasAcc
                            ? "bg-[#1B4FD8] border-[#1B4FD8] text-white shadow-sm"
                            : "bg-white border-slate-200 text-slate-600 hover:bg-slate-50"
                        }`}
                      >
                        {acc}
                      </button>
                    );
                  })}
                </div>
              </div>
            </div>
          )}

          {activeTab === "projects" && (
            <div className="space-y-6">
              <div className="border-b border-slate-100 pb-3">
                <h3 className="text-base font-extrabold text-slate-800">Public Sector Reference Completion Logs</h3>
                <p className="text-[11px] text-slate-400 mt-1">Historically completed projects log. Verified by client departments to fulfill tender minimum experience requirements.</p>
              </div>

              {/* Projects Table */}
              <div className="border border-slate-150 rounded-2xl overflow-hidden shadow-xs bg-white">
                <div className="overflow-x-auto">
                  <table className="w-full text-left border-collapse text-xs">
                    <thead>
                      <tr className="bg-slate-50 text-[10px] font-extrabold uppercase text-slate-400 tracking-wider border-b border-slate-150">
                        <th className="py-3.5 px-4 w-[40%]">Project Name</th>
                        <th className="py-3.5 px-4">Client Agency</th>
                        <th className="py-3.5 px-4 text-center">Value (₹ Cr)</th>
                        <th className="py-3.5 px-4 text-center">Year</th>
                        <th className="py-3.5 px-4 text-right">Delete</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-150 text-slate-700 font-medium">
                      {projects.map((proj, idx) => (
                        <tr key={idx} className="hover:bg-slate-50/20">
                          <td className="py-3.5 px-4 font-bold text-slate-800">{proj.name}</td>
                          <td className="py-3.5 px-4 text-slate-500">{proj.client}</td>
                          <td className="py-3.5 px-4 text-center font-mono text-slate-800">{formatToLakhCrore(proj.value)}</td>
                          <td className="py-3.5 px-4 text-center font-mono text-slate-500">{proj.year}</td>
                          <td className="py-3.5 px-4 text-right">
                            <button
                              type="button"
                              onClick={() => removeProject(idx)}
                              className="text-red-500 hover:text-red-700 p-1.5 rounded-lg hover:bg-red-50 transition-colors cursor-pointer"
                            >
                              <Trash className="w-4 h-4" />
                            </button>
                          </td>
                        </tr>
                      ))}
                      {projects.length === 0 && (
                        <tr>
                          <td colSpan={5} className="py-12 px-4 text-center text-slate-400 font-bold">
                            <div className="flex flex-col items-center justify-center space-y-2">
                              <Briefcase className="w-8 h-8 text-slate-200" />
                              <p className="text-xs">No reference completion projects logged.</p>
                              <p className="text-[10px] text-slate-400 font-normal">Add past projects to bypass tender experience check audits.</p>
                            </div>
                          </td>
                        </tr>
                      )}
                    </tbody>
                  </table>
                </div>
              </div>

              {/* Add Project Form segment */}
              <form onSubmit={addProject} className="bg-slate-50/60 p-5 rounded-2xl border border-slate-200 mt-4 space-y-4">
                <span className="text-[10 px] font-extrabold text-slate-800 uppercase tracking-widest block">Log Reference Completion Certificate</span>
                <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-4 text-xs font-semibold">
                  <div className="flex flex-col space-y-1.5">
                    <label className="text-slate-400 font-bold uppercase text-[9px] tracking-wide">Project Title</label>
                    <input
                      type="text"
                      placeholder="e.g. Bypass roadway ring, Patna"
                      value={newProject.name}
                      onChange={(e) => setNewProject({ ...newProject, name: e.target.value })}
                      className="border border-slate-200 bg-white rounded-xl px-3 py-2 text-xs font-medium focus:outline-none"
                    />
                  </div>
                  <div className="flex flex-col space-y-1.5">
                    <label className="text-slate-400 font-bold uppercase text-[9px] tracking-wide">Awarding Agency</label>
                    <input
                      type="text"
                      placeholder="e.g. Bihar PWD"
                      value={newProject.client}
                      onChange={(e) => setNewProject({ ...newProject, client: e.target.value })}
                      className="border border-slate-200 bg-white rounded-xl px-3 py-2 text-xs font-medium focus:outline-none"
                    />
                  </div>
                  <div className="flex flex-col space-y-1.5">
                    <label className="text-slate-400 font-bold uppercase text-[9px] tracking-wide">Project Value (₹ Crores)</label>
                    <input
                      type="number"
                      step="0.01"
                      placeholder="e.g. 1.25"
                      value={newProject.value}
                      onChange={(e) => setNewProject({ ...newProject, value: e.target.value })}
                      className="border border-slate-200 bg-white rounded-xl px-3 py-2 text-xs font-medium focus:outline-none"
                    />
                  </div>
                  <div className="flex flex-col space-y-1.5">
                    <label className="text-slate-400 font-bold uppercase text-[9px] tracking-wide">Completion Year</label>
                    <input
                      type="number"
                      placeholder="e.g. 2025"
                      value={newProject.year}
                      onChange={(e) => setNewProject({ ...newProject, year: e.target.value })}
                      className="border border-slate-200 bg-white rounded-xl px-3 py-2 text-xs font-medium focus:outline-none"
                    />
                  </div>
                </div>
                <div className="flex justify-end pt-2">
                  <button
                    type="submit"
                    className="bg-[#1B4FD8] hover:bg-blue-700 text-white font-bold text-xs px-4 py-2 rounded-xl flex items-center space-x-1 cursor-pointer shadow"
                  >
                    <Plus className="w-3.5 h-3.5" />
                    <span>Append completion record</span>
                  </button>
                </div>
              </form>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
