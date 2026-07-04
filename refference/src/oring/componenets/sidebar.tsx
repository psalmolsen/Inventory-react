import { Package, Droplets, Circle, Boxes, Factory, LogOut } from "lucide-react";
import { cn } from "@/lib/utils";

const NAV = [
  { label: "Material Monitoring", icon: Package, active: false },
  { label: "CNF Monitoring", icon: Droplets, active: false },
  { label: "O-Ring Monitoring", icon: Circle, active: true },
  { label: "Pellets L-Sales", icon: Boxes, active: false },
  { label: "Station Consumption", icon: Factory, active: false },
];

export function Sidebar() {
  return (
    <aside className="flex h-screen w-64 shrink-0 flex-col bg-navy-deep text-white/90">
      <div className="flex items-center gap-3 px-6 pt-7 pb-8">
        <div className="grid h-11 w-11 place-items-center rounded-xl bg-gold text-navy-deep font-black shadow-sm">
          CC
        </div>
        <div className="leading-tight">
          <div className="text-[15px] font-semibold text-white">CCB Inventory</div>
          <div className="text-[10px] font-medium tracking-[0.14em] text-white/50">
            MANAGEMENT SYSTEM
          </div>
        </div>
      </div>

      <nav className="flex-1 space-y-1 px-3">
        {NAV.map((item) => {
          const Icon = item.icon;
          return (
            <button
              key={item.label}
              className={cn(
                "group relative flex w-full items-center gap-3 rounded-lg px-3 py-2.5 text-[13px] font-medium transition-colors",
                item.active
                  ? "bg-white/[0.06] text-white"
                  : "text-white/60 hover:bg-white/[0.04] hover:text-white/90",
              )}
            >
              {item.active && (
                <span className="absolute left-0 top-1/2 h-6 -translate-y-1/2 w-[3px] rounded-r bg-gold" />
              )}
              <Icon className={cn("h-4 w-4", item.active ? "text-gold" : "")} />
              {item.label}
            </button>
          );
        })}
      </nav>

      <div className="border-t border-white/5 px-3 py-4">
        <button className="flex w-full items-center gap-3 rounded-lg px-3 py-2.5 text-[13px] font-medium text-reject/90 hover:bg-white/[0.04]">
          <LogOut className="h-4 w-4" />
          Logout
        </button>
      </div>
    </aside>
  );
}
