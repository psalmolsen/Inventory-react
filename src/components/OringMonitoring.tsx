import React, { useState, useMemo, useEffect, useRef } from "react";
import {
  LineChart, Line, AreaChart, Area, BarChart, Bar,
  PieChart, Pie, Cell, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
} from "recharts";
import "./OringMonitoring.css";

/* ==========================================================================
   O-Ring Monitoring — page content only.
   Assumes your existing app shell already renders the sidebar + topbar
   (same one used by Material Monitoring). Drop this component into your
   route/page body.

   Dependency: recharts  ->  npm install recharts

   WIRING GUIDE
   ------------
   Replace the `data` prop with your real API payload matching the shape of
   MOCK_DATA below. Everything under "PLACEHOLDER MOCK DATA" is safe to
   delete once you're passing real data in. Every filter/search control below
   is wired to local React state with clear TODO markers where you should
   swap in your real fetch/query calls.
   ========================================================================== */

const COLORS = {
  navy: "#1E2A78",
  navyLight: "#3b4cc0",
  navyPale: "#6f7ce0",
  gold: "#F5B400",
  good: "#2E7D32",
  reject: "#D32F2F",
  warning: "#F57C00",
  faint: "#9AA0B1",
  navyTint: "#EEF0FA",
};

const MONTHS = ["Jan","Feb","Mar","Apr","May","Jun","Jul","Aug","Sep","Oct","Nov","Dec"];
const SHIFTS = ["6AM-8AM","8AM-10AM","10AM-12PM","1PM-3PM","3PM-5PM","5PM-7PM","7PM-9PM"];

/* --------------------------------------------------------------------------
   PLACEHOLDER MOCK DATA — shape matches what the component expects.
   Swap this for your real fetch result. Keep the same keys.
   -------------------------------------------------------------------------- */
export const MOCK_DATA = {
  month: "Jul",
  kpis: {
    totalRepaired: 1248, totalRepairedPrevMonth: 1110,
    good: 1214, goodPrevMonth: 1113,
    reject: 34, rejectPrevMonth: 35,
  },
  trend: Array.from({ length: 31 }, (_, i) => ({
    day: i + 1,
    repaired: 28 + Math.round(Math.sin(i / 4) * 6 + i * 1.2),
  })),
  sourceDistribution: [
    { source: "Equi", count: 412 },
    { source: "South Gas", count: 356 },
    { source: "Rapid", count: 298 },
    { source: "Coastal", count: 182 },
  ],
  installerRanking: [
    { name: "Akkel Domingo", repaired: 312, good: 306, reject: 6 },
    { name: "Francis Aldeon", repaired: 288, good: 277, reject: 11 },
    { name: "Balong Cruz", repaired: 241, good: 227, reject: 14 },
    { name: "Marlo Guiao", repaired: 198, good: 180, reject: 18 },
  ],
  shiftPerformance: [
    { shift: "6AM-8AM", repaired: 142 },
    { shift: "8AM-10AM", repaired: 198 },
    { shift: "10AM-12PM", repaired: 176 },
    { shift: "1PM-3PM", repaired: 150 },
    { shift: "3PM-5PM", repaired: 168 },
    { shift: "5PM-7PM", repaired: 134 },
    { shift: "7PM-9PM", repaired: 96 },
  ],
  rejectReasons: [
    { reason: "Leak", count: 12 },
    { reason: "Damaged Groove", count: 8 },
    { reason: "Wrong O-ring Size", count: 6 },
    { reason: "Surface Damage", count: 5 },
    { reason: "Others", count: 3 },
  ],
  monthlySummary: [
    { month: "Jan", repaired: 980 }, { month: "Feb", repaired: 1020 },
    { month: "Mar", repaired: 1110 }, { month: "Apr", repaired: 1050 },
    { month: "May", repaired: 1180 }, { month: "Jun", repaired: 1205 },
    { month: "Jul", repaired: 1248 }, { month: "Aug", repaired: null },
    { month: "Sep", repaired: null }, { month: "Oct", repaired: null },
    { month: "Nov", repaired: null }, { month: "Dec", repaired: null },
  ],
  activityFeed: [
    { time: "09:45 AM", jo: "JO-00123", source: "South Gas", repaired: 6, good: 5, reject: 1, installer: "Akkel Domingo" },
    { time: "10:20 AM", jo: "JO-00124", source: "Rapid", repaired: 8, good: 8, reject: 0, installer: "Francis Aldeon" },
    { time: "11:40 AM", jo: "JO-00125", source: "Equi", repaired: 7, good: 6, reject: 1, installer: "Balong Cruz" },
    { time: "01:15 PM", jo: "JO-00126", source: "Coastal", repaired: 5, good: 5, reject: 0, installer: "Marlo Guiao" },
  ],
  table: {
    rows: [
      { date: "2026-07-04", time: "09:45 AM", jo: "JO-00123", source: "South Gas", repaired: 6, installedTo: "Line A", good: 5, reject: 1, remarks: "Minor leak on unit 3", status: "warn" },
      { date: "2026-07-04", time: "10:20 AM", jo: "JO-00124", source: "Rapid", repaired: 8, installedTo: "Line B", good: 8, reject: 0, remarks: "—", status: "good" },
      { date: "2026-07-04", time: "11:40 AM", jo: "JO-00125", source: "Equi", repaired: 7, installedTo: "Line A", good: 6, reject: 1, remarks: "Groove damage", status: "warn" },
      { date: "2026-07-04", time: "01:15 PM", jo: "JO-00126", source: "Coastal", repaired: 5, installedTo: "Line C", good: 5, reject: 0, remarks: "—", status: "good" },
      { date: "2026-07-03", time: "02:30 PM", jo: "JO-00122", source: "Equi", repaired: 9, installedTo: "Line B", good: 8, reject: 1, remarks: "Wrong size ordered", status: "warn" },
      { date: "2026-07-03", time: "03:50 PM", jo: "JO-00121", source: "South Gas", repaired: 6, installedTo: "Line A", good: 6, reject: 0, remarks: "—", status: "good" },
      { date: "2026-07-03", time: "04:40 PM", jo: "JO-00120", source: "Rapid", repaired: 4, installedTo: "Line C", good: 3, reject: 1, remarks: "Surface scratch", status: "reject" },
      { date: "2026-07-03", time: "05:15 PM", jo: "JO-00119", source: "Coastal", repaired: 7, installedTo: "Line B", good: 7, reject: 0, remarks: "—", status: "good" },
    ],
    totalRows: 142,
  },
};

/* --------------------------------------------------------------------------
   Small helpers
   -------------------------------------------------------------------------- */

// Count-up animation for KPI numbers. Respects prefers-reduced-motion.
function useCountUp(value: number, duration = 700) {
  const [display, setDisplay] = useState(0);
  const raf = useRef<number | null>(null);

  useEffect(() => {
    const reduceMotion = window.matchMedia?.("(prefers-reduced-motion: reduce)").matches;
    if (reduceMotion) { setDisplay(value); return; }

    const start = performance.now();
    const from = 0;
    const to = value;

    function tick(now: number) {
      const progress = Math.min((now - start) / duration, 1);
      const eased = 1 - Math.pow(1 - progress, 3); // ease-out cubic
      setDisplay(Math.round(from + (to - from) * eased));
      if (progress < 1) raf.current = requestAnimationFrame(tick);
    }
    raf.current = requestAnimationFrame(tick);
    return () => { if (raf.current) cancelAnimationFrame(raf.current); };
  }, [value, duration]);

  return display;
}

function pctChange(current: number, previous: number) {
  if (!previous) return 0;
  return ((current - previous) / previous) * 100;
}

function TrendBadge({ pct }: { pct: number }) {
  const up = pct >= 0;
  return (
    <div className="orm-kpi-foot">
      <span className={up ? "orm-trend-up" : "orm-trend-down"}>
        {up ? "▲" : "▼"} {Math.abs(pct).toFixed(1)}%
      </span>
      <span className="orm-vs">vs last month</span>
    </div>
  );
}

function initials(name: string) {
  return name.split(" ").map(w => w[0]).slice(0, 2).join("").toUpperCase();
}

function avatarGradient(index: number) {
  const gradients = [
    "linear-gradient(135deg,#F5B400,#c98f00)",
    "linear-gradient(135deg,#1E2A78,#3b4cc0)",
    "linear-gradient(135deg,#2E7D32,#4c9e50)",
    "linear-gradient(135deg,#6B7080,#8c92a3)",
  ];
  return gradients[index % gradients.length];
}

/* Small icon set (inline SVG, no icon library dependency) */
const Icon: Record<string, React.FC<React.SVGProps<SVGSVGElement>>> = {
  Search: (p) => <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" {...p}><circle cx="11" cy="11" r="7"/><line x1="21" y1="21" x2="16.65" y2="16.65"/></svg>,
  Source: (p) => <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" {...p}><path d="M3 3h18v3l-7 7v6l-4 2v-8L3 6z"/></svg>,
  User: (p) => <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" {...p}><circle cx="12" cy="8" r="4"/><path d="M4 21v-1a7 7 0 0 1 14 0v1"/></svg>,
  Calendar: (p) => <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" {...p}><rect x="3" y="4" width="18" height="18" rx="2"/><line x1="16" y1="2" x2="16" y2="6"/><line x1="8" y1="2" x2="8" y2="6"/><line x1="3" y1="10" x2="21" y2="10"/></svg>,
  Clock: (p) => <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" {...p}><circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/></svg>,
  Check2: (p) => <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" {...p}><path d="M22 11.08V12a10 10 0 1 1-5.93-9.14"/><polyline points="22 4 12 14.01 9 11.01"/></svg>,
  Reject: (p) => <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" {...p}><circle cx="12" cy="12" r="10"/><line x1="15" y1="9" x2="9" y2="15"/><line x1="9" y1="9" x2="15" y2="15"/></svg>,
  Wrench: (p) => <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" {...p}><path d="M14.7 6.3a1 1 0 0 0 0 1.4l1.6 1.6a1 1 0 0 0 1.4 0l3.77-3.77a6 6 0 0 1-7.94 7.94l-6.91 6.91a2.12 2.12 0 0 1-3-3l6.91-6.91a6 6 0 0 1 7.94-7.94l-3.76 3.76z"/></svg>,
  Target: (p) => <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" {...p}><path d="M12 2v4M12 18v4M4.9 4.9l2.8 2.8M16.3 16.3l2.8 2.8M2 12h4M18 12h4M4.9 19.1l2.8-2.8M16.3 7.7l2.8-2.8"/></svg>,
  Filter: (p) => <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" {...p}><polygon points="22 3 2 3 10 12.46 10 19 14 21 14 12.46 22 3"/></svg>,
  Warn: (p) => <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" {...p}><path d="M12 9v4M12 17h.01M10.29 3.86 1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z"/></svg>,
  Eye: (p) => <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" {...p}><path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"/><circle cx="12" cy="12" r="3"/></svg>,
  Edit: (p) => <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" {...p}><path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/><path d="M18.5 2.5a2.12 2.12 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"/></svg>,
};

/* --------------------------------------------------------------------------
   Main component
   -------------------------------------------------------------------------- */
export default function OringMonitoring({ data = MOCK_DATA }) {
  const [selectedMonth, setSelectedMonth] = useState(data.month || "All");

  // Search / filter state — TODO: wire these into your real data fetch
  // (e.g. refetch on change, or filter client-side like the table below does).
  const [filters, setFilters] = useState({
    jo: "", source: "", installer: "", dateFrom: "", shift: "All Shifts", status: "All Status",
  });
  const [page, setPage] = useState(1);
  const pageSize = 8;

  const { kpis, trend, sourceDistribution, installerRanking, shiftPerformance, rejectReasons, monthlySummary, activityFeed, table } = data;

  // ---- KPI derived values ----
  const qualityEfficiencyPct = useMemo(() => {
    const total = kpis.good + kpis.reject;
    return total ? (kpis.good / total) * 100 : 0;
  }, [kpis]);

  const totalDisplay = useCountUp(kpis.totalRepaired);
  const goodDisplay = useCountUp(kpis.good);
  const rejectDisplay = useCountUp(kpis.reject);

  const totalPct = pctChange(kpis.totalRepaired, kpis.totalRepairedPrevMonth);
  const goodPct = pctChange(kpis.good, kpis.goodPrevMonth);
  const rejectPct = pctChange(kpis.reject, kpis.rejectPrevMonth);

  // ---- ring progress math (r=24, circumference = 2*pi*24 = 150.8) ----
  const ringCircumference = 150.8;
  const ringOffset = ringCircumference * (1 - qualityEfficiencyPct / 100);

  // ---- installer ranking sorted by efficiency ----
  const rankedInstallers = useMemo(() => {
    return [...installerRanking]
      .map(i => ({ ...i, efficiencyPct: i.repaired ? (i.good / i.repaired) * 100 : 0 }))
      .sort((a, b) => b.efficiencyPct - a.efficiencyPct)
      .slice(0, 5);
  }, [installerRanking]);
  const maxEfficiency = rankedInstallers[0]?.efficiencyPct || 100;

  // ---- top valve source ----
  const sortedSources = useMemo(
    () => [...sourceDistribution].sort((a, b) => b.count - a.count),
    [sourceDistribution]
  );

  // ---- peak shift ----
  const peakShift = useMemo(
    () => shiftPerformance.reduce((a, b) => (b.repaired > a.repaired ? b : a), shiftPerformance[0]),
    [shiftPerformance]
  );

  // ---- table filtering (client-side demo — swap for server-side query) ----
  const filteredRows = useMemo(() => {
    return table.rows.filter(r => {
      if (filters.jo && !r.jo.toLowerCase().includes(filters.jo.toLowerCase())) return false;
      if (filters.source && !r.source.toLowerCase().includes(filters.source.toLowerCase())) return false;
      if (filters.status !== "All Status") {
        const map: Record<string, string> = { "Completed": "good", "Has Reject": "warn", "Pending Review": "reject" };
        if (r.status !== map[filters.status]) return false;
      }
      return true;
    });
  }, [table.rows, filters]);

  const totalPages = Math.max(1, Math.ceil(filteredRows.length / pageSize));
  const pagedRows = filteredRows.slice((page - 1) * pageSize, page * pageSize);

  const statusLabel: Record<string, string> = { good: "Completed", warn: "Has Reject", reject: "Needs Review" };

  return (
    <div className="orm-page">

      {/* ============ MONTH NAV ============ */}
      <div className="orm-month-nav">
        {MONTHS.map(m => (
          <button
            key={m}
            className={`orm-month-pill ${selectedMonth === m ? "active" : ""}`}
            onClick={() => setSelectedMonth(m)} // TODO: refetch data for selected month
          >
            {m}
          </button>
        ))}
        <button
          className={`orm-month-pill all ${selectedMonth === "All" ? "active" : ""}`}
          onClick={() => setSelectedMonth("All")}
        >
          All
        </button>
      </div>

      {/* ============ KPI ROW ============ */}
      <div className="orm-kpi-row">
        <div className="orm-kpi-card">
          <div className="orm-kpi-top">
            <div className="orm-kpi-label">Total Valves Repaired</div>
            <div className="orm-kpi-icon navy"><Icon.Wrench /></div>
          </div>
          <div className="orm-kpi-value orm-num">{totalDisplay.toLocaleString()}</div>
          <TrendBadge pct={totalPct} />
        </div>

        <div className="orm-kpi-card">
          <div className="orm-kpi-top">
            <div className="orm-kpi-label">Good O-rings Installed</div>
            <div className="orm-kpi-icon good"><Icon.Check2 /></div>
          </div>
          <div className="orm-kpi-value orm-num" style={{ color: COLORS.good }}>{goodDisplay.toLocaleString()}</div>
          <TrendBadge pct={goodPct} />
        </div>

        <div className="orm-kpi-card">
          <div className="orm-kpi-top">
            <div className="orm-kpi-label">Rejected O-rings</div>
            <div className="orm-kpi-icon reject"><Icon.Reject /></div>
          </div>
          <div className="orm-kpi-value orm-num" style={{ color: COLORS.reject }}>{rejectDisplay.toLocaleString()}</div>
          <TrendBadge pct={rejectPct} />
        </div>

        <div className="orm-kpi-card">
          <div className="orm-kpi-top">
            <div className="orm-kpi-label">Quality Efficiency</div>
            <div className="orm-kpi-icon gold"><Icon.Target /></div>
          </div>
          <div className="orm-ring-wrap">
            <svg width="58" height="58" viewBox="0 0 58 58">
              <circle cx="29" cy="29" r="24" fill="none" stroke={COLORS.navyTint} strokeWidth="7" />
              <circle
                cx="29" cy="29" r="24" fill="none" stroke={COLORS.good} strokeWidth="7"
                strokeLinecap="round" strokeDasharray={ringCircumference} strokeDashoffset={ringOffset}
                transform="rotate(-90 29 29)"
              />
            </svg>
            <div>
              <div className="orm-ring-num">{qualityEfficiencyPct.toFixed(1)}%</div>
              <div className="orm-ring-cap">Pass rate this month</div>
            </div>
          </div>
        </div>
      </div>

      {/* ============ ROW 1: Production Trend + Good vs Reject ============ */}
      <div className="orm-grid-2">
        <div className="orm-panel">
          <div className="orm-panel-head">
            <div>
              <div className="orm-panel-title">Production Trend</div>
              <div className="orm-panel-sub">Valves repaired per day — {selectedMonth} 2026</div>
            </div>
            <div className="orm-panel-tag orm-tag-navy">▲ Trending up</div>
          </div>
          <ResponsiveContainer width="100%" height={220}>
            <LineChart data={trend}>
              <defs>
                <linearGradient id="trendFill" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor={COLORS.navy} stopOpacity={0.18} />
                  <stop offset="100%" stopColor={COLORS.navy} stopOpacity={0} />
                </linearGradient>
              </defs>
              <CartesianGrid vertical={false} stroke={COLORS.navyTint} />
              <XAxis dataKey="day" tick={{ fontSize: 11, fill: "#6B7080" }} axisLine={false} tickLine={false} />
              <YAxis tick={{ fontSize: 11, fill: "#6B7080" }} axisLine={false} tickLine={false} />
              <Tooltip contentStyle={{ background: COLORS.navy, border: "none", borderRadius: 8, color: "#fff" }} labelStyle={{ color: "#fff" }} />
              <Area type="monotone" dataKey="repaired" stroke="none" fill="url(#trendFill)" />
              <Line type="monotone" dataKey="repaired" stroke={COLORS.navy} strokeWidth={2.5} dot={false} activeDot={{ r: 5, fill: COLORS.navy, stroke: "#fff", strokeWidth: 2 }} />
            </LineChart>
          </ResponsiveContainer>
        </div>

        <div className="orm-panel">
          <div className="orm-panel-head">
            <div>
              <div className="orm-panel-title">Good vs Reject</div>
              <div className="orm-panel-sub">Overall quality split</div>
            </div>
          </div>
          <div className="orm-donut-wrap">
            <ResponsiveContainer width="100%" height={210}>
              <PieChart>
                <Pie
                  data={[{ name: "Good", value: kpis.good }, { name: "Reject", value: kpis.reject }]}
                  dataKey="value" innerRadius="74%" outerRadius="100%" startAngle={90} endAngle={-270}
                >
                  <Cell fill={COLORS.good} />
                  <Cell fill={COLORS.reject} />
                </Pie>
                <Tooltip contentStyle={{ background: COLORS.navy, border: "none", borderRadius: 8, color: "#fff" }} />
              </PieChart>
            </ResponsiveContainer>
            <div className="orm-donut-center">
              <div className="orm-pct">{qualityEfficiencyPct.toFixed(1)}%</div>
              <div className="orm-cap">Good rate</div>
            </div>
          </div>
          <div className="orm-legend-row" style={{ justifyContent: "center", marginTop: 10 }}>
            <div className="orm-legend-item"><span className="orm-legend-dot" style={{ background: COLORS.good }} />Good — {kpis.good}</div>
            <div className="orm-legend-item"><span className="orm-legend-dot" style={{ background: COLORS.reject }} />Reject — {kpis.reject}</div>
          </div>
        </div>
      </div>

      {/* ============ ROW 2: Valve Source + Installer Performance ============ */}
      <div className="orm-grid-2">
        <div className="orm-panel">
          <div className="orm-panel-head">
            <div>
              <div className="orm-panel-title">Valve Source Distribution</div>
              <div className="orm-panel-sub">Repairs received by department</div>
            </div>
          </div>
          <ResponsiveContainer width="100%" height={220}>
            <BarChart data={sortedSources} layout="vertical" margin={{ left: 10 }}>
              <CartesianGrid horizontal={false} stroke={COLORS.navyTint} />
              <XAxis type="number" tick={{ fontSize: 11, fill: "#6B7080" }} axisLine={false} tickLine={false} />
              <YAxis type="category" dataKey="source" width={80} tick={{ fontSize: 12, fill: "#2A2E3A" }} axisLine={false} tickLine={false} />
              <Tooltip contentStyle={{ background: COLORS.navy, border: "none", borderRadius: 8, color: "#fff" }} cursor={{ fill: COLORS.navyTint }} />
              <Bar dataKey="count" radius={[0, 8, 8, 0]} barSize={22}>
                {sortedSources.map((_, i) => (
                  <Cell key={i} fill={[COLORS.navy, COLORS.navyLight, COLORS.navyPale, COLORS.gold][i % 4]} />
                ))}
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        </div>

        <div className="orm-panel">
          <div className="orm-panel-head">
            <div>
              <div className="orm-panel-title">Installer Performance</div>
              <div className="orm-panel-sub">Ranked by efficiency this month</div>
            </div>
            <div className="orm-panel-tag orm-tag-gold">Top: {rankedInstallers[0]?.name.split(" ")[0]}</div>
          </div>
          {rankedInstallers.map((inst, i) => (
            <div className="orm-rank-row" key={inst.name}>
              <div className={`orm-rank-num ${i === 0 ? "top" : ""}`}>#{i + 1}</div>
              <div className="orm-rank-avatar" style={{ background: avatarGradient(i) }}>{initials(inst.name)}</div>
              <div className="orm-rank-info">
                <div className="orm-rank-name">{inst.name}</div>
                <div className="orm-rank-bar-track">
                  <div className="orm-rank-bar-fill" style={{ width: `${(inst.efficiencyPct / maxEfficiency) * 100}%` }} />
                </div>
                <div className="orm-rank-meta">{inst.repaired} repaired · {inst.good} good · {inst.reject} reject</div>
              </div>
              <div className="orm-rank-pct">{inst.efficiencyPct.toFixed(0)}%</div>
            </div>
          ))}
        </div>
      </div>

      {/* ============ ROW 3: Shift Performance + Reject Reasons ============ */}
      <div className="orm-grid-2">
        <div className="orm-panel">
          <div className="orm-panel-head">
            <div>
              <div className="orm-panel-title">Shift Performance</div>
              <div className="orm-panel-sub">Repaired valves by shift window</div>
            </div>
            <div className="orm-panel-tag orm-tag-navy">Peak: {peakShift?.shift}</div>
          </div>
          <ResponsiveContainer width="100%" height={220}>
            <BarChart data={shiftPerformance}>
              <CartesianGrid vertical={false} stroke={COLORS.navyTint} />
              <XAxis dataKey="shift" tick={{ fontSize: 10, fill: "#6B7080" }} axisLine={false} tickLine={false} />
              <YAxis tick={{ fontSize: 11, fill: "#6B7080" }} axisLine={false} tickLine={false} />
              <Tooltip contentStyle={{ background: COLORS.navy, border: "none", borderRadius: 8, color: "#fff" }} cursor={{ fill: COLORS.navyTint }} />
              <Bar dataKey="repaired" fill={COLORS.navy} radius={[8, 8, 0, 0]} maxBarSize={38} />
            </BarChart>
          </ResponsiveContainer>
        </div>

        <div className="orm-panel">
          <div className="orm-panel-head">
            <div>
              <div className="orm-panel-title">Reject Reasons</div>
              <div className="orm-panel-sub">Breakdown of quality failures</div>
            </div>
          </div>
          <div style={{ display: "flex", alignItems: "center", gap: 18 }}>
            <ResponsiveContainer width={170} height={170}>
              <PieChart>
                <Pie data={rejectReasons} dataKey="count" nameKey="reason" outerRadius="90%">
                  {rejectReasons.map((_, i) => (
                    <Cell key={i} fill={[COLORS.reject, COLORS.warning, COLORS.navy, COLORS.gold, COLORS.faint][i % 5]} stroke="#fff" strokeWidth={2} />
                  ))}
                </Pie>
                <Tooltip contentStyle={{ background: COLORS.navy, border: "none", borderRadius: 8, color: "#fff" }} />
              </PieChart>
            </ResponsiveContainer>
            <div style={{ flex: 1, display: "flex", flexDirection: "column", gap: 9 }}>
              {rejectReasons.map((r, i) => (
                <div className="orm-legend-item" style={{ justifyContent: "space-between" }} key={r.reason}>
                  <span><span className="orm-legend-dot" style={{ background: [COLORS.reject, COLORS.warning, COLORS.navy, COLORS.gold, COLORS.faint][i % 5] }} />{r.reason}</span>
                  <b className="orm-mono">{r.count}</b>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>

      {/* ============ Monthly Production Summary ============ */}
      <div className="orm-panel" style={{ marginBottom: 18 }}>
        <div className="orm-panel-head">
          <div>
            <div className="orm-panel-title">Monthly Production Summary</div>
            <div className="orm-panel-sub">Total valves repaired per month — Jan to Dec 2026</div>
          </div>
          <div className="orm-panel-tag orm-tag-good">YTD +18.6%</div>
        </div>
        <ResponsiveContainer width="100%" height={160}>
          <AreaChart data={monthlySummary}>
            <defs>
              <linearGradient id="monthlyFill" x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%" stopColor={COLORS.gold} stopOpacity={0.28} />
                <stop offset="100%" stopColor={COLORS.gold} stopOpacity={0} />
              </linearGradient>
            </defs>
            <CartesianGrid vertical={false} stroke={COLORS.navyTint} />
            <XAxis dataKey="month" tick={{ fontSize: 11, fill: "#6B7080" }} axisLine={false} tickLine={false} />
            <YAxis tick={{ fontSize: 11, fill: "#6B7080" }} axisLine={false} tickLine={false} domain={["auto", "auto"]} />
            <Tooltip contentStyle={{ background: COLORS.navy, border: "none", borderRadius: 8, color: "#fff" }} />
            <Area type="monotone" dataKey="repaired" stroke={COLORS.gold} strokeWidth={3} fill="url(#monthlyFill)"
              dot={{ r: 4, fill: "#fff", stroke: COLORS.gold, strokeWidth: 2 }} connectNulls={false} />
          </AreaChart>
        </ResponsiveContainer>
      </div>

      {/* ============ Activity Feed ============ */}
      <div className="orm-section-title">Recent Activity<div className="orm-line" /></div>
      <div className="orm-panel" style={{ marginBottom: 18 }}>
        <div className="orm-feed">
          {activityFeed.map((item, i) => (
            <div className="orm-feed-item" key={i}>
              <div className="orm-feed-time">{item.time}</div>
              <div className={`orm-feed-dot ${item.reject > 0 ? "warn" : "good"}`}>
                {item.reject > 0 ? <Icon.Warn /> : <Icon.Check2 />}
              </div>
              <div className="orm-feed-body">
                <div className="orm-feed-main">
                  <div className="orm-jo">{item.jo} — {item.source}</div>
                  <div className="orm-meta">{item.repaired} valves repaired · Installer: {item.installer}</div>
                </div>
                <div className="orm-feed-stats">
                  <div className="orm-feed-stat"><div className="orm-n" style={{ color: COLORS.good }}>{item.good}</div><div className="orm-l">Good</div></div>
                  <div className="orm-feed-stat"><div className="orm-n" style={{ color: COLORS.reject }}>{item.reject}</div><div className="orm-l">Reject</div></div>
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* ============ Search / Filter bar ============ */}
      <div className="orm-section-title">Job Order Records<div className="orm-line" /></div>
      <div className="orm-search-bar">
        <div className="orm-field grow">
          <Icon.Search />
          <input
            placeholder="Search job order..."
            value={filters.jo}
            onChange={e => { setFilters(f => ({ ...f, jo: e.target.value })); setPage(1); }}
          />
        </div>
        <div className="orm-field">
          <Icon.Source />
          <input
            placeholder="Valve source"
            value={filters.source}
            onChange={e => { setFilters(f => ({ ...f, source: e.target.value })); setPage(1); }}
          />
        </div>
        <div className="orm-field">
          <Icon.User />
          <input
            placeholder="Installer"
            value={filters.installer}
            onChange={e => setFilters(f => ({ ...f, installer: e.target.value }))}
          />
        </div>
        <div className="orm-field">
          <Icon.Calendar />
          <input
            type="date"
            value={filters.dateFrom}
            onChange={e => setFilters(f => ({ ...f, dateFrom: e.target.value }))}
          />
        </div>
        <div className="orm-field">
          <Icon.Clock />
          <select value={filters.shift} onChange={e => setFilters(f => ({ ...f, shift: e.target.value }))}>
            <option>All Shifts</option>
            {SHIFTS.map(s => <option key={s}>{s}</option>)}
          </select>
        </div>
        <div className="orm-field">
          <Icon.Check2 />
          <select
            value={filters.status}
            onChange={e => { setFilters(f => ({ ...f, status: e.target.value })); setPage(1); }}
          >
            <option>All Status</option>
            <option>Completed</option>
            <option>Has Reject</option>
            <option>Pending Review</option>
          </select>
        </div>
        <button className="orm-btn-filter"><Icon.Filter />Apply Filters</button>
      </div>

      {/* ============ Table ============ */}
      <div className="orm-table-wrap">
        <div className="orm-table-scroll">
          <table className="orm-table">
            <thead>
              <tr>
                <th>Date</th><th>Time</th><th>JO Number</th><th>Valve Source</th><th>Repaired</th>
                <th>Installed To</th><th>Good</th><th>Reject</th><th>Remarks</th><th>Status</th><th>Actions</th>
              </tr>
            </thead>
            <tbody>
              {pagedRows.map((r, i) => (
                <tr key={i}>
                  <td>{r.date}</td>
                  <td>{r.time}</td>
                  <td><b>{r.jo}</b></td>
                  <td>{r.source}</td>
                  <td>{r.repaired}</td>
                  <td>{r.installedTo}</td>
                  <td className="orm-cell-good">{r.good}</td>
                  <td className="orm-cell-reject">{r.reject}</td>
                  <td>{r.remarks}</td>
                  <td><span className={`orm-pill ${r.status}`}>{statusLabel[r.status]}</span></td>
                  <td>
                    <div className="orm-row-actions">
                      <button title="View"><Icon.Eye /></button>
                      <button title="Edit"><Icon.Edit /></button>
                    </div>
                  </td>
                </tr>
              ))}
              {pagedRows.length === 0 && (
                <tr><td colSpan={11} style={{ textAlign: "center", padding: 28, color: COLORS.faint }}>No job orders match your filters.</td></tr>
              )}
            </tbody>
          </table>
        </div>
        <div className="orm-table-foot">
          <div className="orm-info">
            Showing {filteredRows.length === 0 ? 0 : (page - 1) * pageSize + 1}–{Math.min(page * pageSize, filteredRows.length)} of {filteredRows.length} job orders
          </div>
          <div className="orm-pager">
            <button disabled={page === 1} onClick={() => setPage(p => Math.max(1, p - 1))}>‹</button>
            {Array.from({ length: totalPages }, (_, i) => i + 1)
              .slice(0, 5)
              .map(p => (
                <button key={p} className={p === page ? "active" : ""} onClick={() => setPage(p)}>{p}</button>
              ))}
            <button disabled={page === totalPages} onClick={() => setPage(p => Math.min(totalPages, p + 1))}>›</button>
          </div>
        </div>
      </div>

    </div>
  );
}
