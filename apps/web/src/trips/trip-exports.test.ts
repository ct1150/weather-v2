import { describe, expect, it } from "vitest";
import type { TripForecastDay, TripWorkspace } from "./workspace";
import { buildWeatherPackingList, workspaceToIcs, workspaceToPrintableHtml } from "./trip-exports";

const workspace: TripWorkspace = {
  version: 2,
  id: "trip-test",
  title: "Test trip",
  partyProfile: "family",
  createdAt: "2026-08-15T00:00:00.000Z",
  updatedAt: "2026-08-15T00:00:00.000Z",
  days: [
    {
      id: "day-1",
      dayNumber: 1,
      date: "2026-08-20",
      cityId: "jp-tokyo",
      cityName: "Tokyo",
      countryName: "Japan",
      theme: "outdoor",
      flexible: true,
      activities: ["09:00 Garden"],
      activityItems: [
        {
          id: "garden",
          title: "Garden",
          cityId: "jp-tokyo",
          startTime: "09:00",
          endTime: null,
          durationMinutes: 90,
          latitude: 35.68,
          longitude: 139.76,
          category: "attraction",
          environment: "outdoor",
          weatherSensitivity: ["rain", "heat", "uv"],
          flexibility: "movable",
          reservation: "none",
          priority: "preferred",
          poiId: null,
          alternatives: [],
          notes: "Bring water",
        },
      ],
      notes: "",
    },
  ],
};

const forecast: TripForecastDay = {
  cityId: "jp-tokyo",
  date: "2026-08-20",
  weatherCode: 61,
  condition: "Rain",
  temperatureMinC: 10,
  temperatureMaxC: 34,
  precipitationMm: 8,
  rainProbability: 80,
  windSpeedKph: 20,
  windGustKph: 40,
  uvIndex: 8,
  cloudCover: 80,
  visibilityM: 10000,
  sunrise: "05:05",
  sunset: "18:25",
  dataQuality: "good",
};

describe("trip execution exports", () => {
  it("creates a portable ICS calendar with timed activities", () => {
    const ics = workspaceToIcs(workspace);
    expect(ics).toContain("BEGIN:VCALENDAR");
    expect(ics).toContain("SUMMARY:Garden");
    expect(ics).toContain("DTSTART:20260820T090000");
    expect(ics).toContain("DTEND:20260820T103000");
    expect(ics).toContain("GEO:35.68;139.76");
  });

  it("generates weather and family-specific packing items without duplicates", () => {
    const items = buildWeatherPackingList([forecast], "family");
    const ids = items.map((item) => item.id);
    expect(ids).toContain("rain-shell");
    expect(ids).toContain("sun-protection");
    expect(ids).toContain("heat");
    expect(ids).toContain("warm-layer");
    expect(ids).toContain("wind");
    expect(ids).toContain("family");
    expect(new Set(ids).size).toBe(ids.length);
  });

  it("creates printable HTML with weather and activity content", () => {
    const html = workspaceToPrintableHtml(workspace, [forecast]);
    expect(html).toContain("Test trip");
    expect(html).toContain("Rain");
    expect(html).toContain("Garden");
  });
});
