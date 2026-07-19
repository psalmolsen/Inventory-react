import React, { useMemo, useState } from "react";

export type NewConsumptionRecord = {
  id: string;
  date: string;
  station: string;
  materialCode: string;
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

type CartLine = {
  id: string;
  material: Material;
  receiver: string;
  qty: number;
};

export function AddConsumptionDialog({
  open,
  onOpenChange,
  onCheckout,
  materials,
  stations = DEFAULT_STATIONS,
}: {
  open: boolean;
  onOpenChange: (o: boolean) => void;
  onCheckout: (records: NewConsumptionRecord[]) => Promise<void> | void;
  materials: Material[];
  stations?: Station[];
}) {
  const [stationCode, setStationCode] = useState<string | null>(null);
  const [materialCode, setMaterialCode] = useState<string | null>(null);
  const [search, setSearch] = useState("");
  const [cart, setCart] = useState<CartLine[]>([]);
  const [receiver, setReceiver] = useState("");
  const [qty, setQty] = useState(1);

  const station = stations.find((s) => s.code === stationCode) ?? null;
  const selectedMaterial = materials.find((m) => m.code === materialCode) ?? null;

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

  const cartCount = cart.length;
  const grandTotal = cart.reduce((sum, line) => sum + line.material.price * line.qty, 0);
  const canCheckout = !!station && cart.length > 0 && cart.every((line) => line.receiver.trim().length > 0);
  const selectedSubtotal = selectedMaterial ? selectedMaterial.price * qty : 0;
  const selectedRemaining = selectedMaterial ? selectedMaterial.balance - qty : 0;
  const selectedLowStock = selectedMaterial ? selectedRemaining < 0 : false;

  const reset = () => {
    setStationCode(null);
    setMaterialCode(null);
    setSearch("");
    setCart([]);
    setReceiver("");
    setQty(1);
  };

  const today = new Date();
  const formattedDate = today.toLocaleDateString("en-US", {
    month: "long",
    day: "numeric",
    year: "numeric",
  });

  const addSelectedToCart = () => {
    if (!selectedMaterial) return;
    setCart((prev) => [
      ...prev,
      {
        id: `${Date.now()}-${Math.random().toString(16).slice(2)}`,
        material: selectedMaterial,
        receiver: receiver.trim(),
        qty,
      },
    ]);
    setMaterialCode(null);
    setReceiver("");
    setQty(1);
  };

  const updateLine = (id: string, patch: Partial<Pick<CartLine, "receiver" | "qty">>) => {
    setCart((prev) =>
      prev.map((line) =>
        line.id === id
          ? {
              ...line,
              ...patch,
              qty: patch.qty ? Math.max(1, patch.qty) : line.qty,
            }
          : line,
      ),
    );
  };

  const removeLine = (id: string) => {
    setCart((prev) => prev.filter((line) => line.id !== id));
  };

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-ccb-navy/50 backdrop-blur-sm p-3 sm:p-6">
      <div className="flex h-[94vh] w-[96vw] max-w-[1560px] flex-col overflow-hidden rounded-2xl bg-[#f5f6fa] shadow-2xl">
        <div className="relative shrink-0 bg-ccb-navy px-6 py-5 text-white sm:px-8 sm:py-6">
          <div className="flex items-start justify-between gap-6">
            <div className="min-w-0">
              <p className="text-xs font-semibold uppercase tracking-[0.16em] text-white/70">
                Station Consumption
              </p>
              <h2 className="mt-2 text-2xl font-bold leading-snug">
                Record what each station used and automatically update the live inventory balance.
              </h2>
              <p className="mt-2 text-sm text-white/80">
                One tap for the station, then tap a material, confirm it with Add, and keep building the cart.
              </p>
            </div>
            <div className="flex flex-col items-end gap-3">
              <span className="rounded-md bg-white/15 px-3 py-1.5 text-xs font-semibold text-white ring-1 ring-white/20">
                {formattedDate}
              </span>
              <button
                onClick={() => {
                  onOpenChange(false);
                  reset();
                }}
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

        <div className="flex-1 overflow-y-auto">
          <div className="grid grid-cols-1 gap-5 p-4 sm:p-6 xl:grid-cols-[1.2fr_0.8fr] xl:items-start">
            <div className="flex min-h-0 flex-col gap-5">
              <section className="rounded-xl border border-ccb-border bg-white p-5">
                <div className="flex items-start gap-3">
                  <span className="mt-1 h-6 w-1 rounded-sm bg-ccb-navy" />
                  <div>
                    <h3 className="text-base font-semibold text-ccb-navy">Choose Station</h3>
                    <p className="text-xs text-ccb-muted">Pick the station card that received the material.</p>
                  </div>
                </div>

                <div className="mt-4 grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-4">
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
                          className="flex h-11 w-11 flex-none items-center justify-center rounded-full text-sm font-bold text-white"
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

              <section className="flex min-h-0 flex-1 flex-col rounded-xl border border-ccb-border bg-white p-5">
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div className="flex items-start gap-3">
                    <span className="mt-1 h-6 w-1 rounded-sm bg-ccb-navy" />
                    <div>
                      <h3 className="text-base font-semibold text-ccb-navy">Choose Material</h3>
                      <p className="text-xs text-ccb-muted">
                        Search the inventory list, then tap a card to load it into the item panel.
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

                <div className="mt-4 min-h-0 flex-1 overflow-y-auto rounded-lg border border-ccb-border bg-ccb-canvas/60 p-2">
                  {filteredMaterials.length === 0 ? (
                    <div className="flex h-full min-h-[220px] flex-col items-center justify-center text-center">
                      <p className="text-sm font-semibold text-ccb-navy">No materials loaded yet</p>
                      <p className="mt-1 text-xs text-ccb-muted">
                        If the list is empty, the current month sheet may still be loading.
                      </p>
                    </div>
                  ) : (
                    <div className="grid grid-cols-1 gap-2">
                      {filteredMaterials.map((m) => {
                        const selected = materialCode === m.code;
                        const balanceState = m.balance <= 0;
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
                              <span className="mt-0.5 block text-[11px] uppercase tracking-wider text-ccb-muted">
                                {m.code} - {m.uom}
                              </span>
                            </span>
                            <span className="flex flex-none items-center gap-2 text-right text-xs">
                              <span
                                className={`rounded-full px-2 py-1 text-[11px] font-semibold ${
                                  balanceState
                                    ? "bg-ccb-red/10 text-ccb-red"
                                    : "bg-ccb-canvas text-ccb-muted"
                                }`}
                              >
                                bal {m.balance}
                              </span>
                              <span className="min-w-[72px]">
                                <span className="block font-semibold text-ccb-navy">
                                  {PHP.format(m.price)}
                                </span>
                              </span>
                            </span>
                          </button>
                        );
                      })}
                    </div>
                  )}
                </div>
              </section>
            </div>

            <div className="flex min-h-0 flex-col gap-5">
              <section className="rounded-xl border border-ccb-border bg-white p-5">
                <div className="flex items-start gap-3">
                  <span className="mt-1 h-6 w-1 rounded-sm bg-ccb-navy" />
                  <div>
                    <h3 className="text-base font-semibold text-ccb-navy">Item Selected</h3>
                    <p className="text-xs text-ccb-muted">
                      Tap a material, then confirm with Add to move it into the cart.
                    </p>
                  </div>
                </div>

                {!selectedMaterial ? (
                  <div className="mt-4 flex min-h-[180px] flex-col items-center justify-center rounded-lg border border-dashed border-ccb-border bg-ccb-canvas/40 px-4 text-center">
                    <p className="text-sm font-semibold text-ccb-navy">No item selected</p>
                    <p className="mt-1 text-xs text-ccb-muted">
                      Choose a material from the list to load the item panel.
                    </p>
                  </div>
                ) : (
                  <div className="mt-4 rounded-xl border border-ccb-border bg-white p-4">
                    <div className="flex items-start gap-3">
                      <span className="mt-1 h-6 w-1 rounded-sm bg-ccb-navy" />
                      <div className="min-w-0">
                        <h4 className="truncate text-sm font-semibold text-ccb-navy">
                          {selectedMaterial.name}
                        </h4>
                        <p className="mt-0.5 text-xs text-ccb-muted">
                          {selectedMaterial.code} - {selectedMaterial.uom}
                        </p>
                      </div>
                    </div>

                    <div className="mt-4 grid grid-cols-2 gap-3">
                      <div className="relative overflow-hidden rounded-lg bg-ccb-navy p-3 text-white shadow-sm">
                        <span className="pointer-events-none absolute -right-6 -top-6 h-20 w-20 rounded-full bg-white/10" />
                        <p className="text-[11px] font-semibold uppercase tracking-wider text-white/70">Balance</p>
                        <p className="mt-1 text-lg font-semibold text-white">{selectedMaterial.balance}</p>
                      </div>
                      <div className="relative overflow-hidden rounded-lg bg-ccb-navy p-3 text-white shadow-sm">
                        <span className="pointer-events-none absolute -right-6 -top-6 h-20 w-20 rounded-full bg-white/10" />
                        <p className="text-[11px] font-semibold uppercase tracking-wider text-white/70">Unit Cost</p>
                        <p className="mt-1 text-lg font-semibold text-white">{PHP.format(selectedMaterial.price)}</p>
                      </div>
                    </div>

                    <div className="mt-3 rounded-lg bg-ccb-canvas/60 p-3">
                      <div className="grid grid-cols-2 gap-3">
                        <div>
                          <label className="text-xs font-medium text-ccb-muted">Qty</label>
                          <input
                            type="number"
                            min={1}
                            value={qty}
                            onChange={(e) => setQty(Math.max(1, Number(e.target.value) || 1))}
                            className="mt-1 h-9 w-full rounded-md border border-ccb-border bg-white px-3 text-center text-sm text-ccb-navy focus:outline-none focus:ring-1 focus:ring-ccb-blue"
                          />
                        </div>
                        <div>
                          <label className="text-xs font-medium text-ccb-muted">Subtotal</label>
                          <div className="mt-1 h-9 rounded-md border border-ccb-border bg-white px-3 py-2 text-sm font-semibold text-ccb-navy">
                            {PHP.format(selectedSubtotal)}
                          </div>
                        </div>
                      </div>

                      <div className="mt-3">
                        <label className="text-xs font-medium text-ccb-muted">Received by</label>
                        <input
                          value={receiver}
                          onChange={(e) => setReceiver(e.target.value)}
                          placeholder="Name of the receiver"
                          className="mt-1 h-9 w-full rounded-md border border-ccb-border bg-white px-3 text-sm text-ccb-navy placeholder:text-ccb-muted focus:outline-none focus:ring-1 focus:ring-ccb-blue"
                        />
                      </div>

                      <div className="mt-3 flex items-center justify-between gap-3">
                        <div className="text-xs text-ccb-muted">
                          After use: {selectedMaterial.balance} to {selectedRemaining}
                        </div>
                        <div className="text-right">
                          <p className="text-[11px] font-semibold uppercase tracking-wider text-ccb-muted">Code</p>
                          <p className="text-sm font-semibold text-ccb-navy">{selectedMaterial.code}</p>
                        </div>
                      </div>

                      {selectedLowStock && (
                        <div className="mt-3 rounded-md bg-ccb-red/10 px-3 py-2 text-xs font-medium text-ccb-red">
                          Balance {selectedMaterial.balance} to {selectedRemaining} after this consumption
                        </div>
                      )}

                      <div className="mt-4 flex items-center gap-2">
                        <button
                          onClick={() => {
                            setMaterialCode(null);
                            setReceiver("");
                            setQty(1);
                          }}
                          className="h-10 flex-1 rounded-md border border-ccb-border bg-white text-sm font-medium text-ccb-navy hover:bg-ccb-canvas"
                        >
                          Cancel
                        </button>
                        <button
                          onClick={addSelectedToCart}
                          disabled={!station || !selectedMaterial || receiver.trim().length === 0}
                          className="h-10 flex-[1.2] rounded-md bg-ccb-blue text-sm font-semibold text-white hover:bg-ccb-navy disabled:opacity-60"
                        >
                          Add
                        </button>
                      </div>
                    </div>
                  </div>
                )}
              </section>

              <section className="rounded-xl border border-ccb-border bg-white p-5 flex min-h-0 flex-1 flex-col">
                <div className="flex items-center justify-between">
                  <div>
                    <h3 className="text-base font-semibold text-ccb-navy">Cart</h3>
                    <p className="text-xs text-ccb-muted">Added items become compact tiles.</p>
                  </div>
                  <div className="text-right">
                    <p className="text-[11px] font-semibold uppercase tracking-wider text-ccb-muted">Count</p>
                    <p className="text-lg font-bold text-ccb-navy">{cartCount}</p>
                  </div>
                </div>

                <div className="mt-4 grid grid-cols-2 gap-3">
                  <div className="relative overflow-hidden rounded-lg bg-ccb-navy p-3 text-white shadow-sm">
                    <span className="pointer-events-none absolute -right-6 -top-6 h-20 w-20 rounded-full bg-white/10" />
                    <p className="text-[11px] font-semibold uppercase tracking-wider text-white/70">Station</p>
                    <p className={`mt-1 text-base font-semibold ${station ? "text-white" : "text-white/50"}`}>
                      {station?.name ?? "Choose a station"}
                    </p>
                  </div>
                  <div className="relative overflow-hidden rounded-lg bg-ccb-navy p-3 text-white shadow-sm">
                    <span className="pointer-events-none absolute -right-6 -top-6 h-20 w-20 rounded-full bg-white/10" />
                    <p className="text-[11px] font-semibold uppercase tracking-wider text-white/70">Grand Total</p>
                    <p className="mt-1 text-lg font-semibold text-white">{PHP.format(grandTotal)}</p>
                  </div>
                </div>

                <div className="mt-4 min-h-0 flex-1 overflow-y-auto">
                  {cart.length === 0 ? (
                    <div className="flex min-h-[180px] flex-col items-center justify-center rounded-lg border border-dashed border-ccb-border bg-ccb-canvas/40 px-4 text-center">
                      <p className="text-sm font-semibold text-ccb-navy">Your cart is empty</p>
                      <p className="mt-1 text-xs text-ccb-muted">
                        Add a material from the selected item panel to start.
                      </p>
                    </div>
                  ) : (
                    <div className="space-y-3">
                      {cart.map((line) => {
                        const remaining = line.material.balance - line.qty;
                        const lowStock = remaining < 0;
                        return (
                          <div key={line.id} className="rounded-lg border border-ccb-border bg-white p-2.5 shadow-sm">
                            <div className="flex items-start justify-between gap-3">
                              <div className="min-w-0">
                                <p className="truncate text-sm font-semibold text-ccb-navy">
                                  {line.material.name}
                                </p>
                                <p className="mt-0.5 text-[11px] uppercase tracking-wider text-ccb-muted">
                                  {line.material.code} - {line.material.uom}
                                </p>
                              </div>
                              <div className="flex flex-none items-center gap-2">
                                <span
                                  className={`rounded-full px-2 py-1 text-[11px] font-semibold ${
                                    line.material.balance <= 0
                                      ? "bg-ccb-red/10 text-ccb-red"
                                      : "bg-ccb-canvas text-ccb-muted"
                                  }`}
                                >
                                  bal {line.material.balance}
                                </span>
                                <button
                                  onClick={() => removeLine(line.id)}
                                  className="rounded-md border border-ccb-border bg-white px-2 py-1 text-xs font-medium text-ccb-muted hover:bg-ccb-canvas"
                                >
                                  Remove
                                </button>
                              </div>
                            </div>

                            <div className="mt-2 grid grid-cols-[minmax(0,1fr)_88px] gap-2">
                              <div>
                                <label className="text-[11px] font-medium text-ccb-muted">Received by</label>
                                <input
                                  value={line.receiver}
                                  onChange={(e) => updateLine(line.id, { receiver: e.target.value })}
                                  placeholder="Receiver"
                                  className="mt-1 h-8 w-full rounded-md border border-ccb-border bg-white px-2.5 text-sm text-ccb-navy placeholder:text-ccb-muted focus:outline-none focus:ring-1 focus:ring-ccb-blue"
                                />
                              </div>
                              <div>
                                <label className="text-[11px] font-medium text-ccb-muted">Qty</label>
                                <input
                                  type="number"
                                  min={1}
                                  value={line.qty}
                                  onChange={(e) =>
                                    updateLine(line.id, {
                                      qty: Math.max(1, Number(e.target.value) || 1),
                                    })
                                  }
                                  className="mt-1 h-8 w-full rounded-md border border-ccb-border bg-white px-2 text-center text-sm text-ccb-navy focus:outline-none focus:ring-1 focus:ring-ccb-blue"
                                />
                              </div>
                            </div>

                            <div className="mt-2 flex items-center justify-between gap-3">
                              <div className="text-[11px] text-ccb-muted">
                                Unit {PHP.format(line.material.price)}
                              </div>
                              <div className="text-right">
                                <p className="text-[10px] font-semibold uppercase tracking-wider text-ccb-muted">Subtotal</p>
                                <p className="text-sm font-semibold text-ccb-navy">
                                  {PHP.format(line.material.price * line.qty)}
                                </p>
                              </div>
                            </div>

                            {lowStock && (
                              <div className="mt-2 rounded-md bg-ccb-red/10 px-2.5 py-1.5 text-[11px] font-medium leading-snug text-ccb-red">
                                Balance {line.material.balance} to {remaining} after this consumption
                              </div>
                            )}
                          </div>
                        );
                      })}
                    </div>
                  )}
                </div>
              </section>
            </div>
          </div>
        </div>

        <div className="shrink-0 border-t border-ccb-border bg-[#f5f6fa]/95 px-4 py-4 backdrop-blur sm:px-6">
          <div className="flex items-center gap-2">
            <button
              onClick={() => {
                onOpenChange(false);
                reset();
              }}
              className="h-11 flex-1 rounded-md border border-ccb-border bg-white text-sm font-medium text-ccb-navy hover:bg-ccb-canvas"
            >
              Cancel
            </button>
            <button
              disabled={!canCheckout}
              onClick={async () => {
                if (!station || cart.length === 0) return;
                const iso = today.toISOString().slice(0, 10);
                const records: NewConsumptionRecord[] = cart.map((line) => ({
                  id: `${Date.now()}-${line.id}`,
                  date: iso,
                  station: station.name,
                  materialCode: line.material.code,
                  description: line.material.name,
                  qty: line.qty,
                  uom: line.material.uom,
                  signature: line.receiver.trim(),
                  unitPrice: line.material.price,
                  monthKey: iso.slice(0, 7),
                }));
                await onCheckout(records);
                reset();
                onOpenChange(false);
              }}
              className="h-11 flex-[1.4] rounded-md bg-ccb-blue text-sm font-semibold text-white hover:bg-ccb-navy disabled:opacity-60"
            >
              Record {cartCount} consumption{cartCount === 1 ? "" : "s"}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
