import type { Metadata } from "next";
import type { ReactElement } from "react";
import { TripPlannerDashboard } from "../../../../components/TripPlannerDashboard";
import { JsonLd } from "../../../../components/JsonLd";
import { getQingganTripViewModel } from "../../../../build/trip-weather";
import { buildAlternates, localeUrl } from "../../../seo";

export const metadata: Metadata = {
  title: { absolute: "2026青甘家庭轻奢环线｜天气驱动行程Demo" },
  description:
    "9天8晚青甘家庭环线：逐景点天气适宜度、固定交通约束、餐厅酒店、最晚离场时间和动态Plan B。",
  alternates: buildAlternates("/trips/qinggan-family-2026", "zh-cn", ["en", "zh-cn"]),
  robots: { index: true, follow: true },
};

export default async function QingganTripPage(): Promise<ReactElement> {
  const trip = await getQingganTripViewModel();
  const jsonLd = {
    "@context": "https://schema.org",
    "@type": "TouristTrip",
    name: trip.title,
    description: trip.subtitle,
    url: localeUrl("zh-cn", "/trips/qinggan-family-2026"),
    startDate: trip.startDate,
    endDate: trip.endDate,
    itinerary: trip.days.map((day) => ({
      "@type": "TouristTrip",
      name: `D${day.dayNumber} ${day.title}`,
      touristType: "家庭旅行",
    })),
  };

  return (
    <main id="main-content" className="mx-auto max-w-7xl px-4 py-6 sm:px-6 sm:py-10">
      <JsonLd schema={jsonLd} />
      <nav className="country-breadcrumb" aria-label="面包屑">
        <ol>
          <li>
            <a href="/zh-cn/trips">我的旅行</a>
          </li>
          <li>{trip.title}</li>
        </ol>
      </nav>
      <section className="trip-detail-hero mt-6">
        <div>
          <p className="eyebrow">首个端到端示范行程</p>
          <h1 className="mt-4 text-4xl font-bold tracking-[-0.055em] text-foreground sm:text-6xl">
            {trip.title}
          </h1>
          <p className="mt-4 max-w-3xl text-base leading-7 text-muted sm:text-lg">
            {trip.subtitle}。天气与每个具体活动绑定，而不是只显示城市最高温和降雨。
          </p>
        </div>
        <div className="trip-source-note">
          <span>天气刷新</span>
          <strong>
            {trip.liveWeatherEnabled ? "构建时读取 Open-Meteo" : "使用2026-08-06预报快照"}
          </strong>
          <small>实际出发前24—48小时应再次刷新</small>
        </div>
      </section>
      <div className="mt-8">
        <TripPlannerDashboard trip={trip} />
      </div>
    </main>
  );
}
