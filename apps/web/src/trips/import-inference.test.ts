import { describe, expect, it } from "vitest";

import { inferDayTheme, inferImportedWorkspace, unresolvedImportedDays } from "./import-inference";
import { parseTripMarkdown } from "./markdown-parser";
import { createWorkspaceFromParsed, type TripCityOption } from "./workspace";

const cities: ReadonlyArray<TripCityOption> = [
  {
    cityId: "jp-tokyo",
    countrySlug: "japan",
    citySlug: "tokyo",
    cityName: "东京",
    countryName: "日本",
    latitude: 35.68,
    longitude: 139.69,
    timezone: "Asia/Tokyo",
    featured: true,
  },
  {
    cityId: "jp-kyoto",
    countrySlug: "japan",
    citySlug: "kyoto",
    cityName: "京都",
    countryName: "日本",
    latitude: 35.01,
    longitude: 135.77,
    timezone: "Asia/Tokyo",
    featured: true,
  },
  {
    cityId: "th-phuket",
    countrySlug: "thailand",
    citySlug: "phuket",
    cityName: "普吉岛",
    countryName: "泰国",
    latitude: 7.88,
    longitude: 98.39,
    timezone: "Asia/Bangkok",
    featured: true,
  },
];

describe("import inference", () => {
  it("infers a unique supported city from Chinese or English route text", () => {
    const parsed = parseTripMarkdown(
      "# Japan trip\n\n# D1 东京\n| 时间 | 行程 |\n|---|---|\n|09:00|浅草寺|\n\n# D2 Kyoto\n| Time | Plan |\n|---|---|\n|10:00|Railway Museum|",
    );
    const base = createWorkspaceFromParsed(parsed, { now: "2026-08-07T00:00:00.000Z" });
    const inferred = inferImportedWorkspace(base, parsed, cities);

    expect(inferred.days[0]?.cityId).toBe("jp-tokyo");
    expect(inferred.days[1]?.cityId).toBe("jp-kyoto");
    expect(inferred.days[1]?.theme).toBe("indoor");
    expect(unresolvedImportedDays(inferred)).toEqual([]);
  });

  it("recognizes obvious beach and island days", () => {
    expect(inferDayTheme("普吉岛 出海浮潜 + beach sunset")).toBe("beach");
    expect(inferDayTheme("National Museum and aquarium")).toBe("indoor");
    expect(inferDayTheme("park hiking viewpoint")).toBe("outdoor");
  });

  it("leaves ambiguous multi-city text unresolved", () => {
    const parsed = parseTripMarkdown(
      "# Japan trip\n\n# D1 东京 → 京都\n| 时间 | 行程 |\n|---|---|\n|09:00|移动日|",
    );
    const base = createWorkspaceFromParsed(parsed, { now: "2026-08-07T00:00:00.000Z" });
    const inferred = inferImportedWorkspace(base, parsed, cities);

    expect(inferred.days[0]?.cityId).toBe("");
    expect(unresolvedImportedDays(inferred)).toEqual([1]);
  });

  it("does not guess a city outside the supported directory", () => {
    const parsed = parseTripMarkdown(
      "# Europe trip\n\n# D1 Paris\n| Time | Plan |\n|---|---|\n|09:00|Louvre Museum|",
    );
    const base = createWorkspaceFromParsed(parsed, { now: "2026-08-07T00:00:00.000Z" });
    const inferred = inferImportedWorkspace(base, parsed, cities);

    expect(inferred.days[0]?.cityId).toBe("");
    expect(inferred.days[0]?.theme).toBe("indoor");
    expect(unresolvedImportedDays(inferred)).toEqual([1]);
  });
});
