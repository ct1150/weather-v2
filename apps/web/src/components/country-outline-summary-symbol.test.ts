import { describe, expect, it } from "vitest";
import { summaryMarkerSymbol } from "./CountryOutlineMap";

describe("summaryMarkerSymbol", () => {
  it("does not let one thunderstorm day override a mostly-dry mixed window", () => {
    expect(summaryMarkerSymbol({ risk: "mixed", symbol: "⛈️" })).toBe("🌦️");
  });

  it("keeps snow visible for a mixed winter window", () => {
    expect(summaryMarkerSymbol({ risk: "mixed", symbol: "🌨️" })).toBe("🌨️");
  });

  it("keeps the original symbol when every selected day is dry", () => {
    expect(summaryMarkerSymbol({ risk: "good", symbol: "🌤️" })).toBe("🌤️");
  });

  it("keeps severe weather visible when the whole period is wet", () => {
    expect(summaryMarkerSymbol({ risk: "wet", symbol: "⛈️" })).toBe("⛈️");
  });
});
