import { describe, expect, it } from "vitest";
import { parseTripMarkdown } from "./markdown-parser";

describe("trip markdown parser", () => {
  it("extracts the title, day headings and schedule rows", () => {
    const parsed = parseTripMarkdown(`# 青甘家庭环线\n\n# D1（8月8日）\n| 时间 | 行程 |\n|---|---|\n|15:00|抵达机场|\n\n# Day2 张掖\n| Time | Activity |\n|---|---|\n|09:00|七彩丹霞|`);
    expect(parsed.title).toBe("青甘家庭环线");
    expect(parsed.days).toHaveLength(2);
    expect(parsed.days[0]?.scheduleRows[0]).toEqual({ time: "15:00", activity: "抵达机场" });
    expect(parsed.days[1]?.dayNumber).toBe(2);
  });
});
