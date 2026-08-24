// @vitest-environment jsdom

import { cleanup, fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { CountryWeatherCityViewModel, LocalDate, ScoreViewModel } from "../app/view-models";
import { COUNTRY_MAP_SAVED_VIEWS_STORAGE_KEY } from "../country-map/saved-views";
import { CountryOutlineMap, layoutCountryMarkers } from "./CountryOutlineMap";
import { CountryWeatherExplorer } from "./CountryWeatherExplorer";

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
  windByDay: ReadonlyArray<number> = [],
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
        conditionLabel: rain > 60 ? "Rain showers" : rain > 40 ? "Partly cloudy" : "Clear",
        temperatureMin: 20 + index,
        temperatureMax: 28 + index,
        rainProbability: rain,
        precipitationMm: rain > 60 ? 10 : rain > 40 ? 3 : 0.5,
        windSpeedMax: windByDay[index] ?? 18,
        observedAt: "2026-08-04T00:00:00.000Z",
      },
      score: score(90 - rain),
    })),
  };
}

const CITIES = [
  city("tokyo", "Tokyo", [25, 80, 20, 20, 65, 70, 75], 35.68, 139.69),
  city("osaka", "Osaka", [40, 15, 30, 25, 20, 15, 25], 34.69, 135.5),
  city(
    "sapporo",
    "Sapporo",
    [55, 35, 45, 40, 35, 30, 40],
    43.06,
    141.35,
    [15, 18, 20, 22, 24, 26, 28],
  ),
] as const;

function renderExplorer(locale: "en" | "zh-cn" | "zh-hant" = "en"): ReturnType<typeof render> {
  return render(
    <CountryWeatherExplorer
      country={{
        countryId: "JP",
        slug: locale === "en" ? "jp" : `${locale}/jp`,
        name: locale === "en" ? "Japan" : "日本",
        summary: null,
        defaultTimezone: "Asia/Tokyo",
      }}
      countries={[
        {
          slug: "jp",
          name: locale === "en" ? "Japan" : "日本",
          path: locale === "en" ? "/jp" : `/${locale}/jp`,
        },
        {
          slug: "kr",
          name: locale === "en" ? "South Korea" : "韩国",
          path: locale === "en" ? "/kr" : `/${locale}/kr`,
        },
      ]}
      cities={CITIES}
      updatedLabel="Updated now"
      locale={locale}
    />,
  );
}

beforeEach(() => {
  window.history.replaceState({}, "", "/jp");
  window.localStorage.removeItem(COUNTRY_MAP_SAVED_VIEWS_STORAGE_KEY);
  Object.defineProperty(window, "matchMedia", {
    configurable: true,
    value: vi.fn().mockReturnValue({ matches: false }),
  });
  Object.defineProperty(navigator, "clipboard", {
    configurable: true,
    value: { writeText: vi.fn().mockResolvedValue(undefined) },
  });
});

afterEach(() => {
  cleanup();
  vi.clearAllMocks();
});

describe("CountryWeatherExplorer instant country map", () => {
  it("renders the complete weather map synchronously without waiting for a tile provider", () => {
    const { container } = renderExplorer();

    expect(screen.getByRole("button", { name: "Next 7 days" }).getAttribute("aria-pressed")).toBe(
      "true",
    );
    expect(screen.getByText("All supported travel destinations at a glance")).toBeTruthy();
    const map = screen.getByTestId("country-weather-map");
    expect(map.getAttribute("data-render-mode")).toBe("inline-svg");
    expect(map.getAttribute("data-city-count")).toBe(String(CITIES.length));
    expect(screen.getAllByTestId("country-weather-marker")).toHaveLength(CITIES.length);
    expect(container.querySelector(".maplibregl-map")).toBeNull();
    expect(container.textContent).toContain("3/3 shown");

    const labels = screen
      .getAllByTestId("country-weather-marker")
      .map((marker) => marker.getAttribute("aria-label"));
    expect(
      labels.some(
        (label) =>
          label?.includes("Tokyo") && label.includes("3 of 7 days should be mostly rain-free"),
      ),
    ).toBe(true);
    expect(
      labels.some(
        (label) =>
          label?.includes("Osaka") && label.includes("All 7 days should be mostly rain-free"),
      ),
    ).toBe(true);
  });

  it("keeps dense markers distinct and inside the country canvas", () => {
    const markers = CITIES.map((item) => ({
      id: item.cityId,
      name: item.cityName,
      longitude: item.longitude,
      latitude: item.latitude,
      symbol: "☀️",
      detail: "7/7 dry",
      risk: "good" as const,
      filtered: false,
      selected: false,
      ariaLabel: item.cityName,
    }));
    const layout = layoutCountryMarkers("JP", markers);
    expect(layout).toHaveLength(CITIES.length);
    expect(
      new Set(layout.map((marker) => `${marker.x.toFixed(2)}:${marker.y.toFixed(2)}`)).size,
    ).toBe(CITIES.length);
    for (const marker of layout) {
      expect(marker.x).toBeGreaterThanOrEqual(0);
      expect(marker.x).toBeLessThanOrEqual(1000);
      expect(marker.y).toBeGreaterThanOrEqual(0);
      expect(marker.y).toBeLessThanOrEqual(620);
    }
  });

  it("renders every supplied catalogue marker in the outline component", () => {
    render(
      <CountryOutlineMap
        countryId="JP"
        countryName="Japan"
        ariaLabel="Japan weather map"
        markers={CITIES.map((item) => ({
          id: item.cityId,
          name: item.cityName,
          longitude: item.longitude,
          latitude: item.latitude,
          symbol: "🌤️",
          detail: "5/7 dry",
          risk: "mixed",
          filtered: false,
          selected: false,
          ariaLabel: `${item.cityName} weather`,
        }))}
        onSelect={vi.fn()}
      />,
    );
    expect(screen.getAllByTestId("country-weather-marker")).toHaveLength(CITIES.length);
  });

  it("switches to the three-day view without a submit button", () => {
    renderExplorer();
    fireEvent.click(screen.getByRole("button", { name: "Next 3 days" }));

    expect(window.location.search).toBe("?range=3d");
    expect(screen.getByRole("button", { name: "Next 3 days" }).getAttribute("aria-pressed")).toBe(
      "true",
    );
    expect(screen.getByLabelText("Tokyo weather summary").textContent).toContain(
      "2 of 3 days should be mostly rain-free",
    );
  });

  it("greys destinations outside explicit limits without removing map or list entries", () => {
    const { container } = renderExplorer();
    fireEvent.change(screen.getByLabelText("Highest daily rain chance"), {
      target: { value: "40" },
    });

    const choices = Array.from(container.querySelectorAll(".country-city-choice"));
    const tokyo = choices.find((choice) => choice.textContent?.includes("Tokyo"));
    const osaka = choices.find((choice) => choice.textContent?.includes("Osaka"));
    const tokyoMarker = container.querySelector('[data-city-id="tokyo"]');
    expect(tokyo?.className).toContain("is-filtered");
    expect(tokyoMarker?.className).toContain("is-filtered");
    expect(osaka?.className).not.toContain("is-filtered");
    expect(container.textContent).toContain("Peak rain 80% exceeds 40%");
    expect(choices).toHaveLength(CITIES.length);
    expect(screen.getAllByTestId("country-weather-marker")).toHaveLength(CITIES.length);
    expect(window.location.search).toContain("rainMax=40");
  });

  it("selects a map destination inline and preserves the country page", () => {
    renderExplorer();
    const marker = screen
      .getAllByTestId("country-weather-marker")
      .find((item) => item.getAttribute("data-city-id") === "sapporo");

    expect(marker).toBeDefined();
    fireEvent.click(marker!);

    const inspector = screen.getByLabelText("Sapporo weather summary");
    expect(inspector).toBeTruthy();
    expect(window.location.pathname).toBe("/jp");
    expect(window.location.search).toContain("city=sapporo");
    expect(
      within(inspector)
        .getByRole("link", { name: /Open full city forecast/ })
        .getAttribute("href"),
    ).toContain("/jp/sapporo?start=2026-08-04&end=2026-08-10");
  });

  it("compares destinations side by side without leaving the country map", () => {
    renderExplorer();

    fireEvent.click(screen.getByRole("button", { name: "Add Tokyo to compare" }));
    const osakaMarker = screen
      .getAllByTestId("country-weather-marker")
      .find((item) => item.getAttribute("data-city-id") === "osaka");
    expect(osakaMarker).toBeDefined();
    fireEvent.click(osakaMarker!);
    fireEvent.click(screen.getByRole("button", { name: "Add Osaka to compare" }));

    expect(window.location.search).toContain("cities=tokyo%2Cosaka");
    fireEvent.click(screen.getByRole("button", { name: "Compare 2 destinations" }));

    const dialog = screen.getByRole("dialog", { name: "Compare destinations" });
    expect(within(dialog).getAllByText("Tokyo").length).toBeGreaterThan(0);
    expect(within(dialog).getAllByText("Osaka").length).toBeGreaterThan(0);
    expect(within(dialog).getByText("Rain outlook")).toBeTruthy();
    expect(window.location.pathname).toBe("/jp");
  });

  it("saves and restores the complete country-map state locally", () => {
    renderExplorer();

    fireEvent.click(screen.getByRole("button", { name: "Add Tokyo to compare" }));
    fireEvent.click(screen.getByRole("button", { name: "Save current view" }));

    const raw = window.localStorage.getItem(COUNTRY_MAP_SAVED_VIEWS_STORAGE_KEY);
    expect(raw).toContain("cities=tokyo");
    expect(raw).toContain("Japan · Tokyo");

    fireEvent.click(screen.getByRole("button", { name: "Saved views (1)" }));
    const dialog = screen.getByRole("dialog", { name: "Saved country maps" });
    expect(within(dialog).getByText("Japan · Tokyo")).toBeTruthy();
    expect(within(dialog).getByText(/\/jp\?range=7d&cities=tokyo/)).toBeTruthy();
  });

  it("copies the full shareable country-map state", async () => {
    renderExplorer();
    fireEvent.click(screen.getByRole("button", { name: "Copy map link" }));
    await waitFor(() => expect(navigator.clipboard.writeText).toHaveBeenCalled());
    expect(screen.getByText("Link copied")).toBeTruthy();
  });

  it("uses conversational rain language in Simplified and Traditional Chinese", () => {
    renderExplorer("zh-cn");
    expect(screen.getByRole("button", { name: "未来 7 天" })).toBeTruthy();
    expect(screen.getByText("全部已收录旅行地天气一目了然")).toBeTruthy();
    expect(screen.getByText("基本不下雨")).toBeTruthy();
    expect(document.body.textContent).not.toContain("基本无雨");
    expect(document.body.textContent).not.toContain("无雨日");
    expect(screen.getAllByTestId("country-weather-marker")).toHaveLength(CITIES.length);
    cleanup();

    renderExplorer("zh-hant");
    expect(screen.getByRole("button", { name: "未來 7 天" })).toBeTruthy();
    expect(screen.getByText("全部已收錄旅行地天氣一目了然")).toBeTruthy();
    expect(screen.getByText("基本不下雨")).toBeTruthy();
    expect(document.body.textContent).not.toContain("基本無雨");
    expect(document.body.textContent).not.toContain("無雨日");
    expect(screen.getAllByTestId("country-weather-marker")).toHaveLength(CITIES.length);
  });
});
