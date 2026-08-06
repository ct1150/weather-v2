import { describe, expect, it } from "vitest";

import { parseTripMarkdown } from "./markdown-parser";
import {
  assessWorkspaceDay,
  createWorkspaceFromParsed,
  createWorkspaceFromTemplate,
  decodeWorkspaceShare,
  encodeWorkspaceShare,
  workspaceToMarkdown,
  type TripForecastDay,
  type TripWorkspaceDay,
} from "./workspace";

const NOW = "2026-08-06T10:00:00.000Z";

function day(theme: TripWorkspaceDay["theme"]): TripWorkspaceDay {
  return {
    id: "day-1",
    dayNumber: 1,
    date: "2026-08-08",
    cityId: "jp-tokyo",
    cityName: "东京",
    countryName: "日本",
    theme,
    flexible: true,
    activities: ["09:00 浅草寺", "15:00 东京塔"],
    notes: "带老人儿童",
  };
}

function forecast(rainProbability: number): TripForecastDay {
  return {
    cityId: "jp-tokyo",
    date: "2026-08-08",
    weatherCode: 61,
    condition: "雨",
    temperatureMinC: 24,
    temperatureMaxC: 32,
    precipitationMm: 6,
    rainProbability,
    windSpeedKph: 15,
    windGustKph: 24,
    uvIndex: 7,
    cloudCover: 80,
    visibilityM: 12_000,
    sunrise: "05:00",
    sunset: "18:40",
    dataQuality: "good",
  };
}

describe("trip workspace", () => {
  it("turns parsed Markdown into a dated editable workspace", () => {
    const parsed = parseTripMarkdown(
      `# 2026 日本家庭旅行\n\n# D1（8月8日 周六）\n| 时间 | 行程 |\n|---|---|\n|09:00|浅草寺|\n\n# D2（8月9日 周日）\n| 时间 | 行程 |\n|---|---|\n|10:00|东京国立博物馆|`,
    );
    const workspace = createWorkspaceFromParsed(parsed, { now: NOW, id: "trip-1" });

    expect(workspace.id).toBe("trip-1");
    expect(workspace.title).toBe("2026 日本家庭旅行");
    expect(workspace.days).toHaveLength(2);
    expect(workspace.days[0]).toMatchObject({ date: "2026-08-08", activities: ["09:00 浅草寺"] });
  });

  it("round-trips a normalized workspace through a share payload", () => {
    const parsed = parseTripMarkdown(
      "# 2026 东京旅行\n\n# D1（8月8日）\n| 时间 | 行程 |\n|---|---|\n|09:00|浅草寺|",
    );
    const workspace = createWorkspaceFromParsed(parsed, { now: NOW, id: "trip-share" });
    const encoded = encodeWorkspaceShare(workspace);
    const decoded = decodeWorkspaceShare(encoded);

    expect(decoded).not.toBeNull();
    expect(decoded).toMatchObject({ id: "trip-share", title: "2026 东京旅行" });
    expect(decodeWorkspaceShare("not-valid-base64")).toBeNull();
  });

  it("scores rainy beach days lower than indoor days and strengthens family advice", () => {
    const rainy = forecast(85);
    const beach = assessWorkspaceDay(day("beach"), rainy, "family");
    const indoor = assessWorkspaceDay(day("indoor"), rainy, "family");

    expect(beach.score).not.toBeNull();
    expect(indoor.score).not.toBeNull();
    expect(beach.score ?? 100).toBeLessThan(indoor.score ?? 0);
    expect(beach.planB).toContain("水族馆");
  });

  it("creates editable international templates with destination weather cities", () => {
    const workspace = createWorkspaceFromTemplate("japan-family", "en", {
      now: NOW,
      id: "trip-template",
    });

    expect(workspace.id).toBe("trip-template");
    expect(workspace.title).toBe("Japan family city loop");
    expect(workspace.days).toHaveLength(7);
    expect(workspace.days[0]).toMatchObject({ cityId: "jp-tokyo", cityName: "Tokyo" });
    expect(workspace.days.at(-1)).toMatchObject({ cityId: "jp-osaka", cityName: "Osaka" });
  });

  it("exports the editable plan as portable bilingual Markdown", () => {
    const parsed = parseTripMarkdown(
      "# 2026 东京旅行\n\n# D1（8月8日）\n| 时间 | 行程 |\n|---|---|\n|09:00|浅草寺|",
    );
    const workspace = createWorkspaceFromParsed(parsed, { now: NOW, id: "trip-export" });
    const chineseMarkdown = workspaceToMarkdown(workspace);
    const englishMarkdown = workspaceToMarkdown(workspace, "en");

    expect(chineseMarkdown).toContain("# 2026 东京旅行");
    expect(chineseMarkdown).toContain("# D1 (2026-08-08)");
    expect(chineseMarkdown).toContain("09:00 浅草寺");
    expect(englishMarkdown).toContain("**Travel party:** Adults");
    expect(englishMarkdown).toContain("**Destination:** City not selected");
  });
});
