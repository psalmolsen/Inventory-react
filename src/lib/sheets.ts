import { google } from "googleapis";
import path from "path";

// Load spreadsheet configuration from .env or use defaults
const spreadsheetId = process.env.SPREADSHEET_ID!;
const credentialsPath = process.env.GOOGLE_APPLICATION_CREDENTIALS || "./service-account.json";

let sheetsClient: any = null;

function getSheetsClient() {
  if (!sheetsClient) {
    // Resolve credentials relative to current directory if not absolute
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
  "from-[#293A92] to-[#4B5FCB]", // Blue
  "from-[#1A2560] to-[#3A4BB0]", // Navy
  "from-[#C0392B] to-[#E56A5D]", // Red
  "from-[#E9B52D] to-[#F6D163]", // Gold
  "from-[#293A92] to-[#6273D6]", // Light Blue
];

function getToneForCode(code: string) {
  let hash = 0;
  for (let i = 0; i < code.length; i++) {
    hash = code.charCodeAt(i) + ((hash << 5) - hash);
  }
  const index = Math.abs(hash) % tones.length;
  return tones[index];
}

function getCellString(row: any[], index: number): string {
  if (!row || index >= row.length) return "";
  const val = row[index];
  return val !== undefined && val !== null ? String(val).trim() : "";
}

function getCellDouble(row: any[], index: number): number {
  const val = getCellString(row, index);
  if (!val) return 0;
  // Remove commas for parsing
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

export async function getTabs(): Promise<string[]> {
  try {
    const client = getSheetsClient();
    const res = await client.spreadsheets.get({ spreadsheetId });
    const sheets = res.data.sheets || [];
    return sheets.map((s: any) => s.properties?.title || "");
  } catch (error) {
    console.error("Error fetching sheet tabs:", error);
    // Fallback to hardcoded list if the API fails
    return ["JAN", "FEB", "MAR", "APR", "MAY", "JUN", "JUL", "AUG", "SEP", "OCT", "NOV", "DEC"];
  }
}

export async function getMaterials(tabName: string): Promise<MaterialItem[]> {
  const client = getSheetsClient();
  const res = await client.spreadsheets.values.get({
    spreadsheetId,
    range: `${tabName}!A1:AQ150`, // Read up to AQ (col index 42), up to row 150
  });
  const rows = res.data.values || [];
  const materials: MaterialItem[] = [];

  // Data starts at row 5 (index 4)
  for (let i = 4; i < rows.length; i++) {
    const row = rows[i];
    const code = getCellString(row, 1);
    // Skip empty rows and row headers
    if (code && code.toLowerCase() !== "code" && code.toLowerCase() !== "code no.") {
      const initials = code.substring(0, Math.min(2, code.length)).toUpperCase();
      const tone = getToneForCode(code);
      const initial = getCellDouble(row, 5);
      const received = getCellDouble(row, 6);
      
      const balance = getCellDouble(row, 8);
      const outQty = getCellDouble(row, 9);
      
      // Daily values: index 11 is Col L (Day 1) to 41 is Col AP (Day 31)
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
}

export async function updateStockIn(tabName: string, rowNumber: number, qty: number): Promise<void> {
  const client = getSheetsClient();
  const dateStr = new Date().toISOString().split("T")[0]; // YYYY-MM-DD
  
  // Col G (Received Qty) is index 6 (Col Number 7)
  // Col H (Tx Date) is index 7 (Col Number 8)
  const colG = getColumnLetter(7);
  const colH = getColumnLetter(8);

  await client.spreadsheets.values.update({
    spreadsheetId,
    range: `${tabName}!${colG}${rowNumber}`,
    valueInputOption: "USER_ENTERED",
    requestBody: { values: [[qty]] },
  });

  await client.spreadsheets.values.update({
    spreadsheetId,
    range: `${tabName}!${colH}${rowNumber}`,
    valueInputOption: "USER_ENTERED",
    requestBody: { values: [[dateStr]] },
  });
}

export async function updateStockOut(tabName: string, rowNumber: number, qty: number, day: number): Promise<void> {
  const client = getSheetsClient();
  // Day 1 maps to Col 12 (Column L)
  const colNumber = 12 + (day - 1);
  const colLetter = getColumnLetter(colNumber);

  await client.spreadsheets.values.update({
    spreadsheetId,
    range: `${tabName}!${colLetter}${rowNumber}`,
    valueInputOption: "USER_ENTERED",
    requestBody: { values: [[qty]] },
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
  const client = getSheetsClient();
  const values = [
    data.date,
    data.code,
    data.desc,
    data.uom,
    data.price === null ? "N/A" : data.price,
    data.initial,
    data.received,
    "", // Col H empty divider
    data.balance,
    data.issued,
  ];

  await client.spreadsheets.values.update({
    spreadsheetId,
    range: `${tabName}!A${rowNumber}:J${rowNumber}`,
    valueInputOption: "USER_ENTERED",
    requestBody: { values: [values] },
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
  const client = getSheetsClient();
  const values = [
    data.date,
    data.code,
    data.desc,
    data.uom,
    data.price === null ? "N/A" : data.price,
    data.initial,
    data.received,
    "", // Col H divider
    data.balance,
    data.issued,
  ];

  // Fill in Day 1 to 31 blank values
  for (let d = 1; d <= 31; d++) {
    values.push("");
  }
  // Total Issued (Col AQ / index 42)
  values.push(0);

  await client.spreadsheets.values.append({
    spreadsheetId,
    range: `${tabName}!A5:AQ`,
    valueInputOption: "USER_ENTERED",
    insertDataOption: "INSERT_ROWS",
    requestBody: { values: [values] },
  });
}

// ---------------------------------------------------------------------------
// Month Auto-Provisioning  (mirrors JavaFX MonthSheetProvisioner)
// ---------------------------------------------------------------------------

const MONTH_SHORT = ["JAN","FEB","MAR","APR","MAY","JUN","JUL","AUG","SEP","OCT","NOV","DEC"];
const MONTH_FULL  = ["JANUARY","FEBRUARY","MARCH","APRIL","MAY","JUNE","JULY","AUGUST","SEPTEMBER","OCTOBER","NOVEMBER","DECEMBER"];

/** Returns the tab name to use for a given month index (0-based),
 *  matching the naming convention already used in existing tabs. */
function resolveTabName(monthIdx: number, existingTabs: string[]): string {
  const usesFullNames = existingTabs.some((tab) =>
    MONTH_FULL.some((f) => f.toLowerCase() === tab.toLowerCase())
  );
  return usesFullNames ? MONTH_FULL[monthIdx] : MONTH_SHORT[monthIdx];
}

/** Walks backward from currentMonthIdx to find the most recent existing tab. */
function findMostRecentTab(existingTabs: string[], currentMonthIdx: number): string | null {
  const startMonth = currentMonthIdx === 0 ? 11 : currentMonthIdx - 1;
  for (let m = startMonth; m >= 0; m--) {
    const short = MONTH_SHORT[m];
    const full  = MONTH_FULL[m];
    const found = existingTabs.find(
      (t) => t.toLowerCase() === short.toLowerCase() || t.toLowerCase() === full.toLowerCase()
    );
    if (found) return found;
  }
  // Try wrapping around to December
  for (let m = 11; m > startMonth; m--) {
    const short = MONTH_SHORT[m];
    const full  = MONTH_FULL[m];
    const found = existingTabs.find(
      (t) => t.toLowerCase() === short.toLowerCase() || t.toLowerCase() === full.toLowerCase()
    );
    if (found) return found;
  }
  return existingTabs.length > 0 ? existingTabs[existingTabs.length - 1] : null;
}

/**
 * Ensures the current month's Google Sheet tab exists.
 * If it does not exist:
 *   1. Creates a blank tab with the current month name.
 *   2. Copies header rows 1-4 from the most recent previous month's tab.
 *   3. For each material row in the source tab, writes identity columns (A-E)
 *      and carries the previous balance (col I) into the new initial stock (col F).
 *
 * Returns the newly created tab name, or null if the tab already existed.
 */
export async function provisionCurrentMonth(): Promise<string | null> {
  const client = getSheetsClient();
  const today = new Date();
  const monthIdx = today.getMonth(); // 0-based

  // 1. Fetch existing tab names
  const sheetsMeta = await client.spreadsheets.get({ spreadsheetId });
  const existingTabs: string[] = (sheetsMeta.data.sheets || []).map(
    (s: any) => s.properties?.title || ""
  );

  // 2. Determine the correct name for this month
  const currentTab = resolveTabName(monthIdx, existingTabs);

  // 3. Tab already exists — nothing to do
  const alreadyExists = existingTabs.some(
    (t) => t.toLowerCase() === currentTab.toLowerCase()
  );
  if (alreadyExists) {
    console.log(`[MonthProvisioner] Tab "${currentTab}" already exists. Skipping.`);
    return null;
  }

  // 4. Find source tab (most recent previous month)
  const sourceTab = findMostRecentTab(existingTabs, monthIdx);
  if (!sourceTab) {
    console.warn("[MonthProvisioner] No source tab found. Skipping provisioning.");
    return null;
  }

  console.log(`[MonthProvisioner] Creating "${currentTab}" from "${sourceTab}"...`);

  // 5. Create the blank new tab
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

  // 6. Read source tab data
  const sourceRes = await client.spreadsheets.values.get({
    spreadsheetId,
    range: `${sourceTab}!A1:AQ150`,
  });
  const sourceRows: any[][] = sourceRes.data.values || [];

  // 7. Copy header rows 1-4
  if (sourceRows.length >= 4) {
    await client.spreadsheets.values.update({
      spreadsheetId,
      range: `${currentTab}!A1`,
      valueInputOption: "USER_ENTERED",
      requestBody: { values: sourceRows.slice(0, 4) },
    });
  }

  // 8. Build new material rows (identity + carry-forward balance as initial stock)
  // DATA_START_ROW = 4 (0-indexed), which is the 5th row (index 4)
  const materialRows: any[][] = [];
  for (let i = 4; i < sourceRows.length; i++) {
    const src = sourceRows[i];
    if (!src || !src[1] || String(src[1]).trim() === "") continue; // skip blank rows

    const newRow = [
      src[0] || "",  // A: Date
      src[1] || "",  // B: Code No.
      src[2] || "",  // C: Description
      src[3] || "",  // D: UOM
      src[4] || "",  // E: Price / Unit
      src[8] || 0,   // F: Initial Stock ← previous month's Balance (col I = index 8)
    ];
    materialRows.push(newRow);
  }

  if (materialRows.length > 0) {
    // Write starting at row 5 (DATA_START_ROW + 1)
    await client.spreadsheets.values.update({
      spreadsheetId,
      range: `${currentTab}!A5`,
      valueInputOption: "USER_ENTERED",
      requestBody: { values: materialRows },
    });
  }

  console.log(`[MonthProvisioner] Tab "${currentTab}" created successfully with ${materialRows.length} material rows.`);
  return currentTab;
}
