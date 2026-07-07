import { google } from "googleapis";
import {
  createSheetsClient,
  formatSheetsAuthError,
  resolveCredentialsPath,
} from "./google-sheets-auth";

const spreadsheetId = process.env.SPREADSHEET_ID!;
const credentialsPath = resolveCredentialsPath("GOOGLE_APPLICATION_CREDENTIALS");

let sheetsClient: any = null;

function getSheetsClient() {
  if (!sheetsClient) {
    const auth = createSheetsClient(credentialsPath);
    sheetsClient = google.sheets({ version: "v4", auth });
  }
  return sheetsClient;
}

export type MaterialItem = {
  rowNumber: number;
  date: string;
  code: string;
  desc: string;
  uom: string;
  price: number | null;
  initial: number;
  received: number;
  balance: number;
  issued: number;
  dailyOut: number[];
  tabName: string;
  tone: string;
  initials: string;
};

const tones = [
  "from-[#293A92] to-[#4B5FCB]",
  "from-[#1A2560] to-[#3A4BB0]",
  "from-[#C0392B] to-[#E56A5D]",
  "from-[#E9B52D] to-[#F6D163]",
  "from-[#293A92] to-[#6273D6]",
];

function getToneForCode(code: string) {
  let hash = 0;
  for (let i = 0; i < code.length; i++) {
    hash = code.charCodeAt(i) + ((hash << 5) - hash);
  }
  return tones[Math.abs(hash) % tones.length];
}

function getCellString(row: any[], index: number): string {
  if (!row || index >= row.length) return "";
  const val = row[index];
  return val !== undefined && val !== null ? String(val).trim() : "";
}

function getCellDouble(row: any[], index: number): number {
  const val = getCellString(row, index);
  if (!val) return 0;
  const parsed = parseFloat(val.replace(/,/g, ""));
  return isNaN(parsed) ? 0 : parsed;
}

function getCellPrice(row: any[], index: number): number | null {
  const val = getCellString(row, index).toLowerCase();
  if (!val || val === "n/a" || val === "na") return null;
  const parsed = parseFloat(val.replace(/,/g, ""));
  return isNaN(parsed) ? null : parsed;
}

function getColumnLetter(colNum: number): string {
  let temp;
  let letter = "";
  while (colNum > 0) {
    temp = (colNum - 1) % 26;
    letter = String.fromCharCode(65 + temp) + letter;
    colNum = Math.floor((colNum - temp - 1) / 26);
  }
  return letter;
}

async function withSheetsAuthError<T>(label: string, fn: () => Promise<T>): Promise<T> {
  try {
    return await fn();
  } catch (error) {
    throw formatSheetsAuthError(error, credentialsPath, label);
  }
}

export async function getTabs(): Promise<string[]> {
  return withSheetsAuthError("Material Monitoring", async () => {
    const client = getSheetsClient();
    const res = await client.spreadsheets.get({ spreadsheetId });
    const sheets = res.data.sheets || [];
    return sheets.map((s: any) => s.properties?.title || "");
  });
}

export async function getMaterials(tabName: string): Promise<MaterialItem[]> {
  return withSheetsAuthError("Material Monitoring", async () => {
    const client = getSheetsClient();
    const res = await client.spreadsheets.values.get({
      spreadsheetId,
      range: `${tabName}!A1:AQ150`,
    });

    const rows = res.data.values || [];
    const materials: MaterialItem[] = [];

    for (let i = 4; i < rows.length; i++) {
      const row = rows[i];
      const code = getCellString(row, 1);
      if (code && code.toLowerCase() !== "code" && code.toLowerCase() !== "code no.") {
        const initials = code.substring(0, Math.min(2, code.length)).toUpperCase();
        const tone = getToneForCode(code);
        const initial = getCellDouble(row, 5);
        const received = getCellDouble(row, 6);
        const balance = getCellDouble(row, 8);
        const outQty = getCellDouble(row, 9);

        const dailyOut: number[] = [];
        for (let day = 1; day <= 31; day++) {
          dailyOut.push(getCellDouble(row, 11 + (day - 1)));
        }

        const sumDailyOut = dailyOut.reduce((a, b) => a + b, 0);
        const totalIssuedVal = getCellDouble(row, 42);
        const totalIssued = totalIssuedVal > 0 ? totalIssuedVal : sumDailyOut;

        materials.push({
          rowNumber: i + 1,
          date: getCellString(row, 0),
          code,
          desc: getCellString(row, 2),
          uom: getCellString(row, 3),
          price: getCellPrice(row, 4),
          initial,
          received,
          balance: balance || (initial + received - totalIssued),
          issued: outQty || totalIssued,
          dailyOut,
          tabName,
          tone,
          initials,
        });
      }
    }

    return materials;
  });
}

export async function updateStockIn(tabName: string, rowNumber: number, qty: number): Promise<void> {
  await withSheetsAuthError("Material Monitoring", async () => {
    const client = getSheetsClient();
    const dateStr = new Date().toISOString().split("T")[0];
    const colG = getColumnLetter(7);
    const colH = getColumnLetter(8);

    // Read current received and balance values
    const currentRes = await client.spreadsheets.values.get({
      spreadsheetId,
      range: `${tabName}!${colG}${rowNumber}:${colH}${rowNumber}`,
    });

    const currentRow = currentRes.data.values?.[0] || [];
    const currentReceived = getCellDouble(currentRow, 0);
    const currentBalance = getCellDouble(currentRow, 1);

    // Calculate new values
    const newReceived = currentReceived + qty;
    const newBalance = currentBalance + qty;

    // Update received column
    await client.spreadsheets.values.update({
      spreadsheetId,
      range: `${tabName}!${colG}${rowNumber}`,
      valueInputOption: "USER_ENTERED",
      requestBody: { values: [[newReceived]] },
    });

    // Update balance column
    await client.spreadsheets.values.update({
      spreadsheetId,
      range: `${tabName}!${colH}${rowNumber}`,
      valueInputOption: "USER_ENTERED",
      requestBody: { values: [[newBalance]] },
    });
  });
}

export async function updateStockOut(tabName: string, rowNumber: number, qty: number, day: number): Promise<void> {
  await withSheetsAuthError("Material Monitoring", async () => {
    const client = getSheetsClient();
    const colNumber = 12 + (day - 1);
    const colLetter = getColumnLetter(colNumber);

    await client.spreadsheets.values.update({
      spreadsheetId,
      range: `${tabName}!${colLetter}${rowNumber}`,
      valueInputOption: "USER_ENTERED",
      requestBody: { values: [[qty]] },
    });
  });
}

export async function updateMaterial(
  tabName: string,
  rowNumber: number,
  data: {
    date: string;
    code: string;
    desc: string;
    uom: string;
    price: number | null;
    initial: number;
    received: number;
    balance: number;
    issued: number;
  }
): Promise<void> {
  await withSheetsAuthError("Material Monitoring", async () => {
    const client = getSheetsClient();
    const values = [
      data.date,
      data.code,
      data.desc,
      data.uom,
      data.price === null ? "N/A" : data.price,
      data.initial,
      data.received,
      "",
      data.balance,
      data.issued,
    ];

    await client.spreadsheets.values.update({
      spreadsheetId,
      range: `${tabName}!A${rowNumber}:J${rowNumber}`,
      valueInputOption: "USER_ENTERED",
      requestBody: { values: [values] },
    });
  });
}

export async function addMaterial(
  tabName: string,
  data: {
    date: string;
    code: string;
    desc: string;
    uom: string;
    price: number | null;
    initial: number;
    received: number;
    balance: number;
    issued: number;
  }
): Promise<void> {
  await withSheetsAuthError("Material Monitoring", async () => {
    const client = getSheetsClient();
    const values = [
      data.date,
      data.code,
      data.desc,
      data.uom,
      data.price === null ? "N/A" : data.price,
      data.initial,
      data.received,
      "",
      data.balance,
      data.issued,
    ];

    for (let d = 1; d <= 31; d++) {
      values.push("");
    }
    values.push(0);

    await client.spreadsheets.values.append({
      spreadsheetId,
      range: `${tabName}!A5:AQ`,
      valueInputOption: "USER_ENTERED",
      insertDataOption: "INSERT_ROWS",
      requestBody: { values: [values] },
    });
  });
}

const MONTH_SHORT = ["JAN", "FEB", "MAR", "APR", "MAY", "JUN", "JUL", "AUG", "SEP", "OCT", "NOV", "DEC"];
const MONTH_FULL = ["JANUARY", "FEBRUARY", "MARCH", "APRIL", "MAY", "JUNE", "JULY", "AUGUST", "SEPTEMBER", "OCTOBER", "NOVEMBER", "DECEMBER"];

function resolveTabName(monthIdx: number, existingTabs: string[]): string {
  const usesFullNames = existingTabs.some((tab) =>
    MONTH_FULL.some((full) => full.toLowerCase() === tab.toLowerCase())
  );
  return usesFullNames ? MONTH_FULL[monthIdx] : MONTH_SHORT[monthIdx];
}

function findMostRecentTab(existingTabs: string[], currentMonthIdx: number): string | null {
  const startMonth = currentMonthIdx === 0 ? 11 : currentMonthIdx - 1;
  for (let m = startMonth; m >= 0; m--) {
    const short = MONTH_SHORT[m];
    const full = MONTH_FULL[m];
    const found = existingTabs.find(
      (t) => t.toLowerCase() === short.toLowerCase() || t.toLowerCase() === full.toLowerCase()
    );
    if (found) return found;
  }
  for (let m = 11; m > startMonth; m--) {
    const short = MONTH_SHORT[m];
    const full = MONTH_FULL[m];
    const found = existingTabs.find(
      (t) => t.toLowerCase() === short.toLowerCase() || t.toLowerCase() === full.toLowerCase()
    );
    if (found) return found;
  }
  return existingTabs.length > 0 ? existingTabs[existingTabs.length - 1] : null;
}

export async function provisionCurrentMonth(): Promise<string | null> {
  return withSheetsAuthError("Material Monitoring", async () => {
    const client = getSheetsClient();
    const today = new Date();
    const monthIdx = today.getMonth();

    const sheetsMeta = await client.spreadsheets.get({ spreadsheetId });
    const existingTabs: string[] = (sheetsMeta.data.sheets || []).map(
      (s: any) => s.properties?.title || ""
    );

    const currentTab = resolveTabName(monthIdx, existingTabs);
    const alreadyExists = existingTabs.some((t) => t.toLowerCase() === currentTab.toLowerCase());
    if (alreadyExists) {
      console.log(`[MonthProvisioner] Tab "${currentTab}" already exists. Skipping.`);
      return null;
    }

    const sourceTab = findMostRecentTab(existingTabs, monthIdx);
    if (!sourceTab) {
      console.warn("[MonthProvisioner] No source tab found. Skipping provisioning.");
      return null;
    }

    console.log(`[MonthProvisioner] Creating "${currentTab}" from "${sourceTab}"...`);

    await client.spreadsheets.batchUpdate({
      spreadsheetId,
      requestBody: {
        requests: [
          {
            addSheet: {
              properties: { title: currentTab },
            },
          },
        ],
      },
    });

    const sourceRes = await client.spreadsheets.values.get({
      spreadsheetId,
      range: `${sourceTab}!A1:AQ150`,
    });
    const sourceRows: any[][] = sourceRes.data.values || [];

    if (sourceRows.length >= 4) {
      await client.spreadsheets.values.update({
        spreadsheetId,
        range: `${currentTab}!A1`,
        valueInputOption: "USER_ENTERED",
        requestBody: { values: sourceRows.slice(0, 4) },
      });
    }

    const materialRows: any[][] = [];
    for (let i = 4; i < sourceRows.length; i++) {
      const src = sourceRows[i];
      if (!src || !src[1] || String(src[1]).trim() === "") continue;

      materialRows.push([
        src[0] || "",
        src[1] || "",
        src[2] || "",
        src[3] || "",
        src[4] || "",
        src[8] || 0,
      ]);
    }

    if (materialRows.length > 0) {
      await client.spreadsheets.values.update({
        spreadsheetId,
        range: `${currentTab}!A5`,
        valueInputOption: "USER_ENTERED",
        requestBody: { values: materialRows },
      });
    }

    console.log(`[MonthProvisioner] Tab "${currentTab}" created successfully with ${materialRows.length} material rows.`);
    return currentTab;
  });
}
