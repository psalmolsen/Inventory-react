// ─── CNF Types (can be imported in client code) ────────────────────────────

export type CnfItem = {
  brand: string;
  category: "COLLAR" | "NAME PLATE" | "FOOT RING" | "OTHER";
  variant: string;
  uom: string;
  price: number;
  initialStock: number;
  inQuantity: number;
  date: string;
  currentBalance: number;
  outQuantity: number;
  dateColumns: number[];  // days 1–31 (K–AO)
  totalIssued: number;    // AP = sum of all daily issues
  tabName: string;
  rowNumber: number;
};
