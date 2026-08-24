// @vitest-environment jsdom

import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import type { CityForecastDayViewModel, LocalDate, ScoreViewModel } from "../app/view-models";
import { CityDirectAnswer } from "./CityDirectAnswer";
import { buildCityDirectAnswerData } from "./city-direct-answer";

const score: ScoreViewModel = {
  value: 88,
  state: "available",
  confidence: 0.9,
  reasonCodes: [],
};

function day(
  date: string,
  conditionLabel: string,
  precipitationMm: number,
  rainProbability: number,
): CityForecastDayViewModel {
  return {
    localDate: date as LocalDate,
    weather: {
      conditionLabel,
      temperatureMin: 22,
      temperatureMax: 31,
      precipitationMm,
      rainProbability,
      observedAt: "2026-08-24T04:00:00.000Z",
    },
    score,
  };
}

const DAYS = [
  day("2026-08-24", "Clear", 0.2, 55),
  day("2026-08-25", "Light drizzle", 0.1, 15),
  day("2026-08-26", "Partly cloudy", 0.4, 60),
] as const;

describe("city direct answer", () => {
  it("reuses the product rain-free classifier and aggregates the forecast", () => {
    expect(buildCityDirectAnswerData(DAYS)).toMatchObject({
      totalDays: 3,
      rainFreeDays: 2,
      rainFreeDates: ["2026-08-24", "2026-08-26"],
      totalRainMm: 0.7,
      rangeStart: "2026-08-24",
      rangeEnd: "2026-08-26",
    });
  });

  it("renders a visible English answer with dates, rain total and source", () => {
    render(<CityDirectAnswer cityName="Bangkok" forecastDays={DAYS} locale="en" />);

    expect(
      screen.getByText(
        "2 of the next 3 forecast days in Bangkok are currently expected to be mostly rain-free.",
      ),
    ).toBeTruthy();
    expect(screen.getByText(/Better outdoor-weather dates:/)).toHaveTextContent("Aug 24");
    expect(screen.getByText(/Better outdoor-weather dates:/)).toHaveTextContent("Aug 26");
    expect(screen.getByText("0.7 mm")).toBeTruthy();
    expect(screen.getByRole("link", { name: "Open-Meteo" })).toBeTruthy();
  });

  it("renders the same decision meaning in Simplified Chinese", () => {
    render(<CityDirectAnswer cityName="曼谷" forecastDays={DAYS} locale="zh-cn" />);

    expect(screen.getByText("未来3天，曼谷有2天基本不下雨。")).toBeTruthy();
    expect(screen.getByText(/更适合户外的日期：/)).toBeTruthy();
    expect(document.body.textContent).not.toContain("基本无雨");
  });

  it("renders nothing without forecast days", () => {
    const { container } = render(
      <CityDirectAnswer cityName="Bangkok" forecastDays={[]} locale="en" />,
    );
    expect(container).toBeEmptyDOMElement();
  });
});
