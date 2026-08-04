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
    expect(screen.getByRole("button", { name: /Tokyo.*25% rain/i })).toBeTruthy();
    expect(screen.getByRole("button", { name: /Osaka.*40% rain/i })).toBeTruthy();
    expect(screen.getByRole("button", { name: /Sapporo.*55% rain/i })).toBeTruthy();
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
    expect(screen.getByLabelText("Osaka weather summary").textContent).toContain("15% rain");
    expect(container.querySelector(".country-city-grid button")?.textContent).toMatch(/^#1Osaka/);
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
});
