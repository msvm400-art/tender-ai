import React, { useState } from "react";
import { Calculator, Sparkles, DollarSign, ShieldAlert, CheckCircle, Percent, Printer, RefreshCw } from "lucide-react";
import { Tender } from "../types.js";
import { getAuthHeaders, formatIndianCurrency } from "../utils.js";

interface BidPricingToolProps {
  tender: Tender;
  user: any;
}

export default function BidPricingTool({ tender, user }: BidPricingToolProps) {
  const [materialCost, setMaterialCost] = useState<number>(3500000); // 35 Lakhs default
  const [laborCost, setLaborCost] = useState<number>(1500000);    // 15 Lakhs default
  const [equipmentCost, setEquipmentCost] = useState<number>(800000);  // 8 Lakhs default
  const [overheadMargin, setOverheadMargin] = useState<number>(12);   // 12% default
  
  const [isAnalyzing, setIsAnalyzing] = useState<boolean>(false);
  const [pricingResult, setPricingResult] = useState<any>(null);
  const [errorText, setErrorText] = useState<string>("");

  // Calc math
  const subTotal = materialCost + laborCost + equipmentCost;
  const marginAmount = Math.round(subTotal * (overheadMargin / 100));
  const totalBaseEstimate = subTotal + marginAmount;
  const gstAmount = Math.round(totalBaseEstimate * 0.18); // 18% standard GST
  const totalBidOffer = totalBaseEstimate + gstAmount;

  const handleAnalyzePricing = async () => {
    setIsAnalyzing(true);
    setErrorText("");
    try {
      const res = await fetch(`/api/tenders/${tender.id}/pricing`, {
        method: "POST",
        headers: getAuthHeaders({ "Content-Type": "application/json" }),
        body: JSON.stringify({
          materialCost,
          laborCost,
          equipmentCost,
          overheadMargin,
          totalEstimate: totalBidOffer
        })
      });

      if (!res.ok) {
        throw new Error("Could not evaluate pricing profile. Please try again.");
      }

      const data = await res.json();
      setPricingResult(data);
    } catch (err: any) {
      setErrorText(err.message || "Something went wrong.");
    } finally {
      setIsAnalyzing(false);
    }
  };

  const handlePrint = () => {
    window.print();
  };

  return (
    <div id="boq-estimator-card" className="grid grid-cols-1 lg:grid-cols-5 gap-6">
      {/* Parameters Form panel */}
      <div className="lg:col-span-2.5 bg-white border border-slate-200 rounded-xl p-5 shadow-sm space-y-4">
        <div className="flex items-center space-x-2 pb-2 border-b border-slate-100">
          <Calculator className="w-5 h-5 text-blue-600" />
          <h3 className="font-bold text-sm text-slate-800 uppercase tracking-wide">
            BOQ Estimator & Budget Planner
          </h3>
        </div>

        <p className="text-xs text-slate-500 leading-relaxed">
          Input your base pricing components. Our calculator auto-applies e-procurement GST percentages and helps align your final offer.
        </p>

        <div className="space-y-4 pt-1">
          {/* Material Cost Input */}
          <div className="space-y-1.5">
            <label className="text-[11px] font-bold text-slate-700 uppercase block">
              Material Costs (INR ₹)
            </label>
            <div className="relative">
              <span className="absolute left-3 top-2 text-slate-400 text-xs font-semibold">₹</span>
              <input
                type="number"
                value={materialCost}
                onChange={(e) => setMaterialCost(Math.max(0, parseInt(e.target.value) || 0))}
                className="w-full pl-7 pr-3 py-1.5 border border-slate-200 rounded-lg text-xs font-medium focus:outline-none focus:ring-1 focus:ring-blue-500"
              />
            </div>
            <span className="text-[10px] text-slate-400 font-serif lowercase block">
              approx. {materialCost >= 10000000 ? `${(materialCost/10000000).toFixed(2)} Cr` : `${(materialCost/100000).toFixed(1)} Lakhs`} Lakhs
            </span>
          </div>

          {/* Labor Cost Input */}
          <div className="space-y-1.5">
            <label className="text-[11px] font-bold text-slate-700 uppercase block">
              Labour & Workforce (INR ₹)
            </label>
            <div className="relative">
              <span className="absolute left-3 top-2 text-slate-400 text-xs font-semibold">₹</span>
              <input
                type="number"
                value={laborCost}
                onChange={(e) => setLaborCost(Math.max(0, parseInt(e.target.value) || 0))}
                className="w-full pl-7 pr-3 py-1.5 border border-slate-200 rounded-lg text-xs font-medium focus:outline-none focus:ring-1 focus:ring-blue-500"
              />
            </div>
            <span className="text-[10px] text-slate-400 font-serif lowercase block">
              approx. {laborCost >= 10000000 ? `${(laborCost/10000000).toFixed(2)} Cr` : `${(laborCost/100000).toFixed(1)} Lakhs`} Lakhs
            </span>
          </div>

          {/* Equipment Cost Input */}
          <div className="space-y-1.5">
            <label className="text-[11px] font-bold text-slate-700 uppercase block">
              Equipment & Machinery (INR ₹)
            </label>
            <div className="relative">
              <span className="absolute left-3 top-2 text-slate-400 text-xs font-semibold">₹</span>
              <input
                type="number"
                value={equipmentCost}
                onChange={(e) => setEquipmentCost(Math.max(0, parseInt(e.target.value) || 0))}
                className="w-full pl-7 pr-3 py-1.5 border border-slate-200 rounded-lg text-xs font-medium focus:outline-none focus:ring-1 focus:ring-blue-500"
              />
            </div>
          </div>

          {/* Margin Slider */}
          <div className="space-y-1.5 bg-slate-50/70 border border-slate-100 p-3 rounded-lg">
            <div className="flex justify-between items-center text-[11px] font-bold uppercase text-slate-700">
              <span>Overhead Margin & Profit Margin</span>
              <span className="text-blue-600 font-mono">{overheadMargin}%</span>
            </div>
            <input
              type="range"
              min="0"
              max="40"
              value={overheadMargin}
              onChange={(e) => setOverheadMargin(parseInt(e.target.value))}
              className="w-full accent-blue-600 cursor-pointer h-1 rounded"
            />
            <div className="flex justify-between text-[9px] text-slate-400">
              <span>0% (No Margin)</span>
              <span>20% (Standard)</span>
              <span>40% (Aggressive)</span>
            </div>
          </div>
        </div>

        <div className="pt-3 border-t border-slate-50 space-s-2 flex">
          <button
            onClick={handleAnalyzePricing}
            disabled={isAnalyzing}
            className="w-full bg-blue-600 hover:bg-blue-700 text-white font-bold text-xs py-2.5 rounded-lg shadow-md cursor-pointer flex items-center justify-center space-x-1.5 transition-all text-center select-none"
          >
            {isAnalyzing ? (
              <>
                <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                <span>Compiler Evaluation Working...</span>
              </>
            ) : (
              <>
                <Sparkles className="w-3.5 h-3.5" />
                <span>Get AI Bidding Risk Evaluation</span>
              </>
            )}
          </button>
        </div>
      </div>

      {/* Breakdown calculation summary sheet */}
      <div className="lg:col-span-2.5 bg-slate-50/70 border border-slate-200/85 rounded-xl p-5 flex flex-col justify-between">
        <div className="space-y-4">
          <div className="flex justify-between items-center pb-2 border-b border-slate-200">
            <h4 className="text-xs font-bold text-slate-700 uppercase tracking-wider">
              ESTIMATED BOQ RECEIPT
            </h4>
            <button
              onClick={handlePrint}
              className="p-1 px-2.5 bg-white border border-slate-200 hover:bg-slate-50 rounded-lg text-slate-600 text-[10px] font-semibold transition flex items-center gap-1 active:scale-95"
            >
              <Printer className="w-3 h-3" />
              <span>Print Sheet</span>
            </button>
          </div>

          <div className="space-y-2 text-xs divide-y divide-slate-100 font-medium">
            <div className="flex justify-between py-1.5 text-slate-600">
              <span>Materials Allocation</span>
              <span className="font-mono text-slate-900">{formatIndianCurrency(materialCost / 10000000)} Cr</span>
            </div>
            <div className="flex justify-between py-1.5 text-slate-600">
              <span>Labour & Supervision Allocation</span>
              <span className="font-mono text-slate-900">{formatIndianCurrency(laborCost / 10000000)} Cr</span>
            </div>
            <div className="flex justify-between py-1.5 text-slate-600">
              <span>Machinery Rent & Fuel</span>
              <span className="font-mono text-slate-900">{formatIndianCurrency(equipmentCost / 10000000)} Cr</span>
            </div>
            <div className="flex justify-between py-1.5 text-slate-600">
              <span>Subtotal Cost</span>
              <span className="font-mono text-slate-900">{formatIndianCurrency(subTotal / 10000000)} Cr</span>
            </div>
            <div className="flex justify-between py-1.5 text-slate-600">
              <span>Overhead & Profit ({overheadMargin}%)</span>
              <span className="font-mono text-emerald-600">+{formatIndianCurrency(marginAmount / 10000000)} Cr</span>
            </div>
            <div className="flex justify-between py-1.5 text-slate-700 bg-blue-50/50 px-2 rounded font-bold">
              <span>Base Bidding Value</span>
              <span className="font-mono text-slate-950">{formatIndianCurrency(totalBaseEstimate / 10000000)} Cr</span>
            </div>
            <div className="flex justify-between py-1.5 text-[10px] text-slate-500">
              <span>Statutory Goods & Services Tax (GST @ 18%)</span>
              <span className="font-mono">+{formatIndianCurrency(gstAmount / 10000000)} Cr</span>
            </div>
            <div className="flex justify-between py-3 text-slate-900 bg-slate-100 p-2.5 rounded-lg border border-slate-200 text-sm font-black text-rose-750">
              <span className="uppercase">Net Proposed Bid Offer</span>
              <span className="font-mono">{formatIndianCurrency(totalBidOffer / 10000000)} Cr</span>
            </div>
          </div>

          <div className="pt-1.5 text-[10px] text-slate-400 italic text-center leading-relaxed">
            Reference Tender Value: {formatIndianCurrency(tender.tenderValue || 1.5)} Cr.
          </div>
        </div>

        {/* AI response card */}
        <div className="pt-4 mt-4 border-t border-slate-200">
          {isAnalyzing && (
            <div className="p-4 bg-blue-50 border border-blue-100 rounded-xl space-y-2 animate-pulse">
              <div className="flex items-center space-x-2 text-xs text-blue-800">
                <Sparkles className="w-4 h-4 animate-spin text-blue-600" />
                <span className="font-bold">Gemini-3.5 conducting pricing risk analysis...</span>
              </div>
            </div>
          )}

          {errorText && (
            <div className="p-3 bg-red-50 border border-red-100 text-red-700 text-xs rounded-xl flex items-center gap-2">
              <ShieldAlert className="w-4 h-4" />
              <span>{errorText}</span>
            </div>
          )}

          {!isAnalyzing && pricingResult && (
            <div className="p-4 bg-emerald-50/60 border border-emerald-100 rounded-xl space-y-2.5">
              <div className="flex items-center gap-2">
                <CheckCircle className="w-4 h-4 text-emerald-600" />
                <h5 className="text-[11px] font-bold text-emerald-800 tracking-wider uppercase">
                  AI Bidding Pricing Advisor Outcome
                </h5>
              </div>
              <p className="text-[11px] text-slate-700 font-sans leading-relaxed whitespace-pre-line mt-1">
                {pricingResult.pricingReview}
              </p>
              <div className="flex gap-2 justify-end text-[9px] font-mono font-black text-slate-400 uppercase pt-1">
                <span>Variance: {pricingResult.variancePercentage?.toFixed(1)}%</span>
                <span>•</span>
                <span>Ref: INR {(pricingResult.tenderReferenceInRs / 10000000).toFixed(2)} Cr</span>
              </div>
            </div>
          )}

          {!isAnalyzing && !pricingResult && (
            <div className="p-4 bg-slate-100 border border-dashed border-slate-350 rounded-xl text-center">
              <p className="text-[11px] text-slate-500 font-sans">
                💡 Submit your budget estimation. Our AI model will perform bidding stress-testing, check deviation limits, and flag if you run risk of disqualification.
              </p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
