import { useMemo, useState } from "react";
import { Search, X, Minus, Plus, Beaker, Flame, Paintbrush, Wrench } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Dialog, DialogContent } from "@/components/ui/dialog";

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
  color: string; // hex
  icon: "flame" | "paint" | "beaker" | "wrench";
};

const DEFAULT_STATIONS: Station[] = [
  { code: "HO", name: "Hotworks", description: "Heat, cutting, and weld prep", color: "#ef4444", icon: "flame" },
  { code: "PA", name: "Painting", description: "Paint and finishing station", color: "#6366f1", icon: "paint" },
  { code: "CO", name: "Cosmetics", description: "Surface touch-up and finish", color: "#f59e0b", icon: "beaker" },
  { code: "CT", name: "CTC", description: "General CTC station", color: "#1e3a8a", icon: "wrench" },
];

const StationIcon = ({ name, className }: { name: Station["icon"]; className?: string }) => {
  const Icon = name === "flame" ? Flame : name === "paint" ? Paintbrush : name === "beaker" ? Beaker : Wrench;
  return <Icon className={className} />;
};

const PHP = new Intl.NumberFormat("en-PH", {
  style: "currency",
  currency: "PHP",
  minimumFractionDigits: 2,
});

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

  return (
    <Dialog open={open} onOpenChange={(o) => { onOpenChange(o); if (!o) reset(); }}>
      <DialogContent
        className="max-w-[1120px] gap-0 overflow-hidden border-0 bg-transparent p-0 shadow-2xl [&>button]:hidden"
      >
        <div className="max-h-[88vh] overflow-y-auto rounded-2xl bg-[#f5f6fa]">
          {/* Hero header */}
          <div className="relative bg-[#1e3a8a] px-8 py-6 text-white">
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
                  onClick={() => onOpenChange(false)}
                  className="inline-flex items-center gap-1.5 rounded-md bg-white px-3 py-1.5 text-xs font-semibold text-[#1e3a8a] shadow-sm hover:bg-white/90"
                >
                  <X className="h-3.5 w-3.5" />
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
              <section className="rounded-xl border border-slate-200 bg-white p-5">
                <div className="flex items-start gap-3">
                  <span className="mt-1 h-6 w-1 rounded-sm bg-[#1e3a8a]" />
                  <div>
                    <h3 className="text-base font-semibold text-[#1e293b]">Choose Station</h3>
                    <p className="text-xs text-slate-500">Pick the station card that received the material.</p>
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
                            ? "border-[#1e3a8a] bg-[#eef2ff] ring-1 ring-[#1e3a8a]"
                            : "border-slate-200 bg-white hover:bg-slate-50"
                        }`}
                      >
                        <span
                          className="flex h-11 w-11 flex-none items-center justify-center rounded-full text-sm font-bold text-white"
                          style={{ backgroundColor: s.color }}
                        >
                          {s.code}
                        </span>
                        <span className="min-w-0">
                          <span className="flex items-center gap-1.5 text-sm font-semibold text-[#1e293b]">
                            <StationIcon name={s.icon} className="h-3.5 w-3.5 text-slate-500" />
                            {s.name}
                          </span>
                          <span className="mt-0.5 block truncate text-xs text-slate-500">
                            {s.description}
                          </span>
                        </span>
                      </button>
                    );
                  })}
                </div>
              </section>

              {/* Choose Material */}
              <section className="rounded-xl border border-slate-200 bg-white p-5">
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div className="flex items-start gap-3">
                    <span className="mt-1 h-6 w-1 rounded-sm bg-[#1e3a8a]" />
                    <div>
                      <h3 className="text-base font-semibold text-[#1e293b]">Choose Material</h3>
                      <p className="text-xs text-slate-500">
                        Search the inventory list, then click a card to select it.
                      </p>
                    </div>
                  </div>
                  <div className="relative w-full sm:w-80">
                    <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
                    <Input
                      value={search}
                      onChange={(e) => setSearch(e.target.value)}
                      placeholder="Search code, description, or UOM"
                      className="h-9 rounded-md border-slate-200 pl-9 text-sm"
                    />
                  </div>
                </div>

                <div className="mt-4 max-h-[260px] overflow-y-auto rounded-lg border border-slate-100 bg-slate-50/60 p-2">
                  {filteredMaterials.length === 0 ? (
                    <div className="flex h-[220px] flex-col items-center justify-center text-center">
                      <p className="text-sm font-semibold text-[#1e3a8a]">No materials loaded yet</p>
                      <p className="mt-1 text-xs text-slate-500">
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
                                ? "border-[#f59e0b] bg-[#fef3c7] ring-1 ring-[#f59e0b]"
                                : "border-slate-200 bg-white hover:bg-slate-50"
                            }`}
                          >
                            <span className="min-w-0">
                              <span className="block truncate text-sm font-medium text-[#1e293b]">
                                {m.name}
                              </span>
                              <span className="block text-[11px] uppercase tracking-wider text-slate-500">
                                {m.code} · {m.uom}
                              </span>
                            </span>
                            <span className="text-right text-xs">
                              <span className="block font-semibold text-[#1e293b]">
                                {PHP.format(m.price)}
                              </span>
                              <span className="block text-slate-500">bal {m.balance}</span>
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
                <span className="mt-1 h-6 w-1 rounded-sm bg-[#1e3a8a]" />
                <div>
                  <h3 className="text-base font-semibold text-[#1e293b]">Review</h3>
                  <p className="text-xs text-slate-500">
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
                <div className="relative overflow-hidden rounded-lg bg-[#dc2626] p-3 text-white shadow-sm">
                  <span className="pointer-events-none absolute -right-6 -top-6 h-20 w-20 rounded-full bg-white/10" />
                  <p className="text-[11px] font-semibold uppercase tracking-wider text-white/80">
                    Total Cost
                  </p>
                  <p className="mt-1 text-lg font-bold">
                    {material ? PHP.format(totalCost) : "--"}
                  </p>
                </div>
              </div>

              <div className="rounded-xl border border-slate-200 bg-white p-4">
                <div className="flex items-start gap-3">
                  <span className="mt-1 h-6 w-1 rounded-sm bg-[#1e3a8a]" />
                  <div>
                    <h4 className="text-sm font-semibold text-[#1e293b]">Receiver + Quantity</h4>
                    <p className="text-xs text-slate-500">
                      Receiver can be typed. Quantity stays numeric and live-calculates the total.
                    </p>
                  </div>
                </div>

                <div className="mt-3 space-y-3">
                  <div>
                    <label className="text-xs font-medium text-slate-600">Received By</label>
                    <Input
                      value={receiver}
                      onChange={(e) => setReceiver(e.target.value)}
                      placeholder="Name of the person who received the material"
                      className="mt-1 h-9 border-slate-200 text-sm"
                    />
                  </div>
                  <div>
                    <label className="text-xs font-medium text-slate-600">Quantity</label>
                    <div className="mt-1 flex items-center gap-2">
                      <button
                        onClick={() => setQty((q) => Math.max(1, q - 1))}
                        className="flex h-9 w-9 items-center justify-center rounded-md border border-slate-200 bg-white text-slate-600 hover:bg-slate-50"
                        aria-label="Decrease quantity"
                      >
                        <Minus className="h-4 w-4" />
                      </button>
                      <Input
                        type="number"
                        min={1}
                        value={qty}
                        onChange={(e) => setQty(Math.max(1, Number(e.target.value) || 1))}
                        className="h-9 flex-1 text-center text-sm"
                      />
                      <button
                        onClick={() => setQty((q) => q + 1)}
                        className="flex h-9 w-9 items-center justify-center rounded-md border border-slate-200 bg-white text-slate-600 hover:bg-slate-50"
                        aria-label="Increase quantity"
                      >
                        <Plus className="h-4 w-4" />
                      </button>
                    </div>
                  </div>
                </div>
              </div>

              <div className="mt-1 flex items-center gap-2">
                <Button
                  variant="outline"
                  onClick={() => onOpenChange(false)}
                  className="h-10 flex-1 border-slate-200 text-sm"
                >
                  Cancel
                </Button>
                <Button
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
                  }}
                  className="h-10 flex-[1.4] bg-[#1e3a8a] text-sm font-semibold text-white hover:bg-[#1e40af] disabled:opacity-60"
                >
                  Record Consumption
                </Button>
              </div>
            </aside>
          </div>
        </div>
      </DialogContent>
    </Dialog>
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
    <div className="relative overflow-hidden rounded-lg bg-[#1e3a8a] p-3 text-white shadow-sm">
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
    <div className="relative overflow-hidden rounded-lg bg-[#1e3a8a] p-3 text-white shadow-sm">
      <span className="pointer-events-none absolute -right-6 -top-6 h-20 w-20 rounded-full bg-white/10" />
      <p className="text-[11px] font-semibold uppercase tracking-wider text-white/70">{label}</p>
      <p className="mt-1 text-base font-semibold text-white">{value}</p>
    </div>
  );
}
