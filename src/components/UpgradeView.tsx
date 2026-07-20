import React, { useState } from "react";
import { 
  Sparkles, 
  Check, 
  Minus, 
  Compass, 
  Database, 
  Bell, 
  BarChart4, 
  ArrowRight, 
  Zap, 
  Crown, 
  ShieldCheck, 
  Info,
  Clock,
  AlertTriangle
} from "lucide-react";
import { User } from "../types.js";

interface UpgradeViewProps {
  user: User | null;
  onNavigateToBilling: (planId?: string) => void;
}

export default function UpgradeView({ user, onNavigateToBilling }: UpgradeViewProps) {
  const [billingCycle, setBillingCycle] = useState<"MONTHLY" | "ANNUAL">("MONTHLY");

  const plans = [
    {
      id: "FREE",
      name: "Bharat (Free)",
      tagline: "Basic municipal discovery",
      monthlyPrice: 0,
      annualPrice: 0,
      color: "border-slate-200 bg-white text-slate-800",
      badge: "Free Tier",
      badgeColor: "bg-slate-100 text-slate-700",
      cta: "Current Active Tier",
      ctaClass: "bg-slate-100 hover:bg-slate-200 text-slate-500 cursor-not-allowed",
      isPremium: false,
    },
    {
      id: "STARTER",
      name: "Starter Plan",
      tagline: "District-level growth",
      originalPrice: 3000,
      monthlyPrice: 2000,
      annualPrice: 20000,
      savingsText: "Save ₹16,000/yr",
      color: "border-slate-200 bg-white text-slate-800",
      badge: "Standard",
      badgeColor: "bg-blue-50 text-[#1B4FD8]",
      cta: "Upgrade to Starter",
      ctaClass: "bg-slate-900 text-white hover:bg-slate-800 active:scale-95 cursor-pointer shadow-sm",
      isPremium: true,
    },
    {
      id: "PROFESSIONAL",
      name: "Professional",
      tagline: "Civil-bid generation center",
      originalPrice: 10000,
      monthlyPrice: 5000,
      annualPrice: 50000,
      savingsText: "Save ₹70,000/yr",
      color: "border-blue-500 ring-2 ring-blue-500/20 bg-gradient-to-b from-blue-50/10 to-white",
      badge: "Most Popular ⭐",
      badgeColor: "bg-gradient-to-r from-blue-600 to-indigo-600 text-white shadow-xs",
      cta: "Upgrade to Professional",
      ctaClass: "bg-blue-600 text-white hover:bg-blue-700 active:scale-95 cursor-pointer shadow-sm shadow-blue-200",
      isPremium: true,
      highlight: true
    },
    {
      id: "ENTERPRISE",
      name: "Enterprise SLA",
      tagline: "State-wide multi-entity scale",
      originalPrice: 25000,
      monthlyPrice: 10000,
      annualPrice: 100000,
      savingsText: "Save ₹200,000/yr",
      color: "border-slate-800 bg-gradient-to-b from-slate-900 to-[#1e1b4b] text-white",
      badge: "Custom SLA",
      badgeColor: "bg-[#4338ca] text-indigo-100",
      cta: "Initiate Private Agreement",
      ctaClass: "bg-white hover:bg-slate-100 text-slate-900 active:scale-95 cursor-pointer shadow-sm",
      isPremium: true,
    }
  ];

  const categories = [
    {
      name: "Core Procurement Tools",
      features: [
        {
          name: "Tender Discovery Match Count",
          desc: "How many tenders you can view and match against your company profile criteria",
          free: "5 matched tenders only",
          starter: "5 matched tenders only",
          professional: "Unlimited discovery",
          enterprise: "Uncapped discovery",
          highlightIcon: <Compass className="w-4 h-4 text-slate-500" />
        },
        {
          name: "AI Compilations & Summaries",
          desc: "Detailed Gemini RAG-enhanced structural analysis & checklists",
          free: "3 summary cycles / month",
          starter: "Uncapped checks on matches",
          professional: "Infinite deep checks",
          enterprise: "Infinite & Dedicated API quotas",
        },
        {
          name: "Match Scoring Transparency",
          desc: "Check eligibility of your firm parameters against official tenders",
          free: "Simple overall % score only",
          starter: "Full criteria itemization (✓/✗)",
          professional: "Full criteria + Action plans",
          enterprise: "Dedicated compliance pre-audit",
        }
      ]
    },
    {
      name: "Bid compiler & Intelligence Vault",
      features: [
        {
          name: "Document Vault Upload Limits",
          desc: "Central archives containing PAN, GSTIN, and previous bidding works",
          free: "3 PDFs max limit",
          starter: "Up to 20 business filings",
          professional: "Unlimited filings + Expiry Alerter",
          enterprise: "Unlimited files + Multi-company logs",
          highlightIcon: <Database className="w-4 h-4 text-slate-500" />
        },
        {
          name: "Bid Document Compilation Drafts",
          desc: "Custom AI drafted procurement dossiers in docx formats",
          free: "Not included",
          starter: "Up to 5 files / month",
          professional: "Up to 20 files / month (+ DOCX)",
          enterprise: "Unlimited premium drafts",
        },
        {
          name: "Active Interactive Q&A",
          desc: "Interactive RAG-based query chat on tender conditions",
          free: "Not included",
          starter: "Up to 10 questions / tender",
          professional: "Unlimited RAG queries",
          enterprise: "Unlimited RAG queries",
        }
      ]
    },
    {
      name: "Alert Network & Analytics Dashboard",
      features: [
        {
          name: "Real-time Notification Alerts",
          desc: "Instant channel dispatch on corrigenda & custom tenders",
          free: "Email digest only",
          starter: "Email + WhatsApp alerts",
          professional: "Email + WhatsApp + SMS + Push",
          enterprise: "SLA Custom webhook lines",
          highlightIcon: <Bell className="w-4 h-4 text-slate-500" />
        },
        {
          name: "Procurement Intel & Competitive Charts",
          desc: "Bid pipeline analysis, win-rate forecasts & client breakdowns",
          free: "Not included",
          starter: "Basic visual dashboards",
          professional: "Advanced analytics package",
          enterprise: "Dedicated custom reporting pipelines",
          highlightIcon: <BarChart4 className="w-4 h-4 text-slate-500" />
        }
      ]
    },
    {
      name: "Team & Support Services",
      features: [
        {
          name: "Authorized Active Workspaces",
          desc: "Collaborative member seats inside the workspace",
          free: "1 user seat",
          starter: "1 seat (no collaboration)",
          professional: "Up to 3 seats with shared logs",
          enterprise: "Custom seats + Active Directory",
        },
        {
          name: "Priority Support Level",
          desc: "Response times and channels with support engineers",
          free: "Community portal only",
          starter: "Standard email support (48h)",
          professional: "Priority Slack and email (24h)",
          enterprise: "Dedicated SLA account agent",
        }
      ]
    }
  ];

  // Helper render badge for plans in pricing layout
  const currentPlanId = user?.plan || "FREE";
  const isTrialActive = user?.isTrialActive === true;
  const trialDaysElapsed = user?.trialDaysElapsed || 0;
  const isTrialExpired = trialDaysElapsed >= 10;

  return (
    <div className="space-y-12 animate-fade-in pb-12">
      {/* Dynamic Header Frame */}
      <div className="bg-gradient-to-br from-[#1e293b] via-[#0f172a] to-[#1e1b4b] text-white p-8 md:p-12 rounded-3xl border border-slate-800 shadow-xl relative overflow-hidden">
        <div className="absolute top-0 right-0 w-96 h-96 bg-blue-500/10 rounded-full blur-3xl pointer-events-none" />
        <div className="absolute bottom-0 left-0 w-80 h-80 bg-indigo-500/10 rounded-full blur-3xl pointer-events-none" />

        <div className="relative z-10 max-w-3xl space-y-6">
          <div className="inline-flex items-center gap-1.5 bg-indigo-500/20 text-indigo-300 font-extrabold text-[10px] tracking-wider uppercase px-3 py-1 rounded-full border border-indigo-500/30">
            <Sparkles className="w-3.5 h-3.5" />
            <span>Premium Commercial Tiers</span>
          </div>

          <div className="space-y-3">
            <h1 className="text-3xl md:text-4xl font-extrabold tracking-tight leading-none text-white font-sans">
              Amplify Your Bid Win Probability
            </h1>
            <p className="text-xs md:text-sm text-slate-300 font-medium max-w-2xl leading-relaxed">
              Your 10-day trial allows discovery, but the premium <strong>Professional</strong> and <strong>Enterprise</strong> plans unlock uncapped match counts, unlimited intelligent summaries, real-time corrigendum push alerts, and direct DOCX bid downloads.
            </p>
          </div>

          {/* User Specific Status Banner inside Premium View */}
          <div className="bg-slate-900/60 rounded-2xl p-4 border border-slate-850 max-w-lg flex items-center justify-between gap-4">
            <div className="flex items-center gap-3">
              <div className="p-2.5 bg-blue-500/10 rounded-xl text-blue-400">
                <Clock className="w-5 h-5" />
              </div>
              <div className="space-y-0.5">
                <div className="text-[10px] font-black uppercase text-slate-400 tracking-wider">
                  Current Status Summary
                </div>
                <div className="text-xs font-bold text-slate-200">
                  {isTrialExpired ? (
                    <span className="text-rose-400 flex items-center gap-1.5 font-bold">
                      <AlertTriangle className="w-4 h-4 shrink-0" />
                      10-Day Starter Trial Expired (10/10 Days)
                    </span>
                  ) : (
                    <span>10-Day Starter Trial: Day {trialDaysElapsed} of 10 used</span>
                  )}
                </div>
              </div>
            </div>
            
            <div className="shrink-0 bg-blue-500/20 text-blue-300 font-bold text-[10px] px-3 py-1.5 rounded-lg border border-blue-500/30">
              {currentPlanId} Plan
            </div>
          </div>
        </div>
      </div>

      {/* Pricing Header Switch Toggle */}
      <div className="text-center space-y-4">
        <h2 className="text-2xl font-black text-slate-800 tracking-tight">Flexible Commercial Licensing</h2>
        <p className="text-xs text-slate-500 leading-normal max-w-md mx-auto">
          Choose a pipeline that scaling-wise matches your quarterly public procurement expectations.
        </p>

        {/* Dynamic Billing Cycle Selector Toggle */}
        <div className="inline-flex p-1 bg-slate-100 rounded-xl border border-slate-200 shadow-inner">
          <button
            type="button"
            onClick={() => setBillingCycle("MONTHLY")}
            className={`px-4 py-1.5 rounded-lg text-xs font-extrabold transition-all cursor-pointer ${
              billingCycle === "MONTHLY" 
                ? "bg-white text-slate-800 shadow-xs" 
                : "text-slate-500 hover:text-slate-800"
            }`}
          >
            Monthly Invoicing
          </button>
          <button
            type="button"
            onClick={() => setBillingCycle("ANNUAL")}
            className={`px-4 py-1.5 rounded-lg text-xs font-extrabold transition-all flex items-center gap-1 cursor-pointer ${
              billingCycle === "ANNUAL" 
                ? "bg-blue-600 text-white shadow-xs" 
                : "text-slate-500 hover:text-slate-800"
            }`}
          >
            <span>Annual Invoice</span>
            <span className="text-[9px] font-black bg-emerald-500 text-white px-1 py-0.2 rounded shrink-0 leading-none">
              Save 20%
            </span>
          </button>
        </div>
      </div>

      {/* Grid Pricing Columns */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        {plans.map((p) => {
          const isCurrent = currentPlanId === p.id;
          const displayPrice = billingCycle === "MONTHLY" ? p.monthlyPrice : Math.round(p.annualPrice / 12);
          
          return (
            <div 
              key={p.id}
              className={`rounded-2xl border p-6 flex flex-col justify-between space-y-6 transition-all hover:shadow-lg ${p.color} ${p.highlight ? "relative md:-translate-y-2" : ""}`}
            >
              {p.highlight && (
                <div className="absolute -top-3.5 left-1/2 -translate-x-1/2 bg-blue-600 text-white text-[9px] font-black tracking-widest uppercase px-3.5 py-1 rounded-full shadow-md">
                  Most Popular Choice
                </div>
              )}

              <div className="space-y-4">
                <div className="flex justify-between items-start">
                  <div className="space-y-1">
                    <h3 className="font-black text-lg tracking-tight font-sans text-slate-800 dark:text-inherit">
                      {p.name}
                    </h3>
                    <p className="text-[11px] text-slate-400 font-semibold leading-relaxed">
                      {p.tagline}
                    </p>
                  </div>
                  <span className={`text-[9px] font-black px-2.5 py-0.5 rounded-full border ${p.badgeColor}`}>
                    {p.badge}
                  </span>
                </div>

                {/* Pricing Box */}
                <div className="space-y-1">
                  {p.id === "FREE" ? (
                    <div className="text-3xl font-black tracking-tight text-slate-800 dark:text-inherit">₹0</div>
                  ) : (
                    <div className="space-y-1">
                      <div className="flex items-center gap-1.5 flex-wrap">
                        {p.originalPrice && (
                          <span className="text-xs text-slate-400 line-through font-medium">
                            ₹{(billingCycle === "MONTHLY" ? p.originalPrice : (p.originalPrice * 12)).toLocaleString()}
                          </span>
                        )}
                        <div className="flex items-baseline gap-1">
                          <span className="text-sm font-semibold">₹</span>
                          <span className="text-3xl font-black tracking-tight text-inherit">
                            {displayPrice.toLocaleString()}
                          </span>
                          <span className="text-xs text-slate-400 font-semibold">/mo</span>
                        </div>
                      </div>
                      <span className="text-[9px] font-bold bg-amber-500 text-white px-2 py-0.5 rounded uppercase tracking-wider inline-block">
                        Huge Discount Applied
                      </span>
                    </div>
                  )}
                  {billingCycle === "ANNUAL" && p.id !== "FREE" ? (
                    <div className="text-[10px] text-emerald-500 font-extrabold flex items-center gap-1 leading-none pt-1">
                      <Zap className="w-3 h-3 fill-emerald-500" />
                      <span>{p.savingsText} (billed yearly at ₹{p.annualPrice.toLocaleString()})</span>
                    </div>
                  ) : p.id !== "FREE" ? (
                    <div className="text-[9.5px] text-slate-400 font-medium leading-none pt-1">
                      Billed monthly
                    </div>
                  ) : null}
                </div>
              </div>

              {/* Action Button */}
              <div>
                <button
                  type="button"
                  onClick={() => p.id !== "FREE" && onNavigateToBilling(p.id)}
                  disabled={isCurrent}
                  className={`w-full py-3 rounded-xl text-xs font-black transition-all ${isCurrent ? "bg-emerald-50 text-emerald-700 border border-emerald-200 font-bold cursor-not-allowed" : p.ctaClass}`}
                >
                  <span className="flex items-center justify-center gap-1">
                    {isCurrent ? "Current Active Plan ✓" : p.cta}
                    {!isCurrent && p.id !== "FREE" && <ArrowRight className="w-3.5 h-3.5" />}
                  </span>
                </button>
              </div>
            </div>
          );
        })}
      </div>

      {/* Desktop Feature Comparison Table */}
      <div className="space-y-4">
        <div className="text-left space-y-1">
          <h3 className="text-lg font-black tracking-tight text-slate-800">Complete Feature Side-By-Side Comparison</h3>
          <p className="text-xs text-slate-500 max-w-xl">
            Review detailed service breakdowns showing exact technical caps and API limits associated with each plan.
          </p>
        </div>

        <div className="bg-white rounded-2xl border border-slate-200 overflow-hidden shadow-sm">
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse min-w-[760px]">
              {/* Header Segment */}
              <thead>
                <tr className="bg-slate-50/75 border-b border-slate-200/60 text-xs font-black text-slate-700 uppercase tracking-wider text-center">
                  <th className="p-4 text-left w-1/4">Capability & Limit Specs</th>
                  <th className="p-4 w-1/5 bg-slate-50/40">Bharat (Free)</th>
                  <th className="p-4 w-1/5 bg-slate-50/40">Starter (Trial)</th>
                  <th className="p-4 w-1/5 bg-indigo-50/30 text-indigo-900 font-black">Professional ⭐</th>
                  <th className="p-4 w-1/5 bg-slate-50/40">Enterprise</th>
                </tr>
              </thead>

              {/* Content Segments */}
              <tbody>
                {categories.map((cat, idx) => (
                  <React.Fragment key={idx}>
                    <tr className="bg-slate-100/50 border-b border-slate-200/50">
                      <td colSpan={5} className="px-4 py-2 text-[10px] font-black text-slate-500 uppercase tracking-wider bg-slate-50/70">
                        {cat.name}
                      </td>
                    </tr>
                    {cat.features.map((feat, fIdx) => (
                      <tr 
                        key={fIdx}
                        className="border-b border-slate-100 font-medium hover:bg-slate-50/50 transition-colors"
                      >
                        {/* Title and Descriptions */}
                        <td className="p-4 font-sans text-xs">
                          <div className="flex items-start gap-2.5">
                            {feat.highlightIcon && (
                              <div className="mt-0.5 p-1 bg-slate-100 rounded text-slate-500">
                                {feat.highlightIcon}
                              </div>
                            )}
                            <div className="space-y-0.5">
                              <h4 className="font-extrabold text-slate-800">{feat.name}</h4>
                              <p className="text-[10px] text-slate-450 font-normal leading-relaxed">{feat.desc}</p>
                            </div>
                          </div>
                        </td>

                        {/* Plan 1 values: Bharat */}
                        <td className="p-4 text-center text-xs text-slate-500 font-mono">
                          {feat.free}
                        </td>

                        {/* Plan 2 values: Starter */}
                        <td className="p-4 text-center text-xs text-slate-650 font-mono">
                          {feat.starter}
                        </td>

                        {/* Plan 3 values: Professional */}
                        <td className="p-4 text-center text-xs text-indigo-650 font-mono font-bold bg-indigo-50/10">
                          <span className="inline-flex items-center gap-1">
                            <Sparkles className="w-3 h-3 text-indigo-500 fill-indigo-100" />
                            {feat.professional}
                          </span>
                        </td>

                        {/* Plan 4 values: Enterprise */}
                        <td className="p-4 text-center text-xs text-slate-800 font-mono">
                          {feat.enterprise}
                        </td>
                      </tr>
                    ))}
                  </React.Fragment>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </div>

      {/* Guarantee Badge segment */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6 bg-slate-50 p-6 rounded-2xl border border-slate-200/85">
        <div className="flex gap-3 items-start">
          <div className="p-2 bg-emerald-50 text-emerald-600 rounded-xl border border-emerald-100 shrink-0">
            <ShieldCheck className="w-5 h-5" />
          </div>
          <div className="space-y-1">
            <h4 className="font-extrabold text-slate-800 text-xs">Secured Payments Assurance</h4>
            <p className="text-[10.5px] text-slate-500 font-medium leading-relaxed">
              Processed instantly via 256-bit SSL encrypted sandboxes with Razorpay and Cashfree protocol integrations.
            </p>
          </div>
        </div>

        <div className="flex gap-3 items-start border-t md:border-t-0 md:border-l border-slate-200 pt-4 md:pt-0 md:pl-6">
          <div className="p-2 bg-blue-50 text-blue-600 rounded-xl border border-blue-100 shrink-0">
            <Crown className="w-5 h-5" />
          </div>
          <div className="space-y-1">
            <h4 className="font-extrabold text-slate-800 text-xs">100% Tax Deductible Compliance</h4>
            <p className="text-[10.5px] text-slate-500 font-medium leading-relaxed">
              Export professional invoices formatted with state code records and PAN sequences right from the Billing dashboard.
            </p>
          </div>
        </div>

        <div className="flex gap-3 items-start border-t md:border-t-0 md:border-l border-slate-200 pt-4 md:pt-0 md:pl-6">
          <div className="p-2 bg-indigo-50 text-indigo-600 rounded-xl border border-indigo-100 shrink-0">
            <Zap className="w-5 h-5" />
          </div>
          <div className="space-y-1">
            <h4 className="font-extrabold text-slate-800 text-xs">No-Risk Cancellation SLA</h4>
            <p className="text-[10.5px] text-slate-500 font-medium leading-relaxed">
              Downgrade easily back to Bharat (Free) at any moment without penalty or locking of existing static uploads.
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
