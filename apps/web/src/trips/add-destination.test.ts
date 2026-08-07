import { describe, expect, it } from "vitest";

import { addDestinationToWorkspace } from "./add-destination";
import { createBlankWorkspace } from "./workspace";

const destination = {
  cityId: "jp-tokyo",
  cityName: "Tokyo",
  countryName: "Japan",
  date: "2026-08-09",
} as const;

describe("addDestinationToWorkspace", () => {
  it("reuses a pristine blank day", () => {
    const workspace = createBlankWorkspace({
      now: "2026-08-07T00:00:00.000Z",
      id: "trip-1",
      title: "My trip",
    });
    const next = addDestinationToWorkspace(workspace, destination, {
      now: "2026-08-07T01:00:00.000Z",
    });

    expect(next.days).toHaveLength(1);
    expect(next.days[0]).toMatchObject({
      cityId: "jp-tokyo",
      cityName: "Tokyo",
      countryName: "Japan",
      date: "2026-08-09",
    });
  });

  it("appends without replacing existing itinerary content", () => {
    const base = createBlankWorkspace({
      now: "2026-08-07T00:00:00.000Z",
      id: "trip-2",
      title: "Existing trip",
    });
    const existing = {
      ...base,
      days: [
        {
          ...base.days[0]!,
          cityId: "kr-seoul",
          cityName: "Seoul",
          countryName: "South Korea",
          activities: ["09:00 Gyeongbokgung"],
        },
      ],
    };

    const next = addDestinationToWorkspace(existing, destination, {
      now: "2026-08-07T01:00:00.000Z",
    });

    expect(next.title).toBe("Existing trip");
    expect(next.days).toHaveLength(2);
    expect(next.days[0]?.cityId).toBe("kr-seoul");
    expect(next.days[0]?.activities).toEqual(["09:00 Gyeongbokgung"]);
    expect(next.days[1]).toMatchObject({ cityId: "jp-tokyo", date: "2026-08-09" });
  });
});
