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
    });

    const rows = res.data.values || [];
    if (rows.length < 5) return [];

    const items: CnfItem[] = [];
    let currentBrand = "";
    let currentCategory: CnfItem["category"] = "OTHER";

    for (let i = 4; i < rows.length; i++) {
      const row = rows[i];

      if (row[0] && row[0].trim()) {
        currentBrand = row[0].trim();
      }

      if (row[1] && row[1].trim()) {
        const cat = row[1].trim().toUpperCase();
        if (cat.includes("COLLAR")) currentCategory = "COLLAR";
        else if (cat.includes("NAME PLATE") || cat.includes("NAMEPLATE")) currentCategory = "NAME PLATE";
        else if (cat.includes("FOOT RING") || cat.includes("FOOTRING")) currentCategory = "FOOT RING";
        else currentCategory = "OTHER";
      }

      const variant = row[2]?.trim() || "";
      if (!variant || !currentBrand) continue;

      const uom = row[3]?.trim() || "Pcs";
      const price = parseFloat(row[4]) || 0;
      const initialStock = parseFloat(row[5]) || 0;
      const inQuantity = parseFloat(row[6]) || 0;
      const date = row[7]?.trim() || "";
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
    const res = await sheets.spreadsheets.values.get({
      spreadsheetId,
      range: `${tabName}!G${rowNumber}:I${rowNumber}`,
    });

    const row = res.data.values?.[0] || [];
    const currentIn = parseFloat(row[0]) || 0;
    const currentBalance = parseFloat(row[2]) || 0;

    const newIn = currentIn + qty;
    const newBalance = currentBalance + qty;

    await sheets.spreadsheets.values.update({
      spreadsheetId,
      range: `${tabName}!G${rowNumber}:I${rowNumber}`,
      valueInputOption: "RAW",
      requestBody: {
        values: [[newIn, row[1], newBalance]],
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
    const res = await sheets.spreadsheets.values.get({
      spreadsheetId,
      range: `${tabName}!I${rowNumber}:AP${rowNumber}`,  // I=balance, J=out, K–AO=days 1–31, AP=total issued
    });

    const row = res.data.values?.[0] || [];
    const currentBalance = parseFloat(row[0]) || 0;  // I
    const currentOut = parseFloat(row[1]) || 0;       // J
    // row[2]–row[32] = K–AO = days 1–31  (dayIndex = day + 1)
    const dayIndex = day + 1;
    const currentDayOut = parseFloat(row[dayIndex]) || 0;
    const currentTotal = parseFloat(row[33]) || 0;    // AP = total issued (index 33 in this slice)

    const newBalance = Math.max(0, currentBalance - qty);
    const newOut = currentOut + qty;
    const newDayOut = currentDayOut + qty;
    const newTotal = currentTotal + qty;

    // Pad array to cover all 34 positions (I through AP)
    while (row.length < 34) row.push(0);
    row[0] = newBalance;
    row[1] = newOut;
    row[dayIndex] = newDayOut;
    row[33] = newTotal;

    await sheets.spreadsheets.values.update({
      spreadsheetId,
      range: `${tabName}!I${rowNumber}:AP${rowNumber}`,
      valueInputOption: "RAW",
      requestBody: {
        values: [row],
      },
    });
  });
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
