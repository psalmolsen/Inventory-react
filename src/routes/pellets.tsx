import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useMemo, useRef, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import {
  PieChart,
  Pie,
  Cell,
  ResponsiveContainer,
  LineChart,
  Line,
  XAxis,
  YAxis,
  Tooltip,
  CartesianGrid,
  BarChart,
  Bar,
} from "recharts";
import {
  Box,
  Fuel,
  Circle as CircleIcon,
  Package2,
  BarChart3,
  Download,
  Search,
  ChevronDown,
  MoreVertical,
  Plus,
} from "lucide-react";
import { Sidebar } from "../components/Sidebar";
import { getPelletsDataFn, getPelletsTabsFn } from "../lib/pellets-server-functions";
import type { PelletRecord } from "../lib/pellets-sheets";

export const Route = createFileRoute("/pellets")({
  component: PelletsDashboard,
});

const NAV = [
  { label: "Material Monitoring", icon: Box },
  { label: "CNF Monitoring", icon: Fuel },
  { label: "O-Ring Monitoring", icon: CircleIcon },
  { label: "Pellets L-Sales", icon: Package2, active: true },
  { label: "Station Consumption", icon: BarChart3 },
];

const COLORS = {
  navy: "#1E2A78",
  navySoft: "#EEF1FB",
  gold: "#F5B400",
  good: "#2E7D32",
  reject: "#D32F2F",
  warning: "#F57C00",
  faint: "#9AA0B1",
  border: "#E4E7F2",
};

function monthName(monthKey: string) {
  if (!monthKey) return "";
  const [year, month] = monthKey.split("-");
  const names = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
  return `${names[Number(month) - 1] || month} ${year}`;
}

function statusLabel(status: PelletRecord["status"]) {
  return status === "ok" ? "On Target" : status === "warn" ? "Watch" : "Critical";
}

function initials(text: string) {
  const words = text.trim().split(/\s+/).filter(Boolean);
  if (!words.length) return "--";
  return words.slice(0, 2).map((word) => word[0]).join("").toUpperCase();
}

function toOrdinal(n: number | string): string {
  const num = typeof n === "string" ? parseInt(n, 10) : n;
  if (isNaN(num)) return String(n);
  const s = ["th", "st", "nd", "rd"];
  const v = num % 100;
  return num + (s[(v - 20) % 10] || s[v] || s[0]);
}

function groupSum(records: PelletRecord[], getter: (record: PelletRecord) => string) {
  const map = new Map<string, { label: string; good: number; reject: number; shots: number; count: number }>();
  for (const record of records) {
    const label = getter(record).trim();
    if (!label) continue;
    const current = map.get(label) || { label, good: 0, reject: 0, shots: 0, count: 0 };
    current.good += record.good;
    current.reject += record.reject;
    current.shots += record.shots;
    current.count += 1;
    map.set(label, current);
  }
  return Array.from(map.values()).sort((a, b) => b.shots - a.shots);
}

function timeBucket(time: string) {
  const text = time.trim();
  if (!text) return "Unspecified";
  return text.replace(/\s+/g, " ").replace(/\s*-\s*/g, " - ").trim();
}

function inferMonthOptions(records: PelletRecord[]) {
  const seen = new Map<string, string>();
  for (const record of records) {
    if (record.monthKey && !seen.has(record.monthKey)) {
      seen.set(record.monthKey, monthName(record.monthKey));
    }
  }
  return Array.from(seen.entries()).sort(([a], [b]) => a.localeCompare(b)).map(([key, label]) => ({ key, label }));
}

// ─── KPI Card (same style as Material Monitoring) ───────────────────────────
function CnfKpi({ label, value, unit, variant }: {
  label: string; value: string; unit?: string;
  variant: "blue" | "blue2" | "blue3" | "navy" | "gold";
}) {
  const styles = {
    blue:   "bg-[#2E3EA8] text-white",
    blue3:  "bg-[#273690] text-white",
    blue2:  "bg-[#202D78] text-white",
    navy:   "bg-[#1A2560] text-white",
    gold:   "bg-gradient-to-br from-[#C8861A] to-[#E9B52D] text-white",
  }[variant];
  const labelColor = (variant === "gold") ? "text-white/70" : "text-white/70";
  const unitColor  = (variant === "gold") ? "text-white/80" : "text-white/80";

  return (
    <div className={`relative overflow-hidden rounded-2xl p-5 shadow-sm ${styles}`}>
      <div className={`text-[10px] font-semibold uppercase tracking-[0.16em] ${labelColor}`}>{label}</div>
      <div className="mt-3 flex items-baseline gap-2">
        <div className="text-[30px] font-extrabold leading-none">{value}</div>
        {unit && <div className={`text-[12px] font-semibold uppercase tracking-widest ${unitColor}`}>{unit}</div>}
      </div>
      <div className="pointer-events-none absolute -right-6 -bottom-6 h-24 w-24 rounded-full bg-white/5" />
    </div>
  );
}

function StatusDot({ status }: { status: PelletRecord["status"] }) {
  const map: Record<PelletRecord["status"], string> = {
    ok: "bg-success",
    warn: "bg-warning",
    danger: "bg-destructive",
  };
  return (
    <span className="inline-flex items-center gap-2 text-xs font-medium text-foreground/80">
      <span className={`h-2.5 w-2.5 rounded-full ${map[status]}`} />
      {statusLabel(status)}
    </span>
  );
}

function Panel({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="rounded-xl bg-card p-5 shadow-sm ring-1 ring-border">
      <div className="mb-4 flex items-center gap-2">
        <div className="h-5 w-1 rounded-full bg-destructive" />
        <h3 className="text-sm font-bold uppercase tracking-wider text-primary">{title}</h3>
      </div>
      {children}
    </div>
  );
}

function PelletsDashboard() {
  const { data: tabs = [] } = useQuery({
    queryKey: ["pellets-tabs"],
    queryFn: () => getPelletsTabsFn(),
  });

  const { data: records = [], isLoading, error } = useQuery({
    queryKey: ["pellets-data", "All"],
    queryFn: () => getPelletsDataFn({ data: "All" }),
    staleTime: 1000 * 60 * 2,
    refetchOnWindowFocus: false,
  });

  const [month, setMonth] = useState("All");
  const [search, setSearch] = useState("");
  const [status, setStatus] = useState("All");
  const [trendView, setTrendView] = useState<"byDay" | "bySack" | "byShift">("byDay");
  const [tableFilter, setTableFilter] = useState<string>("All");
  const [tableView, setTableView] = useState<"month" | "sack">("month");
  const [visibleCount, setVisibleCount] = useState(50);
  const scrollRef = useRef<HTMLDivElement>(null);

  const monthOptions = useMemo(() => inferMonthOptions(records), [records]);
  const focusRecords = useMemo(() => {
    const monthFiltered = month === "All" ? records : records.filter((record) => record.monthKey === month);
    const searchLower = search.trim().toLowerCase();
    return monthFiltered.filter((record) => {
      if (status !== "All" && record.status !== status.toLowerCase()) return false;
      if (!searchLower) return true;
      const blob = [
        record.date,
        record.time,
        record.shift,
        record.interval,
        record.brand,
        record.sack,
        record.remarks,
      ]
        .join(" ")
        .toLowerCase();
      return blob.includes(searchLower);
    });
  }, [month, records, search, status]);

  useEffect(() => {
    if (month === "All" && monthOptions.length > 0) {
      const last = monthOptions[monthOptions.length - 1];
      setMonth(last.key);
    }
  }, [month, monthOptions]);

  const totalGood = useMemo(() => focusRecords.reduce((sum, record) => sum + record.good, 0), [focusRecords]);
  const totalReject = useMemo(() => focusRecords.reduce((sum, record) => sum + record.reject, 0), [focusRecords]);
  const totalShots = useMemo(() => focusRecords.reduce((sum, record) => sum + record.shots, 0), [focusRecords]);
  const passRate = totalShots ? (totalGood / totalShots) * 100 : 0;

  const brandData = useMemo(() => groupSum(focusRecords, (record) => record.brand || record.shift || "Unknown"), [focusRecords]);
  const shiftData = useMemo(() => groupSum(focusRecords, (record) => record.shift || timeBucket(record.time)), [focusRecords]);
  const trendData = useMemo(() => {
    if (trendView === "byDay") {
      const map = new Map<string, { day: string; shots: number }>();
      for (const record of focusRecords) {
        const current = map.get(record.dateKey) || { day: record.dateKey, shots: 0 };
        current.shots += record.shots;
        map.set(record.dateKey, current);
      }
      return Array.from(map.entries())
        .sort(([a], [b]) => a.localeCompare(b))
        .map(([, value]) => ({
          day: value.day.slice(5),
          shots: value.shots,
        }));
    } else if (trendView === "bySack") {
      const map = new Map<string, { sack: string; shots: number }>();
      for (const record of focusRecords) {
        const sack = record.sack || "Unknown";
        const current = map.get(sack) || { sack, shots: 0 };
        current.shots += record.shots;
        map.set(sack, current);
      }
      return Array.from(map.entries())
        .sort(([, a], [, b]) => b.shots - a.shots)
        .map(([key, value]) => ({
          day: key,
          shots: value.shots,
        }));
    } else if (trendView === "byShift") {
      const map = new Map<string, { shift: string; shots: number }>();
      for (const record of focusRecords) {
        const shift = record.shift || timeBucket(record.time);
        const current = map.get(shift) || { shift, shots: 0 };
        current.shots += record.shots;
        map.set(shift, current);
      }
      return Array.from(map.entries())
        .sort(([, a], [, b]) => b.shots - a.shots)
        .map(([key, value]) => ({
          day: key,
          shots: value.shots,
        }));
    }
    return [];
  }, [focusRecords, trendView]);

  const pieData = useMemo(() => {
    let filteredRecords = focusRecords;
    
    if (trendView === "bySack") {
      // Group by sack and show donut for top sack
      const sackMap = new Map<string, typeof focusRecords>();
      for (const record of focusRecords) {
        const sack = record.sack || "Unknown";
        const existing = sackMap.get(sack) || [];
        existing.push(record);
        sackMap.set(sack, existing);
      }
      const topSack = Array.from(sackMap.entries()).sort((a, b) => {
        const aShots = a[1].reduce((sum, r) => sum + r.shots, 0);
        const bShots = b[1].reduce((sum, r) => sum + r.shots, 0);
        return bShots - aShots;
      })[0];
      if (topSack) {
        filteredRecords = topSack[1];
      }
    } else if (trendView === "byShift") {
      // Group by shift and show donut for top shift
      const shiftMap = new Map<string, typeof focusRecords>();
      for (const record of focusRecords) {
        const shift = record.shift || timeBucket(record.time);
        const existing = shiftMap.get(shift) || [];
        existing.push(record);
        shiftMap.set(shift, existing);
      }
      const topShift = Array.from(shiftMap.entries()).sort((a, b) => {
        const aShots = a[1].reduce((sum, r) => sum + r.shots, 0);
        const bShots = b[1].reduce((sum, r) => sum + r.shots, 0);
        return bShots - aShots;
      })[0];
      if (topShift) {
        filteredRecords = topShift[1];
      }
    }
    // For byDay, use all records
    
    const good = filteredRecords.reduce((sum, record) => sum + record.good, 0);
    const reject = filteredRecords.reduce((sum, record) => sum + record.reject, 0);
    return [
      { name: "Good", value: good },
      { name: "Reject", value: reject },
    ];
  }, [focusRecords, trendView]);

  const maxBrand = Math.max(...brandData.map((item) => item.shots), 1);
  const maxTrend = Math.max(...trendData.map((item) => item.shots), 1);

  const topBrand = brandData[0]?.label || "No data";
  const topShift = shiftData[0]?.label || "No data";

  useEffect(() => { setVisibleCount(50); }, [tableFilter, search, tableView]);
  useEffect(() => { setTableFilter("All"); }, [tableView]);

  const sackOptions = useMemo(() => {
    const seen = new Set<string>();
    for (const r of records) { if (r.sack) seen.add(r.sack); }
    return Array.from(seen).sort((a, b) => a.localeCompare(b, undefined, { numeric: true }));
  }, [records]);

  const navOptions = tableView === "month"
    ? ["All", ...monthOptions.map(o => o.key)]
    : ["All", ...sackOptions];

  const navLabel = (val: string) => {
    if (val === "All") return tableView === "month" ? "All Months" : "All Sacks";
    if (tableView === "month") return monthName(val);
    return `Sack ${val}`;
  };

  const navIdx = navOptions.indexOf(tableFilter);

  const tableRecords = useMemo(() => {
    let filtered = records;

    if (tableView === "month") {
      filtered = tableFilter === "All" ? records : records.filter((r) => r.monthKey === tableFilter);
    } else {
      filtered = tableFilter === "All" ? records : records.filter((r) => r.sack === tableFilter);
    }

    // Sort by date (most recent first)
    filtered = [...filtered].sort((a, b) => {
      const dateA = new Date(a.dateKey || "0");
      const dateB = new Date(b.dateKey || "0");
      return dateB.getTime() - dateA.getTime();
    });

    // Apply search filter
    const searchLower = search.trim().toLowerCase();
    return filtered.filter((record) => {
      if (!searchLower) return true;
      const blob = [
        record.date,
        record.time,
        record.brand,
        record.sack,
        String(record.good),
        String(record.reject),
      ].join(" ").toLowerCase();
      return blob.includes(searchLower);
    });
  }, [records, tableFilter, search, tableView]);

  const visibleRows = tableRecords.slice(0, visibleCount);
  const hasMore = visibleCount < tableRecords.length;
  const displayError = error instanceof Error ? error : null;

  return (
    <div className="h-screen bg-ccb-canvas overflow-hidden">
      <div className="flex h-full bg-white">
        <Sidebar />

        <div className="flex-1 flex flex-col min-w-0 h-full overflow-hidden lg:pl-0 pl-0">
          <header className="border-b-2 border-destructive bg-card">
            <div className="flex items-start px-8 py-5">
              <div className="flex gap-3">
                <div className="w-1 rounded-full bg-destructive" />
                <div>
                  <h1 className="text-2xl font-bold text-primary">Pellets Production Monitoring</h1>
                  <p className="text-sm text-muted-foreground">
                    Live sheet-backed telemetry for pellet shots, rejects, brand and shift performance
                  </p>
                </div>
              </div>
            </div>
          </header>

          <main className="flex-1 overflow-y-auto px-8 py-6">

            {isLoading ? (
              <div className="rounded-xl border border-dashed border-border bg-white p-10 text-center text-sm text-muted-foreground">
                Loading pellets data...
              </div>
            ) : displayError ? (
              <div className="rounded-xl border border-dashed border-destructive/30 bg-destructive/5 p-10 text-center text-sm text-destructive">
                Failed to load pellets data: {displayError.message}
              </div>
            ) : records.length === 0 ? (
              <div className="rounded-xl border border-dashed border-border bg-white p-10 text-center text-sm text-muted-foreground">
                No pellet rows found. Check the sheet headers and service account access.
              </div>
            ) : (
              <>
                <section className="mb-6 grid grid-cols-2 gap-4 md:grid-cols-3 lg:grid-cols-4">
                  <CnfKpi variant="blue" label="Good Shots" value={totalGood.toLocaleString()} unit="shots" />
                  <CnfKpi variant="blue3" label="Rejects" value={totalReject.toLocaleString()} unit="shots" />
                  <CnfKpi variant="blue2" label="Reject %" value={totalShots ? ((totalReject / totalShots) * 100).toFixed(1) : "0.0"} unit="%" />
                  <CnfKpi variant="navy" label="Efficiency" value={passRate.toFixed(1)} unit="%" />
                </section>

                <section className="mb-6 rounded-2xl bg-card border border-border shadow-sm overflow-hidden">
                  <div className="flex items-center justify-between px-5 py-4 border-b border-border">
                    <div>
                      <h3 className="text-[13.5px] font-bold text-primary">Production Overview</h3>
                      <p className="text-[11px] text-muted-foreground mt-0.5">Pellets shots and quality breakdown</p>
                    </div>
                    <div className="relative">
                      <select
                        value={trendView}
                        onChange={(e) => setTrendView(e.target.value as "byDay" | "bySack" | "byShift")}
                        className="appearance-none rounded-lg border border-border bg-muted pl-3 pr-8 py-2 text-[12.5px] font-semibold text-primary outline-none focus:border-primary"
                      >
                        <option value="byDay">By Day</option>
                        <option value="bySack">By Sack</option>
                        <option value="byShift">By Shift</option>
                      </select>
                      <ChevronDown size={14} className="pointer-events-none absolute right-2 top-1/2 -translate-y-1/2 text-muted-foreground" />
                    </div>
                  </div>

                  <div className="grid grid-cols-1 xl:grid-cols-[1fr_300px] divide-y xl:divide-y-0 xl:divide-x divide-border">
                    <div className="p-5">
                      <div className="mb-3">
                        <p className="text-[12px] font-bold text-primary">Shots Trend</p>
                        <p className="text-[11px] text-muted-foreground">Total shots per {trendView === "byDay" ? "day" : trendView === "bySack" ? "sack" : "shift"} period</p>
                      </div>
                      {trendData.length === 0 ? (
                        <div className="flex items-center justify-center h-48 text-muted-foreground text-sm">No data available</div>
                      ) : (
                        <ResponsiveContainer width="100%" height={220}>
                          <LineChart data={trendData} margin={{ top: 8, right: 8, left: -20, bottom: 0 }}>
                            <CartesianGrid strokeDasharray="3 3" stroke="var(--color-border)" />
                            <XAxis dataKey="day" tick={{ fontSize: 10, fill: "var(--color-muted-foreground)" }} axisLine={false} tickLine={false} />
                            <YAxis tick={{ fontSize: 10, fill: "var(--color-muted-foreground)" }} axisLine={false} tickLine={false} />
                            <Tooltip contentStyle={{ background: "var(--color-popover)", border: "1px solid var(--color-border)", borderRadius: 8, fontSize: 12 }} />
                            <Line
                              type="monotone"
                              dataKey="shots"
                              stroke="var(--color-primary)"
                              strokeWidth={2.5}
                              dot={{ fill: "var(--color-primary)", r: 4, strokeWidth: 0 }}
                              activeDot={{ r: 6, fill: "var(--color-primary)", stroke: "#fff", strokeWidth: 2 }}
                            />
                          </LineChart>
                        </ResponsiveContainer>
                      )}
                    </div>

                    <div className="p-5 flex flex-col">
                      <div className="mb-3">
                        <p className="text-[12px] font-bold text-primary">Good vs Reject</p>
                        <p className="text-[11px] text-muted-foreground">Quality breakdown</p>
                      </div>
                      <div className="relative flex items-center justify-center flex-1">
                        <ResponsiveContainer width="100%" height={180}>
                          <PieChart>
                            <Pie
                              data={pieData}
                              dataKey="value"
                              innerRadius="60%"
                              outerRadius="85%"
                              startAngle={90}
                              endAngle={-270}
                            >
                              <Cell fill="var(--color-primary)" />
                              <Cell fill="var(--color-destructive)" />
                            </Pie>
                            <Tooltip contentStyle={{ background: "var(--color-popover)", border: "1px solid var(--color-border)", borderRadius: 8, fontSize: 12 }} />
                          </PieChart>
                        </ResponsiveContainer>
                        <div className="absolute text-center pointer-events-none">
                          <div className="text-[22px] font-extrabold text-primary leading-none">{passRate.toFixed(1)}%</div>
                          <div className="text-[9px] font-bold uppercase tracking-widest text-muted-foreground mt-1">Efficiency</div>
                        </div>
                      </div>
                      <div className="mt-3 space-y-2">
                        <div className="flex items-center justify-between rounded-lg bg-muted px-3 py-2">
                          <div className="flex items-center gap-2">
                            <span className="h-2.5 w-2.5 rounded-full bg-[var(--color-primary)]" />
                            <span className="text-[12px] font-semibold text-primary">Good</span>
                          </div>
                          <span className="text-[13px] font-bold text-primary">{totalGood.toLocaleString()}</span>
                        </div>
                        <div className="flex items-center justify-between rounded-lg bg-muted px-3 py-2">
                          <div className="flex items-center gap-2">
                            <span className="h-2.5 w-2.5 rounded-full bg-[var(--color-destructive)]" />
                            <span className="text-[12px] font-semibold text-destructive">Reject</span>
                          </div>
                          <span className="text-[13px] font-bold text-destructive">{totalReject.toLocaleString()}</span>
                        </div>
                      </div>
                    </div>
                  </div>
                </section>

                <section className="mb-6 rounded-2xl bg-card border border-border shadow-sm overflow-hidden">
                  <div className="grid grid-cols-[1fr_auto_1fr] items-center gap-4 px-5 py-3 border-b border-border">
                    <div>
                      <h3 className="text-[13.5px] font-bold text-primary">Pellets Records</h3>
                      <p className="text-[11px] text-muted-foreground mt-0.5">{tableRecords.length} records</p>
                    </div>

                    <div className="flex items-center rounded-lg border border-border bg-white overflow-hidden">
                      <button
                        type="button"
                        onClick={() => { if (navIdx > 0) setTableFilter(navOptions[navIdx - 1]); }}
                        disabled={navIdx <= 0}
                        className="px-3 py-2 text-[15px] leading-none text-muted-foreground hover:text-primary hover:bg-muted disabled:opacity-30 disabled:cursor-not-allowed transition border-r border-border"
                      >‹</button>
                      <span className="px-5 py-2 text-[13px] font-bold text-primary min-w-[150px] text-center">
                        {navLabel(tableFilter)}
                      </span>
                      <button
                        type="button"
                        onClick={() => { if (navIdx < navOptions.length - 1) setTableFilter(navOptions[navIdx + 1]); }}
                        disabled={navIdx >= navOptions.length - 1}
                        className="px-3 py-2 text-[15px] leading-none text-muted-foreground hover:text-primary hover:bg-muted disabled:opacity-30 disabled:cursor-not-allowed transition border-l border-border"
                      >›</button>
                    </div>

                    <div className="flex items-center gap-2 justify-end">
                      <div className="relative">
                        <Search size={13} className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground pointer-events-none" />
                        <input
                          value={search}
                          onChange={e => setSearch(e.target.value)}
                          placeholder="Search..."
                          className="pl-8 pr-3 py-2 rounded-lg border border-border bg-muted text-[12px] text-primary placeholder:text-muted-foreground outline-none focus:border-primary w-44"
                        />
                      </div>
                      <div className="relative">
                        <select
                          value={tableView}
                          onChange={(e) => setTableView(e.target.value as "month" | "sack")}
                          className="appearance-none rounded-lg border border-border bg-card pl-3 pr-8 py-2 text-[12px] font-semibold text-primary outline-none focus:border-primary"
                        >
                          <option value="month">Month</option>
                          <option value="sack">Per Sack</option>
                        </select>
                        <ChevronDown size={13} className="pointer-events-none absolute right-2 top-1/2 -translate-y-1/2 text-muted-foreground" />
                      </div>
                      <button className="inline-flex items-center gap-1.5 rounded-md bg-primary px-3 py-2 text-xs font-semibold text-primary-foreground hover:bg-primary/90">
                        <Plus size={13} /> Add Record
                      </button>
                    </div>
                  </div>

                  <div ref={scrollRef} className="overflow-x-auto overflow-y-auto" style={{ minHeight: "320px", maxHeight: "420px" }}
                    onScroll={(e) => {
                      const el = e.currentTarget;
                      if (hasMore && el.scrollTop + el.clientHeight >= el.scrollHeight - 80) {
                        setVisibleCount(c => c + 50);
                      }
                    }}>
                    <table className="w-full text-[12.5px]" style={{ borderCollapse: "collapse" }}>
                      <thead>
                        <tr className="bg-muted border-b border-border">
                          {["Date", "Sack #", "Time", "Shot Blasting Good", "Reject", "Brands", "kgs"].map(h => (
                            <th key={h} className="px-4 py-3 text-left text-[10px] font-bold uppercase tracking-wider text-muted-foreground whitespace-nowrap sticky top-0 bg-muted z-10">
                              {h}
                            </th>
                          ))}
                        </tr>
                      </thead>
                      <tbody>
                        {visibleRows.map((record, idx) => {
                          const zebra = idx % 2 === 1 ? "bg-[#FAFBFF]" : "bg-white";
                          return (
                            <tr key={`${record.tabName}-${record.rowNumber}`}
                              className={`${zebra} hover:bg-primary/5 border-b border-border transition-colors`}>
                              <td className="px-4 py-3 whitespace-nowrap text-primary font-medium">{record.date || "—"}</td>
                              <td className="px-4 py-3 whitespace-nowrap text-muted-foreground">{record.sack || "—"}</td>
                              <td className="px-4 py-3 whitespace-nowrap text-muted-foreground">{record.time || "—"}</td>
                              <td className="px-4 py-3 whitespace-nowrap font-bold text-primary">{record.good.toLocaleString()}</td>
                              <td className="px-4 py-3 whitespace-nowrap font-bold text-destructive">{record.reject.toLocaleString()}</td>
                              <td className="px-4 py-3 whitespace-nowrap text-primary">{record.brand || "—"}</td>
                              <td className="px-4 py-3 whitespace-nowrap text-muted-foreground">{record.kgs || "—"}</td>
                            </tr>
                          );
                        })}
                        {visibleRows.length === 0 && (
                          <tr>
                            <td colSpan={7} className="px-4 py-10 text-center text-muted-foreground text-sm">
                              No records match your current filters.
                            </td>
                          </tr>
                        )}
                      </tbody>
                    </table>
                  </div>

                  <div className="flex items-center justify-between px-5 py-3 border-t border-border bg-white">
                    <p className="text-[11px] text-muted-foreground">
                      Showing {visibleRows.length} of {tableRecords.length} records
                    </p>
                    {hasMore && <p className="text-[11px] text-muted-foreground">Scroll down to load more</p>}
                  </div>
                </section>
              </>
            )}

            <footer className="mt-8 text-center text-xs text-muted-foreground">
              CCB Inventory · Pellets Production Monitoring · Synced with Google Sheets
            </footer>
          </main>
        </div>
      </div>
    </div>
  );
}
