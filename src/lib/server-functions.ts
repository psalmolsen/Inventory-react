import { createServerFn } from "@tanstack/react-start";
import { getTabs, getMaterials, updateStockIn, updateStockOut, updateMaterial, addMaterial, provisionCurrentMonth } from "./sheets";

export const getTabsFn = createServerFn({ method: "GET" }).handler(async () => {
  return await getTabs();
});

export const getMaterialsFn = createServerFn({ method: "GET" })
  .validator((tabName: string) => tabName)
  .handler(async ({ data: tabName }) => {
    return await getMaterials(tabName);
  });

export const stockInFn = createServerFn({ method: "POST" })
  .validator((data: { tabName: string; rowNumber: number; qty: number }) => data)
  .handler(async ({ data }) => {
    await updateStockIn(data.tabName, data.rowNumber, data.qty);
    return { success: true };
  });

export const stockOutFn = createServerFn({ method: "POST" })
  .validator((data: { tabName: string; rowNumber: number; qty: number; day: number }) => data)
  .handler(async ({ data }) => {
    await updateStockOut(data.tabName, data.rowNumber, data.qty, data.day);
    return { success: true };
  });

export const editMaterialFn = createServerFn({ method: "POST" })
  .validator((data: { tabName: string; rowNumber: number; values: any }) => data)
  .handler(async ({ data }) => {
    await updateMaterial(data.tabName, data.rowNumber, data.values);
    return { success: true };
  });

export const addMaterialFn = createServerFn({ method: "POST" })
  .validator((data: { tabName: string; values: any }) => data)
  .handler(async ({ data }) => {
    await addMaterial(data.tabName, data.values);
    return { success: true };
  });

export const provisionCurrentMonthFn = createServerFn({ method: "POST" })
  .handler(async () => {
    const created = await provisionCurrentMonth();
    return { created };
  });
