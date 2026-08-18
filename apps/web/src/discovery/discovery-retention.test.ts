import { describe, expect, it } from "vitest";
import {
  DISCOVERY_SHORTLIST_STORAGE_KEY,
  discoveryShortlistFromSearch,
  normalizeDiscoveryShortlist,
  parseStoredDiscoveryShortlist,
  serializeDiscoveryShortlist,
  withDiscoveryShortlist,
} from "./discovery-retention";

describe("discovery shortlist retention", () => {
  it("uses a stable versioned storage key", () => {
    expect(DISCOVERY_SHORTLIST_STORAGE_KEY).toBe("wnr:discovery-shortlist:v1");
  });

  it("trims, deduplicates and bounds saved destinations", () => {
    expect(normalizeDiscoveryShortlist([" tokyo ", "tokyo", 3, "", "seoul", "osaka"], 2)).toEqual([
      "tokyo",
      "seoul",
    ]);
  });

  it("fails closed for invalid stored payloads", () => {
    expect(parseStoredDiscoveryShortlist("not-json")).toEqual([]);
    expect(parseStoredDiscoveryShortlist('{"city":"tokyo"}')).toEqual([]);
  });

  it("round-trips saved destinations", () => {
    const raw = serializeDiscoveryShortlist(["tokyo", "seoul", "tokyo"]);
    expect(parseStoredDiscoveryShortlist(raw)).toEqual(["tokyo", "seoul"]);
  });

  it("reads and updates shareable URL state without dropping other filters", () => {
    const search = new URLSearchParams("intent=dry&cities=tokyo,seoul,tokyo");
    expect(discoveryShortlistFromSearch(search)).toEqual(["tokyo", "seoul"]);

    const next = withDiscoveryShortlist(search, ["osaka"]);
    expect(next.get("intent")).toBe("dry");
    expect(next.get("cities")).toBe("osaka");

    expect(withDiscoveryShortlist(next, []).has("cities")).toBe(false);
  });
});
