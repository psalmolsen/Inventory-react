import { createFileRoute } from "@tanstack/react-router";
import CNFMonitoring from "@/components/CNFMonitoring";

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "CNF Monitoring · CCB Inventory" },
      {
        name: "description",
        content:
          "Track Collar, Nameplate, and Footring stock by brand — receive, issue, and review consumption across periods.",
      },
      { property: "og:title", content: "CNF Monitoring · CCB Inventory" },
      {
        property: "og:description",
        content:
          "Enterprise CNF inventory monitoring for gas-cylinder repair operations.",
      },
    ],
  }),
  component: CNFMonitoring,
});
