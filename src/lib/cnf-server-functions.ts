import { createServerFn } from "@tanstack/react-start";
import { getCnfTabs, getCnfItems, updateCnfStockIn, updateCnfStockOut } from "./cnf-sheets";

export const getCnfTabsFn = createServerFn({ method: "GET" }).handler(async () => {
  return await getCnfTabs();
});

export const getCnfItemsFn = createServerFn({ method: "GET" })
  .validator((tabName: string) => tabName)
  .handler(async ({ data: tabName }) => {
    return await getCnfItems(tabName);
  });

export const cnfStockInFn = createServerFn({ method: "POST" })
  .validator((data: { tabName: string; rowNumber: number; qty: number }) => data)
  .handler(async ({ data }) => {
    await updateCnfStockIn(data.tabName, data.rowNumber, data.qty);
    return { success: true };
  });

export const cnfStockOutFn = createServerFn({ method: "POST" })
  .validator((data: { tabName: string; rowNumber: number; qty: number; day: number }) => data)
  .handler(async ({ data }) => {
    await updateCnfStockOut(data.tabName, data.rowNumber, data.qty, data.day);
    return { success: true };
  });

export const cnfEditItemFn = createServerFn({ method: "POST" })
  .validator((data: { tabName: string; rowNumber: number; values: { variant: string; uom: string; price: number; initialStock: number; inQuantity: number; currentBalance: number; outQuantity: number } }) => data)
  .handler(async ({ data }) => {
    const { updateCnfItem } = await import("./cnf-sheets");
    await updateCnfItem(data.tabName, data.rowNumber, data.values);
    return { success: true };
  });
