import type { Metadata } from "next";
import { WeatherDiscoveryPlannerLive } from "../../../components/WeatherDiscoveryPlannerLive";

export const metadata: Metadata = {
  title: "天气探索 | Where Not Rain",
  description: "选择准确出行日期和天气偏好，比较多个城市，并把天气优选目的地直接生成行程。",
};

export default function DiscoverPage() {
  return <WeatherDiscoveryPlannerLive locale="zh-cn" />;
}
