import { describe, expect, it } from "vitest";
import {
  buildSavedCountryMapView,
  MAX_COUNTRY_MAP_SAVED_VIEWS,
  parseSavedCountryMapViews,
  serializeSavedCountryMapViews,
  upsertSavedCountryMapView,
} from "./saved-views";

describe("saved country map views", () => {
  it("captures the full relative URL including comparison state", () => {
    const view = buildSavedCountryMapView({
      pathname: "/zh-cn/th",
      search: "?range=7d&rainMax=40&cities=bangkok%2Cchiang-mai",
      countryName: "泰国",
      comparedNames: ["曼谷", "清迈"],
      now: new Date("2026-08-24T03:00:00Z"),
    });
    expect(view.url).toBe("/zh-cn/th?range=7d&rainMax=40&cities=bangkok%2Cchiang-mai");
    expect(view.label).toBe("泰国 · 曼谷 / 清迈");
  });

  it("deduplicates the same URL and keeps the newest view first", () => {
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

  it("caps storage and ignores malformed or external entries", () => {
    const views = Array.from({ length: MAX_COUNTRY_MAP_SAVED_VIEWS + 2 }, (_, index) => ({
      id: `/jp?range=${index}`,
      url: `/jp?range=${index}`,
      label: `Japan ${index}`,
      savedAt: `2026-08-24T0${Math.min(index, 9)}:00:00Z`,
    }));
    const parsed = parseSavedCountryMapViews(serializeSavedCountryMapViews(views));
    expect(parsed).toHaveLength(MAX_COUNTRY_MAP_SAVED_VIEWS);
    expect(
      parseSavedCountryMapViews(
        JSON.stringify([
          { id: "evil", url: "https://evil.example", label: "Bad", savedAt: "2026-08-24T00:00:00Z" },
        ]),
      ),
    ).toEqual([]);
  });
});
