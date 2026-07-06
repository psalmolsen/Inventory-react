import { createServerFn } from "@tanstack/react-start";
import {
  getStationConsumptionRecords,
  addStationConsumptionRecord,
  deductMaterialBalance,
  getMaterialsFromCurrentMonth,
} from "./station-consumption-sheets";
import type { StationConsumptionRecord, MaterialItem } from "./station-consumption-types";

export const getStationConsumptionRecordsFn = createServerFn({
  method: "GET",
})
.handler(async () => {
  return await getStationConsumptionRecords();
});

export const getMaterialsFromCurrentMonthFn = createServerFn({
  method: "GET",
})
.handler(async () => {
  return await getMaterialsFromCurrentMonth();
});

export const addStationConsumptionRecordFn = createServerFn({ method: "POST" })
  .validator((data: StationConsumptionRecord) => data)
  .handler(async ({ data }) => {
    // Override date with server date to ensure consistency across devices
    const serverDate = new Date().toISOString().slice(0, 10);
    const recordWithServerDate = {
      ...data,
      date: serverDate,
    };
    
    // Add record to station consumption sheet
    await addStationConsumptionRecord(recordWithServerDate);
    
    // Deduct from material monitoring balance using server date
    if (data.materialCode && data.quantity > 0) {
      await deductMaterialBalance(data.materialCode, data.quantity, serverDate);
    }
    
    return { success: true };
  });
