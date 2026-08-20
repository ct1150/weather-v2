// @vitest-environment jsdom

import { cleanup, fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type {
  CountryWeatherCityViewModel,
  LocalDate,
  ScoreViewModel,
} from "../app/view-models";
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
  maplibre.markerElements.length = 0;
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

describe("CountryWeatherExplorer country-map product", () => {
  it("defaults to seven days and renders weather-first markers for every city", async () => {
    renderExplorer();

    expect(screen.getByRole("button", { name: "Next 7 days" }).getAttribute("aria-pressed")).toBe(
      "true",
    );
    expect(screen.getByText("Popular destinations at a glance")).toBeTruthy();
    expect(screen.getAllByText("Popular destinations in Japan")).toHaveLength(2);
    expect(screen.queryByText("Travel Score")).toBeNull();
    expect(screen.queryByText("ranks first")).toBeNull();
    expect(screen.getByTestId("country-weather-map")).toBeTruthy();

    await waitFor(() => expect(maplibre.Map).toHaveBeenCalledTimes(1));
    await waitFor(() => expect(maplibre.markerElements).toHaveLength(3));
    const labels = maplibre.markerElements.flatMap((element) =>
      Array.from(element.querySelectorAll("button")).map((button) =>
        button.getAttribute("aria-label"),
      ),
    );
    expect(labels.some((label) => label?.includes("Tokyo") && label.includes("3/7"))).toBe(true);
    expect(labels.some((label) => label?.includes("Osaka") && label.includes("7/7"))).toBe(true);
  });

  it("switches to the three-day view without a submit button", () => {
    renderExplorer();
    fireEvent.click(screen.getByRole("button", { name: "Next 3 days" }));

    expect(window.location.search).toBe("?range=3d");
    expect(screen.getByRole("button", { name: "Next 3 days" }).getAttribute("aria-pressed")).toBe(
      "true",
    );
    expect(screen.getByLabelText("Tokyo weather summary").textContent).toContain("2/3");
  });

  it("greys destinations outside explicit limits instead of hiding them", () => {
    const { container } = renderExplorer();
    fireEvent.change(screen.getByLabelText("Highest daily rain chance"), {
      target: { value: "40" },
    });

    const choices = Array.from(container.querySelectorAll(".country-city-choice"));
    const tokyo = choices.find((choice) => choice.textContent?.includes("Tokyo"));
    const osaka = choices.find((choice) => choice.textContent?.includes("Osaka"));
    expect(tokyo?.className).toContain("is-filtered");
    expect(osaka?.className).not.toContain("is-filtered");
    expect(container.textContent).toContain("Peak rain 80% exceeds 40%");
    expect(choices).toHaveLength(3);
    expect(window.location.search).toContain("rainMax=40");
  });

  it("selects a map destination inline and preserves the country page", async () => {
    renderExplorer();
    await waitFor(() => expect(maplibre.markerElements).toHaveLength(3));
    const marker = maplibre.markerElements
      .flatMap((element) => Array.from(element.querySelectorAll("button")))
      .find((button) => button.getAttribute("aria-label")?.startsWith("Sapporo:"));

    expect(marker).toBeDefined();
    fireEvent.click(marker!);

    const inspector = screen.getByLabelText("Sapporo weather summary");
    expect(inspector).toBeTruthy();
    expect(window.location.pathname).toBe("/jp");
    expect(window.location.search).toContain("city=sapporo");
    expect(
      within(inspector).getByRole("link", { name: /Open full city forecast/ }).getAttribute("href"),
    ).toContain("/jp/sapporo?start=2026-08-04&end=2026-08-10");
  });

  it("copies the full shareable country-map state", async () => {
    renderExplorer();
    fireEvent.click(screen.getByRole("button", { name: "Copy map link" }));
    await waitFor(() => expect(navigator.clipboard.writeText).toHaveBeenCalled());
    expect(screen.getByText("Link copied")).toBeTruthy();
  });

  it("uses the same map interaction in Simplified and Traditional Chinese", () => {
    renderExplorer("zh-cn");
    expect(screen.getByRole("button", { name: "未来 7 天" })).toBeTruthy();
    expect(screen.getByText("热门旅游地天气一目了然")).toBeTruthy();
    cleanup();

    renderExplorer("zh-hant");
    expect(screen.getByRole("button", { name: "未來 7 天" })).toBeTruthy();
    expect(screen.getByText("熱門旅遊地天氣一目了然")).toBeTruthy();
  });
});
