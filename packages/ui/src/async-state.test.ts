// packages/ui/src/async-state.test.ts
//
// AsyncState presenters — complete state contract (UX-STATE-001),
// accessibility (UX-A11Y-001), semantic tokens + reduced motion (UX-DESIGN-001),
// and stable information-architecture landmarks (UX-IA-001).
//
// NOTE: this file keeps the `.ts` extension (the Verify command checks
// `src/async-state.test.ts` by name), so JSX syntax is unavailable here.
// We compose the element tree with `createElement` and render via
// `react-dom/server` `renderToStaticMarkup` (node-safe).

import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";

import { AsyncStateRegion, type AsyncState } from "./async-state";

type Payload = { readonly id: string; readonly name: string };

function render(state: AsyncState<Payload>): string {
  return renderToStaticMarkup(
    createElement(AsyncStateRegion<Payload>, {
      state,
      regionLabel: "Recommendations",
      render: (data) => createElement("span", null, `${data.name} (${data.id})`),
    }),
  );
}

describe("AsyncState — skeleton (UX-STATE-001)", () => {
  it("reserves space, is aria-busy, and carries the label", () => {
    const html = render({ kind: "skeleton", label: "Preparing recommendations" });
    expect(html).toContain('data-state="skeleton"');
    expect(html).toContain('aria-busy="true"');
    expect(html).toContain('role="status"');
    // Reserved geometry (no avoidable layout shift).
    expect(html).toContain("min-h-[6rem]");
    expect(html).toContain("Preparing recommendations");
  });
});

describe("AsyncState — loading (UX-STATE-001)", () => {
  it("announces an accessible status and does not conceal previous content", () => {
    const html = render({
      kind: "loading",
      label: "Loading recommendations…",
      previous: { id: "TYO", name: "Tokyo" },
    });
    expect(html).toContain('data-state="loading"');
    expect(html).toContain('aria-live="polite"');
    expect(html).toContain('role="status"');
    // Previous trustworthy content is retained, not hidden.
    expect(html).toContain("Tokyo (TYO)");
    expect(html).toContain('data-state="loading-previous"');
  });

  it("renders a plain status when no previous content exists", () => {
    const html = render({ kind: "loading", label: "Loading…" });
    expect(html).toContain('data-state="loading"');
    expect(html).not.toContain('data-state="loading-previous"');
  });
});

describe("AsyncState — empty (UX-STATE-001)", () => {
  it("distinguishes no-match from unavailable", () => {
    const noMatch = render({ kind: "empty", reason: "no-match" });
    const unavailable = render({ kind: "empty", reason: "unavailable" });
    expect(noMatch).toContain('data-reason="no-match"');
    expect(noMatch).toContain("No matching results.");
    expect(unavailable).toContain('data-reason="unavailable"');
    expect(unavailable).toContain("This data is currently unavailable.");
  });

  it("renders an actionable control when supplied", () => {
    const html = render({
      kind: "empty",
      reason: "no-match",
      action: { kind: "reset_filter", label: "Reset filters" },
    });
    expect(html).toContain("Reset filters");
    expect(html).toContain('type="button"');
  });
});

describe("AsyncState — partial (UX-STATE-001)", () => {
  it("renders data and names the unavailable fields", () => {
    const html = render({
      kind: "partial",
      data: { id: "TYO", name: "Tokyo" },
      unavailableFields: ["humidity", "wind"],
    });
    expect(html).toContain('data-state="partial"');
    expect(html).toContain("Tokyo (TYO)");
    expect(html).toContain("Some fields unavailable: humidity, wind");
  });
});

describe("AsyncState — stale (UX-STATE-001)", () => {
  it("always carries a visibly time-qualified update label", () => {
    const html = render({
      kind: "stale",
      data: { id: "TYO", name: "Tokyo" },
      updatedAt: "2026-07-20T00:00:00Z",
    });
    expect(html).toContain('data-state="stale"');
    expect(html).toContain("Tokyo (TYO)");
    expect(html).toContain("Updated 2026-07-20T00:00:00Z");
  });
});

describe("AsyncState — error (UX-STATE-001 / UX-A11Y-001)", () => {
  it("uses role=alert, exposes only a stable code, and offers one retry", () => {
    const html = render({
      kind: "error",
      code: "DATA_UNAVAILABLE",
      retry: { action: "retry", disabled: false, attempt: 1 },
    });
    expect(html).toContain('data-state="error"');
    expect(html).toContain('role="alert"');
    expect(html).toContain('data-error-code="DATA_UNAVAILABLE"');
    // No stack / credential / provider message is emitted.
    expect(html).not.toContain("at ");
    expect(html).not.toContain("password");
    // Exactly one retry control, carrying the attempt and a serialized descriptor.
    expect(html).toContain('data-action="retry"');
    expect(html).toContain('data-attempt="1"');
    const matches = html.match(/data-action="retry"/g);
    expect(matches).not.toBeNull();
    expect(matches?.length).toBe(1);
  });

  it("disables the retry control when retry is not meaningful", () => {
    const html = render({
      kind: "error",
      code: "INTERNAL_ERROR",
      retry: { action: "retry", disabled: true, attempt: 3 },
    });
    expect(html).toContain('data-action="retry"');
    expect(html).toContain("disabled");
    expect(html).toContain('aria-disabled="true"');
  });

  it("omits the retry control entirely when none is supplied", () => {
    const html = render({ kind: "error", code: "INTERNAL_ERROR" });
    expect(html).not.toContain('data-action="retry"');
  });
});

describe("AsyncState — offline (UX-STATE-001)", () => {
  it("retains available content and labels the offline state", () => {
    const html = render({
      kind: "offline",
      retained: { id: "TYO", name: "Tokyo" },
    });
    expect(html).toContain('data-state="offline"');
    expect(html).toContain("Tokyo (TYO)");
    expect(html).toContain("You are offline. Showing saved content.");
  });

  it("renders a plain status when nothing is retained", () => {
    const html = render({ kind: "offline" });
    expect(html).toContain('data-state="offline"');
    expect(html).toContain("You are offline.");
  });
});

describe("AsyncState — ready (UX-STATE-001)", () => {
  it("renders the trusted payload", () => {
    const html = render({ kind: "ready", data: { id: "TYO", name: "Tokyo" } });
    expect(html).toContain('data-state="ready"');
    expect(html).toContain("Tokyo (TYO)");
  });
});

describe("AsyncState — design tokens, motion, and IA (UX-DESIGN-001 / UX-IA-001)", () => {
  it("renders a stable labelled landmark for information architecture", () => {
    const html = render({ kind: "ready", data: { id: "TYO", name: "Tokyo" } });
    // Stable information-architecture landmark with an accessible name.
    expect(html).toContain("<section");
    expect(html).toContain('aria-label="Recommendations"');
    expect(html).toContain('data-async-region="true"');
    // Semantic tokens rather than arbitrary brand values.
    expect(html).toContain("text-body");
  });

  it("provides a non-animated reduced-motion alternative for motion", () => {
    // The skeleton pulses; the reduced-motion utility disables it.
    const html = render({ kind: "skeleton", label: "Preparing recommendations" });
    expect(html).toContain("animate-pulse");
    expect(html).toContain("motion-reduce:animate-none");
  });

  it("uses a visible focus indicator on interactive controls", () => {
    const error = render({
      kind: "error",
      code: "DATA_UNAVAILABLE",
      retry: { action: "retry", disabled: false, attempt: 1 },
    });
    expect(error).toContain("focus-ring");
    expect(error).toContain("motion-reduce:transition-none");
  });
});
