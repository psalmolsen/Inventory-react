import { google } from "googleapis";
import path from "path";
import type { CnfItem } from "./cnf-types";

const spreadsheetId = process.env.CNF_SPREADSHEET_ID || process.env.SPREADSHEET_ID!;
const credentialsPath = process.env.GOOGLE_APPLICATION_CREDENTIALS || "./service-account.json";

let sheetsClient: any = null;

function getSheetsClient() {
  if (!sheetsClient) {
    const resolvedPath = path.isAbsolute(credentialsPath)
      ? credentialsPath
      : path.resolve(process.cwd(), credentialsPath);

    const auth = new google.auth.GoogleAuth({
      keyFile: resolvedPath,
      scopes: ["https://www.googleapis.com/auth/spreadsheets"],
    });
    sheetsClient = google.sheets({ version: "v4", auth });
  }
  return sheetsClient;
}

// ─── Get all tabs (months) from the spreadsheet ────────────────────────────

export async function getCnfTabs(): Promise<string[]> {
  const sheets = getSheetsClient();
  const res = await sheets.spreadsheets.get({ spreadsheetId });
  
  const tabs = res.data.sheets
    ?.map((s: any) => s.properties?.title)
    .filter((t: any): t is string => !!t && t !== "Template");

  return tabs || [];
}

// ─── Get CNF items from a specific tab ─────────────────────────────────────

export async function getCnfItems(tabName: string): Promise<CnfItem[]> {
  const sheets = getSheetsClient();
  
  const res = await sheets.spreadsheets.values.get({
    spreadsheetId,
    range: `${tabName}!A1:AZ1000`,
  });

  const rows = res.data.values || [];
  console.log(`[CNF] Tab: ${tabName}, Total rows: ${rows.length}`);
  
  if (rows.length < 6) {
    console.log(`[CNF] Not enough rows in ${tabName}`);
    return [];
  }

  const items: CnfItem[] = [];
  let currentBrand = "";
  let currentCategory: CnfItem["category"] = "OTHER";

  // Data starts at row 6 (index 5) based on the screenshot
  for (let i = 5; i < rows.length; i++) {
    const row = rows[i];
    
    // Update current brand when column A has a value
    if (row[0] && row[0].trim()) {
      currentBrand = row[0].trim();
      console.log(`[CNF] Row ${i + 1}: Found brand "${currentBrand}"`);
    }

    // Update current category when column B has a value
    if (row[1] && row[1].trim()) {
      const cat = row[1].trim().toUpperCase();
      if (cat.includes("COLLAR")) currentCategory = "COLLAR";
      else if (cat.includes("NAME PLATE") || cat.includes("NAMEPLATE")) currentCategory = "NAME PLATE";
      else if (cat.includes("FOOT RING") || cat.includes("FOOTRING")) currentCategory = "FOOT RING";
      else currentCategory = "OTHER";
    }

    const variant = row[2]?.trim() || "";
    
    // Skip if no variant OR no current brand
    if (!variant || !currentBrand) continue;

    const uom = row[3]?.trim() || "Pcs";
    const price = parseFloat(row[4]) || 0;
    const initialStock = parseFloat(row[5]) || 0;
    const inQuantity = parseFloat(row[6]) || 0;
    const date = row[7]?.trim() || "";
    const currentBalance = parseFloat(row[8]) || 0;
    const outQuantity = parseFloat(row[9]) || 0;

    const dateColumns: number[] = [];
    for (let col = 10; col < row.length; col++) {
      dateColumns.push(parseFloat(row[col]) || 0);
    }

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
      tabName,
      rowNumber: i + 1,
    });
  }

  console.log(`[CNF] Found ${items.length} items in ${tabName}`);
  return items;
}

// ─── Stock In ───────────────────────────────────────────────────────────────

export async function updateCnfStockIn(tabName: string, rowNumber: number, qty: number): Promise<void> {
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
}

// ─── Stock Out ──────────────────────────────────────────────────────────────

export async function updateCnfStockOut(
  tabName: string,
  rowNumber: number,
  qty: number,
  day: number
): Promise<void> {
  const sheets = getSheetsClient();
  
  const res = await sheets.spreadsheets.values.get({
    spreadsheetId,
    range: `${tabName}!I${rowNumber}:AZ${rowNumber}`,
  });

  const row = res.data.values?.[0] || [];
  const currentBalance = parseFloat(row[0]) || 0;
  const currentOut = parseFloat(row[1]) || 0;

  const dayIndex = day + 1;
  const currentDayOut = parseFloat(row[dayIndex]) || 0;

  const newBalance = Math.max(0, currentBalance - qty);
  const newOut = currentOut + qty;
  const newDayOut = currentDayOut + qty;

  row[0] = newBalance;
  row[1] = newOut;
  row[dayIndex] = newDayOut;

  await sheets.spreadsheets.values.update({
    spreadsheetId,
    range: `${tabName}!I${rowNumber}:AZ${rowNumber}`,
    valueInputOption: "RAW",
    requestBody: {
      values: [row],
    },
  });
}

// ─── Edit CNF Item ──────────────────────────────────────────────────────────

export async function updateCnfItem(
  tabName: string,
  rowNumber: number,
  values: { variant: string; uom: string; price: number; initialStock: number; inQuantity: number; currentBalance: number; outQuantity: number }
): Promise<void> {
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
        "",                      // date col — leave unchanged
        values.currentBalance,
        values.outQuantity,
      ]],
    },
  });
}
