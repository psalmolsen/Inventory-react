import { createServerFn } from "@tanstack/react-start";
import { getOringTabs, getOringData, getOringDataAll } from "./oring-sheets";

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
