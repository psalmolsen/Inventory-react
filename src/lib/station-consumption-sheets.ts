import { google } from "googleapis";
import {
  createSheetsClient,
  formatSheetsAuthError,
  resolveCredentialsPath,
} from "./google-sheets-auth";
import type { StationConsumptionRecord, MaterialItem } from "./station-consumption-types";

const SPREADSHEET_ID = "19h3v6jdlP8KqNVeUCE0PYsXl9-uFAgDKWBnd6XpMD8o";
const SHEET_NAME = "Sheet1";
const MATERIAL_SPREADSHEET_ID = "1zNxROdrK1ip-8bQA4PAqQoy1YNDKcKSxM76KKgXlOUs";

const credentialsPath = resolveCredentialsPath(
  "STATION_GOOGLE_APPLICATION_CREDENTIALS",
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
    throw formatSheetsAuthError(error, credentialsPath, "Station Consumption");
  }
}

function normalizeStation(station: string): string {
  const s = station.trim().toLowerCase();
  if (s.includes("paint")) return "Painting";
  if (s.includes("hot") || s.includes("hotwork")) return "Hotworks";
  if (s.includes("ctc")) return "CTC";
  if (s.includes("cosmetic")) return "Cosmetics";
  return station.trim();
}

function parseDouble(value: any): number {
  if (value === null || value === undefined || value === "") return 0;
  const str = String(value).replace(/,/g, "").trim();
  const parsed = parseFloat(str);
  return isNaN(parsed) ? 0 : parsed;
}

function parseDate(value: any): string {
  if (!value) return "";
  const str = String(value).trim();
  
  // Match Java's date parsing formats
  const formats = [
    /^(\d{1,2})\/(\d{1,2})\/(\d{2})$/, // M/d/yy
    /^(\d{1,2})\/(\d{1,2})\/(\d{4})$/, // M/d/yyyy
    /^(\d{2})\/(\d{2})\/(\d{2})$/, // MM/dd/yy
    /^(\d{2})\/(\d{2})\/(\d{4})$/, // MM/dd/yyyy
    /^\d{4}-\d{2}-\d{2}$/, // ISO_LOCAL_DATE
    /^(\w{3})\s+(\d{1,2}),\s+(\d{4})$/, // MMM d, yyyy
    /^(\d{1,2})\s+(\w{3})\s+(\d{4})$/, // d MMM yyyy
  ];
  
  for (const format of formats) {
    const match = str.match(format);
    if (match) {
      let year: number = 0, month: number = 0, day: number = 0;
      
      if (format === formats[0] || format === formats[1]) {
        // M/d/yy or M/d/yyyy
        month = Number(match[1]);
        day = Number(match[2]);
        year = Number(match[3]);
        if (year < 100) year += 2000;
      } else if (format === formats[2] || format === formats[3]) {
        // MM/dd/yy or MM/dd/yyyy
        month = Number(match[1]);
        day = Number(match[2]);
        year = Number(match[3]);
        if (year < 100) year += 2000;
      } else if (format === formats[4]) {
        // ISO_LOCAL_DATE
        const parts = str.split("-");
        year = Number(parts[0]);
        month = Number(parts[1]);
        day = Number(parts[2]);
      } else if (format === formats[5]) {
        // MMM d, yyyy
        const monthNames = ["JAN", "FEB", "MAR", "APR", "MAY", "JUN", "JUL", "AUG", "SEP", "OCT", "NOV", "DEC"];
        month = monthNames.indexOf(match[1].toUpperCase()) + 1;
        day = Number(match[2]);
        year = Number(match[3]);
      } else if (format === formats[6]) {
        // d MMM yyyy
        const monthNames = ["JAN", "FEB", "MAR", "APR", "MAY", "JUN", "JUL", "AUG", "SEP", "OCT", "NOV", "DEC"];
        day = Number(match[1]);
        month = monthNames.indexOf(match[2].toUpperCase()) + 1;
        year = Number(match[3]);
      }
      
      if (!isNaN(year) && !isNaN(month) && !isNaN(day)) {
        return `${year}-${String(month).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
      }
    }
  }
  
  // Try JavaScript Date as fallback
  try {
    const date = new Date(str);
    if (!isNaN(date.getTime())) {
      return date.toISOString().split("T")[0];
    }
  } catch (e) {
    // If parsing fails, return as-is
  }
  return str;
}

function formatDateForSheet(date: Date): string {
  // Match Java's getDateString() format: "M/d/yyyy"
  return `${date.getMonth() + 1}/${date.getDate()}/${date.getFullYear()}`;
}

async function ensureHeaderRow(): Promise<void> {
  const sheets = getSheetsClient();
  const res = await sheets.spreadsheets.values.get({
    spreadsheetId: SPREADSHEET_ID,
    range: `${SHEET_NAME}!A:I`,
  });

  const rows = res.data.values || [];
  if (rows.length === 0 || !rows[0] || rows[0][0] !== "Date") {
    // Write header row
    await sheets.spreadsheets.values.update({
      spreadsheetId: SPREADSHEET_ID,
      range: `${SHEET_NAME}!A1:I1`,
      valueInputOption: "USER_ENTERED",
      requestBody: {
        values: [["Date", "Station", "Material Code", "Description", "Quantity", "UOM", "Unit Cost", "Total Cost", "Received By"]],
      },
    });
  }
}

export async function getStationConsumptionRecords(): Promise<StationConsumptionRecord[]> {
  return withSheetsAuthError(async () => {
    await ensureHeaderRow();
    
    const sheets = getSheetsClient();
    const res = await sheets.spreadsheets.values.get({
      spreadsheetId: SPREADSHEET_ID,
      range: `${SHEET_NAME}!A:I`,
    });

    const rows = res.data.values || [];
    const records: StationConsumptionRecord[] = [];

    // Skip header row (index 0)
    for (let i = 1; i < rows.length; i++) {
      const row = rows[i];
      if (!row || row.length === 0) continue;

      const date = parseDate(row[0]);
      const station = row[1] ? normalizeStation(row[1]) : "";
      
      // Skip rows with null date or empty station
      if (!date || !station) continue;

      const materialCode = row[2] ? String(row[2]).trim() : "";
      const description = row[3] ? String(row[3]).trim() : "";
      const quantity = parseDouble(row[4]);
      const uom = row[5] ? String(row[5]).trim() : "";
      const unitCost = parseDouble(row[6]);
      const totalCost = parseDouble(row[7]);
      const signature = row[8] ? String(row[8]).trim() : "";

      records.push({
        date,
        station,
        materialCode,
        description,
        quantity,
        uom,
        unitCost,
        totalCost,
        signature,
      });
    }

    return records;
  });
}

export async function addStationConsumptionRecord(record: StationConsumptionRecord): Promise<void> {
  return withSheetsAuthError(async () => {
    await ensureHeaderRow();
    
    const sheets = getSheetsClient();
    
    // Read current rows to determine next row (matching Java logic)
    const res = await sheets.spreadsheets.values.get({
      spreadsheetId: SPREADSHEET_ID,
      range: `${SHEET_NAME}!A:I`,
    });

    const rows = res.data.values || [];
    let nextRow = 1; // Start after header (row 0)
    if (rows.length > 1) {
      nextRow = rows.length;
    }

    // Build row in exact column order (matching Java)
    const dateObj = new Date(record.date);
    const rowValues = [
      formatDateForSheet(dateObj), // Use M/d/yyyy format like Java
      normalizeStation(record.station),
      record.materialCode,
      record.description,
      record.quantity,
      record.uom,
      record.unitCost,
      record.totalCost,
      record.signature,
    ];

    // Write to computed row (matching Java: A{nextRow+1}:I{nextRow+1})
    const range = `${SHEET_NAME}!A${nextRow + 1}:I${nextRow + 1}`;
    await sheets.spreadsheets.values.update({
      spreadsheetId: SPREADSHEET_ID,
      range,
      valueInputOption: "USER_ENTERED",
      requestBody: {
        values: [rowValues],
      },
    });
  });
}

export async function getMaterialMonitoringTabs(): Promise<string[]> {
  return withSheetsAuthError(async () => {
    const sheets = getSheetsClient();
    const res = await sheets.spreadsheets.get({ spreadsheetId: MATERIAL_SPREADSHEET_ID });

    const tabs = res.data.sheets
      ?.map((s: any) => s.properties?.title)
      .filter((t: any): t is string => !!t && t !== "Template");

    return tabs || [];
  });
}

export async function getMaterialsFromCurrentMonth(): Promise<MaterialItem[]> {
  return withSheetsAuthError(async () => {
    const sheets = getSheetsClient();
    
    // Get the current month tab name (full uppercase month name like JULY, AUGUST)
    const now = new Date();
    const monthName = now.toLocaleString("en-US", { month: "long" }).toUpperCase();
    const tabName = monthName;
    
    console.log(`[Station Consumption] Trying to read from tab: "${tabName}"`);
    
    // Read the inventory tab
    const res = await sheets.spreadsheets.values.get({
      spreadsheetId: MATERIAL_SPREADSHEET_ID,
      range: `${tabName}!A:AP`,
    });

    const rows = res.data.values || [];
    console.log(`[Station Consumption] Found ${rows.length} rows in tab "${tabName}"`);
    
    const materials: MaterialItem[] = [];

    // Skip first 4 rows (header rows) - materials start at row 5
    for (let i = 4; i < rows.length; i++) {
      const row = rows[i];
      if (!row || row.length === 0) continue;

      // Skip divider line (rows that don't have a code in column B)
      const code = row[1] ? String(row[1]).trim() : "";
      if (!code) continue;

      const description = row[2] ? String(row[2]).trim() : "";
      const uom = row[3] ? String(row[3]).trim() : "";
      const price = parseDouble(row[4]);
      const balance = parseDouble(row[8]);

      materials.push({
        code,
        description,
        uom,
        price,
        balance,
      });
    }

    console.log(`[Station Consumption] Parsed ${materials.length} materials`);
    return materials;
  });
}

// Material Monitoring balance deduction
export async function deductMaterialBalance(
  materialCode: string,
  quantity: number,
  date: string
): Promise<void> {
  return withSheetsAuthError(async () => {
    console.log(`[Station Consumption] deductMaterialBalance called: materialCode=${materialCode}, quantity=${quantity}, date=${date}`);
    
    const sheets = getSheetsClient();
    
    // Get the current month tab name from the date (full uppercase month name like JULY)
    const dateObj = new Date(date);
    const monthName = dateObj.toLocaleString("en-US", { month: "long" }).toUpperCase();
    const tabName = monthName; // Just month name like JULY, not JULY 2026
    
    console.log(`[Station Consumption] Looking for material in tab: "${tabName}"`);
    
    // Read the inventory tab to find the material row
    const res = await sheets.spreadsheets.values.get({
      spreadsheetId: MATERIAL_SPREADSHEET_ID,
      range: `${tabName}!A:AP`,
    });

    const rows = res.data.values || [];
    console.log(`[Station Consumption] Found ${rows.length} rows in tab "${tabName}"`);
    
    // Find the material row by description (column C = index 2)
    // Start from row 5 (index 4) to skip header rows
    let materialRowIndex = -1;
    for (let i = 4; i < rows.length; i++) {
      const row = rows[i];
      if (row && row[2] && String(row[2]).trim() === materialCode) {
        materialRowIndex = i;
        console.log(`[Station Consumption] Found material at row ${i + 1}: ${materialCode}`);
        break;
      }
    }

    if (materialRowIndex === -1) {
      console.warn(`[Station Consumption] Material "${materialCode}" not found in inventory sheet`);
      return;
    }

    // Get the day of month to determine column
    // Daily columns start at column K (index 10) for day 1
    const dayOfMonth = dateObj.getDate();
    const dayColumnIndex = 10 + (dayOfMonth - 1); // Column K (index 10) + day - 1
    
    console.log(`[Station Consumption] Day ${dayOfMonth} -> column index ${dayColumnIndex} (${String.fromCharCode(65 + dayColumnIndex)})`);
    
    // Get current value
    const currentValue = parseDouble(rows[materialRowIndex][dayColumnIndex]);
    const newValue = currentValue + quantity;
    
    console.log(`[Station Consumption] Current value: ${currentValue}, New value: ${newValue}`);

    // Update the daily cell (Google Sheet formula will handle balance calculation)
    const columnLetter = String.fromCharCode(65 + dayColumnIndex);
    const cellRange = `${tabName}!${columnLetter}${materialRowIndex + 1}`;
    console.log(`[Station Consumption] Writing to range: ${cellRange}`);
    
    await sheets.spreadsheets.values.update({
      spreadsheetId: MATERIAL_SPREADSHEET_ID,
      range: cellRange,
      valueInputOption: "USER_ENTERED",
      requestBody: {
        values: [[newValue]],
      },
    });
    
    console.log(`[Station Consumption] Successfully wrote to Material Monitoring sheet`);
  });
}
