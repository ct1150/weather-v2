import { describe, expect, it } from "vitest";
import {
  MAX_SAVED_DISCOVERY_SEARCHES,
  SAVED_DISCOVERY_SEARCHES_STORAGE_KEY,
  buildRecheckReminderCalendar,
  buildSavedDiscoverySearch,
  normalizeSavedDiscoverySearches,
  parseStoredSavedDiscoverySearches,
  serializeSavedDiscoverySearches,
  upsertSavedDiscoverySearch,
  type SavedDiscoverySearch,
} from "./saved-search";

function saved(overrides: Partial<SavedDiscoverySearch> = {}): SavedDiscoverySearch {
  return {
    id: "search-a",
    url: "/discover?from=2026-08-20&to=2026-08-22&origin=sg-singapore&mode=flight&maxTravel=360",
    from: "2026-08-20",
    to: "2026-08-22",
    originId: "sg-singapore",
    mode: "flight",
    maxTravelMinutes: 360,
    savedAt: "2026-08-10T00:00:00.000Z",
    ...overrides,
  };
}

describe("saved discovery searches", () => {
  it("uses a versioned bounded local-storage contract", () => {
    expect(SAVED_DISCOVERY_SEARCHES_STORAGE_KEY).toBe("wnr:saved-discovery-searches:v1");
    expect(MAX_SAVED_DISCOVERY_SEARCHES).toBe(5);
  });

  it("builds a canonical saved search from a shareable discovery URL", () => {
    const result = buildSavedDiscoverySearch(
      new URL(
        "https://868656.xyz/discover?to=2026-08-22&mode=flight&from=2026-08-20&origin=hk-hong-kong&maxTravel=360",
      ),
      "2026-08-10T00:00:00.000Z",
    );

    expect(result).toMatchObject({
      from: "2026-08-20",
      to: "2026-08-22",
      originId: "hk-hong-kong",
      mode: "flight",
      maxTravelMinutes: 360,
    });
    expect(result?.url).toBe(
      "/discover?from=2026-08-20&maxTravel=360&mode=flight&origin=hk-hong-kong&to=2026-08-22",
    );
    expect(result?.id).toMatch(/^search-[a-z0-9]+$/u);
  });

  it("requires an applied date range before a query can be saved", () => {
    expect(
      buildSavedDiscoverySearch(
        new URL("https://868656.xyz/discover?origin=sg-singapore"),
        "2026-08-10T00:00:00.000Z",
      ),
    ).toBeNull();
  });

  it("deduplicates newest-first and keeps only five searches", () => {
    const values = Array.from({ length: 7 }, (_, index) =>
      saved({
        id: `search-${index}`,
        url: `/discover?from=2026-08-${20 + index}&to=2026-08-${21 + index}&origin=sg-singapore&mode=flight&maxTravel=360`,
        from: `2026-08-${20 + index}`,
        to: `2026-08-${21 + index}`,
      }),
    );
    const next = upsertSavedDiscoverySearch(values, values[3]!);
    expect(next).toHaveLength(5);
    expect(next[0]?.id).toBe("search-3");
    expect(new Set(next.map((item) => item.id)).size).toBe(5);
  });

  it("fails closed for malformed stored values and round-trips valid searches", () => {
    expect(parseStoredSavedDiscoverySearches("{bad")).toEqual([]);
    expect(normalizeSavedDiscoverySearches([{ nope: true }])).toEqual([]);
    const values = [saved()];
    expect(parseStoredSavedDiscoverySearches(serializeSavedDiscoverySearches(values))).toEqual(
      values,
    );
  });
});

describe("calendar recheck reminders", () => {
  it("creates D-7, D-3 and D-1 all-day reminders without an email backend", () => {
    const calendar = buildRecheckReminderCalendar({
      search: saved(),
      today: "2026-08-10",
      generatedAt: "2026-08-10T08:30:00.000Z",
      summary: "Recheck trip weather",
      description: "Open the saved Where Not Rain search.",
      absoluteUrl: "https://868656.xyz/discover?from=2026-08-20&to=2026-08-22",
    });

    expect(calendar.reminderCount).toBe(3);
    expect(calendar.content).toContain("DTSTART;VALUE=DATE:20260813");
    expect(calendar.content).toContain("DTSTART;VALUE=DATE:20260817");
    expect(calendar.content).toContain("DTSTART;VALUE=DATE:20260819");
    expect(calendar.content).toContain("https://868656.xyz/discover");
    expect(calendar.filename).toBe("where-not-rain-2026-08-20-recheck.ics");
  });

  it("creates one immediate recheck event when the trip is too close for all offsets", () => {
    const calendar = buildRecheckReminderCalendar({
      search: saved({ from: "2026-08-11", to: "2026-08-12" }),
      today: "2026-08-10",
      generatedAt: "2026-08-10T08:30:00.000Z",
      summary: "Recheck trip weather",
      description: "Open the saved search.",
      absoluteUrl: "https://868656.xyz/discover",
    });
    expect(calendar.reminderCount).toBe(1);
    expect(calendar.content).toContain("DTSTART;VALUE=DATE:20260810");
  });

  it("does not create reminders for a trip whose start date has passed", () => {
    const calendar = buildRecheckReminderCalendar({
      search: saved({ from: "2026-08-09", to: "2026-08-10" }),
      today: "2026-08-10",
      generatedAt: "2026-08-10T08:30:00.000Z",
      summary: "Recheck trip weather",
      description: "Open the saved search.",
      absoluteUrl: "https://868656.xyz/discover",
    });
    expect(calendar.reminderCount).toBe(0);
    expect(calendar.content).toBe("");
  });
});
