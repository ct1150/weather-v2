import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const productionSmoke = readFileSync(
  new URL("../../../../.github/workflows/production-smoke.yml", import.meta.url),
  "utf8",
);
const englishHome = readFileSync(new URL("../app/page.tsx", import.meta.url), "utf8");
const englishTrips = readFileSync(new URL("../app/trips/page.tsx", import.meta.url), "utf8");
const simplifiedHome = readFileSync(new URL("../app/zh-cn/page.tsx", import.meta.url), "utf8");
const simplifiedTrips = readFileSync(
  new URL("../app/zh-cn/trips/page.tsx", import.meta.url),
  "utf8",
);
const traditionalHome = readFileSync(new URL("../app/zh-hant/page.tsx", import.meta.url), "utf8");
const traditionalTrips = readFileSync(
  new URL("../app/zh-hant/trips/page.tsx", import.meta.url),
  "utf8",
);

const currentCopy = [
  [
    englishHome,
    ["Dates fixed.", "Destination open?", "Compare destinations", "Continue shared planning"],
  ],
  [
    englishTrips,
    [
      "Destination chosen?",
      "Plan it together.",
      "Choose a destination first",
      "Advanced: import an existing itinerary",
    ],
  ],
  [
    simplifiedHome,
    ["未来14天 · 多人目的地决策", "日期定了，去哪还没定？", "开始比较目的地", "继续共同规划"],
  ],
  [
    simplifiedTrips,
    ["去哪已经确定？", "接下来一起规划。", "先一起决定去哪", "高级功能：导入已有行程"],
  ],
  [
    traditionalHome,
    ["未來14天 · 多人目的地決策", "日期定了，去哪還沒定？", "開始比較目的地", "繼續共同規劃"],
  ],
  [
    traditionalTrips,
    ["去哪已經確定？", "接下來一起規劃。", "先一起決定去哪", "進階功能：匯入既有行程"],
  ],
] as const;

describe("production smoke copy contract", () => {
  it("checks the same weather-first group decision copy rendered by every locale", () => {
    for (const [page, phrases] of currentCopy) {
      for (const phrase of phrases) {
        expect(page).toContain(phrase);
        expect(productionSmoke).toContain(phrase);
      }
    }
  });

  it("does not retain superseded trip-planner or weather-radar landing copy", () => {
    for (const obsolete of [
      "Know what to keep",
      "天气变化时",
      "天氣變化時",
      "亞洲旅行天氣雷達",
      "先看天氣，再決定去哪個城市",
    ]) {
      expect(productionSmoke).not.toContain(obsolete);
    }
  });
});
