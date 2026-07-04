import { createFileRoute } from "@tanstack/react-router";
import { useState, useMemo, useEffect } from "react";
import { Plus, Search, RefreshCw, Eye, TrendingUp, PieChart, BarChart3 } from "lucide-react";
import { Sidebar } from "../components/Sidebar";
import { AddRecordModal } from "../components/o-ring/add-record-modal";
import { oringService, OringRecord, rejectRate, getMonthKey, TimeSlot } from "../lib/oring-service";

export const Route = createFileRoute("/oring")({ component: OringMonitoring });

// ─── Constants ─────────────────────────────────────────────────────────────────
const SOURCES = ["RAPID", "AKXEL", "COASTAL", "EQUI GAS", "LUZON GAS", "ISLAND GAS"];
const INSTALLED_TO = ["Line A-01", "Line A-02", "Line B-03", "Line B-04", "Line C-01", "Stock Room"];
const TIME_SLOTS: TimeSlot[] = ["Morning", "Midday", "Afternoon", "Evening"];

const SLOT_STYLE: Record<TimeSlot, string> = {
  Morning:   "bg-ccb-blue/10 text-ccb-blue",
  Midday:    "bg-ccb-gold/20 text-[#A07400]",
  Afternoon: "bg-orange-100 text-orange-600",
  Evening:   "bg-ccb-navy/10 text-ccb-navy",
};

// ─── Main Component ───────────────────────────────────────────────────────────
function OringMonitoring() {
  const [records, setRecords] = useState<OringRecord[]>([]);
  const [showModal, setShowModal] = useState(false);
  const [search, setSearch] = useState("");
  const [loading, setLoading] = useState(true);

  // Load records from service on mount
  useEffect(() => {
    async function loadRecords() {
      try {
        const data = await oringService.readRecords();
        setRecords(data);
      } catch (error) {
        console.error("Failed to load records:", error);
      } finally {
        setLoading(false);
      }
    }
    loadRecords();
  }, []);

  function handleAddRecord(rec: OringRecord) {
    setRecords((prev) => [rec, ...prev]);
    // TODO: Call oringService.appendRecord(rec) when backend is ready
  }

  const filtered = useMemo(() => {
    const q = search.toLowerCase();
    if (!q) return records;
    return records.filter((r) =>
      r.id.toLowerCase().includes(q) ||
      r.source.toLowerCase().includes(q) ||
      r.installedTo.toLowerCase().includes(q) ||
      r.timeSlot.toLowerCase().includes(q)
    );
  }, [records, search]);

  const totals = useMemo(() => ({
    repaired: records.reduce((s, r) => s + r.repaired, 0),
    good:     records.reduce((s, r) => s + r.good,     0),
    rejected: records.reduce((s, r) => s + r.rejected, 0),
  }), [records]);

  const totalRejectRate = totals.repaired > 0
    ? Math.round((totals.rejected / totals.repaired) * 1000) / 10
    : 0;

  return (
    <div className="h-screen bg-ccb-canvas overflow-hidden">
      <div className="flex h-full bg-white">
        <Sidebar />
        <div className="flex-1 flex flex-col min-w-0 h-full overflow-hidden">

          {/* ── Header ── */}
          <div className="bg-white border-b border-ccb-border">
            <div className="flex items-center justify-between px-8 py-4">
              <div className="flex items-center gap-3">
                <span className="block h-[22px] w-[4px] rounded-sm bg-ccb-gold" />
                <div>
                  <h1 className="text-[18px] font-bold leading-tight text-ccb-navy">O-Ring Monitoring</h1>
                  <p className="text-[12px] text-ccb-muted">Track repair batches and QC outcomes by source</p>
                </div>
              </div>
              <div className="flex items-center gap-4">
                <div className="text-[11px] uppercase tracking-widest text-ccb-muted">CCB Inventory Clerk</div>
                <div className="h-9 w-9 rounded-full bg-gradient-to-br from-ccb-blue to-ccb-navy text-white flex items-center justify-center text-[12px] font-bold">AB</div>
              </div>
            </div>
            <div className="h-[3px] bg-ccb-red" />
          </div>

          {/* ── Content ── */}
          <div className="flex-1 p-8 bg-ccb-canvas space-y-6 overflow-y-auto">

            {/* Controls Bar */}
            <section className="flex items-center justify-between gap-4">
              <div className="flex items-center gap-3 flex-1">
                <div className="relative flex-1 max-w-md">
                  <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-ccb-muted" />
                  <input
                    value={search}
                    onChange={(e) => setSearch(e.target.value)}
                    placeholder="Search by ID, source, installed line, remarks..."
                    className="w-full rounded-lg border border-ccb-border bg-white py-2.5 pl-10 pr-4 text-xs placeholder:text-ccb-muted focus:outline-none focus:ring-1 focus:ring-ccb-blue"
                  />
                </div>
                <div className="relative">
                  <select className="appearance-none rounded-lg border border-ccb-border bg-white pl-4 pr-10 py-2.5 text-xs font-semibold text-ccb-navy focus:outline-none focus:ring-1 focus:ring-ccb-blue">
                    <option>Month: July</option>
                    <option>Month: June</option>
                    <option>Month: May</option>
                    <option>Month: April</option>
                    <option>Month: March</option>
                  </select>
                  <TrendingUp className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 size-4 text-ccb-muted" />
                </div>
                <button className="rounded-lg border border-ccb-border bg-white px-4 py-2.5 text-xs font-semibold text-ccb-navy hover:bg-ccb-canvas transition-colors">
                  <RefreshCw className="size-4" />
                </button>
              </div>
              <button
                onClick={() => setShowModal(true)}
                className="flex items-center gap-2 rounded-lg bg-ccb-blue px-5 py-2.5 text-xs font-semibold text-white hover:bg-ccb-navy transition-colors shadow-sm"
              >
                <Plus className="size-4" /> Add Repair Record
              </button>
            </section>

            {/* KPI Cards */}
            <section>
              <div className="grid grid-cols-2 gap-4">
                <DashboardKpi
                  label="TOTAL REPAIRS"
                  value={totals.repaired.toLocaleString()}
                  subtitle={`${records.length} log entries in view`}
                  color="blue"
                />
                <DashboardKpi
                  label="REJECTED UNITS"
                  value={totals.rejected.toLocaleString()}
                  subtitle={`Reject rate ${totalRejectRate}%`}
                  color="red"
                />
              </div>
            </section>

            {/* Charts Row */}
            <section className="overflow-x-auto pb-2">
              <div className="flex gap-6 min-w-max">
                {/* Repairs Over Time Chart */}
                <div className="w-[500px] overflow-hidden rounded-2xl bg-white shadow-sm ring-1 ring-ccb-border">
                  <div className="border-b border-ccb-border bg-ccb-canvas/40 px-6 py-4">
                    <div className="flex items-center gap-2">
                      <BarChart3 className="size-4 text-ccb-blue" />
                      <h3 className="text-sm font-bold text-ccb-navy">Repairs Over Time</h3>
                    </div>
                    <p className="text-xs text-ccb-muted mt-1">Good vs rejected by day</p>
                  </div>
                  <div className="p-6">
                    <RepairsBarChart records={filtered} />
                  </div>
                </div>

                {/* Overall QC Split Chart */}
                <div className="w-[500px] overflow-hidden rounded-2xl bg-white shadow-sm ring-1 ring-ccb-border">
                  <div className="border-b border-ccb-border bg-ccb-canvas/40 px-6 py-4">
                    <div className="flex items-center gap-2">
                      <PieChart className="size-4 text-ccb-blue" />
                      <h3 className="text-sm font-bold text-ccb-navy">Overall QC Split</h3>
                    </div>
                    <p className="text-xs text-ccb-muted mt-1">Pass rate across all repairs</p>
                  </div>
                  <div className="p-6">
                    <QCDonutChart good={totals.good} rejected={totals.rejected} total={totals.repaired} />
                  </div>
                </div>
              </div>
            </section>

            {/* Problem Source Spotlight */}
            <section>
              <div className="flex items-center gap-2 mb-4">
                <Eye className="size-4 text-ccb-gold" />
                <h3 className="text-sm font-bold text-ccb-navy">Problem Source Spotlight</h3>
                <span className="text-xs text-ccb-muted">Highest reject rates in current view</span>
              </div>
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
              {getSourceRejectRates(filtered).slice(0, 4).map((item) => (
                  <SourceCard key={item.source} {...item} />
                ))}
              </div>
            </section>

            {/* Repair Log Table */}
            <section className="overflow-hidden rounded-2xl bg-white shadow-sm ring-1 ring-ccb-border">
              <div className="border-b border-ccb-border bg-ccb-canvas/40 px-6 py-4">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <h3 className="text-sm font-bold text-ccb-navy">Repair Log</h3>
                    <span className="rounded px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider bg-ccb-border text-ccb-muted">
                      {filtered.length} records
                    </span>
                  </div>
                </div>
              </div>
              <div className="overflow-x-auto">
                <table className="w-full min-w-[900px] border-collapse text-xs">
                  <thead>
                    <tr className="bg-ccb-canvas/60 border-b border-ccb-border">
                      <th className="px-5 py-3 text-left text-[10px] font-bold uppercase tracking-widest text-ccb-muted">ID</th>
                      <th className="px-4 py-3 text-left text-[10px] font-bold uppercase tracking-widest text-ccb-muted">Date</th>
                      <th className="px-4 py-3 text-left text-[10px] font-bold uppercase tracking-widest text-ccb-muted">Slot</th>
                      <th className="px-4 py-3 text-left text-[10px] font-bold uppercase tracking-widest text-ccb-muted">Source</th>
                      <th className="px-4 py-3 text-left text-[10px] font-bold uppercase tracking-widest text-ccb-muted">Installed To</th>
                      <th className="px-4 py-3 text-right text-[10px] font-bold uppercase tracking-widest text-ccb-muted">Repaired</th>
                      <th className="px-4 py-3 text-right text-[10px] font-bold uppercase tracking-widest text-ccb-muted">Good</th>
                      <th className="px-4 py-3 text-right text-[10px] font-bold uppercase tracking-widest text-ccb-muted">Rejected</th>
                      <th className="px-5 py-3 text-left text-[10px] font-bold uppercase tracking-widest text-ccb-muted w-[160px]">Reject Rate</th>
                      <th className="px-4 py-3 text-left text-[10px] font-bold uppercase tracking-widest text-ccb-muted">Remarks</th>
                    </tr>
                  </thead>
                  <tbody>
                    {filtered.length === 0 ? (
                      <tr>
                        <td colSpan={10} className="px-5 py-10 text-center text-ccb-muted">No records found.</td>
                      </tr>
                    ) : (
                      filtered.map((rec, idx) => {
                        const rate = rejectRate(rec.repaired, rec.rejected);
                        const highReject = rate > 15;
                        const timeSlotStyle = {
                          Morning:   "bg-ccb-blue/10 text-ccb-blue",
                          Midday:    "bg-ccb-gold/20 text-[#A07400]",
                          Afternoon: "bg-orange-100 text-orange-600",
                          Evening:   "bg-ccb-navy/10 text-ccb-navy",
                        }[rec.timeSlot] || "";
                        return (
                          <tr
                            key={rec.id}
                            className={[
                              "border-b border-ccb-border transition-all",
                              idx % 2 === 1 ? "bg-ccb-canvas/30" : "bg-white",
                            ].join(" ")}
                          >
                            <td className="px-5 py-3.5 font-mono text-[11px] font-bold text-ccb-muted-2">{rec.id}</td>
                            <td className="px-4 py-3.5 text-[12px] font-medium text-ccb-navy whitespace-nowrap">{rec.date}</td>
                            <td className="px-4 py-3.5">
                              <span className={`rounded-full px-2.5 py-0.5 text-[10px] font-bold uppercase tracking-wide ${timeSlotStyle}`}>
                                {rec.timeSlot}
                              </span>
                            </td>
                            <td className="px-4 py-3.5 text-[12px] font-bold text-ccb-navy">{rec.source}</td>
                            <td className="px-4 py-3.5 text-[12px] text-ccb-muted">{rec.installedTo}</td>
                            <td className="px-4 py-3.5 text-right text-[13px] font-extrabold text-ccb-navy tabular-nums">{rec.repaired}</td>
                            <td className="px-4 py-3.5 text-right text-[13px] font-bold text-[#1E7A4B] tabular-nums">{rec.good}</td>
                            <td className="px-4 py-3.5 text-right text-[13px] font-bold text-ccb-red tabular-nums">{rec.rejected}</td>
                            <td className="px-5 py-3.5 w-[160px]">
                              <div className="flex items-center gap-2">
                                <div className="flex-1 h-2 rounded-full bg-ccb-canvas overflow-hidden">
                                  <div
                                    className={`h-full rounded-full ${highReject ? "bg-ccb-red" : "bg-gradient-to-r from-ccb-blue to-[#4B5FCB]"}`}
                                    style={{ width: `${Math.min(rate, 100)}%` }}
                                  />
                                </div>
                                <span className={`text-[11px] font-bold tabular-nums w-10 text-right ${highReject ? "text-ccb-red" : "text-ccb-navy"}`}>
                                  {rate}%
                                </span>
                              </div>
                            </td>
                            <td className="px-4 py-3.5 text-[11px] text-ccb-muted max-w-[180px] truncate">{rec.remarks || "—"}</td>
                          </tr>
                        );
                      })
                    )}
                  </tbody>
                </table>
              </div>
            </section>
          </div>
        </div>
      </div>

      {/* Add Record Modal */}
      <AddRecordModal
        open={showModal}
        onOpenChange={setShowModal}
        onSave={(rec) => { handleAddRecord(rec); }}
      />
    </div>
  );
}

// ─── Dashboard KPI Card ─────────────────────────────────────────────────────
function DashboardKpi({ label, value, subtitle, color }: {
  label: string; value: string; subtitle: string; color: "blue" | "red";
}) {
  const styles = {
    blue: "bg-gradient-to-br from-ccb-blue to-[#1A2560]",
    red: "bg-gradient-to-br from-ccb-red to-[#8B2A1F]",
  }[color];
  return (
    <div className={`relative overflow-hidden rounded-2xl p-6 shadow-lg ${styles}`}>
      <div className="flex items-start justify-between">
        <div>
          <div className="text-[11px] font-semibold uppercase tracking-[0.16em] text-white/80">{label}</div>
          <div className="mt-3 text-[42px] font-extrabold leading-none text-white">{value}</div>
          <div className="mt-2 text-sm text-white/90 font-medium">{subtitle}</div>
        </div>
        <button className="rounded-lg bg-white/15 px-4 py-2 text-xs font-semibold text-white hover:bg-white/25 transition-colors border border-white/20">
          Watch
        </button>
      </div>
      <div className="pointer-events-none absolute -right-10 -bottom-10 h-40 w-40 rounded-full bg-white/5" />
    </div>
  );
}

// ─── Repairs Bar Chart ───────────────────────────────────────────────────────────
function RepairsBarChart({ records }: { records: OringRecord[] }) {
  const dailyData = useMemo(() => {
    const map = new Map<string, { good: number; rejected: number }>();
    records.forEach((r) => {
      const dateKey = r.date.slice(0, 10);
      const existing = map.get(dateKey) || { good: 0, rejected: 0 };
      map.set(dateKey, { good: existing.good + r.good, rejected: existing.rejected + r.rejected });
    });
    return Array.from(map.entries())
      .sort((a, b) => a[0].localeCompare(b[0]))
      .slice(-7);
  }, [records]);

  const maxVal = Math.max(...dailyData.map(([, d]) => d.good + d.rejected), 1);

  return (
    <div className="space-y-5">
      {dailyData.map(([date, data]) => {
        const goodPct = (data.good / maxVal) * 100;
        const rejectedPct = (data.rejected / maxVal) * 100;
        const d = new Date(date + "T00:00:00");
        const dayLabel = d.toLocaleDateString("en-US", { month: "short", day: "numeric" });
        return (
          <div key={date} className="space-y-2">
            <div className="flex items-center justify-between text-sm">
              <span className="font-semibold text-ccb-navy">{dayLabel}</span>
              <span className="text-ccb-muted">Good: {data.good} | Rejected: {data.rejected}</span>
            </div>
            <div className="flex h-10 gap-0.5 rounded-lg overflow-hidden bg-ccb-canvas">
              <div
                className="bg-[#1E7A4B] transition-all duration-500 rounded-l-lg"
                style={{ width: `${goodPct}%` }}
                title={`Good: ${data.good}`}
              />
              <div
                className="bg-ccb-red transition-all duration-500 rounded-r-lg"
                style={{ width: `${rejectedPct}%` }}
                title={`Rejected: ${data.rejected}`}
              />
            </div>
          </div>
        );
      })}
    </div>
  );
}

// ─── QC Donut Chart ─────────────────────────────────────────────────────────────
function QCDonutChart({ good, rejected, total }: { good: number; rejected: number; total: number }) {
  const passRate = total > 0 ? Math.round((good / total) * 1000) / 10 : 0;
  const circumference = 2 * Math.PI * 58;
  const goodOffset = circumference - (good / total) * circumference;

  return (
    <div className="flex items-center gap-8">
      <div className="relative size-40">
        <svg className="size-full -rotate-90" viewBox="0 0 130 130">
          <circle cx="65" cy="65" r="58" fill="none" stroke="#E5E8F4" strokeWidth="14" />
          <circle
            cx="65" cy="65" r="58"
            fill="none"
            stroke="#1E7A4B"
            strokeWidth="14"
            strokeLinecap="round"
            strokeDasharray={circumference}
            strokeDashoffset={goodOffset}
            className="transition-all duration-1000"
          />
        </svg>
        <div className="absolute inset-0 flex flex-col items-center justify-center">
          <div className="text-[26px] font-extrabold text-ccb-navy">{passRate}%</div>
          <div className="text-[10px] font-semibold uppercase tracking-wider text-ccb-muted">PASS RATE</div>
        </div>
      </div>
      <div className="space-y-4">
        <div className="flex items-center gap-4">
          <div className="size-4 rounded-full bg-[#1E7A4B]" />
          <div>
            <div className="text-sm font-semibold text-ccb-navy">Good</div>
            <div className="text-xl font-bold text-ccb-navy">{good}</div>
          </div>
        </div>
        <div className="flex items-center gap-4">
          <div className="size-4 rounded-full bg-ccb-red" />
          <div>
            <div className="text-sm font-semibold text-ccb-navy">Rejected</div>
            <div className="text-xl font-bold text-ccb-navy">{rejected}</div>
          </div>
        </div>
        <div className="pt-3 border-t border-ccb-border">
          <div className="text-xs text-ccb-muted">Total repaired</div>
          <div className="text-base font-bold text-ccb-navy">{total}</div>
        </div>
      </div>
    </div>
  );
}

// ─── Source Card ────────────────────────────────────────────────────────────────
function SourceCard({ source, good, rejected, rate }: {
  source: string; good: number; rejected: number; rate: number;
}) {
  const status = rate > 15 ? "High reject" : rate > 10 ? "Watch" : "Healthy";
  const statusColor = rate > 15 ? "text-ccb-red" : rate > 10 ? "text-ccb-gold" : "text-[#1E7A4B]";
  const statusBg = rate > 15 ? "bg-ccb-red/10" : rate > 10 ? "bg-ccb-gold/10" : "bg-[#1E7A4B]/10";

  return (
    <div className="overflow-hidden rounded-xl bg-white shadow-md ring-1 ring-ccb-border hover:shadow-lg transition-shadow">
      <div className={`px-4 py-2.5 ${statusBg}`}>
        <div className={`text-[11px] font-bold uppercase tracking-wider ${statusColor}`}>{status}</div>
      </div>
      <div className="p-5">
        <h4 className="text-base font-bold text-ccb-navy mb-4">{source}</h4>
        <div className="flex items-center justify-between">
          <div className="text-center">
            <div className="text-xs text-ccb-muted font-medium">Good</div>
            <div className="text-xl font-bold text-ccb-navy">{good}</div>
          </div>
          <div className="text-center">
            <div className="text-xs text-ccb-muted font-medium">Rejected</div>
            <div className="text-xl font-bold text-ccb-red">{rejected}</div>
          </div>
          <div className="text-center">
            <div className="text-xs text-ccb-muted font-medium">Rate</div>
            <div className={`text-xl font-bold ${statusColor}`}>{rate}%</div>
          </div>
        </div>
      </div>
    </div>
  );
}

// ─── Helper: Get Source Reject Rates ─────────────────────────────────────────────
function getSourceRejectRates(records: OringRecord[]) {
  const sourceMap = new Map<string, { good: number; rejected: number; repaired: number }>();
  records.forEach((r) => {
    const existing = sourceMap.get(r.source) || { good: 0, rejected: 0, repaired: 0 };
    sourceMap.set(r.source, {
      good: existing.good + r.good,
      rejected: existing.rejected + r.rejected,
      repaired: existing.repaired + r.repaired,
    });
  });
  return Array.from(sourceMap.entries())
    .map(([source, data]) => ({
      source,
      good: data.good,
      rejected: data.rejected,
      rate: rejectRate(data.repaired, data.rejected),
    }))
    .sort((a, b) => b.rate - a.rate);
}
