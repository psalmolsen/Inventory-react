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
  sack: string;
  time: string;
  shift: string;
  interval: string;
  brand: string;
  good: number;
  reject: number;
  shots: number;
  kgs: string;
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

  // Google Sheets serial number (e.g. 45796)
  const serial = Number(text);
  if (!isNaN(serial) && serial > 40000 && serial < 60000) {
    const d = new Date((serial - 25569) * 86400 * 1000);
    return `${d.getUTCFullYear()}-${pad2(d.getUTCMonth() + 1)}-${pad2(d.getUTCDate())}`;
  }

  // MM/DD/YY or MM/DD/YYYY or MM-DD-YYYY
  const match = text.match(/^(\d{1,2})[\/-](\d{1,2})[\/-](\d{2}|\d{4})$/);
  if (match) {
    const month = Number(match[1]);
    const day = Number(match[2]);
    let year = Number(match[3]);
    if (year < 100) year += 2000;
    return `${year}-${pad2(month)}-${pad2(day)}`;
  }

  // Any other parseable date string
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
      range: `${tabName}!A:G`,
      valueRenderOption: "FORMATTED_VALUE",
    });

    const rows = res.data.values || [];
    const records: PelletRecord[] = [];

    for (let i = 3; i < rows.length; i++) {
      const row = rows[i];
      if (!row) continue;
      // Pad row so trailing empty cells (e.g. col G) are always accessible
      while (row.length < 7) row.push("");

      const rawDate   = cell(row, 0); // A = Date
      const rawSack   = cell(row, 1); // B = Sack Number
      const rawTime   = cell(row, 2); // C = Time
      const rawGood   = cell(row, 3); // D = Shot Blasting Good
      const rawReject = cell(row, 4); // E = Reject
      const rawBrand  = cell(row, 5); // F = Brands
      const rawKgs    = cell(row, 6); // G = kgs

      if (!rawDate && !rawSack && !rawTime && !rawGood && !rawReject && !rawBrand && !rawKgs) continue;

      const good   = parseNumber(rawGood);
      const reject = parseNumber(rawReject);
      const shots  = good + reject;
      const dateKey  = parseDateKey(rawDate);
      const monthKey = dateKey ? dateKey.slice(0, 7) : "";

      records.push({
        rowNumber: i + 1,
        tabName,
        date: rawDate,
        dateKey,
        monthKey,
        sack: rawSack,
        time: rawTime,
        shift: "",
        interval: "",
        brand: rawBrand,
        good,
        reject,
        shots,
        kgs: rawKgs,
        remarks: "",
        status: statusFor({ reject, shots }),
      });
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
