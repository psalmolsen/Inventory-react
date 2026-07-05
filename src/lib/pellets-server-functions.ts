import { createServerFn } from "@tanstack/react-start";
import { getPelletsTabs, getPelletsData, getPelletsDataAll } from "./pellets-sheets";

export const getPelletsTabsFn = createServerFn({ method: "GET" }).handler(async () => {
  return await getPelletsTabs();
});

export const getPelletsDataFn = createServerFn({ method: "GET" })
  .validator((tabName: string) => tabName)
  .handler(async ({ data: tabName }) => {
    if (tabName === "All") return await getPelletsDataAll();
    return await getPelletsData(tabName);
  });
