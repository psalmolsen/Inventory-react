import { Link } from "@tanstack/react-router";
import { Package, Droplets, Circle, Boxes, Factory, LogOut, Menu, X } from "lucide-react";
import { useState } from "react";

const NAV = [
  { label: "Material Monitoring", icon: Package, to: "/" },
  { label: "CNF Monitoring", icon: Droplets, to: "/cnf" },
  { label: "O-Ring Monitoring", icon: Circle, to: "/oring" },
  { label: "Pellets L-Sales", icon: Boxes, to: "/pellets" },
  { label: "Station Consumption", icon: Factory, to: "/station-consumption" },
] as const;

export function Sidebar() {
  const [isOpen, setIsOpen] = useState(false);

  return (
    <>
      {/* Mobile backdrop */}
      {isOpen && (
        <div
          className="fixed inset-0 bg-black/50 z-40 lg:hidden"
          onClick={() => setIsOpen(false)}
        />
      )}

      {/* Mobile menu button */}
      <button
        className="lg:hidden fixed top-4 left-4 z-50 p-2 rounded-lg bg-ccb-navy text-white shadow-lg"
        onClick={() => setIsOpen(!isOpen)}
      >
        {isOpen ? <X size={20} /> : <Menu size={20} />}
      </button>

      {/* Sidebar */}
      <aside
        className={`fixed lg:static lg:self-stretch lg:min-h-screen inset-y-0 left-0 z-50 w-[220px] shrink-0 bg-ccb-navy text-white flex flex-col transition-transform duration-300 ease-in-out lg:translate-x-0 ${
          isOpen ? "translate-x-0" : "-translate-x-full"
        }`}
      >
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
          {NAV.map(({ label, icon: Icon, to }) => (
            <Link
              key={label}
              to={to}
              className="relative w-full text-left flex items-center gap-3 px-5 py-3 text-[12.5px] transition-colors text-white/70 hover:text-white hover:bg-white/[0.04]"
              activeProps={{
                className:
                  "relative w-full text-left flex items-center gap-3 px-5 py-3 text-[12.5px] transition-colors text-white bg-white/[0.06] font-semibold",
              }}
              onClick={() => setIsOpen(false)}
            >
              {({ isActive }) => (
                <>
                  {isActive && <span className="absolute left-0 top-0 bottom-0 w-[3px] bg-ccb-gold" />}
                  <Icon size={16} strokeWidth={2} className={isActive ? "text-ccb-gold" : "text-white/60"} />
                  <span className={isActive ? "text-ccb-gold" : ""}>{label}</span>
                </>
              )}
            </Link>
          ))}
        </nav>

        <div className="p-4 border-t border-white/10">
          <button className="w-full flex items-center gap-2 px-3 py-2 rounded-md text-[12.5px] text-ccb-red/90 hover:bg-white/[0.04] hover:text-ccb-red transition-colors">
            <LogOut size={15} />
            Logout
          </button>
        </div>
      </aside>
    </>
  );
}
