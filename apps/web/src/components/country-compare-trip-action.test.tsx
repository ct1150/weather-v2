// @vitest-environment jsdom

import { render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { CountryCompareSheet, type CountryCompareItem } from "./CountryCompareSheet";

const item = (id: string, name: string): CountryCompareItem => ({
  id,
  name,
  symbol: "☀️",
  rainHeadline: "5 of 7 days should be mostly rain-free",
  totalRainMm: 2.4,
  maxRain: 35,
  temperatureMin: 22,
  temperatureMax: 31,
  maxWind: 18,
  detailHref: `/jp/${id}?start=2026-08-24&end=2026-08-30`,
  days: [
    {
      localDate: "2026-08-24",
      conditionLabel: "Clear",
      rainProbability: 20,
      temperatureMin: 22,
      temperatureMax: 31,
    },
    {
      localDate: "2026-08-25",
      conditionLabel: "Partly cloudy",
      rainProbability: 30,
      temperatureMin: 23,
      temperatureMax: 30,
    },
  ],
});

describe("CountryCompareSheet trip planning bridge", () => {
  it("offers a planning action for every compared destination", () => {
    render(
      <div>
        <div className="country-map-primary-heading">
          <p className="eyebrow">Japan</p>
        </div>
        <CountryCompareSheet
          locale="en"
          items={[item("tokyo", "Tokyo"), item("osaka", "Osaka")]}
          maxItems={3}
          open
          onOpen={vi.fn()}
          onClose={vi.fn()}
          onRemove={vi.fn()}
          onClear={vi.fn()}
        />
      </div>,
    );

    expect(screen.getAllByRole("button", { name: "Choose & plan" })).toHaveLength(2);
    expect(screen.getAllByRole("link", { name: /Full forecast/ })).toHaveLength(2);
  });

  it("localizes the planning action for Simplified Chinese", () => {
    render(
      <div>
        <div className="country-map-primary-heading">
          <p className="eyebrow">日本</p>
        </div>
        <CountryCompareSheet
          locale="zh-cn"
          items={[item("tokyo", "东京")]}
          maxItems={3}
          open
          onOpen={vi.fn()}
          onClose={vi.fn()}
          onRemove={vi.fn()}
          onClear={vi.fn()}
        />
      </div>,
    );

    expect(screen.getByRole("button", { name: "选这里并规划" })).toBeTruthy();
  });
});
