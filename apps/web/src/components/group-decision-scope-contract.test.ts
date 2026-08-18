import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const founderPrd = readFileSync(
  new URL(
    "../../../../docs/superpowers/product/2026-08-18-founder-prd-weather-first-group-decision.md",
    import.meta.url,
  ),
  "utf8",
);
const domainModel = readFileSync(
  new URL(
    "../../../../docs/superpowers/product/2026-08-18-domain-model-weather-first-group-decision.md",
    import.meta.url,
  ),
  "utf8",
);
const informationArchitecture = readFileSync(
  new URL(
    "../../../../docs/superpowers/product/2026-08-18-information-architecture-weather-first-group-decision.md",
    import.meta.url,
  ),
  "utf8",
);
const executionPlan = readFileSync(
  new URL(
    "../../../../docs/superpowers/plans/2026-08-18-weather-first-group-decision-execution.md",
    import.meta.url,
  ),
  "utf8",
);

describe("weather-first group decision scope", () => {
  it("defines one north-star journey instead of a general AI travel assistant", () => {
    expect(founderPrd).toContain("Dates fixed. Destination open.");
    expect(founderPrd).toContain("Weekly decision rooms");
    expect(founderPrd).toContain("Explicit non-goals");
    expect(founderPrd).toContain("open-ended AI itinerary chat");
  });

  it("defines the room, participant, vote and destination-lock domain", () => {
    expect(domainModel).toContain("interface DecisionRoom");
    expect(domainModel).toContain("interface DecisionParticipant");
    expect(domainModel).toContain("interface DestinationVote");
    expect(domainModel).toContain("interface LockedDestination");
    expect(domainModel).toContain("baseVersion");
  });

  it("keeps the top-level IA limited to deciding and planning together", () => {
    expect(informationArchitecture).toContain("Decide where");
    expect(informationArchitecture).toContain("Plan together");
    expect(informationArchitecture).toContain("top navigation contains exactly two product tasks");
    expect(informationArchitecture).toContain("/together?room=<token>");
  });

  it("phases the implementation and preserves provider and CI boundaries", () => {
    expect(executionPlan).toContain("Phase 0 — product scope and entry-point cutover");
    expect(executionPlan).toContain("Phase 2 — destination decision room");
    expect(executionPlan).toContain("Weather provider boundaries remain unchanged");
    expect(executionPlan).toContain("four-workflow low-frequency CI/CD model");
  });
});
