import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const founderPrd = readFileSync(
  new URL(
    "../../../../docs/superpowers/product/2026-08-19-founder-prd-opc-dry-destination-engine.md",
    import.meta.url,
  ),
  "utf8",
);
const executionPlan = readFileSync(
  new URL(
    "../../../../docs/superpowers/plans/2026-08-19-opc-product-cutover-phase0.md",
    import.meta.url,
  ),
  "utf8",
);
const reachabilityPlan = readFileSync(
  new URL(
    "../../../../docs/superpowers/plans/2026-08-19-opc-reachability-phase1.md",
    import.meta.url,
  ),
  "utf8",
);

describe("OPC least-rain product scope", () => {
  it("defines one north-star job and explicit non-goals", () => {
    expect(founderPrd).toContain("Where is it least likely to rain within reach?");
    expect(founderPrd).toContain("Top 3");
    expect(founderPrd).toContain("Explicit non-goals");
    expect(founderPrd).toContain("full collaborative itinerary platform");
  });

  it("uses rain as the only ranking target and limits as hard filters", () => {
    expect(founderPrd).toContain("Rain is the only ranking target");
    expect(founderPrd).toContain("maximum daily rain probability");
    expect(founderPrd).toContain("maximum wind speed");
    expect(founderPrd).toContain("minimum night temperature");
    expect(founderPrd).toContain("maximum daytime temperature");
  });

  it("implements reachability before conversion and voting", () => {
    expect(executionPlan).toContain("Phase 0 — OPC product cutover");
    expect(executionPlan).toContain("Phase 1 — origin and reachability");
    expect(executionPlan).toContain("Status: implemented");
    expect(executionPlan).toContain("Phase 2 — selection, monetization and retention");
    expect(executionPlan).toContain("Phase 3 — evidence-gated lightweight voting");
    expect(reachabilityPlan).toContain("Singapore");
    expect(reachabilityPlan).toContain("Hong Kong");
    expect(reachabilityPlan).toContain("Taipei");
    expect(reachabilityPlan).toContain("Travel time never changes the dry score");
  });

  it("preserves provider and low-frequency CI boundaries", () => {
    expect(executionPlan).toContain("Weather provider boundaries remain unchanged");
    expect(executionPlan).toContain("four-workflow low-frequency CI/CD model");
  });
});
