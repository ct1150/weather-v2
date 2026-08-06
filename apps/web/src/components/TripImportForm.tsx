"use client";

import { useMemo, useState, type ReactElement } from "react";
import { parseTripMarkdown } from "../trips/markdown-parser";
import {
  TRIP_WORKSPACE_STORAGE_KEY,
  createWorkspaceFromParsed,
  type TripWorkspaceLocale,
} from "../trips/workspace";

const SAMPLES: Record<TripWorkspaceLocale, string> = {
  en: `# Japan family trip\n\n# Day1 (2026-09-12)\n| Time | Plan |\n|---|---|\n|09:00|Asakusa and Senso-ji|\n|18:30|Tokyo Skytree timed ticket|\n\n# Day2 (2026-09-13)\n| Time | Plan |\n|---|---|\n|09:00|Meiji Shrine|\n|16:00|Shibuya Sky|`,
  "zh-cn": `# 2026 青甘家庭轻奢环线\n\n# D1（8月8日 周六）\n| 时间 | 行程 |\n|---|---|\n|15:00|抵达福州长乐机场|\n|17:15|厦门航空起飞|\n\n# D2（8月9日 周日）\n| 时间 | 行程 |\n|---|---|\n|11:10|抵达张掖西站|\n|15:00-20:00|七彩丹霞日落|`,
};

interface TripImportFormProps {
  readonly locale?: TripWorkspaceLocale;
}

export function TripImportForm({ locale = "zh-cn" }: TripImportFormProps): ReactElement {
  const isEnglish = locale === "en";
  const sample = SAMPLES[locale];
  const [markdown, setMarkdown] = useState(sample);
  const [message, setMessage] = useState("");
  const parsed = useMemo(() => parseTripMarkdown(markdown), [markdown]);

  const createWorkspace = (): void => {
    if (parsed.days.length === 0) {
      setMessage(
        isEnglish
          ? "Add at least one D1 or Day1 heading before creating the workspace."
          : "至少需要识别到一个D1或Day1日期标题。请先调整Markdown格式。",
      );
      return;
    }
    const workspace = createWorkspaceFromParsed(parsed, {
      title: isEnglish ? "My weather-aware trip" : "我的天气旅行",
    });
    window.localStorage.setItem(TRIP_WORKSPACE_STORAGE_KEY, JSON.stringify(workspace));
    window.location.assign(isEnglish ? "/trips/workspace" : "/zh-cn/trips/workspace");
  };

  return (
    <div className="trip-import-grid">
      <section className="trip-import-editor">
        <div className="flex items-center justify-between gap-4">
          <div>
            <p className="eyebrow">Step 1</p>
            <h2 className="mt-2 text-xl font-bold text-foreground">
              {isEnglish ? "Paste a Markdown itinerary" : "粘贴 Markdown 行程"}
            </h2>
          </div>
          <button
            type="button"
            className="trip-secondary-button"
            onClick={() => {
              setMarkdown(sample);
              setMessage("");
            }}
          >
            {isEnglish ? "Restore sample" : "恢复示例"}
          </button>
        </div>
        <textarea
          value={markdown}
          onChange={(event) => setMarkdown(event.target.value)}
          aria-label={isEnglish ? "Markdown trip itinerary" : "Markdown旅行行程"}
          spellCheck={false}
        />
      </section>

      <section className="trip-import-preview" aria-live="polite">
        <p className="eyebrow">Step 2</p>
        <h2 className="mt-2 text-xl font-bold text-foreground">
          {isEnglish ? "Structured preview" : "结构化预览"}
        </h2>
        <div className="trip-import-stats">
          <div>
            <span>{isEnglish ? "Trip title" : "旅行标题"}</span>
            <strong>{parsed.title}</strong>
          </div>
          <div>
            <span>{isEnglish ? "Days found" : "识别天数"}</span>
            <strong>
              {parsed.days.length} {isEnglish ? "days" : "天"}
            </strong>
          </div>
          <div>
            <span>{isEnglish ? "Schedule items" : "时间节点"}</span>
            <strong>
              {parsed.days.reduce((sum, day) => sum + day.scheduleRows.length, 0)}{" "}
              {isEnglish ? "items" : "个"}
            </strong>
          </div>
        </div>
        <div className="mt-5 grid gap-3">
          {parsed.days.length === 0 ? (
            <p className="rounded-xl bg-surface-elevated p-4 text-sm text-muted">
              {isEnglish
                ? "No D1 or Day1 headings were found. Use a heading such as “# Day1 (2026-09-12)”."
                : "暂未识别到D1、D2等日期标题。请使用“# D1（日期）”格式。"}
            </p>
          ) : (
            parsed.days.map((day) => (
              <article key={day.dayNumber} className="trip-import-day">
                <h3>
                  D{day.dayNumber} · {day.heading}
                </h3>
                <ul>
                  {day.scheduleRows.slice(0, 5).map((row) => (
                    <li key={`${row.time}-${row.activity}`}>
                      <time>{row.time}</time>
                      <span>{row.activity}</span>
                    </li>
                  ))}
                </ul>
              </article>
            ))
          )}
        </div>
        <div className="trip-mvp-note mt-5">
          <strong>
            {isEnglish ? "Next: create an executable workspace" : "下一步：生成可执行工作台"}
          </strong>
          <span>
            {isEnglish
              ? "Choose a forecast city and day type, then get weather risk, Plan B, local saving and sharing."
              : "导入后可以逐日选择天气城市、标记海岛/户外/室内类型，获得风险评分和Plan B；行程自动保存在当前设备。"}
          </span>
        </div>
        <button
          type="button"
          className="trip-primary-button mt-4 w-full"
          disabled={parsed.days.length === 0}
          onClick={createWorkspace}
        >
          {isEnglish ? "Create my weather-aware trip" : "创建我的天气行程"}
        </button>
        {message.length > 0 ? (
          <p className="mt-3 text-sm font-semibold text-danger" role="status">
            {message}
          </p>
        ) : null}
      </section>
    </div>
  );
}
