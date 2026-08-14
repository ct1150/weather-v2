import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const layout = readFileSync(new URL("../app/layout.tsx", import.meta.url), "utf8");
const bootstrap = readFileSync(new URL("./PwaBootstrap.tsx", import.meta.url), "utf8");
const workspace = readFileSync(new URL("./TripExecutionWorkspace.tsx", import.meta.url), "utf8");
const utilities = readFileSync(new URL("./TripExecutionUtilities.tsx", import.meta.url), "utf8");
const englishExecution = readFileSync(
  new URL("../app/trips/execution/page.tsx", import.meta.url),
  "utf8",
);
const simplifiedExecution = readFileSync(
  new URL("../app/zh-cn/trips/execution/page.tsx", import.meta.url),
  "utf8",
);
const traditionalExecution = readFileSync(
  new URL("../app/zh-hant/trips/execution/page.tsx", import.meta.url),
  "utf8",
);
const manifest = readFileSync(new URL("../../public/manifest.webmanifest", import.meta.url), "utf8");
const serviceWorker = readFileSync(new URL("../../public/sw.js", import.meta.url), "utf8");

describe("Trip execution PWA / offline contracts", () => {
  it("registers an installable manifest and service worker from the static root layout", () => {
    expect(layout).toContain('manifest: "/manifest.webmanifest"');
    expect(layout).toContain("<PwaBootstrap />");
    expect(bootstrap).toContain('navigator.serviceWorker.register("/sw.js"');
    expect(manifest).toContain('"display": "standalone"');
    expect(manifest).toContain('"start_url": "/trips/execution"');
  });

  it("uses locale-aware fail-safe navigation caching without intercepting external APIs", () => {
    expect(serviceWorker).toContain('request.mode === "navigate"');
    expect(serviceWorker).toContain("networkFirst(request)");
    expect(serviceWorker).toContain("url.origin !== self.location.origin");
    expect(serviceWorker).toContain('"/zh-cn/trips/execution"');
    expect(serviceWorker).toContain('"/zh-hant/trips/execution"');
    expect(serviceWorker).toContain("executionFallback(pathname)");
    expect(serviceWorker).toContain("Response.error()");
    expect(serviceWorker).toContain("staleWhileRevalidate(request)");
  });

  it("lets the main execution workspace load Trip and route state directly from IndexedDB", () => {
    expect(workspace).toContain("loadMostRecentOfflineTrip");
    expect(workspace).toContain("loadOfflineRoute");
    expect(workspace).toContain("saveOfflineRoute");
    expect(workspace).toContain("initial.fromOffline");
  });

  it("exposes offline download, weather overview, ICS, print/PDF and packing tools in all locales", () => {
    expect(utilities).toContain("saveOfflineTripBundle");
    expect(utilities).toContain("saveOfflineRoute");
    expect(utilities).toContain("cacheOfflineShell");
    expect(utilities).toContain("offlineOnly");
    expect(utilities).toContain("workspaceToIcs");
    expect(utilities).toContain("workspaceToPrintableHtml");
    expect(utilities).toContain("buildWeatherPackingList");
    expect(englishExecution).toContain('<TripExecutionUtilities locale="en" />');
    expect(simplifiedExecution).toContain('<TripExecutionUtilities locale="zh-cn" />');
    expect(traditionalExecution).toContain('<TripExecutionUtilities locale="zh-hant" />');
  });
});
