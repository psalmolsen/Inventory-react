import { createServerFn } from "@tanstack/react-start";
import { getCnfTabs, getCnfItems, updateCnfStockIn, updateCnfStockOut, addCnfItem } from "./cnf-sheets";

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

export const addCnfItemFn = createServerFn({ method: "POST" })
  .validator((data: { tabName: string; values: { brand: string; category: string; variant: string; uom: string; price: number; initialStock: number; inQuantity: number; date: string; currentBalance: number; outQuantity: number } }) => data)
  .handler(async ({ data }) => {
    await addCnfItem(data.tabName, data.values);
    return { success: true };
  });

// ─── Add New CNF Brand (multi-part, multi-variant) ───────────────────────────
export const addNewCnfFn = createServerFn({ method: "POST" })
  .validator((data: {
    tabName: string;
    brand: string;
    parts: { name: string; variants: string[] }[];
  }) => data)
  .handler(async ({ data }) => {
    const today = new Date().toISOString().split("T")[0];
    let isFirstBrandRow = true;

    for (const part of data.parts) {
      let isFirstPartRow = true;
      for (const variant of part.variants) {
        await addCnfItem(data.tabName, {
          // Brand col: only on the very first row of this brand block
          brand: isFirstBrandRow ? data.brand : "",
          // Category col: only on the first variant of each part
          category: isFirstPartRow ? part.name : "",
          variant,
          uom: "Pcs",
          price: 0,
          initialStock: 0,
          inQuantity: 0,
          date: today,
          currentBalance: 0,
          outQuantity: 0,
        });
        isFirstBrandRow = false;
        isFirstPartRow = false;
      }
    }

    return { success: true };
  });
