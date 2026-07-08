import { google } from "googleapis";
import type { CnfItem } from "./cnf-types";
import {
  createSheetsClient,
  formatSheetsAuthError,
  resolveCredentialsPath,
} from "./google-sheets-auth";

const spreadsheetId = process.env.CNF_SPREADSHEET_ID || process.env.SPREADSHEET_ID!;
const credentialsPath = resolveCredentialsPath(
  "CNF_GOOGLE_APPLICATION_CREDENTIALS",
  "GOOGLE_APPLICATION_CREDENTIALS"
);

let sheetsClient: any = null;

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
    throw formatSheetsAuthError(error, credentialsPath, "CNF Monitoring");
  }
}

export async function getCnfTabs(): Promise<string[]> {
  return withSheetsAuthError(async () => {
    const sheets = getSheetsClient();
    const res = await sheets.spreadsheets.get({ spreadsheetId });

    const tabs = res.data.sheets
      ?.map((s: any) => s.properties?.title)
      .filter((t: any): t is string => !!t && t !== "Template");

    return tabs || [];
  });
}

export async function getCnfItems(tabName: string): Promise<CnfItem[]> {
  return withSheetsAuthError(async () => {
    const sheets = getSheetsClient();
    const res = await sheets.spreadsheets.values.get({
      spreadsheetId,
      range: `${tabName}!A1:AZ1000`,
      valueRenderOption: "UNFORMATTED_VALUE",
    });

    const rows = res.data.values || [];
    if (rows.length < 5) return [];

    const items: CnfItem[] = [];
    let currentBrand = "";
    let currentCategory: CnfItem["category"] = "OTHER";

    for (let i = 4; i < rows.length; i++) {
      const row = rows[i];

      if (row[0] && String(row[0]).trim()) {
        currentBrand = String(row[0]).trim();
        // Reset category when a new brand block starts
        currentCategory = "OTHER";
      }

      if (row[1] && String(row[1]).trim()) {
        const cat = String(row[1]).trim().toUpperCase();
        if (cat.includes("COLLAR")) currentCategory = "COLLAR";
        else if (cat.includes("NAME PLATE") || cat.includes("NAMEPLATE")) currentCategory = "NAME PLATE";
        else if (cat.includes("FOOT RING") || cat.includes("FOOTRING")) currentCategory = "FOOT RING";
        else currentCategory = "OTHER";
      }

      const variant = String(row[2] ?? "").trim();
      if (!variant || !currentBrand) continue;
      // Skip rows that didn't match a known CNF category
      if (currentCategory === "OTHER") continue;

      const uom = String(row[3] ?? "").trim() || "Pcs";
      const price = parseFloat(row[4]) || 0;
      const initialStock = parseFloat(row[5]) || 0;
      const inQuantity = parseFloat(row[6]) || 0;
      const date = String(row[7] ?? "").trim();
      const currentBalance = parseFloat(row[8]) || 0;
      const outQuantity = parseFloat(row[9]) || 0;

      const dateColumns: number[] = [];
      for (let col = 10; col <= 40; col++) {          // K(10)–AO(40) = days 1–31
        dateColumns.push(parseFloat(row[col]) || 0);
      }
      const totalIssued = parseFloat(row[41]) || 0;   // AP(41) = total issued

      items.push({
        brand: currentBrand,
        category: currentCategory,
        variant,
        uom,
        price,
        initialStock,
        inQuantity,
        date,
        currentBalance,
        outQuantity,
        dateColumns,
        totalIssued,
        tabName,
        rowNumber: i + 1,
      });
    }

    return items;
  });
}

export async function updateCnfStockIn(tabName: string, rowNumber: number, qty: number): Promise<void> {
  return withSheetsAuthError(async () => {
    const sheets = getSheetsClient();

    // Read current IN quantity (col G) only — balance is formula-driven in the sheet
    const res = await sheets.spreadsheets.values.get({
      spreadsheetId,
      range: `${tabName}!G${rowNumber}`,
      valueRenderOption: "UNFORMATTED_VALUE",
    });

    const currentIn = parseFloat(res.data.values?.[0]?.[0]) || 0;
    const newIn = currentIn + qty;

    // Write only col G — let GSheet formulas recalculate balance
    await sheets.spreadsheets.values.update({
      spreadsheetId,
      range: `${tabName}!G${rowNumber}`,
      valueInputOption: "USER_ENTERED",
      requestBody: {
        values: [[newIn]],
      },
    });
  });
}

export async function updateCnfStockOut(
  tabName: string,
  rowNumber: number,
  qty: number,
  day: number
): Promise<void> {
  return withSheetsAuthError(async () => {
    const sheets = getSheetsClient();

    // Col K = column 11 (1-indexed) = day 1
    // Col K + (day - 1) = the target day column
    const colNumber = 11 + (day - 1); // K=11 for day 1, L=12 for day 2, …
    const colLetter = getColumnLetter(colNumber);

    // Read the current value in that day cell first, then add to it
    const res = await sheets.spreadsheets.values.get({
      spreadsheetId,
      range: `${tabName}!${colLetter}${rowNumber}`,
      valueRenderOption: "UNFORMATTED_VALUE",
    });

    const currentDayOut = parseFloat(res.data.values?.[0]?.[0]) || 0;
    const newDayOut = currentDayOut + qty;

    // Write ONLY the day column — let GSheet formulas handle balance, out total, etc.
    await sheets.spreadsheets.values.update({
      spreadsheetId,
      range: `${tabName}!${colLetter}${rowNumber}`,
      valueInputOption: "USER_ENTERED",
      requestBody: {
        values: [[newDayOut]],
      },
    });
  });
}

function getColumnLetter(colNum: number): string {
  let temp: number;
  let letter = "";
  while (colNum > 0) {
    temp = (colNum - 1) % 26;
    letter = String.fromCharCode(65 + temp) + letter;
    colNum = Math.floor((colNum - temp - 1) / 26);
  }
  return letter;
}

export async function updateCnfItem(
  tabName: string,
  rowNumber: number,
  values: {
    variant: string;
    uom: string;
    price: number;
    initialStock: number;
    inQuantity: number;
    currentBalance: number;
    outQuantity: number;
  }
): Promise<void> {
  return withSheetsAuthError(async () => {
    const sheets = getSheetsClient();
    await sheets.spreadsheets.values.update({
      spreadsheetId,
      range: `${tabName}!C${rowNumber}:J${rowNumber}`,
      valueInputOption: "RAW",
      requestBody: {
        values: [[
          values.variant,
          values.uom,
          values.price,
          values.initialStock,
          values.inQuantity,
          "",
          values.currentBalance,
          values.outQuantity,
        ]],
      },
    });
  });
}

export async function addCnfItem(
  tabName: string,
  values: {
    brand: string;
    category: string;
    variant: string;
    uom: string;
    price: number;
    initialStock: number;
    inQuantity: number;
    date: string;
    currentBalance: number;
    outQuantity: number;
  }
): Promise<void> {
  return withSheetsAuthError(async () => {
    const sheets = getSheetsClient();
    const row = [
      values.brand,       // A - Brand
      values.category,    // B - Parts
      values.variant,     // C - Variant
      values.uom,         // D - UOM
      values.price,       // E - Price/Unit
      values.initialStock,// F - Initial Stock
      values.inQuantity,  // G - IN QUANTITY
      values.date,        // H - Date
      values.currentBalance, // I - Balance Qty
      values.outQuantity, // J - Out QTY
      ...Array.from({ length: 31 }, () => 0), // K–AO: days 1–31
      0,                  // AP: Total Issued
    ];

    await sheets.spreadsheets.values.append({
      spreadsheetId,
      range: `${tabName}!A1:AZ1`,
      valueInputOption: "RAW",
      insertDataOption: "INSERT_ROWS",
      requestBody: {
        values: [row],
      },
    });
  });
}
