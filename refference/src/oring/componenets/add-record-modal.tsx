import { AlertTriangle, Loader2 } from "lucide-react";
import { useMemo, useState } from "react";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import type { Repair } from "@/lib/o-ring-data";

const SOURCES = ["RAPId", "AKXEL", "COASTAL", "EQUI GAS", "LUZON GAS", "ISLAND GAS"];
const INSTALLED = ["Line A-01", "Line A-02", "Line B-03", "Line B-04", "Line C-01", "Stock Room"];
const SLOTS: Repair["timeSlot"][] = ["Morning", "Midday", "Afternoon", "Evening"];

type Props = {
  open: boolean;
  onOpenChange: (o: boolean) => void;
  onSave: (r: Repair) => void;
};

export function AddRecordModal({ open, onOpenChange, onSave }: Props) {
  const [date, setDate] = useState(() => new Date().toISOString().slice(0, 10));
  const [timeSlot, setTimeSlot] = useState<Repair["timeSlot"]>("Morning");
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
  const rejectRate = r > 0 ? Math.round((rj / r) * 1000) / 10 : 0;
  const missingRequired = !date || r <= 0 || total === 0;

  const canSave = !invalid && !missingRequired && !saving;

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
    await new Promise((r) => setTimeout(r, 700));
    onSave({
      id: `ORR-${Math.floor(Math.random() * 9000 + 1000)}`,
      date: new Date(date).toISOString(),
      timeSlot,
      source,
      installedTo,
      repaired: r,
      good: g,
      rejected: rj,
      remarks: remarks.trim(),
    });
    setSaving(false);
    reset();
    onOpenChange(false);
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl overflow-hidden p-0">
        <DialogHeader className="border-b border-border bg-surface-2 px-6 py-5">
          <DialogTitle className="text-navy-deep text-lg font-semibold tracking-tight">
            New O-Ring repair record
          </DialogTitle>
          <p className="text-xs text-muted-foreground">
            Log a repair batch and its QC outcome. Fields marked <span className="text-reject">*</span> are required.
          </p>
        </DialogHeader>

        <div className="grid grid-cols-2 gap-5 px-6 py-6">
          <Field label="Date" required>
            <Input type="date" value={date} onChange={(e) => setDate(e.target.value)} />
          </Field>
          <Field label="Time slot" required>
            <Select value={timeSlot} onValueChange={(v) => setTimeSlot(v as Repair["timeSlot"])}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                {SLOTS.map((s) => <SelectItem key={s} value={s}>{s}</SelectItem>)}
              </SelectContent>
            </Select>
          </Field>
          <Field label="Valve source" required>
            <Select value={source} onValueChange={setSource}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                {SOURCES.map((s) => <SelectItem key={s} value={s}>{s}</SelectItem>)}
              </SelectContent>
            </Select>
          </Field>
          <Field label="Installed to" required>
            <Select value={installedTo} onValueChange={setInstalledTo}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                {INSTALLED.map((s) => <SelectItem key={s} value={s}>{s}</SelectItem>)}
              </SelectContent>
            </Select>
          </Field>
          <Field label="Repaired qty" required>
            <Input type="number" min={0} value={repaired}
              onChange={(e) => setRepaired(e.target.value === "" ? "" : Number(e.target.value))} />
          </Field>
          <Field label="Good qty" required>
            <Input type="number" min={0} value={good}
              onChange={(e) => setGood(e.target.value === "" ? "" : Number(e.target.value))} />
          </Field>
          <Field label="Rejected qty" required>
            <Input type="number" min={0} value={rejected}
              onChange={(e) => setRejected(e.target.value === "" ? "" : Number(e.target.value))} />
          </Field>
          <Field label="Remarks">
            <Textarea rows={1} value={remarks} onChange={(e) => setRemarks(e.target.value)}
              placeholder="Optional notes" />
          </Field>

          <div className="col-span-2 rounded-xl border border-border bg-surface-2 p-4">
            <div className="mb-3 flex items-center justify-between">
              <div className="text-[11px] font-semibold uppercase tracking-[0.14em] text-muted-foreground">
                QC preview
              </div>
              <div className="text-[11px] text-muted-foreground">
                Reject rate <span className="font-semibold text-navy-deep">{rejectRate}%</span>
              </div>
            </div>
            <div className="grid grid-cols-3 gap-3">
              <MiniStat label="Repaired" value={r} tone="navy" />
              <MiniStat label="Good" value={g} tone="good" />
              <MiniStat label="Rejected" value={rj} tone="reject" />
            </div>
            {invalid && (
              <div className="mt-3 flex items-start gap-2 rounded-lg border border-reject/30 bg-reject-soft px-3 py-2 text-xs text-reject">
                <AlertTriangle className="h-4 w-4 shrink-0" />
                Good + Rejected ({total}) exceeds Repaired ({r}). Adjust the totals before saving.
              </div>
            )}
          </div>
        </div>

        <DialogFooter className="border-t border-border bg-surface-2 px-6 py-4">
          <Button variant="ghost" onClick={() => onOpenChange(false)} disabled={saving}>Cancel</Button>
          <Button
            onClick={submit}
            disabled={!canSave}
            className="bg-navy-deep text-white hover:bg-navy"
          >
            {saving ? (<><Loader2 className="mr-2 h-4 w-4 animate-spin" /> Saving…</>) : "Save record"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function Field({ label, required, children }: { label: string; required?: boolean; children: React.ReactNode }) {
  return (
    <div className="space-y-1.5">
      <Label className="text-[11px] font-semibold uppercase tracking-[0.12em] text-muted-foreground">
        {label} {required && <span className="text-reject">*</span>}
      </Label>
      {children}
    </div>
  );
}

function MiniStat({ label, value, tone }: { label: string; value: number; tone: "navy" | "good" | "reject" }) {
  const toneMap = {
    navy: "text-navy-deep",
    good: "text-good",
    reject: "text-reject",
  };
  return (
    <div className="rounded-lg border border-border bg-surface px-3 py-2.5">
      <div className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">{label}</div>
      <div className={`mt-0.5 text-xl font-bold tabular-nums ${toneMap[tone]}`}>{value}</div>
    </div>
  );
}
