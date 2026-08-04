// @vitest-environment jsdom

import { afterEach, describe, expect, it } from "vitest";
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { createElement } from "react";
import { DestinationSearch } from "./DestinationSearch";
import { WindowExperience } from "./WindowExperience";
import type { SearchCandidate } from "../search/search-destinations";

afterEach(() => {
  cleanup();
  window.history.replaceState({}, "", "/");
});

describe("DestinationSearch", () => {
  const candidates: SearchCandidate[] = [
    {
      cityId: "TYO",
      names: ["Tokyo", "東京"],
      countryNames: ["Japan", "日本"],
      countrySlug: "jp",
      citySlug: "tokyo",
      path: "/jp/tokyo",
    },
  ];

  it("reveals a local destination result as the traveler types", () => {
    render(createElement(DestinationSearch, { candidates }));
    fireEvent.change(screen.getByRole("searchbox", { name: "Search by city or country" }), {
      target: { value: "tok" },
    });
    const result = screen.getByRole("link", { name: /Tokyo Japan/ });
    expect(result.getAttribute("href")).toBe("/jp/tokyo");
    expect(screen.getByRole("button", { name: "View weather" }).hasAttribute("disabled")).toBe(
      false,
    );
  });

  it("gives a useful next step when nothing matches", () => {
    render(createElement(DestinationSearch, { candidates }));
    fireEvent.change(screen.getByRole("searchbox", { name: "Search by city or country" }), {
      target: { value: "zzzz" },
    });
    expect(screen.getByText("No destination found")).toBeTruthy();
    expect(screen.getByRole("link", { name: /Browse all destinations/ }).getAttribute("href")).toBe(
      "/explore",
    );
  });
});

describe("WindowExperience", () => {
  const panels = [
    {
      window: "today" as const,
      panel: createElement(
        "div",
        null,
        createElement("a", { href: "/?window=tomorrow", "data-window": "tomorrow" }, "Tomorrow"),
        createElement("p", null, "Today result"),
      ),
    },
    {
      window: "tomorrow" as const,
      panel: createElement(
        "div",
        null,
        createElement("a", { href: "/?window=today", "data-window": "today" }, "Today"),
        createElement("p", null, "Tomorrow result"),
      ),
    },
  ];

  it("switches the baked panel and updates the shareable URL", () => {
    render(createElement(WindowExperience, { initialWindow: "today", panels }));
    fireEvent.click(screen.getByRole("link", { name: "Tomorrow" }));
    expect(screen.getByText("Tomorrow result")).toBeTruthy();
    expect(window.location.search).toBe("?window=tomorrow");
  });

  it("restores a valid window from a shared URL", () => {
    window.history.replaceState({}, "", "/?window=tomorrow");
    render(createElement(WindowExperience, { initialWindow: "today", panels }));
    expect(screen.getByText("Tomorrow result")).toBeTruthy();
  });
});
