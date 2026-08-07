import { describe, expect, it } from "vitest";

import { windowIndicesForDates } from "./window-selection";

const datesFromFriday = [
  "2026-08-07",
  "2026-08-08",
  "2026-08-09",
  "2026-08-10",
  "2026-08-11",
  "2026-08-12",
  "2026-08-13",
];

describe("windowIndicesForDates", () => {
  it("maps today and tomorrow directly", () => {
    expect(windowIndicesForDates(datesFromFriday, "today")).toEqual([0]);
    expect(windowIndicesForDates(datesFromFriday, "tomorrow")).toEqual([1]);
  });

  it("resolves this weekend from calendar weekdays", () => {
    expect(windowIndicesForDates(datesFromFriday, "weekend")).toEqual([1, 2]);
    expect(
      windowIndicesForDates(
        ["2026-08-08", "2026-08-09", "2026-08-10", "2026-08-11"],
        "weekend",
      ),
    ).toEqual([0, 1]);
    expect(
      windowIndicesForDates(
        ["2026-08-09", "2026-08-10", "2026-08-11", "2026-08-12"],
        "weekend",
      ),
    ).toEqual([0]);
  });

  it("starts next week on the next calendar Monday", () => {
    expect(windowIndicesForDates(datesFromFriday, "next_week")).toEqual([3, 4, 5, 6]);
    expect(
      windowIndicesForDates(
        [
          "2026-08-03",
          "2026-08-04",
          "2026-08-05",
          "2026-08-06",
          "2026-08-07",
          "2026-08-08",
          "2026-08-09",
        ],
        "next_week",
      ),
    ).toEqual([]);
  });
});
