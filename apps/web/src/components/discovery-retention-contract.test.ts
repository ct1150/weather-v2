import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const companion = readFileSync(
  new URL("./DiscoveryRetentionCompanion.tsx", import.meta.url),
  "utf8",
);
const helper = readFileSync(
  new URL("../discovery/discovery-retention.ts", import.meta.url),
  "utf8",
);
const englishRoute = readFileSync(new URL("../app/discover/page.tsx", import.meta.url), "utf8");
const simplifiedRoute = readFileSync(
  new URL("../app/zh-cn/discover/page.tsx", import.meta.url),
  "utf8",
);
const traditionalRoute = readFileSync(
  new URL("../app/zh-hant/discover/page.tsx", import.meta.url),
  "utf8",
);

describe("discovery decision and retention contracts", () => {
  it("persists the bounded shortlist while retaining shareable URL state", () => {
    expect(helper).toContain("wnr:discovery-shortlist:v1");
    expect(helper).toContain("MAX_DISCOVERY_SHORTLIST = 4");
    expect(helper).toContain('next.set("cities"');
    expect(companion).toContain("useLayoutEffect");
    expect(companion).toContain("window.history.replaceState");
    expect(companion).toContain("window.localStorage.setItem");
  });

  it("treats a cleared URL shortlist as authoritative after initial restoration", () => {
    expect(companion).toContain("initializedRef.current");
    expect(companion).toContain("window.localStorage.removeItem");
    expect(companion).toContain("Clearing URL state remains authoritative");
  });

  it("uses labels that match the existing shortlist controls", () => {
    expect(companion).toContain("Use “Shortlist”");
    expect(companion).toContain("点击“加入对比”");
    expect(companion).toContain("點擊「加入比較」");
    expect(companion).not.toContain("Save & compare");
  });

  it("explains recommendation value and weather trade-offs in all locales", () => {
    expect(companion).toContain("Why it fits");
    expect(companion).toContain("Watch-outs");
    expect(companion).toContain("推荐理由");
    expect(companion).toContain("需要注意");
    expect(companion).toContain("推薦理由");
  });

  it("tracks destination detail opens through the existing allowlisted event", () => {
    expect(companion).toContain('event: "search_result_clicked"');
    expect(companion).toContain('result_type: "city"');
    expect(companion).toContain("article.destination-card");
  });

  it("wires the companion into every crawlable discovery locale", () => {
    expect(englishRoute).toContain('<DiscoveryRetentionCompanion locale="en" />');
    expect(simplifiedRoute).toContain('<DiscoveryRetentionCompanion locale="zh-cn" />');
    expect(traditionalRoute).toContain('<DiscoveryRetentionCompanion locale="zh-hant" />');
  });
});
