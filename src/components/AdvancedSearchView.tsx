import React, { useState, useEffect } from "react";
import { 
  Search, 
  Filter, 
  MapPin, 
  Calendar, 
  DollarSign, 
  Clock, 
  Bookmark, 
  Trash2, 
  RefreshCw, 
  CheckCircle, 
  Sliders, 
  Eye, 
  Server, 
  Database,
  Tag,
  Building2,
  X,
  FileSearch,
  Check
} from "lucide-react";
import { Tender } from "../types.js";
import { formatDate, getCountdown } from "../utils.js";
import { formatIndianCurrency } from "../utils/formatters.js";
import TenderDetailView from "./TenderDetailView.jsx";

interface InvalidationStats {
  totalDocuments: number;
  totalTermsIndexed: number;
  memoryUsageEstimate: string;
  status: string;
}

interface SavedSearchObj {
  id: string;
  name: string;
  query: string;
  category: string[];
  location: string[];
  department: string;
  minVal: number;
  maxVal: number;
  statusFilter: string;
  publishRange: string; // "any" | "3" | "7" | "14" | "30"
  deadlineRange: string; // "any" | "3" | "7" | "14" | "30"
  createdAt: string;
}

export default function AdvancedSearchView() {
  // DB status
  const [indexStats, setIndexStats] = useState<InvalidationStats | null>(null);
  const [indexLoading, setIndexLoading] = useState(false);

  // Search/Filters states
  const [q, setQ] = useState("");
  const [isSemantic, setIsSemantic] = useState(false);
  const [selectedCategories, setSelectedCategories] = useState<string[]>([]);
  const [selectedLocations, setSelectedLocations] = useState<string[]>([]);
  const [deptTerm, setDeptTerm] = useState("");
  const [minAmount, setMinAmount] = useState<number>(0);
  const [maxAmount, setMaxAmount] = useState<number>(100);
  const [statusFilter, setStatusFilter] = useState<string>("ALL");
  const [publishRange, setPublishRange] = useState<string>("any");
  const [deadlineRange, setDeadlineRange] = useState<string>("any");

  // Saved Searches list
  const [savedSearches, setSavedSearches] = useState<SavedSearchObj[]>([]);
  const [newSaveName, setNewSaveName] = useState("");
  const [isSaving, setIsSaving] = useState(false);

  // Results & UI
  const [searchResults, setSearchResults] = useState<Tender[]>([]);
  const [relevanceScores, setRelevanceScores] = useState<Record<string, number>>({});
  const [searching, setSearching] = useState(false);
  const [selectedTenderId, setSelectedTenderId] = useState<string | null>(null);

  // Dropdown list helpers
  const [availableCategories, setAvailableCategories] = useState<string[]>(["Construction", "Electrical", "IT Support", "Water Supply", "Roads"]);
  const [availableStates, setAvailableStates] = useState<string[]>(["Bihar", "Jharkhand", "Uttar Pradesh", "Delhi", "Odisha", "West Bengal"]);

  // Fetch index stats & run initial query
  useEffect(() => {
    fetchIndexStats();
    handleSearch();
    loadSavedSearches();
  }, []);

  const fetchIndexStats = async () => {
    setIndexLoading(true);
    try {
      const res = await fetch("/api/search/index-status");
      if (res.ok) {
        const data = await res.json();
        setIndexStats(data);
      }
    } catch (e) {
      console.error("Index status retrieval failed", e);
    } finally {
      setIndexLoading(false);
    }
  };

  const loadSavedSearches = () => {
    try {
      const cached = localStorage.getItem("tender_saved_searches");
      if (cached) {
        setSavedSearches(JSON.parse(cached));
      } else {
        const defaults: SavedSearchObj[] = [
          {
            id: "ss-1",
            name: "High Value Civil (Bihar)",
            query: "Academic",
            category: ["Construction"],
            location: ["Bihar"],
            department: "",
            minVal: 5,
            maxVal: 100,
            statusFilter: "ACTIVE",
            publishRange: "any",
            deadlineRange: "any",
            createdAt: new Date().toISOString()
          },
          {
            id: "ss-2",
            name: "Urgent Local Solar Grid Work",
            query: "solar",
            category: ["Electrical"],
            location: ["Bihar"],
            department: "",
            minVal: 0,
            maxVal: 15,
            statusFilter: "ACTIVE",
            publishRange: "any",
            deadlineRange: "14",
            createdAt: new Date().toISOString()
          }
        ];
        setSavedSearches(defaults);
        localStorage.setItem("tender_saved_searches", JSON.stringify(defaults));
      }
    } catch (e) {
      console.warn("localStorage block state warning", e);
    }
  };

  const handleSearch = async () => {
    setSearching(true);
    try {
      // Build search query params
      const qParams = new URLSearchParams();
      if (q.trim()) qParams.append("q", q.trim());
      if (isSemantic) qParams.append("mode", "semantic");
      if (selectedCategories.length > 0) qParams.append("category", selectedCategories.join(","));
      if (selectedLocations.length > 0) qParams.append("location", selectedLocations.join(","));
      if (deptTerm.trim()) qParams.append("department", deptTerm.trim());
      if (minAmount > 0) qParams.append("minAmount", String(minAmount));
      if (maxAmount < 100) qParams.append("maxAmount", String(maxAmount));
      if (statusFilter !== "ALL") qParams.append("status", statusFilter);

      // Handle custom date publish ranges
      if (publishRange !== "any") {
        const days = parseInt(publishRange, 10);
        const date = new Date();
        date.setDate(date.getDate() - days);
        qParams.append("publishedAfter", date.toISOString());
      }

      // Handle custom deadline limits
      if (deadlineRange !== "any") {
        const days = parseInt(deadlineRange, 10);
        const date = new Date();
        date.setDate(date.getDate() + days);
        qParams.append("deadlineBefore", date.toISOString());
      }

      const res = await fetch(`/api/search?${qParams.toString()}`);
      if (res.ok) {
        const data = await res.json();
        setSearchResults(data.tenders || []);
        setRelevanceScores(data.scoreDetails || {});
      }
    } catch (err) {
      console.error("Failed to query the search services", err);
    } finally {
      setSearching(false);
    }
  };

  const handleSaveSearch = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newSaveName.trim()) return;

    const newSaved: SavedSearchObj = {
      id: "ss-" + Math.random().toString(36).substring(3, 9),
      name: newSaveName.trim(),
      query: q,
      category: selectedCategories,
      location: selectedLocations,
      department: deptTerm,
      minVal: minAmount,
      maxVal: maxAmount,
      statusFilter,
      publishRange,
      deadlineRange,
      createdAt: new Date().toISOString()
    };

    const updated = [newSaved, ...savedSearches];
    setSavedSearches(updated);
    try {
      localStorage.setItem("tender_saved_searches", JSON.stringify(updated));
    } catch (err) {
      console.warn("Failed to write saved search to store", err);
    }
    setNewSaveName("");
    setIsSaving(false);
  };

  const handleDeleteSavedSearch = (id: string, e: React.MouseEvent) => {
    e.stopPropagation();
    const updated = savedSearches.filter(s => s.id !== id);
    setSavedSearches(updated);
    try {
      localStorage.setItem("tender_saved_searches", JSON.stringify(updated));
    } catch (err) {
      console.warn("Failed to delete saved search from store", err);
    }
  };

  const handleApplySavedSearch = (s: SavedSearchObj) => {
    setQ(s.query || "");
    setSelectedCategories(s.category || []);
    setSelectedLocations(s.location || []);
    setDeptTerm(s.department || "");
    setMinAmount(s.minVal !== undefined ? s.minVal : 0);
    setMaxAmount(s.maxVal !== undefined ? s.maxVal : 100);
    setStatusFilter(s.statusFilter || "ALL");
    setPublishRange(s.publishRange || "any");
    setDeadlineRange(s.deadlineRange || "any");

    // Immediately trigger search using applied states
    setTimeout(() => {
      handleSearch();
    }, 50);
  };

  const handleClearAll = () => {
    setQ("");
    setSelectedCategories([]);
    setSelectedLocations([]);
    setDeptTerm("");
    setMinAmount(0);
    setMaxAmount(100);
    setStatusFilter("ALL");
    setPublishRange("any");
    setDeadlineRange("any");
  };

  const formatPublishOption = (opt: string) => {
    switch (opt) {
      case "3": return "Last 3 Days";
      case "7": return "Last 7 Days";
      case "14": return "Last 14 Days";
      case "30": return "Last 30 Days";
      default: return "Anytime";
    }
  };

  const formatDeadlineOption = (opt: string) => {
    switch (opt) {
      case "3": return "Next 3 Days";
      case "7": return "Next 7 Days";
      case "14": return "Next 14 Days";
      case "30": return "Next 30 Days";
      default: return "Anytime";
    }
  };

  // Toggle checklist utilities
  const handleToggleCategory = (cat: string) => {
    if (selectedCategories.includes(cat)) {
      setSelectedCategories(selectedCategories.filter(c => c !== cat));
    } else {
      setSelectedCategories([...selectedCategories, cat]);
    }
  };

  const handleToggleLocation = (loc: string) => {
    if (selectedLocations.includes(loc)) {
      setSelectedLocations(selectedLocations.filter(l => l !== loc));
    } else {
      setSelectedLocations([...selectedLocations, loc]);
    }
  };

  return (
    <div className="space-y-6">
      {/* Search Header Banner */}
      <div className="bg-gradient-to-r from-slate-900 via-indigo-950 to-blue-950 p-6 rounded-3xl border border-indigo-950/20 text-white shadow-lg flex flex-col md:flex-row justify-between items-start md:items-center gap-6">
        <div className="space-y-1">
          <div className="flex items-center space-x-2 text-sky-400 font-extrabold text-xs tracking-wider uppercase">
            <Sliders className="w-4 h-4 text-sky-400" />
            <span>Phase 5 Compliance Module</span>
          </div>
          <h2 className="text-2xl md:text-3xl font-black tracking-tight text-white">
            Advanced Procurement Search Engine
          </h2>
          <p className="text-xs text-slate-300 max-w-2xl">
            Execute complex multi-criteria queries across real-time indexed tender notices.
            Powered by a native inverted index for <b className="text-sky-400">blazing-fast linear search</b> capabilities.
          </p>
        </div>

        {/* Index Status Widget */}
        <div className="bg-white/10 backdrop-blur-md rounded-2xl p-4 border border-white/10 shrink-0 min-w-[240px]">
          <div className="flex justify-between items-center pb-2 border-b border-white/5 mb-2">
            <span className="text-[10px] text-slate-400 font-bold uppercase tracking-wider flex items-center gap-1">
              <Database className="w-3.5 h-3.5 text-sky-400" />
              <span>Inverted Index Status</span>
            </span>
            <button 
              onClick={fetchIndexStats} 
              disabled={indexLoading}
              className="hover:text-white text-slate-400 transition"
              title="Refresh Index Stats"
            >
              <RefreshCw className={`w-3.5 h-3.5 ${indexLoading ? "animate-spin" : ""}`} />
            </button>
          </div>
          {indexStats ? (
            <div className="space-y-1.5 text-xs text-slate-200">
              <div className="flex justify-between">
                <span className="text-slate-400">Total Indexed Items:</span>
                <span className="font-bold underline">{indexStats.totalDocuments} Tenders</span>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-400">Distinct Terms:</span>
                <span className="font-bold font-mono text-emerald-400">{indexStats.totalTermsIndexed} keys</span>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-400">RAM Memory footprint:</span>
                <span className="font-bold font-mono text-sky-400">{indexStats.memoryUsageEstimate}</span>
              </div>
            </div>
          ) : (
            <div className="text-center py-2 text-xs text-slate-400">Loading indexing parameters...</div>
          )}
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
        {/* Left Side Filter Controls (Columns: 4) */}
        <div className="lg:col-span-4 space-y-6">
          <div className="bg-white rounded-2xl border border-slate-200/90 shadow-xs p-5 space-y-6">
            <div className="flex items-center justify-between border-b border-slate-100 pb-3">
              <div className="flex items-center space-x-2 text-slate-900 font-black text-sm uppercase tracking-wider">
                <Filter className="w-4 h-4 text-blue-600" />
                <span>Search Filters</span>
              </div>
              <button
                onClick={handleClearAll}
                className="text-xs text-red-500 hover:text-red-700 font-bold transition cursor-pointer"
              >
                Reset Filter Panel
              </button>
            </div>

            {/* Keyword Search */}
            <div className="space-y-1.5 focus-within:ring-2 focus-within:ring-blue-100 p-0.5 rounded-lg transition-all">
              <label className="text-[10px] font-extrabold text-slate-400 uppercase tracking-widest block">Keyword Query</label>
              <div className="relative">
                <input
                  type="text"
                  placeholder="e.g. Academy, Solar, Roadway..."
                  value={q}
                  onChange={(e) => setQ(e.target.value)}
                  className="w-full bg-slate-50 border border-slate-300 rounded-xl pl-9 pr-3 py-2.5 text-xs text-slate-800 focus:outline-none focus:border-blue-600 focus:bg-white transition"
                />
                <Search className="absolute left-3 top-3 w-4 h-4 text-slate-400" />
              </div>
            </div>

            {/* AI Semantic Search Toggle */}
            <div className="flex items-center justify-between p-3 rounded-xl bg-gradient-to-r from-blue-50/50 to-indigo-50/50 border border-blue-100/50">
              <div className="flex flex-col">
                <span className="text-xs font-black text-slate-800 uppercase tracking-wider flex items-center gap-1">
                  AI Semantic Search
                  <span className="bg-gradient-to-r from-blue-600 to-indigo-600 text-white text-[8px] px-1.5 py-0.2 rounded font-black tracking-widest uppercase">Gemini</span>
                </span>
                <span className="text-[10px] text-slate-500 font-medium">Use contextual meaning instead of keywords</span>
              </div>
              <button
                type="button"
                onClick={() => setIsSemantic(!isSemantic)}
                className={`relative inline-flex h-5 w-10 shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out focus:outline-none ${
                  isSemantic ? "bg-indigo-600" : "bg-slate-200"
                }`}
              >
                <span
                  className={`pointer-events-none inline-block h-4 w-4 transform rounded-full bg-white shadow-sm ring-0 transition duration-200 ease-in-out ${
                    isSemantic ? "translate-x-5" : "translate-x-0"
                  }`}
                />
              </button>
            </div>

            {/* Department Match */}
            <div className="space-y-1.5">
              <label className="text-[10px] font-extrabold text-slate-400 uppercase tracking-widest block">Procurement Department</label>
              <div className="relative">
                <input
                  type="text"
                  placeholder="e.g. CPWD, BREDA, NBPDCL..."
                  value={deptTerm}
                  onChange={(e) => setDeptTerm(e.target.value)}
                  className="w-full bg-slate-50 border border-slate-300 rounded-xl pl-9 pr-3 py-2.5 text-xs text-slate-800 focus:outline-none focus:border-blue-600 focus:bg-white transition"
                />
                <Building2 className="absolute left-3 top-3 w-4 h-4 text-slate-400" />
              </div>
            </div>

            {/* Category Select checkboxes */}
            <div className="space-y-2">
              <label className="text-[10px] font-extrabold text-slate-400 uppercase tracking-widest block">Industrial Categories</label>
              <div className="flex flex-wrap gap-1.5">
                {availableCategories.map((cat) => {
                  const isChecked = selectedCategories.includes(cat);
                  return (
                    <button
                      key={cat}
                      type="button"
                      onClick={() => handleToggleCategory(cat)}
                      className={`text-[10.5px] font-bold py-1 px-2.5 rounded-lg border transition-all cursor-pointer flex items-center gap-1 ${
                        isChecked
                          ? "bg-blue-600 text-white border-blue-600 shadow-xs"
                          : "bg-slate-50 text-slate-600 border-slate-205 hover:bg-slate-100/50 hover:border-slate-350"
                      }`}
                    >
                      {isChecked && <Check className="w-3 h-3" />}
                      <span>{cat}</span>
                    </button>
                  );
                })}
              </div>
            </div>

            {/* State selection */}
            <div className="space-y-2">
              <label className="text-[10px] font-extrabold text-slate-400 uppercase tracking-widest block">Regional States</label>
              <div className="flex flex-wrap gap-1.5">
                {availableStates.map((st) => {
                  const isChecked = selectedLocations.includes(st);
                  return (
                    <button
                      key={st}
                      type="button"
                      onClick={() => handleToggleLocation(st)}
                      className={`text-[10.5px] font-bold py-1 px-2.5 rounded-lg border transition-all cursor-pointer flex items-center gap-1 ${
                        isChecked
                          ? "bg-indigo-600 text-white border-indigo-600 shadow-xs"
                          : "bg-slate-50 text-slate-605 border-slate-205 hover:bg-slate-100/50 hover:border-slate-350"
                      }`}
                    >
                      {isChecked && <Check className="w-3 h-3" />}
                      <span>{st}</span>
                    </button>
                  );
                })}
              </div>
            </div>

            {/* Value Cost Range (₹ Crores) */}
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <label className="text-[10px] font-extrabold text-slate-400 uppercase tracking-widest block">Tender Value Slider</label>
                <span className="text-[11px] font-mono font-bold text-slate-700 bg-slate-100 px-2 py-0.5 rounded-md">
                  {minAmount}Cr - {maxAmount}Cr
                </span>
              </div>
              <div className="space-y-2.5">
                <div>
                  <span className="text-[10px] text-slate-400 block mb-1">Min Value (₹ Crores): {minAmount}Cr</span>
                  <input
                    type="range"
                    min="0"
                    max="100"
                    step="1"
                    value={minAmount}
                    onChange={(e) => {
                      const val = parseInt(e.target.value, 10);
                      setMinAmount(val);
                      if (val > maxAmount) setMaxAmount(val);
                    }}
                    className="w-full h-1.5 bg-slate-200 rounded-lg appearance-none cursor-pointer accent-blue-600 focus:outline-none"
                  />
                </div>
                <div>
                  <span className="text-[10px] text-slate-400 block mb-1">Max Value (₹ Crores): {maxAmount}Cr</span>
                  <input
                    type="range"
                    min="0"
                    max="100"
                    step="1"
                    value={maxAmount}
                    onChange={(e) => {
                      const val = parseInt(e.target.value, 10);
                      setMaxAmount(val);
                      if (val < minAmount) setMinAmount(val);
                    }}
                    className="w-full h-1.5 bg-slate-200 rounded-lg appearance-none cursor-pointer accent-blue-600 focus:outline-none"
                  />
                </div>
              </div>
            </div>

            {/* Date Filters Grid */}
            <div className="grid grid-cols-2 gap-4">
              {/* Publication Date */}
              <div className="space-y-1">
                <label className="text-[10px] font-extrabold text-slate-400 uppercase tracking-widest block">Published Date</label>
                <select
                  value={publishRange}
                  onChange={(e) => setPublishRange(e.target.value)}
                  className="w-full bg-white border border-slate-300 rounded-xl p-2 text-xs text-slate-700 font-medium focus:outline-none focus:border-blue-600 focus:bg-white transition"
                >
                  <option value="any">Anytime</option>
                  <option value="3">Within 3 Days</option>
                  <option value="7">Within 7 days</option>
                  <option value="14">Within 14 days</option>
                  <option value="30">Within 30 days</option>
                </select>
              </div>

              {/* Deadline Range */}
              <div className="space-y-1">
                <label className="text-[10px] font-extrabold text-slate-400 uppercase tracking-widest block">Bidding Deadline</label>
                <select
                  value={deadlineRange}
                  onChange={(e) => setDeadlineRange(e.target.value)}
                  className="w-full bg-white border border-slate-300 rounded-xl p-2 text-xs text-slate-700 font-medium focus:outline-none focus:border-blue-600 focus:bg-white transition"
                >
                  <option value="any">Anytime</option>
                  <option value="3">Within 3 Days</option>
                  <option value="7">Within 7 days</option>
                  <option value="14">Within 14 days</option>
                  <option value="30">Within 30 days</option>
                </select>
              </div>
            </div>

            {/* Status Select */}
            <div className="space-y-1">
              <label className="text-[10px] font-extrabold text-slate-400 uppercase tracking-widest block">Tender Bidding Status</label>
              <select
                value={statusFilter}
                onChange={(e) => setStatusFilter(e.target.value)}
                className="w-full bg-white border border-slate-300 rounded-xl p-2 text-xs text-slate-700 font-medium focus:outline-none focus:border-blue-600 focus:bg-white transition"
              >
                <option value="ALL">All Statuses (Active, Closed, Awarded)</option>
                <option value="ACTIVE">Only Active</option>
                <option value="CLOSED">Only Closed/Finished</option>
                <option value="AWARDED">Only Concluded/Awarded</option>
              </select>
            </div>

            {/* Execute Button */}
            <button
              onClick={handleSearch}
              disabled={searching}
              className="w-full py-3 bg-blue-600 hover:bg-blue-700 text-white font-bold rounded-xl shadow-xs cursor-pointer active:scale-95 transition-all flex items-center justify-center space-x-2"
            >
              <FileSearch className="w-4 h-4 text-white" />
              <span>{searching ? "Searching Inverted Index..." : "Apply Advanced Query"}</span>
            </button>
          </div>

          {/* Saved Searches Manager */}
          <div className="bg-slate-50/80 rounded-2xl border border-slate-200 p-5 space-y-4">
            <div className="flex items-center justify-between border-b border-slate-200 pb-2">
              <div className="flex items-center space-x-2">
                <Bookmark className="w-4.5 h-4.5 text-indigo-600 fill-indigo-100" />
                <span className="text-xs font-black uppercase text-slate-500 tracking-wider">Saved Searches Collection</span>
              </div>
              <span className="text-[10px] font-mono text-slate-400 font-semibold bg-white border px-1.5 py-0.5 rounded">
                {savedSearches.length} Saved
              </span>
            </div>

            {savedSearches.length > 0 ? (
              <div className="flex flex-col gap-2 max-h-56 overflow-y-auto">
                {savedSearches.map((s) => (
                  <div
                    key={s.id}
                    onClick={() => handleApplySavedSearch(s)}
                    className="p-3 bg-white hover:bg-indigo-50/40 hover:border-indigo-200 rounded-xl border border-slate-200/60 shadow-xxs cursor-pointer transition-all flex justify-between items-start group"
                  >
                    <div className="space-y-1.5 min-w-0 flex-1">
                      <div className="flex items-center gap-1.5">
                        <span className="font-extrabold text-[12.5px] text-slate-800 truncate block">
                          {s.name}
                        </span>
                      </div>
                      
                      {/* Criteria parameters badge list */}
                      <div className="flex flex-wrap gap-1 leading-normal">
                        {s.query && (
                          <span className="text-[9.5px] bg-sky-50 text-sky-700 px-1.5 py-0.5 rounded font-mono font-medium truncate max-w-[120px]">
                            Query: {s.query}
                          </span>
                        )}
                        {s.category.map(c => (
                          <span key={c} className="text-[9px] bg-blue-50 text-blue-700 px-1.5 py-0.5 rounded font-bold uppercase shrink-0">
                            {c}
                          </span>
                        ))}
                        {s.location.map(l => (
                          <span key={l} className="text-[9px] bg-emerald-50 text-emerald-700 px-1.5 py-0.5 rounded font-bold uppercase shrink-0">
                            {l}
                          </span>
                        ))}
                        <span className="text-[9.5px] bg-slate-100 text-slate-600 px-1.5 py-0.5 rounded font-semibold shrink-0">
                          {s.minVal}Cr-{s.maxVal}Cr
                        </span>
                      </div>
                    </div>

                    <button
                      type="button"
                      onClick={(e) => handleDeleteSavedSearch(s.id, e)}
                      className="p-1 rounded text-slate-400 hover:text-red-600 hover:bg-slate-100 shrink-0 transition"
                      title="Delete Saved Search"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  </div>
                ))}
              </div>
            ) : (
              <p className="text-[11px] text-slate-400 italic py-2 text-center">
                No advanced search queries saved. Formulate parameters to save.
              </p>
            )}

            {/* Form to Save Current Param Array */}
            <form onSubmit={handleSaveSearch} className="flex gap-1.5 pt-2 border-t border-slate-200/80">
              <input
                type="text"
                placeholder="Label current search as..."
                value={newSaveName}
                onChange={(e) => setNewSaveName(e.target.value)}
                className="flex-1 bg-white border border-slate-300 hover:border-slate-400 focus:border-blue-500 rounded-xl px-3 py-2 text-xs text-slate-800 focus:outline-none min-w-0"
                maxLength={40}
              />
              <button
                type="submit"
                disabled={!newSaveName.trim()}
                className="bg-indigo-600 hover:bg-indigo-700 disabled:bg-slate-200 disabled:text-slate-400 disabled:cursor-not-allowed text-white font-extrabold text-xs px-3.5 py-2 rounded-xl cursor-pointer transition shrink-0 active:scale-95"
              >
                Save
              </button>
            </form>
          </div>
        </div>

        {/* Right Side Results Panel (Columns: 8) */}
        <div className="lg:col-span-8 space-y-4">
          {selectedTenderId ? (
            <div className="bg-white rounded-3xl border border-slate-200 p-6 shadow-sm">
              <TenderDetailView
                tenderId={selectedTenderId}
                onBack={() => setSelectedTenderId(null)}
                profile={{
                  id: "cp-1",
                  userId: "u-1",
                  companyName: "Placeholder",
                  registrationNumber: "",
                  gstNumber: "",
                  panNumber: "",
                  annualTurnover: 1.0,
                  yearsOfExperience: 2,
                  categories: ["Civil"],
                  certifications: [],
                  states: ["Bihar"],
                  msmeRegistered: false,
                  employeeCount: 5,
                  pastProjects: [],
                  isActive: true,
                }}
              />
            </div>
          ) : (
            <div className="space-y-4">
              <div className="bg-white px-5 py-4 rounded-2xl border border-slate-200 shadow-xs flex justify-between items-center">
                <div className="text-xs text-slate-500 font-medium">
                  {searching ? (
                    <span className="flex items-center space-x-2 animate-pulse text-blue-600">
                      <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                      <span>Retrieving inverted postings list...</span>
                    </span>
                  ) : (
                    <span>Discovered <strong className="text-slate-900 font-extrabold">{searchResults.length} indexed tenders</strong> matching queries.</span>
                  )}
                </div>

                <div className="flex gap-1.5">
                  <span className="text-[10px] bg-slate-100 text-slate-600 font-mono font-bold px-2 py-1 rounded">
                    Query Term: &quot;{q || "None"}&quot;
                  </span>
                </div>
              </div>

              {/* Tenders Grid list */}
              {searchResults.length === 0 ? (
                <div className="text-center py-20 bg-white rounded-3xl border border-slate-200 shadow-xs space-y-4">
                  <div className="bg-slate-100 p-4.5 rounded-full w-fit mx-auto text-slate-400">
                    <Search className="w-8 h-8" />
                  </div>
                  <h3 className="text-lg font-bold text-slate-900">Zero Inverted Matches</h3>
                  <p className="text-xs text-slate-500 max-w-sm mx-auto">
                    No postings matched details. Refactor search parameters, adjust turnover Cost sliders, or broaden regional states query.
                  </p>
                </div>
              ) : (
                <div className="space-y-4">
                  {searchResults.map((tender) => {
                    const matchScore = relevanceScores[tender.id] || 0;
                    const cCountdown = getCountdown(tender.bidSubmissionDeadline);

                    return (
                      <div
                        key={tender.id}
                        onClick={() => setSelectedTenderId(tender.id)}
                        className="bg-white hover:bg-slate-50/50 border border-slate-200 hover:border-blue-400/50 hover:shadow-lg rounded-2xl p-5 shadow-xxs transition-all duration-300 cursor-pointer flex flex-col md:flex-row items-start md:items-center justify-between gap-5"
                      >
                        <div className="space-y-2 flex-1 min-w-0">
                          {/* Portal and Category Badges */}
                          <div className="flex flex-wrap gap-2 items-center">
                            <span className="text-[9.5px] bg-blue-100 text-blue-800 border border-blue-200 px-2 py-0.5 rounded-full font-bold uppercase tracking-wider">
                              {tender.sourcePortal}
                            </span>
                            <span className="text-[9.5px] bg-slate-100 text-slate-700 border border-slate-200 px-2 py-0.5 rounded-full font-bold">
                              {tender.category}
                            </span>
                            {tender.eligibilityCriteria.msmeOnly && (
                              <span className="text-[9.5px] bg-emerald-50 text-emerald-700 border border-emerald-100 px-2 py-0.5 rounded-full font-bold animate-pulse">
                                MSME Primary
                              </span>
                            )}
                            <span className="text-[10px] text-slate-400 font-mono">
                              DocRef: {tender.externalId}
                            </span>
                          </div>

                          <h3 className="text-[14.5px] font-extrabold text-slate-800 leading-snug line-clamp-2">
                            {tender.title}
                          </h3>

                          {/* Technical Highlights Synopsis */}
                          <p className="text-xs text-slate-500 line-clamp-2 leading-relaxed">
                            {tender.workDescription || "No detailed digest uploaded. Index covers full specification payload."}
                          </p>

                          {/* Attributes Grid */}
                          <div className="flex flex-wrap gap-x-5 gap-y-1 text-[11px] text-slate-550 items-center pt-1.5 border-t border-slate-100">
                            <span className="flex items-center space-x-1">
                              <MapPin className="w-3.5 h-3.5 text-slate-400" />
                              <span>{tender.location}</span>
                            </span>
                            <span className="flex items-center space-x-1">
                              <DollarSign className="w-3.5 h-3.5 text-slate-400 animate-pulse" />
                              <span>Est. value: <strong>{formatIndianCurrency(tender.tenderValue ? tender.tenderValue * 10000000 : null)}</strong></span>
                            </span>
                            <span className="flex items-center space-x-1">
                              <Calendar className="w-3.5 h-3.5 text-slate-400" />
                              <span>Published: {formatDate(tender.publishedDate)}</span>
                            </span>
                          </div>
                        </div>

                        {/* Search Relevance and Countdown Remaining */}
                        <div className="flex flex-row md:flex-col items-center md:items-end gap-3 w-full md:w-auto border-t md:border-t-0 pt-3 md:pt-0 border-slate-100 justify-between shrink-0">
                          {/* Inverted Index Match Score bubble */}
                          {q.trim() && (
                            <div className="flex flex-col items-center justify-center bg-gradient-to-br from-indigo-50 to-indigo-100/50 border border-indigo-100/80 p-2.5 rounded-xl min-w-[85px]">
                              <span className="text-[10px] font-extrabold text-indigo-500 uppercase tracking-widest leading-none">Relevance</span>
                              <span className="text-[15px] font-black text-indigo-700 mt-1">{matchScore > 0 ? `${matchScore} pts` : "N/A"}</span>
                            </div>
                          )}

                          {/* Bid Closing Deadline */}
                          <div className="flex items-center space-x-1 shrink-0">
                            <Clock className="w-3.5 h-3.5 text-slate-400" />
                            <span className={`text-[10px] font-extrabold px-2.5 py-1 rounded-xl border tracking-wide uppercase ${cCountdown.colorClass}`}>
                              {cCountdown.text}
                            </span>
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
