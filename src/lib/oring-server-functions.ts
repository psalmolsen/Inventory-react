import { createServerFn } from "@tanstack/react-start";
import { getOringTabs, getOringData, getOringDataAll, appendOringReport } from "./oring-sheets";

export const getOringTabsFn = createServerFn({ method: "GET" }).handler(async () => {
  return await getOringTabs();
});

export const getOringDataFn = createServerFn({ method: "GET" })
  .validator((tabName: string) => tabName)
  .handler(async ({ data: tabName }) => {
    if (tabName === "All") {
      return await getOringDataAll();
    }
    return await getOringData(tabName);
  });

export const addOringRecordFn = createServerFn({ method: "POST" })
  .validator((d: {
    tabName: string;
    valveCameFrom: string;
    dateGroups: {
      date: string;
      shifts: {
        time: string;
        valveCameFrom: string;
        installedTo: string;
        valvesRepaired: number;
        good: number;
        reject: number;
        remarks: string;
      }[];
    }[];
  }) => d)
  .handler(async ({ data }) => {
    const { tabName, ...report } = data;
    await appendOringReport(tabName, report);
  });
