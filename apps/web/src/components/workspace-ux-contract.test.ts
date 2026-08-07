import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const localizedSource = readFileSync(
  new URL("./LocalizedTripWorkspace.tsx", import.meta.url),
  "utf8",
);
const simplifiedSource = readFileSync(new URL("./TripWorkspace.tsx", import.meta.url), "utf8");

describe("decision-first workspace UX contract", () => {
  it("puts the trip summary before settings and templates", () => {
    const summary = localizedSource.indexOf('<section className="trip-summary-grid"');
    const settings = localizedSource.indexOf("<summary>{copy.tripSettings}</summary>");
    const templates = localizedSource.indexOf("<summary>{copy.templatesLabel}</summary>");

    expect(summary).toBeGreaterThan(-1);
    expect(settings).toBeGreaterThan(summary);
    expect(templates).toBeGreaterThan(summary);
  });

  it("shows each day decision before the collapsed day editor", () => {
    const editorFunction = localizedSource.slice(localizedSource.indexOf("function DayEditor"));
    const decision = editorFunction.indexOf("<DecisionCard");
    const editor = editorFunction.indexOf('<details className="trip-day-editor');

    expect(decision).toBeGreaterThan(-1);
    expect(editor).toBeGreaterThan(decision);
    expect(simplifiedSource).toContain("<summary>编辑当天安排</summary>");
  });

  it("protects itinerary replacement with confirmation", () => {
    expect(localizedSource).toContain("if (!window.confirm(copy.replaceConfirm)) return;");
    expect(localizedSource).toContain("if (!window.confirm(copy.blankConfirm)) return;");
  });
});
