import type { ParsedTripMarkdown } from "./markdown-parser";
import type { TripCityOption, TripDayTheme, TripWorkspace } from "./workspace";

const CITY_ALIASES: Readonly<Record<string, ReadonlyArray<string>>> = {
  tokyo: ["tokyo", "东京", "東京"],
  osaka: ["osaka", "大阪"],
  kyoto: ["kyoto", "京都"],
  sapporo: ["sapporo", "札幌"],
  fukuoka: ["fukuoka", "福冈", "福岡"],
  naha: ["naha", "那霸", "冲绳", "沖繩"],
  seoul: ["seoul", "首尔", "首爾"],
  busan: ["busan", "釜山"],
  jeju: ["jeju", "济州", "濟州"],
  incheon: ["incheon", "仁川"],
  bangkok: ["bangkok", "曼谷"],
  phuket: ["phuket", "普吉", "普吉岛", "普吉島"],
  "chiang-mai": ["chiang mai", "chiang-mai", "清迈", "清邁"],
  pattaya: ["pattaya", "芭提雅", "芭堤雅"],
  krabi: ["krabi", "甲米"],
  hanoi: ["hanoi", "河内", "河內"],
  "ho-chi-minh": ["ho chi minh", "ho-chi-minh", "胡志明"],
  "da-nang": ["da nang", "da-nang", "岘港", "峴港"],
  "hoi-an": ["hoi an", "hoi-an", "会安", "會安"],
  singapore: ["singapore", "新加坡"],
  "kuala-lumpur": ["kuala lumpur", "kuala-lumpur", "吉隆坡"],
  penang: ["penang", "槟城", "檳城"],
  langkawi: ["langkawi", "兰卡威", "蘭卡威"],
  bali: ["bali", "巴厘岛", "峇里島", "巴厘", "峇里"],
  lombok: ["lombok", "龙目岛", "龍目島"],
  manila: ["manila", "马尼拉", "馬尼拉"],
  cebu: ["cebu", "宿务", "宿霧"],
  "phnom-penh": ["phnom penh", "phnom-penh", "金边", "金邊"],
  "siem-reap": ["siem reap", "siem-reap", "暹粒"],
};

const BEACH_TERMS = [
  "beach",
  "island",
  "boat",
  "snorkel",
  "diving",
  "海滩",
  "海灘",
  "沙滩",
  "沙灘",
  "海岛",
  "海島",
  "出海",
  "浮潜",
  "浮潛",
];
const INDOOR_TERMS = [
  "museum",
  "aquarium",
  "mall",
  "shopping",
  "indoor",
  "博物馆",
  "博物館",
  "水族馆",
  "水族館",
  "商场",
  "商場",
  "购物",
  "購物",
  "室内",
  "室內",
];
const OUTDOOR_TERMS = [
  "hiking",
  "hike",
  "park",
  "garden",
  "viewpoint",
  "mountain",
  "shrine",
  "公园",
  "公園",
  "花园",
  "花園",
  "徒步",
  "登山",
  "观景",
  "觀景",
  "神社",
];

function normalize(value: string): string {
  return value
    .toLocaleLowerCase()
    .replace(/[\s_–—-]+/gu, " ")
    .trim();
}

function includesTerm(text: string, term: string): boolean {
  return normalize(text).includes(normalize(term));
}

function cityMatches(text: string, city: TripCityOption): boolean {
  const aliases = new Set<string>([
    city.cityName,
    city.citySlug,
    city.citySlug.replaceAll("-", " "),
    ...(CITY_ALIASES[city.citySlug] ?? []),
  ]);
  return [...aliases].some((alias) => alias.length > 1 && includesTerm(text, alias));
}

export function inferDayTheme(text: string): TripDayTheme {
  if (BEACH_TERMS.some((term) => includesTerm(text, term))) return "beach";
  if (INDOOR_TERMS.some((term) => includesTerm(text, term))) return "indoor";
  if (OUTDOOR_TERMS.some((term) => includesTerm(text, term))) return "outdoor";
  return "city";
}

export function inferImportedWorkspace(
  workspace: TripWorkspace,
  parsed: ParsedTripMarkdown,
  cities: ReadonlyArray<TripCityOption>,
): TripWorkspace {
  return {
    ...workspace,
    days: workspace.days.map((day, index) => {
      const parsedDay = parsed.days[index];
      if (parsedDay === undefined) return day;
      const text = [
        parsedDay.heading,
        ...parsedDay.scheduleRows.map((row) => `${row.time} ${row.activity}`),
      ].join("\n");
      const matches = cities.filter((city) => cityMatches(text, city));
      const city = matches.length === 1 ? matches[0] : undefined;
      return {
        ...day,
        cityId: city?.cityId ?? day.cityId,
        cityName: city?.cityName ?? day.cityName,
        countryName: city?.countryName ?? day.countryName,
        theme: inferDayTheme(text),
      };
    }),
  };
}

export function unresolvedImportedDays(workspace: TripWorkspace): ReadonlyArray<number> {
  return workspace.days.filter((day) => day.cityId.length === 0).map((day) => day.dayNumber);
}
