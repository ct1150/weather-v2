import type { TripPlan } from "./types";
import { qingganDays1To3 } from "./qinggan-family-2026/days-1-3";
import { qingganDays4To6 } from "./qinggan-family-2026/days-4-6";
import { qingganDays7To9 } from "./qinggan-family-2026/days-7-9";

export { PLACES } from "./qinggan-family-2026/core";

export const qingganFamilyTrip: TripPlan = {
  id: "trip-qinggan-family-2026",
  slug: "qinggan-family-2026",
  title: "2026 青甘家庭轻奢环线",
  subtitle: "天气驱动的9天8晚家庭行程 · 2成人＋2老人＋1儿童",
  startDate: "2026-08-08",
  endDate: "2026-08-16",
  travelers: { adults: 2, seniors: 2, children: 1 },
  transportSummary: "厦门航空＋城际铁路＋高铁＋张掖自驾1天＋青海自驾3天",
  vehicleSummary: "张掖：丰田威兰达；敦煌至西宁：大众探岳",
  days: [...qingganDays1To3, ...qingganDays4To6, ...qingganDays7To9],
};
