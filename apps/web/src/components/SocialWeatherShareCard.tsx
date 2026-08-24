"use client";

import { useMemo, useState, type ReactElement } from "react";
import type { PublishedLocale } from "../app/seo";
import {
  buildPromotionCopy,
  buildPromotionUrl,
  type PromotionChannel,
  type PromotionMode,
  type PromotionWeatherItem,
} from "../analytics/social-promotion";

const COPY = {
  en: {
    eyebrow: "Shareable weather card",
    title: "Turn the live ranking into a post",
    intro:
      "Use the top three destinations as ready-to-share travel-weather content. Every channel link carries UTM attribution so source quality appears in the Growth Dashboard.",
    copyPost: "Copy post",
    copied: "Copied",
    share: "Share",
    reddit: "Open Reddit",
    x: "Open X",
    note: "Tip: screenshot this card for Pinterest or short-form video covers, then use the tracked link in the caption.",
  },
  "zh-cn": {
    eyebrow: "可分享天气卡片",
    title: "把实时排行直接变成推广内容",
    intro:
      "Top 3 自动生成可复制文案，并给不同渠道附带 UTM。发布后可以在 Growth Dashboard 直接比较 Reddit、小红书、TikTok 等来源质量。",
    copyPost: "复制推广文案",
    copied: "已复制",
    share: "系统分享",
    reddit: "打开 Reddit",
    x: "打开 X",
    note: "建议：直接截取这张卡作为小红书/Pinterest/短视频封面，正文使用下方带渠道归因的链接。",
  },
  "zh-hant": {
    eyebrow: "可分享天氣卡片",
    title: "把即時排行直接變成推廣內容",
    intro:
      "Top 3 自動生成可複製文案，並為不同渠道附帶 UTM。發布後可以在 Growth Dashboard 直接比較 Reddit、社群與短影音來源品質。",
    copyPost: "複製推廣文案",
    copied: "已複製",
    share: "系統分享",
    reddit: "打開 Reddit",
    x: "打開 X",
    note: "建議：直接截取這張卡作為 Pinterest/短影音封面，正文使用下方帶渠道歸因的連結。",
  },
} as const;

function channelForLocale(locale: PublishedLocale): PromotionChannel {
  return locale === "en" ? "reddit" : "xiaohongshu";
}

export function SocialWeatherShareCard({
  locale,
  mode,
  pageUrl,
  items,
}: {
  readonly locale: PublishedLocale;
  readonly mode: PromotionMode;
  readonly pageUrl: string;
  readonly items: ReadonlyArray<PromotionWeatherItem>;
}): ReactElement | null {
  const copy = COPY[locale];
  const top = items.slice(0, 3);
  const [copied, setCopied] = useState(false);
  const primaryChannel = channelForLocale(locale);
  const post = useMemo(
    () => buildPromotionCopy({ locale, mode, channel: primaryChannel, pageUrl, items: top }),
    [items, locale, mode, pageUrl, primaryChannel, top],
  );
  const shareUrl = buildPromotionUrl(pageUrl, primaryChannel, mode);
  const redditUrl = `https://www.reddit.com/submit?url=${encodeURIComponent(buildPromotionUrl(pageUrl, "reddit", mode))}&title=${encodeURIComponent(post.split("\n")[0] ?? "Where Not Rain")}`;
  const xUrl = `https://x.com/intent/post?url=${encodeURIComponent(buildPromotionUrl(pageUrl, "x", mode))}&text=${encodeURIComponent(post.split("\n").slice(0, 4).join("\n"))}`;

  if (top.length === 0) return null;

  async function copyPost(): Promise<void> {
    try {
      await navigator.clipboard.writeText(post);
      setCopied(true);
      window.setTimeout(() => setCopied(false), 1800);
    } catch {
      setCopied(false);
    }
  }

  async function share(): Promise<void> {
    if (typeof navigator.share !== "function") {
      await copyPost();
      return;
    }
    try {
      await navigator.share({
        title: post.split("\n")[0],
        text: post.split("\n").slice(0, 4).join("\n"),
        url: shareUrl,
      });
    } catch {
      // User cancellation is expected and should not affect the page.
    }
  }

  return (
    <section className="mx-auto mt-8 max-w-6xl px-4 pb-8 sm:px-6" data-social-weather-card>
      <div className="rounded-[28px] border border-border bg-surface p-5 shadow-sm sm:p-7">
        <p className="eyebrow">{copy.eyebrow}</p>
        <div className="mt-3 grid gap-6 lg:grid-cols-[1.1fr_.9fr]">
          <div>
            <h2 className="text-2xl font-bold tracking-[-0.03em] text-foreground sm:text-3xl">
              {copy.title}
            </h2>
            <p className="mt-3 max-w-2xl text-sm leading-6 text-muted">{copy.intro}</p>
            <ol className="mt-5 grid gap-3">
              {top.map((item, index) => (
                <li
                  key={`${item.cityName}-${index}`}
                  className="rounded-2xl border border-border bg-background px-4 py-3"
                >
                  <div className="flex items-center justify-between gap-4">
                    <div>
                      <p className="text-xs font-semibold text-muted">TOP {index + 1}</p>
                      <p className="mt-1 font-bold text-foreground">
                        {item.cityName} · {item.countryName}
                      </p>
                    </div>
                    <div className="text-right">
                      <p className="text-lg font-bold text-foreground">
                        {item.rainFreeDays}/{item.totalDays}
                      </p>
                      <p className="text-xs text-muted">
                        {item.totalRainMm === null ? "—" : `${item.totalRainMm} mm`}
                      </p>
                    </div>
                  </div>
                </li>
              ))}
            </ol>
          </div>
          <div className="rounded-2xl bg-foreground p-5 text-background">
            <pre className="whitespace-pre-wrap font-sans text-sm leading-6">{post}</pre>
            <div className="mt-5 flex flex-wrap gap-2">
              <button
                type="button"
                onClick={() => void copyPost()}
                className="rounded-full bg-background px-4 py-2 text-sm font-bold text-foreground"
              >
                {copied ? copy.copied : copy.copyPost}
              </button>
              <button
                type="button"
                onClick={() => void share()}
                className="rounded-full border border-background/40 px-4 py-2 text-sm font-bold text-background"
              >
                {copy.share}
              </button>
              <a
                href={redditUrl}
                target="_blank"
                rel="noreferrer"
                className="rounded-full border border-background/40 px-4 py-2 text-sm font-bold text-background"
              >
                {copy.reddit}
              </a>
              <a
                href={xUrl}
                target="_blank"
                rel="noreferrer"
                className="rounded-full border border-background/40 px-4 py-2 text-sm font-bold text-background"
              >
                {copy.x}
              </a>
            </div>
            <p className="mt-4 text-xs leading-5 text-background/70">{copy.note}</p>
          </div>
        </div>
      </div>
    </section>
  );
}
