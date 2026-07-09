import React, { useEffect, useMemo, useRef, useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import {
  Bar, BarChart, Cell, CartesianGrid,
  Pie, PieChart, ResponsiveContainer, Tooltip, XAxis, YAxis,
} from "recharts";
import { Search, Plus, Download, ChevronDown, X } from "lucide-react";
import { Sidebar } from "./Sidebar";
import { getOringDataFn, getOringTabsFn, addOringRecordFn } from "../lib/oring-server-functions";
import type { OringRecord } from "../lib/oring-sheets";

// ─── Constants ────────────────────────────────────────────────────────────────
const MONTHS = ["Jan","Feb","Mar","Apr","May","Jun","Jul","Aug","Sep","Oct","Nov","Dec"];
const PAGE_SIZE = 10;

// ─── Helpers ─────────────────────────────────────────────────────────────────
function formatMonthLabel(monthKey: string) {
  if (!monthKey) return "";
  const [year, month] = monthKey.split("-");
  return `${MONTHS[Number(month) - 1] || ""} ${year}`;
}

function formatDateLabel(dateKey: string) {
  if (!dateKey) return "";
  const date = new Date(`${dateKey}T00:00:00`);
  if (Number.isNaN(date.getTime())) return dateKey;
  return date.toLocaleDateString("en-US", { month: "short", day: "2-digit", year: "numeric" });
}

function sum(records: OringRecord[], key: keyof Pick<OringRecord,"valvesRepaired"|"good"|"reject">) {
  return records.reduce((t, r) => t + (r[key] || 0), 0);
}

type StatusTone = "good" | "warn" | "reject";
function getStatus(record: OringRecord): StatusTone {
  if (record.reject > 0) return "reject";
  if (record.valvesRepaired > 0) return "good";
  return "warn";
}

function inferRejectReason(remarks: string) {
  const t = remarks.toLowerCase();
  if (!t) return "Unspecified";
  if (t.includes("leak")) return "Leak";
  if (t.includes("wrong") || t.includes("size")) return "Wrong Size";
  if (t.includes("damage") || t.includes("crack")) return "Damage";
  if (t.includes("surface") || t.includes("scratch")) return "Surface Damage";
  if (t.includes("pressure")) return "Pressure Test Failure";
  if (t.includes("seal") || t.includes("groove")) return "Seal / Groove Issue";
  return "Other";
}

function useCountUp(value: number, duration = 700) {
  const [display, setDisplay] = useState(0);
  const raf = useRef<number | null>(null);
  useEffect(() => {
    const reduceMotion = window.matchMedia?.("(prefers-reduced-motion: reduce)").matches;
    if (reduceMotion) { setDisplay(value); return; }
    const start = performance.now();
    function tick(now: number) {
      const progress = Math.min((now - start) / duration, 1);
      const eased = 1 - Math.pow(1 - progress, 3);
      setDisplay(Math.round(eased * value));
      if (progress < 1) raf.current = requestAnimationFrame(tick);
    }
    raf.current = requestAnimationFrame(tick);
    return () => { if (raf.current) cancelAnimationFrame(raf.current); };
  }, [value, duration]);
  return display;
}

// ─── KPI Card ────────────────────────────────────────────────────────────────
function KpiCard({ label, value, unit, variant }: {
  label: string; value: string; unit?: string;
  variant: "blue" | "blue2" | "blue3" | "navy";
}) {
  const bg = { blue:"bg-[#2E3EA8]", blue2:"bg-[#273690]", blue3:"bg-[#202D78]", navy:"bg-[#1A2560]" }[variant];
  return (
    <div className={`relative overflow-hidden rounded-2xl p-5 shadow-sm ${bg} text-white`}>
      <div className="text-[10px] font-semibold uppercase tracking-[0.16em] text-white/70">{label}</div>
      <div className="mt-3 flex items-baseline gap-2">
        <div className="text-[30px] font-extrabold leading-none">{value}</div>
        {unit && <div className="text-[12px] font-semibold uppercase tracking-widest text-white/80">{unit}</div>}
      </div>
      <div className="pointer-events-none absolute -right-6 -bottom-6 h-24 w-24 rounded-full bg-white/5" />
    </div>
  );
}

// ─── Efficiency Card ─────────────────────────────────────────────────────────
function EfficiencyCard({ rate }: { rate: number }) {
  const tone = rate >= 90 ? "good" : rate >= 75 ? "warn" : "reject";
  const colors = {
    good:  { bg: "bg-[#1A2560]", badge: "bg-green-500/20 text-green-300",  label: "Excellent"       },
    warn:  { bg: "bg-[#1A2560]", badge: "bg-yellow-500/20 text-yellow-300", label: "Warning"         },
    reject:{ bg: "bg-[#1A2560]", badge: "bg-red-500/20 text-red-300",       label: "Needs Attention" },
  }[tone];
  return (
    <div className={`relative overflow-hidden rounded-2xl p-5 shadow-sm ${colors.bg} text-white ring-2 ring-white/10`}>
      <div className="text-[10px] font-semibold uppercase tracking-[0.16em] text-white/70">Efficiency Rate</div>
      <div className="mt-3 flex items-baseline gap-2">
        <div className="text-[34px] font-extrabold leading-none">{rate.toFixed(1)}</div>
        <div className="text-[14px] font-semibold text-white/80">%</div>
      </div>
      <span className={`mt-2 inline-block rounded-full px-2.5 py-0.5 text-[10px] font-bold ${colors.badge}`}>
        {colors.label}
      </span>
      <div className="pointer-events-none absolute -right-6 -bottom-6 h-28 w-28 rounded-full bg-white/5" />
    </div>
  );
}

// ─── Custom Tooltip ──────────────────────────────────────────────────────────
function ChartTooltip({ active, payload, label }: any) {
  if (!active || !payload?.length) return null;
  return (
    <div className="rounded-xl bg-[#1A2560] px-3 py-2 text-xs text-white shadow-lg">
      <p className="font-bold">{label}</p>
      {payload.map((p: any) => (
        <p key={p.dataKey} className="text-white/80">{p.name ?? p.dataKey}: <b className="text-white">{p.value}</b></p>
      ))}
    </div>
  );
}

// ─── Main Component ──────────────────────────────────────────────────────────
export default function OringMonitoring() {
  const qc = useQueryClient();
  const { data: records = [], isLoading, error } = useQuery({
    queryKey: ["oring-records", "all"],
    queryFn: () => getOringDataFn({ data: "All" }),
    staleTime: 1000 * 60 * 2,   // treat data as fresh for 2 minutes
    refetchOnWindowFocus: false, // don't re-fetch when tab regains focus
  });

  // Fetch actual sheet tab names so the save goes to the right tab
  const { data: sheetTabs = [] } = useQuery({
    queryKey: ["oring-tabs"],
    queryFn: () => getOringTabsFn(),
    staleTime: 1000 * 60 * 10,
    refetchOnWindowFocus: false,
  });

  const [selectedMonth, setSelectedMonth] = useState("All");
  const [chartView, setChartView] = useState<"Monthly" | "Quarterly" | "Yearly">("Monthly");
  const [page, setPage] = useState(1);
  const [filters, setFilters] = useState({ status: "All Status" });
  const [tableView, setTableView] = useState<"Monthly" | "Quarterly" | "Yearly">("Monthly");
  const [search, setSearch] = useState("");
  const [addOpen, setAddOpen] = useState(false);
  const monthInitialized = useRef(false);

  const addRecord = useMutation({
    mutationFn: (d: Parameters<typeof addOringRecordFn>[0]["data"]) =>
      addOringRecordFn({ data: d }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["oring-records", "all"] });
      setAddOpen(false);
    },
  });

  const allRecords = useMemo(() => [...records].sort((a, b) => {
    if (a.dateKey !== b.dateKey) return b.dateKey.localeCompare(a.dateKey);
    if (a.timeSort !== b.timeSort) return b.timeSort - a.timeSort;
    return b.rowNumber - a.rowNumber;
  }), [records]);

  const monthOptions = useMemo(() => {
    const map = new Map<string, string>();
    for (const r of allRecords) if (r.monthKey && !map.has(r.monthKey)) map.set(r.monthKey, formatMonthLabel(r.monthKey));
    return Array.from(map.entries()).sort(([a],[b]) => a.localeCompare(b)).map(([key, label]) => ({ key, label }));
  }, [allRecords]);

  useEffect(() => {
    if (!monthInitialized.current && monthOptions.length > 0) {
      setSelectedMonth(monthOptions[monthOptions.length - 1].key);
      monthInitialized.current = true;
    }
  }, [monthOptions]);

  const focusMonthKey = selectedMonth === "All" ? (monthOptions[monthOptions.length - 1]?.key || "") : selectedMonth;

  const focusRecords = useMemo(() =>
    focusMonthKey ? allRecords.filter(r => r.monthKey === focusMonthKey) : allRecords,
  [allRecords, focusMonthKey]);

  const totalRepaired = useMemo(() => sum(focusRecords, "valvesRepaired"), [focusRecords]);
  const totalGood     = useMemo(() => sum(focusRecords, "good"),           [focusRecords]);
  const totalReject   = useMemo(() => sum(focusRecords, "reject"),         [focusRecords]);
  const passRate = totalRepaired ? (totalGood / totalRepaired) * 100 : 0;

  const totalDisplay  = useCountUp(totalRepaired);
  const goodDisplay   = useCountUp(totalGood);
  const rejectDisplay = useCountUp(totalReject);

  // Daily bar chart data
  const trendData = useMemo(() => {
    const map = new Map<string, { day: string; repaired: number; good: number; reject: number }>();
    for (const r of focusRecords) {
      const ex = map.get(r.dateKey) || { day: formatDateLabel(r.dateKey), repaired: 0, good: 0, reject: 0 };
      ex.repaired += r.valvesRepaired; ex.good += r.good; ex.reject += r.reject;
      map.set(r.dateKey, ex);
    }
    return Array.from(map.entries()).sort(([a],[b]) => a.localeCompare(b)).map(([,v]) => v);
  }, [focusRecords]);

  // Reject reasons
  const rejectReasons = useMemo(() => {
    const map = new Map<string, number>();
    for (const r of focusRecords) {
      if (r.reject <= 0) continue;
      const reason = inferRejectReason(r.remarks);
      map.set(reason, (map.get(reason) || 0) + r.reject);
    }
    return Array.from(map.entries()).map(([reason, count]) => ({ reason, count }))
      .sort((a,b) => b.count - a.count).slice(0, 5);
  }, [focusRecords]);

  // ── Chart panel data — driven by chartView (Monthly / Quarterly / Yearly) ──
  const chartBarData = useMemo(() => {
    if (chartView === "Monthly") {
      // Group all records by month
      const map = new Map<string, number>();
      for (const r of allRecords) {
        if (!r.monthKey) continue;
        map.set(r.monthKey, (map.get(r.monthKey) || 0) + r.valvesRepaired);
      }
      return Array.from(map.entries())
        .sort(([a],[b]) => a.localeCompare(b))
        .map(([key, repaired]) => ({ label: formatMonthLabel(key), repaired }));
    }
    if (chartView === "Quarterly") {
      const map = new Map<string, number>();
      for (const r of allRecords) {
        if (!r.monthKey) continue;
        const [year, month] = r.monthKey.split("-");
        const q = Math.ceil(Number(month) / 3);
        const key = `${year} Q${q}`;
        map.set(key, (map.get(key) || 0) + r.valvesRepaired);
      }
      return Array.from(map.entries())
        .sort(([a],[b]) => a.localeCompare(b))
        .map(([label, repaired]) => ({ label, repaired }));
    }
    // Yearly
    const map = new Map<string, number>();
    for (const r of allRecords) {
      if (!r.monthKey) continue;
      const year = r.monthKey.slice(0, 4);
      map.set(year, (map.get(year) || 0) + r.valvesRepaired);
    }
    return Array.from(map.entries())
      .sort(([a],[b]) => a.localeCompare(b))
      .map(([label, repaired]) => ({ label, repaired }));
  }, [allRecords, chartView]);

  const chartDonutData = useMemo(() => {
    // Filter allRecords to only the period shown in the bar chart
    let pool = allRecords;
    if (chartView === "Monthly") {
      // Use the currently selected month (or latest)
      pool = focusMonthKey ? allRecords.filter(r => r.monthKey === focusMonthKey) : allRecords;
    } else if (chartView === "Quarterly") {
      // Use current quarter
      const now = new Date();
      const curQ = Math.ceil((now.getMonth() + 1) / 3);
      const curYear = now.getFullYear();
      pool = allRecords.filter(r => {
        if (!r.monthKey) return false;
        const [y, m] = r.monthKey.split("-");
        return Number(y) === curYear && Math.ceil(Number(m) / 3) === curQ;
      });
      if (pool.length === 0) pool = allRecords; // fallback to all
    }
    // Yearly = all records
    const g = sum(pool, "good");
    const rej = sum(pool, "reject");
    return { good: g, reject: rej, rate: (g + rej) > 0 ? (g / (g + rej)) * 100 : 0 };
  }, [allRecords, chartView, focusMonthKey]);

  // Filtered table rows
  // Records filtered by tableView period + search
  const tableRecords = useMemo(() => {
    let pool = allRecords;
    if (tableView === "Monthly") {
      pool = focusMonthKey ? allRecords.filter(r => r.monthKey === focusMonthKey) : allRecords;
    } else if (tableView === "Quarterly") {
      const now = new Date();
      const curQ = Math.ceil((now.getMonth() + 1) / 3);
      const curYear = now.getFullYear();
      const filtered = allRecords.filter(r => {
        if (!r.monthKey) return false;
        const [y, m] = r.monthKey.split("-");
        return Number(y) === curYear && Math.ceil(Number(m) / 3) === curQ;
      });
      pool = filtered.length > 0 ? filtered : allRecords;
    }
    // Yearly = all records (pool stays allRecords)
    return pool;
  }, [allRecords, tableView, focusMonthKey]);

  const visibleRecords = useMemo(() => tableRecords.filter(r => {
    if (search && !(r.valveCameFrom + r.installedTo + r.remarks + r.date).toLowerCase().includes(search.toLowerCase())) return false;
    return true;
  }), [tableRecords, search]);

  useEffect(() => { setPage(1); }, [selectedMonth, tableView, search]);

  const totalPages = Math.max(1, Math.ceil(visibleRecords.length / PAGE_SIZE));
  const pagedRows  = visibleRecords.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE);

  const displayError = error instanceof Error ? error : null;
  const currentLabel = selectedMonth === "All" ? "All Data" : formatMonthLabel(focusMonthKey);

  const donutData = [
    { name: "Good",   value: totalGood   },
    { name: "Reject", value: totalReject },
  ];

  return (
    <div className="h-screen bg-ccb-canvas overflow-hidden">
      <div className="flex h-full bg-white">
        <Sidebar />
        <div className="flex-1 flex flex-col h-full overflow-hidden">

          {/* ── Header ── */}
          <div className="bg-white border-b border-ccb-border shrink-0">
            <div className="flex items-center justify-between px-8 py-4 gap-4 flex-wrap">
              <div>
                <h1 className="text-[18px] font-bold leading-tight text-ccb-navy">O-Ring Report</h1>
                <p className="text-[12px] text-ccb-muted">Monitor, Track, and Manage O-Ring Installation Activities</p>
              </div>
              <div className="flex items-center gap-3 flex-wrap">
                {/* Month selector */}
                <div className="relative">
                  <select
                    value={selectedMonth}
                    onChange={e => { setSelectedMonth(e.target.value); setPage(1); }}
                    className="appearance-none rounded-lg border border-ccb-border bg-white pl-3 pr-8 py-2 text-[12.5px] font-semibold text-ccb-navy outline-none focus:border-ccb-blue"
                  >
                    <option value="All">All Months</option>
                    {monthOptions.map(o => <option key={o.key} value={o.key}>{o.label}</option>)}
                  </select>
                  <ChevronDown size={14} className="pointer-events-none absolute right-2 top-1/2 -translate-y-1/2 text-ccb-muted" />
                </div>
                {/* Search */}
                <div className="relative">
                  <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-ccb-muted pointer-events-none" />
                  <input
                    value={search}
                    onChange={e => setSearch(e.target.value)}
                    placeholder="Search records..."
                    className="pl-9 pr-3 py-2 rounded-lg border border-ccb-border text-[12.5px] text-ccb-navy placeholder:text-ccb-muted-2 outline-none focus:border-ccb-blue w-48"
                  />
                </div>
                <button className="flex items-center gap-1.5 rounded-lg border border-ccb-border bg-white px-3 py-2 text-[12.5px] font-semibold text-ccb-navy hover:bg-ccb-canvas transition">
                  <Download size={14} /> Export
                </button>
                <button
                  onClick={() => setAddOpen(true)}
                  className="flex items-center gap-1.5 rounded-lg bg-ccb-blue px-3 py-2 text-[12.5px] font-semibold text-white hover:bg-ccb-navy transition">
                  <Plus size={14} /> Add Record
                </button>
              </div>
            </div>
            <div className="h-[3px] bg-ccb-red" />
          </div>

          {/* ── Scrollable body ── */}
          <div className="flex-1 overflow-y-auto bg-ccb-canvas">
            <div className="p-7 space-y-5">

              {isLoading ? (
                <div className="flex items-center justify-center h-48">
                  <p className="text-ccb-muted animate-pulse">Loading O-Ring data...</p>
                </div>
              ) : displayError ? (
                <div className="flex items-center justify-center h-48">
                  <p className="text-ccb-red text-sm max-w-lg text-center">Failed to load O-Ring data: {displayError.message}</p>
                </div>
              ) : (
                <>
                  {/* ── KPI Cards ── */}
                  <div className="grid grid-cols-2 xl:grid-cols-4 gap-4">
                    <KpiCard variant="blue"  label="Total O-Rings Installed" value={totalDisplay.toLocaleString()} />
                    <KpiCard variant="blue2" label="Good O-Rings"            value={goodDisplay.toLocaleString()} />
                    <KpiCard variant="blue3" label="Reject O-Rings"          value={rejectDisplay.toLocaleString()} />
                    <EfficiencyCard rate={passRate} />
                  </div>

                  {/* ── Dashboard Charts — unified parent panel ── */}
                  <div className="rounded-2xl bg-white border border-ccb-border shadow-sm overflow-hidden">
                    {/* Parent header with dropdown */}
                    <div className="flex items-center justify-between px-5 py-4 border-b border-ccb-border">
                      <div>
                        <h3 className="text-[13.5px] font-bold text-ccb-navy">Production Overview</h3>
                        <p className="text-[11px] text-ccb-muted mt-0.5">O-Ring installations and quality breakdown</p>
                      </div>
                      <div className="relative">
                        <select
                          value={chartView}
                          onChange={e => setChartView(e.target.value as "Monthly" | "Quarterly" | "Yearly")}
                          className="appearance-none rounded-lg border border-ccb-border bg-ccb-canvas pl-3 pr-8 py-2 text-[12.5px] font-semibold text-ccb-navy outline-none focus:border-ccb-blue"
                        >
                          <option value="Monthly">Monthly</option>
                          <option value="Quarterly">Quarterly</option>
                          <option value="Yearly">Yearly</option>
                        </select>
                        <ChevronDown size={14} className="pointer-events-none absolute right-2 top-1/2 -translate-y-1/2 text-ccb-muted" />
                      </div>
                    </div>

                    {/* Two charts side by side inside the parent */}
                    <div className="grid grid-cols-1 xl:grid-cols-[1fr_300px] divide-y xl:divide-y-0 xl:divide-x divide-ccb-border">

                      {/* Bar chart */}
                      <div className="p-5">
                        <div className="mb-3">
                          <p className="text-[12px] font-bold text-ccb-navy">O-Ring Production</p>
                          <p className="text-[11px] text-ccb-muted">Total installed per {chartView.toLowerCase()} period</p>
                        </div>
                        {chartBarData.length === 0 ? (
                          <div className="flex items-center justify-center h-48 text-ccb-muted text-sm">No data available</div>
                        ) : (
                          <ResponsiveContainer width="100%" height={220}>
                            <BarChart data={chartBarData} margin={{ top: 4, right: 4, left: -20, bottom: 0 }}>
                              <CartesianGrid vertical={false} stroke="#E5E8F4" />
                              <XAxis dataKey="label" tick={{ fontSize: 10, fill: "#5A6488" }} axisLine={false} tickLine={false} />
                              <YAxis tick={{ fontSize: 10, fill: "#5A6488" }} axisLine={false} tickLine={false} />
                              <Tooltip content={<ChartTooltip />} cursor={{ fill: "rgba(41,58,146,0.06)" }} />
                              <Bar dataKey="repaired" name="Installed" fill="#293A92" radius={[6,6,0,0]} maxBarSize={44} />
                            </BarChart>
                          </ResponsiveContainer>
                        )}
                      </div>

                      {/* Donut chart */}
                      <div className="p-5 flex flex-col">
                        <div className="mb-3">
                          <p className="text-[12px] font-bold text-ccb-navy">Good vs Reject</p>
                          <p className="text-[11px] text-ccb-muted">Quality breakdown · {chartView}</p>
                        </div>
                        <div className="relative flex items-center justify-center flex-1">
                          <ResponsiveContainer width="100%" height={180}>
                            <PieChart>
                              <Pie
                                data={[
                                  { name: "Good",   value: chartDonutData.good   },
                                  { name: "Reject", value: chartDonutData.reject },
                                ]}
                                dataKey="value"
                                innerRadius="60%"
                                outerRadius="85%"
                                startAngle={90}
                                endAngle={-270}
                              >
                                <Cell fill="#293A92" />
                                <Cell fill="#C0392B" />
                              </Pie>
                              <Tooltip content={<ChartTooltip />} />
                            </PieChart>
                          </ResponsiveContainer>
                          <div className="absolute text-center pointer-events-none">
                            <div className="text-[22px] font-extrabold text-ccb-navy leading-none">{chartDonutData.rate.toFixed(1)}%</div>
                            <div className="text-[9px] font-bold uppercase tracking-widest text-ccb-muted mt-1">Efficiency</div>
                          </div>
                        </div>
                        <div className="mt-3 space-y-2">
                          <div className="flex items-center justify-between rounded-lg bg-ccb-canvas px-3 py-2">
                            <div className="flex items-center gap-2">
                              <span className="h-2.5 w-2.5 rounded-full bg-[#293A92]" />
                              <span className="text-[12px] font-semibold text-ccb-navy">Good</span>
                            </div>
                            <span className="text-[13px] font-bold text-ccb-navy">{chartDonutData.good.toLocaleString()}</span>
                          </div>
                          <div className="flex items-center justify-between rounded-lg bg-ccb-canvas px-3 py-2">
                            <div className="flex items-center gap-2">
                              <span className="h-2.5 w-2.5 rounded-full bg-[#C0392B]" />
                              <span className="text-[12px] font-semibold text-ccb-navy">Reject</span>
                            </div>
                            <span className="text-[13px] font-bold text-ccb-navy">{chartDonutData.reject.toLocaleString()}</span>
                          </div>
                        </div>
                      </div>

                    </div>
                  </div>

                  {/* ── Monitoring Table (header = Search Filter) ── */}
                  <div className="rounded-2xl bg-white border border-ccb-border shadow-sm overflow-hidden">

                    {/* ── Unified panel header: title + single search + status dropdown ── */}
                    <div className="flex items-center justify-between gap-3 flex-wrap px-5 py-3 border-b border-ccb-border">
                      <div>
                        <h3 className="text-[13.5px] font-bold text-ccb-navy">O-Ring Records</h3>
                        <p className="text-[11px] text-ccb-muted mt-0.5">{visibleRecords.length} records · {currentLabel}</p>
                      </div>
                      <div className="flex items-center gap-2 flex-wrap">
                        {/* ‹ Month › navigator */}
                        <div className="flex items-center rounded-lg border border-ccb-border bg-white overflow-hidden shrink-0">
                          <button
                            type="button"
                            onClick={() => {
                              const idx = monthOptions.findIndex(o => o.key === (selectedMonth === "All" ? focusMonthKey : selectedMonth));
                              if (idx > 0) setSelectedMonth(monthOptions[idx - 1].key);
                            }}
                            disabled={monthOptions.findIndex(o => o.key === (selectedMonth === "All" ? focusMonthKey : selectedMonth)) <= 0}
                            className="px-3 py-2 text-ccb-muted hover:text-ccb-navy hover:bg-ccb-canvas disabled:opacity-30 disabled:cursor-not-allowed transition border-r border-ccb-border"
                          >
                            ‹
                          </button>
                          <span className="px-4 py-2 text-[12.5px] font-semibold text-ccb-navy min-w-[110px] text-center">
                            {currentLabel}
                          </span>
                          <button
                            type="button"
                            onClick={() => {
                              const idx = monthOptions.findIndex(o => o.key === (selectedMonth === "All" ? focusMonthKey : selectedMonth));
                              if (idx < monthOptions.length - 1) setSelectedMonth(monthOptions[idx + 1].key);
                            }}
                            disabled={monthOptions.findIndex(o => o.key === (selectedMonth === "All" ? focusMonthKey : selectedMonth)) >= monthOptions.length - 1}
                            className="px-3 py-2 text-ccb-muted hover:text-ccb-navy hover:bg-ccb-canvas disabled:opacity-30 disabled:cursor-not-allowed transition border-l border-ccb-border"
                          >
                            ›
                          </button>
                        </div>
                        {/* Single search */}
                        <div className="relative">
                          <Search size={13} className="absolute left-3 top-1/2 -translate-y-1/2 text-ccb-muted pointer-events-none" />
                          <input
                            value={search}
                            onChange={e => setSearch(e.target.value)}
                            placeholder="Search valve source, installed to, remarks..."
                            className="pl-8 pr-3 py-2 rounded-lg border border-ccb-border bg-ccb-canvas text-[12px] text-ccb-navy placeholder:text-ccb-muted-2 outline-none focus:border-ccb-blue w-72"
                          />
                        </div>
                        {/* Monthly / Quarterly / Yearly dropdown */}
                        <div className="relative">
                          <select
                            value={tableView}
                            onChange={e => { setTableView(e.target.value as "Monthly" | "Quarterly" | "Yearly"); setPage(1); }}
                            className="appearance-none rounded-lg border border-ccb-border bg-ccb-canvas pl-3 pr-8 py-2 text-[12px] text-ccb-navy outline-none focus:border-ccb-blue"
                          >
                            <option value="Monthly">Monthly</option>
                            <option value="Quarterly">Quarterly</option>
                            <option value="Yearly">Yearly</option>
                          </select>
                          <ChevronDown size={13} className="pointer-events-none absolute right-2 top-1/2 -translate-y-1/2 text-ccb-muted" />
                        </div>
                        {/* Clear */}
                        {(search) && (
                          <button
                            onClick={() => { setSearch(""); setFilters({ status: "All Status" }); }}
                            className="rounded-lg border border-ccb-border bg-white px-3 py-2 text-[12px] font-semibold text-ccb-muted hover:text-ccb-navy hover:bg-ccb-canvas transition"
                          >
                            Clear
                          </button>
                        )}
                      </div>
                    </div>

                    {/* Scrollable table — no pagination, scroll instead */}
                    <div className="overflow-x-auto overflow-y-auto" style={{ maxHeight: "420px" }}>
                      <table className="w-full text-[12.5px]" style={{ borderCollapse: "collapse" }}>
                        <thead>
                          <tr className="bg-ccb-canvas border-b border-ccb-border">
                            {["Date","Time","Valve Source","Repaired","Installed To","Good","Reject","Remarks"].map(h => (
                              <th key={h} className="px-4 py-3 text-left text-[10px] font-bold uppercase tracking-wider text-ccb-muted whitespace-nowrap sticky top-0 bg-ccb-canvas z-10">
                                {h}
                              </th>
                            ))}
                          </tr>
                        </thead>
                        <tbody>
                          {visibleRecords.map((record, idx) => {
                            const zebra = idx % 2 === 1 ? "bg-[#FAFBFF]" : "bg-white";
                            return (
                              <tr key={`${record.tabName}-${record.rowNumber}`}
                                className={`${zebra} hover:bg-ccb-blue/5 border-b border-ccb-border transition-colors`}>
                                <td className="px-4 py-3 whitespace-nowrap text-ccb-navy font-medium">{formatDateLabel(record.dateKey)}</td>
                                <td className="px-4 py-3 whitespace-nowrap text-ccb-muted">{record.time || "—"}</td>
                                <td className="px-4 py-3 whitespace-nowrap font-bold text-ccb-navy">{record.valveCameFrom || "—"}</td>
                                <td className="px-4 py-3 whitespace-nowrap text-ccb-navy">{record.valvesRepaired}</td>
                                <td className="px-4 py-3 whitespace-nowrap text-ccb-muted">{record.installedTo || "—"}</td>
                                <td className="px-4 py-3 whitespace-nowrap font-bold text-green-700">{record.good}</td>
                                <td className="px-4 py-3 whitespace-nowrap font-bold text-ccb-red">{record.reject}</td>
                                <td className="px-4 py-3 text-ccb-muted max-w-[200px] truncate">{record.remarks || "—"}</td>
                              </tr>
                            );
                          })}
                          {visibleRecords.length === 0 && (
                            <tr>
                              <td colSpan={8} className="px-4 py-10 text-center text-ccb-muted text-sm">
                                No records match your current filters.
                              </td>
                            </tr>
                          )}
                        </tbody>
                      </table>
                    </div>

                    {/* Footer — record count only, no pagination */}
                    <div className="flex items-center justify-between px-5 py-3 border-t border-ccb-border bg-white">
                      <p className="text-[11px] text-ccb-muted">{visibleRecords.length} records</p>
                    </div>
                  </div>

                </>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* ── Add Record Modal ── */}
      {addOpen && (
        <AddRecordModal
          tabName={sheetTabs[0] || "Sheet1"}
          tabOptions={sheetTabs}
          saving={addRecord.isPending}
          onClose={() => setAddOpen(false)}
          onSave={(payload) => addRecord.mutate(payload)}
        />
      )}
    </div>
  );
}

// ─── Add Report Modal (date groups → shifts) ─────────────────────────────────
type ShiftRow = {
  id: string;
  time: string;
  valveCameFrom: string;
  installedTo: string;
  valvesRepaired: string;
  good: string;
  reject: string;
  remarks: string;
};

type DateGroup = {
  id: string;
  date: string;
  shifts: ShiftRow[];
};

let _uid = 0;
const uid = () => String(++_uid);

function emptyShift(): ShiftRow {
  return { id: uid(), time: "", valveCameFrom: "", installedTo: "", valvesRepaired: "", good: "", reject: "", remarks: "" };
}
function emptyGroup(): DateGroup {
  return { id: uid(), date: new Date().toISOString().split("T")[0], shifts: [emptyShift()] };
}

function AddRecordModal({ tabName, tabOptions, saving, onClose, onSave }: {
  tabName: string;
  tabOptions: string[];
  saving: boolean;
  onClose: () => void;
  onSave: (payload: Parameters<typeof addOringRecordFn>[0]["data"]) => void;
}) {
  const [selectedTab, setSelectedTab] = useState(tabName);
  const [groups, setGroups] = useState<DateGroup[]>([emptyGroup()]);

  // ── Group helpers ────────────────────────────────────────────────────────
  function addGroup() { setGroups(g => [...g, emptyGroup()]); }
  function removeGroup(gid: string) {
    setGroups(g => g.length > 1 ? g.filter(x => x.id !== gid) : g);
  }
  function updateGroupDate(gid: string, date: string) {
    setGroups(g => g.map(x => x.id === gid ? { ...x, date } : x));
  }

  // ── Shift helpers ────────────────────────────────────────────────────────
  function addShift(gid: string) {
    setGroups(g => g.map(x => {
      if (x.id !== gid) return x;
      const prev = x.shifts[x.shifts.length - 1];
      const newShift: ShiftRow = {
        ...emptyShift(),
        // Pre-fill from previous shift — editable
        valveCameFrom: prev?.valveCameFrom ?? "",
        installedTo:   prev?.installedTo   ?? "",
        remarks:       prev?.remarks       ?? "",
      };
      return { ...x, shifts: [...x.shifts, newShift] };
    }));
  }
  function removeShift(gid: string, sid: string) {
    setGroups(g => g.map(x => x.id === gid
      ? { ...x, shifts: x.shifts.length > 1 ? x.shifts.filter(s => s.id !== sid) : x.shifts }
      : x));
  }
  function updateShift(gid: string, sid: string, field: keyof Omit<ShiftRow,"id">, value: string) {
    setGroups(g => g.map(x => x.id === gid
      ? { ...x, shifts: x.shifts.map(s => s.id === sid ? { ...s, [field]: value } : s) }
      : x));
  }

  // ── Grand totals preview ─────────────────────────────────────────────────
  const allShifts = groups.flatMap(g => g.shifts);
  const grandGood     = allShifts.reduce((t, s) => t + (Number(s.good)           || 0), 0);
  const grandReject   = allShifts.reduce((t, s) => t + (Number(s.reject)         || 0), 0);
  const grandRepaired = allShifts.reduce((t, s) => t + (Number(s.valvesRepaired) || (Number(s.good) + Number(s.reject))), 0);

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    onSave({
      tabName: selectedTab,
      valveCameFrom: "",  // per-shift now, kept for backend compat (ignored)
      dateGroups: groups.map(g => ({
        date: g.date,
        shifts: g.shifts.map(s => ({
          time:           s.time,
          valveCameFrom:  s.valveCameFrom.trim(),
          installedTo:    s.installedTo.trim(),
          valvesRepaired: Number(s.valvesRepaired) || (Number(s.good) + Number(s.reject)),
          good:           Number(s.good)   || 0,
          reject:         Number(s.reject) || 0,
          remarks:        s.remarks.trim(),
        })),
      })),
    });
  }

  const totalShifts = allShifts.length;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-ccb-navy/50 backdrop-blur-sm p-4"
      onClick={onClose}>
      <div className="w-[96vw] max-w-5xl max-h-[92vh] flex flex-col rounded-2xl bg-white shadow-[0_30px_80px_-20px_rgba(26,37,96,0.5)] overflow-hidden"
        onClick={e => e.stopPropagation()}>

        {/* Header */}
        <div className="flex items-center justify-between px-8 py-4 border-b border-ccb-border shrink-0">
          <div>
            <h2 className="text-[15px] font-bold text-ccb-navy">Add O-Ring Report</h2>
            <div className="flex items-center gap-2 mt-0.5">
              <span className="text-[11px] text-ccb-muted">Save to sheet:</span>
              <div className="relative">
                <select
                  value={selectedTab}
                  onChange={e => setSelectedTab(e.target.value)}
                  className="appearance-none rounded-lg border border-ccb-border bg-ccb-canvas pl-2.5 pr-7 py-1 text-[12px] font-semibold text-ccb-navy outline-none focus:border-ccb-blue"
                >
                  {tabOptions.length > 0
                    ? tabOptions.map(t => <option key={t} value={t}>{t}</option>)
                    : <option value={selectedTab}>{selectedTab}</option>
                  }
                </select>
                <ChevronDown size={12} className="pointer-events-none absolute right-2 top-1/2 -translate-y-1/2 text-ccb-muted" />
              </div>
            </div>
          </div>
          <button type="button" onClick={onClose}
            className="rounded-lg p-1.5 text-ccb-muted hover:bg-ccb-canvas hover:text-ccb-navy transition">
            <X size={18} />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="flex flex-col flex-1 overflow-hidden">
          <div className="flex-1 overflow-y-auto px-8 py-5 space-y-4">

            {/* Add Date button at top */}
            <div className="flex items-center justify-between">
              <p className="text-[12px] font-bold text-ccb-navy">{groups.length} Date Group{groups.length > 1 ? "s" : ""}</p>
              <button type="button" onClick={addGroup}
                className="flex items-center gap-1.5 rounded-lg border border-ccb-blue px-3 py-2 text-[12px] font-semibold text-ccb-blue hover:bg-ccb-blue hover:text-white transition">
                <Plus size={13} /> Add Date
              </button>
            </div>

            {/* Date groups */}
            {groups.map((group, gi) => {
              const groupGood     = group.shifts.reduce((t, s) => t + (Number(s.good)   || 0), 0);
              const groupReject   = group.shifts.reduce((t, s) => t + (Number(s.reject) || 0), 0);
              const groupRepaired = group.shifts.reduce((t, s) => t + (Number(s.valvesRepaired) || (Number(s.good) + Number(s.reject))), 0);

              return (
                <div key={group.id} className="rounded-xl border border-ccb-border overflow-hidden">
                  {/* Date group header */}
                  <div className="flex items-center gap-3 bg-ccb-canvas px-4 py-3 border-b border-ccb-border">
                    <span className="text-[11px] font-bold uppercase tracking-wider text-ccb-muted w-8">
                      #{gi + 1}
                    </span>
                    <input type="date" value={group.date} onChange={e => updateGroupDate(group.id, e.target.value)}
                      className="rounded-lg border border-ccb-border bg-white px-3 py-2 text-[13px] text-ccb-navy outline-none focus:border-ccb-blue" />
                    <span className="ml-auto text-[12px] text-ccb-muted font-medium">
                      {group.shifts.length} shift{group.shifts.length !== 1 ? "s" : ""}
                    </span>
                    <button type="button" onClick={() => addShift(group.id)}
                      className="flex items-center gap-1.5 rounded-lg border border-ccb-border bg-white px-3 py-1.5 text-[12px] font-semibold text-ccb-navy hover:border-ccb-blue hover:text-ccb-blue transition">
                      <Plus size={12} /> Shift
                    </button>
                    {groups.length > 1 && (
                      <button type="button" onClick={() => removeGroup(group.id)}
                        className="rounded-lg p-1.5 text-ccb-muted hover:text-ccb-red hover:bg-red-50 transition">
                        <X size={15} />
                      </button>
                    )}
                  </div>

                  {/* Shift rows */}
                  <div className="p-4 space-y-2">
                    {/* Column headers */}
                    <div className="grid gap-x-4" style={{ gridTemplateColumns: "12fr 22fr 22fr 8fr 8fr 8fr 20fr auto" }}>
                      {["Time","Valve From","Installed To","Rep.","Good","Rej.","Remarks",""].map((h, i) => (
                        <span key={i} className="text-[10px] font-bold uppercase tracking-wider text-ccb-muted truncate">{h}</span>
                      ))}
                    </div>

                    {group.shifts.map(s => (
                      <div key={s.id} className="grid gap-x-4 gap-y-2 items-center"
                        style={{ gridTemplateColumns: "12fr 22fr 22fr 8fr 8fr 8fr 20fr auto" }}>
                        <input value={s.time} onChange={e => updateShift(group.id, s.id, "time", e.target.value)}
                          placeholder="6am-8am"
                          className="min-w-0 rounded-lg border border-ccb-border bg-ccb-canvas px-2.5 py-2 text-[12px] text-ccb-navy placeholder:text-ccb-muted-2 outline-none focus:border-ccb-blue" />
                        <input value={s.valveCameFrom} onChange={e => updateShift(group.id, s.id, "valveCameFrom", e.target.value)}
                          placeholder="e.g. EQUI"
                          className="min-w-0 rounded-lg border border-ccb-border bg-ccb-canvas px-2.5 py-2 text-[12px] text-ccb-navy placeholder:text-ccb-muted-2 outline-none focus:border-ccb-blue" />
                        <input value={s.installedTo} onChange={e => updateShift(group.id, s.id, "installedTo", e.target.value)}
                          placeholder="Installed To"
                          className="min-w-0 rounded-lg border border-ccb-border bg-ccb-canvas px-2.5 py-2 text-[12px] text-ccb-navy placeholder:text-ccb-muted-2 outline-none focus:border-ccb-blue" />
                        <input type="number" min={0} value={s.valvesRepaired}
                          onChange={e => updateShift(group.id, s.id, "valvesRepaired", e.target.value)}
                          placeholder="0"
                          className="min-w-0 rounded-lg border border-ccb-border bg-ccb-canvas px-1.5 py-2 text-[12px] text-ccb-navy outline-none focus:border-ccb-blue text-center" />
                        <input type="number" min={0} value={s.good}
                          onChange={e => updateShift(group.id, s.id, "good", e.target.value)}
                          placeholder="0"
                          className="min-w-0 rounded-lg border border-ccb-border bg-ccb-canvas px-1.5 py-2 text-[12px] text-green-700 font-semibold outline-none focus:border-ccb-blue text-center" />
                        <input type="number" min={0} value={s.reject}
                          onChange={e => updateShift(group.id, s.id, "reject", e.target.value)}
                          placeholder="0"
                          className="min-w-0 rounded-lg border border-ccb-border bg-ccb-canvas px-1.5 py-2 text-[12px] text-ccb-red font-semibold outline-none focus:border-ccb-blue text-center" />
                        <input value={s.remarks} onChange={e => updateShift(group.id, s.id, "remarks", e.target.value)}
                          placeholder="Remarks"
                          className="min-w-0 rounded-lg border border-ccb-border bg-ccb-canvas px-2.5 py-2 text-[12px] text-ccb-navy placeholder:text-ccb-muted-2 outline-none focus:border-ccb-blue" />
                        <button type="button" onClick={() => removeShift(group.id, s.id)}
                          disabled={group.shifts.length === 1}
                          className="flex items-center gap-1 rounded-lg border border-ccb-border bg-white px-2 py-2 text-[11px] font-semibold text-ccb-muted hover:border-ccb-red hover:text-ccb-red hover:bg-red-50 disabled:opacity-30 transition shrink-0 whitespace-nowrap">
                          <X size={11} /> Shift
                        </button>
                      </div>
                    ))}

                    {/* Per-date subtotal */}
                    <div className="flex items-center gap-5 rounded-lg bg-ccb-canvas border border-ccb-border px-4 py-2.5 mt-2">
                      <span className="text-[10.5px] font-bold uppercase tracking-wider text-ccb-muted">Date Total</span>
                      <span className="h-3 w-px bg-ccb-border" />
                      <span className="text-[12.5px] font-bold text-ccb-navy">Repaired: {groupRepaired}</span>
                      <span className="text-[12.5px] font-bold text-green-700">Good: {groupGood}</span>
                      <span className="text-[12.5px] font-bold text-ccb-red">Reject: {groupReject}</span>
                    </div>
                  </div>
                </div>
              );
            })}

            {/* Grand total */}
            <div className="rounded-xl border border-ccb-border bg-[#F0F3FF] px-5 py-3.5 flex items-center gap-6">
              <span className="text-[11.5px] font-bold uppercase tracking-wider text-ccb-navy">Grand Total</span>
              <span className="h-4 w-px bg-ccb-border" />
              <span className="text-[13px] font-bold text-ccb-navy">Repaired: {grandRepaired}</span>
              <span className="text-[13px] font-bold text-green-700">Good: {grandGood}</span>
              <span className="text-[13px] font-bold text-ccb-red">Reject: {grandReject}</span>
              <span className="ml-auto text-[11px] text-ccb-muted">{groups.length} date{groups.length > 1 ? "s" : ""} · {totalShifts} shift{totalShifts > 1 ? "s" : ""}</span>
            </div>
          </div>

          {/* Footer */}
          <div className="flex items-center justify-end gap-2 px-8 py-4 border-t border-ccb-border bg-white shrink-0">
            <button type="button" onClick={onClose} disabled={saving}
              className="rounded-lg border border-ccb-border bg-white px-5 py-2 text-[12.5px] font-semibold text-ccb-navy hover:bg-ccb-canvas disabled:opacity-50 transition">
              Cancel
            </button>
            <button type="submit" disabled={saving}
              className="rounded-lg bg-ccb-blue px-5 py-2 text-[12.5px] font-semibold text-white hover:bg-ccb-navy disabled:opacity-50 transition">
              {saving ? "Saving..." : `Save ${groups.length} Date${groups.length > 1 ? "s" : ""} · ${totalShifts} Shift${totalShifts > 1 ? "s" : ""}`}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div>
      <label className="block text-[11px] font-semibold uppercase tracking-[0.1em] text-ccb-muted mb-1.5">{label}</label>
      {children}
    </div>
  );
}
