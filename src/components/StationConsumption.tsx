import React, { useMemo, useState } from "react";
import {
  LineChart, Line, XAxis, YAxis, Tooltip, ResponsiveContainer, Legend,
  PieChart, Pie, Cell, CartesianGrid,
} from "recharts";
import { useQuery } from "@tanstack/react-query";
import { Sidebar } from "./Sidebar";
import { AddConsumptionDialog, type Material } from "./AddConsumptionDialog";
import {
  getStationConsumptionRecordsFn,
  addStationConsumptionRecordFn,
  getMaterialsFromCurrentMonthFn,
} from "../lib/station-consumption-server-functions";
import { type StationConsumptionRecord, type MaterialItem } from "../lib/station-consumption-types";

type Record = {
  id: string;
  date: string;
  station: string;
  description: string;
  qty: number;
  uom: string;
  signature: string;
  unitPrice: number;
  monthKey: string;
};

const STATIONS = ["Hotworks", "Painting", "Cosmetics", "CTC"];
const MATERIALS = [
  { code: "CCB1001", name: "Cutting Disc (Sunrise) 4 Inch", uom: "PCS", price: 12, balance: 320 },
  { code: "CCB1002", name: "Grinding Disc (Sunrise) 4 Inch", uom: "PCS", price: 18, balance: 210 },
  { code: "CCB1003", name: "O-Ring 3/4", uom: "PCS", price: 5, balance: 540 },
  { code: "CCB1004", name: "CNF Pellets", uom: "KG", price: 42, balance: 88 },
  { code: "CCB1005", name: "Welding Rod E6013", uom: "PCS", price: 8, balance: 415 },
  { code: "CCB1006", name: "Sheet Metal 1.2mm", uom: "SHT", price: 320, balance: 26 },
];

// Convert StationConsumptionRecord to internal Record type
function convertToRecord(rec: StationConsumptionRecord, index: number): Record {
  const dateObj = new Date(rec.date);
  const monthKey = `${dateObj.getFullYear()}-${String(dateObj.getMonth() + 1).padStart(2, "0")}`;
  
  return {
    id: `${rec.date}-${index}`,
    date: rec.date,
    station: rec.station,
    description: rec.description,
    qty: rec.quantity,
    uom: rec.uom,
    signature: rec.signature,
    unitPrice: rec.unitCost,
    monthKey,
  };
}

const PHP = new Intl.NumberFormat("en-PH", {
  style: "currency",
  currency: "PHP",
  minimumFractionDigits: 2,
});

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

const PIE_COLORS = ["#1e3a8a", "#3b82f6", "#8b5cf6", "#f59e0b", "#ef4444"];

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

export default function StationConsumption() {
  const { data: sheetRecords = [], isLoading, refetch } = useQuery({
    queryKey: ["station-consumption-records"],
    queryFn: () => getStationConsumptionRecordsFn(),
  });

  const { data: materialItems = [] } = useQuery({
    queryKey: ["material-items"],
    queryFn: () => getMaterialsFromCurrentMonthFn(),
  });

  const records = useMemo(() => 
    sheetRecords.map((rec, idx) => convertToRecord(rec, idx)),
    [sheetRecords]
  );

  // Convert MaterialItem to Material type for dialog
  const materials: Material[] = useMemo(() =>
    materialItems.map((item) => ({
      code: item.code,
      name: item.description,
      uom: item.uom,
      price: item.price,
      balance: item.balance,
    })),
    [materialItems]
  );

  const [search, setSearch] = useState("");
  const [station, setStation] = useState<string>("all");
  const [month, setMonth] = useState<string>("all");
  const [page, setPage] = useState(1);
  const [addOpen, setAddOpen] = useState(false);
  const pageSize = 10;

  const months = useMemo(
    () => Array.from(new Set(records.map((r) => r.monthKey))).sort(),
    [records],
  );

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    return records.filter((r) => {
      if (station !== "all" && r.station !== station) return false;
      if (month !== "all" && r.monthKey !== month) return false;
      if (!q) return true;
      return (
        r.date.toLowerCase().includes(q) ||
        r.description.toLowerCase().includes(q) ||
        r.station.toLowerCase().includes(q) ||
        r.uom.toLowerCase().includes(q)
      );
    });
  }, [records, search, station, month]);

  const totalCost = filtered.reduce((s, r) => s + r.qty * r.unitPrice, 0);

  const byStation = useMemo(() => {
    const m = new Map<string, number>();
    filtered.forEach((r) => m.set(r.station, (m.get(r.station) ?? 0) + r.qty));
    return Array.from(m, ([station, qty]) => ({ station, qty }));
  }, [filtered]);

  // Line chart data: group by date with each station as a separate line
  const byDateByStation = useMemo(() => {
    const dateMap = new Map<string, any>();
    
    filtered.forEach((r) => {
      if (!dateMap.has(r.date)) {
        dateMap.set(r.date, { date: r.date, Hotworks: 0, Painting: 0, Cosmetics: 0, CTC: 0 });
      }
      const entry = dateMap.get(r.date)!;
      if (entry[r.station] !== undefined) {
        entry[r.station] += r.qty;
      }
    });
    
    return Array.from(dateMap.values()).sort((a, b) => a.date.localeCompare(b.date));
  }, [filtered]);

  const byMaterial = useMemo(() => {
    const m = new Map<string, number>();
    filtered.forEach((r) =>
      m.set(r.description, (m.get(r.description) ?? 0) + r.qty),
    );
    return Array.from(m, ([name, value]) => ({ name, value }))
      .sort((a, b) => b.value - a.value)
      .slice(0, 5);
  }, [filtered]);

  const topStation =
    byStation.slice().sort((a, b) => b.qty - a.qty)[0]?.station ?? "—";
  const topMaterial = byMaterial[0]?.name ?? "—";

  const totalPages = Math.max(1, Math.ceil(filtered.length / pageSize));
  const currentPage = Math.min(page, totalPages);
  const pageStart = (currentPage - 1) * pageSize;
  const pageRows = filtered.slice(pageStart, pageStart + pageSize);

  return (
    <div className="h-screen bg-ccb-canvas overflow-hidden">
      <div className="flex h-full bg-white">
        <Sidebar />
        <div className="flex-1 flex flex-col min-w-0 h-full overflow-hidden">
          {/* Header */}
          <div className="bg-white border-b border-ccb-border">
            <div className="flex items-center justify-between px-8 py-4">
              <div className="flex items-center gap-3">
                <span className="block h-[22px] w-[4px] rounded-sm bg-ccb-gold" />
                <div>
                  <h1 className="text-[18px] font-bold leading-tight text-ccb-navy">Station Consumption</h1>
                  <p className="text-[12px] text-ccb-muted">Track daily material consumption per station with cost analysis</p>
                </div>
              </div>
              <div className="flex items-center gap-4">
                <div className="text-[11px] uppercase tracking-widest text-ccb-muted">CCB Inventory Clerk</div>
                <div className="h-9 w-9 rounded-full bg-gradient-to-br from-ccb-blue to-ccb-navy text-white flex items-center justify-center text-[12px] font-bold">AB</div>
              </div>
            </div>
            <div className="h-[3px] bg-ccb-red" />
          </div>

          {/* Content */}
          <div className="flex-1 p-8 bg-ccb-canvas overflow-y-auto">
            {records.length === 0 ? (
              <div className="flex min-h-[400px] flex-col items-center justify-center rounded-xl border border-ccb-border bg-white text-center">
                <p className="text-sm font-medium text-ccb-navy">
                  No Station Consumption records found.
                </p>
                <p className="mt-1 text-xs text-ccb-muted">
                  Add consumption records to the Google Sheet to see data here.
                </p>
              </div>
            ) : (
              <div className="flex flex-col gap-6">
                {/* Toolbar */}
                <div className="flex flex-wrap items-center gap-3 rounded-xl border border-ccb-border bg-white p-4">
                  <div className="relative">
                    <svg className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-ccb-muted" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
                      <circle cx="11" cy="11" r="7" />
                      <line x1="21" y1="21" x2="16.65" y2="16.65" />
                    </svg>
                    <input
                      value={search}
                      onChange={(e) => {
                        setSearch(e.target.value);
                        setPage(1);
                      }}
                      placeholder="Search records..."
                      className="h-9 w-64 rounded-md border border-ccb-border bg-white pl-9 pr-3 text-sm text-ccb-navy placeholder:text-ccb-muted focus:outline-none focus:ring-1 focus:ring-ccb-blue"
                    />
                  </div>
                  <select
                    value={station}
                    onChange={(e) => {
                      setStation(e.target.value);
                      setPage(1);
                    }}
                    className="h-9 w-40 rounded-md border border-ccb-border bg-white px-3 text-sm text-ccb-navy focus:outline-none focus:ring-1 focus:ring-ccb-blue"
                  >
                    <option value="all">All Stations</option>
                    {STATIONS.map((s) => (
                      <option key={s} value={s}>{s}</option>
                    ))}
                  </select>
                  <select
                    value={month}
                    onChange={(e) => {
                      setMonth(e.target.value);
                      setPage(1);
                    }}
                    className="h-9 w-36 rounded-md border border-ccb-border bg-white px-3 text-sm text-ccb-navy focus:outline-none focus:ring-1 focus:ring-ccb-blue"
                  >
                    <option value="all">All Months</option>
                    {months.map((m) => (
                      <option key={m} value={m}>{m}</option>
                    ))}
                  </select>
                  <button
                    className="h-9 gap-1 rounded-md bg-ccb-blue px-3 text-sm font-medium text-white hover:bg-ccb-navy flex items-center"
                    onClick={() => setAddOpen(true)}
                  >
                    <svg className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
                      <line x1="12" y1="5" x2="12" y2="19" />
                      <line x1="5" y1="12" x2="19" y2="12" />
                    </svg>
                    Add
                  </button>
                  <AddConsumptionDialog
                    open={addOpen}
                    onOpenChange={setAddOpen}
                    materials={materials}
                    onCheckout={async (records) => {
                      for (const rec of records) {
                        const stationRecord: StationConsumptionRecord = {
                          date: rec.date,
                          station: rec.station,
                          materialCode: rec.materialCode,
                          description: rec.description,
                          quantity: rec.qty,
                          uom: rec.uom,
                          unitCost: rec.unitPrice,
                          totalCost: rec.qty * rec.unitPrice,
                          signature: rec.signature,
                        };
                        await addStationConsumptionRecordFn({ data: stationRecord });
                      }
                      refetch();
                      setAddOpen(false);
                    }}
                  />
                  <button
                    className="h-9 w-9 rounded-md border border-ccb-border bg-white text-ccb-muted hover:bg-ccb-canvas flex items-center justify-center"
                    onClick={() => refetch()}
                    title="Refresh"
                  >
                    <svg className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
                      <path d="M23 4v6h-6" />
                      <path d="M1 20v-6h6" />
                      <path d="M3.51 9a9 9 0 0 1 14.85-3.36L23 10M1 14l4.64 4.36A9 9 0 0 0 20.49 15" />
                    </svg>
                  </button>
                </div>

                {/* At a glance */}
                <section>
                  <div className="flex items-center gap-2">
                    <svg className="h-3.5 w-3.5 text-ccb-gold" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
                      <rect x="3" y="3" width="18" height="18" rx="2" />
                      <path d="M3 9h18" />
                      <path d="M9 21V9" />
                    </svg>
                    <h2 className="text-[11px] font-semibold uppercase tracking-[0.12em] text-ccb-muted">
                      AT A GLANCE — STATION CONSUMPTION
                    </h2>
                  </div>
                  <div className="mt-3 grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
                    <CnfKpi variant="shade1" label="Total Cost" value={PHP.format(totalCost)} />
                    <CnfKpi variant="shade2" label="Top Station" value={topStation} />
                    <CnfKpi variant="shade3" label="Top Material" value={topMaterial} />
                    <CnfKpi variant="shade4" label="Total Records" value={filtered.length.toLocaleString()} />
                  </div>
                </section>

                {/* Charts */}
                <section>
                  <div className="flex items-center gap-2">
                    <svg className="h-3.5 w-3.5 text-ccb-gold" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
                      <rect x="3" y="3" width="18" height="18" rx="2" />
                      <path d="M3 9h18" />
                      <path d="M9 21V9" />
                    </svg>
                    <h2 className="text-[11px] font-semibold uppercase tracking-[0.12em] text-ccb-muted">
                      COST ANALYSIS — BY STATION AND MATERIAL
                    </h2>
                  </div>
                  <div className="mt-3 grid grid-cols-1 gap-4 lg:grid-cols-2">
                    <ChartCard
                      title="Quantity by Station Over Time"
                      subtitle="Daily material quantity per station"
                    >
                      <ResponsiveContainer width="100%" height={260}>
                        <LineChart
                          data={byDateByStation}
                          margin={{ top: 8, right: 12, left: 0, bottom: 0 }}
                        >
                          <CartesianGrid
                            strokeDasharray="3 3"
                            stroke={COLORS.navyTint}
                            vertical={false}
                          />
                          <XAxis
                            dataKey="date"
                            tick={{ fontSize: 12, fill: COLORS.faint }}
                            axisLine={{ stroke: COLORS.navyTint }}
                            tickLine={false}
                          />
                          <YAxis
                            tick={{ fontSize: 12, fill: COLORS.faint }}
                            axisLine={{ stroke: COLORS.navyTint }}
                            tickLine={false}
                          />
                          <Tooltip
                            cursor={{ fill: "rgba(30,58,138,0.05)" }}
                            contentStyle={{
                              borderRadius: 8,
                              border: "1px solid " + COLORS.navyTint,
                              fontSize: 12,
                              backgroundColor: COLORS.navy,
                              color: "#fff",
                            }}
                          />
                          <Legend />
                          <Line type="monotone" dataKey="Hotworks" stroke={COLORS.navy} strokeWidth={2} dot={{ r: 4 }} />
                          <Line type="monotone" dataKey="Painting" stroke={COLORS.gold} strokeWidth={2} dot={{ r: 4 }} />
                          <Line type="monotone" dataKey="Cosmetics" stroke={COLORS.good} strokeWidth={2} dot={{ r: 4 }} />
                          <Line type="monotone" dataKey="CTC" stroke={COLORS.warning} strokeWidth={2} dot={{ r: 4 }} />
                        </LineChart>
                      </ResponsiveContainer>
                    </ChartCard>

                    <ChartCard
                      title="Top Materials by Quantity"
                      subtitle="Top 5 most used materials"
                    >
                      <ResponsiveContainer width="100%" height={260}>
                        <PieChart>
                          <Tooltip
                            contentStyle={{
                              borderRadius: 8,
                              border: "1px solid " + COLORS.navyTint,
                              fontSize: 12,
                              backgroundColor: COLORS.navy,
                              color: "#fff",
                            }}
                          />
                          <Pie
                            data={byMaterial}
                            dataKey="value"
                            nameKey="name"
                            innerRadius={50}
                            outerRadius={95}
                            paddingAngle={2}
                          >
                            {byMaterial.map((_, i) => (
                              <Cell
                                key={i}
                                fill={PIE_COLORS[i % PIE_COLORS.length]}
                              />
                            ))}
                          </Pie>
                        </PieChart>
                      </ResponsiveContainer>
                    </ChartCard>
                  </div>
                </section>

                {/* Log */}
                <section>
                  <div className="flex items-center gap-2">
                    <svg className="h-3.5 w-3.5 text-ccb-gold" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
                      <rect x="3" y="3" width="18" height="18" rx="2" />
                      <path d="M3 9h18" />
                      <path d="M9 21V9" />
                    </svg>
                    <h2 className="text-[11px] font-semibold uppercase tracking-[0.12em] text-ccb-muted">
                      FULL CONSUMPTION LOG
                    </h2>
                  </div>
                  <div className="mt-3 rounded-xl border border-ccb-border bg-white p-5">
                    <div className="mb-4">
                      <h3 className="text-base font-semibold text-ccb-navy">
                        Consumption Log
                      </h3>
                      <p className="text-xs text-ccb-muted">
                        Daily material consumption records per station
                      </p>
                    </div>

                    <div className="grid grid-cols-[110px_140px_1fr_80px_80px_120px] items-center gap-3 rounded-md bg-ccb-canvas px-4 py-2.5 text-[11px] font-semibold uppercase tracking-wider text-ccb-muted">
                      <div>Date</div>
                      <div>Station</div>
                      <div>Description</div>
                      <div className="text-right">Qty</div>
                      <div>UOM</div>
                      <div>Signature</div>
                    </div>

                    <div className="mt-1">
                      {pageRows.length === 0 ? (
                        <div className="py-10 text-center text-sm text-ccb-muted">
                          No records match your filters.
                        </div>
                      ) : (
                        pageRows.map((r) => (
                          <div
                            key={r.id}
                            className="grid grid-cols-[110px_140px_1fr_80px_80px_120px] items-center gap-3 border-b border-ccb-border px-4 py-2.5 text-sm text-ccb-navy transition-colors last:border-0 hover:bg-ccb-canvas/70"
                          >
                            <div className="text-ccb-muted">{r.date}</div>
                            <div className="font-medium">{r.station}</div>
                            <div className="truncate">{r.description}</div>
                            <div className="text-right font-medium tabular-nums">
                              {r.qty}
                            </div>
                            <div className="text-ccb-muted">{r.uom}</div>
                            <div className="text-ccb-muted">{r.signature}</div>
                          </div>
                        ))
                      )}
                    </div>

                    <div className="mt-4 flex items-center justify-between">
                      <p className="text-xs text-ccb-muted">
                        {filtered.length === 0
                          ? "Showing 0 of 0 records"
                          : `Showing ${pageStart + 1}-${Math.min(pageStart + pageSize, filtered.length)} of ${filtered.length} records`}
                      </p>
                      <div className="flex items-center gap-1">
                        <button
                          className="h-8 w-8 rounded-md border border-ccb-border bg-white text-ccb-muted hover:bg-ccb-canvas flex items-center justify-center disabled:opacity-50"
                          disabled={currentPage <= 1}
                          onClick={() => setPage((p) => Math.max(1, p - 1))}
                        >
                          <svg className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
                            <polyline points="15 18 9 12 15 6" />
                          </svg>
                        </button>
                        <span className="px-2 text-xs text-ccb-muted">
                          {currentPage} / {totalPages}
                        </span>
                        <button
                          className="h-8 w-8 rounded-md border border-ccb-border bg-white text-ccb-muted hover:bg-ccb-canvas flex items-center justify-center disabled:opacity-50"
                          disabled={currentPage >= totalPages}
                          onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
                        >
                          <svg className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
                            <polyline points="9 18 15 12 9 6" />
                          </svg>
                        </button>
                      </div>
                    </div>
                  </div>
                </section>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

function StatCard({
  accent,
  label,
  value,
  context,
  badge,
  truncate,
}: {
  accent: string;
  label: string;
  value: string;
  context: string;
  badge: string;
  truncate?: boolean;
}) {
  return (
    <div className="relative overflow-hidden rounded-xl border border-ccb-border bg-white p-4">
      <div
        className="absolute inset-x-0 top-0 h-[3px]"
        style={{ backgroundColor: accent }}
      />
      <p className="text-[11px] font-semibold uppercase tracking-wider text-ccb-muted">
        {label}
      </p>
      <p
        className={`mt-2 text-xl font-bold text-ccb-navy ${truncate ? "truncate" : ""}`}
        title={truncate ? value : undefined}
      >
        {value}
      </p>
      <p className="mt-1 text-xs text-ccb-muted">{context}</p>
      <span
        className="mt-3 inline-flex rounded-full px-2 py-0.5 text-[10px] font-medium"
        style={{
          backgroundColor: `${accent}15`,
          color: accent,
        }}
      >
        {badge}
      </span>
    </div>
  );
}

function ChartCard({
  title,
  subtitle,
  children,
}: {
  title: string;
  subtitle: string;
  children: React.ReactNode;
}) {
  return (
    <div className="rounded-xl border border-ccb-border bg-white p-5">
      <h3 className="text-sm font-semibold text-ccb-navy">{title}</h3>
      <p className="text-xs text-ccb-muted">{subtitle}</p>
      <div className="mt-4">{children}</div>
    </div>
  );
}
