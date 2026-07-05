import { createFileRoute } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  Tooltip,
  ResponsiveContainer,
  PieChart,
  Pie,
  Cell,
  CartesianGrid,
} from "recharts";
import {
  Search,
  RefreshCw,
  Plus,
  ChevronLeft,
  ChevronRight,
  BarChart3,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { AddConsumptionDialog, type Material } from "@/components/station-consumption/AddConsumptionDialog";

export const Route = createFileRoute("/station-consumption")({
  head: () => ({
    meta: [
      { title: "Station Consumption — CCB Inventory" },
      {
        name: "description",
        content:
          "Track daily material consumption per station with cost analysis and full logs.",
      },
    ],
  }),
  component: StationConsumptionPage,
});

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

const STATIONS = ["Station A", "Station B", "Station C", "Station D"];
const MATERIALS = [
  { code: "CCB1001", name: "Cutting Disc (Sunrise) 4 Inch", uom: "PCS", price: 12, balance: 320 },
  { code: "CCB1002", name: "Grinding Disc (Sunrise) 4 Inch", uom: "PCS", price: 18, balance: 210 },
  { code: "CCB1003", name: "O-Ring 3/4", uom: "PCS", price: 5, balance: 540 },
  { code: "CCB1004", name: "CNF Pellets", uom: "KG", price: 42, balance: 88 },
  { code: "CCB1005", name: "Welding Rod E6013", uom: "PCS", price: 8, balance: 415 },
  { code: "CCB1006", name: "Sheet Metal 1.2mm", uom: "SHT", price: 320, balance: 26 },
];

function seedRecords(): Record[] {
  const out: Record[] = [];
  const months = ["2026-01", "2026-02", "2026-03", "2026-04", "2026-05"];
  let i = 0;
  for (const m of months) {
    for (let d = 0; d < 9; d++) {
      const mat = MATERIALS[(i + d) % MATERIALS.length];
      const st = STATIONS[(i + d) % STATIONS.length];
      const day = String((d * 3 + 1) % 28 || 1).padStart(2, "0");
      out.push({
        id: `${m}-${d}-${i}`,
        date: `${m}-${day}`,
        station: st,
        description: mat.name,
        qty: 5 + ((i * 7 + d * 3) % 40),
        uom: mat.uom,
        signature: ["ABR", "JMD", "RPT", "LSC"][(i + d) % 4],
        unitPrice: mat.price,
        monthKey: m,
      });
      i++;
    }
  }
  return out;
}

const PHP = new Intl.NumberFormat("en-PH", {
  style: "currency",
  currency: "PHP",
  minimumFractionDigits: 2,
});

function StationConsumptionPage() {
  const [records, setRecords] = useState<Record[]>(() => seedRecords());
  const [status] = useState<"loading" | "error" | "ready">("ready");
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

  const PIE_COLORS = ["#1e3a8a", "#3b82f6", "#8b5cf6", "#f59e0b", "#ef4444"];

  return (
    <div className="min-h-screen bg-[#f5f6fa]">
      {/* Toolbar */}
      <div className="flex flex-wrap items-center gap-3 border-b border-slate-200 bg-white px-6 py-4">
        <div className="flex items-center gap-3">
          <span className="h-6 w-1.5 rounded-sm bg-[#8b5cf6]" />
          <h1 className="text-lg font-semibold text-[#1e293b]">
            Station Material Consumption
          </h1>
        </div>
        <div className="ml-auto flex flex-wrap items-center gap-2">
          <div className="relative">
            <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
            <Input
              value={search}
              onChange={(e) => {
                setSearch(e.target.value);
                setPage(1);
              }}
              placeholder="Search records..."
              className="h-9 w-64 rounded-md border-slate-200 pl-9 text-sm"
            />
          </div>
          <Select
            value={station}
            onValueChange={(v) => {
              setStation(v);
              setPage(1);
            }}
          >
            <SelectTrigger className="h-9 w-40 rounded-md border-slate-200 text-sm">
              <SelectValue placeholder="All Stations" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Stations</SelectItem>
              {STATIONS.map((s) => (
                <SelectItem key={s} value={s}>
                  {s}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Select
            value={month}
            onValueChange={(v) => {
              setMonth(v);
              setPage(1);
            }}
          >
            <SelectTrigger className="h-9 w-36 rounded-md border-slate-200 text-sm">
              <SelectValue placeholder="All Months" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Months</SelectItem>
              {months.map((m) => (
                <SelectItem key={m} value={m}>
                  {m}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Button
            className="h-9 gap-1 rounded-md bg-[#1e3a8a] px-3 text-sm font-medium text-white hover:bg-[#1e40af]"
            onClick={() => setAddOpen(true)}
          >
            <Plus className="h-4 w-4" />
            Add
          </Button>
          <AddConsumptionDialog
            open={addOpen}
            onOpenChange={setAddOpen}
            materials={MATERIALS as Material[]}
            onAdd={(rec) => {
              setRecords((prev) => [rec, ...prev]);
              setAddOpen(false);
            }}
          />

          <Button
            variant="outline"
            size="icon"
            className="h-9 w-9 rounded-md border-slate-200"
            onClick={() => setRecords(seedRecords())}
            aria-label="Refresh"
          >
            <RefreshCw className="h-4 w-4 text-slate-600" />
          </Button>
        </div>
      </div>

      {/* Body */}
      <div className="px-6 py-6">
        {status === "loading" ? (
          <CenterState>
            <div className="flex flex-col items-center gap-3">
              <div className="h-8 w-8 animate-spin rounded-full border-2 border-slate-300 border-t-[#1e3a8a]" />
              <p className="text-sm text-slate-600">
                Loading Station Consumption data...
              </p>
            </div>
          </CenterState>
        ) : status === "error" ? (
          <CenterState>
            <p className="text-sm text-slate-700">
              Unable to load Station Consumption data.
            </p>
            <Button className="mt-4 bg-[#1e3a8a] text-white hover:bg-[#1e40af]">
              Retry
            </Button>
          </CenterState>
        ) : records.length === 0 ? (
          <CenterState>
            <p className="text-sm font-medium text-slate-700">
              No Station Consumption records found.
            </p>
            <p className="mt-1 text-xs text-slate-500">
              Add consumption records to the Google Sheet to see data here.
            </p>
          </CenterState>
        ) : (
          <div className="flex flex-col gap-6">
            {/* At a glance */}
            <section>
              <SectionLabel>AT A GLANCE — STATION CONSUMPTION</SectionLabel>
              <div className="mt-3 grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
                <StatCard
                  accent="#1e3a8a"
                  label="TOTAL COST"
                  value={PHP.format(totalCost)}
                  context="overall consumption value"
                  badge="All stations"
                />
                <StatCard
                  accent="#3b82f6"
                  label="TOP STATION"
                  value={topStation}
                  context="highest consumption"
                  badge="Most active"
                />
                <StatCard
                  accent="#8b5cf6"
                  label="TOP MATERIAL"
                  value={topMaterial}
                  context="most used material"
                  badge="Highest usage"
                  truncate
                />
                <StatCard
                  accent="#f59e0b"
                  label="TOTAL RECORDS"
                  value={filtered.length.toLocaleString()}
                  context="consumption entries"
                  badge="All time"
                />
              </div>
            </section>

            {/* Charts */}
            <section>
              <SectionLabel>
                COST ANALYSIS — BY STATION AND MATERIAL
              </SectionLabel>
              <div className="mt-3 grid grid-cols-1 gap-4 lg:grid-cols-2">
                <ChartCard
                  title="Quantity by Station"
                  subtitle="Total material quantity per station"
                >
                  <ResponsiveContainer width="100%" height={260}>
                    <BarChart
                      data={byStation}
                      margin={{ top: 8, right: 12, left: 0, bottom: 0 }}
                    >
                      <CartesianGrid
                        strokeDasharray="3 3"
                        stroke="#e2e8f0"
                        vertical={false}
                      />
                      <XAxis
                        dataKey="station"
                        tick={{ fontSize: 12, fill: "#64748b" }}
                        axisLine={{ stroke: "#e2e8f0" }}
                        tickLine={false}
                      />
                      <YAxis
                        tick={{ fontSize: 12, fill: "#64748b" }}
                        axisLine={{ stroke: "#e2e8f0" }}
                        tickLine={false}
                      />
                      <Tooltip
                        cursor={{ fill: "rgba(30,58,138,0.05)" }}
                        contentStyle={{
                          borderRadius: 8,
                          border: "1px solid #e2e8f0",
                          fontSize: 12,
                        }}
                      />
                      <Bar
                        dataKey="qty"
                        fill="#1e3a8a"
                        radius={[6, 6, 0, 0]}
                        maxBarSize={44}
                      />
                    </BarChart>
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
                          border: "1px solid #e2e8f0",
                          fontSize: 12,
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
              <SectionLabel>FULL CONSUMPTION LOG</SectionLabel>
              <div className="mt-3 rounded-xl border border-slate-200 bg-white p-5">
                <div className="mb-4">
                  <h3 className="text-base font-semibold text-[#1e293b]">
                    Consumption Log
                  </h3>
                  <p className="text-xs text-slate-500">
                    Daily material consumption records per station
                  </p>
                </div>

                <div className="grid grid-cols-[110px_140px_1fr_80px_80px_120px] items-center gap-3 rounded-md bg-slate-50 px-4 py-2.5 text-[11px] font-semibold uppercase tracking-wider text-slate-500">
                  <div>Date</div>
                  <div>Station</div>
                  <div>Description</div>
                  <div className="text-right">Qty</div>
                  <div>UOM</div>
                  <div>Signature</div>
                </div>

                <div className="mt-1">
                  {pageRows.length === 0 ? (
                    <div className="py-10 text-center text-sm text-slate-500">
                      No records match your filters.
                    </div>
                  ) : (
                    pageRows.map((r) => (
                      <div
                        key={r.id}
                        className="grid grid-cols-[110px_140px_1fr_80px_80px_120px] items-center gap-3 border-b border-slate-100 px-4 py-2.5 text-sm text-[#1e293b] transition-colors last:border-0 hover:bg-slate-50/70"
                      >
                        <div className="text-slate-600">{r.date}</div>
                        <div className="font-medium">{r.station}</div>
                        <div className="truncate">{r.description}</div>
                        <div className="text-right font-medium tabular-nums">
                          {r.qty}
                        </div>
                        <div className="text-slate-600">{r.uom}</div>
                        <div className="text-slate-600">{r.signature}</div>
                      </div>
                    ))
                  )}
                </div>

                <div className="mt-4 flex items-center justify-between">
                  <p className="text-xs text-slate-500">
                    {filtered.length === 0
                      ? "Showing 0 of 0 records"
                      : `Showing ${pageStart + 1}-${Math.min(pageStart + pageSize, filtered.length)} of ${filtered.length} records`}
                  </p>
                  <div className="flex items-center gap-1">
                    <Button
                      variant="outline"
                      size="icon"
                      className="h-8 w-8 border-slate-200"
                      disabled={currentPage <= 1}
                      onClick={() => setPage((p) => Math.max(1, p - 1))}
                      aria-label="Previous page"
                    >
                      <ChevronLeft className="h-4 w-4" />
                    </Button>
                    <span className="px-2 text-xs text-slate-600">
                      {currentPage} / {totalPages}
                    </span>
                    <Button
                      variant="outline"
                      size="icon"
                      className="h-8 w-8 border-slate-200"
                      disabled={currentPage >= totalPages}
                      onClick={() =>
                        setPage((p) => Math.min(totalPages, p + 1))
                      }
                      aria-label="Next page"
                    >
                      <ChevronRight className="h-4 w-4" />
                    </Button>
                  </div>
                </div>
              </div>
            </section>
          </div>
        )}
      </div>
    </div>
  );
}

function SectionLabel({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex items-center gap-2">
      <BarChart3 className="h-3.5 w-3.5 text-[#8b5cf6]" />
      <h2 className="text-[11px] font-semibold uppercase tracking-[0.12em] text-slate-500">
        {children}
      </h2>
    </div>
  );
}

function CenterState({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex min-h-[400px] flex-col items-center justify-center rounded-xl border border-slate-200 bg-white text-center">
      {children}
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
    <div className="relative overflow-hidden rounded-xl border border-slate-200 bg-white p-4">
      <div
        className="absolute inset-x-0 top-0 h-[3px]"
        style={{ backgroundColor: accent }}
      />
      <p className="text-[11px] font-semibold uppercase tracking-wider text-slate-500">
        {label}
      </p>
      <p
        className={`mt-2 text-xl font-bold text-[#1e293b] ${truncate ? "truncate" : ""}`}
        title={truncate ? value : undefined}
      >
        {value}
      </p>
      <p className="mt-1 text-xs text-slate-500">{context}</p>
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
    <div className="rounded-xl border border-slate-200 bg-white p-5">
      <h3 className="text-sm font-semibold text-[#1e293b]">{title}</h3>
      <p className="text-xs text-slate-500">{subtitle}</p>
      <div className="mt-4">{children}</div>
    </div>
  );
}

