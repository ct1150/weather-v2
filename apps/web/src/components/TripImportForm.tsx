"use client";

import { useMemo, useState, type ReactElement } from "react";
import { clearCloudMetadata } from "../trips/cloud-sync";
import { parseTripMarkdown } from "../trips/markdown-parser";
import { TRIP_WORKSPACE_STORAGE_KEY, createWorkspaceFromParsed } from "../trips/workspace";

export type TripImportLocale = "en" | "zh-cn" | "zh-hant";

const SAMPLES: Record<TripImportLocale, string> = {
  en: `# Japan family trip\n\n# Day1 (2026-09-12)\n| Time | Plan |\n|---|---|\n|09:00|Asakusa and Senso-ji|\n|18:30|Tokyo Skytree timed ticket|\n\n# Day2 (2026-09-13)\n| Time | Plan |\n|---|---|\n|09:00|Meiji Shrine|\n|16:00|Shibuya Sky|`,
  "zh-cn": `# 2026 日本家庭旅行\n\n# D1（9月12日 周六）\n| 时间 | 行程 |\n|---|---|\n|09:00|浅草寺|\n|18:30|东京晴空塔定时门票|\n\n# D2（9月13日 周日）\n| 时间 | 行程 |\n|---|---|\n|09:00|明治神宫|\n|16:00|涩谷Sky|`,
  "zh-hant": `# 2026 日本家庭旅行\n\n# D1（9月12日 週六）\n| 時間 | 行程 |\n|---|---|\n|09:00|淺草寺|\n|18:30|東京晴空塔定時門票|\n\n# D2（9月13日 週日）\n| 時間 | 行程 |\n|---|---|\n|09:00|明治神宮|\n|16:00|澀谷Sky|`,
};

interface TripImportFormProps {
  readonly locale?: TripImportLocale;
}

export function TripImportForm({ locale = "zh-cn" }: TripImportFormProps): ReactElement {
  const isEnglish = locale === "en";
  const isTraditional = locale === "zh-hant";
  const sample = SAMPLES[locale];
  const [markdown, setMarkdown] = useState(sample);
  const [message, setMessage] = useState("");
  const parsed = useMemo(() => parseTripMarkdown(markdown), [markdown]);

  const copy = isEnglish
    ? {
        missing: "Add at least one D1 or Day1 heading before creating the workspace.",
        title: "My weather-aware trip",
        path: "/trips/workspace",
        step1: "Paste a Markdown itinerary",
        restore: "Restore sample",
        aria: "Markdown trip itinerary",
        step2: "Structured preview",
        tripTitle: "Trip title",
        daysFound: "Days found",
        daysUnit: "days",
        scheduleItems: "Schedule items",
        itemsUnit: "items",
        noDays: "No D1 or Day1 headings were found. Use a heading such as “# Day1 (2026-09-12)”.",
        next: "Next: create an executable workspace",
        nextDescription:
          "Choose a forecast city and day type, then get weather risk, Plan B, local saving and sharing.",
        create: "Create my weather-aware trip",
      }
    : isTraditional
      ? {
          missing: "至少需要一個 D1 或 Day1 日期標題，請先調整 Markdown 格式。",
          title: "我的天氣行程",
          path: "/zh-hant/trips/workspace",
          step1: "貼上 Markdown 行程",
          restore: "還原範例",
          aria: "Markdown 旅行行程",
          step2: "結構化預覽",
          tripTitle: "行程名稱",
          daysFound: "辨識天數",
          daysUnit: "天",
          scheduleItems: "時間節點",
          itemsUnit: "個",
          noDays: "尚未辨識到 D1、D2 等日期標題，請使用「# D1（日期）」格式。",
          next: "下一步：建立可執行工作台",
          nextDescription:
            "匯入後可逐日選擇天氣城市、標記海島／戶外／室內類型，取得風險評分與備用方案；行程會自動保存在目前裝置。",
          create: "建立我的天氣行程",
        }
      : {
          missing: "至少需要识别到一个D1或Day1日期标题。请先调整Markdown格式。",
          title: "我的天气旅行",
          path: "/zh-cn/trips/workspace",
          step1: "粘贴 Markdown 行程",
          restore: "恢复示例",
          aria: "Markdown旅行行程",
          step2: "结构化预览",
          tripTitle: "旅行标题",
          daysFound: "识别天数",
          daysUnit: "天",
          scheduleItems: "时间节点",
          itemsUnit: "个",
          noDays: "暂未识别到D1、D2等日期标题。请使用“# D1（日期）”格式。",
          next: "下一步：生成可执行工作台",
          nextDescription:
            "导入后可以逐日选择天气城市、标记海岛/户外/室内类型，获得风险评分和Plan B；行程自动保存在当前设备。",
          create: "创建我的天气行程",
        };

  const createWorkspace = (): void => {
    if (parsed.days.length === 0) {
      setMessage(copy.missing);
      return;
    }
    const workspace = createWorkspaceFromParsed(parsed, { title: copy.title });
    clearCloudMetadata();
    window.localStorage.setItem(TRIP_WORKSPACE_STORAGE_KEY, JSON.stringify(workspace));
    window.location.assign(copy.path);
  };

  return (
    <div className="trip-import-grid">
      <section className="trip-import-editor">
        <div className="flex items-center justify-between gap-4">
          <div>
            <p className="eyebrow">Step 1</p>
            <h2 className="mt-2 text-xl font-bold text-foreground">{copy.step1}</h2>
          </div>
          <button
            type="button"
            className="trip-secondary-button"
            onClick={() => {
              setMarkdown(sample);
              setMessage("");
            }}
          >
            {copy.restore}
          </button>
        </div>
        <textarea
          value={markdown}
          onChange={(event) => setMarkdown(event.target.value)}
          aria-label={copy.aria}
          spellCheck={false}
        />
      </section>

      <section className="trip-import-preview" aria-live="polite">
        <p className="eyebrow">Step 2</p>
        <h2 className="mt-2 text-xl font-bold text-foreground">{copy.step2}</h2>
        <div className="trip-import-stats">
          <div>
            <span>{copy.tripTitle}</span>
            <strong>{parsed.title}</strong>
          </div>
          <div>
            <span>{copy.daysFound}</span>
            <strong>
              {parsed.days.length} {copy.daysUnit}
            </strong>
          </div>
          <div>
            <span>{copy.scheduleItems}</span>
            <strong>
              {parsed.days.reduce((sum, day) => sum + day.scheduleRows.length, 0)} {copy.itemsUnit}
            </strong>
          </div>
        </div>
        <div className="mt-5 grid gap-3">
          {parsed.days.length === 0 ? (
            <p className="rounded-xl bg-surface-elevated p-4 text-sm text-muted">{copy.noDays}</p>
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
          <strong>{copy.next}</strong>
          <span>{copy.nextDescription}</span>
        </div>
        <button
          type="button"
          className="trip-primary-button mt-4 w-full"
          disabled={parsed.days.length === 0}
          onClick={createWorkspace}
        >
          {copy.create}
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
