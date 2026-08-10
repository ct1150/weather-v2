import type { Metadata } from "next";
import { WeatherDiscoveryPlannerLive } from "../../components/WeatherDiscoveryPlannerLive";

export const metadata: Metadata = {
  title: "Weather Discovery | Where Not Rain",
  description:
    "Choose exact travel dates, rank destinations by weather intent, compare cities and turn the shortlist into a weather-aware trip.",
};

export default function DiscoverPage() {
  return <WeatherDiscoveryPlannerLive locale="en" />;
}
