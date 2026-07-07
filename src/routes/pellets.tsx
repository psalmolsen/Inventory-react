import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
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
  variant: "shade1" | "shade2" | "shade3" | "shade4" | "shade5";
}) {
  const styles = {
    shade1: "bg-[#2E3EA8] text-white",
    shade2: "bg-[#29399A] text-white",
    shade3: "bg-[#25348C] text-white",
    shade4: "bg-[#202F76] text-white",
    shade5: "bg-[#1A2560] text-white",
  }[variant];
  return (
    <div className={`relative overflow-hidden rounded-2xl p-4 shadow-sm ${styles}`}>
      <div className="text-[10px] font-semibold uppercase tracking-[0.16em] text-white/70">{label}</div>
      <div className="mt-2 flex items-baseline gap-2">
        <div className="text-[24px] font-extrabold leading-none">{value}</div>
        {unit && <div className="text-[11px] font-semibold uppercase tracking-widest text-white/80">{unit}</div>}
      </div>
      <div className="pointer-events-none absolute -right-4 -bottom-4 h-16 w-16 rounded-full bg-white/5" />
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
  });

  const [month, setMonth] = useState("All");
  const [search, setSearch] = useState("");
  const [status, setStatus] = useState("All");

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
  }, [focusRecords]);

  const pieData = [
    { name: "Good", value: totalGood },
    { name: "Reject", value: totalReject },
  ];

  const maxBrand = Math.max(...brandData.map((item) => item.shots), 1);
  const maxTrend = Math.max(...trendData.map((item) => item.shots), 1);

  const topBrand = brandData[0]?.label || "No data";
  const topShift = shiftData[0]?.label || "No data";
  const visibleRows = focusRecords.slice(0, 20);
  const displayError = error instanceof Error ? error : null;

  return (
    <div className="h-screen bg-ccb-canvas overflow-hidden">
      <div className="flex h-full bg-white">
        <Sidebar />

        <div className="flex-1 flex flex-col min-w-0 h-full overflow-hidden lg:pl-0 pl-0">
          <header className="border-b-2 border-destructive bg-card">
            <div className="flex items-start justify-between px-8 py-5">
              <div className="flex gap-3">
                <div className="w-1 rounded-full bg-destructive" />
                <div>
                  <h1 className="text-2xl font-bold text-primary">Pellets Production Monitoring</h1>
                  <p className="text-sm text-muted-foreground">
                    Live sheet-backed telemetry for pellet shots, rejects, brand and shift performance
                  </p>
                </div>
              </div>
              <div className="flex items-center gap-3">
                <div className="text-right">
                  <div className="text-[10px] font-semibold uppercase tracking-[0.15em] text-muted-foreground">
                    CCB Inventory Clerk
                  </div>
                </div>
                <div className="flex h-10 w-10 items-center justify-center rounded-full bg-primary text-sm font-bold text-primary-foreground">
                  AB
                </div>
              </div>
            </div>
          </header>

          <main className="flex-1 overflow-y-auto px-8 py-6">
            <div className="mb-6 flex flex-wrap items-center gap-2">
              <button
                onClick={() => setMonth("All")}
                className={`rounded-md px-4 py-2 text-xs font-bold uppercase tracking-wider transition ${
                  month === "All" ? "bg-primary text-primary-foreground shadow-sm" : "text-muted-foreground hover:bg-muted"
                }`}
              >
                All
              </button>
              {monthOptions.map((option) => (
                <button
                  key={option.key}
                  onClick={() => setMonth(option.key)}
                  className={`rounded-md px-4 py-2 text-xs font-bold uppercase tracking-wider transition ${
                    month === option.key ? "bg-primary text-primary-foreground shadow-sm" : "text-muted-foreground hover:bg-muted"
                  }`}
                >
                  {option.label}
                </button>
              ))}
            </div>

            <div className="mb-4 flex items-center gap-2 text-xs font-semibold uppercase tracking-wider">
              <BarChart3 className="h-4 w-4 text-warning" />
              <span className="text-muted-foreground">Selected:</span>
              <span className="text-primary">
                {month === "All" ? "All records" : monthName(month)} - Shift: All · Brand: All
              </span>
            </div>

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
                <section className="mb-6 grid grid-cols-2 gap-4 md:grid-cols-3 lg:grid-cols-5">
                  <CnfKpi variant="shade1" label="Good Shots" value={totalGood.toLocaleString()} unit="shots" />
                  <CnfKpi variant="shade2" label="Rejects" value={totalReject.toLocaleString()} unit="shots" />
                  <CnfKpi variant="shade3" label="Reject %" value={totalShots ? ((totalReject / totalShots) * 100).toFixed(1) : "0.0"} unit="%" />
                  <CnfKpi variant="shade4" label="Efficiency" value={passRate.toFixed(1)} unit="%" />
                  <CnfKpi variant="shade5" label="Total Shots" value={totalShots.toLocaleString()} unit="shots" />
                </section>

                <section className="mb-6 grid gap-4 lg:grid-cols-2">
                  <Panel title="Good vs Reject">
                    <div className="flex items-center gap-6">
                      <div className="h-56 flex-1">
                        <ResponsiveContainer width="100%" height="100%">
                          <PieChart>
                            <Pie data={pieData} innerRadius={55} outerRadius={85} dataKey="value" stroke="none" paddingAngle={2}>
                              <Cell fill="var(--color-primary)" />
                              <Cell fill="var(--color-destructive)" />
                            </Pie>
                            <Tooltip contentStyle={{ background: "var(--color-popover)", border: "1px solid var(--color-border)", borderRadius: 8, fontSize: 12 }} />
                          </PieChart>
                        </ResponsiveContainer>
                      </div>
                      <div className="space-y-3">
                        <div>
                          <div className="flex items-center gap-2 text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                            <span className="h-2.5 w-2.5 rounded-sm bg-primary" /> Good
                          </div>
                          <div className="text-2xl font-bold tabular-nums text-primary">{totalGood.toLocaleString()}</div>
                        </div>
                        <div>
                          <div className="flex items-center gap-2 text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                            <span className="h-2.5 w-2.5 rounded-sm bg-destructive" /> Reject
                          </div>
                          <div className="text-2xl font-bold tabular-nums text-destructive">{totalReject.toLocaleString()}</div>
                        </div>
                      </div>
                    </div>
                  </Panel>

                  <Panel title="Shots Trend">
                    <div className="h-56">
                      <ResponsiveContainer width="100%" height="100%">
                        <LineChart data={trendData}>
                          <CartesianGrid strokeDasharray="3 3" stroke="var(--color-border)" />
                          <XAxis dataKey="day" stroke="var(--color-muted-foreground)" fontSize={12} />
                          <YAxis stroke="var(--color-muted-foreground)" fontSize={12} />
                          <Tooltip contentStyle={{ background: "var(--color-popover)", border: "1px solid var(--color-border)", borderRadius: 8, fontSize: 12 }} />
                          <Line type="monotone" dataKey="shots" stroke="var(--color-primary)" strokeWidth={2.5} dot={{ fill: "var(--color-primary)", r: 4 }} activeDot={{ r: 6 }} />
                        </LineChart>
                      </ResponsiveContainer>
                    </div>
                  </Panel>
                </section>

                <section className="mb-6 grid gap-4 lg:grid-cols-2">
                  <Panel title="Brand Performance">
                    <div className="space-y-4">
                      {brandData.slice(0, 5).map((brand) => (
                        <div key={brand.label}>
                          <div className="mb-1.5 flex justify-between text-sm">
                            <span className="font-semibold text-primary">{brand.label}</span>
                            <span className="tabular-nums text-muted-foreground">{brand.shots.toLocaleString()}</span>
                          </div>
                          <div className="h-2.5 overflow-hidden rounded-full bg-muted">
                            <div className="h-full rounded-full bg-primary transition-all" style={{ width: `${(brand.shots / maxBrand) * 100}%` }} />
                          </div>
                        </div>
                      ))}
                    </div>
                  </Panel>

                  <Panel title="Shift Performance">
                    <div className="h-56">
                      <ResponsiveContainer width="100%" height="100%">
                        <BarChart data={shiftData} layout="vertical" margin={{ left: 20 }}>
                          <CartesianGrid strokeDasharray="3 3" stroke="var(--color-border)" horizontal={false} />
                          <XAxis type="number" stroke="var(--color-muted-foreground)" fontSize={12} />
                          <YAxis type="category" dataKey="label" stroke="var(--color-muted-foreground)" fontSize={12} width={100} />
                          <Tooltip contentStyle={{ background: "var(--color-popover)", border: "1px solid var(--color-border)", borderRadius: 8, fontSize: 12 }} cursor={{ fill: "var(--color-muted)" }} />
                          <Bar dataKey="shots" fill="var(--color-primary)" radius={[0, 6, 6, 0]} />
                        </BarChart>
                      </ResponsiveContainer>
                    </div>
                  </Panel>
                </section>

                <section className="mb-6 rounded-xl bg-card p-5 shadow-sm ring-1 ring-border">
                  <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
                    <div className="flex items-center gap-2">
                      <div className="h-5 w-1 rounded-full bg-destructive" />
                      <h2 className="text-base font-bold text-primary">Live Interval Table</h2>
                      <span className="ml-1 rounded-full bg-muted px-2.5 py-0.5 text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
                        {visibleRows.length} rows
                      </span>
                    </div>
                    <div className="flex items-center gap-2">
                      <div className="relative">
                        <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                        <input
                          value={search}
                          onChange={(e) => setSearch(e.target.value)}
                          placeholder="Search rows..."
                          className="h-9 w-64 rounded-full bg-muted pl-9 pr-3 text-sm outline-none placeholder:text-muted-foreground focus:ring-2 focus:ring-ring"
                        />
                      </div>
                      <button className="inline-flex items-center gap-1.5 rounded-md border border-border bg-card px-3 py-2 text-xs font-semibold">
                        {month === "All" ? "All Months" : monthName(month)} <ChevronDown className="h-3.5 w-3.5" />
                      </button>
                      <button className="inline-flex items-center gap-1.5 rounded-md border border-border bg-card px-3 py-2 text-xs font-semibold">
                        {status === "All" ? "All Status" : status} <ChevronDown className="h-3.5 w-3.5" />
                      </button>
                      <button className="inline-flex items-center gap-1.5 rounded-md bg-primary px-3 py-2 text-xs font-semibold text-primary-foreground">
                        <Download className="h-3.5 w-3.5" /> Export
                      </button>
                    </div>
                  </div>

                  <div className="space-y-3">
                    {visibleRows.map((record) => (
                      <div key={`${record.tabName}-${record.rowNumber}`} className="flex items-center gap-4 rounded-lg px-4 py-4 ring-1 ring-border transition hover:ring-primary/30">
                        <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-md bg-muted text-primary">
                          <BarChart3 className="h-5 w-5" />
                        </div>
                        <div className="min-w-[150px]">
                          <div className="text-sm font-bold text-primary">
                            {record.interval || record.time || "Unspecified"}
                          </div>
                          <div className="text-[11px] font-medium uppercase tracking-wider text-muted-foreground">
                            {record.brand || "Unknown brand"} · {record.sack || "n/a"}
                          </div>
                        </div>

                        <div className="hidden gap-8 md:flex">
                          <div>
                            <div className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">Good</div>
                            <div className="text-lg font-bold tabular-nums text-primary">{record.good.toLocaleString()}</div>
                          </div>
                          <div>
                            <div className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">Reject</div>
                            <div className="text-lg font-bold tabular-nums text-destructive">{record.reject.toLocaleString()}</div>
                          </div>
                          <div>
                            <div className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">Shots</div>
                            <div className="text-lg font-bold tabular-nums">{record.shots.toLocaleString()}</div>
                          </div>
                        </div>

                        <div className="ml-auto flex items-center gap-3">
                          <StatusDot status={record.status} />
                          <button className="rounded-md border border-border px-3 py-1.5 text-xs font-semibold hover:bg-muted">
                            Details
                          </button>
                          <button className="p-1.5 text-muted-foreground hover:text-foreground">
                            <MoreVertical className="h-4 w-4" />
                          </button>
                        </div>
                      </div>
                    ))}
                  </div>
                </section>

                <Panel title="Daily Trend">
                  <div className="space-y-3">
                    {Array.from(
                      records.reduce((map, record) => {
                        map.set(record.dateKey, (map.get(record.dateKey) || 0) + record.shots);
                        return map;
                      }, new Map<string, number>())
                    )
                      .sort(([a], [b]) => a.localeCompare(b))
                      .slice(-8)
                      .map(([dateKey, shots]) => (
                        <div key={dateKey} className="flex items-center gap-4">
                          <div className="w-24 text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                            {dateKey.slice(5)}
                          </div>
                          <div className="h-8 flex-1 overflow-hidden rounded-md bg-muted">
                            <div
                              className="flex h-full items-center justify-end rounded-md bg-primary px-3 text-xs font-bold text-primary-foreground"
                              style={{ width: `${Math.max(10, (shots / Math.max(maxTrend, 1)) * 100)}%` }}
                            >
                              {shots.toLocaleString()}
                            </div>
                          </div>
                        </div>
                      ))}
                  </div>
                </Panel>
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
