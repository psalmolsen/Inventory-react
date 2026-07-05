import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
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
  Factory,
  LogOut,
  BarChart3,
  Download,
  Search,
  ChevronDown,
  MoreVertical,
} from "lucide-react";

export const Route = createFileRoute("/")({
  component: PelletsDashboard,
});

const MONTHS = ["January", "May", "June", "July", "August", "September", "October", "November", "December", "All"];

const NAV = [
  { label: "Material Monitoring", icon: Box },
  { label: "CNF Monitoring", icon: Fuel },
  { label: "O-Ring Monitoring", icon: CircleIcon },
  { label: "Pellets L-Sales", icon: Package2, active: true },
  { label: "Station Consumption", icon: BarChart3 },
];

const KPIS = [
  { label: "Good Shots", value: "579", unit: "shots" },
  { label: "Rejects", value: "1,369", unit: "shots" },
  { label: "Reject %", value: "70.3", unit: "%" },
  { label: "Total Bags", value: "28", unit: "bags" },
  { label: "Top Brand", value: "Equi Gaz", unit: "" },
  { label: "Efficiency", value: "29.7", unit: "%" },
];

const goodReject = [
  { name: "Good Shots", value: 579 },
  { name: "Rejects", value: 1369 },
];
const shotsPerHour = [
  { t: "6AM", shots: 80 },
  { t: "8AM", shots: 160 },
  { t: "10AM", shots: 145 },
  { t: "12PM", shots: 210 },
  { t: "2PM", shots: 180 },
  { t: "4PM", shots: 240 },
  { t: "6PM", shots: 195 },
  { t: "8PM", shots: 220 },
  { t: "10PM", shots: 170 },
];
const brands = [
  { name: "Equi Gaz", value: 820 },
  { name: "South Gas", value: 640 },
  { name: "Luzon", value: 488 },
];
const shifts = [
  { name: "1st Shift", value: 780 },
  { name: "Night", value: 640 },
  { name: "2nd Shift", value: 528 },
];
const intervals = [
  { time: "6–8 AM", good: 58, reject: 102, brand: "Equi Gaz", sack: "11kg", status: "warn" },
  { time: "8–11 AM", good: 55, reject: 102, brand: "Equi Gaz", sack: "11kg", status: "danger" },
  { time: "11–1 PM", good: 92, reject: 145, brand: "South Gas", sack: "11kg", status: "warn" },
  { time: "1–3 PM", good: 110, reject: 168, brand: "South Gas", sack: "22kg", status: "warn" },
  { time: "3–6 PM", good: 138, reject: 210, brand: "Luzon", sack: "11kg", status: "danger" },
  { time: "6–9 PM", good: 96, reject: 302, brand: "Equi Gaz", sack: "22kg", status: "danger" },
  { time: "9–12 AM", good: 130, reject: 340, brand: "Equi Gaz", sack: "11kg", status: "danger" },
];
const daily = [
  { day: "18 May", shots: 1450 },
  { day: "19 May", shots: 2380 },
  { day: "20 May", shots: 1120 },
  { day: "21 May", shots: 1948 },
];

function Sidebar() {
  return (
    <aside className="fixed inset-y-0 left-0 z-20 flex w-60 flex-col bg-sidebar text-sidebar-foreground">
      <div className="flex items-center gap-3 border-b border-sidebar-border px-5 py-5">
        <div className="flex h-11 w-11 items-center justify-center rounded-md bg-white/95 text-sidebar shadow-sm">
          <Factory className="h-6 w-6" />
        </div>
        <div className="leading-tight">
          <div className="text-sm font-bold">CCB Inventory</div>
          <div className="text-[10px] font-medium tracking-wider text-sidebar-foreground/70">
            MANAGEMENT SYSTEM
          </div>
        </div>
      </div>

      <nav className="flex-1 space-y-1 px-3 py-4">
        {NAV.map((item) => {
          const Icon = item.icon;
          return (
            <button
              key={item.label}
              className={`flex w-full items-center gap-3 rounded-md px-3 py-2.5 text-sm font-medium transition ${
                item.active
                  ? "bg-sidebar-accent text-sidebar-accent-foreground shadow-sm"
                  : "text-sidebar-foreground/85 hover:bg-white/10"
              }`}
            >
              <Icon className="h-4 w-4" />
              {item.label}
            </button>
          );
        })}
      </nav>

      <button className="mx-3 mb-4 flex items-center gap-2 rounded-md px-3 py-2 text-sm font-medium text-destructive hover:bg-white/10">
        <LogOut className="h-4 w-4" /> Logout
      </button>
    </aside>
  );
}

function KpiCard({ k }: { k: (typeof KPIS)[number] }) {
  return (
    <div className="relative overflow-hidden rounded-xl bg-navy p-5 text-navy-foreground">
      <div className="pointer-events-none absolute -right-6 -top-6 h-24 w-24 rounded-full bg-white/5" />
      <div className="pointer-events-none absolute -right-10 top-6 h-16 w-16 rounded-full bg-white/5" />
      <div className="text-[10px] font-semibold uppercase tracking-[0.15em] text-navy-foreground/75">
        {k.label}
      </div>
      <div className="mt-4 flex items-baseline gap-2">
        <span className="text-4xl font-extrabold tabular-nums">{k.value}</span>
        {k.unit && (
          <span className="text-xs font-medium uppercase tracking-wider text-navy-foreground/70">
            {k.unit}
          </span>
        )}
      </div>
    </div>
  );
}

function StatusDot({ status }: { status: string }) {
  const map: Record<string, string> = {
    ok: "bg-success",
    warn: "bg-warning",
    danger: "bg-destructive",
  };
  const label: Record<string, string> = {
    ok: "On Target",
    warn: "Watch",
    danger: "Critical",
  };
  return (
    <span className="inline-flex items-center gap-2 text-xs font-medium text-foreground/80">
      <span className={`h-2.5 w-2.5 rounded-full ${map[status]}`} />
      {label[status]}
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
  const [month, setMonth] = useState("May");
  const maxBrand = Math.max(...brands.map((b) => b.value));
  const maxDaily = Math.max(...daily.map((d) => d.shots));

  return (
    <div className="min-h-screen">
      <Sidebar />

      <div className="ml-60">
        <header className="border-b-2 border-destructive bg-card">
          <div className="flex items-start justify-between px-8 py-5">
            <div className="flex gap-3">
              <div className="w-1 rounded-full bg-destructive" />
              <div>
                <h1 className="text-2xl font-bold text-primary">Pellets Production Monitoring</h1>
                <p className="text-sm text-muted-foreground">
                  Live plant telemetry — good shots, rejects, brand &amp; shift performance
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

        <main className="px-8 py-6">
          <div className="mb-6 flex flex-wrap items-center gap-2">
            {MONTHS.map((m) => {
              const active = m === month;
              return (
                <button
                  key={m}
                  onClick={() => setMonth(m)}
                  className={`rounded-md px-4 py-2 text-xs font-bold uppercase tracking-wider transition ${
                    active
                      ? "bg-primary text-primary-foreground shadow-sm"
                      : "text-muted-foreground hover:bg-muted"
                  }`}
                >
                  {m}
                </button>
              );
            })}
          </div>

          <div className="mb-4 flex items-center gap-2 text-xs font-semibold uppercase tracking-wider">
            <BarChart3 className="h-4 w-4 text-warning" />
            <span className="text-muted-foreground">Selected:</span>
            <span className="text-primary">21 May 2026 — Shift: All · Brand: All</span>
          </div>

          <section className="mb-6 grid grid-cols-2 gap-4 md:grid-cols-3 lg:grid-cols-6">
            {KPIS.map((k) => (
              <KpiCard key={k.label} k={k} />
            ))}
          </section>

          <section className="mb-6 grid gap-4 lg:grid-cols-2">
            <Panel title="Good vs Reject">
              <div className="flex items-center gap-6">
                <div className="h-56 flex-1">
                  <ResponsiveContainer width="100%" height="100%">
                    <PieChart>
                      <Pie data={goodReject} innerRadius={55} outerRadius={85} dataKey="value" stroke="none" paddingAngle={2}>
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
                    <div className="text-2xl font-bold tabular-nums text-primary">579</div>
                  </div>
                  <div>
                    <div className="flex items-center gap-2 text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                      <span className="h-2.5 w-2.5 rounded-sm bg-destructive" /> Reject
                    </div>
                    <div className="text-2xl font-bold tabular-nums text-destructive">1,369</div>
                  </div>
                </div>
              </div>
            </Panel>

            <Panel title="Shots per Hour">
              <div className="h-56">
                <ResponsiveContainer width="100%" height="100%">
                  <LineChart data={shotsPerHour}>
                    <CartesianGrid strokeDasharray="3 3" stroke="var(--color-border)" />
                    <XAxis dataKey="t" stroke="var(--color-muted-foreground)" fontSize={12} />
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
                {brands.map((b) => (
                  <div key={b.name}>
                    <div className="mb-1.5 flex justify-between text-sm">
                      <span className="font-semibold text-primary">{b.name}</span>
                      <span className="tabular-nums text-muted-foreground">{b.value}</span>
                    </div>
                    <div className="h-2.5 overflow-hidden rounded-full bg-muted">
                      <div className="h-full rounded-full bg-primary transition-all" style={{ width: `${(b.value / maxBrand) * 100}%` }} />
                    </div>
                  </div>
                ))}
              </div>
            </Panel>

            <Panel title="Shift Performance">
              <div className="h-56">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={shifts} layout="vertical" margin={{ left: 20 }}>
                    <CartesianGrid strokeDasharray="3 3" stroke="var(--color-border)" horizontal={false} />
                    <XAxis type="number" stroke="var(--color-muted-foreground)" fontSize={12} />
                    <YAxis type="category" dataKey="name" stroke="var(--color-muted-foreground)" fontSize={12} width={80} />
                    <Tooltip contentStyle={{ background: "var(--color-popover)", border: "1px solid var(--color-border)", borderRadius: 8, fontSize: 12 }} cursor={{ fill: "var(--color-muted)" }} />
                    <Bar dataKey="value" fill="var(--color-primary)" radius={[0, 6, 6, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              </div>
            </Panel>
          </section>

          <section className="mb-6 rounded-xl bg-card p-5 shadow-sm ring-1 ring-border">
            <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
              <div className="flex items-center gap-2">
                <div className="h-5 w-1 rounded-full bg-destructive" />
                <h2 className="text-base font-bold text-primary">Time Interval Table</h2>
                <span className="ml-1 rounded-full bg-muted px-2.5 py-0.5 text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
                  {intervals.length} intervals
                </span>
              </div>
              <div className="flex items-center gap-2">
                <div className="relative">
                  <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                  <input placeholder="Search intervals..." className="h-9 w-64 rounded-full bg-muted pl-9 pr-3 text-sm outline-none placeholder:text-muted-foreground focus:ring-2 focus:ring-ring" />
                </div>
                <button className="inline-flex items-center gap-1.5 rounded-md border border-border bg-card px-3 py-2 text-xs font-semibold">
                  Monthly <ChevronDown className="h-3.5 w-3.5" />
                </button>
                <button className="inline-flex items-center gap-1.5 rounded-md bg-primary px-3 py-2 text-xs font-semibold text-primary-foreground">
                  <Download className="h-3.5 w-3.5" /> Export PDF
                </button>
              </div>
            </div>

            <div className="space-y-3">
              {intervals.map((r, i) => {
                const pct = ((r.reject / (r.good + r.reject)) * 100).toFixed(0);
                const isTop = i === 0;
                return (
                  <div key={r.time} className={`flex items-center gap-4 rounded-lg px-4 py-4 ring-1 transition ${isTop ? "bg-highlight ring-warning/40" : "bg-card ring-border hover:ring-primary/30"}`}>
                    <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-md bg-muted text-primary">
                      <BarChart3 className="h-5 w-5" />
                    </div>
                    <div className="min-w-[140px]">
                      <div className="text-sm font-bold text-primary">{r.time}</div>
                      <div className="text-[11px] font-medium uppercase tracking-wider text-muted-foreground">
                        {r.brand} · {r.sack}
                      </div>
                    </div>

                    <div className="hidden gap-8 md:flex">
                      <div>
                        <div className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">Good</div>
                        <div className="text-lg font-bold tabular-nums text-primary">{r.good}</div>
                      </div>
                      <div>
                        <div className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">Reject</div>
                        <div className="text-lg font-bold tabular-nums text-destructive">{r.reject}</div>
                      </div>
                      <div>
                        <div className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">Reject %</div>
                        <div className="text-lg font-bold tabular-nums">{pct}%</div>
                      </div>
                    </div>

                    <div className="ml-auto flex items-center gap-3">
                      <StatusDot status={r.status} />
                      <button className="rounded-md border border-border px-3 py-1.5 text-xs font-semibold hover:bg-muted">Details</button>
                      <button className="p-1.5 text-muted-foreground hover:text-foreground">
                        <MoreVertical className="h-4 w-4" />
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>
          </section>

          <Panel title="Daily Trend">
            <div className="space-y-3">
              {daily.map((d) => (
                <div key={d.day} className="flex items-center gap-4">
                  <div className="w-20 text-xs font-semibold uppercase tracking-wider text-muted-foreground">{d.day}</div>
                  <div className="h-8 flex-1 overflow-hidden rounded-md bg-muted">
                    <div className="flex h-full items-center justify-end rounded-md bg-primary px-3 text-xs font-bold text-primary-foreground" style={{ width: `${(d.shots / maxDaily) * 100}%` }}>
                      {d.shots.toLocaleString()}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </Panel>

          <footer className="mt-8 text-center text-xs text-muted-foreground">
            CCB Inventory · Pellets Production Monitoring · Snapshot 21 May 2026
          </footer>
        </main>
      </div>
    </div>
  );
}
