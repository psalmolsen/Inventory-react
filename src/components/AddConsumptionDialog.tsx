import React, { useMemo, useState } from "react";

export type NewConsumptionRecord = {
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

export type Material = {
  code: string;
  name: string;
  uom: string;
  price: number;
  balance: number;
};

export type Station = {
  code: string;
  name: string;
  description: string;
  color: string;
  icon: "flame" | "paint" | "beaker" | "wrench";
};

const DEFAULT_STATIONS: Station[] = [
  { code: "HO", name: "Hotworks", description: "Heat, cutting, and weld prep", color: "#ef4444", icon: "flame" },
  { code: "PA", name: "Painting", description: "Paint and finishing station", color: "#6366f1", icon: "paint" },
  { code: "CO", name: "Cosmetics", description: "Surface touch-up and finish", color: "#f59e0b", icon: "beaker" },
  { code: "CT", name: "CTC", description: "General CTC station", color: "#1e3a8a", icon: "wrench" },
];

const StationIcon = ({ name, className }: { name: Station["icon"]; className?: string }) => {
  const icons: Record<Station["icon"], React.FC<React.SVGProps<SVGSVGElement>>> = {
    flame: (p) => <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" {...p}><path d="M8.5 14.5A2.5 2.5 0 0 0 11 12c0-1.38-.5-2-1-3-1.072-2.143-.224-4.054 2-6 .5 2.5 2 4.9 4 6.5 2 1.6 3 3.5 3 5.5a7 7 0 1 1-14 0c0-1.153.433-2.294 1-3a2.5 2.5 0 0 0 2.5 2.5z" /></svg>,
    paint: (p) => <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" {...p}><path d="m14.622 17.897-10.68-2.913" /><path d="M18.376 2.622a1 1 0 1 1 3.002 3.002L17.36 9.643a.5.5 0 0 0 0 .65l3.997 4.8a1 1 0 0 1-.126 1.438l-5.917 4.05a1 1 0 0 1-1.338-.174l-4.07-5.8a.5.5 0 0 0-.65 0L5.5 17.5" /></svg>,
    beaker: (p) => <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" {...p}><path d="M4.5 3h15" /><path d="M6 3v16a2 2 0 0 0 2 2h8a2 2 0 0 0 2-2V3" /><path d="M6 14h12" /></svg>,
    wrench: (p) => <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" {...p}><path d="M14.7 6.3a1 1 0 0 0 0 1.4l1.6 1.6a1 1 0 0 0 1.4 0l3.77-3.77a6 6 0 0 1-7.94 7.94l-6.91 6.91a2.12 2.12 0 0 1-3-3l6.91-6.91a6 6 0 0 1 7.94-7.94l-3.76 3.76z" /></svg>,
  };
  const Icon = icons[name];
  return <Icon className={className} />;
};

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

export function AddConsumptionDialog({
  open,
  onOpenChange,
  onAdd,
  materials,
  stations = DEFAULT_STATIONS,
}: {
  open: boolean;
  onOpenChange: (o: boolean) => void;
  onAdd: (r: NewConsumptionRecord) => void;
  materials: Material[];
  stations?: Station[];
}) {
  const [stationCode, setStationCode] = useState<string | null>(null);
  const [materialCode, setMaterialCode] = useState<string | null>(null);
  const [search, setSearch] = useState("");
  const [receiver, setReceiver] = useState("");
  const [qty, setQty] = useState(1);

  const station = stations.find((s) => s.code === stationCode) ?? null;
  const material = materials.find((m) => m.code === materialCode) ?? null;

  const filteredMaterials = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return materials;
    return materials.filter(
      (m) =>
        m.code.toLowerCase().includes(q) ||
        m.name.toLowerCase().includes(q) ||
        m.uom.toLowerCase().includes(q),
    );
  }, [materials, search]);

  const totalCost = material ? material.price * qty : 0;
  const canSubmit = !!station && !!material && qty > 0 && receiver.trim().length > 0;

  const reset = () => {
    setStationCode(null);
    setMaterialCode(null);
    setSearch("");
    setReceiver("");
    setQty(1);
  };

  const today = new Date();
  const formattedDate = today.toLocaleDateString("en-US", {
    month: "long",
    day: "numeric",
    year: "numeric",
  });

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-ccb-navy/50 backdrop-blur-sm p-6">
      <div className="max-h-[88vh] w-full max-w-[1120px] overflow-hidden rounded-2xl bg-[#f5f6fa] shadow-2xl">
        {/* Hero header */}
        <div className="relative bg-ccb-navy px-8 py-6 text-white">
          <div className="flex items-start justify-between gap-6">
            <div className="min-w-0">
              <p className="text-xs font-semibold uppercase tracking-[0.16em] text-white/70">
                Station Consumption
              </p>
              <h2 className="mt-2 text-2xl font-bold leading-snug">
                Record what each station used and automatically update the live inventory balance.
              </h2>
              <p className="mt-2 text-sm text-white/80">
                One tap for the station, one tap for the material, then type the receiver.
              </p>
            </div>
            <div className="flex flex-col items-end gap-3">
              <span className="rounded-md bg-white/15 px-3 py-1.5 text-xs font-semibold text-white ring-1 ring-white/20">
                {formattedDate}
              </span>
              <button
                onClick={() => { onOpenChange(false); reset(); }}
                className="inline-flex items-center gap-1.5 rounded-md bg-white px-3 py-1.5 text-xs font-semibold text-ccb-navy shadow-sm hover:bg-white/90"
              >
                <svg className="h-3.5 w-3.5" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
                  <line x1="18" y1="6" x2="6" y2="18" />
                  <line x1="6" y1="6" x2="18" y2="18" />
                </svg>
                Close
              </button>
            </div>
          </div>
        </div>

        {/* Body */}
        <div className="grid grid-cols-1 gap-5 p-6 lg:grid-cols-[1fr_360px]">
          {/* LEFT: pick station + material */}
          <div className="flex flex-col gap-5">
            {/* Choose Station */}
            <section className="rounded-xl border border-ccb-border bg-white p-5">
              <div className="flex items-start gap-3">
                <span className="mt-1 h-6 w-1 rounded-sm bg-ccb-navy" />
                <div>
                  <h3 className="text-base font-semibold text-ccb-navy">Choose Station</h3>
                  <p className="text-xs text-ccb-muted">Pick the station card that received the material.</p>
                </div>
              </div>

              <div className="mt-4 grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
                {stations.map((s) => {
                  const selected = stationCode === s.code;
                  return (
                    <button
                      key={s.code}
                      onClick={() => setStationCode(s.code)}
                      className={`flex items-center gap-3 rounded-lg border p-3 text-left transition ${
                        selected
                          ? "border-ccb-navy bg-ccb-canvas ring-1 ring-ccb-navy"
                          : "border-ccb-border bg-white hover:bg-ccb-canvas/50"
                      }`}
                    >
                      <span
                        className="'flex h-11 w-11 flex-none items-center justify-center rounded-full text-sm font-bold text-white"
                        style={{ backgroundColor: s.color }}
                      >
                        {s.code}
                      </span>
                      <span className="min-w-0">
                        <span className="flex items-center gap-1.5 text-sm font-semibold text-ccb-navy">
                          <StationIcon name={s.icon} className="h-3.5 w-3.5 text-ccb-muted" />
                          {s.name}
                        </span>
                        <span className="mt-0.5 block truncate text-xs text-ccb-muted">
                          {s.description}
                        </span>
                      </span>
                    </button>
                  );
                })}
              </div>
            </section>

            {/* Choose Material */}
            <section className="rounded-xl border border-ccb-border bg-white p-5">
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div className="flex items-start gap-3">
                  <span className="mt-1 h-6 w-1 rounded-sm bg-ccb-navy" />
                  <div>
                    <h3 className="text-base font-semibold text-ccb-navy">Choose Material</h3>
                    <p className="text-xs text-ccb-muted">
                      Search the inventory list, then click a card to select it.
                    </p>
                  </div>
                </div>
                <div className="relative w-full sm:w-80">
                  <svg className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-ccb-muted" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
                    <circle cx="11" cy="11" r="7" />
                    <line x1="21" y1="21" x2="16.65" y2="16.65" />
                  </svg>
                  <input
                    value={search}
                    onChange={(e) => setSearch(e.target.value)}
                    placeholder="Search code, description, or UOM"
                    className="h-9 w-full rounded-md border border-ccb-border bg-white pl-9 pr-3 text-sm text-ccb-navy placeholder:text-ccb-muted focus:outline-none focus:ring-1 focus:ring-ccb-blue"
                  />
                </div>
              </div>

              <div className="mt-4 max-h-[260px] overflow-y-auto rounded-lg border border-ccb-border bg-ccb-canvas/60 p-2">
                {filteredMaterials.length === 0 ? (
                  <div className="flex h-[220px] flex-col items-center justify-center text-center">
                    <p className="text-sm font-semibold text-ccb-navy">No materials loaded yet</p>
                    <p className="mt-1 text-xs text-ccb-muted">
                      If the list is empty, the current month sheet may still be loading.
                    </p>
                  </div>
                ) : (
                  <div className="grid grid-cols-1 gap-2 md:grid-cols-2">
                    {filteredMaterials.map((m) => {
                      const selected = materialCode === m.code;
                      return (
                        <button
                          key={m.code}
                          onClick={() => setMaterialCode(m.code)}
                          className={`flex items-center justify-between gap-3 rounded-md border p-2.5 text-left transition ${
                            selected
                              ? "border-ccb-gold bg-ccb-canvas ring-1 ring-ccb-gold"
                              : "border-ccb-border bg-white hover:bg-ccb-canvas/50"
                          }`}
                        >
                          <span className="min-w-0">
                            <span className="block truncate text-sm font-medium text-ccb-navy">
                              {m.name}
                            </span>
                            <span className="block text-[11px] uppercase tracking-wider text-ccb-muted">
                              {m.code} · {m.uom}
                            </span>
                          </span>
                          <span className="text-right text-xs">
                            <span className="block font-semibold text-ccb-navy">
                              {PHP.format(m.price)}
                            </span>
                            <span className="block text-ccb-muted">bal {m.balance}</span>
                          </span>
                        </button>
                      );
                    })}
                  </div>
                )}
              </div>
            </section>
          </div>

          {/* RIGHT: review + receiver */}
          <aside className="flex flex-col gap-4">
            <div className="flex items-start gap-3">
              <span className="mt-1 h-6 w-1 rounded-sm bg-ccb-navy" />
              <div>
                <h3 className="text-base font-semibold text-ccb-navy">Review</h3>
                <p className="text-xs text-ccb-muted">
                  The record below updates automatically as you pick values.
                </p>
              </div>
            </div>

            <ReviewField label="Station" value={station?.name ?? "Choose a station"} muted={!station} />
            <ReviewField
              label="Material"
              value={material?.name ?? "Choose a material"}
              secondary={material ? `${material.code}` : "No material selected"}
              muted={!material}
            />

            <div className="grid grid-cols-2 gap-3">
              <ReviewMini label="UOM" value={material ? material.uom : "--"} />
              <ReviewMini label="Balance" value={material ? String(material.balance) : "--"} />
            </div>

            <div className="grid grid-cols-2 gap-3">
              <ReviewMini
                label="Unit Cost"
                value={material ? PHP.format(material.price) : "--"}
              />
              <div className="relative overflow-hidden rounded-lg bg-ccb-red p-3 text-white shadow-sm">
                <span className="pointer-events-none absolute -right-6 -top-6 h-20 w-20 rounded-full bg-white/10" />
                <p className="text-[11px] font-semibold uppercase tracking-wider text-white/80">
                  Total Cost
                </p>
                <p className="mt-1 text-lg font-bold">
                  {material ? PHP.format(totalCost) : "--"}
                </p>
              </div>
            </div>

            <div className="rounded-xl border border-ccb-border bg-white p-4">
              <div className="flex items-start gap-3">
                <span className="mt-1 h-6 w-1 rounded-sm bg-ccb-navy" />
                <div>
                  <h4 className="text-sm font-semibold text-ccb-navy">Receiver + Quantity</h4>
                  <p className="text-xs text-ccb-muted">
                    Receiver can be typed. Quantity stays numeric and live-calculates the total.
                  </p>
                </div>
              </div>

              <div className="mt-3 space-y-3">
                <div>
                  <label className="text-xs font-medium text-ccb-muted">Received By</label>
                  <input
                    value={receiver}
                    onChange={(e) => setReceiver(e.target.value)}
                    placeholder="Name of the person who received the material"
                    className="mt-1 h-9 w-full rounded-md border border-ccb-border bg-white px-3 text-sm text-ccb-navy placeholder:text-ccb-muted focus:outline-none focus:ring-1 focus:ring-ccb-blue"
                  />
                </div>
                <div>
                  <label className="text-xs font-medium text-ccb-muted">Quantity</label>
                  <div className="mt-1 flex items-center gap-2">
                    <button
                      onClick={() => setQty((q) => Math.max(1, q - 1))}
                      className="flex h-9 w-9 items-center justify-center rounded-md border border-ccb-border bg-white text-ccb-muted hover:bg-ccb-canvas"
                      aria-label="Decrease quantity"
                    >
                      <svg className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
                        <line x1="5" y1="12" x2="19" y2="12" />
                      </svg>
                    </button>
                    <input
                      type="number"
                      min={1}
                      value={qty}
                      onChange={(e) => setQty(Math.max(1, Number(e.target.value) || 1))}
                      className="h-9 flex-1 rounded-md border border-ccb-border bg-white text-center text-sm text-ccb-navy focus:outline-none focus:ring-1 focus:ring-ccb-blue"
                    />
                    <button
                      onClick={() => setQty((q) => q + 1)}
                      className="flex h-9 w-9 items-center justify-center rounded-md border border-ccb-border bg-white text-ccb-muted hover:bg-ccb-canvas"
                      aria-label="Increase quantity"
                    >
                      <svg className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
                        <line x1="12" y1="5" x2="12" y2="19" />
                        <line x1="5" y1="12" x2="19" y2="12" />
                      </svg>
                    </button>
                  </div>
                </div>
              </div>
            </div>

            <div className="mt-1 flex items-center gap-2">
              <button
                onClick={() => { onOpenChange(false); reset(); }}
                className="h-10 flex-1 rounded-md border border-ccb-border bg-white text-sm font-medium text-ccb-navy hover:bg-ccb-canvas"
              >
                Cancel
              </button>
              <button
                disabled={!canSubmit}
                onClick={() => {
                  if (!station || !material) return;
                  const iso = today.toISOString().slice(0, 10);
                  onAdd({
                    id: `${Date.now()}`,
                    date: iso,
                    station: station.name,
                    description: material.name,
                    qty,
                    uom: material.uom,
                    signature: receiver.trim(),
                    unitPrice: material.price,
                    monthKey: iso.slice(0, 7),
                  });
                  reset();
                  onOpenChange(false);
                }}
                className="h-10 flex-[1.4] rounded-md bg-ccb-blue text-sm font-semibold text-white hover:bg-ccb-navy disabled:opacity-60"
              >
                Record Consumption
              </button>
            </div>
          </aside>
        </div>
      </div>
    </div>
  );
}

function ReviewField({
  label,
  value,
  secondary,
  muted,
}: {
  label: string;
  value: string;
  secondary?: string;
  muted?: boolean;
}) {
  return (
    <div className="relative overflow-hidden rounded-lg bg-ccb-navy p-3 text-white shadow-sm">
      <span className="pointer-events-none absolute -right-6 -top-6 h-20 w-20 rounded-full bg-white/10" />
      <p className="text-[11px] font-semibold uppercase tracking-wider text-white/70">{label}</p>
      <p className={`mt-1 text-base font-semibold ${muted ? "text-white/50" : "text-white"}`}>
        {value}
      </p>
      {secondary && <p className="mt-0.5 text-xs text-white/60">{secondary}</p>}
    </div>
  );
}

function ReviewMini({
  label,
  value,
}: {
  label: string;
  value: string;
}) {
  return (
    <div className="relative overflow-hidden rounded-lg bg-ccb-navy p-3 text-white shadow-sm">
      <span className="pointer-events-none absolute -right-6 -top-6 h-20 w-20 rounded-full bg-white/10" />
      <p className="text-[11px] font-semibold uppercase tracking-wider text-white/70">{label}</p>
      <p className="mt-1 text-base font-semibold text-white">{value}</p>
    </div>
  );
}
