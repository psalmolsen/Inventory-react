export type StationConsumptionRecord = {
  date: string;
  station: string;
  materialCode: string;
  description: string;
  quantity: number;
  uom: string;
  unitCost: number;
  totalCost: number;
  signature: string;
};

export type MaterialItem = {
  code: string;
  description: string;
  uom: string;
  price: number;
  balance: number;
};
