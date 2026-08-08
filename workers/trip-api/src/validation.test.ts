import { describe, expect, it } from "vitest";
import { validateTripDocument } from "./validation";

function validDocument() {
  return {
    version: 1,
    id: "trip-local",
    title: "Trip",
    partyProfile: "adults",
    createdAt: "2026-08-07T00:00:00.000Z",
    updatedAt: "2026-08-07T00:00:00.000Z",
    days: [
      {
        id: "day-1",
        dayNumber: 1,
        date: "2026-08-08",
        cityId: "jp-tokyo",
        cityName: "Tokyo",
        countryName: "Japan",
        theme: "city",
        flexible: true,
        activities: [],
        notes: "",
      },
    ],
  };
}

function validV2Document() {
  const base = validDocument();
  return {
    ...base,
    version: 2,
    days: [
      {
        ...base.days[0],
        activities: ["09:00 Ueno Park"],
        activityItems: [
          {
            id: "activity-day-1-1-ueno-park",
            title: "Ueno Park",
            cityId: "jp-tokyo",
            startTime: "09:00",
            endTime: null,
            durationMinutes: 120,
            latitude: 35.7141,
            longitude: 139.7741,
            category: "leisure",
            environment: "outdoor",
            weatherSensitivity: ["rain", "heat", "cold", "wind", "uv"],
            flexibility: "movable",
            reservation: "none",
            priority: "preferred",
            poiId: "jp-tokyo-ueno-park",
            alternatives: [],
            notes: "",
          },
        ],
      },
    ],
  };
}

describe("validateTripDocument", () => {
  it("keeps accepting the legacy v1 workspace contract", () => {
    expect(validateTripDocument(validDocument())).toMatchObject({
      title: "Trip",
      startDate: "2026-08-08",
      endDate: "2026-08-08",
    });
  });

  it("accepts the structured v2 workspace contract", () => {
    const result = validateTripDocument(validV2Document());
    expect(result).not.toBeNull();
    expect(result?.document).toMatchObject({ version: 2 });
  });

  it("rejects malformed structured activity fields", () => {
    const base = validV2Document();
    expect(
      validateTripDocument({
        ...base,
        days: [
          {
            ...base.days[0],
            activityItems: [{ ...base.days[0].activityItems[0], environment: "underwater" }],
          },
        ],
      }),
    ).toBeNull();
    expect(
      validateTripDocument({
        ...base,
        days: [
          {
            ...base.days[0],
            activityItems: [
              { ...base.days[0].activityItems[0], weatherSensitivity: ["rain", "unknown"] },
            ],
          },
        ],
      }),
    ).toBeNull();
  });

  it("rejects more than 16 days", () => {
    const base = validDocument();
    const days = Array.from({ length: 17 }, (_, index) => ({
      ...base.days[0],
      id: `day-${index + 1}`,
      dayNumber: index + 1,
      date: `2026-08-${String(index + 1).padStart(2, "0")}`,
    }));
    expect(validateTripDocument({ ...base, days })).toBeNull();
  });

  it("rejects trips spanning more than 16 calendar days", () => {
    const base = validDocument();
    expect(
      validateTripDocument({
        ...base,
        days: [
          base.days[0],
          {
            ...base.days[0],
            id: "day-2",
            dayNumber: 2,
            date: "2026-08-24",
          },
        ],
      }),
    ).toBeNull();
  });

  it("rejects oversized notes and unsupported themes", () => {
    const base = validDocument();
    expect(
      validateTripDocument({
        ...base,
        days: [{ ...base.days[0], notes: "x".repeat(501) }],
      }),
    ).toBeNull();
    expect(
      validateTripDocument({
        ...base,
        days: [{ ...base.days[0], theme: "unsafe" }],
      }),
    ).toBeNull();
  });
});
