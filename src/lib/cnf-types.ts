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
  dateColumns: number[];
  tabName: string;
  rowNumber: number;
};
