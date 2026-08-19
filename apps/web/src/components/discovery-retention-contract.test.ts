import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const companion = readFileSync(
  new URL("./DiscoveryRetentionCompanion.tsx", import.meta.url),
  "utf8",
);
const shortlistHelper = readFileSync(
  new URL("../discovery/discovery-retention.ts", import.meta.url),
  "utf8",
);
const savedSearchHelper = readFileSync(
  new URL("../discovery/saved-search.ts", import.meta.url),
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
  it("persists a shareable comparison list bounded to the same Top 3 result limit", () => {
    expect(shortlistHelper).toContain("wnr:discovery-shortlist:v1");
    expect(shortlistHelper).toContain("MAX_DISCOVERY_SHORTLIST = 3");
    expect(shortlistHelper).toContain('next.set("cities"');
    expect(companion).toContain("window.history.replaceState");
    expect(companion).toContain("window.localStorage.setItem");
  });

  it("treats a cleared URL shortlist as authoritative after initial restoration", () => {
    expect(companion).toContain("shortlistInitializedRef.current");
    expect(companion).toContain("window.localStorage.removeItem");
    expect(companion).toContain("discoveryShortlistFromSearch");
  });

  it("stores up to five complete queries without requiring an account or email", () => {
    expect(savedSearchHelper).toContain("wnr:saved-discovery-searches:v1");
    expect(savedSearchHelper).toContain("MAX_SAVED_DISCOVERY_SEARCHES = 5");
    expect(savedSearchHelper).toContain("buildSavedDiscoverySearch");
    expect(companion).toContain("Save current search");
    expect(companion).toContain("保存当前查询");
    expect(companion).toContain("儲存目前查詢");
    expect(companion).toContain("No account, email address or notification backend is required.");
  });

  it("generates privacy-preserving D-7, D-3 and D-1 calendar recheck reminders", () => {
    expect(savedSearchHelper).toContain("RECHECK_OFFSETS = [7, 3, 1]");
    expect(savedSearchHelper).toContain("BEGIN:VCALENDAR");
    expect(savedSearchHelper).toContain("DTSTART;VALUE=DATE");
    expect(companion).toContain("Calendar reminders");
    expect(companion).toContain("下载日历复查提醒");
    expect(companion).toContain("下載日曆複查提醒");
    expect(companion).toContain("Nothing is sent to our servers.");
  });

  it("tracks bounded save, reopen, share and calendar actions", () => {
    expect(companion).toContain('event: "search_saved"');
    expect(companion).toContain('event: "saved_search_opened"');
    expect(companion).toContain('event: "saved_search_removed"');
    expect(companion).toContain('event: "share_link_copied"');
    expect(companion).toContain('event: "calendar_reminder_downloaded"');
    expect(companion).toContain("retentionEventFields");
  });

  it("does not duplicate planner result-click analytics from the retention layer", () => {
    expect(companion).not.toContain('event: "search_result_clicked"');
    expect(companion).not.toContain("article.destination-card");
  });

  it("wires the retention companion into every crawlable discovery locale", () => {
    expect(englishRoute).toContain('<DiscoveryRetentionCompanion locale="en" />');
    expect(simplifiedRoute).toContain('<DiscoveryRetentionCompanion locale="zh-cn" />');
    expect(traditionalRoute).toContain('<DiscoveryRetentionCompanion locale="zh-hant" />');
  });
});
