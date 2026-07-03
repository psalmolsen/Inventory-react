import { useMemo, useState } from "react";
import {
  Boxes,
  Circle,
  Factory,
  LogOut,
  Package,
  Search,
  Settings2,
  ArrowUpRight,
  ArrowDownRight,
  Plus,
  ChevronRight,
} from "lucide-react";

// ─── Types ──────────────────────────────────────────────────────────────────
type Variant = {
  id: string;
  weight: string;
  label: string;
  received: number;
  issued: number;
  balance: number;
  price: number; // PHP per unit
};

type Category = {
  id: string;
  name: string;
  code: string;
  variants: Variant[];
};

type Brand = {
  id: string;
  name: string;
  tagline: string;
  status: "primary" | "secondary" | "legacy";
  categories: Category[];
};

// ─── Mock data (extensible: brands may add categories & variants freely) ────
const BRANDS: Brand[] = [
  {
    id: "rapid",
    name: "RAPID",
    tagline: "Primary supplier — industrial & residential",
    status: "primary",
    categories: [
      {
        id: "rapid-collar",
        name: "Collar",
        code: "CNF-C100",
        variants: [
          { id: "r-c-11", weight: "11 kgs", label: "V-Series", received: 450, issued: 312, balance: 138, price: 85 },
          { id: "r-c-22", weight: "22 kgs", label: "V-Series", received: 200, issued: 185, balance: 15, price: 145 },
          { id: "r-c-50", weight: "50 kgs", label: "Heavy Duty", received: 120, issued: 70, balance: 50, price: 260 },
        ],
      },
      {
        id: "rapid-nameplate",
        name: "Nameplate",
        code: "CNF-N200",
        variants: [
          { id: "r-n-11", weight: "11 kgs", label: "Stamped", received: 480, issued: 410, balance: 70, price: 32 },
          { id: "r-n-22", weight: "22 kgs", label: "Stamped", received: 240, issued: 175, balance: 65, price: 44 },
          { id: "r-n-50", weight: "50 kgs", label: "Etched", received: 90, issued: 55, balance: 35, price: 78 },
        ],
      },
      {
        id: "rapid-footring",
        name: "Footring",
        code: "CNF-F300",
        variants: [
          { id: "r-f-11", weight: "11 kgs", label: "Standard", received: 420, issued: 260, balance: 160, price: 55 },
          { id: "r-f-22", weight: "22 kgs", label: "Standard", received: 210, issued: 145, balance: 65, price: 82 },
          { id: "r-f-50", weight: "50 kgs", label: "Reinforced", received: 100, issued: 82, balance: 18, price: 165 },
        ],
      },
    ],
  },
  {
    id: "coastal",
    name: "COASTAL",
    tagline: "Maritime & coastal region cylinders",
    status: "secondary",
    categories: [
      {
        id: "coastal-collar",
        name: "Collar",
        code: "CNF-C110",
        variants: [
          { id: "c-c-22", weight: "22 kgs", label: "Marine-Grade", received: 180, issued: 140, balance: 40, price: 168 },
          { id: "c-c-50", weight: "50 kgs", label: "Marine-Grade", received: 90, issued: 60, balance: 30, price: 295 },
        ],
      },
      {
        id: "coastal-nameplate",
        name: "Nameplate",
        code: "CNF-N210",
        variants: [
          { id: "c-n-22", weight: "22 kgs", label: "Anti-Corrosive", received: 150, issued: 120, balance: 30, price: 48 },
          { id: "c-n-50", weight: "50 kgs", label: "Anti-Corrosive", received: 60, issued: 42, balance: 18, price: 86 },
        ],
      },
      {
        id: "coastal-footring",
        name: "Footring",
        code: "CNF-F310",
        variants: [
          { id: "c-f-22", weight: "22 kgs", label: "Rubberised", received: 160, issued: 95, balance: 65, price: 92 },
          { id: "c-f-50", weight: "50 kgs", label: "Rubberised", received: 70, issued: 48, balance: 22, price: 178 },
        ],
      },
    ],
  },
  {
    id: "elite",
    name: "ELITE PRIME",
    tagline: "Legacy high-pressure series (stock only)",
    status: "legacy",
    categories: [
      {
        id: "elite-collar",
        name: "Collar",
        code: "CNF-C900",
        variants: [
          { id: "e-c-50", weight: "50 kgs", label: "HP-Legacy", received: 0, issued: 12, balance: 40, price: 320 },
        ],
      },
    ],
  },
];

const PERIODS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];

const php = (n: number) =>
  "₱ " + n.toLocaleString("en-PH", { minimumFractionDigits: 2, maximumFractionDigits: 2 });

// ─── Component ──────────────────────────────────────────────────────────────
export default function CNFMonitoring() {
  const [selectedBrandId, setSelectedBrandId] = useState<string>(BRANDS[0].id);
  const [selectedVariantId, setSelectedVariantId] = useState<string>(BRANDS[0].categories[0].variants[0].id);
  const [activePeriod, setActivePeriod] = useState<string>("Aug");
  const [range, setRange] = useState<"Monthly" | "Yearly">("Monthly");
  const [search, setSearch] = useState("");

  const brand = BRANDS.find((b) => b.id === selectedBrandId) ?? BRANDS[0];

  const { selectedVariant, selectedCategory } = useMemo(() => {
    for (const c of brand.categories) {
      const v = c.variants.find((v) => v.id === selectedVariantId);
      if (v) return { selectedVariant: v, selectedCategory: c };
    }
    const c = brand.categories[0];
    return { selectedVariant: c.variants[0], selectedCategory: c };
  }, [brand, selectedVariantId]);

  const brandTotals = useMemo(() => {
    const flat = brand.categories.flatMap((c) => c.variants);
    const received = flat.reduce((s, v) => s + v.received, 0);
    const issued = flat.reduce((s, v) => s + v.issued, 0);
    const balance = flat.reduce((s, v) => s + v.balance, 0);
    const initial = balance + issued - received;
    return { received, issued, balance, initial };
  }, [brand]);

  const filteredBrands = BRANDS.filter((b) =>
    (b.name + b.tagline + b.categories.map((c) => c.name).join(" "))
      .toLowerCase()
      .includes(search.toLowerCase()),
  );

  return (
    <div className="flex min-h-screen bg-surface text-navy">
      {/* ─── Sidebar ─────────────────────────────────────────────────── */}
      <aside className="flex w-64 shrink-0 flex-col bg-navy">
        <div className="p-6">
          <div className="flex items-center gap-3">
            <div className="grid size-10 shrink-0 place-items-center rounded-md bg-white/10">
              <Boxes className="size-5 text-gold" />
            </div>
            <div className="min-w-0 leading-none">
              <p className="text-[11px] font-bold uppercase tracking-widest text-white">CCB Inventory</p>
              <p className="mt-1 text-[9px] uppercase tracking-[0.2em] text-white/50">Management System</p>
            </div>
          </div>
        </div>

        <nav className="mt-4 flex-1 space-y-1 px-3">
          <SideItem icon={<Package className="size-4" />} label="Material Monitoring" />
          <SideItem icon={<Circle className="size-4 fill-gold text-gold" />} label="CNF Monitoring" active />
          <SideItem icon={<Circle className="size-4" />} label="O-Ring Monitoring" />
          <SideItem icon={<Factory className="size-4" />} label="Pellets L-Sales" />
          <SideItem icon={<Settings2 className="size-4" />} label="Station Consumption" />
        </nav>

        <div className="border-t border-white/5 p-6">
          <button className="flex items-center gap-2 text-xs font-semibold uppercase tracking-wider text-white/40 transition-colors hover:text-danger">
            <LogOut className="size-4" />
            Logout
          </button>
        </div>
      </aside>

      {/* ─── Main ────────────────────────────────────────────────────── */}
      <main className="flex min-w-0 flex-1 flex-col">
        {/* Header */}
        <header className="grid h-20 shrink-0 grid-cols-[minmax(0,1fr)_auto] items-center gap-4 border-b border-border bg-card px-8">
          <div className="min-w-0">
            <div className="flex items-center gap-3">
              <span className="h-6 w-1 shrink-0 bg-cobalt" />
              <h1 className="truncate text-xl font-bold text-navy">CNF Monitoring</h1>
            </div>
            <p className="mt-1 text-xs text-muted-foreground">
              Track and manage Collar, Nameplate, and Footring inventory by brand.
            </p>
          </div>
          <div className="flex items-center gap-4">
            <div className="hidden text-right sm:block">
              <p className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground">
                CCB Inventory Clerk
              </p>
              <p className="text-sm font-semibold text-navy">Adrian Benedict</p>
            </div>
            <div className="grid size-10 shrink-0 place-items-center rounded-full bg-navy text-sm font-bold text-white">
              AB
            </div>
          </div>
        </header>

        {/* Period tabs */}
        <div className="border-b border-border bg-card px-8 pt-3">
          <div className="flex items-center gap-1 overflow-x-auto">
            {PERIODS.map((p) => (
              <button
                key={p}
                onClick={() => setActivePeriod(p)}
                className={`shrink-0 border-b-2 px-4 pb-3 text-xs font-bold uppercase tracking-wider transition-colors ${
                  activePeriod === p
                    ? "border-gold text-gold"
                    : "border-transparent text-muted-foreground hover:text-navy"
                }`}
              >
                {p}
              </button>
            ))}
            <div className="ml-auto flex items-center rounded-full bg-muted p-1">
              {(["Monthly", "Yearly"] as const).map((r) => (
                <button
                  key={r}
                  onClick={() => setRange(r)}
                  className={`rounded-full px-3 py-1 text-[10px] font-bold uppercase tracking-wider transition-colors ${
                    range === r ? "bg-gold text-navy shadow-sm" : "text-muted-foreground"
                  }`}
                >
                  {r}
                </button>
              ))}
            </div>
          </div>
        </div>

        {/* Scrollable content */}
        <div className="flex-1 space-y-6 overflow-y-auto p-8">
          {/* ─── KPI Band ───────────────────────────────────────────── */}
          <section className="space-y-3">
            <div className="flex items-center gap-2">
              <span className="size-1.5 rounded-full bg-gold" />
              <p className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground">
                Selected:{" "}
                <span className="text-navy">
                  {brand.name} — {selectedCategory.name} {selectedVariant.weight}
                </span>
              </p>
            </div>
            <div className="grid grid-cols-2 gap-3 md:grid-cols-3 xl:grid-cols-6">
              <KpiCard label="Initial Stock" value={(selectedVariant.balance + selectedVariant.issued - selectedVariant.received).toLocaleString()} unit="pcs" tone="cobalt" />
              <KpiCard label="Received" value={selectedVariant.received.toLocaleString()} unit="pcs" tone="cobalt" trend={<><ArrowUpRight className="size-3" /> +12%</>} />
              <KpiCard label="Current Balance" value={selectedVariant.balance.toLocaleString()} unit="pcs" tone="navy" />
              <KpiCard label="Issued" value={selectedVariant.issued.toLocaleString()} unit="pcs" tone="navy" trend={<><ArrowDownRight className="size-3" /> −5%</>} />
              <KpiCard label="Price / Unit" value={php(selectedVariant.price)} tone="light" accent="gold" />
              <KpiCard
                label="Total Value"
                value={php(selectedVariant.balance * selectedVariant.price)}
                tone="light"
                accent="danger"
                valueTone="danger"
              />
            </div>
          </section>

          {/* ─── Split Navigator ────────────────────────────────────── */}
          <section className="overflow-hidden rounded-2xl bg-card shadow-sm ring-1 ring-border">
            <div className="grid grid-cols-1 lg:grid-cols-[288px_minmax(0,1fr)]">
              {/* Left pane — Brand explorer */}
              <div className="flex flex-col border-b border-border lg:border-b-0 lg:border-r">
                <div className="border-b border-border bg-muted/40 p-4">
                  <div className="relative">
                    <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
                    <input
                      value={search}
                      onChange={(e) => setSearch(e.target.value)}
                      placeholder="Search brands, categories..."
                      className="w-full rounded-md border border-border bg-card py-2 pl-10 pr-3 text-xs placeholder:text-muted-foreground focus:outline-none focus:ring-1 focus:ring-cobalt"
                    />
                  </div>
                </div>

                <div className="max-h-[560px] divide-y divide-border overflow-y-auto">
                  {filteredBrands.map((b) => {
                    const active = b.id === selectedBrandId;
                    const varCount = b.categories.reduce((s, c) => s + c.variants.length, 0);
                    return (
                      <button
                        key={b.id}
                        onClick={() => {
                          setSelectedBrandId(b.id);
                          setSelectedVariantId(b.categories[0].variants[0].id);
                        }}
                        className={`group w-full border-r-4 p-5 text-left transition-colors ${
                          active
                            ? "border-cobalt bg-muted/60"
                            : "border-transparent hover:bg-muted/40"
                        } ${b.status === "legacy" ? "opacity-60" : ""}`}
                      >
                        <div className="mb-1 flex items-start justify-between gap-2">
                          <h3 className={`text-sm font-bold ${active ? "text-navy" : "text-navy/80"}`}>
                            {b.name}
                          </h3>
                          <StatusPill status={b.status} count={varCount} />
                        </div>
                        <p className="mb-3 line-clamp-2 text-[11px] text-muted-foreground">
                          {b.tagline}
                        </p>
                        <div className="flex gap-1">
                          {b.categories.map((_, i) => (
                            <span
                              key={i}
                              className={`h-1 flex-1 rounded-full ${
                                active ? "bg-cobalt" : "bg-border"
                              }`}
                            />
                          ))}
                        </div>
                      </button>
                    );
                  })}
                </div>
              </div>

              {/* Right pane — Category + Variant matrix */}
              <div className="flex flex-col">
                <div className="grid grid-cols-[minmax(0,1fr)_auto] items-center gap-3 border-b border-border bg-card px-6 py-3">
                  <div className="flex min-w-0 flex-wrap items-center gap-3">
                    <h2 className="truncate text-sm font-bold text-navy">
                      {brand.name} — Inventory Matrix
                    </h2>
                    <span className="h-4 w-px bg-border" />
                    <Tag>Total units: {brandTotals.balance.toLocaleString()}</Tag>
                    <Tag tone="gold">{brand.categories.length} categories</Tag>
                  </div>
                  <button className="flex shrink-0 items-center gap-1.5 rounded-md bg-cobalt px-3 py-1.5 text-xs font-semibold text-white transition-colors hover:bg-navy-soft">
                    <Plus className="size-3.5" /> Bulk update
                  </button>
                </div>

                <div className="max-h-[560px] space-y-8 overflow-y-auto p-6">
                  {brand.categories.map((cat) => (
                    <CategoryBlock
                      key={cat.id}
                      category={cat}
                      selectedVariantId={selectedVariantId}
                      onSelectVariant={setSelectedVariantId}
                    />
                  ))}
                </div>
              </div>
            </div>
          </section>
        </div>
      </main>
    </div>
  );
}

// ─── Sub-components ─────────────────────────────────────────────────────────
function SideItem({
  icon,
  label,
  active,
}: {
  icon: React.ReactNode;
  label: string;
  active?: boolean;
}) {
  return (
    <a
      href="#"
      className={`flex items-center gap-3 rounded-md px-3 py-2.5 text-sm font-medium transition-colors ${
        active
          ? "bg-cobalt text-white shadow-sm shadow-black/20"
          : "text-white/60 hover:bg-white/5 hover:text-white"
      }`}
    >
      <span className="grid size-6 shrink-0 place-items-center">{icon}</span>
      <span className="min-w-0 truncate">{label}</span>
    </a>
  );
}

function KpiCard({
  label,
  value,
  unit,
  tone,
  trend,
  accent,
  valueTone,
}: {
  label: string;
  value: string;
  unit?: string;
  tone: "cobalt" | "navy" | "light";
  trend?: React.ReactNode;
  accent?: "gold" | "danger";
  valueTone?: "danger";
}) {
  const bg =
    tone === "cobalt"
      ? "bg-cobalt text-white"
      : tone === "navy"
        ? "bg-navy text-white"
        : "bg-card text-navy ring-1 ring-border";
  const border =
    accent === "gold"
      ? "border-l-4 border-gold"
      : accent === "danger"
        ? "border-l-4 border-danger"
        : "";
  return (
    <div className={`relative flex h-32 flex-col justify-between overflow-hidden rounded-xl p-5 ${bg} ${border}`}>
      <div className="flex items-center justify-between">
        <span className={`text-[10px] font-bold uppercase tracking-widest ${
          tone === "light" ? "text-muted-foreground" : "text-white/60"
        }`}>
          {label}
        </span>
        {trend && (
          <span className={`flex items-center gap-0.5 text-[10px] font-semibold ${
            tone === "light" ? "text-cobalt" : "text-gold"
          }`}>
            {trend}
          </span>
        )}
      </div>
      <div className="flex items-baseline gap-1.5">
        <span className={`text-3xl font-semibold leading-none tracking-tight ${
          valueTone === "danger" ? "text-danger" : ""
        }`}>
          {value}
        </span>
        {unit && (
          <span className={`text-xs ${tone === "light" ? "text-muted-foreground" : "text-white/50"}`}>
            {unit}
          </span>
        )}
      </div>
      {tone !== "light" && (
        <div className="pointer-events-none absolute -bottom-6 -right-6 size-24 rounded-full bg-white/5" />
      )}
    </div>
  );
}

function StatusPill({ status, count }: { status: Brand["status"]; count: number }) {
  const map = {
    primary: "bg-cobalt/10 text-cobalt",
    secondary: "bg-muted text-navy",
    legacy: "bg-muted text-muted-foreground",
  } as const;
  const label = status === "legacy" ? "Legacy" : `${count} items`;
  return (
    <span className={`shrink-0 rounded-full px-2 py-0.5 text-[9px] font-bold uppercase tracking-wider ${map[status]}`}>
      {label}
    </span>
  );
}

function Tag({ children, tone }: { children: React.ReactNode; tone?: "gold" }) {
  const c = tone === "gold" ? "bg-gold/15 text-navy" : "bg-muted text-muted-foreground";
  return (
    <span className={`shrink-0 rounded px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider ${c}`}>
      {children}
    </span>
  );
}

function CategoryBlock({
  category,
  selectedVariantId,
  onSelectVariant,
}: {
  category: Category;
  selectedVariantId: string;
  onSelectVariant: (id: string) => void;
}) {
  const total = category.variants.reduce((s, v) => s + v.balance, 0);
  return (
    <section className="space-y-3">
      <div className="grid grid-cols-[minmax(0,1fr)_auto] items-center gap-3">
        <div className="flex min-w-0 items-center gap-3">
          <div className="grid size-8 shrink-0 place-items-center rounded-lg bg-muted">
            <ChevronRight className="size-4 text-navy" />
          </div>
          <div className="min-w-0">
            <h4 className="truncate text-sm font-semibold text-navy">{category.name}</h4>
            <p className="text-[10px] font-medium uppercase tracking-widest text-muted-foreground">
              Category · {category.code}
            </p>
          </div>
        </div>
        <span className="shrink-0 text-[10px] font-bold uppercase tracking-wider text-muted-foreground">
          {total.toLocaleString()} in balance
        </span>
      </div>

      <div className="overflow-hidden rounded-lg ring-1 ring-border">
        {category.variants.map((v, idx) => (
          <VariantRow
            key={v.id}
            variant={v}
            zebra={idx % 2 === 1}
            selected={v.id === selectedVariantId}
            onSelect={() => onSelectVariant(v.id)}
          />
        ))}
      </div>
    </section>
  );
}

function VariantRow({
  variant,
  zebra,
  selected,
  onSelect,
}: {
  variant: Variant;
  zebra: boolean;
  selected: boolean;
  onSelect: () => void;
}) {
  const usage = variant.received > 0 ? Math.min(100, Math.round((variant.issued / (variant.issued + variant.balance)) * 100)) : 0;
  const hot = usage >= 85;
  return (
    <div
      onClick={onSelect}
      className={`grid cursor-pointer grid-cols-[7rem_minmax(0,1fr)_auto] items-center gap-6 border-t border-border p-4 first:border-t-0 transition-colors ${
        selected ? "bg-cobalt/5 ring-1 ring-inset ring-cobalt/40" : zebra ? "bg-muted/30" : "bg-card"
      }`}
    >
      {/* Weight */}
      <div className="min-w-0">
        <p className="text-xs font-bold text-navy">{variant.weight}</p>
        <p className="text-[10px] text-muted-foreground">{variant.label}</p>
      </div>

      {/* Stats + progress */}
      <div className="grid min-w-0 grid-cols-2 gap-6 sm:grid-cols-4">
        <Stat label="Recv" value={variant.received} />
        <Stat label="Issued" value={variant.issued} tone="danger" />
        <div className="col-span-2">
          <div className="mb-1 flex items-center justify-between">
            <span className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground">
              Usage rate
            </span>
            <span className={`text-[10px] font-bold ${hot ? "text-danger" : "text-cobalt"}`}>
              {usage}%
            </span>
          </div>
          <div className="h-1.5 overflow-hidden rounded-full bg-muted">
            <div
              className={`h-full rounded-full transition-all ${hot ? "bg-danger" : "bg-cobalt"}`}
              style={{ width: `${usage}%` }}
            />
          </div>
        </div>
      </div>

      {/* Actions */}
      <div className="flex shrink-0 items-center gap-2">
        <RowButton onClick={(e) => e.stopPropagation()}>Receive</RowButton>
        <RowButton onClick={(e) => e.stopPropagation()} tone="danger">Issue</RowButton>
      </div>
    </div>
  );
}

function Stat({ label, value, tone }: { label: string; value: number; tone?: "danger" }) {
  return (
    <div>
      <p className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground">
        {label}
      </p>
      <p className={`text-xs font-semibold ${tone === "danger" ? "text-danger" : "text-navy"}`}>
        {tone === "danger" ? "−" : ""}
        {value.toLocaleString()}
      </p>
    </div>
  );
}

function RowButton({
  children,
  tone,
  onClick,
}: {
  children: React.ReactNode;
  tone?: "danger";
  onClick?: (e: React.MouseEvent) => void;
}) {
  const hover =
    tone === "danger"
      ? "hover:border-danger hover:text-danger"
      : "hover:border-cobalt hover:text-cobalt";
  return (
    <button
      onClick={onClick}
      className={`rounded-md border border-border bg-card px-2.5 py-1.5 text-[10px] font-bold uppercase tracking-wider text-muted-foreground transition-colors ${hover}`}
    >
      {children}
    </button>
  );
}
