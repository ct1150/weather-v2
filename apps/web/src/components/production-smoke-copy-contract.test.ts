import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const productionSmoke = readFileSync(
  new URL("../../../../.github/workflows/production-smoke.yml", import.meta.url),
  "utf8",
);
const discoverySmoke = readFileSync(
  new URL("../../../../tooling/deploy/weather-discovery-smoke.mjs", import.meta.url),
  "utf8",
);
const discoveryPlanner = readFileSync(
  new URL("./WeatherDiscoveryPlannerV2.tsx", import.meta.url),
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
    ["Dates fixed.", "Where is it least likely to rain?", "Find 3 dry-weather destinations"],
  ],
  [
    englishTrips,
    [
      "Advanced itinerary tools",
      "Existing workspaces remain available.",
      "Return to destination finder",
    ],
  ],
  [
    simplifiedHome,
    ["未来14天 · 少雨目的地决策", "日期定了，去哪里更不容易下雨？", "找 3 个少雨目的地"],
  ],
  [simplifiedTrips, ["高级行程工具", "已有行程仍可继续使用。", "返回少雨目的地工具"]],
  [
    traditionalHome,
    ["未來14天 · 少雨目的地決策", "日期定了，去哪裡更不容易下雨？", "找 3 個少雨目的地"],
  ],
  [traditionalTrips, ["進階行程工具", "既有行程仍可繼續使用。", "返回少雨目的地工具"]],
] as const;

const discoveryCopy = [
  [
    "Least-rain destination finder",
    "Where is it least likely to rain on your dates?",
    "Starting city",
    "Max one-way planning time",
  ],
  ["少雨目的地工具", "这几天去哪里更不容易下雨？", "出发城市", "最长单程规划时间"],
  ["少雨目的地工具", "這幾天去哪裡更不容易下雨？", "出發城市", "最長單程規劃時間"],
] as const;

describe("production smoke copy contract", () => {
  it("checks the same OPC product copy rendered by every locale", () => {
    for (const [page, phrases] of currentCopy) {
      for (const phrase of phrases) {
        expect(page).toContain(phrase);
        expect(productionSmoke).toContain(phrase);
      }
    }
  });

  it("keeps the live discovery smoke aligned with the least-rain finder", () => {
    for (const phrases of discoveryCopy) {
      for (const phrase of phrases) {
        expect(discoveryPlanner).toContain(phrase);
        expect(discoverySmoke).toContain(phrase);
      }
    }
  });

  it("does not retain superseded group-planning acquisition copy", () => {
    for (const obsolete of [
      "Continue shared planning",
      "继续共同规划",
      "繼續共同規劃",
      "Plan it together.",
      "接下来一起规划。",
      "接下來一起規劃。",
    ]) {
      expect(productionSmoke).not.toContain(obsolete);
    }
  });
});
