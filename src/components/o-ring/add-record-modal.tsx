import { AlertTriangle, Loader2, X } from "lucide-react";
import { useState } from "react";
import type { OringRecord, TimeSlot } from "../../lib/oring-service";

const SOURCES = ["RAPID", "AKXEL", "COASTAL", "EQUI GAS", "LUZON GAS", "ISLAND GAS"];
const INSTALLED = ["Line A-01", "Line A-02", "Line B-03", "Line B-04", "Line C-01", "Stock Room"];
const SLOTS: TimeSlot[] = ["Morning", "Midday", "Afternoon", "Evening"];

type Props = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSave: (record: OringRecord) => void;
};

export function AddRecordModal({ open, onOpenChange, onSave }: Props) {
  const [date, setDate] = useState(() => new Date().toISOString().slice(0, 10));
  const [timeSlot, setTimeSlot] = useState<TimeSlot>("Morning");
  const [source, setSource] = useState(SOURCES[0]);
  const [installedTo, setInstalledTo] = useState(INSTALLED[0]);
  const [repaired, setRepaired] = useState<number | "">("");
  const [good, setGood] = useState<number | "">("");
  const [rejected, setRejected] = useState<number | "">("");
  const [remarks, setRemarks] = useState("");
  const [saving, setSaving] = useState(false);

  const r = Number(repaired) || 0;
  const g = Number(good) || 0;
  const rj = Number(rejected) || 0;
  const total = g + rj;
  const invalid = total > r && r > 0;
  const rejectRatePct = r > 0 ? Math.round((rj / r) * 1000) / 10 : 0;
  const missingRequired = !date || r <= 0 || total === 0;
  const canSave = !invalid && !missingRequired && !saving;

  if (!open) return null;

  function reset() {
    setDate(new Date().toISOString().slice(0, 10));
    setTimeSlot("Morning");
    setSource(SOURCES[0]);
    setInstalledTo(INSTALLED[0]);
    setRepaired("");
    setGood("");
    setRejected("");
    setRemarks("");
  }

  async function submit() {
    if (!canSave) return;
    setSaving(true);
    await new Promise((resolve) => setTimeout(resolve, 700));
    onSave({
      id: `ORR-${Math.floor(Math.random() * 9000 + 1000)}`,
      date: new Date(date).toISOString(),
      timeSlot,
      source,
      installedTo,
      repaired: r,
      good: g,
      rejected: rj,
      remarks: remarks.trim() || undefined,
      parsedDate: new Date(date),
    });
    setSaving(false);
    reset();
    onOpenChange(false);
  }

  const inputCls =
    "w-full rounded-lg border border-ccb-border bg-white px-3 py-2 text-[13px] text-ccb-navy outline-none focus:border-ccb-blue";

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-ccb-navy/50 p-6 backdrop-blur-sm"
      onClick={() => onOpenChange(false)}
    >
      <div
        className="w-full max-w-2xl overflow-hidden rounded-2xl bg-white shadow-[0_30px_80px_-20px_rgba(26,37,96,0.6)]"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="border-b border-ccb-border bg-ccb-canvas/40 px-6 py-5">
          <div className="flex items-start justify-between">
            <div>
              <h2 className="text-lg font-bold text-ccb-navy">New O-Ring repair record</h2>
              <p className="mt-1 text-xs text-ccb-muted">
                Log a repair batch and its QC outcome. Fields marked{" "}
                <span className="text-ccb-red">*</span> are required.
              </p>
            </div>
            <button
              onClick={() => onOpenChange(false)}
              disabled={saving}
              className="rounded-md p-1 text-ccb-muted hover:bg-ccb-canvas"
            >
              <X size={18} />
            </button>
          </div>
        </div>

        <div className="grid grid-cols-2 gap-5 px-6 py-6">
          <Field label="Date" required>
            <input type="date" value={date} onChange={(e) => setDate(e.target.value)} className={inputCls} />
          </Field>
          <Field label="Time slot" required>
            <select value={timeSlot} onChange={(e) => setTimeSlot(e.target.value as TimeSlot)} className={inputCls}>
              {SLOTS.map((s) => (
                <option key={s} value={s}>{s}</option>
              ))}
            </select>
          </Field>
          <Field label="Valve source" required>
            <select value={source} onChange={(e) => setSource(e.target.value)} className={inputCls}>
              {SOURCES.map((s) => (
                <option key={s} value={s}>{s}</option>
              ))}
            </select>
          </Field>
          <Field label="Installed to" required>
            <select value={installedTo} onChange={(e) => setInstalledTo(e.target.value)} className={inputCls}>
              {INSTALLED.map((s) => (
                <option key={s} value={s}>{s}</option>
              ))}
            </select>
          </Field>
          <Field label="Repaired qty" required>
            <input
              type="number"
              min={0}
              value={repaired}
              onChange={(e) => setRepaired(e.target.value === "" ? "" : Number(e.target.value))}
              className={inputCls}
            />
          </Field>
          <Field label="Good qty" required>
            <input
              type="number"
              min={0}
              value={good}
              onChange={(e) => setGood(e.target.value === "" ? "" : Number(e.target.value))}
              className={inputCls}
            />
          </Field>
          <Field label="Rejected qty" required>
            <input
              type="number"
              min={0}
              value={rejected}
              onChange={(e) => setRejected(e.target.value === "" ? "" : Number(e.target.value))}
              className={inputCls}
            />
          </Field>
          <Field label="Remarks">
            <textarea
              rows={1}
              value={remarks}
              onChange={(e) => setRemarks(e.target.value)}
              placeholder="Optional notes"
              className={`${inputCls} resize-none`}
            />
          </Field>

          <div className="col-span-2 rounded-xl border border-ccb-border bg-ccb-canvas/60 p-4">
            <div className="mb-3 flex items-center justify-between">
              <div className="text-[11px] font-semibold uppercase tracking-[0.14em] text-ccb-muted">QC preview</div>
              <div className="text-[11px] text-ccb-muted">
                Reject rate <span className="font-semibold text-ccb-navy">{rejectRatePct}%</span>
              </div>
            </div>
            <div className="grid grid-cols-3 gap-3">
              <MiniStat label="Repaired" value={r} tone="navy" />
              <MiniStat label="Good" value={g} tone="good" />
              <MiniStat label="Rejected" value={rj} tone="reject" />
            </div>
            {invalid && (
              <div className="mt-3 flex items-start gap-2 rounded-lg border border-ccb-red/30 bg-red-50 px-3 py-2 text-xs text-ccb-red">
                <AlertTriangle className="h-4 w-4 shrink-0" />
                Good + Rejected ({total}) exceeds Repaired ({r}). Adjust the totals before saving.
              </div>
            )}
          </div>
        </div>

        <div className="flex items-center justify-end gap-2 border-t border-ccb-border bg-ccb-canvas/60 px-6 py-4">
          <button
            onClick={() => onOpenChange(false)}
            disabled={saving}
            className="rounded-lg border border-ccb-border bg-white px-5 py-2 text-[12.5px] font-semibold text-ccb-navy hover:bg-ccb-canvas disabled:opacity-50"
          >
            Cancel
          </button>
          <button
            onClick={submit}
            disabled={!canSave}
            className="flex items-center rounded-lg bg-ccb-navy px-5 py-2 text-[12.5px] font-semibold text-white hover:bg-ccb-blue disabled:opacity-50"
          >
            {saving ? (
              <>
                <Loader2 className="mr-2 h-4 w-4 animate-spin" /> Saving…
              </>
            ) : (
              "Save record"
            )}
          </button>
        </div>
      </div>
    </div>
  );
}

function Field({ label, required, children }: { label: string; required?: boolean; children: React.ReactNode }) {
  return (
    <div className="space-y-1.5">
      <label className="text-[11px] font-semibold uppercase tracking-[0.12em] text-ccb-muted">
        {label} {required && <span className="text-ccb-red">*</span>}
      </label>
      {children}
    </div>
  );
}

function MiniStat({ label, value, tone }: { label: string; value: number; tone: "navy" | "good" | "reject" }) {
  const toneMap = { navy: "text-ccb-navy", good: "text-[#1E7A4B]", reject: "text-ccb-red" };
  return (
    <div className="rounded-lg border border-ccb-border bg-white px-3 py-2.5">
      <div className="text-[10px] font-semibold uppercase tracking-wider text-ccb-muted">{label}</div>
      <div className={`mt-0.5 text-xl font-bold tabular-nums ${toneMap[tone]}`}>{value}</div>
    </div>
  );
}
