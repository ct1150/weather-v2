import type { Metadata } from "next";
import { WeatherDiscoveryPlannerV2 } from "../../../components/WeatherDiscoveryPlannerV2";

export const metadata: Metadata = {
  title: "天气探索 | Where Not Rain",
  description: "选择准确出行日期和天气偏好，比较多个城市，并把天气优选目的地直接生成行程。",
};

export default function DiscoverPage() {
  return <WeatherDiscoveryPlannerV2 locale="zh-cn" />;
}
