// ─── O-Ring Service (mirrors Java OringSheetService logic) ─────────────────────
// Note: Google Sheets API integration requires a backend to safely handle credentials.
// This service structure mirrors the Java logic but uses mock data for now.

export interface OringRecord {
  id: string;
  date: string;
  timeSlot: TimeSlot;
  source: string; // valveCameFrom in Java
  repaired: number; // valvesRepaired in Java
  installedTo: string;
  good: number;
  rejected: number;
  remarks?: string;
  parsedDate: Date | null;
}

export type TimeSlot = "Morning" | "Midday" | "Afternoon" | "Evening";

// ─── Date Formats (mirrors Java DATE_FORMATS) ───────────────────────────────────
const DATE_FORMATS = [
  "M/d/yy",
  "M/d/yyyy",
  "MM/dd/yy",
  "MM/dd/yyyy",
  "yyyy-MM-dd",
  "MMM d, yyyy",
  "d MMM yyyy",
];

// ─── Helper: Parse Date with Multiple Formats ───────────────────────────────────
function parseDate(value: string): Date | null {
  const text = value?.trim() || "";
  if (!text) return null;

  for (const format of DATE_FORMATS) {
    try {
      const date = new Date(text);
      if (!isNaN(date.getTime())) {
        return date;
      }
    } catch {
      // Try next format
    }
  }
  return null;
}

// ─── Helper: Reject Rate Calculation ───────────────────────────────────────────
export function rejectRate(repaired: number, rejected: number): number {
  if (repaired === 0) return 0;
  return Math.round((rejected / repaired) * 1000) / 10;
}

// ─── Helper: Get Month Key ─────────────────────────────────────────────────────
export function getMonthKey(date: Date | null): string {
  if (!date) return "";
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`;
}

// ─── Helper: Is Flagged ─────────────────────────────────────────────────────────
export function isFlagged(rejected: number): boolean {
  return rejected > 0;
}

// ─── Mock Data (mirrors Java mock structure) ─────────────────────────────────────
const MOCK_RECORDS: OringRecord[] = [
  { id: "ORR-1001", date: "2025-07-01", timeSlot: "Morning" as TimeSlot,   source: "RAPID",     installedTo: "Line A-01", repaired: 120, good: 110, rejected: 10, remarks: "Minor surface cracks on rejects" },
  { id: "ORR-1002", date: "2025-07-01", timeSlot: "Afternoon" as TimeSlot, source: "AKXEL",     installedTo: "Line A-02", repaired: 80,  good: 74,  rejected: 6  },
  { id: "ORR-1003", date: "2025-07-02", timeSlot: "Morning" as TimeSlot,   source: "COASTAL",   installedTo: "Line B-03", repaired: 95,  good: 90,  rejected: 5,  remarks: "Batch from overnight soak" },
  { id: "ORR-1004", date: "2025-07-02", timeSlot: "Midday" as TimeSlot,    source: "EQUI GAS",  installedTo: "Line B-04", repaired: 60,  good: 52,  rejected: 8,  remarks: "High reject — size mismatch" },
  { id: "ORR-1005", date: "2025-07-03", timeSlot: "Evening" as TimeSlot,   source: "LUZON GAS", installedTo: "Line C-01", repaired: 110, good: 105, rejected: 5  },
  { id: "ORR-1006", date: "2025-07-03", timeSlot: "Morning" as TimeSlot,   source: "ISLAND GAS",installedTo: "Stock Room", repaired: 200, good: 185, rejected: 15, remarks: "Stockroom reserve batch" },
  { id: "ORR-1007", date: "2025-07-04", timeSlot: "Afternoon" as TimeSlot, source: "RAPID",     installedTo: "Line A-01", repaired: 75,  good: 75,  rejected: 0  },
  { id: "ORR-1008", date: "2025-07-04", timeSlot: "Morning" as TimeSlot,   source: "COASTAL",   installedTo: "Line A-02", repaired: 50,  good: 43,  rejected: 7,  remarks: "Deformed o-rings discarded" },
  { id: "ORR-1009", date: "2025-07-05", timeSlot: "Midday" as TimeSlot,    source: "AKXEL",     installedTo: "Line B-03", repaired: 88,  good: 85,  rejected: 3  },
  { id: "ORR-1010", date: "2025-07-05", timeSlot: "Evening" as TimeSlot,   source: "EQUI GAS",  installedTo: "Line B-04", repaired: 66,  good: 55,  rejected: 11, remarks: "Pressure test failures" },
].map(rec => ({
  ...rec,
  parsedDate: parseDate(rec.date),
}));

// ─── Service Class ─────────────────────────────────────────────────────────────
class OringSheetService {
  private static readonly SPREADSHEET_ID = "1ReZqAWd1q5nm_m5mRysP4FplVCiszuCAhvKdPmpQKto";
  private static readonly CREDENTIALS_PATH = "/com/ccb/credentials/service-account.json";

  /**
   * Read all records from the primary O-ring sheet
   * Note: This would call a backend API in production to safely handle Google Sheets credentials
   */
  async readRecords(): Promise<OringRecord[]> {
    // TODO: Replace with actual API call to backend
    // const response = await fetch('/api/oring/records');
    // return response.json();
    return MOCK_RECORDS;
  }

  /**
   * Append a new record to the sheet
   * Note: This would call a backend API in production
   */
  async appendRecord(record: OringRecord): Promise<void> {
    // TODO: Replace with actual API call to backend
    // await fetch('/api/oring/records', {
    //   method: 'POST',
    //   headers: { 'Content-Type': 'application/json' },
    //   body: JSON.stringify(record),
    // });
    console.log("Would append record:", record);
  }

  /**
   * Get all tab names from the spreadsheet
   */
  async getTabNames(): Promise<string[]> {
    // TODO: Replace with actual API call to backend
    return ["O-Ring Log", "July 2025", "June 2025"];
  }

  /**
   * Resolve the primary tab name (mirrors Java logic)
   * Looks for "oring" or "o-ring" in tab names
   */
  async resolvePrimaryTabName(): Promise<string> {
    const tabs = await this.getTabNames();
    if (tabs.length === 0) return "Sheet1";

    for (const tab of tabs) {
      const normalized = tab?.trim().toLowerCase() || "";
      if (normalized === "sheet1" || normalized.includes("oring") || normalized.includes("o-ring")) {
        return tab;
      }
    }
    return tabs[0];
  }

  /**
   * Check if a row is blank (mirrors Java isBlankRow)
   */
  private isBlankRow(row: any[]): boolean {
    if (!row) return true;
    for (const value of row) {
      if (value != null && String(value).trim() !== "") return false;
    }
    return true;
  }

  /**
   * Check if a row is valid data (mirrors Java isValidDataRow)
   */
  private isValidDataRow(row: any[]): boolean {
    return this.readInt(row, 3) > 0 || this.readInt(row, 5) > 0 || this.readInt(row, 6) > 0;
  }

  /**
   * Check if row looks like a totals row (mirrors Java looksLikeTotalsRow)
   */
  private looksLikeTotalsRow(date: string, source: string, installedTo: string, remarks: string): boolean {
    const combined = `${date || ""} ${source || ""} ${installedTo || ""} ${remarks || ""}`.toLowerCase();
    return combined.includes("total") || combined.includes("grand total");
  }

  /**
   * Read integer from cell (mirrors Java readInt)
   */
  private readInt(row: any[], index: number): number {
    const value = this.cell(row, index);
    if (!value) return 0;
    try {
      const normalized = value.replace(/,/g, "");
      if (normalized.endsWith(".0")) {
        return parseInt(normalized.slice(0, -2));
      }
      return parseInt(normalized);
    } catch {
      try {
        return Math.round(parseFloat(value.replace(/,/g, "")));
      } catch {
        return 0;
      }
    }
  }

  /**
   * Get cell value (mirrors Java cell)
   */
  private cell(row: any[], index: number): string {
    if (!row || index < 0 || index >= row.length || row[index] == null) return "";
    return String(row[index]).trim();
  }
}

// ─── Export singleton instance ─────────────────────────────────────────────────
export const oringService = new OringSheetService();
