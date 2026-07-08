import { createFileRoute, Link } from "@tanstack/react-router";
import { useState } from "react";
import { Boxes, Eye, EyeOff, Lock, Mail, ShieldCheck, BarChart3, Layers } from "lucide-react";

export const Route = createFileRoute("/auth")({
  head: () => ({
    meta: [
      { title: "Sign in — CCB Inventory Management System" },
      { name: "description", content: "Secure access to the CCB Inventory Management System — monitor materials, pellets, and stations in real time." },
      { property: "og:title", content: "Sign in — CCB Inventory Management System" },
      { property: "og:description", content: "Secure access to the CCB Inventory Management System." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: AuthPage,
});

function AuthPage() {
  const [mode, setMode] = useState<"signin" | "signup">("signin");
  const [showPassword, setShowPassword] = useState(false);

  return (
    <div className="min-h-screen w-full bg-background flex">
      {/* Brand panel */}
      <aside
        className="hidden lg:flex lg:w-[46%] xl:w-2/5 relative overflow-hidden text-brand-foreground p-12 flex-col justify-between"
        style={{ background: "var(--bg-gradient-brand)" }}
      >
        {/* Decorative shapes */}
        <div className="pointer-events-none absolute -top-32 -right-24 h-96 w-96 rounded-full opacity-20"
             style={{ background: "radial-gradient(closest-side, var(--brand-accent), transparent)" }} />
        <div className="pointer-events-none absolute -bottom-40 -left-20 h-[28rem] w-[28rem] rounded-full opacity-10"
             style={{ background: "radial-gradient(closest-side, white, transparent)" }} />
        <div className="pointer-events-none absolute top-1/2 left-1/2 h-2 w-40 -translate-x-1/2 rotate-45 rounded-full opacity-40"
             style={{ background: "var(--brand-danger)" }} />

        <div className="relative flex items-center gap-3">
          <div className="grid h-12 w-12 place-items-center rounded-xl bg-white shadow-elevated">
            <Boxes className="h-6 w-6" style={{ color: "var(--brand)" }} />
          </div>
          <div className="leading-tight">
            <p className="font-bold text-lg tracking-tight">CCB Inventory</p>
            <p className="text-[11px] tracking-[0.22em] opacity-70">MANAGEMENT SYSTEM</p>
          </div>
        </div>

        <div className="relative space-y-8">
          <div>
            <div className="inline-flex items-center gap-2 rounded-full border border-white/15 bg-white/5 px-3 py-1 text-[11px] tracking-[0.2em] uppercase text-brand-foreground/80">
              <span className="h-1.5 w-1.5 rounded-full" style={{ background: "var(--brand-accent)" }} />
              Live telemetry
            </div>
            <h1 className="mt-6 text-4xl xl:text-5xl font-bold leading-[1.05] tracking-tight">
              Every shot, reject,<br />and shift —<span style={{ color: "var(--brand-accent)" }}> in one glance.</span>
            </h1>
            <p className="mt-4 text-brand-foreground/75 max-w-md leading-relaxed">
              Sign in to monitor materials, pellet production, and station consumption across your plant with sheet-synced accuracy.
            </p>
          </div>

          <div className="grid grid-cols-3 gap-3 max-w-lg">
            <StatCard icon={<Layers className="h-4 w-4" />} label="Materials" value="90" />
            <StatCard icon={<BarChart3 className="h-4 w-4" />} label="Efficiency" value="75.2%" accent />
            <StatCard icon={<ShieldCheck className="h-4 w-4" />} label="Uptime" value="99.9%" />
          </div>
        </div>

        <p className="relative text-xs text-brand-foreground/50">
          © {new Date().getFullYear()} CCB Inventory Management System · Synced with Google Sheets
        </p>
      </aside>

      {/* Form panel */}
      <main className="flex-1 flex items-center justify-center p-6 sm:p-10">
        <div className="w-full max-w-md">
          {/* Mobile brand */}
          <div className="lg:hidden mb-8 flex items-center gap-3">
            <div className="grid h-11 w-11 place-items-center rounded-xl" style={{ background: "var(--brand)" }}>
              <Boxes className="h-5 w-5 text-brand-foreground" />
            </div>
            <div className="leading-tight">
              <p className="font-bold text-foreground">CCB Inventory</p>
              <p className="text-[10px] tracking-[0.22em] text-muted-foreground">MANAGEMENT SYSTEM</p>
            </div>
          </div>

          <div className="relative rounded-2xl border border-border bg-card p-8 shadow-card">
            {/* red accent bar echoing dashboard header underline */}
            <span className="absolute left-8 top-0 h-1 w-14 rounded-b-full" style={{ background: "var(--brand-danger)" }} />

            {/* tab switcher */}
            <div className="mb-7 inline-flex rounded-full bg-muted p-1 text-sm font-medium">
              <TabButton active={mode === "signin"} onClick={() => setMode("signin")}>Sign in</TabButton>
              <TabButton active={mode === "signup"} onClick={() => setMode("signup")}>Create account</TabButton>
            </div>

            <h2 className="text-2xl font-bold tracking-tight text-foreground">
              {mode === "signin" ? "Welcome back, Clerk." : "Request access."}
            </h2>
            <p className="mt-1 text-sm text-muted-foreground">
              {mode === "signin"
                ? "Enter your credentials to open the monitoring console."
                : "We'll route your request to your plant administrator."}
            </p>

            <form className="mt-7 space-y-5" onSubmit={(e) => e.preventDefault()}>
              {mode === "signup" && (
                <Field label="Full name">
                  <input
                    type="text"
                    placeholder="Juan Dela Cruz"
                    className="w-full bg-transparent outline-none placeholder:text-muted-foreground/60 text-foreground"
                  />
                </Field>
              )}

              <Field label="Email address" icon={<Mail className="h-4 w-4" />}>
                <input
                  type="email"
                  placeholder="clerk@ccb.com"
                  className="w-full bg-transparent outline-none placeholder:text-muted-foreground/60 text-foreground"
                />
              </Field>

              <Field
                label="Password"
                icon={<Lock className="h-4 w-4" />}
                trailing={
                  <button
                    type="button"
                    onClick={() => setShowPassword((s) => !s)}
                    className="text-muted-foreground hover:text-foreground transition-colors"
                    aria-label={showPassword ? "Hide password" : "Show password"}
                  >
                    {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                  </button>
                }
              >
                <input
                  type={showPassword ? "text" : "password"}
                  placeholder="••••••••••"
                  className="w-full bg-transparent outline-none placeholder:text-muted-foreground/60 text-foreground"
                />
              </Field>

              {mode === "signin" && (
                <div className="flex items-center justify-between text-sm">
                  <label className="inline-flex items-center gap-2 text-muted-foreground cursor-pointer select-none">
                    <input type="checkbox" className="peer sr-only" />
                    <span className="grid h-4 w-4 place-items-center rounded border border-border bg-background peer-checked:bg-[var(--brand)] peer-checked:border-[var(--brand)] transition-colors">
                      <svg className="h-3 w-3 text-brand-foreground opacity-0 peer-checked:opacity-100" viewBox="0 0 12 12" fill="none">
                        <path d="M2.5 6.5 5 9l4.5-5" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
                      </svg>
                    </span>
                    Remember me
                  </label>
                  <button type="button" className="font-medium text-[var(--brand)] hover:underline underline-offset-4">
                    Forgot password?
                  </button>
                </div>
              )}

              <button
                type="submit"
                className="group relative w-full overflow-hidden rounded-xl px-4 py-3 text-sm font-semibold text-brand-foreground transition-transform active:scale-[0.99]"
                style={{ background: "var(--brand)", boxShadow: "var(--shadow-card)" }}
              >
                <span className="relative z-10">
                  {mode === "signin" ? "Sign in to dashboard" : "Request access"}
                </span>
                <span
                  className="absolute inset-y-0 right-0 w-1.5 transition-all group-hover:w-full opacity-90"
                  style={{ background: "linear-gradient(90deg, transparent, var(--brand-accent))" }}
                />
              </button>

              <div className="relative py-1">
                <div className="absolute inset-0 flex items-center"><div className="w-full border-t border-border" /></div>
                <div className="relative flex justify-center">
                  <span className="bg-card px-3 text-[11px] uppercase tracking-[0.2em] text-muted-foreground">or</span>
                </div>
              </div>

              <button
                type="button"
                className="flex w-full items-center justify-center gap-3 rounded-xl border border-border bg-background px-4 py-3 text-sm font-medium text-foreground transition-colors hover:bg-muted"
              >
                <GoogleIcon />
                Continue with Google
              </button>
            </form>

            <p className="mt-6 text-center text-sm text-muted-foreground">
              {mode === "signin" ? (
                <>Don't have access yet?{" "}
                  <button onClick={() => setMode("signup")} className="font-semibold text-[var(--brand)] hover:underline underline-offset-4">
                    Request an account
                  </button>
                </>
              ) : (
                <>Already have an account?{" "}
                  <button onClick={() => setMode("signin")} className="font-semibold text-[var(--brand)] hover:underline underline-offset-4">
                    Sign in
                  </button>
                </>
              )}
            </p>
          </div>

          <p className="mt-6 text-center text-xs text-muted-foreground">
            Protected by role-based access ·{" "}
            <Link to="/" className="hover:text-foreground underline-offset-4 hover:underline">Back to home</Link>
          </p>
        </div>
      </main>
    </div>
  );
}

function StatCard({ icon, label, value, accent }: { icon: React.ReactNode; label: string; value: string; accent?: boolean }) {
  return (
    <div className="rounded-xl border border-white/10 bg-white/[0.04] p-3 backdrop-blur-sm">
      <div className="flex items-center gap-1.5 text-[10px] uppercase tracking-[0.15em] text-brand-foreground/70">
        <span style={{ color: accent ? "var(--brand-accent)" : "inherit" }}>{icon}</span>
        {label}
      </div>
      <p className="mt-1.5 text-xl font-bold" style={{ color: accent ? "var(--brand-accent)" : "white" }}>{value}</p>
    </div>
  );
}

function TabButton({ active, onClick, children }: { active: boolean; onClick: () => void; children: React.ReactNode }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`rounded-full px-4 py-1.5 transition-all ${
        active ? "bg-[var(--brand)] text-brand-foreground shadow-sm" : "text-muted-foreground hover:text-foreground"
      }`}
    >
      {children}
    </button>
  );
}

function Field({
  label, icon, trailing, children,
}: { label: string; icon?: React.ReactNode; trailing?: React.ReactNode; children: React.ReactNode }) {
  return (
    <label className="block">
      <span className="mb-1.5 block text-xs font-semibold uppercase tracking-[0.12em] text-muted-foreground">{label}</span>
      <div className="group flex items-center gap-2.5 rounded-xl border border-border bg-background px-3.5 py-3 transition-colors focus-within:border-[var(--brand)] focus-within:ring-2 focus-within:ring-[var(--brand)]/15">
        {icon && <span className="text-muted-foreground group-focus-within:text-[var(--brand)] transition-colors">{icon}</span>}
        <div className="flex-1">{children}</div>
        {trailing}
      </div>
    </label>
  );
}

function GoogleIcon() {
  return (
    <svg className="h-4 w-4" viewBox="0 0 24 24" aria-hidden="true">
      <path fill="#4285F4" d="M23.5 12.3c0-.8-.1-1.6-.2-2.3H12v4.5h6.5c-.3 1.5-1.1 2.7-2.4 3.6v3h3.9c2.3-2.1 3.5-5.2 3.5-8.8z"/>
      <path fill="#34A853" d="M12 24c3.2 0 5.9-1.1 7.9-2.9l-3.9-3c-1.1.7-2.4 1.2-4 1.2-3.1 0-5.7-2.1-6.6-4.9H1.4v3.1C3.4 21.3 7.4 24 12 24z"/>
      <path fill="#FBBC05" d="M5.4 14.4c-.2-.7-.4-1.5-.4-2.4s.1-1.6.4-2.4V6.5H1.4C.5 8.2 0 10 0 12s.5 3.8 1.4 5.5l4-3.1z"/>
      <path fill="#EA4335" d="M12 4.8c1.8 0 3.3.6 4.6 1.8l3.4-3.4C17.9 1.2 15.2 0 12 0 7.4 0 3.4 2.7 1.4 6.5l4 3.1C6.3 6.9 8.9 4.8 12 4.8z"/>
    </svg>
  );
}
