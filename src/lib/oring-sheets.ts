import { google } from "googleapis";
import {
  createSheetsClient,
  formatSheetsAuthError,
  resolveCredentialsPath,
} from "./google-sheets-auth";

const spreadsheetId =
  process.env.ORING_SPREADSHEET_ID ||
  process.env.SPREADSHEET_ID ||
  "1ReZqAWd1q5nm_m5mRysP4FplVCiszuCAhvKdPmpQKto";

const credentialsPath = resolveCredentialsPath(
  "ORING_GOOGLE_APPLICATION_CREDENTIALS",
  "GOOGLE_APPLICATION_CREDENTIALS"
);

let sheetsClient: any = null;

export type OringRecord = {
  rowNumber: number;
  tabName: string;
  date: string;
  time: string;
  valveCameFrom: string;
  valvesRepaired: number;
  installedTo: string;
  good: number;
  reject: number;
  remarks: string;
  dateKey: string;
  monthKey: string;
  timeSort: number;
  sourceKey: string;
  installedKey: string;
};

function getSheetsClient() {
  if (!sheetsClient) {
    const auth = createSheetsClient(credentialsPath);
    sheetsClient = google.sheets({ version: "v4", auth });
  }
  return sheetsClient;
}

async function withSheetsAuthError<T>(fn: () => Promise<T>): Promise<T> {
  try {
    return await fn();
  } catch (error) {
    throw formatSheetsAuthError(error, credentialsPath, "O-Ring Monitoring");
  }
}

function getCell(row: any[], index: number): string {
  if (!row || index >= row.length || row[index] == null) return "";
  return String(row[index]).trim();
}

function parseNumber(value: string): number {
  if (!value) return 0;
  const parsed = Number(String(value).replace(/,/g, ""));
  return Number.isFinite(parsed) ? parsed : 0;
}

function pad2(value: number) {
  return String(value).padStart(2, "0");
}

function parseDateKey(value: string): string {
  const text = value.trim();
  if (!text) return "";

  const match = text.match(/^(\d{1,2})[\/-](\d{1,2})[\/-](\d{2}|\d{4})$/);
  if (match) {
    const month = Number(match[1]);
    const day = Number(match[2]);
    let year = Number(match[3]);
    if (year < 100) year += 2000;
    return `${year}-${pad2(month)}-${pad2(day)}`;
  }

  const date = new Date(text);
  if (!Number.isNaN(date.getTime())) {
    return `${date.getFullYear()}-${pad2(date.getMonth() + 1)}-${pad2(date.getDate())}`;
  }

  return "";
}

function parseTimeSort(value: string): number {
  const text = value.trim().toLowerCase();
  if (!text) return 0;

  const start = text.split("-")[0].trim();
  const match = start.match(/^(\d{1,2})(?::(\d{2}))?\s*(am|pm)?$/i);
  if (!match) return 0;

  let hour = Number(match[1]);
  const minute = Number(match[2] || 0);
  const meridiem = (match[3] || "").toLowerCase();

  if (meridiem === "pm" && hour < 12) hour += 12;
  if (meridiem === "am" && hour === 12) hour = 0;

  return hour * 60 + minute;
} 

function isSkipRow(row: any[]) {
  const joined = row.map((cell) => String(cell ?? "").trim().toLowerCase()).join(" ");
  return !joined || joined.includes("o-ring monitoring") || joined.includes("date") && joined.includes("time");
}

function isTotalsRow(row: any[]) {
  const joined = row.map((cell) => String(cell ?? "").trim().toLowerCase()).join(" ");
  return joined.includes("total");
}

function mapRowToRecord(row: any[], rowNumber: number, tabName: string, carryDate: string): {
  record: OringRecord | null;
  nextDate: string;
} {
  const rawDate = getCell(row, 0);
  const rawTime = getCell(row, 1);
  const rawSource = getCell(row, 2);
  const rawRepaired = getCell(row, 3);
  const rawInstalledTo = getCell(row, 4);
  const rawGood = getCell(row, 5);
  const rawReject = getCell(row, 6);
  const rawRemarks = getCell(row, 10); // col K (0-indexed)

  const nextDate = rawDate || carryDate;
  const dateKey = parseDateKey(nextDate);
  const monthKey = dateKey ? dateKey.slice(0, 7) : "";
  const timeSort = parseTimeSort(rawTime);

  const repaired = parseNumber(rawRepaired);
  const good = parseNumber(rawGood);
  const reject = parseNumber(rawReject);
  const combined = good + reject;
  const valvesRepaired = repaired > 0 ? repaired : combined;
  const hasMeaningfulCounts = repaired > 0 || good > 0 || reject > 0;
  const hasContent = Boolean(rawDate || rawTime || rawSource || rawInstalledTo || rawRemarks);

  if (!hasMeaningfulCounts || !dateKey || !hasContent) {
    return { record: null, nextDate };
  }

  return {
    record: {
      rowNumber,
      tabName,
      date: nextDate,
      time: rawTime,
      valveCameFrom: rawSource,
      valvesRepaired,
      installedTo: rawInstalledTo,
      good: good > 0 ? good : Math.max(0, valvesRepaired - reject),
      reject,
      remarks: rawRemarks,
      dateKey,
      monthKey,
      timeSort,
      sourceKey: rawSource.toLowerCase(),
      installedKey: rawInstalledTo.toLowerCase(),
    },
    nextDate,
  };
}

export async function getOringTabs(): Promise<string[]> {
  return withSheetsAuthError(async () => {
    const sheets = getSheetsClient();
    const res = await sheets.spreadsheets.get({ spreadsheetId });

    const tabs = res.data.sheets
      ?.map((s: any) => s.properties?.title)
      .filter((title: any): title is string => Boolean(title) && !String(title).toLowerCase().includes("template"));

    return tabs || [];
  });
}

export async function getOringData(tabName: string): Promise<OringRecord[]> {
  return withSheetsAuthError(async () => {
    const sheets = getSheetsClient();
    const res = await sheets.spreadsheets.values.get({
      spreadsheetId,
      range: `${tabName}!A1:K1000`,
    });

    const rows = res.data.values || [];
    const records: OringRecord[] = [];
    let carryDate = "";

    for (let i = 0; i < rows.length; i++) {
      const row = rows[i];
      if (!row || isSkipRow(row) || isTotalsRow(row)) continue;

      const result = mapRowToRecord(row, i + 1, tabName, carryDate);
      carryDate = result.nextDate || carryDate;
      if (result.record) {
        records.push(result.record);
      }
    }

    return records;
  });
}

export async function getOringDataAll(): Promise<OringRecord[]> {
  return withSheetsAuthError(async () => {
    const tabs = await getOringTabs();
    const records: OringRecord[] = [];

    for (const tab of tabs) {
      const tabRecords = await getOringData(tab);
      records.push(...tabRecords);
    }

    return records;
  });
}

// ─── Add Report (multiple date groups, each with multiple shifts) ────────────
// Sheet column layout (from screenshot):
//   A=DATE  B=TIME  C=VALVE CAME FROM  D=VALVES REPAIRED  E=INSTALLED TO
//   F=GOOD  G=REJECT  H=(blank)  I=TOTAL(good)  J=TOTAL(reject)  K=REMARKS
// Data rows  → A–G + K  (H,I,J blank)
// Total rows → E=[Source] Total:  I=sumGood  J=sumReject  (all others blank)
export async function appendOringReport(
  tabName: string,
  report: {
    valveCameFrom: string; // kept for compat, ignored — per-shift now
    dateGroups: {
      date: string;
      shifts: {
        time: string;
        valveCameFrom: string;
        installedTo: string;
        valvesRepaired: number;
        good: number;
        reject: number;
        remarks: string;
      }[];
    }[];
  }
): Promise<void> {
  return withSheetsAuthError(async () => {
    const sheets = getSheetsClient();

    for (const group of report.dateGroups) {
      // Collect totals
      const sources     = [...new Set(group.shifts.map(s => s.valveCameFrom.trim()).filter(Boolean))];
      const sourceLabel = sources.length > 0 ? sources.join(" / ") : "Total";
      const totalGood   = group.shifts.reduce((t, s) => t + s.good, 0);
      const totalReject = group.shifts.reduce((t, s) => t + s.reject, 0);

      // 1. Build shift rows (H/I/J blank — total will be patched in after)
      const shiftRows = group.shifts.map((s) => [
        group.date,        // A - DATE on every row
        s.time,
        s.valveCameFrom,
        s.valvesRepaired,
        s.installedTo,
        s.good,
        s.reject,
        "",   // H - will be filled for last row below
        "",   // I
        "",   // J
        s.remarks,
      ]);

      // 2. Append all shift rows and capture the updated range to find the last row
      const appendRes = await sheets.spreadsheets.values.append({
        spreadsheetId,
        range: `${tabName}!A:K`,
        valueInputOption: "USER_ENTERED",
        insertDataOption: "INSERT_ROWS",
        requestBody: { values: shiftRows },
      });

      // 3. Parse the last written row number from the updatedRange (e.g. "Sheet1!A25:K27" → 27)
      const updatedRange: string = appendRes.data.updates?.updatedRange || "";
      const rowMatch = updatedRange.match(/:[A-Z]+(\d+)$/);
      const lastRow = rowMatch ? parseInt(rowMatch[1]) : null;

      // 4. Patch H/I/J on that last row with the total values
      if (lastRow) {
        await sheets.spreadsheets.values.update({
          spreadsheetId,
          range: `${tabName}!H${lastRow}:J${lastRow}`,
          valueInputOption: "USER_ENTERED",
          requestBody: {
            values: [[`${sourceLabel} Total:`, totalGood, totalReject]],
          },
        });
      }
    }
  });
}
