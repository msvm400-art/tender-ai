import React, { useState, useEffect } from "react";
import { Search, MapPin, Calendar, Clock, DollarSign, Filter, Grid, List, Check, Bookmark, Trash2, Cloud, Sparkles } from "lucide-react";
import { Tender, TenderMatch } from "../types.js";
import { formatDate, getCountdown } from "../utils.js";
import { formatIndianCurrency } from "../utils/formatters.js";
import { useFirebase } from "../FirebaseContext.js";

interface TenderFeedProps {
  tenders: Tender[];
  matches: TenderMatch[];
  onSelectTender: (id: string) => void;
  isLoading: boolean;
  user?: any;
  profile?: any;
  onNavigateToBilling?: () => void;
}

export default function TenderFeed({ tenders, matches, onSelectTender, isLoading, user, profile, onNavigateToBilling }: TenderFeedProps) {
  const { firebaseUser, firestorePresets, savePresetToFirestore, deletePresetFromFirestore } = useFirebase();

  // Local active filters
  const [searchInput, setSearchInput] = useState("");
  const [searchTerm, setSearchTerm] = useState("");
  const [selectedPortal, setSelectedPortal] = useState<string[]>([]);
  const [selectedState, setSelectedState] = useState<string[]>([]);
  const [selectedCategory, setSelectedCategory] = useState<string[]>([]);
  const [minVal, setMinVal] = useState<number>(0);
  const [maxVal, setMaxVal] = useState<number>(100);
  const [msmeOnly, setMsmeOnly] = useState(false);
  const [selectedStatus, setSelectedStatus] = useState("ACTIVE");
  const [deadlineProximity, setDeadlineProximity] = useState<string>("");
  const [viewMode, setViewMode] = useState<"list" | "grid">("list");
  const [sortBy, setSortBy] = useState("Newest");
  const [isMobileFiltersOpen, setIsMobileFiltersOpen] = useState(false);

  // Saved presets state and actions
  interface SavedFilterPreset {
    id: string;
    name: string;
    filters: {
      selectedPortal: string[];
      selectedState: string[];
      selectedCategory: string[];
      minVal: number;
      maxVal: number;
      msmeOnly: boolean;
      selectedStatus: string;
      deadlineProximity: string;
      searchInput: string;
    };
    isCloud?: boolean;
  }

  const [presets, setPresets] = useState<SavedFilterPreset[]>([]);
  const [newPresetName, setNewPresetName] = useState("");
  const [activePresetId, setActivePresetId] = useState<string | null>(null);

  useEffect(() => {
    let saved = null;
    try {
      saved = localStorage.getItem("tender_filter_presets");
    } catch (e) {
      console.warn("localStorage is restricted in this context:", e);
    }

    if (saved) {
      try {
        setPresets(JSON.parse(saved));
      } catch (err) {
        console.error("Failed to load presets:", err);
      }
    } else {
      const defaultPresets: SavedFilterPreset[] = [
        {
          id: "dp-1",
          name: "High Value Contracts",
          filters: {
            selectedPortal: [],
            selectedState: [],
            selectedCategory: [],
            minVal: 20,
            maxVal: 100,
            msmeOnly: false,
            selectedStatus: "ACTIVE",
            deadlineProximity: "",
            searchInput: "",
          }
        },
        {
          id: "dp-2",
          name: "Urgent Local Work",
          filters: {
            selectedPortal: [],
            selectedState: ["Bihar", "Jharkhand"],
            selectedCategory: [],
            minVal: 0,
            maxVal: 100,
            msmeOnly: false,
            selectedStatus: "ACTIVE",
            deadlineProximity: "7",
            searchInput: "",
          }
        },
        {
          id: "dp-3",
          name: "MSME Preferential",
          filters: {
            selectedPortal: [],
            selectedState: [],
            selectedCategory: [],
            minVal: 0,
            maxVal: 100,
            msmeOnly: true,
            selectedStatus: "ACTIVE",
            deadlineProximity: "",
            searchInput: "",
          }
        }
      ];
      setPresets(defaultPresets);
      try {
        localStorage.setItem("tender_filter_presets", JSON.stringify(defaultPresets));
      } catch (e) {
        console.warn("Could not write initial presets to localStorage:", e);
      }
    }
  }, []);

  // Compute combined presets by blending Firestore presets
  const combinedPresets: SavedFilterPreset[] = [
    ...firestorePresets.map((fp) => ({
      id: fp.id,
      name: fp.name,
      filters: fp.filters,
      isCloud: true,
    })),
    ...presets.filter((p) => !firestorePresets.some((fp) => fp.id === p.id)),
  ];

  const savePreset = (name: string) => {
    if (!name.trim()) return;
    const newPresetId = "preset-" + Math.random().toString(36).substring(3, 9);
    const newPresetFilters = {
      selectedPortal,
      selectedState,
      selectedCategory,
      minVal,
      maxVal,
      msmeOnly,
      selectedStatus,
      deadlineProximity,
      searchInput,
    };

    const newPreset: SavedFilterPreset = {
      id: newPresetId,
      name: name.trim(),
      filters: newPresetFilters,
    };
    
    if (firebaseUser) {
      savePresetToFirestore(newPresetId, name.trim(), newPresetFilters);
    } else {
      const updated = [newPreset, ...presets];
      setPresets(updated);
      try {
        localStorage.setItem("tender_filter_presets", JSON.stringify(updated));
      } catch (e) {
        console.warn("Could not save preset to localStorage:", e);
      }
    }
    setNewPresetName("");
    setActivePresetId(newPresetId);
  };

  const deletePreset = (id: string, e: React.MouseEvent) => {
    e.stopPropagation();
    const isCloudPreset = firestorePresets.some((fp) => fp.id === id);
    if (isCloudPreset && firebaseUser) {
      deletePresetFromFirestore(id);
    } else {
      const updated = presets.filter((p) => p.id !== id);
      setPresets(updated);
      try {
        localStorage.setItem("tender_filter_presets", JSON.stringify(updated));
      } catch (e) {
        console.warn("Could not delete preset from localStorage:", e);
      }
    }
    if (activePresetId === id) {
      setActivePresetId(null);
    }
  };

  const applyPreset = (preset: SavedFilterPreset) => {
    const f = preset.filters;
    setSelectedPortal(f.selectedPortal || []);
    setSelectedState(f.selectedState || []);
    setSelectedCategory(f.selectedCategory || []);
    setMinVal(f.minVal !== undefined ? f.minVal : 0);
    setMaxVal(f.maxVal !== undefined ? f.maxVal : 100);
    setMsmeOnly(!!f.msmeOnly);
    setSelectedStatus(f.selectedStatus || "ACTIVE");
    setDeadlineProximity(f.deadlineProximity || "");
    setSearchInput(f.searchInput || "");
    setSearchTerm(f.searchInput || "");
    setActivePresetId(preset.id);
  };

  // Handle 300ms debounce of search input to update searchTerm
  useEffect(() => {
    const handler = setTimeout(() => {
      setSearchTerm(searchInput);
    }, 300);

    return () => {
      clearTimeout(handler);
    };
  }, [searchInput]);

  const dynamicPortals = Array.from(new Set(tenders.map((t) => t.sourcePortal))).filter(Boolean);
  const portalsAvailable = dynamicPortals.length > 0 ? dynamicPortals : ["CPPP", "GEM", "STATE_PWD", "RAILWAYS", "NHAI", "DEFENSE", "PSU"];

  const dynamicStates = Array.from(new Set(tenders.map((t) => t.state))).filter(Boolean).sort() as string[];
  const statesAvailable = dynamicStates.length > 0 ? dynamicStates : ["Bihar", "Jharkhand", "Uttar Pradesh", "Delhi", "Odisha", "West Bengal"];

  const dynamicCategories = Array.from(new Set(tenders.map((t) => t.category))).filter(Boolean);
  const categoriesAvailable = dynamicCategories.length > 0 ? dynamicCategories : ["Construction", "Electrical", "IT Support", "Water Supply", "Roads"];

  const handleCheckbox = (list: string[], setList: React.Dispatch<React.SetStateAction<string[]>>, val: string) => {
    if (list.includes(val)) {
      setList(list.filter((x) => x !== val));
    } else {
      setList([...list, val]);
    }
  };

  // Client filtering
  const filteredTenders = tenders
    .filter((tender) => {
      // 1. Search text
      if (searchTerm) {
        const q = searchTerm.toLowerCase();
        const matchesSearch =
          tender.title.toLowerCase().includes(q) ||
          tender.department.toLowerCase().includes(q) ||
          tender.category.toLowerCase().includes(q) ||
          tender.subCategory.toLowerCase().includes(q) ||
          tender.state.toLowerCase().includes(q) ||
          tender.location.toLowerCase().includes(q) ||
          tender.sourcePortal.toLowerCase().includes(q) ||
          (tender.workDescription && tender.workDescription.toLowerCase().includes(q));
        if (!matchesSearch) return false;
      }

      // 2. Portal filter
      if (selectedPortal.length > 0 && !selectedPortal.includes(tender.sourcePortal)) {
        return false;
      }

      // 3. State filter
      if (selectedState.length > 0 && !selectedState.includes(tender.state)) {
        return false;
      }

      // 4. Category filter
      if (selectedCategory.length > 0 && !selectedCategory.includes(tender.category)) {
        return false;
      }

      // 5. Value slider (tenderValue is in Crores)
      const val = tender.tenderValue || 0;
      if (val < minVal || val > maxVal) return false;

      // 6. MSME checks
      if (msmeOnly && !tender.eligibilityCriteria.msmeOnly) {
        return false;
      }

      // 7. Status match
      if (selectedStatus && tender.status !== selectedStatus) {
        return false;
      }

      // 8. Deadline Proximity (limit to submission closes in X days)
      if (deadlineProximity) {
        const daysRemaining = (new Date(tender.bidSubmissionDeadline).getTime() - new Date().getTime()) / (1000 * 60 * 60 * 24);
        const limitDays = parseInt(deadlineProximity, 10);
        if (daysRemaining < 0 || daysRemaining > limitDays) {
          return false;
        }
      }

      return true;
    })
    .sort((a, b) => {
      if (sortBy === "Newest") {
        return new Date(b.publishedDate).getTime() - new Date(a.publishedDate).getTime();
      }
      if (sortBy === "Value_Desc") {
        return (b.tenderValue || 0) - (a.tenderValue || 0);
      }
      if (sortBy === "Deadline_Asc") {
        return new Date(a.bidSubmissionDeadline).getTime() - new Date(b.bidSubmissionDeadline).getTime();
      }
      return 0;
    });

  const userPlan = user?.plan || "FREE";
  const isTrialUser = userPlan === "STARTER" || user?.isTrialActive === true;
  
  let limit = 1000;
  if (userPlan === "FREE") {
    limit = 5;
  } else if (isTrialUser) {
    limit = 10;
  }
  
  const displayedTenders = filteredTenders.slice(0, limit);
  const hasHiddenTenders = filteredTenders.length > limit;

  // Portal Badge Colors
  const getPortalColor = (portal: string) => {
    switch (portal) {
      case "CPPP":
        return "bg-blue-500/10 text-blue-700 border-blue-500/20";
      case "GEM":
        return "bg-emerald-500/10 text-emerald-700 border-emerald-500/20";
      case "RAILWAYS":
        return "bg-amber-500/10 text-amber-700 border-amber-500/20";
      case "NHAI":
        return "bg-indigo-500/10 text-indigo-700 border-indigo-500/20";
      case "STATE_PWD":
        return "bg-[#1B4FD8]/10 text-[#1B4FD8] border-[#1B4FD8]/20";
      default:
        return "bg-slate-500/10 text-slate-700 border-slate-500/20";
    }
  };

  return (
    <div className="space-y-6 w-full animate-slide-up">
      {/* Onboarding Checklist Reminder Banner */}
      {user?.trialDaysElapsed >= 2 && user?.plan !== "FREE" && (
        <div className="bg-gradient-to-r from-amber-500/5 to-orange-500/5 border border-amber-500/20 p-5 rounded-2xl flex flex-col sm:flex-row gap-5 items-start sm:items-center justify-between shadow-xs">
          <div className="flex gap-3.5 items-center">
            <span className="text-xl shrink-0">🛠️</span>
            <div>
              <h4 className="font-black text-xs text-amber-800 uppercase tracking-wider leading-none">Onboarding Checklist Checklist Checkpoint</h4>
              <p className="text-xs text-slate-500 font-medium leading-relaxed mt-1.5 max-w-3xl">
                To maximize search eligibility accuracy, ensure turnovers, MSME classifications, and experience are configured in the <b>Company Criteria</b> panel!
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onNavigateToBilling}
            className="bg-amber-500 hover:bg-amber-600 text-[#090d16] font-black text-[10px] uppercase tracking-widest px-4 py-2.5 rounded-xl transition-all cursor-pointer border border-amber-500/15"
          >
            Review Panel
          </button>
        </div>
      )}

      <div className="flex flex-col lg:flex-row gap-6">
        {/* Mobile Filters Toggle Button */}
        <button
          type="button"
          onClick={() => setIsMobileFiltersOpen(!isMobileFiltersOpen)}
          className="lg:hidden w-full flex items-center justify-center space-x-2 bg-white border border-slate-200/80 text-slate-700 font-black text-xs uppercase tracking-widest py-3.5 px-4 rounded-xl shadow-sm cursor-pointer active:bg-slate-50 transition-all"
        >
          <Filter className="w-4 h-4 text-indigo-500" />
          <span>{isMobileFiltersOpen ? "Hide Filters" : "Show Search Filters"}</span>
        </button>

        {/* Sidebar Filters */}
        <aside className={`w-full lg:w-72 bg-white/60 backdrop-blur-md rounded-2xl border border-slate-200/30 p-5 shadow-xs h-fit space-y-6 shrink-0 ${isMobileFiltersOpen ? "block animate-slide-up" : "hidden lg:block"}`}>
          <div className="flex items-center justify-between border-b border-slate-100 pb-3">
            <div className="flex items-center space-x-2 text-slate-800 font-black text-xs uppercase tracking-wider">
              <Filter className="w-4 h-4 text-indigo-500" />
              <span>Search Filters</span>
            </div>
            <button
              onClick={() => {
                setSearchInput("");
                setSearchTerm("");
                setSelectedPortal([]);
                setSelectedState([]);
                setSelectedCategory([]);
                setMinVal(0);
                setMaxVal(100);
                setMsmeOnly(false);
                setSelectedStatus("ACTIVE");
                setDeadlineProximity("");
                setActivePresetId(null);
              }}
              className="text-[10px] font-black text-indigo-500 hover:text-indigo-700 uppercase tracking-wider cursor-pointer"
            >
              Clear All
            </button>
          </div>

          {/* Saved Filter Presets Widget */}
          <div className="space-y-3 bg-slate-50/50 p-4 rounded-xl border border-slate-200/50">
            <div className="flex items-center justify-between">
              <span className="text-[9px] font-black text-slate-400 uppercase tracking-widest flex items-center gap-1.5">
                <Bookmark className="w-3.5 h-3.5 text-indigo-500 fill-indigo-500/15" />
                <span>Presets</span>
              </span>
              <span className="text-[9px] text-slate-400 font-mono font-bold">{combinedPresets.length} TOTAL</span>
            </div>

            {combinedPresets.length > 0 ? (
              <div className="flex flex-col gap-1.5 max-h-36 overflow-y-auto pr-1">
                {combinedPresets.map((p) => {
                  const isActive = activePresetId === p.id;
                  return (
                    <div
                      key={p.id}
                      onClick={() => applyPreset(p)}
                      className={`group flex items-center justify-between px-2.5 py-1.5 rounded-lg border text-xs cursor-pointer transition-all ${
                        isActive
                          ? "bg-slate-900 text-white border-slate-900 font-black shadow-xs"
                          : "bg-white text-slate-700 border-slate-200/80 hover:border-slate-350 hover:bg-slate-50"
                      }`}
                    >
                      <span className="truncate max-w-[130px] flex items-center gap-1 font-bold">
                        {p.isCloud && (
                          <span title="Cloud Saved">
                            <Cloud className={`w-3 h-3 ${isActive ? "text-indigo-200" : "text-indigo-500 animate-pulse"}`} />
                          </span>
                        )}
                        {p.name}
                      </span>
                      <div className="flex items-center gap-1 opacity-80 group-hover:opacity-100 shrink-0">
                        {isActive && <Check className="w-3.5 h-3.5 stroke-[2.5]" />}
                        <button
                          type="button"
                          onClick={(e) => deletePreset(p.id, e)}
                          className={`p-0.5 rounded transition-colors ${
                            isActive
                              ? "hover:bg-slate-800 text-slate-200 hover:text-white"
                              : "hover:bg-slate-150 text-slate-400 hover:text-rose-500"
                          }`}
                          title="Delete Preset"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    </div>
                  );
                })}
              </div>
            ) : (
              <p className="text-[10px] text-slate-400 italic">No custom presets saved yet.</p>
            )}

            {/* Create Preset Form */}
            <form
              onSubmit={(e) => {
                e.preventDefault();
                savePreset(newPresetName);
              }}
              className="flex items-center gap-1.5 pt-2.5 border-t border-slate-200/50"
            >
              <input
                type="text"
                placeholder="Save current filter as..."
                value={newPresetName}
                onChange={(e) => setNewPresetName(e.target.value)}
                className="flex-1 bg-white border border-slate-250 hover:border-slate-350 focus:border-indigo-500 rounded-lg px-2.5 py-1.5 text-xs text-slate-800 placeholder:text-slate-400 focus:outline-none min-w-0 font-semibold"
                maxLength={22}
              />
              <button
                type="submit"
                disabled={!newPresetName.trim()}
                className="bg-indigo-600 hover:bg-indigo-700 disabled:bg-slate-200 disabled:text-slate-400 disabled:cursor-not-allowed text-white font-black text-[10px] uppercase tracking-wider px-3 py-1.5 rounded-lg cursor-pointer transition-all shrink-0 shadow-sm active:scale-95"
              >
                Save
              </button>
            </form>
          </div>

          {/* Full-text keyword search */}
          <div className="space-y-1.5">
            <label className="text-[9px] font-black text-slate-450 uppercase tracking-widest">Keywords</label>
            <div className="relative">
              <input
                type="text"
                placeholder="Search tender titles..."
                value={searchInput}
                onChange={(e) => setSearchInput(e.target.value)}
                className="w-full border border-slate-250 hover:border-slate-350 focus:border-indigo-500 rounded-xl pl-9 pr-3 py-2 text-xs text-slate-800 placeholder-slate-450 focus:outline-none font-semibold"
              />
              <Search className="absolute left-3 top-2.5 w-4 h-4 text-slate-400" />
            </div>
          </div>

          {/* Source Portal Checkboxes */}
          <div className="space-y-2">
            <label className="text-[9px] font-black text-slate-450 uppercase tracking-widest">Source Portals</label>
            <div className="space-y-1.5 max-h-40 overflow-y-auto pr-1">
              {portalsAvailable.map((portal) => (
                <label key={portal} className="flex items-center space-x-2 text-xs text-slate-700 cursor-pointer select-none font-bold">
                  <input
                    type="checkbox"
                    checked={selectedPortal.includes(portal)}
                    onChange={() => handleCheckbox(selectedPortal, setSelectedPortal, portal)}
                    className="rounded border-slate-300 text-indigo-600 focus:ring-indigo-500 w-3.5 h-3.5"
                  />
                  <span>{portal}</span>
                </label>
              ))}
            </div>
          </div>

          {/* State Selection */}
          <div className="space-y-2">
            <label className="text-[9px] font-black text-slate-455 uppercase tracking-widest">Operating States</label>
            <div className="space-y-1.5 max-h-40 overflow-y-auto pr-1">
              {statesAvailable.map((st) => (
                <label key={st} className="flex items-center space-x-2 text-xs text-slate-700 cursor-pointer select-none font-bold">
                  <input
                    type="checkbox"
                    checked={selectedState.includes(st)}
                    onChange={() => handleCheckbox(selectedState, setSelectedState, st)}
                    className="rounded border-slate-300 text-indigo-600 focus:ring-indigo-500 w-3.5 h-3.5"
                  />
                  <span>{st}</span>
                </label>
              ))}
            </div>
          </div>

          {/* Category Checkboxes */}
          <div className="space-y-2">
            <label className="text-[9px] font-black text-slate-450 uppercase tracking-widest">Categories</label>
            <div className="space-y-1.5">
              {categoriesAvailable.map((cat) => (
                <label key={cat} className="flex items-center space-x-2 text-xs text-slate-700 cursor-pointer select-none font-bold">
                  <input
                    type="checkbox"
                    checked={selectedCategory.includes(cat)}
                    onChange={() => handleCheckbox(selectedCategory, setSelectedCategory, cat)}
                    className="rounded border-slate-300 text-indigo-600 focus:ring-indigo-500 w-3.5 h-3.5"
                  />
                  <span>{cat}</span>
                </label>
              ))}
            </div>
          </div>

          {/* Budget Value Sliders */}
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <label className="text-[9px] font-black text-slate-450 uppercase tracking-widest">Tender Budget Range</label>
              <span className="text-xs font-mono font-bold text-slate-800">
                {minVal}Cr - {maxVal}Cr
              </span>
            </div>
            <div className="space-y-2.5">
              <div>
                <span className="text-[10px] text-slate-400 font-semibold block mb-0.5">Min Value: {minVal}Cr</span>
                <input
                  type="range"
                  min="0"
                  max="100"
                  step="1"
                  value={minVal}
                  onChange={(e) => {
                    const val = parseFloat(e.target.value);
                    setMinVal(val);
                    if (val > maxVal) setMaxVal(val);
                  }}
                  className="w-full h-1 bg-slate-200 rounded-lg appearance-none cursor-pointer accent-indigo-600 focus:outline-none"
                />
              </div>
              <div>
                <span className="text-[10px] text-slate-400 font-semibold block mb-0.5">Max Value: {maxVal}Cr</span>
                <input
                  type="range"
                  min="0"
                  max="100"
                  step="1"
                  value={maxVal}
                  onChange={(e) => {
                    const val = parseFloat(e.target.value);
                    setMaxVal(val);
                    if (val < minVal) setMinVal(val);
                  }}
                  className="w-full h-1 bg-slate-200 rounded-lg appearance-none cursor-pointer accent-indigo-600 focus:outline-none"
                />
              </div>

              {/* Quick Presets */}
              <div className="space-y-1.5 pt-1.5">
                <span className="text-[8.5px] text-slate-400 font-black uppercase tracking-wider block">Quick Presets</span>
                <div className="grid grid-cols-2 gap-1.5">
                  {[
                    { label: "Under 5 Cr", min: 0, max: 5 },
                    { label: "5Cr - 20Cr", min: 5, max: 20 },
                    { label: "20Cr - 50Cr", min: 20, max: 50 },
                    { label: "Over 50 Cr", min: 50, max: 100 },
                  ].map((item) => {
                    const isSelected = minVal === item.min && maxVal === item.max;
                    return (
                      <button
                        key={item.label}
                        type="button"
                        onClick={() => {
                          setMinVal(item.min);
                          setMaxVal(item.max);
                        }}
                        className={`text-[9.5px] font-black uppercase tracking-wider py-1.5 px-2 rounded-lg border transition-all cursor-pointer text-center ${
                          isSelected
                            ? "bg-[#090d16] text-white border-slate-900 shadow-xs"
                            : "bg-slate-50 text-slate-600 border-slate-200 hover:bg-slate-100 hover:border-slate-300"
                        }`}
                      >
                        {item.label}
                      </button>
                    );
                  })}
                </div>
              </div>
            </div>
          </div>

          {/* MSME Toggle */}
          <div className="pt-2">
            <label className="flex items-center space-x-2.5 cursor-pointer">
              <input
                type="checkbox"
                checked={msmeOnly}
                onChange={(e) => setMsmeOnly(e.target.checked)}
                className="rounded border-slate-350 text-indigo-650 focus:ring-indigo-500 w-4 h-4"
              />
              <div className="flex flex-col">
                <span className="text-xs font-bold text-slate-800">Exempted MSME Only</span>
                <span className="text-[10px] text-slate-400 font-medium">EMD or general bidding fee waivers</span>
              </div>
            </label>
          </div>

          {/* Deadline Proximity Selection */}
          <div className="space-y-2 pt-3 border-t border-slate-100">
            <label className="text-[9px] font-black text-slate-450 uppercase tracking-widest">Deadline Proximity</label>
            <div className="flex flex-col gap-1.5">
              <button
                type="button"
                onClick={() => setDeadlineProximity("")}
                className={`w-full text-left text-xs px-2.5 py-1.5 rounded-lg border transition-all cursor-pointer flex items-center justify-between font-bold ${
                  deadlineProximity === ""
                    ? "bg-indigo-50 text-indigo-700 border-indigo-200"
                    : "bg-white text-slate-700 border-slate-200 hover:bg-slate-50"
                }`}
              >
                <span>Any date</span>
                {deadlineProximity === "" && <Check className="w-3.5 h-3.5 text-indigo-600" />}
              </button>
              <div className="grid grid-cols-2 gap-1.5">
                {[
                  { label: "≤ 3 Days", value: "3" },
                  { label: "≤ 7 Days", value: "7" },
                  { label: "≤ 14 Days", value: "14" },
                  { label: "≤ 30 Days", value: "30" },
                ].map((opt) => (
                  <button
                    key={opt.value}
                    type="button"
                    onClick={() => setDeadlineProximity(opt.value)}
                    className={`text-[9.5px] font-black uppercase tracking-wider py-1.5 px-2 rounded-lg border text-center transition-all cursor-pointer ${
                      deadlineProximity === opt.value
                        ? "bg-[#090d16] text-white border-slate-900"
                        : "bg-white text-slate-650 border-slate-200 hover:bg-slate-50"
                    }`}
                  >
                    {opt.label}
                  </button>
                ))}
              </div>
            </div>
          </div>

          {/* Deadline Status Code */}
          <div className="space-y-1.5 pt-2">
            <label className="text-[9px] font-black text-slate-450 uppercase tracking-widest">Tender Status</label>
            <select
              value={selectedStatus}
              onChange={(e) => setSelectedStatus(e.target.value)}
              className="w-full bg-white border border-slate-200 rounded-lg p-2 text-xs text-slate-705 font-bold cursor-pointer"
            >
              <option value="ACTIVE">Active (Ingestion Open)</option>
              <option value="CLOSED">Closed/Finished</option>
              <option value="AWARDED">Successfully Concluded</option>
            </select>
          </div>
        </aside>

        {/* Main Feed Content Area */}
        <main className="flex-1 space-y-4">
          {/* Interactive Top Search Bar block */}
          <div className="bg-white/60 backdrop-blur-md border border-slate-200/40 p-4.5 rounded-2xl shadow-xs flex flex-col md:flex-row gap-4 items-center">
            <div className="relative flex-1 w-full">
              <input
                id="tender-main-search-input"
                type="text"
                placeholder="Search by keywords, project types, states, or specific procurement departments..."
                value={searchInput}
                onChange={(e) => setSearchInput(e.target.value)}
                className="w-full bg-slate-50 hover:bg-slate-100/50 focus:bg-white border border-slate-200 focus:border-indigo-500 rounded-xl pl-10 pr-16 py-3 text-xs text-slate-800 placeholder:text-slate-400 focus:outline-none transition-all focus:ring-2 focus:ring-indigo-100 font-semibold"
              />
              <Search className="absolute left-3.5 top-3.5 w-4 h-4 text-slate-450" />
              {searchInput && (
                <button
                  type="button"
                  id="clear-search-btn"
                  onClick={() => {
                    setSearchInput("");
                    setSearchTerm("");
                  }}
                  className="absolute right-3.5 top-2.5 text-[9px] font-black uppercase tracking-widest text-[#1B4FD8] hover:text-blue-800 bg-[#1B4FD8]/10 hover:bg-[#1B4FD8]/15 px-3 py-1.5 rounded-lg transition-colors cursor-pointer"
                >
                  Clear
                </button>
              )}
            </div>
            <div className="flex gap-1.5 flex-wrap md:flex-nowrap w-full md:w-auto shrink-0 items-center justify-start md:justify-end">
              <span className="text-[9px] text-slate-400 font-black uppercase tracking-widest block mr-1">Hot tags:</span>
              {[
                { label: "Roads", val: "Road" },
                { label: "Civil Build", val: "Construction" },
                { label: "Solar Energy", val: "Solar" },
                { label: "Electrical", val: "Electrical" }
              ].map((hot) => (
                <button
                  key={hot.val}
                  type="button"
                  id={`hot-tag-${hot.val.toLowerCase()}`}
                  onClick={() => {
                    setSearchInput(hot.val);
                    setSearchTerm(hot.val);
                  }}
                  className={`text-[9.5px] font-black uppercase tracking-wider py-1.5 px-3 rounded-lg border transition-all cursor-pointer ${
                    searchInput.toLowerCase() === hot.val.toLowerCase()
                      ? "bg-slate-900 text-white border-slate-900 shadow-xs"
                      : "bg-slate-50 text-slate-655 border-slate-200 hover:bg-slate-100 hover:border-slate-350"
                  }`}
                >
                  {hot.label}
                </button>
              ))}
            </div>
          </div>

          {/* Sorting and display toggle header */}
          <div className="flex items-center justify-between bg-white/60 backdrop-blur-md px-5 py-4 rounded-2xl border border-slate-200/40 shadow-xs">
            <span className="text-xs font-bold text-slate-450 uppercase tracking-wider">
              {isLoading ? "Retrieving tenders..." : `Identified ${filteredTenders.length} match contracts`}
            </span>

            <div className="flex items-center space-x-4">
              <div className="flex items-center space-x-2">
                <span className="text-xs text-slate-450 font-bold uppercase tracking-wider">Sort:</span>
                <select
                  value={sortBy}
                  onChange={(e) => setSortBy(e.target.value)}
                  className="bg-white border border-slate-200 rounded-lg p-1.5 text-xs text-slate-705 font-bold cursor-pointer focus:outline-none"
                >
                  <option value="Newest">Newest First</option>
                  <option value="Value_Desc">Highest Budget</option>
                  <option value="Deadline_Asc">Deadline Asc</option>
                </select>
              </div>

              <div className="flex items-center border border-slate-200 rounded-lg overflow-hidden divide-x divide-slate-200 shadow-xs bg-white">
                <button
                  onClick={() => setViewMode("list")}
                  className={`p-2 transition-colors cursor-pointer ${viewMode === "list" ? "bg-slate-100 text-indigo-600" : "bg-white text-slate-400"}`}
                >
                  <List className="w-4 h-4" />
                </button>
                <button
                  onClick={() => setViewMode("grid")}
                  className={`p-2 transition-colors cursor-pointer ${viewMode === "grid" ? "bg-slate-100 text-indigo-600" : "bg-white text-slate-400"}`}
                >
                  <Grid className="w-4 h-4" />
                </button>
              </div>
            </div>
          </div>

          {/* Display Tenders */}
          {isLoading ? (
            /* Skeleton Feed */
            <div className="space-y-4">
              {[1, 2, 3].map((x) => (
                <div key={x} className="bg-white border border-slate-200/60 rounded-2xl p-6 shadow-xs space-y-3.5 animate-pulse">
                  <div className="h-5 bg-slate-200 rounded w-2/3"></div>
                  <div className="h-4 bg-slate-150 rounded w-1/3"></div>
                  <div className="grid grid-cols-3 gap-2.5 mt-2 pt-2 border-t border-slate-100">
                    <div className="h-4 bg-slate-50 rounded"></div>
                    <div className="h-4 bg-slate-50 rounded"></div>
                    <div className="h-4 bg-slate-50 rounded"></div>
                  </div>
                </div>
              ))}
            </div>
          ) : filteredTenders.length === 0 ? (
            /* Proper Empty State */
            <div className="text-center py-24 bg-white/60 backdrop-blur-md rounded-2xl border border-slate-200/40 shadow-xs space-y-4">
              <div className="bg-slate-100 p-4.5 rounded-full w-fit mx-auto text-slate-400">
                <Filter className="w-8 h-8 text-indigo-500" />
              </div>
              <h3 className="text-lg font-black text-slate-800 uppercase tracking-tight font-heading">No Contracts Identified</h3>
              <p className="text-xs text-slate-500 max-w-sm mx-auto leading-relaxed font-semibold">
                Try readjusting the budget thresholds or extending trade categories in your criteria panel.
              </p>
              <button
                onClick={() => {
                  setSearchInput("");
                  setSearchTerm("");
                  setSelectedPortal([]);
                  setSelectedState([]);
                  setSelectedCategory([]);
                  setMinVal(0);
                  setMaxVal(100);
                  setDeadlineProximity("");
                }}
                className="bg-indigo-600 hover:bg-indigo-700 text-white font-black text-xs uppercase tracking-widest px-6 py-3 rounded-xl transition cursor-pointer shadow-md"
              >
                Reset Parameters
              </button>
            </div>
          ) : viewMode === "list" ? (
            /* List View Representation */
            <div className="space-y-4">
              {displayedTenders.map((tender) => {
                const match = matches.find((m) => m.tenderId === tender.id);
                const countdown = getCountdown(tender.bidSubmissionDeadline);

                return (
                  <div
                    key={tender.id}
                    onClick={() => onSelectTender(tender.id)}
                    className="glass-panel hover-glow rounded-2xl p-6 shadow-xs flex flex-col md:flex-row justify-between items-start md:items-center gap-6"
                  >
                    <div className="space-y-3 flex-1">
                      <div className="flex flex-wrap gap-2.5 items-center">
                        <span className={`text-[9px] font-black border px-2.5 py-1 rounded-lg uppercase tracking-wider ${getPortalColor(tender.sourcePortal)}`}>
                          {tender.sourcePortal}
                        </span>
                        <span className="text-[10.5px] text-slate-400 font-mono font-bold">ID: {tender.externalId}</span>
                        {tender.eligibilityCriteria.msmeOnly && (
                          <span className="bg-emerald-500/10 text-emerald-600 text-[9px] font-black px-2.5 py-1 rounded-lg border border-emerald-500/20 uppercase tracking-wide">
                            MSME Exempted
                          </span>
                        )}
                      </div>

                      <h3 className="font-extrabold text-base text-slate-800 leading-snug hover:text-indigo-650 transition-colors font-heading">
                        {tender.title}
                      </h3>

                      <div className="flex flex-wrap gap-x-5 gap-y-1.5 text-xs text-slate-500 items-center font-bold">
                        <span className="flex items-center space-x-1.5">
                          <MapPin className="w-3.5 h-3.5 text-slate-400" />
                          <span>{tender.location}</span>
                        </span>
                        <span className="flex items-center space-x-1.5">
                          <DollarSign className="w-3.5 h-3.5 text-slate-455" />
                          <span>Budget: <span className="text-slate-800 font-black font-mono">{formatIndianCurrency(tender.tenderValue ? tender.tenderValue * 10000000 : null)}</span></span>
                        </span>
                        <span className="flex items-center space-x-1.5">
                          <Calendar className="w-3.5 h-3.5 text-slate-400" />
                          <span>Published: {formatDate(tender.publishedDate)}</span>
                        </span>
                      </div>
                    </div>

                    {/* Scoring and Countdown Block */}
                    <div className="flex flex-row md:flex-col items-center md:items-end gap-4.5 w-full md:w-auto border-t md:border-t-0 pt-4 md:pt-0 border-slate-150 justify-between shrink-0">
                      {/* Compatibility Score badge */}
                      {match && (
                        <div className="flex flex-col items-center justify-center px-4.5 py-2.5 bg-gradient-to-b from-emerald-500/10 to-emerald-500/5 rounded-2xl border border-emerald-500/20 min-w-[80px] shadow-xs">
                          <span className="text-emerald-700 text-lg font-black">{match.matchScore}%</span>
                          <span className="text-[8px] font-black text-emerald-600 uppercase tracking-widest">Match</span>
                        </div>
                      )}

                      {/* Countdown Remaining Badge */}
                      <div className="flex items-center space-x-1.5">
                        <Clock className="w-3.5 h-3.5 text-slate-400" />
                        <span className={`text-[10px] font-black uppercase tracking-wider px-3 py-1.5 rounded-xl border ${countdown.colorClass}`}>
                          {countdown.text}
                        </span>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          ) : (
            /* Grid View Representation */
            <div className="grid md:grid-cols-2 gap-5">
              {displayedTenders.map((tender) => {
                const match = matches.find((m) => m.tenderId === tender.id);
                const countdown = getCountdown(tender.bidSubmissionDeadline);

                return (
                  <div
                    key={tender.id}
                    onClick={() => onSelectTender(tender.id)}
                    className="glass-panel hover-glow rounded-2xl p-5 shadow-xs flex flex-col justify-between space-y-4"
                  >
                    <div className="space-y-3">
                      <div className="flex items-center justify-between">
                        <span className={`text-[9px] font-black border px-2.5 py-1 rounded-lg uppercase tracking-wider ${getPortalColor(tender.sourcePortal)}`}>
                          {tender.sourcePortal}
                        </span>
                        {match && (
                          <div className="flex items-center justify-center px-3 py-1 bg-emerald-500/10 rounded-lg border border-emerald-500/20 shadow-xs">
                            <span className="text-emerald-700 text-[10px] font-black uppercase tracking-wider">{match.matchScore}% Match</span>
                          </div>
                        )}
                      </div>

                      <h3 className="font-extrabold text-sm text-slate-800 line-clamp-2 hover:text-indigo-650 transition-colors font-heading leading-snug">
                        {tender.title}
                      </h3>

                      <p className="text-xs text-slate-500 line-clamp-3 leading-relaxed font-semibold">
                        {tender.workDescription || "No detailed synopsis available. Click to inspect raw RFP parameters."}
                      </p>
                    </div>

                    <div className="pt-3.5 border-t border-slate-100 flex items-center justify-between text-xs font-bold">
                      <div className="flex flex-col">
                        <span className="text-[9px] text-slate-400 font-black uppercase tracking-wider">Value</span>
                        <span className="font-black text-slate-800 font-mono mt-0.5">{formatIndianCurrency(tender.tenderValue ? tender.tenderValue * 10000000 : null)}</span>
                      </div>
                      <div className="flex flex-col items-end">
                        <span className="text-[9px] text-slate-400 font-black uppercase tracking-wider">Deadline</span>
                        <span className={`font-black px-2.5 py-1.5 border rounded-lg mt-0.5 text-[9px] uppercase tracking-wider ${countdown.colorClass}`}>
                          {countdown.text}
                        </span>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          )}

          {/* Dynamic paywall check */}
          {hasHiddenTenders && (
            <div className="bg-gradient-to-r from-blue-500/5 to-indigo-500/5 border-2 border-dashed border-indigo-500/25 p-7 rounded-2xl text-center space-y-4 shadow-sm mt-6">
              <div className="bg-white p-3 rounded-full w-fit mx-auto border border-indigo-500/15 shadow-sm">
                <Sparkles className="w-5 h-5 text-indigo-600 animate-pulse" />
              </div>
              <div className="space-y-1.5">
                {isTrialUser ? (
                  <>
                    <h4 className="font-black text-slate-800 uppercase tracking-wider text-xs">Unlock Uncapped Feed matches</h4>
                    <p className="text-xs text-slate-550 max-w-sm mx-auto leading-relaxed font-semibold">
                      Your 10-day <b>Starter Trial</b> is capped at 10 matches. Upgrade to the <b>Professional Plan</b> to access unrestricted tenders.
                    </p>
                  </>
                ) : (
                  <>
                    <h4 className="font-black text-slate-800 uppercase tracking-wider text-xs">Reveal {filteredTenders.length - 5} More Matches!</h4>
                    <p className="text-xs text-slate-550 max-w-md mx-auto leading-relaxed font-semibold">
                      Your current free plan has limitations. Upgrade to the <b>Professional Plan</b> to explore unrestricted tender matches.
                    </p>
                  </>
                )}
              </div>
              <button
                type="button"
                onClick={onNavigateToBilling}
                className="bg-indigo-600 hover:bg-indigo-700 text-white font-black text-xs uppercase tracking-widest px-6 py-3 rounded-xl cursor-pointer transition-all active:scale-95 shadow-md shadow-indigo-600/10 border border-indigo-500/10"
              >
                {isTrialUser ? "Upgrade Now to View All" : "Unlock Uncapped Matches"}
              </button>
            </div>
          )}
        </main>
      </div>
    </div>
  );
}
