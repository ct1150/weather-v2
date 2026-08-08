import type { Metadata } from "next";
import { WeatherDiscoveryPlannerV2 } from "../../components/WeatherDiscoveryPlannerV2";

export const metadata: Metadata = {
  title: "Weather Discovery | Where Not Rain",
  description:
    "Choose exact travel dates, rank destinations by weather intent, compare cities and turn the shortlist into a weather-aware trip.",
};

export default function DiscoverPage() {
  return <WeatherDiscoveryPlannerV2 locale="en" />;
}
