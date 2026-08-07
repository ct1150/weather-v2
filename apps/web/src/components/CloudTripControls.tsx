"use client";

import { useCallback, useEffect, useMemo, useState, type ReactElement } from "react";
import { tripAuthClient } from "../trips/auth-client";
import {
  CloudTripError,
  createCloudTrip,
  listCloudTrips,
  readCloudMetadata,
  readCloudTrip,
  readTripApiHealth,
  updateCloudTrip,
  writeCloudMetadata,
  type CloudTripMetadata,
  type CloudTripSummary,
  type TripApiHealth,
} from "../trips/cloud-sync";
import { normalizeWorkspace, type TripWorkspace } from "../trips/workspace";

export type CloudTripLocale = "en" | "zh-cn" | "zh-hant";

type SyncState = "device" | "auth-required" | "saving" | "saved" | "offline" | "conflict";

interface CloudTripControlsProps {
  readonly locale: CloudTripLocale;
  readonly workspace: TripWorkspace;
  readonly onRemoteWorkspace: (workspace: TripWorkspace) => void;
}

const COPY = {
  en: {
    label: "Cloud trip",
    device: "Saved on this device",
    authRequired: "Sign in to protect this trip",
    saving: "Saving to cloud…",
    saved: "Saved to cloud",
    offline: "Cloud unavailable · local copy is safe",
    conflict: "Another device updated this trip",
    save: "Save to cloud",
    signIn: "Sign in",
    google: "Continue with Google",
    emailPlaceholder: "you@example.com",
    email: "Email me a sign-in link",
    emailSent: "Sign-in link sent. Check your email.",
    unavailable: "Cloud sign-in is not configured yet. Your trip remains safe on this device.",
    restore: "Open latest cloud trip",
    restorePrefix: "Cloud trip available",
    latest: "Load cloud version",
    signOut: "Sign out",
    signedIn: "Signed in",
    localOnly: "Nothing is uploaded until you choose Save to cloud.",
  },
  "zh-cn": {
    label: "云端行程",
    device: "仅保存在此设备",
    authRequired: "登录后可保护并跨设备同步",
    saving: "正在保存到云端…",
    saved: "已保存到云端",
    offline: "云端暂不可用 · 本地副本仍安全",
    conflict: "其他设备刚刚更新了这份行程",
    save: "保存到云端",
    signIn: "登录",
    google: "使用 Google 继续",
    emailPlaceholder: "你的邮箱",
    email: "发送登录链接",
    emailSent: "登录链接已发送，请检查邮箱。",
    unavailable: "云端登录尚未配置，你的行程仍安全保存在此设备。",
    restore: "打开最近的云端行程",
    restorePrefix: "发现云端行程",
    latest: "载入云端最新版本",
    signOut: "退出登录",
    signedIn: "已登录",
    localOnly: "只有你主动点击“保存到云端”后，本地行程才会上传。",
  },
  "zh-hant": {
    label: "雲端行程",
    device: "僅保存在此裝置",
    authRequired: "登入後可保護並跨裝置同步",
    saving: "正在儲存到雲端…",
    saved: "已儲存到雲端",
    offline: "雲端暫不可用 · 本機副本仍安全",
    conflict: "其他裝置剛剛更新了這份行程",
    save: "儲存到雲端",
    signIn: "登入",
    google: "使用 Google 繼續",
    emailPlaceholder: "你的電子郵件",
    email: "傳送登入連結",
    emailSent: "登入連結已傳送，請檢查郵件。",
    unavailable: "雲端登入尚未設定，你的行程仍安全保存在此裝置。",
    restore: "開啟最近的雲端行程",
    restorePrefix: "發現雲端行程",
    latest: "載入雲端最新版本",
    signOut: "登出",
    signedIn: "已登入",
    localOnly: "只有你主動點擊「儲存到雲端」後，本機行程才會上傳。",
  },
} as const;

function workspacePath(locale: CloudTripLocale): string {
  return locale === "en" ? "/trips/workspace" : `/${locale}/trips/workspace`;
}

function sameDocument(left: TripWorkspace, right: TripWorkspace): boolean {
  return JSON.stringify(left) === JSON.stringify(right);
}

export function CloudTripControls({
  locale,
  workspace,
  onRemoteWorkspace,
}: CloudTripControlsProps): ReactElement {
  const copy = COPY[locale];
  const [health, setHealth] = useState<TripApiHealth | null>(null);
  const [signedInEmail, setSignedInEmail] = useState<string | null>(null);
  const [metadata, setMetadata] = useState<CloudTripMetadata | null>(null);
  const [recent, setRecent] = useState<CloudTripSummary | null>(null);
  const [syncState, setSyncState] = useState<SyncState>("device");
  const [showAuth, setShowAuth] = useState(false);
  const [email, setEmail] = useState("");
  const [message, setMessage] = useState("");

  const refreshIdentity = useCallback(async (): Promise<void> => {
    try {
      const [healthResult, sessionResult] = await Promise.all([
        readTripApiHealth(),
        tripAuthClient.getSession(),
      ]);
      setHealth(healthResult);
      const user = sessionResult.data?.user;
      setSignedInEmail(user?.email ?? null);
      const localMetadata = readCloudMetadata();
      setMetadata(localMetadata);
      if (user === undefined || user === null) {
        setSyncState(localMetadata === null ? "device" : "auth-required");
        return;
      }
      if (localMetadata !== null) {
        try {
          const remote = await readCloudTrip(localMetadata.cloudTripId);
          if (remote.version > localMetadata.lastSyncedVersion) {
            const normalized = normalizeWorkspace(remote.document);
            onRemoteWorkspace(normalized);
            const next = {
              cloudTripId: remote.id,
              lastSyncedVersion: remote.version,
              lastSyncedAt: remote.updatedAt,
              localDocument: normalized,
            } satisfies CloudTripMetadata;
            writeCloudMetadata(next);
            setMetadata(next);
          }
          setSyncState("saved");
          return;
        } catch {
          setSyncState("offline");
        }
      }
      const trips = await listCloudTrips();
      setRecent(trips[0] ?? null);
      setSyncState("device");
    } catch {
      setHealth(null);
      setSyncState("offline");
    }
  }, [onRemoteWorkspace]);

  useEffect(() => {
    void refreshIdentity();
  }, [refreshIdentity]);

  useEffect(() => {
    if (signedInEmail === null || metadata === null || syncState === "conflict") return;
    if (sameDocument(workspace, metadata.localDocument)) return;
    const timer = window.setTimeout(() => {
      setSyncState("saving");
      void updateCloudTrip(
        metadata.cloudTripId,
        metadata.lastSyncedVersion,
        workspace,
        locale,
      )
        .then((remote) => {
          const next = {
            cloudTripId: remote.id,
            lastSyncedVersion: remote.version,
            lastSyncedAt: remote.updatedAt,
            localDocument: workspace,
          } satisfies CloudTripMetadata;
          writeCloudMetadata(next);
          setMetadata(next);
          setSyncState("saved");
        })
        .catch((error: unknown) => {
          if (error instanceof CloudTripError && error.status === 409) {
            setSyncState("conflict");
          } else {
            setSyncState("offline");
          }
        });
    }, 900);
    return () => window.clearTimeout(timer);
  }, [locale, metadata, signedInEmail, syncState, workspace]);

  const saveToCloud = useCallback(async (): Promise<void> => {
    if (signedInEmail === null) {
      setShowAuth(true);
      setSyncState("auth-required");
      return;
    }
    setSyncState("saving");
    try {
      const remote = await createCloudTrip(workspace, locale);
      const next = {
        cloudTripId: remote.id,
        lastSyncedVersion: remote.version,
        lastSyncedAt: remote.updatedAt,
        localDocument: workspace,
      } satisfies CloudTripMetadata;
      writeCloudMetadata(next);
      setMetadata(next);
      setRecent(null);
      setSyncState("saved");
    } catch {
      setSyncState("offline");
    }
  }, [locale, signedInEmail, workspace]);

  const restoreRecent = useCallback(async (): Promise<void> => {
    if (recent === null) return;
    try {
      setSyncState("saving");
      const remote = await readCloudTrip(recent.id);
      const normalized = normalizeWorkspace(remote.document);
      onRemoteWorkspace(normalized);
      const next = {
        cloudTripId: remote.id,
        lastSyncedVersion: remote.version,
        lastSyncedAt: remote.updatedAt,
        localDocument: normalized,
      } satisfies CloudTripMetadata;
      writeCloudMetadata(next);
      setMetadata(next);
      setRecent(null);
      setSyncState("saved");
    } catch {
      setSyncState("offline");
    }
  }, [onRemoteWorkspace, recent]);

  const loadLatest = useCallback(async (): Promise<void> => {
    if (metadata === null) return;
    try {
      const remote = await readCloudTrip(metadata.cloudTripId);
      const normalized = normalizeWorkspace(remote.document);
      onRemoteWorkspace(normalized);
      const next = {
        cloudTripId: remote.id,
        lastSyncedVersion: remote.version,
        lastSyncedAt: remote.updatedAt,
        localDocument: normalized,
      } satisfies CloudTripMetadata;
      writeCloudMetadata(next);
      setMetadata(next);
      setSyncState("saved");
    } catch {
      setSyncState("offline");
    }
  }, [metadata, onRemoteWorkspace]);

  const startGoogle = useCallback(async (): Promise<void> => {
    await tripAuthClient.signIn.social({
      provider: "google",
      callbackURL: `${window.location.origin}${workspacePath(locale)}`,
    });
  }, [locale]);

  const sendEmail = useCallback(async (): Promise<void> => {
    if (email.trim().length === 0) return;
    const result = await tripAuthClient.signIn.magicLink({
      email: email.trim(),
      callbackURL: `${window.location.origin}${workspacePath(locale)}`,
    });
    setMessage(result.error ? result.error.message ?? String(result.error.code) : copy.emailSent);
  }, [copy.emailSent, email, locale]);

  const signOut = useCallback(async (): Promise<void> => {
    await tripAuthClient.signOut();
    setSignedInEmail(null);
    setSyncState(metadata === null ? "device" : "auth-required");
  }, [metadata]);

  const stateCopy = useMemo(() => {
    if (syncState === "saving") return copy.saving;
    if (syncState === "saved") return copy.saved;
    if (syncState === "offline") return copy.offline;
    if (syncState === "conflict") return copy.conflict;
    if (syncState === "auth-required") return copy.authRequired;
    return copy.device;
  }, [copy, syncState]);

  const providersAvailable = health?.providers.google === true || health?.providers.email === true;

  return (
    <section className="info-panel mt-5" aria-label={copy.label}>
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <p className="eyebrow">{copy.label}</p>
          <p className="mt-2 text-sm font-bold text-foreground">{stateCopy}</p>
          <p className="mt-1 text-xs leading-5 text-muted">
            {signedInEmail === null ? copy.localOnly : `${copy.signedIn}: ${signedInEmail}`}
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          {metadata === null ? (
            <button type="button" className="trip-primary-button" onClick={() => void saveToCloud()}>
              {copy.save}
            </button>
          ) : null}
          {signedInEmail === null ? (
            <button type="button" className="trip-secondary-button" onClick={() => setShowAuth(true)}>
              {copy.signIn}
            </button>
          ) : (
            <button type="button" className="trip-secondary-button" onClick={() => void signOut()}>
              {copy.signOut}
            </button>
          )}
          {syncState === "conflict" ? (
            <button type="button" className="trip-secondary-button" onClick={() => void loadLatest()}>
              {copy.latest}
            </button>
          ) : null}
        </div>
      </div>

      {recent !== null && metadata === null && signedInEmail !== null ? (
        <div className="mt-4 flex flex-col gap-3 rounded-xl border border-border/80 bg-surface-elevated p-4 sm:flex-row sm:items-center sm:justify-between">
          <p className="text-sm text-foreground">
            {copy.restorePrefix}: <strong>{recent.title}</strong>
          </p>
          <button type="button" className="trip-secondary-button" onClick={() => void restoreRecent()}>
            {copy.restore}
          </button>
        </div>
      ) : null}

      {showAuth && signedInEmail === null ? (
        <div className="mt-4 rounded-xl border border-border/80 bg-surface-elevated p-4">
          {providersAvailable ? (
            <div className="grid gap-3 sm:grid-cols-2">
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
            <p className="text-sm leading-6 text-muted">{copy.unavailable}</p>
          )}
          {message.length > 0 ? <p className="mt-3 text-xs text-muted">{message}</p> : null}
        </div>
      ) : null}
    </section>
  );
}
