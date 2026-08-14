"use client";

import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactElement,
} from "react";
import {
  getTripSession,
  sendTripMagicLink,
  signInTripWithGoogle,
  signOutTrip,
} from "../trips/auth-client";
import {
  discardQueuedCloudTripUpdate,
  flushQueuedCloudTripUpdate,
  queueCloudTripUpdate,
  shouldQueueCloudWrite,
} from "../trips/cloud-offline-sync";
import {
  CloudTripError,
  applyCloudTripReplan,
  createCloudTrip,
  listCloudTripRevisions,
  listCloudTrips,
  readCloudMetadata,
  readCloudTrip,
  readTripApiHealth,
  restoreCloudTripRevision,
  updateCloudTrip,
  writeCloudMetadata,
  type CloudTripMetadata,
  type CloudTripRevision,
  type CloudTripSummary,
  type TripAccessRole,
  type TripApiHealth,
} from "../trips/cloud-sync";
import { normalizeWorkspace, type TripWorkspace } from "../trips/workspace";
import { TripCollaborationPanel } from "./TripCollaborationPanel";
import { TripReplanPanel } from "./TripReplanPanel";
import { TripTodayPanel } from "./TripTodayPanel";
import { TripWeatherIntelligencePanel } from "./TripWeatherIntelligencePanel";

export type CloudTripLocale = "en" | "zh-cn" | "zh-hant";

type SyncState = "device" | "auth-required" | "saving" | "saved" | "offline" | "conflict";

interface CloudTripControlsProps {
  readonly locale: CloudTripLocale;
  readonly workspace: TripWorkspace;
  readonly onRemoteWorkspace: (workspace: TripWorkspace) => void;
  readonly onAccessRole?: (role: TripAccessRole | null) => void;
}

const COPY = {
  en: {
    label: "Cloud trip",
    device: "Saved on this device",
    authRequired: "Sign in to protect this trip",
    saving: "Saving to cloud…",
    saved: "Saved to cloud",
    viewerSaved: "Shared with you · read only",
    offline: "Cloud unavailable · local copy is safe",
    conflict: "Another collaborator updated this trip",
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
    owner: "Owner",
    editor: "Editor",
    viewer: "Viewer",
    history: "Revision history",
    hideHistory: "Hide history",
    noHistory: "No revision history yet.",
    version: "Version",
    restoreVersion: "Restore",
    restoreConfirm: "Restore this revision as a new latest version?",
    restored: "Revision restored as a new cloud version.",
  },
  "zh-cn": {
    label: "云端行程",
    device: "仅保存在此设备",
    authRequired: "登录后可保护并跨设备同步",
    saving: "正在保存到云端…",
    saved: "已保存到云端",
    viewerSaved: "协作行程 · 仅查看",
    offline: "云端暂不可用 · 本地副本仍安全",
    conflict: "其他协作者刚刚更新了这份行程",
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
    owner: "所有者",
    editor: "可编辑",
    viewer: "仅查看",
    history: "版本历史",
    hideHistory: "收起历史",
    noHistory: "还没有版本历史。",
    version: "版本",
    restoreVersion: "恢复此版本",
    restoreConfirm: "将这个历史版本恢复为新的最新版本吗？",
    restored: "历史版本已恢复为新的云端版本。",
  },
  "zh-hant": {
    label: "雲端行程",
    device: "僅保存在此裝置",
    authRequired: "登入後可保護並跨裝置同步",
    saving: "正在儲存到雲端…",
    saved: "已儲存到雲端",
    viewerSaved: "協作行程 · 僅查看",
    offline: "雲端暫不可用 · 本機副本仍安全",
    conflict: "其他協作者剛剛更新了這份行程",
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
    owner: "擁有者",
    editor: "可編輯",
    viewer: "僅查看",
    history: "版本歷史",
    hideHistory: "收起歷史",
    noHistory: "還沒有版本歷史。",
    version: "版本",
    restoreVersion: "恢復此版本",
    restoreConfirm: "將這個歷史版本恢復為新的最新版本嗎？",
    restored: "歷史版本已恢復為新的雲端版本。",
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
  onAccessRole,
}: CloudTripControlsProps): ReactElement {
  const copy = COPY[locale];
  const workspaceRef = useRef(workspace);
  const [health, setHealth] = useState<TripApiHealth | null>(null);
  const [signedInEmail, setSignedInEmail] = useState<string | null>(null);
  const [metadata, setMetadata] = useState<CloudTripMetadata | null>(null);
  const [recent, setRecent] = useState<CloudTripSummary | null>(null);
  const [accessRole, setAccessRole] = useState<TripAccessRole | null>(null);
  const [syncState, setSyncState] = useState<SyncState>("device");
  const [showAuth, setShowAuth] = useState(false);
  const [showHistory, setShowHistory] = useState(false);
  const [revisions, setRevisions] = useState<ReadonlyArray<CloudTripRevision>>([]);
  const [historyLoading, setHistoryLoading] = useState(false);
  const [email, setEmail] = useState("");
  const [message, setMessage] = useState("");

  useEffect(() => {
    workspaceRef.current = workspace;
  }, [workspace]);

  const applyAccessRole = useCallback(
    (role: TripAccessRole | null): void => {
      setAccessRole(role);
      onAccessRole?.(role);
    },
    [onAccessRole],
  );

  const persistRemote = useCallback(
    (remote: {
      readonly id: string;
      readonly version: number;
      readonly updatedAt: string;
      readonly accessRole: TripAccessRole;
      readonly document: TripWorkspace;
    }): void => {
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
      applyAccessRole(remote.accessRole);
    },
    [applyAccessRole, onRemoteWorkspace],
  );

  const refreshIdentity = useCallback(async (): Promise<void> => {
    try {
      const [healthResult, user] = await Promise.all([readTripApiHealth(), getTripSession()]);
      setHealth(healthResult);
      setSignedInEmail(user?.email ?? null);
      const localMetadata = readCloudMetadata();
      setMetadata(localMetadata);
      if (user === null) {
        applyAccessRole(null);
        setSyncState(localMetadata === null ? "device" : "auth-required");
        return;
      }
      if (localMetadata !== null) {
        const queued = await flushQueuedCloudTripUpdate(localMetadata);
        if (queued.status === "conflict") {
          setSyncState("conflict");
          return;
        }
        if (queued.status === "failed") {
          setSyncState("offline");
          return;
        }
        if (queued.status === "synced" && queued.remote !== null) {
          persistRemote(queued.remote);
          setSyncState("saved");
          return;
        }
        try {
          const remote = await readCloudTrip(localMetadata.cloudTripId);
          applyAccessRole(remote.accessRole);
          const localChanged = !sameDocument(workspaceRef.current, localMetadata.localDocument);
          if (
            remote.accessRole !== "viewer" &&
            remote.version > localMetadata.lastSyncedVersion &&
            localChanged
          ) {
            setSyncState("conflict");
            return;
          }
          if (remote.accessRole === "viewer" || remote.version > localMetadata.lastSyncedVersion) {
            persistRemote(remote);
          }
          setSyncState("saved");
          return;
        } catch {
          applyAccessRole(null);
          setSyncState("offline");
          return;
        }
      }
      const trips = await listCloudTrips();
      setRecent(trips[0] ?? null);
      applyAccessRole(null);
      setSyncState("device");
    } catch {
      setHealth(null);
      applyAccessRole(null);
      setSyncState("offline");
    }
  }, [applyAccessRole, persistRemote]);

  useEffect(() => {
    void refreshIdentity();
  }, [refreshIdentity]);

  useEffect(() => {
    const handleOnline = (): void => {
      void refreshIdentity();
    };
    window.addEventListener("online", handleOnline);
    return () => window.removeEventListener("online", handleOnline);
  }, [refreshIdentity]);

  useEffect(() => {
    if (
      signedInEmail === null ||
      metadata === null ||
      syncState === "conflict" ||
      syncState === "saving" ||
      accessRole === "viewer"
    ) {
      return;
    }
    if (sameDocument(workspace, metadata.localDocument)) return;

    if (syncState === "offline") {
      const queueTimer = window.setTimeout(() => {
        void queueCloudTripUpdate(metadata, workspace, locale);
      }, 900);
      return () => window.clearTimeout(queueTimer);
    }

    const timer = window.setTimeout(() => {
      setSyncState("saving");
      void updateCloudTrip(metadata.cloudTripId, metadata.lastSyncedVersion, workspace, locale)
        .then(async (remote) => {
          await discardQueuedCloudTripUpdate(metadata.cloudTripId);
          const next = {
            cloudTripId: remote.id,
            lastSyncedVersion: remote.version,
            lastSyncedAt: remote.updatedAt,
            localDocument: workspace,
          } satisfies CloudTripMetadata;
          writeCloudMetadata(next);
          setMetadata(next);
          applyAccessRole(remote.accessRole);
          setSyncState("saved");
        })
        .catch(async (error: unknown) => {
          if (error instanceof CloudTripError && error.status === 409) {
            setSyncState("conflict");
          } else if (error instanceof CloudTripError && error.status === 403) {
            applyAccessRole("viewer");
            setSyncState("saved");
          } else {
            if (shouldQueueCloudWrite(error)) {
              await queueCloudTripUpdate(metadata, workspace, locale);
            }
            setSyncState("offline");
          }
        });
    }, 900);
    return () => window.clearTimeout(timer);
  }, [accessRole, applyAccessRole, locale, metadata, signedInEmail, syncState, workspace]);

  useEffect(() => {
    if (accessRole !== "viewer" || metadata === null) return;
    if (sameDocument(workspace, metadata.localDocument)) return;
    onRemoteWorkspace(normalizeWorkspace(metadata.localDocument));
  }, [accessRole, metadata, onRemoteWorkspace, workspace]);

  const saveToCloud = useCallback(async (): Promise<void> => {
    if (signedInEmail === null) {
      setShowAuth(true);
      setSyncState("auth-required");
      return;
    }
    setSyncState("saving");
    try {
      const remote = await createCloudTrip(workspace, locale);
      persistRemote(remote);
      setRecent(null);
      setSyncState("saved");
    } catch {
      setSyncState("offline");
    }
  }, [locale, persistRemote, signedInEmail, workspace]);

  const restoreRecent = useCallback(async (): Promise<void> => {
    if (recent === null) return;
    try {
      setSyncState("saving");
      const remote = await readCloudTrip(recent.id);
      persistRemote(remote);
      setRecent(null);
      setSyncState("saved");
    } catch {
      setSyncState("offline");
    }
  }, [persistRemote, recent]);

  const loadLatest = useCallback(async (): Promise<void> => {
    if (metadata === null) return;
    try {
      await discardQueuedCloudTripUpdate(metadata.cloudTripId);
      const remote = await readCloudTrip(metadata.cloudTripId);
      persistRemote(remote);
      setSyncState("saved");
    } catch {
      setSyncState("offline");
    }
  }, [metadata, persistRemote]);

  const applyReplan = useCallback(
    async (
      proposedWorkspace: TripWorkspace,
      weatherSnapshotId: string,
      selectedChangeIds: ReadonlyArray<string>,
    ): Promise<void> => {
      if (
        metadata === null ||
        signedInEmail === null ||
        accessRole === null ||
        accessRole === "viewer"
      ) {
        throw new Error("REPLAN_APPLY_UNAVAILABLE");
      }
      setSyncState("saving");
      try {
        const remote = await applyCloudTripReplan(
          metadata.cloudTripId,
          metadata.lastSyncedVersion,
          proposedWorkspace,
          locale,
          weatherSnapshotId,
          selectedChangeIds,
        );
        persistRemote(remote);
        setSyncState("saved");
      } catch (error: unknown) {
        if (error instanceof CloudTripError && error.status === 409) {
          setSyncState("conflict");
        } else if (error instanceof CloudTripError && error.status === 403) {
          applyAccessRole("viewer");
          setSyncState("saved");
        } else {
          setSyncState("offline");
        }
        throw error;
      }
    },
    [accessRole, applyAccessRole, locale, metadata, persistRemote, signedInEmail],
  );

  const loadHistory = useCallback(async (): Promise<void> => {
    if (metadata === null) return;
    const nextShow = !showHistory;
    setShowHistory(nextShow);
    if (!nextShow) return;
    setHistoryLoading(true);
    try {
      setRevisions(await listCloudTripRevisions(metadata.cloudTripId));
    } catch {
      setMessage(copy.unavailable);
    } finally {
      setHistoryLoading(false);
    }
  }, [copy.unavailable, metadata, showHistory]);

  const restoreRevision = useCallback(
    async (targetVersion: number): Promise<void> => {
      if (metadata === null || accessRole === "viewer") return;
      if (!window.confirm(copy.restoreConfirm)) return;
      setSyncState("saving");
      try {
        const remote = await restoreCloudTripRevision(
          metadata.cloudTripId,
          targetVersion,
          metadata.lastSyncedVersion,
        );
        persistRemote(remote);
        setRevisions(await listCloudTripRevisions(metadata.cloudTripId));
        setMessage(copy.restored);
        setSyncState("saved");
      } catch (error: unknown) {
        if (error instanceof CloudTripError && error.status === 409) {
          setSyncState("conflict");
        } else {
          setSyncState("offline");
        }
      }
    },
    [accessRole, copy.restoreConfirm, copy.restored, metadata, persistRemote],
  );

  const startGoogle = useCallback(async (): Promise<void> => {
    await signInTripWithGoogle(`${window.location.origin}${workspacePath(locale)}`);
  }, [locale]);

  const sendEmail = useCallback(async (): Promise<void> => {
    if (email.trim().length === 0) return;
    const result = await sendTripMagicLink(
      email.trim(),
      `${window.location.origin}${workspacePath(locale)}`,
    );
    setMessage(result.ok ? copy.emailSent : (result.message ?? "SIGN_IN_FAILED"));
  }, [copy.emailSent, email, locale]);

  const signOut = useCallback(async (): Promise<void> => {
    await signOutTrip();
    setSignedInEmail(null);
    applyAccessRole(null);
    setSyncState(metadata === null ? "device" : "auth-required");
  }, [applyAccessRole, metadata]);

  const roleCopy = useMemo(() => {
    if (accessRole === "owner") return copy.owner;
    if (accessRole === "editor") return copy.editor;
    if (accessRole === "viewer") return copy.viewer;
    return null;
  }, [accessRole, copy.editor, copy.owner, copy.viewer]);

  const stateCopy = useMemo(() => {
    if (accessRole === "viewer" && syncState === "saved") return copy.viewerSaved;
    if (syncState === "saving") return copy.saving;
    if (syncState === "saved") return copy.saved;
    if (syncState === "offline") return copy.offline;
    if (syncState === "conflict") return copy.conflict;
    if (syncState === "auth-required") return copy.authRequired;
    return copy.device;
  }, [accessRole, copy, syncState]);

  const providersAvailable = health?.providers.google === true || health?.providers.email === true;

  return (
    <section
      className="info-panel mt-5"
      aria-label={copy.label}
      data-cloud-access-role={accessRole ?? "local"}
    >
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <p className="eyebrow">{copy.label}</p>
          <p className="mt-2 text-sm font-bold text-foreground">{stateCopy}</p>
          <p className="mt-1 text-xs leading-5 text-muted">
            {signedInEmail === null ? copy.localOnly : `${copy.signedIn}: ${signedInEmail}`}
            {roleCopy === null ? "" : ` · ${roleCopy}`}
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          {metadata === null ? (
            <button
              type="button"
              className="trip-primary-button"
              onClick={() => void saveToCloud()}
            >
              {copy.save}
            </button>
          ) : null}
          {metadata !== null && signedInEmail !== null ? (
            <button
              type="button"
              className="trip-secondary-button"
              onClick={() => void loadHistory()}
            >
              {showHistory ? copy.hideHistory : copy.history}
            </button>
          ) : null}
          {signedInEmail === null ? (
            <button
              type="button"
              className="trip-secondary-button"
              onClick={() => setShowAuth(true)}
            >
              {copy.signIn}
            </button>
          ) : (
            <button type="button" className="trip-secondary-button" onClick={() => void signOut()}>
              {copy.signOut}
            </button>
          )}
          {syncState === "conflict" ? (
            <button
              type="button"
              className="trip-secondary-button"
              onClick={() => void loadLatest()}
            >
              {copy.latest}
            </button>
          ) : null}
        </div>
      </div>

      {showHistory && metadata !== null ? (
        <div
          className="mt-4 rounded-xl border border-border/80 bg-surface-elevated p-4"
          data-trip-revisions="visible"
        >
          <h3 className="text-sm font-bold text-foreground">{copy.history}</h3>
          <div className="mt-3 grid gap-2">
            {historyLoading ? (
              <p className="text-xs text-muted">{copy.history}…</p>
            ) : revisions.length === 0 ? (
              <p className="text-xs text-muted">{copy.noHistory}</p>
            ) : (
              revisions.map((revision) => (
                <div
                  key={revision.version}
                  className="flex flex-wrap items-center justify-between gap-3 rounded-xl bg-white p-3"
                >
                  <div>
                    <p className="text-sm font-semibold text-foreground">
                      {copy.version} {revision.version}
                    </p>
                    <p className="mt-1 text-xs text-muted">
                      {revision.operation} · {new Date(revision.createdAt).toLocaleString()}
                    </p>
                  </div>
                  {accessRole !== "viewer" && revision.version !== metadata.lastSyncedVersion ? (
                    <button
                      type="button"
                      className="trip-secondary-button"
                      onClick={() => void restoreRevision(revision.version)}
                    >
                      {copy.restoreVersion}
                    </button>
                  ) : null}
                </div>
              ))
            )}
          </div>
        </div>
      ) : null}

      <TripTodayPanel
        locale={locale}
        workspace={workspace}
        cloudTripId={metadata?.cloudTripId ?? null}
      />

      <TripReplanPanel
        locale={locale}
        workspace={workspace}
        cloudReady={metadata !== null && signedInEmail !== null}
        canApply={
          metadata !== null &&
          signedInEmail !== null &&
          accessRole !== null &&
          accessRole !== "viewer"
        }
        onApply={applyReplan}
      />

      {metadata !== null && signedInEmail !== null && accessRole !== null ? (
        <TripWeatherIntelligencePanel
          locale={locale}
          tripId={metadata.cloudTripId}
          accessRole={accessRole}
        />
      ) : null}

      {metadata !== null && signedInEmail !== null && accessRole !== null ? (
        <TripCollaborationPanel
          locale={locale}
          tripId={metadata.cloudTripId}
          accessRole={accessRole}
          workspace={workspace}
          currentVersion={metadata.lastSyncedVersion}
        />
      ) : null}

      {recent !== null && metadata === null && signedInEmail !== null ? (
        <div className="mt-4 flex flex-col gap-3 rounded-xl border border-border/80 bg-surface-elevated p-4 sm:flex-row sm:items-center sm:justify-between">
          <p className="text-sm text-foreground">
            {copy.restorePrefix}: <strong>{recent.title}</strong>
          </p>
          <button
            type="button"
            className="trip-secondary-button"
            onClick={() => void restoreRecent()}
          >
            {copy.restore}
          </button>
        </div>
      ) : null}

      {showAuth && signedInEmail === null ? (
        <div className="mt-4 rounded-xl border border-border/80 bg-surface-elevated p-4">
          {providersAvailable ? (
            <div className="grid gap-3 sm:grid-cols-2">
              {health?.providers.google ? (
                <button
                  type="button"
                  className="trip-primary-button"
                  onClick={() => void startGoogle()}
                >
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
                  <button
                    type="button"
                    className="trip-secondary-button"
                    onClick={() => void sendEmail()}
                  >
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
      ) : message.length > 0 ? (
        <p className="mt-3 text-xs text-muted">{message}</p>
      ) : null}
    </section>
  );
}
