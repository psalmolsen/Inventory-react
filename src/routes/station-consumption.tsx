import { createFileRoute } from "@tanstack/react-router";
import StationConsumption from "../components/StationConsumption";

export const Route = createFileRoute("/station-consumption")({ component: StationConsumption });
