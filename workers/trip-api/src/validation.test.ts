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

describe("validateTripDocument", () => {
  it("accepts the current workspace contract", () => {
    expect(validateTripDocument(validDocument())).toMatchObject({
      title: "Trip",
      startDate: "2026-08-08",
      endDate: "2026-08-08",
    });
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
