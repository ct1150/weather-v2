import { describe, expect, it } from "vitest";
import {
  buildSavedCountryMapView,
  MAX_COUNTRY_MAP_SAVED_VIEWS,
  parseSavedCountryMapViews,
  serializeSavedCountryMapViews,
  upsertSavedCountryMapView,
} from "./saved-views";

describe("saved country decisions", () => {
  it("captures the full decision context from the current country search", () => {
    const view = buildSavedCountryMapView({
      pathname: "/zh-cn/th",
      search:
        "?range=7d&rainMax=40&windMax=25&tempMin=18&tempMax=32&shortlist=bangkok%2Cchiang-mai",
      countryName: "泰国",
      comparedNames: ["曼谷", "清迈"],
      now: new Date("2026-08-24T03:00:00Z"),
    });
    expect(view.url).toContain("/zh-cn/th?range=7d");
    expect(view.label).toBe("泰国 · 曼谷 / 清迈");
    expect(view.countryName).toBe("泰国");
    expect(view.rangePreset).toBe("7d");
    expect(view.filters).toEqual({ rainMax: 40, windMax: 25, tempMin: 18, tempMax: 32 });
    expect(view.comparedNames).toEqual(["曼谷", "清迈"]);
    expect(view.schemaVersion).toBe(2);
  });

  it("captures custom range indexes without losing the restorable URL", () => {
    const view = buildSavedCountryMapView({
      pathname: "/jp",
      search: "?from=1&to=3&rainMax=30",
      countryName: "Japan",
      comparedNames: [],
      now: new Date("2026-08-24T01:00:00Z"),
    });
    expect(view.rangePreset).toBe("custom");
    expect(view.customFrom).toBe(1);
    expect(view.customTo).toBe(3);
    expect(view.label).toBe("Japan");
    expect(view.url).toBe("/jp?from=1&to=3&rainMax=30");
  });

  it("deduplicates the same URL and keeps the newest decision first", () => {
    const first = buildSavedCountryMapView({
      pathname: "/jp",
      search: "?range=7d",
      countryName: "Japan",
      comparedNames: [],
      now: new Date("2026-08-24T01:00:00Z"),
    });
    const updated = { ...first, savedAt: "2026-08-24T02:00:00Z" };
    expect(upsertSavedCountryMapView([first], updated)).toEqual([updated]);
  });

  it("upgrades legacy saved map entries without deleting them", () => {
    const parsed = parseSavedCountryMapViews(
      JSON.stringify([
        {
          id: "/th?range=weekend&rainMax=50",
          url: "/th?range=weekend&rainMax=50",
          label: "Thailand · Bangkok / Phuket",
          savedAt: "2026-08-23T12:00:00Z",
        },
      ]),
    );
    expect(parsed).toHaveLength(1);
    expect(parsed[0]).toMatchObject({
      countryName: "Thailand",
      rangePreset: "weekend",
      filters: { rainMax: 50, windMax: null, tempMin: null, tempMax: null },
      comparedNames: [],
      schemaVersion: 2,
    });
  });

  it("caps storage and ignores malformed or external entries", () => {
    const views = Array.from({ length: MAX_COUNTRY_MAP_SAVED_VIEWS + 2 }, (_, index) =>
      buildSavedCountryMapView({
        pathname: "/jp",
        search: `?range=7d&rainMax=${index}`,
        countryName: `Japan ${index}`,
        comparedNames: [],
        now: new Date(`2026-08-24T0${Math.min(index, 9)}:00:00Z`),
      }),
    );
    const parsed = parseSavedCountryMapViews(serializeSavedCountryMapViews(views));
    expect(parsed).toHaveLength(MAX_COUNTRY_MAP_SAVED_VIEWS);
    expect(
      parseSavedCountryMapViews(
        JSON.stringify([
          {
            id: "evil",
            url: "https://evil.example",
            label: "Bad",
            savedAt: "2026-08-24T00:00:00Z",
          },
        ]),
      ),
    ).toEqual([]);
  });
});
