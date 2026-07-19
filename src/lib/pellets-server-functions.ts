import { createServerFn } from "@tanstack/react-start";
import { appendPelletsRecord, getPelletsTabs, getPelletsData, getPelletsDataAll } from "./pellets-sheets";

export const getPelletsTabsFn = createServerFn({ method: "GET" }).handler(async () => {
  return await getPelletsTabs();
});

export const getPelletsDataFn = createServerFn({ method: "GET" })
  .validator((tabName: string) => tabName)
  .handler(async ({ data: tabName }) => {
    if (tabName === "All") return await getPelletsDataAll();
    return await getPelletsData(tabName);
  });

export const addPelletsRecordFn = createServerFn({ method: "POST" })
  .validator((data: {
    tabName: string;
    dateGroups: {
      date: string;
      shifts: {
        sack: string;
        time: string;
        good: number;
        reject: number;
        kgs: string;
      }[];
    }[];
  }) => data)
  .handler(async ({ data }) => {
    await appendPelletsRecord(data.tabName, { dateGroups: data.dateGroups });
    return { success: true };
  });
