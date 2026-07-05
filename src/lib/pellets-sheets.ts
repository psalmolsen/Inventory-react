import { google } from "googleapis";
import {
  createSheetsClient,
  formatSheetsAuthError,
  resolveCredentialsPath,
} from "./google-sheets-auth";

const spreadsheetId =
  process.env.PELLETS_SPREADSHEET_ID ||
  "13a0XL9TojETDZ6V4KWaJsKjj_PLkAIwjqwyVZ5-kCVs";

const credentialsPath = resolveCredentialsPath(
  "PELLETS_GOOGLE_APPLICATION_CREDENTIALS",
  "GOOGLE_APPLICATION_CREDENTIALS"
);

let sheetsClient: any = null;

export type PelletRecord = {
  rowNumber: number;
  tabName: string;
  date: string;
  dateKey: string;
  monthKey: string;
  time: string;
  shift: string;
  interval: string;
  brand: string;
  sack: string;
  good: number;
  reject: number;
  shots: number;
  remarks: string;
  status: "ok" | "warn" | "danger";
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
    throw formatSheetsAuthError(error, credentialsPath, "Pellets Monitoring");
  }
}

function cell(row: any[], index: number): string {
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

  const parsed = new Date(text);
  if (!Number.isNaN(parsed.getTime())) {
    return `${parsed.getFullYear()}-${pad2(parsed.getMonth() + 1)}-${pad2(parsed.getDate())}`;
  }

  return "";
}

function monthLabel(monthKey: string) {
  if (!monthKey) return "";
  const [year, month] = monthKey.split("-");
  const months = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
  return `${months[Number(month) - 1] || month} ${year}`;
}

function statusFor(record: { reject: number; shots: number }): PelletRecord["status"] {
  if (record.reject <= 0) return "ok";
  if (record.reject / Math.max(record.shots, 1) >= 0.4) return "danger";
  return "warn";
}

function normalizeHeader(value: string) {
  return value.trim().toLowerCase().replace(/[\s_\-/#]+/g, "");
}

function findHeaderRow(rows: any[][]) {
  const targets = [
    "date",
    "time",
    "brand",
    "source",
    "product",
    "good",
    "reject",
    "shots",
    "total",
    "shift",
    "interval",
    "sack",
    "remarks",
    "status",
  ];

  let bestIndex = -1;
  let bestScore = 0;

  for (let i = 0; i < Math.min(rows.length, 10); i++) {
    const row = rows[i] || [];
    const score = row.reduce((sum, value) => {
      const normalized = normalizeHeader(String(value ?? ""));
      return sum + (targets.some((target) => normalized.includes(target)) ? 1 : 0);
    }, 0);

    if (score > bestScore) {
      bestScore = score;
      bestIndex = i;
    }
  }

  return bestScore >= 2 ? bestIndex : -1;
}

function buildFieldMap(headerRow: any[]) {
  const map = new Map<string, number>();
  headerRow.forEach((value, index) => {
    const header = normalizeHeader(String(value ?? ""));
    if (!header) return;

    const pairs: Array<[string, boolean]> = [
      ["date", header.includes("date")],
      ["time", header.includes("time")],
      ["brand", header.includes("brand") || header.includes("source") || header.includes("product")],
      ["good", header.includes("good")],
      ["reject", header.includes("reject")],
      ["shots", header.includes("shots") || header.includes("total")],
      ["shift", header.includes("shift")],
      ["interval", header.includes("interval") || header.includes("timeinterval")],
      ["sack", header.includes("sack") || header.includes("size")],
      ["remarks", header.includes("remark") || header.includes("note")],
      ["status", header.includes("status")],
    ];

    for (const [key, matched] of pairs) {
      if (matched && !map.has(key)) {
        map.set(key, index);
      }
    }
  });
  return map;
}

function inferRecord(row: any[], rowNumber: number, tabName: string, carryDate: string, fieldMap?: Map<string, number>) {
  const fallback = {
    date: 0,
    time: 1,
    brand: 2,
    good: 3,
    reject: 4,
    sack: 5,
    shift: 6,
    interval: 7,
    remarks: 8,
    shots: 9,
  };

  const index = (key: keyof typeof fallback) => fieldMap?.get(key) ?? fallback[key];
  const rawDate = cell(row, index("date"));
  const rawTime = cell(row, index("time"));
  const rawBrand = cell(row, index("brand"));
  const rawGood = cell(row, index("good"));
  const rawReject = cell(row, index("reject"));
  const rawSack = cell(row, index("sack"));
  const rawShift = cell(row, index("shift"));
  const rawInterval = cell(row, index("interval"));
  const rawRemarks = cell(row, index("remarks"));

  const nextDate = rawDate || carryDate;
  const dateKey = parseDateKey(nextDate);
  const monthKey = dateKey ? dateKey.slice(0, 7) : "";
  const good = parseNumber(rawGood);
  const reject = parseNumber(rawReject);
  const shots = good + reject;

  const hasContent = Boolean(rawDate || rawTime || rawBrand || rawGood || rawReject || rawSack || rawShift || rawInterval || rawRemarks);
  const hasNumbers = shots > 0 || parseNumber(cell(row, index("shots"))) > 0;
  if (!hasContent || !hasNumbers || !dateKey) {
    return { record: null, nextDate };
  }

  const explicitShots = parseNumber(cell(row, index("shots")));
  const finalShots = explicitShots > 0 ? explicitShots : shots;
  const finalGood = good > 0 ? good : Math.max(0, finalShots - reject);

  return {
    record: {
      rowNumber,
      tabName,
      date: nextDate,
      dateKey,
      monthKey,
      time: rawTime,
      shift: rawShift,
      interval: rawInterval,
      brand: rawBrand,
      sack: rawSack,
      good: finalGood,
      reject,
      shots: finalShots,
      remarks: rawRemarks,
      status: statusFor({ reject, shots: finalShots }),
    },
    nextDate,
  };
}

export async function getPelletsTabs(): Promise<string[]> {
  return withSheetsAuthError(async () => {
    const sheets = getSheetsClient();
    const res = await sheets.spreadsheets.get({ spreadsheetId });
    return (
      res.data.sheets
        ?.map((s: any) => s.properties?.title)
        .filter((title: any): title is string => Boolean(title) && !String(title).toLowerCase().includes("template")) || []
    );
  });
}

export async function getPelletsData(tabName: string): Promise<PelletRecord[]> {
  return withSheetsAuthError(async () => {
    const sheets = getSheetsClient();
    const res = await sheets.spreadsheets.values.get({
      spreadsheetId,
      range: `${tabName}!A1:AZ1000`,
    });

    const rows = res.data.values || [];
    const headerRowIndex = findHeaderRow(rows);
    const fieldMap = headerRowIndex >= 0 ? buildFieldMap(rows[headerRowIndex]) : undefined;
    const startRow = headerRowIndex >= 0 ? headerRowIndex + 1 : 0;
    const records: PelletRecord[] = [];
    let carryDate = "";

    for (let i = startRow; i < rows.length; i++) {
      const row = rows[i];
      if (!row) continue;

    const joined = row.map((value: any) => String(value ?? "").trim().toLowerCase()).join(" ");
      if (!joined || joined.includes("total")) continue;

      const result = inferRecord(row, i + 1, tabName, carryDate, fieldMap);
      carryDate = result.nextDate || carryDate;
      if (result.record) records.push(result.record);
    }

    return records;
  });
}

export async function getPelletsDataAll(): Promise<PelletRecord[]> {
  return withSheetsAuthError(async () => {
    const tabs = await getPelletsTabs();
    const records: PelletRecord[] = [];
    for (const tab of tabs) {
      records.push(...(await getPelletsData(tab)));
    }
    return records;
  });
}

export function toMonthLabel(key: string) {
  return monthLabel(key);
}
