"use client";

import { useCallback, useEffect, useMemo, useState, type ReactElement } from "react";
import {
  getTripSession,
  sendTripMagicLink,
  signInTripWithGoogle,
} from "../trips/auth-client";
import {
  copySharedCloudTrip,
  readSharedCloudTrip,
  readTripApiHealth,
  writeCloudMetadata,
  type SharedCloudTripRecord,
  type TripApiHealth,
} from "../trips/cloud-sync";
import {
  normalizeWorkspace,
  TRIP_WORKSPACE_STORAGE_KEY,
  type TripWorkspace,
} from "../trips/workspace";
import type { CloudTripLocale } from "./CloudTripControls";

const COPY = {
  en: {
    eyebrow: "Read-only shared trip",
    readOnly: "You are viewing a read-only cloud snapshot. The owner's trip cannot be changed here.",
    copy: "Copy to My Trips",
    copying: "Copying…",
    copied: "Copied. Opening your independent trip…",
    signIn: "Sign in to copy this trip",
    signInBody: "Viewing is public. Copying creates a new independent cloud trip under your account.",
    google: "Continue with Google",
    emailPlaceholder: "you@example.com",
    email: "Email me a sign-in link",
    emailSent: "Sign-in link sent. Check your email.",
    unavailable: "Cloud sign-in providers are not configured yet. You can still view this trip.",
    missing: "This share link is missing or invalid.",
    revoked: "This shared trip is no longer available. The owner may have regenerated or revoked the link.",
    updated: "Shared snapshot updated",
    dates: "Trip dates",
    noDates: "Dates not set",
    notes: "Notes",
    noActivities: "No activities listed.",
    error: "Unable to load this shared trip.",
  },
  "zh-cn": {
    eyebrow: "只读分享行程",
    readOnly: "你正在查看只读云端快照，不能在这里修改原行程。",
    copy: "复制到我的行程",
    copying: "正在复制…",
    copied: "复制完成，正在打开你的独立行程…",
    signIn: "登录后复制这份行程",
    signInBody: "查看无需登录；复制后会在你的账号下创建一份完全独立的云端行程。",
    google: "使用 Google 继续",
    emailPlaceholder: "你的邮箱",
    email: "发送登录链接",
    emailSent: "登录链接已发送，请检查邮箱。",
    unavailable: "云端登录方式尚未配置，你仍可继续查看这份行程。",
    missing: "分享链接缺失或格式无效。",
    revoked: "这份分享已不可用，可能是原作者重新生成或撤销了链接。",
    updated: "分享快照更新于",
    dates: "行程日期",
    noDates: "未设置日期",
    notes: "备注",
    noActivities: "当天没有填写活动。",
    error: "暂时无法加载这份分享行程。",
  },
  "zh-hant": {
    eyebrow: "唯讀分享行程",
    readOnly: "你正在查看唯讀雲端快照，不能在這裡修改原行程。",
    copy: "複製到我的行程",
    copying: "正在複製…",
    copied: "複製完成，正在開啟你的獨立行程…",
    signIn: "登入後複製這份行程",
    signInBody: "查看不需要登入；複製後會在你的帳號下建立一份完全獨立的雲端行程。",
    google: "使用 Google 繼續",
    emailPlaceholder: "你的電子郵件",
    email: "傳送登入連結",
    emailSent: "登入連結已傳送，請檢查郵件。",
    unavailable: "雲端登入方式尚未設定，你仍可繼續查看這份行程。",
    missing: "分享連結缺失或格式無效。",
    revoked: "這份分享已無法使用，可能是原作者重新產生或撤銷了連結。",
    updated: "分享快照更新於",
    dates: "行程日期",
    noDates: "未設定日期",
    notes: "備註",
    noActivities: "當天沒有填寫活動。",
    error: "暫時無法載入這份分享行程。",
  },
} as const;

function workspacePath(locale: CloudTripLocale): string {
  return locale === "en" ? "/trips/workspace" : `/${locale}/trips/workspace`;
}

function persistCopiedTrip(remote: { readonly id: string; readonly version: number; readonly updatedAt: string; readonly document: TripWorkspace }): void {
  const normalized = normalizeWorkspace(remote.document);
  window.localStorage.setItem(TRIP_WORKSPACE_STORAGE_KEY, JSON.stringify(normalized));
  writeCloudMetadata({
    cloudTripId: remote.id,
    lastSyncedVersion: remote.version,
    lastSyncedAt: remote.updatedAt,
    localDocument: normalized,
  });
}

export function SharedTripViewer({ locale }: { readonly locale: CloudTripLocale }): ReactElement {
  const copy = COPY[locale];
  const [token, setToken] = useState<string | null>(null);
  const [trip, setTrip] = useState<SharedCloudTripRecord | null>(null);
  const [health, setHealth] = useState<TripApiHealth | null>(null);
  const [signedInEmail, setSignedInEmail] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [copying, setCopying] = useState(false);
  const [showAuth, setShowAuth] = useState(false);
  const [email, setEmail] = useState("");
  const [message, setMessage] = useState("");

  useEffect(() => {
    const nextToken = new URLSearchParams(window.location.search).get("token");
    if (nextToken === null || !/^shr_[a-f0-9]{64}$/u.test(nextToken)) {
      setMessage(copy.missing);
      setLoading(false);
      return;
    }
    setToken(nextToken);
    void readSharedCloudTrip(nextToken)
      .then(setTrip)
      .catch(() => setMessage(copy.revoked))
      .finally(() => setLoading(false));
  }, [copy.missing, copy.revoked]);

  useEffect(() => {
    void Promise.all([readTripApiHealth(), getTripSession()])
      .then(([healthResult, session]) => {
        setHealth(healthResult);
        setSignedInEmail(session?.email ?? null);
      })
      .catch(() => setHealth(null));
  }, []);

  const workspace = useMemo(
    () => (trip === null ? null : normalizeWorkspace(trip.document)),
    [trip],
  );
  const providerAvailable = health?.providers.google === true || health?.providers.email === true;

  const copyTrip = useCallback(async (): Promise<void> => {
    if (token === null) return;
    if (signedInEmail === null) {
      setShowAuth(true);
      return;
    }
    setCopying(true);
    setMessage("");
    try {
      const copied = await copySharedCloudTrip(token);
      persistCopiedTrip(copied);
      setMessage(copy.copied);
      window.location.assign(workspacePath(locale));
    } catch {
      setMessage(copy.error);
      setCopying(false);
    }
  }, [copy.copied, copy.error, locale, signedInEmail, token]);

  const startGoogle = useCallback(async (): Promise<void> => {
    await signInTripWithGoogle(window.location.href);
  }, []);

  const sendEmail = useCallback(async (): Promise<void> => {
    if (email.trim().length === 0) return;
    const result = await sendTripMagicLink(email.trim(), window.location.href);
    setMessage(result.ok ? copy.emailSent : (result.message ?? copy.error));
  }, [copy.emailSent, copy.error, email]);

  if (loading) {
    return (
      <main id="main-content" className="mx-auto max-w-4xl px-4 py-10 sm:px-6" data-shared-trip="loading">
        <p className="eyebrow">{copy.eyebrow}</p>
      </main>
    );
  }

  if (trip === null || workspace === null) {
    return (
      <main id="main-content" className="mx-auto max-w-4xl px-4 py-10 sm:px-6" data-shared-trip="unavailable">
        <section className="info-panel">
          <p className="eyebrow">{copy.eyebrow}</p>
          <h1 className="mt-3 text-3xl font-bold text-foreground">{message || copy.error}</h1>
        </section>
      </main>
    );
  }

  const dateRange =
    trip.startDate === null
      ? copy.noDates
      : trip.endDate === null || trip.endDate === trip.startDate
        ? trip.startDate
        : `${trip.startDate} → ${trip.endDate}`;

  return (
    <main id="main-content" className="mx-auto max-w-4xl px-4 py-8 sm:px-6 sm:py-10" data-shared-trip="ready">
      <section className="rounded-[2rem] border border-border/80 bg-white p-6 shadow-sm sm:p-8">
        <p className="eyebrow">{copy.eyebrow}</p>
        <h1 className="mt-3 text-4xl font-bold tracking-[-0.04em] text-foreground">{trip.title}</h1>
        <p className="mt-3 text-sm leading-6 text-muted">{copy.readOnly}</p>
        <div className="mt-5 flex flex-wrap gap-3 text-xs text-muted">
          <span>{copy.dates}: {dateRange}</span>
          <span>{copy.updated}: {new Date(trip.updatedAt).toLocaleString()}</span>
        </div>
        <div className="mt-6 flex flex-wrap gap-3">
          <button type="button" className="trip-primary-button" disabled={copying} onClick={() => void copyTrip()}>
            {copying ? copy.copying : copy.copy}
          </button>
        </div>

        {showAuth && signedInEmail === null ? (
          <div className="mt-5 rounded-xl border border-border/80 bg-surface-elevated p-4">
            <h2 className="text-base font-bold text-foreground">{copy.signIn}</h2>
            <p className="mt-1 text-sm leading-6 text-muted">{copy.signInBody}</p>
            {providerAvailable ? (
              <div className="mt-4 grid gap-3 sm:grid-cols-2">
                {health?.providers.google ? (
                  <button type="button" className="trip-primary-button" onClick={() => void startGoogle()}>{copy.google}</button>
                ) : null}
                {health?.providers.email ? (
                  <div className="flex gap-2">
                    <input
                      type="email"
                      value={email}
                      placeholder={copy.emailPlaceholder}
                      className="min-h-11 min-w-0 flex-1 rounded-xl border border-border bg-white px-3 text-sm"
                      onChange={(event) => setEmail(event.target.value)}
                    />
                    <button type="button" className="trip-secondary-button" onClick={() => void sendEmail()}>{copy.email}</button>
                  </div>
                ) : null}
              </div>
            ) : (
              <p className="mt-3 text-sm text-muted">{copy.unavailable}</p>
            )}
          </div>
        ) : null}
        {message.length > 0 && trip !== null ? <p className="mt-4 text-xs text-muted">{message}</p> : null}
      </section>

      <section className="mt-6 grid gap-4" aria-label={trip.title}>
        {workspace.days.map((day) => (
          <article key={day.id} className="trip-process-card">
            <span>D{day.dayNumber} · {day.date || "—"}</span>
            <h3>{day.cityName || day.countryName || `Day ${day.dayNumber}`}</h3>
            {day.activities.length > 0 ? (
              <ul className="mt-3 grid gap-2 text-sm leading-6 text-body">
                {day.activities.map((activity) => <li key={activity}>{activity}</li>)}
              </ul>
            ) : (
              <p className="mt-3 text-sm text-muted">{copy.noActivities}</p>
            )}
            {day.notes.trim().length > 0 ? (
              <p className="mt-3 text-sm leading-6 text-muted"><strong>{copy.notes}:</strong> {day.notes}</p>
            ) : null}
          </article>
        ))}
      </section>
    </main>
  );
}
