import { describe, expect, it } from "vitest";

import {
  toTraditionalCity,
  toTraditionalDecision,
  toTraditionalText,
  toTraditionalWorkspace,
} from "./traditional";
import type { TripWorkspace, WorkspaceDayDecision } from "./workspace";

describe("Traditional Chinese trip localization", () => {
  it("converts destination and product terminology", () => {
    expect(toTraditionalText("韩国首尔天气变化")).toBe("南韓首爾天氣變化");
    expect(toTraditionalText("马来西亚槟城亲子旅行")).toBe("馬來西亞檳城親子旅行");
  });

  it("localizes city API rows without changing stable identifiers", () => {
    const city = toTraditionalCity({
      cityId: "th-phuket",
      countrySlug: "thailand",
      citySlug: "phuket",
      cityName: "普吉岛",
      countryName: "泰国",
      latitude: 7.88,
      longitude: 98.39,
      timezone: "Asia/Bangkok",
      featured: true,
    });
    expect(city).toMatchObject({ cityId: "th-phuket", cityName: "普吉島", countryName: "泰國" });
  });

  it("localizes decisions and saved workspaces", () => {
    const decision: WorkspaceDayDecision = {
      score: 55,
      riskLevel: "medium",
      summary: "行程可执行，但建议缩短户外暴露并准备备选",
      reasons: ["可能出现阵雨，建议携带轻便雨具并保留机动时间"],
      planB: "把博物馆、商场、美食街等室内项目移到天气较差时段。",
    };
    expect(toTraditionalDecision(decision).summary).toContain("建議縮短戶外");

    const workspace: TripWorkspace = {
      version: 1,
      id: "trip-1",
      title: "日本亲子旅行",
      partyProfile: "family",
      createdAt: "2026-08-06T00:00:00.000Z",
      updatedAt: "2026-08-06T00:00:00.000Z",
      days: [
        {
          id: "day-1",
          dayNumber: 1,
          date: "2026-09-01",
          cityId: "jp-tokyo",
          cityName: "东京",
          countryName: "日本",
          theme: "city",
          flexible: true,
          activities: ["09:00 浅草寺"],
          notes: "天气变化时调整",
        },
      ],
    };
    expect(toTraditionalWorkspace(workspace)).toMatchObject({
      title: "日本親子旅行",
      days: [{ cityName: "東京", notes: "天氣變化時調整" }],
    });
  });
});
