export type Repair = {
  id: string;
  date: string; // ISO
  timeSlot: "Morning" | "Midday" | "Afternoon" | "Evening";
  source: string;
  repaired: number;
  installedTo: string;
  good: number;
  rejected: number;
  remarks?: string;
};

const SOURCES = ["RAPId", "AKXEL", "COASTAL", "EQUI GAS", "LUZON GAS", "ISLAND GAS"];
const INSTALLED = ["Line A-01", "Line A-02", "Line B-03", "Line B-04", "Line C-01", "Stock Room"];
const SLOTS: Repair["timeSlot"][] = ["Morning", "Midday", "Afternoon", "Evening"];
const REMARKS = [
  "Standard batch",
  "Post-shift QC pass",
  "Seals reused",
  "Investigate seat wear",
  "",
  "Recheck required",
  "",
];

function seeded(n: number) {
  let s = n * 9301 + 49297;
  return () => {
    s = (s * 9301 + 49297) % 233280;
    return s / 233280;
  };
}

export function generateRepairs(count = 84): Repair[] {
  const rand = seeded(42);
  const now = new Date(2026, 5, 15); // June 15, 2026
  const out: Repair[] = [];
  for (let i = 0; i < count; i++) {
    const daysBack = Math.floor(rand() * 160);
    const d = new Date(now);
    d.setDate(d.getDate() - daysBack);
    const repaired = 8 + Math.floor(rand() * 40);
    const rejected = rand() < 0.28 ? Math.floor(rand() * Math.min(6, repaired)) : 0;
    const good = repaired - rejected - (rand() < 0.05 ? 1 : 0);
    out.push({
      id: `ORR-${(1000 + i).toString()}`,
      date: d.toISOString(),
      timeSlot: SLOTS[Math.floor(rand() * SLOTS.length)],
      source: SOURCES[Math.floor(rand() * SOURCES.length)],
      repaired,
      installedTo: INSTALLED[Math.floor(rand() * INSTALLED.length)],
      good: Math.max(0, good),
      rejected,
      remarks: REMARKS[Math.floor(rand() * REMARKS.length)],
    });
  }
  return out.sort((a, b) => b.date.localeCompare(a.date));
}

export const MONTHS = [
  "JAN", "FEB", "MAR", "APR", "MAY", "JUN",
  "JUL", "AUG", "SEP", "OCT", "NOV", "DEC",
];
