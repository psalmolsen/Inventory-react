import { createFileRoute } from "@tanstack/react-router";
import { useMemo, useState, useEffect, useRef } from "react";
import { useQuery, useQueryClient, useQueries } from "@tanstack/react-query";
import {
  getTabsFn,
  getMaterialsFn,
  stockInFn,
  stockOutFn,
  editMaterialFn,
  addMaterialFn,
  provisionCurrentMonthFn,
} from "../lib/server-functions";
import {
  Search,
  Plus,
  MoreVertical,
  X,
  ChevronDown,
  Minus,
  BarChart3,
  Upload,
} from "lucide-react";
import { Sidebar } from "../components/Sidebar";

export const Route = createFileRoute("/")({
  component: MaterialMonitoring,
});

/* ---------------- Types ---------------- */

type Material = {
  rowNumber: number;
  date: string;
  code: string;
  desc: string;
  uom: string;
  price: number | null;
  initial: number;
  received: number;
  balance: number;
  issued: number;
  dailyOut: number[];
  tabName: string;
  tone: string;
  initials: string;
};

const RANGE_LABEL: Record<string, string> = {
  All: "ALL TIME VALUE",
  Weekly: "THIS WEEK VALUE",
  Monthly: "THIS MONTH VALUE",
  Quarterly: "THIS QUARTER VALUE",
  Yearly: "THIS YEAR VALUE",
};

// Calculate date range based on selected filter
function getDateRange(range: keyof typeof RANGE_LABEL): { start: Date; end: Date } {
  const now = new Date();
  const end = new Date(now);
  end.setHours(23, 59, 59, 999);
  
  const start = new Date(now);
  start.setHours(0, 0, 0, 0);

  switch (range) {
    case "All":
      // Show all data - start from a very early date
      start.setFullYear(2000, 0, 1);
      break;
    case "Weekly":
      // Start from Monday of current week
      const dayOfWeek = now.getDay();
      const daysFromMonday = dayOfWeek === 0 ? 6 : dayOfWeek - 1; // Sunday = 0, Monday = 1
      start.setDate(now.getDate() - daysFromMonday);
      break;
    case "Monthly":
      // Start from 1st day of current month
      start.setDate(1);
      break;
    case "Quarterly":
      // Start from 1st day of current quarter
      const currentMonth = now.getMonth();
      const quarterStartMonth = Math.floor(currentMonth / 3) * 3;
      start.setMonth(quarterStartMonth, 1);
      break;
    case "Yearly":
      // Start from Jan 1st of current year
      start.setMonth(0, 1);
      break;
  }

  return { start, end };
}

// Filter dailyOut array based on date range
function filterDailyOutByRange(dailyOut: number[], range: keyof typeof RANGE_LABEL): number {
  const { start, end } = getDateRange(range);
  
  // dailyOut is indexed by day of month (1-31)
  // We need to sum values for days within the date range
  let total = 0;
  
  const startDay = start.getDate();
  const endDay = end.getDate();
  const startMonth = start.getMonth();
  const endMonth = end.getMonth();
  const startYear = start.getFullYear();
  const endYear = end.getFullYear();
  
  // For simplicity, we'll assume dailyOut is for the current month
  // A more complete implementation would need to handle multi-month ranges
  for (let i = 0; i < dailyOut.length; i++) {
    const day = i + 1; // dailyOut is 0-indexed, days are 1-indexed
    const currentDate = new Date(startYear, startMonth, day);
    
    if (currentDate >= start && currentDate <= end) {
      total += dailyOut[i] || 0;
    }
  }
  
  return total;
}

const peso = (n: number | null) =>
  n === null ? "N/A" : `₱ ${n.toLocaleString("en-PH", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;

const fmt = (n: number) => n.toLocaleString("en-PH");

/* ---------------- Small primitives ---------------- */

function TitleBar({ title, subtitle }: { title: string; subtitle?: string }) {
  return (
    <div className="flex items-center gap-3">
      <div>
        <h1 className="text-[18px] font-bold leading-tight text-ccb-navy">{title}</h1>
        {subtitle ? <p className="text-[12px] text-ccb-muted">{subtitle}</p> : null}
      </div>
    </div>
  );
}

function Thumb({
  initials,
  tone,
  size = 64,
  code,
}: {
  initials: string;
  tone: string;
  size?: number;
  code?: string;
}) {
  // Try extensions in order: jpg → png → jpeg (mirrors JavaFX resolveImageFile)
  const EXTS = ["jpg", "png", "jpeg"];
  const [extIdx, setExtIdx] = useState(0);
  const showImage = code && extIdx < EXTS.length;

  if (showImage) {
    return (
      <div
        style={{ width: size, height: size }}
        className="shrink-0 rounded-2xl border border-[#DBE1F4] shadow-inner overflow-hidden bg-ccb-canvas"
      >
        <img
          src={`/material-icons/${encodeURIComponent(code)}.${EXTS[extIdx]}`}
          alt={code}
          style={{ width: size, height: size, objectFit: "cover" }}
          onError={() => setExtIdx((i) => i + 1)}
        />
      </div>
    );
  }

  return (
    <div
      style={{ width: size, height: size }}
      className={`shrink-0 rounded-2xl bg-gradient-to-br ${tone} flex items-center justify-center border border-[#DBE1F4] shadow-inner`}
    >
      <span className="font-bold text-white tracking-wide" style={{ fontSize: size * 0.34 }}>
        {initials}
      </span>
    </div>
  );
}

function Kpi({
  label,
  value,
  unit,
  variant,
}: {
  label: string;
  value: string;
  unit?: string;
  variant: "blue" | "yellow" | "blue2" | "blue3" | "navy" | "gold";
}) {
  const styles = {
    blue:   "bg-[#2E3EA8] text-white",
    blue3:  "bg-[#273690] text-white",
    blue2:  "bg-[#202D78] text-white",
    navy:   "bg-[#1A2560] text-white",
    yellow: "bg-ccb-yellow text-ccb-navy",
    gold:   "bg-gradient-to-br from-[#C8861A] to-[#E9B52D] text-white",
  }[variant];
  const labelColor = (variant === "yellow") ? "text-ccb-navy/70" : "text-white/70";
  const unitColor  = (variant === "yellow") ? "text-ccb-navy/80" : "text-white/80";

  return (
    <div className={`relative overflow-hidden rounded-2xl p-5 shadow-sm ${styles}`}>
      <div className={`text-[10px] font-semibold uppercase tracking-[0.16em] ${labelColor}`}>{label}</div>
      <div className="mt-3 flex items-baseline gap-2">
        <div className="text-[30px] font-extrabold leading-none">{value}</div>
        {unit ? <div className={`text-[12px] font-semibold uppercase tracking-widest ${unitColor}`}>{unit}</div> : null}
      </div>
      <div className="pointer-events-none absolute -right-6 -bottom-6 h-24 w-24 rounded-full bg-white/5" />
    </div>
  );
}

/* ---------------- Sidebar & Topbar ---------------- */

function TopBar({ children }: { children?: React.ReactNode }) {
  return (
    <div className="bg-white border-b border-ccb-border">
      <div className="flex items-center justify-between px-8 py-4">
        <TitleBar title="Material Monitoring" subtitle="Track stock levels, pricing, and sheet-synced materials" />
        <div className="flex items-center gap-4">
          <div className="text-[11px] uppercase tracking-widest text-ccb-muted">CCB Inventory Clerk</div>
          <div className="h-9 w-9 rounded-full bg-gradient-to-br from-ccb-blue to-ccb-navy text-white flex items-center justify-center text-[12px] font-bold">
            AB
          </div>
        </div>
      </div>
      <div className="h-[3px] bg-ccb-red" />
      {children}
    </div>
  );
}

/* ---------------- Material Card ---------------- */

function MaterialCard({
  m,
  selected,
  onSelect,
  onEllipsis,
  onStockIn,
  onStockOut,
  rangeLabel,
  range,
}: {
  m: Material;
  selected: boolean;
  onSelect: () => void;
  onEllipsis: (e: React.MouseEvent) => void;
  onStockIn: () => void;
  onStockOut: () => void;
  rangeLabel: string;
  range: keyof typeof RANGE_LABEL;
}) {
  const filteredIssued = filterDailyOutByRange(m.dailyOut, range);
  const monthValue = m.price === null ? null : m.price * filteredIssued;

  return (
    <div
      onClick={onSelect}
      className={`group relative flex items-center gap-5 rounded-2xl border p-5 transition-all cursor-pointer z-10 ${
        selected
          ? "border-ccb-gold bg-[#FFF8D6] shadow-[0_4px_0_rgba(233,181,45,0.5),0_12px_32px_-10px_rgba(26,37,96,0.3)]"
          : "border-[#E2E8FB] bg-white hover:border-ccb-gold/60 hover:bg-[#FFFBEA] hover:shadow-lg shadow-sm"
      }`}
    >
      <Thumb initials={m.initials} tone={m.tone} code={m.code} />

      <div className="min-w-0 flex-1">
        <div className="text-[15px] font-bold text-ccb-navy leading-tight truncate">{m.desc}</div>
        <div className="mt-1 flex items-center gap-3 text-[11px] uppercase tracking-[0.14em] text-ccb-muted-2">
          <span className="font-semibold">{m.code}</span>
        </div>
      </div>

      <div className="flex items-center gap-2">
        <button
          onClick={(e) => { e.stopPropagation(); onStockIn(); }}
          className="rounded-full border border-ccb-border px-3.5 py-1.5 text-[11.5px] font-semibold text-ccb-navy hover:border-ccb-blue hover:text-ccb-blue transition-colors"
        >
          Stock In +
        </button>
        <button
          onClick={(e) => { e.stopPropagation(); onStockOut(); }}
          className="rounded-full border border-ccb-border px-3.5 py-1.5 text-[11.5px] font-semibold text-ccb-navy hover:border-ccb-red hover:text-ccb-red transition-colors"
        >
          Stock Out −
        </button>
        <button
          onClick={(e) => { e.stopPropagation(); onEllipsis(e); }}
          className="ml-1 rounded-full p-2 text-ccb-muted-2 hover:bg-ccb-canvas hover:text-ccb-navy transition-colors"
        >
          <MoreVertical size={18} />
        </button>
      </div>

      <div className="mx-1 h-14 w-px bg-ccb-border" />

      <div className="min-w-[150px] text-right">
        <div className="text-[9.5px] font-semibold uppercase tracking-[0.16em] text-ccb-muted-2">Unit Price</div>
        <div className="text-[15px] font-bold text-ccb-navy">{peso(m.price)}</div>
        <div className="mt-2 text-[9.5px] font-semibold uppercase tracking-[0.16em] text-ccb-muted-2">{rangeLabel}</div>
        <div className="text-[15px] font-extrabold text-ccb-red">{peso(monthValue)}</div>
      </div>
    </div>
  );
}

/* ---------------- Ellipsis Popover ---------------- */

function EllipsisPopover({
  x,
  y,
  onClose,
  onOpenReport,
  onEdit,
}: {
  x: number;
  y: number;
  onClose: () => void;
  onOpenReport: () => void;
  onEdit: () => void;
}) {
  return (
    <div
      style={{ top: `${y}px`, left: `${x}px` }}
      className="absolute z-30 w-[310px] rounded-2xl border border-ccb-border bg-white shadow-[0_20px_50px_-20px_rgba(26,37,96,0.35)]"
    >
      <div className="flex items-center justify-between px-5 pt-4 pb-3">
        <div className="text-[13px] font-bold text-ccb-navy">Quick Actions</div>
        <button onClick={onClose} className="rounded-md p-1 text-ccb-muted hover:bg-ccb-canvas hover:text-ccb-navy">
          <X size={15} />
        </button>
      </div>
      <div className="px-3 pb-3 space-y-2">
        <button
          onClick={onOpenReport}
          className="w-full rounded-xl border border-ccb-border bg-white px-4 py-3 text-left transition-colors hover:bg-ccb-canvas hover:border-ccb-blue/50"
        >
          <div className="text-[12.5px] font-bold text-ccb-navy">Monthly Daily Out Report</div>
          <div className="mt-0.5 text-[11px] text-ccb-muted">View daily issued quantities per day of the month</div>
        </button>
        <button
          onClick={onEdit}
          className="w-full rounded-xl border border-ccb-border bg-white px-4 py-3 text-left transition-colors hover:bg-ccb-canvas hover:border-ccb-blue/50"
        >
          <div className="text-[12.5px] font-bold text-ccb-navy">Edit Material Details</div>
          <div className="mt-0.5 text-[11px] text-ccb-muted">Update code, description, UOM, price and stock figures</div>
        </button>
      </div>
    </div>
  );
}

/* ---------------- Modal shell ---------------- */

function Modal({
  children,
  width = 480,
  onClose,
}: {
  children: React.ReactNode;
  width?: number;
  onClose: () => void;
}) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-ccb-navy/50 backdrop-blur-sm p-6" onClick={onClose}>
      <div
        onClick={(e) => e.stopPropagation()}
        style={{ width }}
        className="max-h-[90vh] overflow-hidden rounded-[20px] bg-white shadow-[0_30px_80px_-20px_rgba(26,37,96,0.6)]"
      >
        {children}
      </div>
    </div>
  );
}

/* ---------------- Stock In / Out Dialog ---------------- */

function StockDialog({
  mode,
  material,
  onClose,
  onSuccess,
}: {
  mode: "in" | "out";
  material: Material;
  onClose: () => void;
  onSuccess: () => void;
}) {
  const [qty, setQty] = useState(1);
  const isIn = mode === "in";
  const [isSaving, setIsSaving] = useState(false);

  const handleSave = async () => {
    setIsSaving(true);
    try {
      if (isIn) {
        await stockInFn({
          data: {
            tabName: material.tabName,
            rowNumber: material.rowNumber,
            qty,
          },
        });
      } else {
        const today = new Date();
        const day = today.getDate();
        await stockOutFn({
          data: {
            tabName: material.tabName,
            rowNumber: material.rowNumber,
            qty,
            day,
          },
        });
      }
      onSuccess();
      onClose();
    } catch (error) {
      console.error("Error updating stock quantity:", error);
      alert("Failed to save transaction. Ensure Google Sheets credentials are correct.");
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <Modal onClose={onClose} width={440}>
      <div className="border-b-[3px] border-ccb-red px-6 pt-6 pb-5">
        <div className="flex items-start justify-between">
          <div>
            <div className="label-eyebrow">{isIn ? "Stock-In Recording" : "Stock Out Recording"}</div>
            <h2 className="mt-1 text-[18px] font-bold text-ccb-navy">
              {isIn ? "Add Received Quantity" : "Stock Out Record"}
            </h2>
            <p className="mt-1 text-[12px] text-ccb-muted">
              {isIn ? "Add item quantity to inventory stock." : "Record daily items issued to production."}
            </p>
          </div>
          <button onClick={onClose} className="rounded-md p-1 text-ccb-muted hover:bg-ccb-canvas hover:text-ccb-navy" disabled={isSaving}>
            <X size={18} />
          </button>
        </div>
      </div>

      <div className="p-6">
        <div className="rounded-2xl bg-ccb-canvas p-4">
          <span className="inline-block rounded-md bg-white px-2 py-1 text-[10.5px] font-bold tracking-widest text-ccb-navy border border-ccb-border">
            {material.code}
          </span>
          <div className="mt-2 text-[15px] font-bold text-ccb-navy">{material.desc}</div>
          <div className="mt-1 text-[12px] text-ccb-muted">
            Current Balance: <span className="font-semibold text-ccb-navy">{fmt(material.balance)} {material.uom}</span>
          </div>
        </div>

        <div className="mt-6">
          <div className="label-eyebrow text-center">{isIn ? "Quantity to Add" : "Quantity to Disburse"}</div>
          <div className="mt-3 flex items-center justify-center gap-4">
            <button
              onClick={() => setQty(Math.max(1, qty - 1))}
              disabled={isSaving}
              className="h-12 w-12 rounded-full border border-ccb-border text-ccb-navy hover:border-ccb-blue hover:text-ccb-blue transition disabled:opacity-50"
            >
              <Minus size={18} className="mx-auto" />
            </button>
            <input
              type="number"
              value={qty}
              disabled={isSaving}
              onChange={(e) => setQty(Math.max(1, Number(e.target.value) || 1))}
              className="w-32 rounded-xl border border-ccb-border bg-white py-3 text-center text-[28px] font-extrabold text-ccb-navy outline-none focus:border-ccb-blue disabled:opacity-50 [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none"
            />
            <button
              onClick={() => setQty(qty + 1)}
              disabled={isSaving}
              className="h-12 w-12 rounded-full border border-ccb-border text-ccb-navy hover:border-ccb-blue hover:text-ccb-blue transition disabled:opacity-50"
            >
              <Plus size={18} className="mx-auto" />
            </button>
          </div>
        </div>
      </div>

      <div className="flex items-center justify-end gap-2 border-t border-ccb-border bg-ccb-canvas/60 px-6 py-4">
        <button
          onClick={onClose}
          disabled={isSaving}
          className="rounded-lg border border-ccb-border bg-white px-5 py-2 text-[12.5px] font-semibold text-ccb-navy hover:bg-ccb-canvas disabled:opacity-50"
        >
          Close
        </button>
        <button
          onClick={handleSave}
          disabled={isSaving}
          className="rounded-lg bg-ccb-blue px-5 py-2 text-[12.5px] font-semibold text-white shadow-sm hover:bg-ccb-navy disabled:opacity-50"
        >
          {isSaving ? "Saving..." : "Save"}
        </button>
      </div>
    </Modal>
  );
}

/* ---------------- Monthly Daily Out Report ---------------- */

function MonthlyReport({
  material,
  onClose,
  tabs,
}: {
  material: Material;
  onClose: () => void;
  tabs: string[];
}) {
  const [month, setMonth] = useState(material.tabName);

  // Load the selected tab's data to extract this material's daily details
  const { data: materials = [], isLoading } = useQuery({
    queryKey: ["materials", month],
    queryFn: () => getMaterialsFn({ data: month }),
  });

  const matched = useMemo(() => {
    return materials.find((m) => m.code.toLowerCase() === material.code.toLowerCase()) || null;
  }, [materials, material.code]);

  const days = useMemo(() => {
    if (matched) return matched.dailyOut;
    return Array(31).fill(0);
  }, [matched]);

  const total = useMemo(() => days.reduce((a, b) => a + b, 0), [days]);
  const active = useMemo(() => days.filter((d) => d > 0).length, [days]);
  const peakIdx = useMemo(() => {
    const maxVal = Math.max(...days);
    return maxVal > 0 ? days.indexOf(maxVal) : -1;
  }, [days]);
  const avg = useMemo(() => (active ? (total / active).toFixed(1) : "0.0"), [total, active]);
  const max = useMemo(() => Math.max(...days) || 1, [days]);

  return (
    <Modal onClose={onClose} width={580}>
      <div className="border-b border-ccb-border px-6 pt-6 pb-5">
        <div className="flex items-start justify-between">
          <div>
            <div className="label-eyebrow">Daily Issue Report</div>
            <h2 className="mt-1 text-[17px] font-bold text-ccb-navy">
              {material.code} — {material.desc}
            </h2>
            <p className="mt-1 text-[12px] text-ccb-muted">Daily issued quantities for {month}</p>
          </div>
          <button onClick={onClose} className="rounded-md p-1 text-ccb-muted hover:bg-ccb-canvas hover:text-ccb-navy">
            <X size={18} />
          </button>
        </div>

        <div className="mt-4 flex items-center justify-between gap-3">
          <div className="relative">
            <select
              value={month}
              onChange={(e) => setMonth(e.target.value)}
              className="appearance-none rounded-lg border border-ccb-border bg-white pl-3 pr-9 py-2 text-[12.5px] font-semibold text-ccb-navy outline-none focus:border-ccb-blue"
            >
              {tabs.map((t) => (
                <option key={t}>{t}</option>
              ))}
            </select>
            <ChevronDown size={14} className="pointer-events-none absolute right-2 top-1/2 -translate-y-1/2 text-ccb-muted" />
          </div>
          <div className="flex items-center gap-3 rounded-full bg-ccb-blue px-4 py-2 text-white shadow-sm">
            <span className="text-[10px] font-semibold uppercase tracking-widest text-white/80">Total Issued</span>
            <span className="text-[18px] font-extrabold leading-none">{isLoading ? "..." : total}</span>
          </div>
        </div>
      </div>

      {isLoading ? (
        <div className="h-[250px] flex items-center justify-center text-ccb-muted text-[13px]">
          Loading daily data from Google Sheets...
        </div>
      ) : (
        <>
          <div className="px-6 pt-5">
            <div className="grid grid-cols-3 gap-3">
              {[
                { l: "Peak Day", v: peakIdx !== -1 ? `Day ${String(peakIdx + 1).padStart(2, "0")}` : "--" },
                { l: "Active Days", v: String(active) },
                { l: "Average / Active Day", v: avg },
              ].map((s) => (
                <div key={s.l} className="rounded-xl border border-ccb-border bg-ccb-canvas/60 p-3">
                  <div className="text-[9.5px] font-semibold uppercase tracking-[0.14em] text-ccb-muted">{s.l}</div>
                  <div className="mt-1 text-[18px] font-extrabold text-ccb-navy">{s.v}</div>
                </div>
              ))}
            </div>
          </div>

          <div className="max-h-[340px] overflow-y-auto px-6 py-4">
            <div className="space-y-1.5">
              {days.map((q, i) => {
                const dim = q === 0;
                const pct = (q / max) * 100;
                return (
                  <div key={i} className={`flex items-center gap-3 rounded-lg px-2 py-1.5 ${dim ? "opacity-45" : ""}`}>
                    <div className="w-[70px] rounded-md bg-ccb-canvas px-2 py-1 text-center text-[10px] font-bold tracking-widest text-ccb-navy whitespace-nowrap">
                      DAY {String(i + 1).padStart(2, "0")}
                    </div>
                    <div className="flex-1 h-3 rounded-full bg-ccb-canvas overflow-hidden">
                      <div
                        className="h-full rounded-full bg-gradient-to-r from-ccb-blue to-[#4B5FCB]"
                        style={{ width: `${dim ? 0 : pct}%` }}
                      />
                    </div>
                    <div className={`w-10 text-right text-[12.5px] font-bold ${dim ? "text-ccb-muted-2" : "text-ccb-navy"}`}>
                      {q === 0 ? "—" : q}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        </>
      )}

      <div className="flex items-center justify-end gap-2 border-t border-ccb-border bg-ccb-canvas/60 px-6 py-4">
        <button onClick={onClose} className="rounded-lg border border-ccb-border bg-white px-5 py-2 text-[12.5px] font-semibold text-ccb-navy hover:bg-ccb-canvas">
          Close
        </button>
      </div>
    </Modal>
  );
}

/* ---------------- Edit Material Dialog ---------------- */

function EditMaterial({
  material,
  onClose,
  onSuccess,
}: {
  material: Material;
  onClose: () => void;
  onSuccess: () => void;
}) {
  const [date, setDate] = useState(material.date);
  const [code, setCode] = useState(material.code);
  const [desc, setDesc] = useState(material.desc);
  const [uom, setUom] = useState(material.uom);
  const [price, setPrice] = useState(material.price === null ? "N/A" : String(material.price));
  const [initial, setInitial] = useState(material.initial);
  const [received, setReceived] = useState(material.received);
  const [balance, setBalance] = useState(material.balance);
  const [issued, setIssued] = useState(material.issued);
  const [isSaving, setIsSaving] = useState(false);
  const [imageFile, setImageFile] = useState<File | null>(null);
  const [imagePreview, setImagePreview] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleSave = async () => {
    if (!code || !desc) {
      alert("Code and Description are required.");
      return;
    }
    setIsSaving(true);
    try {
      const parsedPrice = price.toLowerCase() === "n/a" || price.trim() === "" ? null : Number(price);
      await editMaterialFn({
        data: {
          tabName: material.tabName,
          rowNumber: material.rowNumber,
          values: {
            date,
            code,
            desc,
            uom,
            price: parsedPrice,
            initial: Number(initial),
            received: Number(received),
            balance: Number(balance),
            issued: Number(issued),
          },
        },
      });
      onSuccess();
      onClose();
    } catch (error) {
      console.error("Error editing material:", error);
      alert("Failed to edit material detail. Ensure sheet range values match.");
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <Modal onClose={onClose} width={680}>
      <div className="border-b border-ccb-border px-7 pt-5 pb-4">
        <div className="flex items-start justify-between">
          <div>
            <h2 className="text-[18px] font-bold text-ccb-navy">Edit Material Details</h2>
            <p className="mt-1 text-[12px] text-ccb-muted">Update identity, pricing and stock figures for this material.</p>
          </div>
          <button onClick={onClose} disabled={isSaving} className="rounded-md p-1 text-ccb-muted hover:bg-ccb-canvas hover:text-ccb-navy">
            <X size={18} />
          </button>
        </div>
      </div>

      <div className="px-7 pt-4 pb-2">
        <div className="rounded-xl bg-gradient-to-br from-ccb-navy to-ccb-blue px-5 py-3 text-white">
          <div className="text-[10px] font-semibold uppercase tracking-[0.18em] text-white/70">Material Details Editor</div>
          <div className="text-[13px] font-bold">Edit identity, pricing and inventory figures</div>
        </div>
      </div>

      <div className="grid grid-cols-2 gap-4 px-7 py-4">
        <Panel title="Material Identity">
          <Field label="Date" value={date} onChange={setDate} />
          <Field label="Code" value={code} onChange={setCode} />
          <Field label="Description" value={desc} onChange={setDesc} />
          <Field label="UOM" value={uom} onChange={setUom} />
          <Field label="Price / Unit" value={price} onChange={setPrice} />
        </Panel>
        <Panel title="Inventory Figures">
          <Field label="Initial Stock" type="number" value={String(initial)} onChange={(v) => {
            const val = Number(v) || 0;
            setInitial(val);
            setBalance(val + received - issued);
          }} />
          <Field label="Received" type="number" value={String(received)} onChange={(v) => {
            const val = Number(v) || 0;
            setReceived(val);
            setBalance(initial + val - issued);
          }} />
          <Field label="Balance" type="number" value={String(balance)} onChange={(v) => setBalance(Number(v) || 0)} />
          <Field label="Out Quantity" type="number" value={String(issued)} onChange={(v) => {
            const val = Number(v) || 0;
            setIssued(val);
            setBalance(initial + received - val);
          }} />

          <div className="mt-2">
            <div className="label-eyebrow">Material Image</div>
            <div className="mt-2 flex items-center gap-3">
              {imagePreview
                ? <img src={imagePreview} className="h-[54px] w-[54px] shrink-0 rounded-2xl object-cover border border-ccb-border" />
                : <Thumb initials={material.initials} tone={material.tone} size={54} code={material.code} />}
              <input readOnly value={imageFile ? imageFile.name : `${code}.jpg`}
                className="flex-1 min-w-0 rounded-lg border border-ccb-border bg-ccb-canvas/60 px-3 py-2 text-[12px] text-ccb-navy cursor-pointer"
                onClick={() => fileInputRef.current?.click()}
              />
              <input ref={fileInputRef} type="file" accept="image/*" className="hidden"
                onChange={(e) => { const f = e.target.files?.[0]; if (!f) return; setImageFile(f); setImagePreview(URL.createObjectURL(f)); }}
              />
              <button type="button" onClick={() => fileInputRef.current?.click()}
                className="shrink-0 rounded-lg border border-ccb-border bg-white px-3 py-2 text-[12px] font-semibold text-ccb-navy hover:bg-ccb-canvas">
                Browse
              </button>
            </div>
          </div>
        </Panel>
      </div>

      <div className="flex items-center justify-end gap-2 border-t border-ccb-border bg-ccb-canvas/60 px-7 py-4">
        <div className="flex items-center gap-2">
          <button
            onClick={onClose}
            disabled={isSaving}
            className="rounded-lg border border-ccb-border bg-white px-5 py-2 text-[12.5px] font-semibold text-ccb-navy hover:bg-ccb-canvas disabled:opacity-50"
          >
            Cancel
          </button>
          <button
            onClick={handleSave}
            disabled={isSaving}
            className="rounded-lg bg-ccb-blue px-5 py-2 text-[12.5px] font-semibold text-white shadow-sm hover:bg-ccb-navy disabled:opacity-50"
          >
            {isSaving ? "Saving..." : "Save Changes"}
          </button>
        </div>
      </div>
    </Modal>
  );
}

function Panel({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="rounded-2xl border border-ccb-border bg-white p-4">
      <div className="mb-2 flex items-center gap-2">
        <span className="h-4 w-1 rounded-sm bg-ccb-gold" />
        <div className="text-[12.5px] font-bold text-ccb-navy">{title}</div>
      </div>
      <div className="space-y-2">{children}</div>
    </div>
  );
}

function Field({
  label,
  value,
  onChange,
  type = "text",
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  type?: string;
}) {
  return (
    <label className="block">
      <span className="label-eyebrow">{label}</span>
      <input
        type={type}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className="mt-1 w-full rounded-lg border border-ccb-border bg-white px-3 py-2 text-[12.5px] text-ccb-navy outline-none focus:border-ccb-blue"
      />
    </label>
  );
}

/* ---------------- Add Material Dialog ---------------- */

function AddMaterial({
  activeTab,
  onClose,
  onSuccess,
}: {
  activeTab: string;
  onClose: () => void;
  onSuccess: () => void;
}) {
  const [code, setCode] = useState("");
  const [desc, setDesc] = useState("");
  const [uom, setUom] = useState("Pcs");
  const [price, setPrice] = useState("");
  const [initial, setInitial] = useState("");
  const [received, setReceived] = useState("");
  const [isSaving, setIsSaving] = useState(false);

  const handleSave = async () => {
    if (!code || !desc) {
      alert("Code and Description are required.");
      return;
    }
    setIsSaving(true);
    try {
      const parsedPrice = price.toLowerCase() === "n/a" || price.trim() === "" ? null : Number(price);
      const initVal = Number(initial) || 0;
      const recVal = Number(received) || 0;
      
      await addMaterialFn({
        data: {
          tabName: activeTab,
          values: {
            date: new Date().toISOString().split("T")[0],
            code,
            desc,
            uom,
            price: parsedPrice,
            initial: initVal,
            received: recVal,
            balance: initVal + recVal,
            issued: 0,
          },
        },
      });
      onSuccess();
      onClose();
    } catch (error) {
      console.error("Error adding material:", error);
      alert("Failed to add material. Verify Google Sheets access permissions.");
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <Modal onClose={onClose} width={440}>
      <div className="bg-ccb-red px-6 py-5 text-white">
        <div className="flex items-start justify-between">
          <div>
            <div className="text-[10px] font-semibold uppercase tracking-[0.18em] text-white/80">New Entry</div>
            <h2 className="mt-1 text-[18px] font-bold">Add New Material</h2>
          </div>
          <button onClick={onClose} disabled={isSaving} className="rounded-md p-1 text-white/80 hover:bg-white/10 hover:text-white">
            <X size={18} />
          </button>
        </div>
      </div>

      <div className="space-y-4 px-6 py-5">
        <label className="block">
          <span className="label-eyebrow">Code #</span>
          <input
            type="text"
            value={code}
            onChange={(e) => setCode(e.target.value)}
            placeholder="e.g. CCB1001"
            className="mt-1 w-full rounded-lg border border-ccb-border bg-white px-3 py-2 text-[12.5px] text-ccb-navy outline-none focus:border-ccb-blue placeholder:text-ccb-muted-2"
          />
        </label>
        <label className="block">
          <span className="label-eyebrow">Item / Description</span>
          <input
            type="text"
            value={desc}
            onChange={(e) => setDesc(e.target.value)}
            placeholder="e.g. Cutting Disc (Sunrise) 4 Inch"
            className="mt-1 w-full rounded-lg border border-ccb-border bg-white px-3 py-2 text-[12.5px] text-ccb-navy outline-none focus:border-ccb-blue placeholder:text-ccb-muted-2"
          />
        </label>
        <div>
          <div className="label-eyebrow">Unit of Measurement (UOM)</div>
          <div className="relative mt-1">
            <select
              value={uom}
              onChange={(e) => setUom(e.target.value)}
              className="w-full appearance-none rounded-lg border border-ccb-border bg-white px-3 py-2 pr-9 text-[12.5px] text-ccb-navy outline-none focus:border-ccb-blue"
            >
              {["Pcs", "Spool", "Cyl", "Pair", "Box", "Liters", "Can", "Bottle", "Sacks", "Pail"].map((u) => (
                <option key={u}>{u}</option>
              ))}
            </select>
            <ChevronDown size={14} className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 text-ccb-muted" />
          </div>
        </div>
        <label className="block">
          <span className="label-eyebrow">Price / Unit</span>
          <input
            type="text"
            value={price}
            onChange={(e) => setPrice(e.target.value)}
            placeholder="e.g. 25.50"
            className="mt-1 w-full rounded-lg border border-ccb-border bg-white px-3 py-2 text-[12.5px] text-ccb-navy outline-none focus:border-ccb-blue placeholder:text-ccb-muted-2"
          />
        </label>
        <div className="grid grid-cols-2 gap-4">
          <label className="block">
            <span className="label-eyebrow">Initial Stock</span>
            <input
              type="number"
              value={initial}
              onChange={(e) => setInitial(e.target.value)}
              placeholder="0"
              className="mt-1 w-full rounded-lg border border-ccb-border bg-white px-3 py-2 text-[12.5px] text-ccb-navy outline-none focus:border-ccb-blue placeholder:text-ccb-muted-2"
            />
          </label>
          <label className="block">
            <span className="label-eyebrow">Received</span>
            <input
              type="number"
              value={received}
              onChange={(e) => setReceived(e.target.value)}
              placeholder="0"
              className="mt-1 w-full rounded-lg border border-ccb-border bg-white px-3 py-2 text-[12.5px] text-ccb-navy outline-none focus:border-ccb-blue placeholder:text-ccb-muted-2"
            />
          </label>
        </div>

        <div>
          <div className="label-eyebrow">Material Image</div>
          <div className="mt-1 flex gap-2">
            <input
              readOnly
              placeholder="No image selected"
              className="flex-1 rounded-lg border border-ccb-border bg-ccb-canvas/60 px-3 py-2 text-[12px] text-ccb-muted"
            />
            <button className="flex items-center gap-1 rounded-lg bg-ccb-blue px-3 py-2 text-[12px] font-semibold text-white hover:bg-ccb-navy">
              <Upload size={13} /> Browse
            </button>
          </div>
        </div>
      </div>

      <div className="flex items-center justify-end gap-2 border-t border-ccb-border bg-ccb-canvas/60 px-6 py-4">
        <button
          onClick={onClose}
          disabled={isSaving}
          className="rounded-lg border border-ccb-border bg-white px-5 py-2 text-[12.5px] font-semibold text-ccb-navy hover:bg-ccb-canvas disabled:opacity-50"
        >
          Cancel
        </button>
        <button
          onClick={handleSave}
          disabled={isSaving}
          className="rounded-lg bg-ccb-blue px-5 py-2 text-[12.5px] font-semibold text-white shadow-sm hover:bg-ccb-navy disabled:opacity-50"
        >
          {isSaving ? "Saving..." : "Save Material"}
        </button>
      </div>
    </Modal>
  );
}

/* ---------------- Page Component ---------------- */

function MaterialMonitoring() {
  const queryClient = useQueryClient();

  // 1. Fetch tabs list
  const { data: tabs = ["JAN", "FEB", "MAR", "APR", "MAY", "JUN", "JUL", "AUG", "SEP", "OCT", "NOV", "DEC"] } = useQuery({
    queryKey: ["tabs"],
    queryFn: () => getTabsFn(),
  });

  // Pick current month as initial tab, or fallback to first available
  const defaultTab = useMemo(() => {
    const currentMonthStr = new Date().toLocaleString("en-US", { month: "short" }).toUpperCase();
    return tabs.find((t) => t.toUpperCase() === currentMonthStr) || tabs[0] || "MAY";
  }, [tabs]);

  const [activeTab, setActiveTab] = useState("MAY");

  // Sync activeTab with fetched tabs list
  useEffect(() => {
    if (tabs.length > 0 && activeTab === "MAY" && !tabs.includes("MAY")) {
      setActiveTab(defaultTab);
    } else if (tabs.length > 0 && !tabs.includes(activeTab) && activeTab !== "ALL") {
      setActiveTab(tabs[0]);
    }
  }, [tabs, defaultTab, activeTab]);

  // 2. Fetch materials for active tab
  const { data: materials = [], isLoading, error } = useQuery({
    queryKey: ["materials", activeTab],
    queryFn: () => getMaterialsFn({ data: activeTab }),
    enabled: activeTab !== "ALL",
    staleTime: 1000 * 60 * 2,
    refetchOnWindowFocus: false,
  });

  // Fetch all tabs data when ALL is selected
  const allTabsResults = useQueries({
    queries: tabs.map((tab) => ({
      queryKey: ["materials", tab],
      queryFn: () => getMaterialsFn({ data: tab }),
      enabled: activeTab === "ALL",
      staleTime: 1000 * 60 * 2,
      refetchOnWindowFocus: false,
    })),
  });

  const allMaterials = useMemo(() => {
    if (activeTab !== "ALL") return materials;
    const map = new Map<string, Material>();
    for (const result of allTabsResults) {
      for (const m of (result.data ?? [])) {
        const existing = map.get(m.code);
        if (existing) {
          map.set(m.code, {
            ...existing,
            initial: existing.initial + m.initial,
            received: existing.received + m.received,
            balance: existing.balance + m.balance,
            issued: existing.issued + m.issued,
          });
        } else {
          map.set(m.code, { ...m });
        }
      }
    }
    return Array.from(map.values());
  }, [activeTab, materials, allTabsResults]);

  const isAllLoading = activeTab === "ALL" && allTabsResults.some((r) => r.isLoading);
  const displayMaterials = activeTab === "ALL" ? allMaterials : materials;
  const displayLoading = activeTab === "ALL" ? isAllLoading : isLoading;
  const displayError = activeTab === "ALL" ? null : error;

  const [selectedCode, setSelectedCode] = useState<string | null>(null);
  const [query, setQuery] = useState("");
  const [range, setRange] = useState<keyof typeof RANGE_LABEL>("Monthly");
  const [popoverState, setPopoverState] = useState<{ code: string; x: number; y: number } | null>(null);
  const [modal, setModal] = useState<
    | null
    | { type: "in" | "out" | "edit" | "report"; code: string }
    | { type: "add" }
  >(null);

  // Provision current month tab on startup (mirrors JavaFX ensureCurrentMonthTab)
  useEffect(() => {
    provisionCurrentMonthFn()
      .then((result) => {
        if (result?.created) {
          console.log(`[MonthProvisioner] New tab created: ${result.created}`);
          // Refresh tabs list and switch to the newly created tab
          queryClient.invalidateQueries({ queryKey: ["tabs"] });
          setActiveTab(result.created);
        }
      })
      .catch((err) => {
        console.warn("[MonthProvisioner] Provisioning failed (non-critical):", err);
      });
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Set default selectedCode when materials load
  useEffect(() => {
    if (materials.length > 0 && !selectedCode) {
      setSelectedCode(materials[0].code);
    }
  }, [materials, selectedCode]);

  const filtered = useMemo(() => {
    return displayMaterials.filter(
      (m: any) =>
        m.code.toLowerCase().includes(query.toLowerCase()) ||
        m.desc.toLowerCase().includes(query.toLowerCase())
    );
  }, [displayMaterials, query]);

  const selected = useMemo(() => {
    return displayMaterials.find((m: any) => m.code === selectedCode) ?? null;
  }, [displayMaterials, selectedCode]);

  const modalMaterial = useMemo(() => {
    return modal && "code" in modal ? displayMaterials.find((m: any) => m.code === modal.code) ?? null : null;
  }, [displayMaterials, modal]);

  const handleSuccess = () => {
    queryClient.invalidateQueries({ queryKey: ["materials", activeTab] });
  };

  const handleEllipsisClick = (e: React.MouseEvent, mCode: string) => {
    e.stopPropagation();
    if (popoverState?.code === mCode) {
      setPopoverState(null);
    } else {
      // Calculate coordinates relative to screen/parent container
      const element = e.currentTarget as HTMLElement;
      const rect = element.getBoundingClientRect();
      const parentRect = element.offsetParent?.getBoundingClientRect();
      const x = rect.left - (parentRect?.left || 0) - 260; // Offset popover left
      const y = rect.bottom - (parentRect?.top || 0) + 5;
      setPopoverState({ code: mCode, x, y });
    }
  };

  return (
    <div className="h-screen bg-ccb-canvas overflow-hidden">
      <div className="flex h-full bg-white">
        <Sidebar />

        <div className="flex-1 flex flex-col min-w-0 h-full overflow-hidden lg:pl-0 pl-0">
          <TopBar />

          <div className="flex-1 overflow-y-auto bg-ccb-canvas p-7 space-y-6">
            {/* SELECTED context + KPIs */}
            <div>
              <div className="mb-3 flex items-center gap-2 text-[11px] uppercase tracking-[0.16em] text-ccb-muted">
                <span className="font-semibold">Selected:</span>
                <span className="text-ccb-navy font-bold">
                  {selected ? `${selected.code} — ${selected.desc}` : "— No material selected"}
                </span>
              </div>

              <div className="grid grid-cols-4 gap-4">
                <Kpi variant="blue" label="Initial Stock" value={selected ? fmt(selected.initial) : "0"} unit={selected?.uom} />
                <Kpi variant="blue3" label="Received" value={selected ? fmt(selected.received) : "0"} unit={selected?.uom} />
                <Kpi variant="blue2" label="Current Balance" value={selected ? fmt(selected.balance) : "0"} unit={selected?.uom} />
                <Kpi variant="navy" label="Issued" value={selected ? fmt(filterDailyOutByRange(selected.dailyOut, range)) : "0"} unit={selected?.uom} />
              </div>
            </div>

            {/* Toolbar + List */}
            <div className="relative rounded-3xl border border-ccb-border bg-white p-8 shadow-sm">
              <div className="flex flex-wrap items-center gap-3 pb-4 border-b border-ccb-border">
                <div className="flex items-center gap-2">
                  <h3 className="text-[14px] font-bold text-ccb-navy">List of Materials</h3>
                  <span className="ml-2 rounded-full bg-ccb-canvas px-2 py-0.5 text-[10.5px] font-semibold text-ccb-muted">
                  {displayLoading ? "..." : `${filtered.length} items`}
                  </span>
                </div>

                <div className="relative ml-2 flex-1 max-w-[380px]">
                  <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-ccb-muted-2" />
                  <input
                    value={query}
                    onChange={(e) => setQuery(e.target.value)}
                    placeholder="Search materials..."
                    className="w-full rounded-lg border border-ccb-border bg-ccb-canvas/50 pl-9 pr-3 py-2 text-[12.5px] text-ccb-navy outline-none focus:border-ccb-blue focus:bg-white placeholder:text-ccb-muted-2"
                  />
                </div>

                <div className="ml-auto flex items-center gap-2">
                  <div className="relative">
                    <select
                      value={range}
                      onChange={(e) => setRange(e.target.value as keyof typeof RANGE_LABEL)}
                      className="appearance-none rounded-lg border border-ccb-border bg-white pl-3 pr-9 py-2 text-[12.5px] font-semibold text-ccb-navy outline-none focus:border-ccb-blue"
                    >
                      {(["All", "Weekly", "Monthly", "Quarterly", "Yearly"] as const).map((r) => (
                        <option key={r}>{r}</option>
                      ))}
                    </select>
                    <ChevronDown size={14} className="pointer-events-none absolute right-2 top-1/2 -translate-y-1/2 text-ccb-muted" />
                  </div>

                  <button
                    onClick={() => setModal({ type: "add" })}
                    className="inline-flex items-center gap-1.5 rounded-lg bg-ccb-blue px-4 py-2 text-[12.5px] font-semibold text-white shadow-sm hover:bg-ccb-navy transition cursor-pointer"
                  >
                    <Plus size={15} /> Add Material
                  </button>
                </div>
              </div>

              {/* Cards */}
              <div className="mt-4 space-y-3 overflow-y-auto" style={{ maxHeight: "calc(100vh - 420px)" }}>
                {displayLoading ? (
                  <div className="rounded-2xl border border-dashed border-ccb-border bg-ccb-canvas/30 p-12 text-center text-[13px] text-ccb-muted">
                    Loading inventory data from Google Sheets...
                  </div>
                ) : displayError ? (
                  <div className="rounded-2xl border border-dashed border-ccb-red/30 bg-ccb-red/5 p-12 text-center text-[13px] text-ccb-red font-semibold">
                    Failed to fetch materials: {String(displayError.message || displayError)}
                  </div>
                ) : filtered.length === 0 ? (
                  <div className="rounded-2xl border border-dashed border-ccb-border bg-ccb-canvas/60 p-10 text-center text-[13px] text-ccb-muted">
                    No materials found in this tab. Click <span className="font-semibold text-ccb-navy">+ Add Material</span> to add one.
                  </div>
                ) : (
                  filtered.map((m: any) => (
                    <MaterialCard
                      key={`${m.tabName}-${m.rowNumber}`}
                      m={m}
                      selected={selectedCode === m.code}
                      onSelect={() => setSelectedCode(m.code)}
                      onEllipsis={(e) => handleEllipsisClick(e, m.code)}
                      onStockIn={() => setModal({ type: "in", code: m.code })}
                      onStockOut={() => setModal({ type: "out", code: m.code })}
                      rangeLabel={RANGE_LABEL[range]}
                      range={range}
                    />
                  ))
                )}
              </div>

              {popoverState && (
                <EllipsisPopover
                  x={popoverState.x}
                  y={popoverState.y}
                  onClose={() => setPopoverState(null)}
                  onOpenReport={() => {
                    setModal({ type: "report", code: popoverState.code });
                    setPopoverState(null);
                  }}
                  onEdit={() => {
                    setModal({ type: "edit", code: popoverState.code });
                    setPopoverState(null);
                  }}
                />
              )}
            </div>

            <p className="text-center text-[11px] text-ccb-muted-2">
              CCB Inventory Management System · Material Monitoring · Synced with Google Sheets
            </p>
          </div>
        </div>
      </div>

      {/* Modals */}
      {modal?.type === "in" && modalMaterial && (
        <StockDialog mode="in" material={modalMaterial} onClose={() => setModal(null)} onSuccess={handleSuccess} />
      )}
      {modal?.type === "out" && modalMaterial && (
        <StockDialog mode="out" material={modalMaterial} onClose={() => setModal(null)} onSuccess={handleSuccess} />
      )}
      {modal?.type === "report" && modalMaterial && (
        <MonthlyReport material={modalMaterial} onClose={() => setModal(null)} tabs={tabs} />
      )}
      {modal?.type === "edit" && modalMaterial && (
        <EditMaterial material={modalMaterial} onClose={() => setModal(null)} onSuccess={handleSuccess} />
      )}
      {modal?.type === "add" && (
        <AddMaterial activeTab={activeTab} onClose={() => setModal(null)} onSuccess={handleSuccess} />
      )}
    </div>
  );
}
