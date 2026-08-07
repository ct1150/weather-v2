"use client";

import { useEffect, useMemo, useState, type ReactElement } from "react";
import { inferImportedWorkspace, unresolvedImportedDays } from "../trips/import-inference";
import { parseTripMarkdown } from "../trips/markdown-parser";
import {
  TRIP_WORKSPACE_STORAGE_KEY,
  createWorkspaceFromParsed,
  type TripCityOption,
  type TripDayTheme,
} from "../trips/workspace";
import type { TripImportLocale } from "./TripImportForm";

const API_BASE = (process.env.NEXT_PUBLIC_WEATHER_READ_URL ?? "").replace(/\/$/u, "");

const SAMPLES: Record<TripImportLocale, string> = {
  en: `# Japan family trip\n\n# Day1 (2026-09-12) Tokyo\n| Time | Plan |\n|---|---|\n|09:00|Asakusa and Senso-ji|\n|18:30|Tokyo Skytree timed ticket|\n\n# Day2 (2026-09-13) Tokyo\n| Time | Plan |\n|---|---|\n|09:00|Meiji Shrine|\n|16:00|Shibuya Sky|`,
  "zh-cn": `# 2026 日本家庭旅行\n\n# D1（9月12日 周六）东京\n| 时间 | 行程 |\n|---|---|\n|09:00|浅草寺|\n|18:30|东京晴空塔定时门票|\n\n# D2（9月13日 周日）东京\n| 时间 | 行程 |\n|---|---|\n|09:00|明治神宫|\n|16:00|涩谷Sky|`,
  "zh-hant": `# 2026 日本家庭旅行\n\n# D1（9月12日 週六）東京\n| 時間 | 行程 |\n|---|---|\n|09:00|淺草寺|\n|18:30|東京晴空塔定時門票|\n\n# D2（9月13日 週日）東京\n| 時間 | 行程 |\n|---|---|\n|09:00|明治神宮|\n|16:00|澀谷Sky|`,
};

interface TripCitiesResponse {
  readonly data?: { readonly items?: ReadonlyArray<TripCityOption> };
}

interface SmartTripImportFormProps {
  readonly locale?: TripImportLocale;
}

function themeLabel(theme: TripDayTheme, locale: TripImportLocale): string {
  if (locale === "en") {
    if (theme === "beach") return "Beach / island";
    if (theme === "outdoor") return "Outdoor";
    if (theme === "indoor") return "Mostly indoor";
    return "City sightseeing";
  }
  if (locale === "zh-hant") {
    if (theme === "beach") return "海灘／海島";
    if (theme === "outdoor") return "戶外景點";
    if (theme === "indoor") return "以室內為主";
    return "城市觀光";
  }
  if (theme === "beach") return "海岛/沙滩";
  if (theme === "outdoor") return "户外景点";
  if (theme === "indoor") return "室内为主";
  return "城市游览";
}

export function SmartTripImportForm({ locale = "zh-cn" }: SmartTripImportFormProps): ReactElement {
  const isEnglish = locale === "en";
  const isTraditional = locale === "zh-hant";
  const [markdown, setMarkdown] = useState("");
  const [message, setMessage] = useState("");
  const [cities, setCities] = useState<ReadonlyArray<TripCityOption>>([]);
  const parsed = useMemo(() => parseTripMarkdown(markdown), [markdown]);

  const copy = isEnglish
    ? {
        missing: "Add at least one D1 or Day1 heading before creating the workspace.",
        title: "My weather-aware trip",
        path: "/trips/workspace",
        step1: "Paste your existing itinerary",
        trySample: "Try sample",
        aria: "Existing trip itinerary",
        placeholder: "Paste a Markdown or ChatGPT itinerary here…",
        step2: "Structured preview",
        tripTitle: "Trip title",
        daysFound: "Days found",
        daysUnit: "days",
        scheduleItems: "Schedule items",
        itemsUnit: "items",
        noDays:
          "No D1 or Day1 headings were found. Try a heading such as “# Day1 (2026-09-12) Tokyo”.",
        next: "Next: review only what needs attention",
        nextDescription:
          "Recognized cities and day types are filled automatically. Ambiguous days stay unassigned for you to confirm in the workspace.",
        create: "Create my weather-aware trip",
        unresolved: "Needs city confirmation",
      }
    : isTraditional
      ? {
          missing: "至少需要一個 D1 或 Day1 日期標題，請先調整行程格式。",
          title: "我的天氣行程",
          path: "/zh-hant/trips/workspace",
          step1: "貼上你現有的行程",
          trySample: "試用範例",
          aria: "現有旅行行程",
          placeholder: "貼上 Markdown、ChatGPT 或已整理好的旅行行程…",
          step2: "結構化預覽",
          tripTitle: "行程名稱",
          daysFound: "辨識天數",
          daysUnit: "天",
          scheduleItems: "時間節點",
          itemsUnit: "個",
          noDays: "尚未辨識到 D1、D2 等日期標題，請使用「# D1（日期）東京」這類格式。",
          next: "下一步：只確認尚未辨識的部分",
          nextDescription:
            "可唯一辨識的城市與行程類型會自動填入；有歧義的日期會保留空白，讓你在工作台確認。",
          create: "建立我的天氣行程",
          unresolved: "需要確認城市",
        }
      : {
          missing: "至少需要识别到一个D1或Day1日期标题，请先调整行程格式。",
          title: "我的天气旅行",
          path: "/zh-cn/trips/workspace",
          step1: "粘贴你现有的行程",
          trySample: "使用示例",
          aria: "现有旅行行程",
          placeholder: "粘贴 Markdown、ChatGPT 或已整理好的旅行行程…",
          step2: "结构化预览",
          tripTitle: "旅行标题",
          daysFound: "识别天数",
          daysUnit: "天",
          scheduleItems: "时间节点",
          itemsUnit: "个",
          noDays: "暂未识别到D1、D2等日期标题，请使用“# D1（日期）东京”这类格式。",
          next: "下一步：只确认尚未识别的部分",
          nextDescription:
            "可唯一识别的城市和行程类型会自动填入；有歧义的日期会保持空白，让你在工作台确认。",
          create: "创建我的天气行程",
          unresolved: "需要确认城市",
        };

  useEffect(() => {
    if (API_BASE.length === 0) return;
    let active = true;
    const apiLocale = locale === "en" ? "en" : "zh-cn";
    void fetch(`${API_BASE}/api/v1/trip-cities?locale=${apiLocale}`)
      .then(async (response) => {
        if (!response.ok) throw new Error(`CITY_API_${response.status}`);
        return (await response.json()) as TripCitiesResponse;
      })
      .then((payload) => {
        if (active) setCities(payload.data?.items ?? []);
      })
      .catch(() => {
        if (active) setCities([]);
      });
    return () => {
      active = false;
    };
  }, [locale]);

  const previewWorkspace = useMemo(() => {
    const base = createWorkspaceFromParsed(parsed, { title: copy.title });
    return inferImportedWorkspace(base, parsed, cities);
  }, [cities, copy.title, parsed]);
  const unresolved = unresolvedImportedDays(previewWorkspace);

  const createWorkspace = (): void => {
    if (parsed.days.length === 0) {
      setMessage(copy.missing);
      return;
    }
    const base = createWorkspaceFromParsed(parsed, { title: copy.title });
    const workspace = inferImportedWorkspace(base, parsed, cities);
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
              setMarkdown(SAMPLES[locale]);
              setMessage("");
            }}
          >
            {copy.trySample}
          </button>
        </div>
        <textarea
          value={markdown}
          onChange={(event) => setMarkdown(event.target.value)}
          aria-label={copy.aria}
          placeholder={copy.placeholder}
          spellCheck={false}
        />
      </section>

      <section className="trip-import-preview" aria-live="polite">
        <p className="eyebrow">Step 2</p>
        <h2 className="mt-2 text-xl font-bold text-foreground">{copy.step2}</h2>
        <div className="trip-import-stats">
          <div>
            <span>{copy.tripTitle}</span>
            <strong>{parsed.days.length === 0 ? "—" : parsed.title}</strong>
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
            parsed.days.map((day, index) => {
              const inferredDay = previewWorkspace.days[index];
              return (
                <article key={day.dayNumber} className="trip-import-day">
                  <div className="flex flex-wrap items-start justify-between gap-2">
                    <h3>
                      D{day.dayNumber} · {day.heading}
                    </h3>
                    {inferredDay?.cityId ? (
                      <span className="trip-constraint-badge">
                        {inferredDay.cityName} · {themeLabel(inferredDay.theme, locale)}
                      </span>
                    ) : (
                      <span className="trip-risk-badge trip-risk-medium">{copy.unresolved}</span>
                    )}
                  </div>
                  <ul>
                    {day.scheduleRows.slice(0, 5).map((row) => (
                      <li key={`${row.time}-${row.activity}`}>
                        <time>{row.time}</time>
                        <span>{row.activity}</span>
                      </li>
                    ))}
                  </ul>
                </article>
              );
            })
          )}
        </div>
        <div className="trip-mvp-note mt-5">
          <strong>{copy.next}</strong>
          <span>{copy.nextDescription}</span>
          {parsed.days.length > 0 && unresolved.length > 0 ? (
            <span>
              {copy.unresolved}: {unresolved.map((day) => `D${day}`).join(" · ")}
            </span>
          ) : null}
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
