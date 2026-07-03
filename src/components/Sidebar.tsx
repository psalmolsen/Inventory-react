import { Link } from "@tanstack/react-router";
import { Package, Droplets, Circle, Boxes, Factory, LogOut } from "lucide-react";

const NAV = [
  { label: "Material Monitoring", icon: Package, to: "/" },
  { label: "CNF Monitoring", icon: Droplets, to: "/cnf" },
  { label: "O-Ring Monitoring", icon: Circle, to: "#" },
  { label: "Pellets L-Sales", icon: Boxes, to: "#" },
  { label: "Station Consumption", icon: Factory, to: "#" },
] as const;

export function Sidebar() {
  return (
    <aside className="w-[220px] shrink-0 bg-ccb-navy text-white flex flex-col">
      <div className="px-5 pt-5 pb-6 border-b border-white/10">
        <div className="flex items-center gap-3">
          <div className="h-11 w-11 rounded-lg border-2 border-ccb-red flex items-center justify-center shadow-md overflow-hidden bg-white">
            <img src="/CCBLogo.png" alt="CCB Logo" className="h-full w-full object-contain" />
          </div>
          <div className="leading-tight">
            <div className="text-[13px] font-bold">CCB Inventory</div>
            <div className="text-[10px] uppercase tracking-[0.14em] text-white/60">Management System</div>
          </div>
        </div>
      </div>

      <nav className="flex-1 py-4">
        {NAV.map(({ label, icon: Icon, to }) =>
          to === "#" ? (
            <button
              key={label}
              className="relative w-full text-left flex items-center gap-3 px-5 py-3 text-[12.5px] transition-colors text-white/40 cursor-not-allowed"
            >
              <Icon size={16} strokeWidth={2} className="text-white/30" />
              <span>{label}</span>
            </button>
          ) : (
            <Link
              key={label}
              to={to}
              className="relative w-full text-left flex items-center gap-3 px-5 py-3 text-[12.5px] transition-colors text-white/70 hover:text-white hover:bg-white/[0.04]"
              activeProps={{
                className:
                  "relative w-full text-left flex items-center gap-3 px-5 py-3 text-[12.5px] transition-colors text-white bg-white/[0.06] font-semibold",
              }}
            >
              {({ isActive }) => (
                <>
                  {isActive && <span className="absolute left-0 top-0 bottom-0 w-[3px] bg-ccb-gold" />}
                  <Icon size={16} strokeWidth={2} className={isActive ? "text-ccb-gold" : "text-white/60"} />
                  <span>{label}</span>
                </>
              )}
            </Link>
          )
        )}
      </nav>

      <div className="p-4 border-t border-white/10">
        <button className="w-full flex items-center gap-2 px-3 py-2 rounded-md text-[12.5px] text-ccb-red/90 hover:bg-white/[0.04] hover:text-ccb-red transition-colors">
          <LogOut size={15} />
          Logout
        </button>
      </div>
    </aside>
  );
}
