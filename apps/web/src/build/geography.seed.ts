// apps/web/src/build/geography.seed.ts
//
// Minimal static geography seed for the build-time bake (system_design.md §1.4 #1).
// The repo shipped with no cities/countries dataset; this is a small, self-contained
// featured subset (lat/lng/timezone/slug/isFeatured + multilingual names) used to
// produce a deployable static site. It is replaced by the D1-backed dataset in a
// later worker increment (D1 is dormant this phase).

import type { GeographySeed } from "./types";

/**
 * Featured countries and cities. Coordinates are approximate city-centre values.
 * `isFeatured` controls which cities appear on the homepage / explorer map.
 */
export const geographySeed: GeographySeed = {
  countries: [
    {
      id: "JP",
      iso2: "JP",
      slug: "jp",
      defaultTimezone: "Asia/Tokyo",
      name: { en: "Japan", ja: "日本", ko: "일본", "zh-cn": "日本", "zh-tw": "日本" },
    },
    {
      id: "KR",
      iso2: "KR",
      slug: "kr",
      defaultTimezone: "Asia/Seoul",
      name: { en: "South Korea", ja: "韓国", ko: "대한민국", "zh-cn": "韩国", "zh-tw": "韓國" },
    },
    {
      id: "TH",
      iso2: "TH",
      slug: "th",
      defaultTimezone: "Asia/Bangkok",
      name: { en: "Thailand", ja: "タイ", ko: "태국", "zh-cn": "泰国", "zh-tw": "泰國" },
    },
  ],
  cities: [
    {
      id: "tokyo",
      countryId: "JP",
      slug: "tokyo",
      latitude: 35.6762,
      longitude: 139.6503,
      timezone: "Asia/Tokyo",
      isFeatured: true,
      name: { en: "Tokyo", ja: "東京", ko: "도쿄", "zh-cn": "东京", "zh-tw": "東京" },
    },
    {
      id: "osaka",
      countryId: "JP",
      slug: "osaka",
      latitude: 34.6937,
      longitude: 135.5023,
      timezone: "Asia/Tokyo",
      isFeatured: true,
      name: { en: "Osaka", ja: "大阪", ko: "오사카", "zh-cn": "大阪", "zh-tw": "大阪" },
    },
    {
      id: "sapporo",
      countryId: "JP",
      slug: "sapporo",
      latitude: 43.0618,
      longitude: 141.3545,
      timezone: "Asia/Tokyo",
      isFeatured: false,
      name: { en: "Sapporo", ja: "札幌", ko: "삿포로", "zh-cn": "札幌", "zh-tw": "札幌" },
    },
    {
      id: "seoul",
      countryId: "KR",
      slug: "seoul",
      latitude: 37.5665,
      longitude: 126.978,
      timezone: "Asia/Seoul",
      isFeatured: true,
      name: { en: "Seoul", ja: "ソウル", ko: "서울", "zh-cn": "首尔", "zh-tw": "首爾" },
    },
    {
      id: "busan",
      countryId: "KR",
      slug: "busan",
      latitude: 35.1796,
      longitude: 129.0756,
      timezone: "Asia/Seoul",
      isFeatured: true,
      name: { en: "Busan", ja: "釜山", ko: "부산", "zh-cn": "釜山", "zh-tw": "釜山" },
    },
    {
      id: "bangkok",
      countryId: "TH",
      slug: "bangkok",
      latitude: 13.7563,
      longitude: 100.5018,
      timezone: "Asia/Bangkok",
      isFeatured: true,
      name: { en: "Bangkok", ja: "バンコク", ko: "방콕", "zh-cn": "曼谷", "zh-tw": "曼谷" },
    },
    {
      id: "phuket",
      countryId: "TH",
      slug: "phuket",
      latitude: 7.8804,
      longitude: 98.3923,
      timezone: "Asia/Bangkok",
      isFeatured: true,
      name: { en: "Phuket", ja: "プーケット", ko: "푸켓", "zh-cn": "普吉", "zh-tw": "普吉" },
    },
  ],
};
