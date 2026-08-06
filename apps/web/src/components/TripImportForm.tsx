"use client";

import { useMemo, useState, type ReactElement } from "react";
import { parseTripMarkdown } from "../trips/markdown-parser";

const SAMPLE = `# 2026 青甘家庭轻奢环线\n\n# D1（8月8日 周六）\n| 时间 | 行程 |\n|---|---|\n|15:00|抵达福州长乐机场|\n|17:15|厦门航空起飞|\n\n# D2（8月9日 周日）\n| 时间 | 行程 |\n|---|---|\n|11:10|抵达张掖西站|\n|15:00-20:00|七彩丹霞日落|`;

export function TripImportForm(): ReactElement {
  const [markdown, setMarkdown] = useState(SAMPLE);
  const parsed = useMemo(() => parseTripMarkdown(markdown), [markdown]);

  return (
    <div className="trip-import-grid">
      <section className="trip-import-editor">
        <div className="flex items-center justify-between gap-4">
          <div>
            <p className="eyebrow">Step 1</p>
            <h2 className="mt-2 text-xl font-bold text-foreground">粘贴 Markdown 行程</h2>
          </div>
          <button
            type="button"
            className="trip-secondary-button"
            onClick={() => setMarkdown(SAMPLE)}
          >
            恢复示例
          </button>
        </div>
        <textarea
          value={markdown}
          onChange={(event) => setMarkdown(event.target.value)}
          aria-label="Markdown旅行行程"
          spellCheck={false}
        />
      </section>

      <section className="trip-import-preview" aria-live="polite">
        <p className="eyebrow">Step 2</p>
        <h2 className="mt-2 text-xl font-bold text-foreground">结构化预览</h2>
        <div className="trip-import-stats">
          <div>
            <span>旅行标题</span>
            <strong>{parsed.title}</strong>
          </div>
          <div>
            <span>识别天数</span>
            <strong>{parsed.days.length} 天</strong>
          </div>
          <div>
            <span>时间节点</span>
            <strong>{parsed.days.reduce((sum, day) => sum + day.scheduleRows.length, 0)} 个</strong>
          </div>
        </div>
        <div className="mt-5 grid gap-3">
          {parsed.days.length === 0 ? (
            <p className="rounded-xl bg-surface-elevated p-4 text-sm text-muted">
              暂未识别到D1、D2等日期标题。请使用“# D1（日期）”格式。
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
          <strong>MVP当前能力</strong>
          <span>已完成客户端结构识别；下一增量将接入保存、地点解析和逐景点天气绑定。</span>
        </div>
      </section>
    </div>
  );
}
