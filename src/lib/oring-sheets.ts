import { google } from "googleapis";
import path from "path";

const spreadsheetId = process.env.ORING_SPREADSHEET_ID || "1ReZqAWd1q5nm_m5mRysP4FplVCiszuCAhvKdPmpQKto";
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

export async function getOringTabs(): Promise<string[]> {
  const sheets = getSheetsClient();
  const res = await sheets.spreadsheets.get({ spreadsheetId });
  
  const tabs = res.data.sheets
    ?.map((s: any) => s.properties?.title)
    .filter((t: any): t is string => !!t && t !== "Template");

  return tabs || [];
}

// ─── Get O-Ring data from a specific tab ─────────────────────────────────────

export async function getOringData(tabName: string): Promise<any> {
  const sheets = getSheetsClient();
  
  const res = await sheets.spreadsheets.values.get({
    spreadsheetId,
    range: `${tabName}!A1:AZ1000`,
  });

  const rows = res.data.values || [];
  console.log(`[O-Ring] Tab: ${tabName}, Total rows: ${rows.length}`);
  
  if (rows.length < 2) {
    console.log(`[O-Ring] Not enough rows in ${tabName}`);
    return null;
  }

  // Assuming data structure based on the spec
  // Parse rows to extract KPIs, trend data, source distribution, etc.
  // This is a placeholder - adjust based on actual sheet structure
  
  const data: any = {
    month: tabName,
    kpis: {
      totalRepaired: 0,
      totalRepairedPrevMonth: 0,
      good: 0,
      goodPrevMonth: 0,
      reject: 0,
      rejectPrevMonth: 0,
    },
    trend: [],
    sourceDistribution: [],
    installerRanking: [],
    shiftPerformance: [],
    rejectReasons: [],
    monthlySummary: [],
    activityFeed: [],
    table: {
      rows: [],
      totalRows: 0,
    },
  };

  // Parse data rows starting from row 2 (index 1) - skip header
  for (let i = 1; i < rows.length; i++) {
    const row = rows[i];
    // Parse based on actual column structure
    // This is a placeholder implementation
  }

  console.log(`[O-Ring] Parsed data from ${tabName}`);
  return data;
}

// ─── Get all O-Ring data aggregated ─────────────────────────────────────────

export async function getOringDataAll(): Promise<any> {
  const tabs = await getOringTabs();
  
  const monthlySummary: any[] = [];
  const allRows: any[] = [];
  
  for (const tab of tabs) {
    const tabData = await getOringData(tab);
    if (tabData) {
      monthlySummary.push({
        month: tab,
        repaired: tabData.kpis?.totalRepaired || 0,
      });
      allRows.push(...(tabData.table?.rows || []));
    }
  }

  return {
    month: "All",
    kpis: {
      totalRepaired: monthlySummary.reduce((sum, m) => sum + (m.repaired || 0), 0),
      totalRepairedPrevMonth: 0,
      good: 0,
      goodPrevMonth: 0,
      reject: 0,
      rejectPrevMonth: 0,
    },
    trend: [],
    sourceDistribution: [],
    installerRanking: [],
    shiftPerformance: [],
    rejectReasons: [],
    monthlySummary,
    activityFeed: [],
    table: {
      rows: allRows,
      totalRows: allRows.length,
    },
  };
}
