import type { ReactElement } from "react";
import { CityTripBridgeAction } from "./CityTripBridgeAction";

export type CityTripBridgeLocale = "en" | "zh-cn" | "zh-hant";

interface CityTripBridgeProps {
  readonly locale: CityTripBridgeLocale;
  readonly cityId: string;
  readonly cityName: string;
  readonly countryName: string;
  readonly defaultDate: string;
  readonly workspacePath: string;
}

const COPY = {
  en: {
    eyebrow: "Use this weather in your itinerary",
    generic: "Add this destination to your trip and keep weather decisions attached to the day.",
    add: "Add to my trip",
    title: "My weather-aware trip",
    rangePrefix: "Selected travel dates",
  },
  "zh-cn": {
    eyebrow: "把天气结论带进行程",
    generic: "把这个目的地加入行程，让当天的天气风险和 Plan B 一起进入工作台。",
    add: "加入我的行程",
    title: "我的天气行程",
    rangePrefix: "已选择旅行日期",
  },
  "zh-hant": {
    eyebrow: "把天氣結論帶進行程",
    generic: "把這個目的地加入行程，讓當天的天氣風險和備用方案一起進入工作台。",
    add: "加入我的行程",
    title: "我的天氣行程",
    rangePrefix: "已選擇旅行日期",
  },
} as const;

export function CityTripBridge({
  locale,
  cityId,
  cityName,
  countryName,
  defaultDate,
  workspacePath,
}: CityTripBridgeProps): ReactElement {
  const copy = COPY[locale];
  return (
    <section className="info-panel mt-5 flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
      <div>
        <p className="eyebrow">{copy.eyebrow}</p>
        <p className="mt-2 max-w-2xl text-sm leading-6 text-muted">{copy.generic}</p>
      </div>
      <CityTripBridgeAction
        cityId={cityId}
        cityName={cityName}
        countryName={countryName}
        defaultDate={defaultDate}
        workspacePath={workspacePath}
        buttonLabel={copy.add}
        blankTitle={copy.title}
        rangePrefix={copy.rangePrefix}
      />
    </section>
  );
}
