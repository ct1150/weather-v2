import type { Metadata } from "next";
import { WeatherDiscoveryPlannerLive } from "../../../components/WeatherDiscoveryPlannerLive";

export const metadata: Metadata = {
  title: "天氣探索 | Where Not Rain",
  description: "選擇準確出行日期和天氣偏好，比較多個城市，並把天氣優選目的地直接建立成行程。",
};

export default function DiscoverPage() {
  return <WeatherDiscoveryPlannerLive locale="zh-hant" />;
}
