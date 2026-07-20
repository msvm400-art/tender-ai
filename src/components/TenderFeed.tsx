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
        return "bg-blue-100 text-blue-850 border-blue-200";
      case "GEM":
        return "bg-emerald-100 text-emerald-850 border-emerald-200";
      case "RAILWAYS":
        return "bg-orange-100 text-orange-850 border-orange-200";
      case "NHAI":
        return "bg-purple-100 text-purple-850 border-purple-200";
      case "STATE_PWD":
        return "bg-indigo-100 text-indigo-850 border-indigo-200";
      default:
        return "bg-slate-100 text-slate-705 border-slate-200";
    }
  };

  const getScoreBadgeColor = (score: number) => {
    if (score >= 80) return "bg-green-100 text-green-800 border-green-200";
    if (score >= 60) return "bg-amber-100 text-amber-800 border-amber-200";
    if (score >= 40) return "bg-orange-100 text-orange-800 border-orange-200";
    return "bg-red-100 text-red-800 border-red-200";
  };

  return (
    <div className="space-y-6 w-full">
      {/* Day 2 Trial Warning Blocker block */}
      {user?.trialDaysElapsed >= 2 && user?.plan !== "FREE" && (
        <div className="bg-gradient-to-r from-amber-50 to-amber-100 border border-amber-300 p-4.5 rounded-2xl flex flex-col sm:flex-row gap-4 items-start sm:items-center justify-between shadow-xs animate-slide-down">
          <div className="flex gap-3 items-center">
            <span className="text-xl">🛠️</span>
            <div>
              <h4 className="font-extrabold text-sm text-amber-905 leading-none">Day 2 Simulation Checkpoint: Onboarding Checklist block</h4>
              <p className="text-xs text-amber-700 font-medium leading-normal mt-1 max-w-3xl">
                Onboarding check: ensure your annual turnovers, msme classifications and experience parameters are fully populated in the <b>Company Criteria</b> panel to optimize civil eligibility accuracy!
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onNavigateToBilling}
            className="bg-amber-950/90 hover:bg-amber-900 text-white font-extrabold text-xs px-4 py-2 rounded-xl border border-amber-900/30 cursor-pointer active:scale-95 transition-all text-nowrap"
          >
            Review Simulation Panel
          </button>
        </div>
      )}

      <div className="flex flex-col lg:flex-row gap-6">
        {/* Mobile Filters Toggle Button */}
        <button
          type="button"
          onClick={() => setIsMobileFiltersOpen(!isMobileFiltersOpen)}
          className="lg:hidden w-full flex items-center justify-center space-x-2 bg-white border border-slate-200 text-slate-700 font-bold text-sm py-3 px-4 rounded-xl shadow-sm cursor-pointer active:bg-slate-50 transition-all"
        >
          <Filter className="w-4 h-4 text-blue-600" />
          <span>{isMobileFiltersOpen ? "Hide Filter Options" : "Show Search Filters"}</span>
        </button>

        {/* Sidebar Filters */}
        <aside className={`w-full lg:w-72 bg-white/60 backdrop-blur-md rounded-2xl border border-white/30 p-5 shadow-sm h-fit space-y-6 ${isMobileFiltersOpen ? "block" : "hidden lg:block"}`}>
        <div className="flex items-center justify-between border-b border-slate-100 pb-3">
          <div className="flex items-center space-x-2 text-slate-900 font-bold text-sm">
            <Filter className="w-4 h-4 text-blue-600" />
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
            className="text-xs text-blue-600 hover:text-blue-800 font-medium cursor-pointer"
          >
            Clear All
          </button>
        </div>

        {/* Saved Filter Presets Widget */}
        <div className="space-y-3 bg-slate-50/70 p-3.5 rounded-xl border border-slate-150">
          <div className="flex items-center justify-between">
            <span className="text-[11px] font-extrabold text-slate-400 uppercase tracking-wider flex items-center gap-1.5">
              <Bookmark className="w-3.5 h-3.5 text-blue-500 fill-blue-100" />
              <span>Saved Presets</span>
            </span>
            <span className="text-[10px] text-slate-400 font-mono font-semibold">{combinedPresets.length} Total</span>
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
                        ? "bg-blue-600 text-white border-blue-600 font-bold shadow-xs"
                        : "bg-white text-slate-700 border-slate-200/80 hover:border-slate-350 hover:bg-slate-50"
                    }`}
                  >
                    <span className="truncate max-w-[130px] flex items-center gap-1">
                      {p.isCloud && (
                        <span title="Cloud Saved">
                          <Cloud className={`w-3 h-3 ${isActive ? "text-blue-200" : "text-blue-500 animate-pulse"}`} />
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
                            ? "hover:bg-blue-700 text-blue-100 hover:text-white"
                            : "hover:bg-slate-150 text-slate-400 hover:text-red-650"
                        }`}
                        title={p.isCloud ? "Delete from Cloud" : "Delete Preset"}
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
            className="flex items-center gap-1.5 pt-1.5 border-t border-slate-200/60"
          >
            <input
              type="text"
              placeholder="Save current filters as..."
              value={newPresetName}
              onChange={(e) => setNewPresetName(e.target.value)}
              className="flex-1 bg-white border border-slate-250 hover:border-slate-350 focus:border-blue-500 rounded-lg px-2.5 py-1.5 text-xs text-slate-800 placeholder:text-slate-400 focus:outline-none min-w-0"
              maxLength={22}
            />
            <button
              type="submit"
              disabled={!newPresetName.trim()}
              className="bg-blue-600 hover:bg-blue-700 disabled:bg-slate-200 disabled:text-slate-400 disabled:cursor-not-allowed text-white font-bold text-xs px-2.5 py-1.5 rounded-lg cursor-pointer transition-all shrink-0 shadow-sm active:scale-95"
              title="Save current parameters as preset"
            >
              Save
            </button>
          </form>
        </div>

        {/* Full-text keyword search */}
        <div className="space-y-1.5">
          <label className="text-[11px] font-bold text-slate-400 uppercase tracking-wider">Search Keywords</label>
          <div className="relative">
            <input
              type="text"
              placeholder="e.g. Solar, Roads, IIT Patna..."
              value={searchInput}
              onChange={(e) => setSearchInput(e.target.value)}
              className="w-full border border-slate-250 hover:border-slate-350 rounded-lg pl-9 pr-3 py-2 text-xs text-slate-800 focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
            <Search className="absolute left-3 top-2.5 w-4 h-4 text-slate-400" />
          </div>
        </div>

        {/* Source Portal Checkboxes */}
        <div className="space-y-2">
          <label className="text-[11px] font-bold text-slate-400 uppercase tracking-wider">Source Portal</label>
          <div className="space-y-1.5 max-h-40 overflow-y-auto pr-1">
            {portalsAvailable.map((portal) => (
              <label key={portal} className="flex items-center space-x-2 text-xs text-slate-700 cursor-pointer select-none">
                <input
                  type="checkbox"
                  checked={selectedPortal.includes(portal)}
                  onChange={() => handleCheckbox(selectedPortal, setSelectedPortal, portal)}
                  className="rounded border-slate-300 text-blue-600 focus:ring-blue-500 w-3.5 h-3.5"
                />
                <span>{portal}</span>
              </label>
            ))}
          </div>
        </div>

        {/* State Selection */}
        <div className="space-y-2">
          <label className="text-[11px] font-bold text-slate-400 uppercase tracking-wider">Work Location (State)</label>
          <div className="space-y-1.5 max-h-40 overflow-y-auto pr-1">
            {statesAvailable.map((st) => (
              <label key={st} className="flex items-center space-x-2 text-xs text-slate-700 cursor-pointer select-none">
                <input
                  type="checkbox"
                  checked={selectedState.includes(st)}
                  onChange={() => handleCheckbox(selectedState, setSelectedState, st)}
                  className="rounded border-slate-300 text-blue-600 focus:ring-blue-500 w-3.5 h-3.5"
                />
                <span>{st}</span>
              </label>
            ))}
          </div>
        </div>

        {/* Category Checkboxes */}
        <div className="space-y-2">
          <label className="text-[11px] font-bold text-slate-400 uppercase tracking-wider">Industrial Category</label>
          <div className="space-y-1.5">
            {categoriesAvailable.map((cat) => (
              <label key={cat} className="flex items-center space-x-2 text-xs text-slate-700 cursor-pointer select-none">
                <input
                  type="checkbox"
                  checked={selectedCategory.includes(cat)}
                  onChange={() => handleCheckbox(selectedCategory, setSelectedCategory, cat)}
                  className="rounded border-slate-300 text-blue-600 focus:ring-blue-500 w-3.5 h-3.5"
                />
                <span>{cat}</span>
              </label>
            ))}
          </div>
        </div>

        {/* Budget Value Sliders */}
        <div className="space-y-3">
          <div className="flex items-center justify-between">
            <label className="text-[11px] font-bold text-slate-400 uppercase tracking-wider">Tender Budget Range</label>
            <span className="text-xs font-mono text-slate-800 font-bold">
              {minVal}Cr - {maxVal}Cr
            </span>
          </div>
          <div className="space-y-2.5">
            <div>
              <span className="text-[10px] text-slate-400 block mb-0.5">Min Value (₹ Crores): {minVal}Cr</span>
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
                className="w-full h-1.5 bg-slate-200 rounded-lg appearance-none cursor-pointer accent-blue-600 focus:outline-none"
              />
            </div>
            <div>
              <span className="text-[10px] text-slate-400 block mb-0.5">Max Value (₹ Crores): {maxVal}Cr</span>
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
                className="w-full h-1.5 bg-slate-200 rounded-lg appearance-none cursor-pointer accent-blue-600 focus:outline-none"
              />
            </div>
            <div className="grid grid-cols-2 gap-2 pt-1">
              <div>
                <label className="text-[9px] text-slate-400 font-bold uppercase block mb-1">Min (Cr)</label>
                <input
                  type="number"
                  min="0"
                  max="100"
                  value={minVal}
                  onChange={(e) => {
                    const val = parseFloat(e.target.value) || 0;
                    setMinVal(val);
                    if (val > maxVal) setMaxVal(val);
                  }}
                  className="w-full bg-slate-50 border border-slate-200 hover:border-slate-300 rounded-lg p-1.5 text-xs font-bold text-slate-700 text-center focus:outline-none"
                />
              </div>
              <div>
                <label className="text-[9px] text-slate-400 font-bold uppercase block mb-1">Max (Cr)</label>
                <input
                  type="number"
                  min="0"
                  max="100"
                  value={maxVal}
                  onChange={(e) => {
                    const val = parseFloat(e.target.value) || 0;
                    setMaxVal(val);
                    if (val < minVal) setMinVal(val);
                  }}
                  className="w-full bg-slate-50 border border-slate-200 hover:border-slate-300 rounded-lg p-1.5 text-xs font-bold text-slate-700 text-center focus:outline-none"
                />
              </div>
            </div>

            {/* Quick Presets */}
            <div className="space-y-1 pt-1">
              <span className="text-[9.5px] text-slate-400 font-bold uppercase tracking-wider block">Quick Cost Presets</span>
              <div className="grid grid-cols-2 gap-1.5">
                {[
                  { label: "Under ₹5 Cr", min: 0, max: 5 },
                  { label: "₹5Cr - ₹20Cr", min: 5, max: 20 },
                  { label: "₹20Cr - ₹50Cr", min: 20, max: 50 },
                  { label: "Over ₹50 Cr", min: 50, max: 100 },
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
                      className={`text-[9.5px] font-bold py-1.5 px-2 rounded-lg border transition-all cursor-pointer text-center ${
                        isSelected
                          ? "bg-blue-600 text-white border-blue-600 shadow-xs"
                          : "bg-slate-50 text-slate-655 border-slate-200 hover:bg-slate-100/80 hover:border-slate-300"
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
              className="rounded border-slate-300 text-blue-600 focus:ring-blue-500 w-4 h-4"
            />
            <div className="flex flex-col">
              <span className="text-xs font-semibold text-slate-900">Exempted MSME Only</span>
              <span className="text-[10px] text-slate-400">EMD or general bidding fee waivers</span>
            </div>
          </label>
        </div>

        {/* Deadline Proximity Selection */}
        <div className="space-y-2 pt-2 border-t border-slate-100">
          <label className="text-[11px] font-bold text-slate-400 uppercase tracking-wider">Deadline Proximity</label>
          <div className="flex flex-col gap-1.5">
            <button
              type="button"
              onClick={() => setDeadlineProximity("")}
              className={`w-full text-left text-xs px-2.5 py-1.5 rounded-lg border transition-all cursor-pointer flex items-center justify-between ${
                deadlineProximity === ""
                  ? "bg-blue-50 text-blue-700 border-blue-250 font-bold"
                  : "bg-white text-slate-700 border-slate-200 hover:bg-slate-50"
              }`}
            >
              <span>Any submission date</span>
              {deadlineProximity === "" && <Check className="w-3.5 h-3.5 text-blue-600" />}
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
                  className={`text-[10px] font-medium py-1.5 px-2 rounded-lg border text-center transition-all cursor-pointer flex items-center justify-center space-x-1 ${
                    deadlineProximity === opt.value
                      ? "bg-blue-600 text-white border-blue-600 font-semibold shadow-xs"
                      : "bg-white text-slate-600 border-slate-200 hover:bg-slate-50"
                  }`}
                >
                  <span>{opt.label}</span>
                </button>
              ))}
            </div>
          </div>
        </div>

        {/* Deadline Status Code */}
        <div className="space-y-1.5 pt-2">
          <label className="text-[11px] font-bold text-slate-400 uppercase tracking-wider">Tender Status</label>
          <select
            value={selectedStatus}
            onChange={(e) => setSelectedStatus(e.target.value)}
            className="w-full bg-white border border-slate-200 rounded-lg p-2 text-xs text-slate-700"
          >
            <option value="ACTIVE">Active (Bidding Channel Open)</option>
            <option value="CLOSED">Closed/Finished</option>
            <option value="AWARDED">Successfully Concluded</option>
          </select>
        </div>
      </aside>

      {/* Main Feed Content Area */}
      <main className="flex-1 space-y-4">
        {/* Interactive Top Search Bar block */}
        <div className="bg-white/60 backdrop-blur-md border border-white/25 p-4.5 rounded-2xl shadow-sm flex flex-col md:flex-row gap-4 items-center">
          <div className="relative flex-1 w-full">
            <input
              id="tender-main-search-input"
              type="text"
              placeholder="Search by keywords, project types, location states, or specific procurement departments..."
              value={searchInput}
              onChange={(e) => setSearchInput(e.target.value)}
              className="w-full bg-slate-50 hover:bg-slate-100/60 focus:bg-white border border-slate-200 focus:border-blue-500 rounded-xl pl-10 pr-16 py-3 text-xs text-slate-800 placeholder:text-slate-400 focus:outline-none transition-all focus:ring-2 focus:ring-blue-100"
            />
            <Search className="absolute left-3.5 top-3.5 w-4 h-4 text-slate-400" />
            {searchInput && (
              <button
                type="button"
                id="clear-search-btn"
                onClick={() => {
                  setSearchInput("");
                  setSearchTerm("");
                }}
                className="absolute right-3.5 top-2 text-[11px] font-extrabold text-blue-600 hover:text-blue-800 bg-blue-55/60 hover:bg-blue-100 px-2 py-1 rounded-md transition-colors cursor-pointer"
              >
                Clear
              </button>
            )}
          </div>
          <div className="flex gap-1.5 flex-wrap md:flex-nowrap w-full md:w-auto shrink-0 items-center justify-start md:justify-end">
            <span className="text-[10px] text-slate-400 font-bold uppercase tracking-wider block mr-1">Hot Tags:</span>
            {[
              { label: "Roads", val: "Road" },
              { label: "Construction", val: "Construction" },
              { label: "Solar", val: "Solar" },
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
                className={`text-[10.5px] font-bold py-1 px-2.5 rounded-lg border transition-all cursor-pointer ${
                  searchInput.toLowerCase() === hot.val.toLowerCase()
                    ? "bg-blue-600 text-white border-blue-600 shadow-xs"
                    : "bg-slate-50 text-slate-600 border-slate-200 hover:bg-slate-100 hover:border-slate-350"
                }`}
              >
                {hot.label}
              </button>
            ))}
          </div>
        </div>

        {/* Sorting and display toggle header */}
        <div className="flex items-center justify-between bg-white/60 backdrop-blur-md px-5 py-4 rounded-2xl border border-white/25 shadow-xs">
          <span className="text-xs font-medium text-slate-500">
            {isLoading ? "Retrieving tenders..." : `Identified ${filteredTenders.length} match contracts`}
          </span>

          <div className="flex items-center space-x-4">
            <div className="flex items-center space-x-2">
              <span className="text-xs text-slate-500 font-medium">Sort:</span>
              <select
                value={sortBy}
                onChange={(e) => setSortBy(e.target.value)}
                className="bg-white border border-slate-200 rounded-lg p-1.5 text-xs text-slate-700 font-medium focus:outline-none"
              >
                <option value="Newest">Newest First</option>
                <option value="Value_Desc">Highest Budget Value</option>
                <option value="Deadline_Asc">Bid Submission Deadline</option>
              </select>
            </div>

            <div className="flex items-center border border-slate-200 rounded-lg overflow-hidden divide-x divide-slate-200">
              <button
                onClick={() => setViewMode("list")}
                className={`p-2 transition-colors cursor-pointer ${viewMode === "list" ? "bg-slate-50 text-blue-600" : "bg-white text-slate-500"}`}
              >
                <List className="w-4 h-4" />
              </button>
              <button
                onClick={() => setViewMode("grid")}
                className={`p-2 transition-colors cursor-pointer ${viewMode === "grid" ? "bg-slate-50 text-blue-600" : "bg-white text-slate-500"}`}
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
              <div key={x} className="bg-white border border-slate-200 rounded-xl p-5 shadow-sm space-y-3 animate-pulse">
                <div className="h-5 bg-slate-200 rounded w-2/3"></div>
                <div className="h-4 bg-slate-100 rounded w-1/3"></div>
                <div className="grid grid-cols-3 gap-2 mt-2 pt-2 border-t border-slate-50">
                  <div className="h-4 bg-slate-50 rounded"></div>
                  <div className="h-4 bg-slate-50 rounded"></div>
                  <div className="h-4 bg-slate-50 rounded"></div>
                </div>
              </div>
            ))}
          </div>
        ) : filteredTenders.length === 0 ? (
          /* Proper Empty State */
          <div className="text-center py-20 bg-white rounded-xl border border-slate-200 shadow-sm space-y-4">
            <div className="bg-slate-100 p-4 rounded-full w-fit mx-auto text-slate-400">
              <Filter className="w-8 h-8" />
            </div>
            <h3 className="text-lg font-bold text-slate-900">No Matching Bidding Portals Found</h3>
            <p className="text-sm text-slate-500 max-w-sm mx-auto">
              Try readjusting the budget thresholds or extending operational trade categories in your criteria panel.
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
              className="bg-blue-600 text-white font-semibold text-xs px-4 py-2.5 rounded-lg hover:bg-blue-700 transition"
            >
              Reset Search Parameters
            </button>
          </div>
        ) : viewMode === "list" ? (
          /* List View Representation */
          <div className="space-y-4">
            {displayedTenders.map((tender) => {
              // Get standard match parameters for this tender
              const match = matches.find((m) => m.tenderId === tender.id);
              const countdown = getCountdown(tender.bidSubmissionDeadline);

              return (
                <div
                  key={tender.id}
                  onClick={() => onSelectTender(tender.id)}
                  className="bg-white/65 backdrop-blur-md border border-white/30 hover:bg-white/80 hover:border-blue-400/60 hover:shadow-lg rounded-2xl p-6 shadow-xs transition-all duration-300 cursor-pointer flex flex-col md:flex-row justify-between items-start md:items-center gap-6"
                >
                  <div className="space-y-2.5 flex-1">
                    <div className="flex flex-wrap gap-2 items-center">
                      <span className={`text-[10px] font-bold border px-2.5 py-0.5 rounded-full uppercase tracking-wider ${getPortalColor(tender.sourcePortal)}`}>
                        {tender.sourcePortal}
                      </span>
                      <span className="text-xs text-slate-400 font-mono">ID: {tender.externalId}</span>
                      {tender.eligibilityCriteria.msmeOnly && (
                        <span className="bg-emerald-50 text-emerald-700 text-[10px] font-bold px-2.5 py-0.5 rounded-full border border-emerald-100">
                          MSME Preferential
                        </span>
                      )}
                    </div>

                    <h3 className="font-bold text-base text-slate-800 leading-snug hover:text-blue-600 transition-colors">
                      {tender.title}
                    </h3>

                    <div className="flex flex-wrap gap-x-5 gap-y-1.5 text-xs text-slate-500 items-center">
                      <span className="flex items-center space-x-1">
                        <MapPin className="w-3.5 h-3.5 text-slate-400" />
                        <span>{tender.location}</span>
                      </span>
                      <span className="flex items-center space-x-1">
                        <DollarSign className="w-3.5 h-3.5 text-slate-400" />
                        <span>Est: <span className="text-slate-800 font-bold">{formatIndianCurrency(tender.tenderValue ? tender.tenderValue * 10000000 : null)}</span></span>
                      </span>
                      <span className="flex items-center space-x-1">
                        <Calendar className="w-3.5 h-3.5 text-slate-400" />
                        <span>Published: {formatDate(tender.publishedDate)}</span>
                      </span>
                    </div>
                  </div>

                  {/* Scoring and Countdown Block */}
                  <div className="flex flex-row md:flex-col items-center md:items-end gap-4 w-full md:w-auto border-t md:border-t-0 pt-3 md:pt-0 border-slate-150 justify-between shrink-0">
                    {/* Compatibility Score badge */}
                    {match && (
                      <div className="flex flex-col items-center justify-center px-4 py-1.5 bg-gradient-to-b from-green-50 to-green-50/50 rounded-xl border border-green-100 min-w-[72px] shadow-xs">
                        <span className="text-green-700 text-lg font-black">{match.matchScore}%</span>
                        <span className="text-[8px] font-extrabold text-green-600 uppercase tracking-tight">Match</span>
                      </div>
                    )}

                    {/* Countdown Remaining Badge */}
                    <div className="flex items-center space-x-1.5">
                      <Clock className="w-3.5 h-3.5 text-slate-400" />
                      <span className={`text-[11px] font-bold px-2.5 py-1 rounded-xl border ${countdown.colorClass}`}>
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
          <div className="grid md:grid-cols-2 gap-4">
            {displayedTenders.map((tender) => {
              const match = matches.find((m) => m.tenderId === tender.id);
              const countdown = getCountdown(tender.bidSubmissionDeadline);

              return (
                <div
                  key={tender.id}
                  onClick={() => onSelectTender(tender.id)}
                  className="bg-white/65 backdrop-blur-md border border-white/30 hover:bg-white/80 hover:border-blue-400/50 hover:shadow-lg rounded-2xl p-5 shadow-xs transition-all duration-300 cursor-pointer flex flex-col justify-between space-y-4"
                >
                  <div className="space-y-3">
                    <div className="flex items-center justify-between">
                      <span className={`text-[10px] font-bold border px-2.5 py-0.5 rounded-full uppercase tracking-wider ${getPortalColor(tender.sourcePortal)}`}>
                        {tender.sourcePortal}
                      </span>
                      {match && (
                        <div className="flex items-center justify-center px-3 py-1 bg-green-50 rounded-lg border border-green-100 shadow-xs">
                          <span className="text-green-700 text-[11.5px] font-bold">{match.matchScore}% Match</span>
                        </div>
                      )}
                    </div>

                    <h3 className="font-bold text-sm text-slate-800 line-clamp-2 hover:text-blue-600 transition-colors">
                      {tender.title}
                    </h3>

                    <p className="text-xs text-slate-500 line-clamp-3 leading-relaxed">
                      {tender.workDescription || "No detailed synopsis available. Click to analyze raw tender instructions."}
                    </p>
                  </div>

                  <div className="pt-3 border-t border-slate-100 flex items-center justify-between text-xs">
                    <div className="flex flex-col">
                      <span className="text-[10px] text-slate-400 font-semibold uppercase">Value</span>
                      <span className="font-bold text-slate-800 font-mono pb-1">{formatIndianCurrency(tender.tenderValue ? tender.tenderValue * 10000000 : null)}</span>
                    </div>
                    <div className="flex flex-col items-end">
                      <span className="text-[10px] text-slate-400 font-semibold uppercase">Deadline</span>
                      <span className={`font-semibold px-2 py-0.5 border rounded ${countdown.colorClass}`}>
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
          <div className="bg-gradient-to-r from-blue-50 to-indigo-50 border-2 border-dashed border-blue-250 p-6 rounded-2xl text-center space-y-4 shadow-sm mt-4">
            <div className="bg-white p-2.5 rounded-full w-fit mx-auto border border-blue-200">
              <Sparkles className="w-5 h-5 text-blue-600 animate-pulse" />
            </div>
            <div className="space-y-1">
              {isTrialUser ? (
                <>
                  <h4 className="font-extrabold text-slate-800 text-sm">Upgrade to view more</h4>
                  <p className="text-xs text-slate-500 max-w-sm mx-auto leading-normal font-normal">
                    Your 10-day <b>Starter Trial</b> is capped at 10 tender matches. Upgrade to the premium <b>Professional Plan</b> to access unrestricted tenders.
                  </p>
                </>
              ) : (
                <>
                  <h4 className="font-extrabold text-slate-800 text-sm">Reveal {filteredTenders.length - 5} More Premium Matches!</h4>
                  <p className="text-xs text-slate-500 max-w-md mx-auto leading-normal font-normal">
                    Your current <b>Bharat (Free)</b> Plan limit restricts active discovery matches. Upgrade to the <b>Professional Plan</b> to explore unrestricted tender matches.
                  </p>
                </>
              )}
            </div>
            <button
              type="button"
              onClick={onNavigateToBilling}
              className="bg-blue-600 hover:bg-blue-700 text-white font-extrabold text-xs px-5 py-2.5 rounded-xl cursor-pointer transition-all active:scale-[0.98] shadow-sm shadow-blue-200"
            >
              {isTrialUser ? "Upgrade Now to View All Tenders" : "Unlock Uncapped Discovery matches"}
            </button>
          </div>
        )}
      </main>
      </div>
    </div>
  );
}
