import { createFileRoute } from "@tanstack/react-router";
import { useMemo, useState, useEffect, useCallback } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Search, Plus, ChevronRight, ChevronDown, Minus, X, MoreVertical, Trash2 } from "lucide-react";
import { Sidebar } from "../components/Sidebar";
import { getCnfTabsFn, getCnfItemsFn, cnfStockInFn, cnfStockOutFn, cnfEditItemFn, addNewCnfFn } from "../lib/cnf-server-functions";
import type { CnfItem } from "../lib/cnf-types";

export const Route = createFileRoute("/cnf")({ component: CNFMonitoring });

// ─── Range filter (mirrors Material Monitoring) ──────────────────────────────
const RANGE_LABEL: Record<string, string> = {
  All: "ALL TIME VALUE",
  Weekly: "THIS WEEK VALUE",
  Monthly: "THIS MONTH VALUE",
  Quarterly: "THIS QUARTER VALUE",
  Yearly: "THIS YEAR VALUE",
};

// ─── Types ───────────────────────────────────────────────────────────────────
type Brand = { id: string; name: string; status: "primary" | "legacy"; items: CnfItem[] };
type Modal = { kind: "in" | "out" | "report" | "edit"; item: CnfItem } | null;
type Popover = { item: CnfItem; x: number; y: number } | null;

const php = (n: number) => "₱ " + n.toLocaleString("en-PH", { minimumFractionDigits: 2, maximumFractionDigits: 2 });

function groupByBrand(items: CnfItem[]): Brand[] {
  const map = new Map<string, CnfItem[]>();
  items.forEach((item) => {
    const key = item.brand.trim(); // Keep original case
    if (!map.has(key)) map.set(key, []);
    map.get(key)!.push(item);
  });
  return Array.from(map.entries()).map(([name, items]) => ({
    id: name.toLowerCase().replace(/\s+/g, "-"),
    name,
    status: items.some((i) => i.currentBalance > 0 || i.inQuantity > 0) ? "primary" : "legacy",
    items,
  }));
}

const CATEGORY_ORDER = ["COLLAR", "NAME PLATE", "FOOT RING", "OTHER"];

// ─── Main Component ──────────────────────────────────────────────────────────
function CNFMonitoring() {
  const qc = useQueryClient();
  const [search, setSearch] = useState("");
  const [activePeriod, setActivePeriod] = useState("");
  const [range, setRange] = useState<keyof typeof RANGE_LABEL>("Monthly");

  const [selectedBrandId, setSelectedBrandId] = useState("");
  const [selectedItemId, setSelectedItemId] = useState("");
  const [modal, setModal] = useState<Modal>(null);
  const [popover, setPopover] = useState<Popover>(null);
  const [addNewCnfOpen, setAddNewCnfOpen] = useState(false);

  const { data: tabs = [], error: tabsError } = useQuery({
    queryKey: ["cnf-tabs"],
    queryFn: () => getCnfTabsFn(),
  });

  const defaultTab = useMemo(() => {
    if (!tabs.length) return "";
    const cur = new Date().toLocaleString("en-US", { month: "short" }).toUpperCase();
    return tabs.find((t) => t.toUpperCase().startsWith(cur)) ?? tabs[tabs.length - 1];
  }, [tabs]);

  const currentTab = activePeriod || defaultTab;

  useEffect(() => { if (defaultTab && !activePeriod) setActivePeriod(defaultTab); }, [defaultTab, activePeriod]);

  const { data: items = [], isLoading, error: itemsError } = useQuery({
    queryKey: ["cnf-items", currentTab],
    queryFn: () => getCnfItemsFn({ data: currentTab }),
    enabled: !!currentTab,
  });

  const brands = useMemo(() => groupByBrand(items), [items]);

  useEffect(() => {
    if (brands.length > 0 && !selectedBrandId) {
      setSelectedBrandId(brands[0].id);
      if (brands[0].items.length > 0)
        setSelectedItemId(`${brands[0].items[0].tabName}-${brands[0].items[0].rowNumber}`);
    }
  }, [brands, selectedBrandId]);

  const brand = brands.find((b) => b.id === selectedBrandId) ?? brands[0] ?? null;

  const selectedItem = useMemo(() => {
    if (!brand) return null;
    return brand.items.find((i) => `${i.tabName}-${i.rowNumber}` === selectedItemId) ?? brand.items[0] ?? null;
  }, [brand, selectedItemId]);

  const brandTotals = useMemo(() => {
    if (!brand) return { received: 0, issued: 0, balance: 0 };
    return {
      received: brand.items.reduce((s, i) => s + i.inQuantity, 0),
      issued:   brand.items.reduce((s, i) => s + i.outQuantity, 0),
      balance:  brand.items.reduce((s, i) => s + i.currentBalance, 0),
    };
  }, [brand]);

  const filteredBrands = useMemo(() =>
    brands.filter((b) =>
      (b.name + b.items.map((i) => i.category + i.variant).join(" "))
        .toLowerCase().includes(search.toLowerCase())
    ), [brands, search]);

  const categories = useMemo(() => {
    if (!brand) return [];
    return CATEGORY_ORDER
      .map((cat) => ({ cat, items: brand.items.filter((i) => i.category === cat) }))
      .filter((g) => g.items.length > 0);
  }, [brand]);

  const uniqueCategories = useMemo(() =>
    brand ? Array.from(new Set(brand.items.map((i) => i.category))) : [],
  [brand]);

  const displayError = tabsError ?? itemsError;

  const stockIn = useMutation({
    mutationFn: (d: { tabName: string; rowNumber: number; qty: number }) => cnfStockInFn({ data: d }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["cnf-items", currentTab] }),
  });
  const stockOut = useMutation({
    mutationFn: (d: { tabName: string; rowNumber: number; qty: number; day: number }) => cnfStockOutFn({ data: d }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["cnf-items", currentTab] }),
  });

  const addNewCnf = useMutation({
    mutationFn: (d: { tabName: string; brand: string; parts: { name: string; variants: string[] }[] }) =>
      addNewCnfFn({ data: d }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["cnf-items", currentTab] }),
  });

  // ─── Render ────────────────────────────────────────────────────────────────
  return (
    <div className="h-screen bg-ccb-canvas overflow-hidden">
      <div className="flex h-full bg-white">
        <Sidebar />
        <div className="flex-1 flex flex-col h-full overflow-hidden">

          {/* Header */}
          <div className="bg-white border-b border-ccb-border shrink-0">
            <div className="flex items-center justify-between px-8 py-4">
              <div className="flex items-center gap-3">
                <div>
                  <h1 className="text-[18px] font-bold leading-tight text-ccb-navy">CNF Monitoring</h1>
                  <p className="text-[12px] text-ccb-muted">Track Collar, Nameplate, and Footring inventory by brand</p>
                </div>
              </div>
              <div className="flex items-center gap-4">
                <div className="text-[11px] uppercase tracking-widest text-ccb-muted">CCB Inventory Clerk</div>
                <div className="h-9 w-9 rounded-full bg-gradient-to-br from-ccb-blue to-ccb-navy text-white flex items-center justify-center text-[12px] font-bold">AB</div>
              </div>
            </div>
            <div className="h-[3px] bg-ccb-red" />
          </div>

          {/* Period tabs */}
          <div className="border-b border-ccb-border bg-[#F8FAFF] px-8 pt-3 shrink-0">
            <div className="flex items-center gap-1 overflow-x-auto">
              {tabs.map((t) => (
                <button key={t} onClick={() => { setActivePeriod(t); setSelectedBrandId(""); setSelectedItemId(""); }}
                  className={`shrink-0 border-b-2 px-4 pb-3 text-xs font-bold uppercase tracking-wider transition-colors ${
                    currentTab === t ? "border-ccb-gold text-ccb-gold" : "border-transparent text-ccb-muted hover:text-ccb-navy"
                  }`}>{t}</button>
              ))}
            </div>
          </div>

          {/* Main body — KPI strip + two-panel layout */}
          <div className="flex-1 overflow-hidden flex flex-col bg-ccb-canvas">

            {isLoading ? (
              <div className="flex items-center justify-center h-full">
                <p className="text-ccb-muted animate-pulse">Loading CNF data...</p>
              </div>
            ) : displayError ? (
              <div className="flex items-center justify-center h-full">
                <p className="max-w-2xl text-center text-ccb-red">Failed to load CNF data: {displayError.message}</p>
              </div>
            ) : !brand ? (
              <div className="flex items-center justify-center h-full">
                <p className="text-ccb-muted">No CNF data found for {currentTab}</p>
              </div>
            ) : (
              <>
                {/* ── KPI strip (pinned, never scrolls) ── */}
                <div className="shrink-0 px-7 pt-5 pb-4 space-y-3">
                  <div className="flex items-center gap-2">
                    <p className="text-[10px] font-bold uppercase tracking-widest text-ccb-muted">
                      Selected: <span className="text-ccb-navy">{brand.name} — {selectedItem?.category} {selectedItem?.variant}</span>
                    </p>
                  </div>
                  <div className="grid grid-cols-4 gap-4">
                    <CnfKpi variant="blue"  label="Initial Stock"   value={selectedItem ? selectedItem.initialStock.toLocaleString() : "0"}   unit={selectedItem?.uom} />
                    <CnfKpi variant="blue3" label="Received"        value={selectedItem ? selectedItem.inQuantity.toLocaleString() : "0"}     unit={selectedItem?.uom} />
                    <CnfKpi variant="blue2" label="Current Balance" value={selectedItem ? selectedItem.currentBalance.toLocaleString() : "0"} unit={selectedItem?.uom} />
                    <CnfKpi variant="navy"  label="Issued"          value={selectedItem ? selectedItem.outQuantity.toLocaleString() : "0"}    unit={selectedItem?.uom} />
                  </div>
                </div>

                {/* ── Two-panel split (fills remaining height) ── */}
                <div className="flex-1 overflow-hidden flex gap-5 px-7 pb-7">

                  {/* LEFT — brand list panel */}
                  <div className="w-[260px] shrink-0 flex flex-col rounded-2xl bg-white shadow-sm ring-1 ring-ccb-border overflow-hidden">
                    {/* search header */}
                    <div className="shrink-0 border-b border-ccb-border bg-ccb-canvas/40 p-4">
                      <div className="relative">
                        <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-ccb-muted" />
                        <input value={search} onChange={(e) => setSearch(e.target.value)}
                          placeholder="Search brands..."
                          className="w-full rounded-md border border-ccb-border bg-white py-2 pl-10 pr-3 text-xs placeholder:text-ccb-muted focus:outline-none focus:ring-1 focus:ring-ccb-blue" />
                      </div>
                    </div>
                    {/* scrollable brand list */}
                    <div className="flex-1 overflow-y-auto divide-y divide-ccb-border">
                      {filteredBrands.map((b) => {
                        const isActive = b.id === selectedBrandId;
                        const cats = Array.from(new Set(b.items.map((i) => i.category)));
                        return (
                          <button key={b.id} onClick={() => {
                            setSelectedBrandId(b.id);
                            if (b.items[0]) setSelectedItemId(`${b.items[0].tabName}-${b.items[0].rowNumber}`);
                          }}
                            className={`w-full rounded-2xl border-r-4 p-4 text-left transition-all ${
                              isActive
                                ? "border-ccb-gold bg-[#FFF8D6] shadow-[0_4px_0_rgba(233,181,45,0.5),0_12px_32px_-10px_rgba(26,37,96,0.3)]"
                                : "border-transparent hover:border-ccb-gold/60 hover:bg-[#FFFBEA] hover:shadow-sm"
                            } `}>
                            <h3 className={`text-sm font-bold ${isActive ? "text-ccb-navy" : "text-ccb-navy/80"}`}>{b.name}</h3>
                            <p className="mt-0.5 text-[10px] uppercase tracking-widest text-ccb-muted">{cats.join(" · ")}</p>
                          </button>
                        );
                      })}
                    </div>
                  </div>

                  {/* RIGHT — category cards panel */}
                  <div className="flex-1 flex flex-col overflow-hidden rounded-2xl bg-white shadow-sm ring-1 ring-ccb-border">
                    {/* toolbar */}
                    <div className="shrink-0 flex items-center justify-between gap-3 border-b border-ccb-border bg-white px-5 py-3">
                      <div className="flex flex-wrap items-center gap-2">
                        <h2 className="text-sm font-bold text-ccb-navy">{brand.name} — Inventory Matrix</h2>
                        <span className="h-3.5 w-px bg-ccb-border" />
                        <span className="rounded px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider bg-ccb-gold/15 text-ccb-navy">
                          {uniqueCategories.length} {uniqueCategories.length === 1 ? "category" : "categories"}
                        </span>
                      </div>
                      <div className="flex shrink-0 items-center gap-2">
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
                          onClick={() => setAddNewCnfOpen(true)}
                          className="flex items-center gap-1.5 rounded-md border border-ccb-blue px-3 py-1.5 text-xs font-semibold text-ccb-blue hover:bg-ccb-blue hover:text-white transition-colors">
                          <Plus className="size-3.5" /> Add New CNF
                        </button>
                      </div>
                    </div>

                    {/* scrollable category cards */}
                    <div className="flex-1 overflow-y-auto p-5 space-y-4">
                      <CnfCategoryGrid
                        categories={categories}
                        selectedItemId={selectedItemId}
                        onSelect={setSelectedItemId}
                        onStockIn={(item) => setModal({ kind: "in", item })}
                        onStockOut={(item) => setModal({ kind: "out", item })}
                        onEllipsis={(item, e) => {
                          const rect = (e.currentTarget as HTMLElement).getBoundingClientRect();
                          setPopover({ item, x: rect.left - 320, y: rect.bottom + 5 });
                        }}
                      />
                    </div>
                  </div>

                </div>
              </>
            )}
          </div>
        </div>
      </div>

      {/* Modals */}
      {modal && (modal.kind === "in" || modal.kind === "out") && (
        <StockModal mode={modal.kind} item={modal.item}
          loading={modal.kind === "in" ? stockIn.isPending : stockOut.isPending}
          onClose={() => setModal(null)}
          onSave={(qty) => {
            if (modal.kind === "in") {
              stockIn.mutate({ tabName: modal.item.tabName, rowNumber: modal.item.rowNumber, qty },
                { onSuccess: () => setModal(null) });
            } else {
              stockOut.mutate({ tabName: modal.item.tabName, rowNumber: modal.item.rowNumber, qty, day: new Date().getDate() },
                { onSuccess: () => setModal(null) });
            }
          }} />
      )}
      {modal?.kind === "report" && (
        <CnfMonthlyReport item={modal.item} tabs={tabs} onClose={() => setModal(null)} />
      )}
      {modal?.kind === "edit" && (
        <CnfEditItem item={modal.item} onClose={() => setModal(null)}
          onSuccess={() => { qc.invalidateQueries({ queryKey: ["cnf-items", currentTab] }); setModal(null); }} />
      )}

      {/* Ellipsis Popover */}
      {popover && (
        <div style={{ top: popover.y, left: popover.x }}
          className="fixed z-30 w-[310px] rounded-2xl border border-ccb-border bg-white shadow-[0_20px_50px_-20px_rgba(26,37,96,0.35)]">
          <div className="flex items-center justify-between px-5 pt-4 pb-3">
            <div className="text-[13px] font-bold text-ccb-navy">Quick Actions</div>
            <button onClick={() => setPopover(null)} className="rounded-md p-1 text-ccb-muted hover:bg-ccb-canvas hover:text-ccb-navy">
              <X size={15} />
            </button>
          </div>
          <div className="px-3 pb-3 space-y-2">
            <button onClick={() => { setModal({ kind: "report", item: popover.item }); setPopover(null); }}
              className="w-full rounded-xl border border-ccb-border bg-white px-4 py-3 text-left transition-colors hover:bg-ccb-canvas hover:border-ccb-blue/50">
              <div className="text-[12.5px] font-bold text-ccb-navy">Monthly Daily Out Report</div>
              <div className="mt-0.5 text-[11px] text-ccb-muted">View daily issued quantities per day of the month</div>
            </button>
            <button onClick={() => { setModal({ kind: "edit", item: popover.item }); setPopover(null); }}
              className="w-full rounded-xl border border-ccb-border bg-white px-4 py-3 text-left transition-colors hover:bg-ccb-canvas hover:border-ccb-blue/50">
              <div className="text-[12.5px] font-bold text-ccb-navy">Edit CNF Details</div>
              <div className="mt-0.5 text-[11px] text-ccb-muted">Update variant, UOM, price and stock figures</div>
            </button>
          </div>
        </div>
      )}

      {/* Add New CNF Modal */}
      {addNewCnfOpen && (
        <AddNewCnfModal
          existingBrands={brands.map((b) => b.name)}
          saving={addNewCnf.isPending}
          onClose={() => setAddNewCnfOpen(false)}
          onSave={(payload) => {
            if (!currentTab) return;
            addNewCnf.mutate(
              { tabName: currentTab, brand: payload.brand, parts: payload.parts },
              {
                onSuccess: () => {
                  setAddNewCnfOpen(false);
                  const newId = payload.brand.toLowerCase().replace(/\s+/g, "-");
                  setSelectedBrandId(newId);
                },
              }
            );
          }}
        />
      )}
    </div>
  );
}

// ─── Category Grid Layout ────────────────────────────────────────────────────
// NAME PLATE → full-width top row (single variant)
// COLLAR + FOOT RING → side-by-side 2-col grid below
function CnfCategoryGrid({ categories, selectedItemId, onSelect, onStockIn, onStockOut, onEllipsis }: {
  categories: { cat: string; items: CnfItem[] }[];
  selectedItemId: string;
  onSelect: (id: string) => void;
  onStockIn: (item: CnfItem) => void;
  onStockOut: (item: CnfItem) => void;
  onEllipsis: (item: CnfItem, e: React.MouseEvent) => void;
}) {
  const nameplate = categories.find((c) => c.cat === "NAME PLATE");
  const rest = categories.filter((c) => c.cat !== "NAME PLATE");

  return (
    <div className="space-y-4">
      {nameplate && (
        <CategorySection
          category={nameplate.cat}
          items={nameplate.items}
          selectedItemId={selectedItemId}
          onSelect={onSelect}
          onStockIn={onStockIn}
          onStockOut={onStockOut}
          onEllipsis={onEllipsis}
        />
      )}
      {rest.length > 0 && (
        <div className="grid gap-4 md:grid-cols-2">
          {rest.map(({ cat, items }) => (
            <CategorySection
              key={cat}
              category={cat}
              items={items}
              selectedItemId={selectedItemId}
              onSelect={onSelect}
              onStockIn={onStockIn}
              onStockOut={onStockOut}
              onEllipsis={onEllipsis}
            />
          ))}
        </div>
      )}
    </div>
  );
}

function CategorySection({ category, items, selectedItemId, onSelect, onStockIn, onStockOut, onEllipsis }: {
  category: string; items: CnfItem[]; selectedItemId: string;
  onSelect: (id: string) => void;
  onStockIn: (item: CnfItem) => void;
  onStockOut: (item: CnfItem) => void;
  onEllipsis: (item: CnfItem, e: React.MouseEvent) => void;
}) {
  const total = items.reduce((s, i) => s + i.currentBalance, 0);
  return (
    <div className="rounded-xl border border-ccb-border bg-white overflow-hidden shadow-sm">
      {/* Category header */}
      <div className="flex items-center justify-between gap-3 border-b border-ccb-border bg-ccb-canvas/50 px-4 py-3">
        <div className="flex items-center gap-2">
          <div className="grid size-7 shrink-0 place-items-center rounded-md bg-ccb-navy/10">
            <ChevronRight className="size-3.5 text-ccb-navy" />
          </div>
          <div>
            <h4 className="text-xs font-bold uppercase tracking-wider text-ccb-navy">{category}</h4>
            <p className="text-[10px] text-ccb-muted">{items.length} {items.length === 1 ? "variant" : "variants"}</p>
          </div>
        </div>
        {total > 0 && (
          <span className="shrink-0 rounded-full bg-ccb-navy/10 px-2.5 py-0.5 text-[10px] font-bold text-ccb-navy">
            {total.toLocaleString()} in balance
          </span>
        )}
      </div>
      {/* Variant rows */}
      <div className="divide-y divide-ccb-border">
        {items.map((item, idx) => {
          const id = `${item.tabName}-${item.rowNumber}`;
          return (
            <div key={id} onClick={() => onSelect(id)}
              className={`group relative flex cursor-pointer items-center justify-between gap-4 rounded-2xl border px-4 py-3 transition-all ${
                selectedItemId === id
                  ? "border-ccb-gold bg-[#FFF8D6] shadow-[0_4px_0_rgba(233,181,45,0.5),0_12px_32px_-10px_rgba(26,37,96,0.3)]"
                  : idx % 2 === 1 ? "bg-ccb-canvas/30" : "bg-white hover:border-ccb-gold/60 hover:bg-[#FFFBEA] hover:shadow-sm"
              }`}>
              <p className="text-xs font-bold text-ccb-navy">{item.variant}</p>
              <div className="flex shrink-0 items-center gap-2" onClick={(e) => e.stopPropagation()}>
                <button onClick={() => onStockIn(item)}
                  className="rounded-full border border-ccb-border px-3 py-1 text-[11px] font-semibold text-ccb-navy hover:border-ccb-blue hover:text-ccb-blue transition-colors">
                  Stock In +
                </button>
                <button onClick={() => onStockOut(item)}
                  className="rounded-full border border-ccb-border px-3 py-1 text-[11px] font-semibold text-ccb-navy hover:border-ccb-red hover:text-ccb-red transition-colors">
                  Stock Out −
                </button>
                <button className="rounded-full p-1.5 text-ccb-muted-2 hover:bg-ccb-canvas hover:text-ccb-navy transition-colors"
                  onClick={(e) => { e.stopPropagation(); onEllipsis(item, e); }}>
                  <MoreVertical size={15} />
                </button>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

// ─── KPI Card (same style as Material Monitoring) ───────────────────────────
function CnfKpi({ label, value, unit, variant }: {
  label: string; value: string; unit?: string;
  variant: "blue" | "blue2" | "blue3" | "navy";
}) {
  const styles = {
    blue:  "bg-[#2E3EA8] text-white",
    blue3: "bg-[#273690] text-white",
    blue2: "bg-[#202D78] text-white",
    navy:  "bg-[#1A2560] text-white",
  }[variant];
  return (
    <div className={`relative overflow-hidden rounded-2xl p-5 shadow-sm ${styles}`}>
      <div className="text-[10px] font-semibold uppercase tracking-[0.16em] text-white/70">{label}</div>
      <div className="mt-3 flex items-baseline gap-2">
        <div className="text-[30px] font-extrabold leading-none">{value}</div>
        {unit && <div className="text-[12px] font-semibold uppercase tracking-widest text-white/80">{unit}</div>}
      </div>
      <div className="pointer-events-none absolute -right-6 -bottom-6 h-24 w-24 rounded-full bg-white/5" />
    </div>
  );
}

// ─── Stock Modal ─────────────────────────────────────────────────────────────
function StockModal({ mode, item, loading, onClose, onSave }: {
  mode: "in" | "out"; item: CnfItem; loading: boolean;
  onClose: () => void; onSave: (qty: number) => void;
}) {
  const [qty, setQty] = useState(1);
  const isIn = mode === "in";
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-ccb-navy/50 p-6 backdrop-blur-sm" onClick={onClose}>
      <div className="w-full max-w-sm overflow-hidden rounded-2xl bg-white shadow-xl" onClick={(e) => e.stopPropagation()}>
        <div className={`border-b-[3px] px-6 pb-5 pt-6 ${isIn ? "border-ccb-blue" : "border-ccb-red"}`}>
          <div className="flex items-start justify-between">
            <div>
              <p className="text-[10px] font-semibold uppercase tracking-widest text-ccb-muted">{isIn ? "Stock-In" : "Stock-Out"}</p>
              <h2 className="mt-1 text-lg font-bold text-ccb-navy">{isIn ? "Add Received Qty" : "Issue Stock"}</h2>
              <p className="mt-1 text-xs text-ccb-muted">{item.brand} — {item.category} {item.variant}</p>
            </div>
            <button onClick={onClose} className="rounded-md p-1 text-ccb-muted hover:bg-ccb-canvas"><X size={18} /></button>
          </div>
        </div>
        <div className="p-6">
          <div className="flex items-center justify-center gap-4">
            <button onClick={() => setQty(Math.max(1, qty - 1))} disabled={loading}
              className="h-12 w-12 rounded-full border border-ccb-border text-ccb-navy hover:border-ccb-blue disabled:opacity-50">
              <Minus size={18} className="mx-auto" />
            </button>
            <input type="number" value={qty} onChange={(e) => setQty(Math.max(1, Number(e.target.value) || 1))}
              className="w-32 rounded-xl border border-ccb-border py-3 text-center text-[28px] font-extrabold text-ccb-navy outline-none focus:border-ccb-blue [appearance:textfield] [&::-webkit-inner-spin-button]:appearance-none [&::-webkit-outer-spin-button]:appearance-none" />
            <button onClick={() => setQty(qty + 1)} disabled={loading}
              className="h-12 w-12 rounded-full border border-ccb-border text-ccb-navy hover:border-ccb-blue disabled:opacity-50">
              <Plus size={18} className="mx-auto" />
            </button>
          </div>
        </div>
        <div className="flex items-center justify-end gap-2 border-t border-ccb-border bg-ccb-canvas/60 px-6 py-4">
          <button onClick={onClose} disabled={loading} className="rounded-lg border border-ccb-border bg-white px-5 py-2 text-[12.5px] font-semibold text-ccb-navy hover:bg-ccb-canvas disabled:opacity-50">Cancel</button>
          <button onClick={() => onSave(qty)} disabled={loading}
            className={`rounded-lg px-5 py-2 text-[12.5px] font-semibold text-white disabled:opacity-50 ${isIn ? "bg-ccb-blue hover:bg-ccb-navy" : "bg-ccb-red hover:bg-red-700"}`}>
            {loading ? "Saving..." : "Save"}
          </button>
        </div>
      </div>
    </div>
  );
}

// ─── CNF Monthly Report ──────────────────────────────────────────────────────
function CnfMonthlyReport({ item, tabs, onClose }: {
  item: CnfItem; tabs: string[]; onClose: () => void;
}) {
  const [month, setMonth] = useState(item.tabName);

  const { data: items = [], isLoading } = useQuery({
    queryKey: ["cnf-items", month],
    queryFn: () => getCnfItemsFn({ data: month }),
  });

  const matched = useMemo(() =>
    items.find((i) => i.rowNumber === item.rowNumber && i.brand === item.brand) ?? null,
  [items, item]);

  const days = useMemo(() => {
    const cols = matched?.dateColumns ?? [];
    // Ensure exactly 31 entries (K–AO)
    const padded = Array(31).fill(0);
    cols.slice(0, 31).forEach((v: number, i: number) => { padded[i] = v; });
    return padded;
  }, [matched]);

  const total = useMemo(() => matched?.totalIssued ?? days.reduce((a: number, b: number) => a + b, 0), [matched, days]);
  const active = useMemo(() => days.filter((d: number) => d > 0).length, [days]);
  const peakIdx = useMemo(() => { const m = Math.max(...days); return m > 0 ? days.indexOf(m) : -1; }, [days]);
  const avg = useMemo(() => active ? (total / active).toFixed(1) : "0.0", [total, active]);
  const max = useMemo(() => Math.max(...days) || 1, [days]);

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-ccb-navy/50 backdrop-blur-sm p-6" onClick={onClose}>
      <div onClick={(e) => e.stopPropagation()} style={{ width: 580 }}
        className="max-h-[90vh] overflow-hidden rounded-[20px] bg-white shadow-[0_30px_80px_-20px_rgba(26,37,96,0.6)]">
        <div className="border-b border-ccb-border px-6 pt-6 pb-5">
          <div className="flex items-start justify-between">
            <div>
              <div className="text-[10px] font-semibold uppercase tracking-[0.14em] text-ccb-muted">Daily Issue Report</div>
              <h2 className="mt-1 text-[17px] font-bold text-ccb-navy">{item.brand} — {item.category} {item.variant}</h2>
              <p className="mt-1 text-[12px] text-ccb-muted">Daily issued quantities for {month}</p>
            </div>
            <button onClick={onClose} className="rounded-md p-1 text-ccb-muted hover:bg-ccb-canvas hover:text-ccb-navy"><X size={18} /></button>
          </div>
          <div className="mt-4 flex items-center justify-between gap-3">
            <div className="relative">
              <select value={month} onChange={(e) => setMonth(e.target.value)}
                className="appearance-none rounded-lg border border-ccb-border bg-white pl-3 pr-9 py-2 text-[12.5px] font-semibold text-ccb-navy outline-none focus:border-ccb-blue">
                {tabs.map((t) => <option key={t}>{t}</option>)}
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
          <div className="h-[250px] flex items-center justify-center text-ccb-muted text-[13px]">Loading daily data...</div>
        ) : (
          <>
            <div className="px-6 pt-5">
              <div className="grid grid-cols-3 gap-3">
                {[
                  { l: "Peak Day", v: peakIdx !== -1 ? `Day ${String(peakIdx + 1).padStart(2, "0")}` : "--" },
                  { l: "Active Days", v: String(active) },
                  { l: "Avg / Active Day", v: avg },
                ].map((s) => (
                  <div key={s.l} className="rounded-xl border border-ccb-border bg-ccb-canvas/60 p-3">
                    <div className="text-[9.5px] font-semibold uppercase tracking-[0.14em] text-ccb-muted">{s.l}</div>
                    <div className="mt-1 text-[18px] font-extrabold text-ccb-navy">{s.v}</div>
                  </div>
                ))}
              </div>
            </div>
            <div className="max-h-[340px] overflow-y-auto px-6 py-4 space-y-1.5">
              {days.map((q: number, i: number) => {
                const dim = q === 0;
                const pct = (q / max) * 100;
                return (
                  <div key={i} className={`flex items-center gap-3 rounded-lg px-2 py-1.5 ${dim ? "opacity-45" : ""}`}>
                    <div className="w-[58px] rounded-md bg-ccb-canvas px-2 py-1 text-center text-[10px] font-bold tracking-widest text-ccb-navy">
                      DAY {String(i + 1).padStart(2, "0")}
                    </div>
                    <div className="flex-1 h-3 rounded-full bg-ccb-canvas overflow-hidden">
                      <div className="h-full rounded-full bg-gradient-to-r from-ccb-blue to-[#4B5FCB]" style={{ width: `${dim ? 0 : pct}%` }} />
                    </div>
                    <div className={`w-10 text-right text-[12.5px] font-bold ${dim ? "text-ccb-muted-2" : "text-ccb-navy"}`}>{q === 0 ? "—" : q}</div>
                  </div>
                );
              })}
            </div>
          </>
        )}
        <div className="flex items-center justify-end gap-2 border-t border-ccb-border bg-ccb-canvas/60 px-6 py-4">
          <button onClick={onClose} className="rounded-lg border border-ccb-border bg-white px-5 py-2 text-[12.5px] font-semibold text-ccb-navy hover:bg-ccb-canvas">Close</button>
        </div>
      </div>
    </div>
  );
}

// ─── CNF Edit Item ────────────────────────────────────────────────────────────
function CnfEditItem({ item, onClose, onSuccess }: {
  item: CnfItem; onClose: () => void; onSuccess: () => void;
}) {
  const [variant, setVariant] = useState(item.variant);
  const [uom, setUom] = useState(item.uom);
  const [price, setPrice] = useState(String(item.price || ""));
  const [initialStock, setInitialStock] = useState(item.initialStock);
  const [inQuantity, setInQuantity] = useState(item.inQuantity);
  const [currentBalance, setCurrentBalance] = useState(item.currentBalance);
  const [outQuantity, setOutQuantity] = useState(item.outQuantity);
  const [isSaving, setIsSaving] = useState(false);

  const handleSave = async () => {
    setIsSaving(true);
    try {
      await cnfEditItemFn({
        data: {
          tabName: item.tabName,
          rowNumber: item.rowNumber,
          values: { variant, uom, price: parseFloat(price) || 0, initialStock, inQuantity, currentBalance, outQuantity },
        },
      });
      onSuccess();
    } catch (e) {
      console.error(e);
      alert("Failed to save. Check sheet range values.");
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-ccb-navy/50 backdrop-blur-sm p-6" onClick={onClose}>
      <div onClick={(e) => e.stopPropagation()} style={{ width: 620 }}
        className="max-h-[90vh] overflow-hidden rounded-[20px] bg-white shadow-[0_30px_80px_-20px_rgba(26,37,96,0.6)]">
        <div className="border-b border-ccb-border px-7 pt-5 pb-4 flex items-start justify-between">
          <div>
            <h2 className="text-[18px] font-bold text-ccb-navy">Edit CNF Details</h2>
            <p className="mt-1 text-[12px] text-ccb-muted">{item.brand} — {item.category} {item.variant}</p>
          </div>
          <button onClick={onClose} disabled={isSaving} className="rounded-md p-1 text-ccb-muted hover:bg-ccb-canvas hover:text-ccb-navy"><X size={18} /></button>
        </div>
        <div className="px-7 pt-4 pb-2">
          <div className="rounded-xl bg-gradient-to-br from-ccb-navy to-ccb-blue px-5 py-3 text-white">
            <div className="text-[10px] font-semibold uppercase tracking-[0.18em] text-white/70">CNF Details Editor</div>
            <div className="text-[13px] font-bold">Edit variant, pricing and inventory figures</div>
          </div>
        </div>
        <div className="grid grid-cols-2 gap-4 px-7 py-4">
          <div className="rounded-2xl border border-ccb-border bg-white p-4 space-y-3">
            <div className="flex items-center gap-2 mb-1"><span className="h-4 w-1 rounded-sm bg-ccb-gold" /><div className="text-[12.5px] font-bold text-ccb-navy">Item Identity</div></div>
            <CnfField label="Variant" value={variant} onChange={setVariant} />
            <CnfField label="UOM" value={uom} onChange={setUom} />
            <CnfField label="Price / Unit" value={price} onChange={setPrice} />
          </div>
          <div className="rounded-2xl border border-ccb-border bg-white p-4 space-y-3">
            <div className="flex items-center gap-2 mb-1"><span className="h-4 w-1 rounded-sm bg-ccb-gold" /><div className="text-[12.5px] font-bold text-ccb-navy">Inventory Figures</div></div>
            <CnfField label="Initial Stock" type="number" value={String(initialStock)} onChange={(v) => { const n = Number(v) || 0; setInitialStock(n); setCurrentBalance(n + inQuantity - outQuantity); }} />
            <CnfField label="In Quantity" type="number" value={String(inQuantity)} onChange={(v) => { const n = Number(v) || 0; setInQuantity(n); setCurrentBalance(initialStock + n - outQuantity); }} />
            <CnfField label="Current Balance" type="number" value={String(currentBalance)} onChange={(v) => setCurrentBalance(Number(v) || 0)} />
            <CnfField label="Out Quantity" type="number" value={String(outQuantity)} onChange={(v) => { const n = Number(v) || 0; setOutQuantity(n); setCurrentBalance(initialStock + inQuantity - n); }} />
          </div>
        </div>
        <div className="flex items-center justify-end gap-2 border-t border-ccb-border bg-ccb-canvas/60 px-7 py-4">
          <button onClick={onClose} disabled={isSaving} className="rounded-lg border border-ccb-border bg-white px-5 py-2 text-[12.5px] font-semibold text-ccb-navy hover:bg-ccb-canvas disabled:opacity-50">Cancel</button>
          <button onClick={handleSave} disabled={isSaving} className="rounded-lg bg-ccb-blue px-5 py-2 text-[12.5px] font-semibold text-white hover:bg-ccb-navy disabled:opacity-50">
            {isSaving ? "Saving..." : "Save Changes"}
          </button>
        </div>
      </div>
    </div>
  );
}

function CnfField({ label, value, onChange, type = "text" }: {
  label: string; value: string; onChange: (v: string) => void; type?: string;
}) {
  return (
    <label className="block">
      <span className="text-[10px] font-semibold uppercase tracking-[0.14em] text-ccb-muted">{label}</span>
      <input type={type} value={value} onChange={(e) => onChange(e.target.value)}
        className="mt-1 w-full rounded-lg border border-ccb-border bg-white px-3 py-2 text-[13px] text-ccb-navy outline-none focus:border-ccb-blue" />
    </label>
  );
}

// ─── Add New CNF Modal ───────────────────────────────────────────────────────

type NewPart = { id: string; name: string; variants: { id: string; value: string }[] };
type NewCnfPayload = { brand: string; parts: { name: string; variants: string[] }[] };

const STANDARD_PARTS = (brandName: string): NewPart[] => [
  { id: "p-collar",   name: "COLLAR",     variants: [{ id: "v-11", value: "11kgs" }, { id: "v-22", value: "22kgs" }, { id: "v-50", value: "50kgs" }] },
  { id: "p-nameplate",name: "NAME PLATE", variants: [{ id: "v-np", value: brandName }] },
  { id: "p-footring", name: "FOOT RING",  variants: [{ id: "v-f11", value: "11kgs" }, { id: "v-f22", value: "22kgs" }, { id: "v-f50", value: "50kgs" }] },
];

function uid() { return Math.random().toString(36).slice(2, 9); }

function emptyParts(): NewPart[] {
  return [{ id: uid(), name: "", variants: [{ id: uid(), value: "" }] }];
}

function AddNewCnfModal({ existingBrands, saving = false, onClose, onSave }: {
  existingBrands: string[];
  saving?: boolean;
  onClose: () => void;
  onSave: (payload: NewCnfPayload) => void;
}) {
  const [brandName, setBrandName] = useState("");
  const [useTemplate, setUseTemplate] = useState(true);
  const [parts, setParts] = useState<NewPart[]>(emptyParts());
  const [errors, setErrors] = useState<Record<string, string>>({});

  // When template is on and brand name changes, regenerate parts
  useEffect(() => {
    if (!useTemplate) return;
    if (!brandName.trim()) {
      setParts(emptyParts());
      return;
    }
    setParts(STANDARD_PARTS(brandName.trim()));
  }, [brandName, useTemplate]);

  // When template toggled off, keep current; when toggled on, regenerate
  const handleTemplateToggle = (checked: boolean) => {
    setUseTemplate(checked);
    if (checked && brandName.trim()) {
      setParts(STANDARD_PARTS(brandName.trim()));
    } else if (!checked) {
      setParts(emptyParts());
    }
  };

  const updatePartName = useCallback((partId: string, name: string) => {
    setParts((prev) => prev.map((p) => p.id === partId ? { ...p, name } : p));
  }, []);

  const addVariant = useCallback((partId: string) => {
    setParts((prev) => prev.map((p) =>
      p.id === partId ? { ...p, variants: [...p.variants, { id: uid(), value: "" }] } : p
    ));
  }, []);

  const updateVariant = useCallback((partId: string, varId: string, value: string) => {
    setParts((prev) => prev.map((p) =>
      p.id === partId ? { ...p, variants: p.variants.map((v) => v.id === varId ? { ...v, value } : v) } : p
    ));
  }, []);

  const removeVariant = useCallback((partId: string, varId: string) => {
    setParts((prev) => prev.map((p) =>
      p.id === partId ? { ...p, variants: p.variants.filter((v) => v.id !== varId) } : p
    ));
  }, []);

  const addPart = useCallback(() => {
    setParts((prev) => [...prev, { id: uid(), name: "", variants: [{ id: uid(), value: "" }] }]);
  }, []);

  const removePart = useCallback((partId: string) => {
    setParts((prev) => prev.filter((p) => p.id !== partId));
  }, []);

  const validate = (): boolean => {
    const errs: Record<string, string> = {};

    if (!brandName.trim()) {
      errs["brand"] = "Brand name is required.";
    } else if (existingBrands.some((b) => b.toLowerCase() === brandName.trim().toLowerCase())) {
      errs["brand"] = `Brand "${brandName.trim()}" already exists.`;
    }

    const partNames = parts.map((p) => p.name.trim().toLowerCase());
    parts.forEach((part, pi) => {
      if (!part.name.trim()) {
        errs[`part-${part.id}`] = "Part name is required.";
      } else if (partNames.indexOf(part.name.trim().toLowerCase()) !== pi) {
        errs[`part-${part.id}`] = `Duplicate part name "${part.name.trim()}".`;
      }
      const varVals = part.variants.map((v) => v.value.trim().toLowerCase());
      part.variants.forEach((v, vi) => {
        if (!v.value.trim()) {
          errs[`var-${v.id}`] = "Variant is required.";
        } else if (varVals.indexOf(v.value.trim().toLowerCase()) !== vi) {
          errs[`var-${v.id}`] = `Duplicate variant "${v.value.trim()}".`;
        }
      });
    });

    setErrors(errs);
    return Object.keys(errs).length === 0;
  };

  const handleSave = () => {
    if (!validate()) return;
    onSave({
      brand: brandName.trim(),
      parts: parts.map((p) => ({ name: p.name.trim(), variants: p.variants.map((v) => v.value.trim()) })),
    });
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-ccb-navy/50 p-6 backdrop-blur-sm" onClick={onClose}>
      <div onClick={(e) => e.stopPropagation()}
        className="w-full max-w-2xl max-h-[90vh] flex flex-col overflow-hidden rounded-[20px] bg-white shadow-[0_30px_80px_-20px_rgba(26,37,96,0.6)]">

        {/* Header */}
        <div className="border-b-[3px] border-ccb-blue px-6 pt-6 pb-5 shrink-0">
          <div className="flex items-start justify-between">
            <div>
              <p className="text-[10px] font-semibold uppercase tracking-widest text-ccb-muted">New Entry</p>
              <h2 className="mt-1 text-[18px] font-bold text-ccb-navy">Add New CNF</h2>
              <p className="mt-1 text-[12px] text-ccb-muted">Create a new brand with its parts and variants.</p>
            </div>
            <button onClick={onClose} className="rounded-md p-1 text-ccb-muted hover:bg-ccb-canvas hover:text-ccb-navy"><X size={18} /></button>
          </div>
        </div>

        {/* Scrollable body */}
        <div className="flex-1 overflow-y-auto px-6 py-5 space-y-5">

          {/* Brand Information */}
          <div className="rounded-2xl border border-ccb-border bg-ccb-canvas/50 p-5 space-y-4">
            <div className="flex items-center gap-2">
              <span className="h-4 w-1 rounded-sm bg-ccb-gold" />
              <div className="text-[12.5px] font-bold text-ccb-navy">Brand Information</div>
            </div>
            <div>
              <label className="block text-[10px] font-semibold uppercase tracking-[0.14em] text-ccb-muted mb-1">
                Brand Name <span className="text-ccb-red">*</span>
              </label>
              <input
                value={brandName}
                onChange={(e) => setBrandName(e.target.value)}
                placeholder="e.g. RAPID, AKXEL, COASTAL..."
                className={`w-full rounded-lg border px-3 py-2.5 text-[13px] text-ccb-navy outline-none focus:ring-1 focus:ring-ccb-blue ${
                  errors["brand"] ? "border-ccb-red bg-red-50" : "border-ccb-border bg-white focus:border-ccb-blue"
                }`}
              />
              {errors["brand"] && <p className="mt-1 text-[11px] text-ccb-red">{errors["brand"]}</p>}
            </div>
            {/* Template checkbox */}
            <label className="flex cursor-pointer items-center gap-3 rounded-xl border border-ccb-border bg-white px-4 py-3 transition-colors hover:bg-ccb-canvas/60">
              <div className={`flex h-5 w-5 shrink-0 items-center justify-center rounded border-2 transition-colors ${
                useTemplate ? "border-ccb-blue bg-ccb-blue" : "border-ccb-border bg-white"
              }`}>
                {useTemplate && <svg viewBox="0 0 10 8" className="h-3 w-3 fill-none stroke-white stroke-2"><polyline points="1 4 4 7 9 1" /></svg>}
              </div>
              <input type="checkbox" checked={useTemplate} onChange={(e) => handleTemplateToggle(e.target.checked)} className="sr-only" />
              <div>
                <div className="text-[12.5px] font-semibold text-ccb-navy">Use Standard CNF Template</div>
                <div className="text-[11px] text-ccb-muted">Auto-generates Collar, Name Plate, and Foot Ring with standard variants</div>
              </div>
            </label>
          </div>

          {/* Parts */}
          <div className="space-y-3">
            <div className="flex items-center gap-2">
              <span className="h-4 w-1 rounded-sm bg-ccb-gold" />
              <div className="text-[12.5px] font-bold text-ccb-navy">Parts</div>
            </div>
            {parts.map((part, pi) => (
              <PartCard
                key={part.id}
                part={part}
                partIndex={pi}
                canDelete={parts.length > 1}
                errors={errors}
                onPartNameChange={(name) => updatePartName(part.id, name)}
                onAddVariant={() => addVariant(part.id)}
                onUpdateVariant={(varId, val) => updateVariant(part.id, varId, val)}
                onRemoveVariant={(varId) => removeVariant(part.id, varId)}
                onDelete={() => removePart(part.id)}
              />
            ))}
            <button
              onClick={addPart}
              className="flex w-full items-center justify-center gap-2 rounded-xl border border-dashed border-ccb-border py-3 text-[12.5px] font-semibold text-ccb-muted transition-colors hover:border-ccb-blue hover:text-ccb-blue">
              <Plus size={15} /> Add Another Part
            </button>
          </div>
        </div>

        {/* Footer */}
        <div className="shrink-0 flex items-center justify-end gap-2 border-t border-ccb-border bg-ccb-canvas/60 px-6 py-4">
          <button onClick={onClose} disabled={saving} className="rounded-lg border border-ccb-border bg-white px-5 py-2 text-[12.5px] font-semibold text-ccb-navy hover:bg-ccb-canvas disabled:opacity-50">
            Cancel
          </button>
          <button onClick={handleSave} disabled={saving} className="rounded-lg bg-ccb-blue px-5 py-2 text-[12.5px] font-semibold text-white hover:bg-ccb-navy disabled:opacity-50">
            {saving ? "Saving..." : "Save"}
          </button>
        </div>
      </div>
    </div>
  );
}

// ─── PartCard ────────────────────────────────────────────────────────────────
function PartCard({ part, partIndex, canDelete, errors, onPartNameChange, onAddVariant, onUpdateVariant, onRemoveVariant, onDelete }: {
  part: NewPart;
  partIndex: number;
  canDelete: boolean;
  errors: Record<string, string>;
  onPartNameChange: (name: string) => void;
  onAddVariant: () => void;
  onUpdateVariant: (varId: string, val: string) => void;
  onRemoveVariant: (varId: string) => void;
  onDelete: () => void;
}) {
  return (
    <div className="rounded-2xl border border-ccb-border bg-white p-5 space-y-4 shadow-sm">
      {/* Part header */}
      <div className="flex items-center justify-between gap-3">
        <div className="flex items-center gap-2">
          <div className="grid h-6 w-6 place-items-center rounded-md bg-ccb-navy/10 text-[11px] font-bold text-ccb-navy">
            {partIndex + 1}
          </div>
          <span className="text-[12px] font-bold uppercase tracking-wider text-ccb-navy">Part</span>
        </div>
        {canDelete && (
          <button onClick={onDelete}
            className="flex items-center gap-1 rounded-md px-2 py-1 text-[11px] font-semibold text-ccb-red/70 hover:bg-red-50 hover:text-ccb-red transition-colors">
            <Trash2 size={13} /> Delete Part
          </button>
        )}
      </div>

      {/* Part name input */}
      <div>
        <label className="block text-[10px] font-semibold uppercase tracking-[0.14em] text-ccb-muted mb-1">
          Part Name <span className="text-ccb-red">*</span>
        </label>
        <input
          value={part.name}
          onChange={(e) => onPartNameChange(e.target.value)}
          placeholder="e.g. COLLAR, NAME PLATE, FOOT RING..."
          className={`w-full rounded-lg border px-3 py-2.5 text-[13px] text-ccb-navy outline-none focus:ring-1 focus:ring-ccb-blue ${
            errors[`part-${part.id}`] ? "border-ccb-red bg-red-50" : "border-ccb-border bg-white focus:border-ccb-blue"
          }`}
        />
        {errors[`part-${part.id}`] && <p className="mt-1 text-[11px] text-ccb-red">{errors[`part-${part.id}`]}</p>}
      </div>

      {/* Variants */}
      <div className="space-y-2">
        <label className="block text-[10px] font-semibold uppercase tracking-[0.14em] text-ccb-muted">
          Variants <span className="text-ccb-red">*</span>
        </label>
        {part.variants.map((v) => (
          <VariantInput
            key={v.id}
            variantId={v.id}
            value={v.value}
            canDelete={part.variants.length > 1}
            error={errors[`var-${v.id}`]}
            onChange={(val) => onUpdateVariant(v.id, val)}
            onRemove={() => onRemoveVariant(v.id)}
          />
        ))}
        <button
          onClick={onAddVariant}
          className="flex items-center gap-1.5 rounded-md border border-dashed border-ccb-border px-3 py-1.5 text-[11.5px] font-semibold text-ccb-muted transition-colors hover:border-ccb-blue hover:text-ccb-blue">
          <Plus size={13} /> Add Variant
        </button>
      </div>
    </div>
  );
}

// ─── VariantInput ─────────────────────────────────────────────────────────────
function VariantInput({ variantId, value, canDelete, error, onChange, onRemove }: {
  variantId: string;
  value: string;
  canDelete: boolean;
  error?: string;
  onChange: (val: string) => void;
  onRemove: () => void;
}) {
  return (
    <div className="space-y-0.5">
      <div className="flex items-center gap-2">
        <input
          value={value}
          onChange={(e) => onChange(e.target.value)}
          placeholder="e.g. 11kgs, 22kgs, RAPID..."
          className={`flex-1 rounded-lg border px-3 py-2 text-[13px] text-ccb-navy outline-none focus:ring-1 focus:ring-ccb-blue ${
            error ? "border-ccb-red bg-red-50" : "border-ccb-border bg-white focus:border-ccb-blue"
          }`}
        />
        {canDelete && (
          <button onClick={onRemove}
            className="shrink-0 rounded-md p-1.5 text-ccb-muted hover:bg-red-50 hover:text-ccb-red transition-colors">
            <Trash2 size={14} />
          </button>
        )}
      </div>
      {error && <p className="text-[11px] text-ccb-red">{error}</p>}
    </div>
  );
}
