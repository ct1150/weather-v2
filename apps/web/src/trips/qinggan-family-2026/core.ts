import type { TripPlace, WeatherWindowSnapshot } from "../types";

const UPDATED_AT = "2026-08-06T09:00:00+08:00";

export function snapshot(
  condition: string,
  min: number,
  max: number,
  rain: number,
  wind: number,
  cloud: number,
  extra: Partial<WeatherWindowSnapshot> = {},
): WeatherWindowSnapshot {
  return {
    source: "snapshot",
    updatedAt: UPDATED_AT,
    condition,
    temperatureMinC: min,
    temperatureMaxC: max,
    rainProbability: rain,
    precipitationMm: rain >= 60 ? 3.5 : rain >= 35 ? 1.2 : 0,
    windSpeedKph: wind,
    windGustKph: Math.round(wind * 1.55),
    cloudCover: cloud,
    visibilityM: rain >= 60 ? 9_000 : 18_000,
    uvIndex: max >= 35 ? 10 : 7,
    sunrise: "06:20",
    sunset: "20:20",
    ...extra,
  };
}

export const PLACES = {
  lanzhouAirport: {
    id: "lanzhou-airport",
    name: "兰州中川机场",
    latitude: 36.515,
    longitude: 103.62,
    timezone: "Asia/Shanghai",
  },
  zhangye: {
    id: "zhangye",
    name: "张掖",
    latitude: 38.93,
    longitude: 100.45,
    timezone: "Asia/Shanghai",
  },
  danxia: {
    id: "zhangye-danxia",
    name: "张掖七彩丹霞",
    latitude: 38.98,
    longitude: 100.07,
    timezone: "Asia/Shanghai",
  },
  mati: {
    id: "mati-temple",
    name: "马蹄寺",
    latitude: 38.48,
    longitude: 100.48,
    timezone: "Asia/Shanghai",
  },
  dunhuang: {
    id: "dunhuang",
    name: "敦煌",
    latitude: 40.14,
    longitude: 94.66,
    timezone: "Asia/Shanghai",
  },
  mogao: {
    id: "mogao-caves",
    name: "莫高窟",
    latitude: 40.04,
    longitude: 94.81,
    timezone: "Asia/Shanghai",
  },
  mingsha: {
    id: "mingsha-mountain",
    name: "鸣沙山月牙泉",
    latitude: 40.09,
    longitude: 94.67,
    timezone: "Asia/Shanghai",
  },
  emerald: {
    id: "dachaidan-emerald-lake",
    name: "大柴旦翡翠湖",
    latitude: 37.83,
    longitude: 95.26,
    timezone: "Asia/Shanghai",
  },
  dachaidan: {
    id: "dachaidan",
    name: "大柴旦",
    latitude: 37.85,
    longitude: 95.36,
    timezone: "Asia/Shanghai",
  },
  qarhan: {
    id: "qarhan-salt-lake",
    name: "察尔汗盐湖",
    latitude: 36.79,
    longitude: 95.3,
    timezone: "Asia/Shanghai",
  },
  chaka: {
    id: "chaka-salt-lake",
    name: "茶卡盐湖",
    latitude: 36.79,
    longitude: 99.08,
    timezone: "Asia/Shanghai",
  },
  qinghaiLake: {
    id: "qinghai-lake-black-horse-river",
    name: "青海湖·黑马河",
    latitude: 36.73,
    longitude: 99.78,
    timezone: "Asia/Shanghai",
  },
  xining: {
    id: "xining",
    name: "西宁",
    latitude: 36.62,
    longitude: 101.78,
    timezone: "Asia/Shanghai",
  },
  kumbum: {
    id: "kumbum-monastery",
    name: "塔尔寺",
    latitude: 36.48,
    longitude: 101.57,
    timezone: "Asia/Shanghai",
  },
  lanzhou: {
    id: "lanzhou",
    name: "兰州",
    latitude: 36.06,
    longitude: 103.84,
    timezone: "Asia/Shanghai",
  },
} as const satisfies Readonly<Record<string, TripPlace>>;
