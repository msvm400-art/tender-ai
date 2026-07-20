import React, { useState, useEffect, useRef } from "react";
import {
  RefreshCw,
  Play,
  Pause,
  Zap,
  Trash2,
  Database,
  CheckCircle,
  AlertCircle,
  Clock,
  Layers,
  FileText,
  Activity,
  ShieldCheck,
  Server,
  Radio,
  ExternalLink,
  ChevronRight,
  Terminal,
} from "lucide-react";

interface PortalStat {
  portalKey: string;
  displayName: string;
  type: string;
  lastCrawlAt?: string;
  status: "HEALTHY" | "DEGRADED" | "OFFLINE";
  successRate: number;
  totalIngested: number;
}

interface IngestionJob {
  id: string;
  portal: string;
  status: "PENDING" | "RUNNING" | "COMPLETED" | "FAILED";
  retryCount: number;
  maxRetries: number;
  errorMessage?: string;
  startedAt?: string;
  completedAt?: string;
  logs: string[];
  recordsIngested: number;
}

interface IngestionStats {
  config: {
    schedulerActive: boolean;
    intervalMinutes: number;
    concurrencyLimit: number;
  };
  stats: {
    totalScrapedDocs: number;
    totalDeduplicated: number;
    totalFailedAttempts: number;
    totalRecoveries: number;
  };
  portalCoverage: PortalStat[];
}

export default function IngestionView() {
  const [stats, setStats] = useState<IngestionStats | null>(null);
  const [jobs, setJobs] = useState<IngestionJob[]>([]);
  const [loading, setLoading] = useState(false);
  const [actionLoading, setActionLoading] = useState(false);
  const [selectedJob, setSelectedJob] = useState<IngestionJob | null>(null);
  const [customInterval, setCustomInterval] = useState(15);
  const [customConcurrency, setCustomConcurrency] = useState(2);
  const [successToast, setSuccessToast] = useState<string | null>(null);

  const logsEndRef = useRef<HTMLDivElement>(null);

  const fetchStatsAndJobs = async () => {
    setLoading(true);
    try {
      const [resStats, resJobs] = await Promise.all([
        fetch("/api/ingestion/stats"),
        fetch("/api/ingestion/jobs"),
      ]);

      if (resStats.ok && resJobs.ok) {
        const statsData = await resStats.json();
        const jobsData = await resJobs.json();
        setStats(statsData);
        setJobs(jobsData.jobs || []);
        
        // Populate local form controls
        if (statsData?.config) {
          setCustomInterval(statsData.config.intervalMinutes);
          setCustomConcurrency(statsData.config.concurrencyLimit);
        }

        // Keep active detail job up to date
        if (selectedJob) {
          const updatedJob = (jobsData.jobs || []).find((j: IngestionJob) => j.id === selectedJob.id);
          if (updatedJob) setSelectedJob(updatedJob);
        }
      }
    } catch (err) {
      console.error("Failed to query ingestion stats API:", err);
    } finally {
      setLoading(false);
    }
  };

  // Poll stats and jobs every 3 seconds during monitoring for smooth feedback
  useEffect(() => {
    fetchStatsAndJobs();
    const interval = setInterval(fetchStatsAndJobs, 3000);
    return () => clearInterval(interval);
  }, [selectedJob?.id]);

  useEffect(() => {
    // Smart scroll the log viewer terminal
    if (logsEndRef.current) {
      logsEndRef.current.scrollIntoView({ behavior: "smooth" });
    }
  }, [selectedJob?.logs]);

  const triggerToast = (msg: string) => {
    setSuccessToast(msg);
    setTimeout(() => {
      setSuccessToast(null);
    }, 3000);
  };

  const handleToggleScheduler = async (active: boolean) => {
    setActionLoading(true);
    try {
      const res = await fetch("/api/ingestion/config", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ schedulerActive: active }),
      });
      if (res.ok) {
        triggerToast(active ? "Crawler scheduler started successfully!" : "Scheduler paused successfully.");
        await fetchStatsAndJobs();
      }
    } catch (err) {
      console.error(err);
    } finally {
      setActionLoading(false);
    }
  };

  const handleUpdateConfigSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setActionLoading(true);
    try {
      const res = await fetch("/api/ingestion/config", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ intervalMinutes: Number(customInterval), concurrencyLimit: Number(customConcurrency) }),
      });
      if (res.ok) {
        triggerToast("Scheduler configurations updated successfully!");
        await fetchStatsAndJobs();
      }
    } catch (err) {
      console.error(err);
    } finally {
      setActionLoading(false);
    }
  };

  const handleCrawlNow = async () => {
    setActionLoading(true);
    try {
      const res = await fetch("/api/ingestion/run-now", { method: "POST" });
      if (res.ok) {
        triggerToast("Crawl queued for all 9 public portals!");
        await fetchStatsAndJobs();
      }
    } catch (err) {
      console.error(err);
    } finally {
      setActionLoading(false);
    }
  };

  const handleClearHistory = async () => {
    if (!confirm("Are you sure you want to purge current jobs crawl history?")) return;
    setActionLoading(true);
    try {
      const res = await fetch("/api/ingestion/clear-queue", { method: "POST" });
      if (res.ok) {
        setSelectedJob(null);
        triggerToast("Crawl logs history cleared.");
        await fetchStatsAndJobs();
      }
    } catch (err) {
      console.error(err);
    } finally {
      setActionLoading(false);
    }
  };

  const handleRetryJob = async (jobId: string) => {
    setActionLoading(true);
    try {
      const res = await fetch(`/api/ingestion/jobs/${jobId}/retry`, { method: "POST" });
      if (res.ok) {
        triggerToast("Job enqueued for retry successfully.");
        await fetchStatsAndJobs();
      }
    } catch (err) {
      console.error(err);
    } finally {
      setActionLoading(false);
    }
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case "COMPLETED":
        return "bg-emerald-500/10 text-emerald-600 border border-emerald-500/20";
      case "RUNNING":
        return "bg-blue-500/10 text-blue-600 border border-blue-500/20 animate-pulse";
      case "PENDING":
        return "bg-amber-500/10 text-amber-600 border border-amber-500/20";
      case "FAILED":
        return "bg-rose-500/10 text-rose-600 border border-rose-500/20";
      default:
        return "bg-slate-500/10 text-slate-600 border border-slate-500/20";
    }
  };

  const getPortalStatusBadge = (status: "HEALTHY" | "DEGRADED" | "OFFLINE") => {
    switch (status) {
      case "HEALTHY":
        return (
          <span className="inline-flex items-center space-x-1.5 px-2 py-0.5 rounded-full text-[10px] font-extrabold bg-emerald-50 text-emerald-700 border border-emerald-100">
            <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />
            <span>ONLINE</span>
          </span>
        );
      case "DEGRADED":
        return (
          <span className="inline-flex items-center space-x-1.5 px-2 py-0.5 rounded-full text-[10px] font-extrabold bg-amber-50 text-amber-700 border border-amber-100">
            <span className="w-1.5 h-1.5 rounded-full bg-amber-500 animate-pulse" />
            <span>RETRYING</span>
          </span>
        );
      case "OFFLINE":
        return (
          <span className="inline-flex items-center space-x-1.5 px-2 py-0.5 rounded-full text-[10px] font-extrabold bg-rose-50 text-rose-700 border border-rose-100">
            <span className="w-1.5 h-1.5 rounded-full bg-rose-500" />
            <span>ERROR BLOCK</span>
          </span>
        );
    }
  };

  return (
    <div className="space-y-6">
      {/* Dynamic Success Alert toast notifications */}
      {successToast && (
        <div className="fixed top-20 right-6 z-[200] max-w-sm w-full bg-slate-900 text-white rounded-xl p-4 shadow-2xl flex items-center space-x-3 border border-slate-800 animate-slide-in">
          <ShieldCheck className="w-5 h-5 text-emerald-400 shrink-0" />
          <span className="text-xs font-bold">{successToast}</span>
        </div>
      )}

      {/* Top Banner Dashboard Context */}
      <div className="bg-white rounded-2xl border border-slate-200/80 p-6 shadow-sm overflow-hidden relative">
        <div className="absolute top-0 right-0 w-32 h-32 bg-slate-100 rounded-full blur-2xl opacity-40 pointer-events-none" />
        <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
          <div className="space-y-1">
            <div className="flex items-center space-x-2">
              <Server className="w-5 h-5 text-blue-600" />
              <span className="text-[10px] bg-blue-100 text-blue-800 font-extrabold px-2.5 py-0.5 rounded-full">
                PHASE 4 COMPLIANCE
              </span>
            </div>
            <h2 className="text-2xl font-black text-slate-800 tracking-tight">
              Sovereign Tender Collection System
            </h2>
            <p className="text-xs text-slate-500 max-w-2xl leading-relaxed">
              Durable, fault-tolerant procurement ingestion node. Monolithic polling queues feed GeM, CPPP, and corporate PSU services directly into relational backplanes with smart deduplication and automated exponential recovery.
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-2.5 shrink-0">
            <button
              onClick={fetchStatsAndJobs}
              disabled={loading || actionLoading}
              className="p-2.5 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-xl transition-all font-semibold text-xs flex items-center space-x-1.5 disabled:opacity-50 cursor-pointer"
              title="Reload stats"
            >
              <RefreshCw className={`w-4 h-4 ${loading ? "animate-spin" : ""}`} />
            </button>

            <button
              onClick={handleCrawlNow}
              disabled={actionLoading}
              className="px-4 py-2.5 bg-blue-600 hover:bg-blue-700 text-white rounded-xl shadow-md hover:shadow-blue-500/20 font-black text-xs flex items-center space-x-2 transition-all cursor-pointer"
            >
              <Zap className="w-4 h-4" />
              <span>Crawl & Ingest Now</span>
            </button>

            <button
              onClick={handleClearHistory}
              disabled={actionLoading}
              className="px-4 py-2.5 bg-slate-50 hover:bg-red-50 text-slate-500 hover:text-red-600 border border-slate-200 hover:border-red-200 rounded-xl font-bold text-xs flex items-center space-x-2 transition-all cursor-pointer"
            >
              <Trash2 className="w-4 h-4" />
              <span>Purge Audit logs</span>
            </button>
          </div>
        </div>
      </div>

      {/* Grid of Key stats metrics cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {/* Total Ingested documents */}
        <div className="bg-white p-5 rounded-2xl border border-slate-200/80 shadow-xs flex items-center space-x-4">
          <div className="w-12 h-12 bg-blue-50 text-blue-600 rounded-xl flex items-center justify-center border border-blue-100 shrink-0">
            <Database className="w-6 h-6" />
          </div>
          <div className="min-w-0">
            <p className="text-[10px] text-slate-400 font-extrabold uppercase tracking-wider">
              Total Ingested Bids
            </p>
            <p className="text-2xl font-black text-slate-800 tracking-tight mt-0.5">
              {stats?.stats.totalScrapedDocs || 0}
            </p>
            <p className="text-[9px] text-slate-500 font-medium truncate mt-0.5">
              Fully queryable inside feed
            </p>
          </div>
        </div>

        {/* Deduplication check saves */}
        <div className="bg-white p-5 rounded-2xl border border-slate-200/80 shadow-xs flex items-center space-x-4">
          <div className="w-12 h-12 bg-emerald-50 text-emerald-600 rounded-xl flex items-center justify-center border border-emerald-100 shrink-0">
            <CheckCircle className="w-6 h-6" />
          </div>
          <div className="min-w-0">
            <p className="text-[10px] text-slate-400 font-extrabold uppercase tracking-wider">
              Deduplication Saves
            </p>
            <p className="text-2xl font-black text-slate-800 tracking-tight mt-0.5">
              {stats?.stats.totalDeduplicated || 0}
            </p>
            <p className="text-[9px] text-emerald-600 font-extrabold bg-emerald-50 px-1.5 py-0.5 rounded border border-emerald-100 inline-block mt-0.5">
              100% ID Match Integrity
            </p>
          </div>
        </div>

        {/* Automated Recoveries counts */}
        <div className="bg-white p-5 rounded-2xl border border-slate-200/80 shadow-xs flex items-center space-x-4">
          <div className="w-12 h-12 bg-indigo-50 text-indigo-600 rounded-xl flex items-center justify-center border border-indigo-100 shrink-0">
            <Clock className="w-6 h-6 animate-pulse" />
          </div>
          <div className="min-w-0">
            <p className="text-[10px] text-slate-400 font-extrabold uppercase tracking-wider">
              Retry Recovery Interventions
            </p>
            <p className="text-2xl font-black text-slate-800 tracking-tight mt-0.5">
              {stats?.stats.totalRecoveries || 0}
            </p>
            <p className="text-[9px] text-slate-500 font-medium mt-0.5">
              Fatal error bypass is {stats?.stats.totalFailedAttempts ? "Active" : "Stable"}
            </p>
          </div>
        </div>

        {/* Active Scheduler Configuration status */}
        <div className="bg-white p-5 rounded-2xl border border-slate-200/80 shadow-xs flex items-center justify-between">
          <div className="flex items-center space-x-3 min-w-0">
            <div className={`w-12 h-12 rounded-xl flex items-center justify-center border shrink-0 ${
              stats?.config.schedulerActive
                ? "bg-sky-50 text-sky-600 border-sky-100"
                : "bg-slate-50 text-slate-400 border-slate-100"
            }`}>
              <Activity className="w-6 h-6" />
            </div>
            <div className="min-w-0">
              <p className="text-[10px] text-slate-400 font-extrabold uppercase tracking-wider truncate">
                Scheduler Status
              </p>
              <p className="text-slate-800 font-black tracking-tight text-sm mt-0.5">
                {stats?.config.schedulerActive ? `Every ${stats.config.intervalMinutes} mins` : "PAUSED"}
              </p>
              <p className="text-[9px] text-slate-400 font-medium truncate">
                Auto-poller loop backplane
              </p>
            </div>
          </div>

          <button
            onClick={() => handleToggleScheduler(!stats?.config.schedulerActive)}
            disabled={actionLoading}
            className={`px-3 py-1.5 rounded-lg text-[10px] font-black tracking-wider uppercase transition-all shadow-xs cursor-pointer ${
              stats?.config.schedulerActive
                ? "bg-slate-150 hover:bg-slate-200 text-slate-700"
                : "bg-blue-600 hover:bg-blue-700 text-white"
            }`}
          >
            {stats?.config.schedulerActive ? "Pause" : "Start"}
          </button>
        </div>
      </div>

      {/* Main columns grid: Configurations + Portal Coverage Matrices */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Configuration settings panel card */}
        <div className="bg-white rounded-2xl border border-slate-200/80 shadow-xs p-5 space-y-4 h-fit">
          <h3 className="text-base font-black text-slate-800 flex items-center space-x-2">
            <Clock className="w-4 h-4 text-slate-500" />
            <span>Config Hub Settings</span>
          </h3>
          <p className="text-xs text-slate-500">
            Adjust the polling backplane configurations. Fast polling generates mock records more rapidly.
          </p>

          <form onSubmit={handleUpdateConfigSubmit} className="space-y-4">
            <div>
              <label className="block text-[10px] font-black text-slate-400 uppercase tracking-wider mb-1">
                Scheduler Loop Interval (Minutes)
              </label>
              <div className="relative">
                <input
                  type="number"
                  min="1"
                  max="1440"
                  required
                  value={customInterval}
                  onChange={(e) => setCustomInterval(Number(e.target.value))}
                  className="w-full bg-slate-50 border border-slate-200 rounded-xl py-2 px-3 text-xs text-slate-800 focus:outline-none focus:border-blue-600 focus:ring-1 focus:ring-blue-600 font-extrabold"
                />
                <span className="absolute right-3 top-1/2 -translate-y-1/2 text-[9px] font-extrabold text-slate-400">
                  MINUTES
                </span>
              </div>
            </div>

            <div>
              <label className="block text-[10px] font-black text-slate-400 uppercase tracking-wider mb-1">
                Worker Concurrency Limit
              </label>
              <select
                value={customConcurrency}
                onChange={(e) => setCustomConcurrency(Number(e.target.value))}
                className="w-full bg-slate-50 border border-slate-200 rounded-xl py-2 px-3 text-xs text-slate-800 focus:outline-none focus:border-blue-600 focus:ring-1 focus:ring-blue-600 font-extrabold"
              >
                <option value={1}>1 Worker (Sequential Safeguard)</option>
                <option value={2}>2 Workers (Standard Concurrency)</option>
                <option value={4}>4 Workers (Aggressive Crawl backplane)</option>
                <option value={8}>8 Workers (Parallel Speed Load)</option>
              </select>
            </div>

            <button
              type="submit"
              disabled={actionLoading}
              className="w-full bg-indigo-600 hover:bg-indigo-700 text-white font-black py-2.5 rounded-xl text-xs transition-all shadow-md shadow-indigo-100 cursor-pointer text-center"
            >
              {actionLoading ? "Updating Config..." : "Commit Poller Configurations"}
            </button>
          </form>

          <div className="p-4 bg-slate-50 rounded-xl border border-slate-200/50 space-y-2">
            <h4 className="text-[9px] font-black text-slate-450 tracking-wider uppercase flex items-center space-x-1.5">
              <Radio className="w-3 h-3 text-emerald-500 animate-pulse" />
              <span>Deduplication backlink</span>
            </h4>
            <p className="text-[10px] text-slate-500 leading-normal">
              Internal checks scan the database for matching registration IDs (e.g., <code>externalId</code> like CPPP indices) prior to committing records, avoiding cluttered databases and keeping dashboards fresh.
            </p>
          </div>
        </div>

        {/* Portals Coverage breakdowns Table */}
        <div className="bg-white rounded-2xl border border-slate-200/80 shadow-xs p-5 lg:col-span-2 space-y-4">
          <div className="flex justify-between items-center">
            <h3 className="text-base font-black text-slate-800 flex items-center space-x-2">
              <Radio className="w-4.5 h-4.5 text-blue-600" />
              <span>Government Portals Coverage Matrix</span>
            </h3>
            <span className="text-[10px] text-blue-600 font-extrabold bg-blue-50 border border-blue-100 px-2 py-0.5 rounded-md">
              9 Active Portals
            </span>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs border-collapse">
              <thead>
                <tr className="border-b border-slate-100 text-slate-400 font-bold uppercase text-[9px] tracking-wider">
                  <th className="pb-3 pl-1 font-bold">Portal Name</th>
                  <th className="pb-3 text-center font-bold">API Type</th>
                  <th className="pb-3 text-center font-bold">Health Status</th>
                  <th className="pb-3 text-right font-bold">Injected Bids</th>
                  <th className="pb-3 text-right pr-1 font-bold">Success Rating</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {stats?.portalCoverage.map((p) => (
                  <tr key={p.portalKey} className="hover:bg-slate-50/50 transition-colors">
                    <td className="py-3 pl-1 font-extrabold text-slate-700 min-w-[200px]">
                      {p.displayName}
                    </td>
                    <td className="py-3 text-center">
                      <span className="inline-block px-2 py-0.5 bg-slate-100 text-slate-600 font-bold text-[9px] rounded uppercase">
                        {p.type}
                      </span>
                    </td>
                    <td className="py-3 text-center">
                      {getPortalStatusBadge(p.status)}
                    </td>
                    <td className="py-3 text-right font-black text-slate-800 pr-4">
                      {p.totalIngested}
                    </td>
                    <td className="py-3 text-right font-extrabold text-slate-600 pr-1">
                      <span className={p.successRate > 80 ? "text-emerald-600" : "text-amber-600"}>
                        {p.successRate}%
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </div>

      {/* Grid: Job Execution Queue and Active Logs Viewer console */}
      <div className="grid grid-cols-1 lg:grid-cols-5 gap-6">
        {/* Job queue task list panel */}
        <div className="bg-white rounded-2xl border border-slate-200/80 shadow-xs p-5 lg:col-span-2 space-y-4 h-[440px] flex flex-col">
          <div className="flex justify-between items-center shrink-0">
            <h3 className="text-sm font-black text-slate-800 flex items-center space-x-2">
              <Layers className="w-4 h-4 text-indigo-500" />
              <span>Crawl & Ingest Jobs Queue ({jobs.length})</span>
            </h3>
          </div>

          <div className="flex-1 overflow-y-auto space-y-2 pr-1.5 scrollbar-sm">
            {jobs.length === 0 ? (
              <div className="h-full flex flex-col items-center justify-center text-center p-4">
                <Layers className="w-8 h-8 text-slate-300 mb-2" />
                <p className="text-xs text-slate-500 font-bold">No jobs logged in queue.</p>
                <p className="text-[10px] text-slate-400 mt-0.5">Click "Crawl & Ingest Now" above to initiate a run.</p>
              </div>
            ) : (
              jobs.map((job) => (
                <div
                  key={job.id}
                  onClick={() => setSelectedJob(job)}
                  className={`p-3 rounded-xl border transition-all cursor-pointer text-xs flex justify-between items-center ${
                    selectedJob?.id === job.id
                      ? "bg-blue-50/50 border-blue-400 shadow-xs"
                      : "bg-slate-50/60 border-slate-200/80 hover:bg-slate-50"
                  }`}
                >
                  <div className="min-w-0 pr-2">
                    <div className="flex items-center space-x-2">
                      <span className="font-extrabold text-slate-800">{job.id}</span>
                      <span className={`px-1.5 py-0.5 rounded-md font-extrabold text-[8px] uppercase ${getStatusColor(job.status)}`}>
                        {job.status}
                      </span>
                    </div>
                    <p className="text-[11px] font-bold text-slate-700 mt-1 uppercase">
                      {job.portal.replace("_", " ")}
                    </p>
                    {job.recordsIngested > 0 && (
                      <p className="text-[9.5px] text-emerald-600 font-black mt-0.5">
                        ✓ Ingested {job.recordsIngested} bids
                      </p>
                    )}
                    {job.errorMessage && (
                      <p className="text-[9.5px] text-rose-500 font-medium truncate mt-0.5 max-w-[150px]">
                        Err: {job.errorMessage}
                      </p>
                    )}
                  </div>

                  <div className="text-right shrink-0">
                    <span className="text-[9px] text-slate-400 block font-bold">
                      {job.startedAt ? new Date(job.startedAt).toLocaleTimeString() : "Pending"}
                    </span>
                    {job.retryCount > 0 && (
                      <span className="inline-block text-[9px] text-amber-600 font-extrabold bg-amber-50 px-1.5 rounded mt-1 border border-amber-100">
                        Retry #{job.retryCount}/{job.maxRetries}
                      </span>
                    )}

                    {job.status === "FAILED" && (
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          handleRetryJob(job.id);
                        }}
                        className="mt-1 px-2 py-0.5 bg-blue-50 text-[#1B4FD8] font-bold text-[9px] rounded-lg border border-blue-100 hover:bg-blue-100 cursor-pointer block ml-auto transition-all"
                      >
                        Retry Job
                      </button>
                    )}
                  </div>
                </div>
              ))
            )}
          </div>
        </div>

        {/* Active Logs Console terminal */}
        <div className="bg-slate-900 rounded-2xl border border-slate-800 shadow-lg p-5 lg:col-span-3 h-[440px] flex flex-col relative text-slate-250">
          <div className="flex justify-between items-center border-b border-slate-800 pb-3 shrink-0">
            <div className="flex items-center space-x-2">
              <Terminal className="w-4 h-4 text-emerald-400" />
              <span className="text-xs font-bold text-slate-100 font-mono">Crawl Session Debugger Terminal</span>
            </div>
            {selectedJob && (
              <span className="text-[10px] font-mono text-slate-400 font-bold bg-slate-800 px-2 py-0.5 rounded">
                JOB: {selectedJob.id}
              </span>
            )}
          </div>

          <div className="flex-1 overflow-y-auto font-mono text-[10px] py-4 space-y-2 leading-relaxed scrollbar-dark select-all">
            {!selectedJob ? (
              <div className="h-full flex flex-col items-center justify-center text-center text-slate-500 space-y-2">
                <Terminal className="w-10 h-10 text-slate-700" />
                <p className="font-bold">Awaiting telemetry. Select a job trace on the left panel.</p>
                <p className="text-[9px] text-slate-600">Trace exponential backoff, rate limits, and network frames instantly.</p>
              </div>
            ) : (
              <>
                <div className="text-slate-550 border-b border-slate-850 pb-2 mb-2">
                  <p className="font-semibold text-slate-300">== TELEMETRY DIALOG REPORT ==</p>
                  <p>Target Portal: {selectedJob.portal.toUpperCase()}</p>
                  <p>Scheduler Trigger Time: {selectedJob.startedAt}</p>
                  <p>Session Backoff Rating: Retry Limit {selectedJob.maxRetries} backplanes</p>
                  {selectedJob.completedAt && <p>Completion Timestamp: {selectedJob.completedAt}</p>}
                </div>

                {selectedJob.logs.map((log, i) => {
                  let color = "text-slate-300";
                  if (log.includes("[Error]") || log.includes("[Fatal]")) color = "text-rose-450 font-bold";
                  else if (log.includes("[Database]") || log.includes("[Finished]")) color = "text-emerald-400 font-extrabold";
                  else if (log.includes("[Recovery-Engine]")) color = "text-amber-400 font-bold animate-pulse";
                  else if (log.includes("[Deduplication]")) color = "text-sky-300 font-medium";

                  return (
                    <div key={i} className={`flex items-start ${color}`}>
                      <ChevronRight className="w-3.5 h-3.5 mt-0.5 shrink-0 text-slate-600" />
                      <span className="ml-1 break-all">{log}</span>
                    </div>
                  );
                })}

                <div ref={logsEndRef} />
              </>
            )}
          </div>

          <div className="absolute bottom-2.5 right-4 pointer-events-none opacity-10">
            <Radio className="w-24 h-24 text-slate-400 animate-ping" />
          </div>
        </div>
      </div>
    </div>
  );
}
