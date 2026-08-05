// @vitest-environment jsdom

import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import type { CountryWeatherCityViewModel, LocalDate, ScoreViewModel } from "../app/view-models";
import { CountryWeatherExplorer } from "./CountryWeatherExplorer";

const maplibre = vi.hoisted(() => {
  const markerElements: HTMLElement[] = [];
  const Map = vi.fn().mockImplementation(() => ({
    addControl: vi.fn(),
    fitBounds: vi.fn(),
    on: vi.fn((event: string, callback: () => void) => {
      if (event === "load") callback();
    }),
    remove: vi.fn(),
  }));
  const Marker = vi.fn().mockImplementation(({ element }: { element: HTMLElement }) => {
    markerElements.push(element);
    return {
      addTo: vi.fn().mockReturnThis(),
      remove: vi.fn(),
      setLngLat: vi.fn().mockReturnThis(),
    };
  });
  class LngLatBounds {
    extend(): this {
      return this;
    }
  }
  class NavigationControl {}
  return { LngLatBounds, Map, Marker, NavigationControl, markerElements };
});

vi.mock("maplibre-gl", () => maplibre);

const score = (value: number): ScoreViewModel => ({
  value,
  state: "available",
  confidence: 0.9,
  reasonCodes: [],
});

function city(
  cityId: string,
  cityName: string,
  rainByDay: ReadonlyArray<number>,
  latitude: number,
  longitude: number,
  rainMmByDay: ReadonlyArray<number> = [],
): CountryWeatherCityViewModel {
  return {
    cityId,
    cityName,
    countryName: "Japan",
    path: `/jp/${cityName.toLowerCase()}`,
    latitude,
    longitude,
    timezone: "Asia/Tokyo",
    days: rainByDay.map((rain, index) => ({
      localDate: `2026-08-${String(index + 4).padStart(2, "0")}` as LocalDate,
      weather: {
        conditionLabel: rain > 50 ? "Rain showers" : "Mostly sunny",
        temperatureMin: 20 + index,
        temperatureMax: 28 + index,
        rainProbability: rain,
        precipitationMm: rainMmByDay[index] ?? null,
        observedAt: "2026-08-04T00:00:00.000Z",
      },
      score: score(90 - rain),
    })),
  };
}

const CITIES = [
  city("TYO", "Tokyo", [25, 80, 20, 20, 65, 70, 75], 35.68, 139.69),
  city("OSA", "Osaka", [40, 15, 30, 25, 20, 15, 25], 34.69, 135.5),
  city("SPK", "Sapporo", [55, 35, 45, 40, 35, 30, 40], 43.06, 141.35),
] as const;

function renderExplorer(): ReturnType<typeof render> {
  return render(
    <CountryWeatherExplorer
      country={{ slug: "jp", name: "Japan" }}
      countries={[
        { slug: "jp", name: "Japan", path: "/jp" },
        { slug: "kr", name: "South Korea", path: "/kr" },
      ]}
      cities={CITIES}
      updatedLabel="Updated 12 min ago"
    />,
  );
}

beforeEach(() => {
  window.history.replaceState({}, "", "/jp");
  maplibre.markerElements.length = 0;
});

afterEach(() => {
  cleanup();
  vi.clearAllMocks();
});

describe("CountryWeatherExplorer", () => {
  it("shows every city, the country control, and initializes one country map", async () => {
    renderExplorer();

    expect(
      (screen.getByRole("combobox", { name: "Choose country" }) as HTMLSelectElement).value,
    ).toBe("/jp");
    expect(screen.getByRole("button", { name: /Tokyo.*25% peak rain/i })).toBeTruthy();
    expect(screen.getByRole("button", { name: /Osaka.*40% peak rain/i })).toBeTruthy();
    expect(screen.getByRole("button", { name: /Sapporo.*55% peak rain/i })).toBeTruthy();
    expect(screen.getByText(/Tokyo ranks first among 3 cities/)).toBeTruthy();
    expect(screen.getByRole("link", { name: "Tokyo 7-day forecast" }).getAttribute("href")).toBe(
      "/jp/tokyo",
    );
    expect(screen.getByRole("link", { name: "Osaka 7-day forecast" }).getAttribute("href")).toBe(
      "/jp/osaka",
    );
    expect(screen.getByText("How are cities ranked?")).toBeTruthy();
    expect(screen.getByText("Does a high rain chance mean rain all day?")).toBeTruthy();
    expect(screen.getByTestId("country-weather-map")).toBeTruthy();
    await waitFor(() => expect(maplibre.Map).toHaveBeenCalledTimes(1));
    await waitFor(() => expect(maplibre.markerElements).toHaveLength(3));
  });

  it("updates ranking, dates, and the shareable URL when the travel range changes", async () => {
    const { container } = renderExplorer();

    fireEvent.click(screen.getByRole("button", { name: /Tomorrow/ }));

    expect(window.location.search).toBe("?window=tomorrow");
    expect(screen.getByRole("button", { name: /Tomorrow/ }).getAttribute("aria-pressed")).toBe(
      "true",
    );
    expect(screen.getByLabelText("Osaka weather summary").textContent).toContain("15% peak rain");
    expect(container.querySelector(".country-city-grid button")?.textContent).toMatch(/^#1Osaka/);
    expect(screen.getByText(/Osaka ranks first among 3 cities/)).toBeTruthy();
  });

  it("re-ranks every city for an exact date range without opening a detail page", () => {
    const { container } = renderExplorer();

    fireEvent.change(screen.getByLabelText("First travel date"), { target: { value: "1" } });
    fireEvent.change(screen.getByLabelText("Last travel date"), { target: { value: "3" } });

    expect(window.location.search).toBe("?from=1&to=3");
    expect(screen.getAllByText("Custom trip · Aug 5–Aug 7")).toHaveLength(2);
    expect(screen.getByLabelText("Osaka weather summary").textContent).toContain("3/3");
    expect(container.querySelector(".country-city-grid button")?.textContent).toMatch(/^#1Osaka/);
    expect(window.location.pathname).toBe("/jp");
  });

  it("uses expected rain amount before peak probability for tropical decisions", () => {
    const { container } = render(
      <CountryWeatherExplorer
        country={{ slug: "th", name: "Thailand" }}
        countries={[{ slug: "th", name: "Thailand", path: "/th" }]}
        cities={[
          city("brief-shower", "Brief shower", [95], 13.7, 100.5, [1]),
          city("heavy-rain", "Heavy rain", [55], 18.7, 98.9, [25]),
        ]}
        updatedLabel="Updated now"
      />,
    );

    expect(container.querySelector(".country-city-grid button")?.textContent).toMatch(
      /^#1Brief shower/,
    );
    expect(screen.getByText("1 mm expected · 95% peak chance")).toBeTruthy();
  });

  it("selects a city from a map marker and updates the inline inspector without navigating", async () => {
    renderExplorer();
    await waitFor(() => expect(maplibre.markerElements).toHaveLength(3));
    const sapporoMarker = maplibre.markerElements
      .flatMap((element) => Array.from(element.querySelectorAll("button")))
      .find((button) => button.getAttribute("aria-label")?.startsWith("Sapporo:"));

    expect(sapporoMarker).toBeDefined();
    fireEvent.click(sapporoMarker!);

    expect(screen.getByLabelText("Sapporo weather summary")).toBeTruthy();
    expect(window.location.pathname).toBe("/jp");
    expect(screen.getByRole("link", { name: /Open 7-day city outlook/ }).getAttribute("href")).toBe(
      "/jp/sapporo",
    );
  });

  it("restores a shared weekend range from the URL", async () => {
    window.history.replaceState({}, "", "/jp?window=weekend");
    renderExplorer();

    await waitFor(() =>
      expect(
        screen.getByRole("button", { name: /This weekend/ }).getAttribute("aria-pressed"),
      ).toBe("true"),
    );
    expect(screen.getByText("Aug 9–Aug 10")).toBeTruthy();
  });

  it("renders the complete country decision console in Simplified Chinese", () => {
    render(
      <CountryWeatherExplorer
        country={{ slug: "jp", name: "日本" }}
        countries={[
          { slug: "jp", name: "日本", path: "/zh-cn/jp" },
          { slug: "kr", name: "韩国", path: "/zh-cn/kr" },
        ]}
        cities={CITIES.map((item) => ({ ...item, countryName: "日本" }))}
        updatedLabel="更新于 2026-08-05"
        locale="zh-cn"
      />,
    );

    expect(screen.getByRole("combobox", { name: "选择国家" })).toBeTruthy();
    expect(screen.getByRole("button", { name: /明天/ })).toBeTruthy();
    expect(screen.getByText("地图上比较全部旅游城市")).toBeTruthy();
    expect(screen.getByText("不用打开详情页，直接比较")).toBeTruthy();
    expect(screen.getByText("日本全部旅游城市")).toBeTruthy();
    expect(screen.getByText(/在3个城市中排名第一/)).toBeTruthy();
    expect(screen.getByText("城市是如何排序的？")).toBeTruthy();
  });
});
