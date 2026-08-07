"use client";

import { useCallback, useEffect, useMemo, useState, type ReactElement } from "react";
import {
  getTripSession,
  sendTripMagicLink,
  signInTripWithGoogle,
  type TripAuthUser,
} from "../trips/auth-client";
import {
  acceptCloudTripInvite,
  readCloudTrip,
  readCloudTripInvite,
  readTripApiHealth,
  writeCloudMetadata,
  type CloudTripInvitePreview,
  type TripApiHealth,
} from "../trips/cloud-sync";
import {
  normalizeWorkspace,
  TRIP_WORKSPACE_STORAGE_KEY,
  type TripWorkspace,
} from "../trips/workspace";
import type { CloudTripLocale } from "./CloudTripControls";

const INVITE_SESSION_KEY = "wnr:trip-invite-token:v1";
const TOKEN_PATTERN = /^inv_[a-f0-9]{64}$/u;

const COPY = {
  en: {
    eyebrow: "Trip collaboration invite",
    title: "Join this trip",
    role: "Access",
    editor: "Editor · can change the itinerary",
    viewer: "Viewer · read only",
    invited: "Invited email",
    expires: "Expires",
    signIn: "Sign in to accept",
    google: "Continue with Google",
    emailPlaceholder: "Invited email address",
    email: "Email me a sign-in link",
    emailSent: "Sign-in link sent. Return here after signing in.",
    mismatch: "This invitation is for a different email address. Sign in with the invited email to accept it.",
    accept: "Accept invitation",
    accepting: "Accepting…",
    accepted: "Invitation accepted. Opening the shared trip…",
    missing: "This invitation link is missing or invalid.",
    unavailable: "This invitation has expired, was revoked, or has already been used.",
    authUnavailable: "Sign-in is not configured right now. You can still ask the owner for a read-only share link.",
    error: "The invitation could not be loaded right now.",
  },
  "zh-cn": {
    eyebrow: "行程协作邀请",
    title: "加入这份行程",
    role: "权限",
    editor: "可编辑 · 可以修改行程",
    viewer: "仅查看 · 不能修改",
    invited: "受邀邮箱",
    expires: "有效期至",
    signIn: "登录后接受邀请",
    google: "使用 Google 继续",
    emailPlaceholder: "受邀邮箱地址",
    email: "发送登录链接",
    emailSent: "登录链接已发送，登录后返回此页面即可。",
    mismatch: "当前登录邮箱与受邀邮箱不一致，请使用受邀邮箱登录后再接受。",
    accept: "接受邀请",
    accepting: "正在接受…",
    accepted: "已加入协作，正在打开行程…",
    missing: "邀请链接缺失或格式无效。",
    unavailable: "这份邀请已过期、被撤销或已经使用。",
    authUnavailable: "当前未配置登录方式，你仍可让所有者发送只读分享链接。",
    error: "暂时无法加载这份邀请。",
  },
  "zh-hant": {
    eyebrow: "行程協作邀請",
    title: "加入這份行程",
    role: "權限",
    editor: "可編輯 · 可以修改行程",
    viewer: "僅查看 · 不能修改",
    invited: "受邀電子郵件",
    expires: "有效期至",
    signIn: "登入後接受邀請",
    google: "使用 Google 繼續",
    emailPlaceholder: "受邀電子郵件",
    email: "傳送登入連結",
    emailSent: "登入連結已傳送，登入後回到此頁即可。",
    mismatch: "目前登入信箱與受邀信箱不一致，請使用受邀信箱登入後再接受。",
    accept: "接受邀請",
    accepting: "正在接受…",
    accepted: "已加入協作，正在開啟行程…",
    missing: "邀請連結缺失或格式無效。",
    unavailable: "這份邀請已過期、被撤銷或已經使用。",
    authUnavailable: "目前未設定登入方式，你仍可請擁有者傳送唯讀分享連結。",
    error: "暫時無法載入這份邀請。",
  },
} as const;

function tripsPath(locale: CloudTripLocale): string {
  return locale === "en" ? "/trips" : `/${locale}/trips`;
}

function workspacePath(locale: CloudTripLocale): string {
  return `${tripsPath(locale)}/workspace`;
}

function persistOpenedTrip(remote: {
  readonly id: string;
  readonly version: number;
  readonly updatedAt: string;
  readonly document: TripWorkspace;
}): void {
  const normalized = normalizeWorkspace(remote.document);
  window.localStorage.setItem(TRIP_WORKSPACE_STORAGE_KEY, JSON.stringify(normalized));
  writeCloudMetadata({
    cloudTripId: remote.id,
    lastSyncedVersion: remote.version,
    lastSyncedAt: remote.updatedAt,
    localDocument: normalized,
  });
}

function tokenFromBrowser(): string | null {
  const fromHash = new URLSearchParams(window.location.hash.replace(/^#/u, "")).get("token");
  if (fromHash !== null && TOKEN_PATTERN.test(fromHash)) {
    window.sessionStorage.setItem(INVITE_SESSION_KEY, fromHash);
    return fromHash;
  }
  const stored = window.sessionStorage.getItem(INVITE_SESSION_KEY);
  return stored !== null && TOKEN_PATTERN.test(stored) ? stored : null;
}

export function TripInviteViewer({ locale }: { readonly locale: CloudTripLocale }): ReactElement {
  const copy = COPY[locale];
  const [token, setToken] = useState<string | null>(null);
  const [invite, setInvite] = useState<CloudTripInvitePreview | null>(null);
  const [session, setSession] = useState<TripAuthUser | null>(null);
  const [health, setHealth] = useState<TripApiHealth | null>(null);
  const [email, setEmail] = useState("");
  const [loading, setLoading] = useState(true);
  const [accepting, setAccepting] = useState(false);
  const [message, setMessage] = useState("");

  useEffect(() => {
    const nextToken = tokenFromBrowser();
    if (nextToken === null) {
      setMessage(copy.missing);
      setLoading(false);
      return;
    }
    setToken(nextToken);
    void Promise.all([readCloudTripInvite(nextToken), getTripSession(), readTripApiHealth()])
      .then(([inviteResult, sessionResult, healthResult]) => {
        setInvite(inviteResult);
        setSession(sessionResult);
        setHealth(healthResult);
        setEmail(inviteResult.email);
      })
      .catch(() => setMessage(copy.unavailable))
      .finally(() => setLoading(false));
  }, [copy.missing, copy.unavailable]);

  const emailMatches = useMemo(
    () =>
      invite !== null &&
      session !== null &&
      session.email.trim().toLowerCase() === invite.email.trim().toLowerCase(),
    [invite, session],
  );
  const providerAvailable = health?.providers.google === true || health?.providers.email === true;

  const callbackUrl = useCallback((): string => {
    window.sessionStorage.setItem(INVITE_SESSION_KEY, token ?? "");
    return `${window.location.origin}${tripsPath(locale)}/invite`;
  }, [locale, token]);

  const startGoogle = useCallback(async (): Promise<void> => {
    await signInTripWithGoogle(callbackUrl());
  }, [callbackUrl]);

  const sendEmail = useCallback(async (): Promise<void> => {
    if (email.trim().length === 0) return;
    const result = await sendTripMagicLink(email.trim(), callbackUrl());
    setMessage(result.ok ? copy.emailSent : (result.message ?? copy.error));
  }, [callbackUrl, copy.emailSent, copy.error, email]);

  const acceptInvite = useCallback(async (): Promise<void> => {
    if (token === null || invite === null || !emailMatches) return;
    setAccepting(true);
    setMessage("");
    try {
      const accepted = await acceptCloudTripInvite(token);
      const remote = await readCloudTrip(accepted.tripId);
      persistOpenedTrip(remote);
      window.sessionStorage.removeItem(INVITE_SESSION_KEY);
      setMessage(copy.accepted);
      window.location.assign(workspacePath(locale));
    } catch {
      setMessage(copy.error);
      setAccepting(false);
    }
  }, [copy.accepted, copy.error, emailMatches, invite, locale, token]);

  if (loading) {
    return <p className="info-panel">{copy.title}…</p>;
  }

  if (invite === null) {
    return (
      <section className="info-panel" data-trip-invite="unavailable">
        <p className="eyebrow">{copy.eyebrow}</p>
        <h1 className="mt-3 text-2xl font-bold text-foreground">{copy.title}</h1>
        <p className="mt-3 text-sm text-muted">{message || copy.unavailable}</p>
      </section>
    );
  }

  return (
    <section className="rounded-[2rem] border border-border/80 bg-white p-5 shadow-sm sm:p-7" data-trip-invite="ready">
      <p className="eyebrow">{copy.eyebrow}</p>
      <h1 className="mt-3 text-3xl font-bold tracking-[-0.035em] text-foreground">{invite.tripTitle}</h1>
      <dl className="mt-6 grid gap-3 sm:grid-cols-3">
        <div className="trip-side-card">
          <dt className="text-xs text-muted">{copy.role}</dt>
          <dd className="mt-1 text-sm font-bold text-foreground">
            {invite.role === "editor" ? copy.editor : copy.viewer}
          </dd>
        </div>
        <div className="trip-side-card">
          <dt className="text-xs text-muted">{copy.invited}</dt>
          <dd className="mt-1 break-all text-sm font-bold text-foreground">{invite.email}</dd>
        </div>
        <div className="trip-side-card">
          <dt className="text-xs text-muted">{copy.expires}</dt>
          <dd className="mt-1 text-sm font-bold text-foreground">
            {new Date(invite.expiresAt).toLocaleString()}
          </dd>
        </div>
      </dl>

      {session === null ? (
        <div className="mt-6 rounded-2xl border border-border/80 bg-surface-elevated p-4">
          <h2 className="text-lg font-bold text-foreground">{copy.signIn}</h2>
          {providerAvailable ? (
            <div className="mt-4 grid gap-3 sm:grid-cols-2">
              {health?.providers.google ? (
                <button type="button" className="trip-primary-button" onClick={() => void startGoogle()}>
                  {copy.google}
                </button>
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
                  <button type="button" className="trip-secondary-button" onClick={() => void sendEmail()}>
                    {copy.email}
                  </button>
                </div>
              ) : null}
            </div>
          ) : (
            <p className="mt-3 text-sm text-muted">{copy.authUnavailable}</p>
          )}
        </div>
      ) : emailMatches ? (
        <button
          type="button"
          className="trip-primary-button mt-6 w-full sm:w-auto"
          disabled={accepting}
          onClick={() => void acceptInvite()}
        >
          {accepting ? copy.accepting : copy.accept}
        </button>
      ) : (
        <p className="mt-6 rounded-xl border border-border/80 bg-surface-elevated p-4 text-sm text-muted">
          {copy.mismatch}
        </p>
      )}

      {message.length > 0 ? <p className="mt-4 text-sm text-muted">{message}</p> : null}
    </section>
  );
}
