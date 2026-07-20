import React, { useState, useEffect } from "react";
import { AreaChart, Area, BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer } from "recharts";
import { TrendingUp, Award, DollarSign, BarChart3, PieChart } from "lucide-react";
import { formatIndianCurrency, getAuthHeaders } from "../utils.js";

export default function AnalyticsView() {
  const [overview, setOverview] = useState<any>(null);
  const [volumeData, setVolumeData] = useState<any[]>([]);
  const [pipelineData, setPipelineData] = useState<any[]>([]);

  useEffect(() => {
    async function loadStats() {
      try {
        const resOverview = await fetch("/api/analytics/overview", {
          headers: getAuthHeaders()
        });
        const oData = await resOverview.json();
        setOverview(oData);

        const resVolume = await fetch("/api/analytics/tender-volume", {
          headers: getAuthHeaders()
        });
        const vData = await resVolume.json();
        setVolumeData(vData);

        const resPipeline = await fetch("/api/analytics/bid-pipeline", {
          headers: getAuthHeaders()
        });
        const pData = await resPipeline.json();
        setPipelineData(pData);
      } catch (err) {
        console.error("Failed to load analytics endpoints:", err);
      }
    }
    loadStats();
  }, []);

  if (!overview) return <div className="p-6 text-slate-500 text-xs">Loading analytics graphs...</div>;

  return (
    <div className="space-y-6 max-w-6xl">
      {/* Title */}
      <div>
        <h2 className="text-2xl font-bold text-slate-950">Analytics & Intelligence Engine</h2>
        <p className="text-sm text-slate-500 mt-1">
          Historical overview of public tender launches, win rates, and actively bid contracts.
        </p>
      </div>

      {/* Aggregate Cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        {/* Metric 1 */}
        <div className="bg-white/60 backdrop-blur-md border border-white/20 rounded-2xl p-5 shadow-xs space-y-2 hover:scale-[1.02] hover:bg-white/70 transition-all duration-300">
          <div className="flex items-center justify-between text-slate-450">
            <span className="text-xs font-semibold uppercase tracking-wider">Active Scraped Core</span>
            <BarChart3 className="w-4 h-4 text-blue-600" />
          </div>
          <p className="text-2xl font-extrabold text-slate-905">{overview.totalTendersMonitored}</p>
          <span className="text-[10px] text-emerald-600 font-bold block">↑ 14% new in Bihar/UP</span>
        </div>

        {/* Metric 2 */}
        <div className="bg-white/60 backdrop-blur-md border border-white/20 rounded-2xl p-5 shadow-xs space-y-2 hover:scale-[1.02] hover:bg-white/70 transition-all duration-300">
          <div className="flex items-center justify-between text-slate-450">
            <span className="text-xs font-semibold uppercase tracking-wider">High Compatibility Matches</span>
            <TrendingUp className="w-4 h-4 text-emerald-600" />
          </div>
          <p className="text-2xl font-extrabold text-slate-905">{overview.highActiveMatchesCount}</p>
          <span className="text-[10px] text-slate-400 block">&gt; 70% threshold compliance rate</span>
        </div>

        {/* Metric 3 */}
        <div className="bg-white/60 backdrop-blur-md border border-white/20 rounded-2xl p-5 shadow-xs space-y-2 hover:scale-[1.02] hover:bg-white/70 transition-all duration-300">
          <div className="flex items-center justify-between text-slate-450">
            <span className="text-xs font-semibold uppercase tracking-wider">Proposals Drafts Submitted</span>
            <DollarSign className="w-4 h-4 text-amber-500" />
          </div>
          <p className="text-2xl font-extrabold text-slate-905">{overview.bidsSubmittedCount}</p>
          <span className="text-[10px] text-slate-400 block">Totaling {formatIndianCurrency(19.4, { isCrores: true })} estimate</span>
        </div>

        {/* Metric 4 */}
        <div className="bg-white/60 backdrop-blur-md border border-white/20 rounded-2xl p-5 shadow-xs space-y-2 hover:scale-[1.02] hover:bg-white/70 transition-all duration-300">
          <div className="flex items-center justify-between text-slate-450">
            <span className="text-xs font-semibold uppercase tracking-wider">Win Rate (Won/Won+Lost)</span>
            <Award className="w-4 h-4 text-indigo-600" />
          </div>
          <p className="text-2xl font-extrabold text-slate-905">{overview.winRatePercentage}%</p>
          <span className="text-[10px] text-emerald-600 font-bold block">Targeting +5% in civil sectors</span>
        </div>
      </div>

      {/* Recharts Graphs Area */}
      <div className="grid md:grid-cols-2 gap-6">
        {/* Graph 1 */}
        <div className="bg-white/60 backdrop-blur-md border border-white/25 rounded-2xl p-6 shadow-xs space-y-4 hover:shadow-sm transition-shadow duration-300">
          <div className="space-y-1">
            <h3 className="text-sm font-bold text-slate-900 uppercase tracking-wide">Historical Crawled Tender Volume</h3>
            <span className="text-xs text-slate-450 block">Frequency count of active tenders indexed across portals.</span>
          </div>
          <div className="h-64 mt-4">
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={volumeData}>
                <defs>
                  <linearGradient id="colorCppp" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#2563eb" stopOpacity={0.4}/>
                    <stop offset="95%" stopColor="#2563eb" stopOpacity={0}/>
                  </linearGradient>
                  <linearGradient id="colorGem" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#10b981" stopOpacity={0.4}/>
                    <stop offset="95%" stopColor="#10b981" stopOpacity={0}/>
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" vertical={false} />
                <XAxis dataKey="month" tick={{ fontSize: 10, fill: '#64748b' }} axisLine={false} />
                <YAxis tick={{ fontSize: 10, fill: '#64748b' }} axisLine={false} />
                <Tooltip contentStyle={{ fontSize: 11 }} />
                <Legend iconType="circle" wrapperStyle={{ fontSize: 11 }} />
                <Area type="monotone" dataKey="CPPP" stroke="#2563eb" strokeWidth={2} fillOpacity={1} fill="url(#colorCppp)" />
                <Area type="monotone" dataKey="GEM" stroke="#10b981" strokeWidth={2} fillOpacity={1} fill="url(#colorGem)" />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        </div>

        {/* Graph 2 */}
        <div className="bg-white/60 backdrop-blur-md border border-white/25 rounded-2xl p-6 shadow-xs space-y-4 hover:shadow-sm transition-shadow duration-300">
          <div className="space-y-1">
            <h3 className="text-sm font-bold text-slate-900 uppercase tracking-wide">Pending Pipeline Bid Estimates</h3>
            <span className="text-xs text-slate-455 block">Value pipeline of bids currently processed in Workspace.</span>
          </div>
          <div className="h-64 mt-4">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={pipelineData}>
                <CartesianGrid strokeDasharray="3 3" vertical={false} />
                <XAxis dataKey="stage" tick={{ fontSize: 10, fill: '#64748b' }} axisLine={false} />
                <YAxis tick={{ fontSize: 10, fill: '#64748b' }} axisLine={false} />
                <Tooltip formatter={(value: any) => formatIndianCurrency(value, { isCrores: true })} contentStyle={{ fontSize: 11 }} />
                <Legend iconType="circle" wrapperStyle={{ fontSize: 11 }} />
                <Bar dataKey="value" name="Estimate" fill="#818cf8" radius={[4, 4, 0, 0]} barSize={36} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>
      </div>
    </div>
  );
}
