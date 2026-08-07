"use client";

import { useCallback, useEffect, useMemo, useState, type ReactElement } from "react";
import {
  getTripSession,
  sendTripMagicLink,
  signInTripWithGoogle,
  signOutTrip,
} from "../trips/auth-client";
import {
  clearCloudMetadata,
  createCloudTripShare,
  deleteCloudTrip,
  listCloudTrips,
  readCloudMetadata,
  readCloudTrip,
  readTripApiHealth,
  revokeCloudTripShare,
  updateCloudTripStatus,
  writeCloudMetadata,
  type CloudTripSummary,
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
    eyebrow: "My Trips",
    title: "Your cloud trips, in one place",
    subtitle: "Open, archive, share or remove trips without losing the local-first workspace.",
    signInTitle: "Sign in to see My Trips",
    signInBody:
      "Trip planning still works without an account. Sign in only when you want cloud storage and cross-device access.",
    signIn: "Sign in",
    google: "Continue with Google",
    emailPlaceholder: "you@example.com",
    email: "Email me a sign-in link",
    emailSent: "Sign-in link sent. Check your email.",
    unavailable:
      "Cloud sign-in providers are not configured yet. You can keep building trips locally.",
    active: "Active",
    archived: "Archived",
    emptyActive: "No active cloud trips yet.",
    emptyArchived: "No archived trips.",
    newTrip: "New trip",
    importTrip: "Import itinerary",
    open: "Open",
    share: "Create new share link",
    revoke: "Revoke current share",
    archive: "Archive",
    restore: "Restore",
    delete: "Delete",
    deleteConfirm:
      "Delete this cloud trip? Your current local workspace will be kept unless it is linked to this trip.",
    sharedCopied: "New read-only share link copied to clipboard.",
    sharedReady: "New read-only share link is ready.",
    revoked: "Current share link revoked.",
    signedIn: "Signed in",
    signOut: "Sign out",
    updated: "Updated",
    version: "Cloud version",
    noDates: "Dates not set",
    loading: "Loading cloud trips…",
    conflict: "This trip changed on another device. Refresh My Trips and try again.",
    error: "Cloud trips are temporarily unavailable. Your local trips are unaffected.",
  },
  "zh-cn": {
    eyebrow: "我的行程",
    title: "集中管理你的云端行程",
    subtitle: "打开、归档、分享或删除行程，同时继续使用本地优先的工作台。",
    signInTitle: "登录后查看“我的行程”",
    signInBody: "不登录也能继续规划；只有需要云端保存和跨设备访问时才需要登录。",
    signIn: "登录",
    google: "使用 Google 继续",
    emailPlaceholder: "你的邮箱",
    email: "发送登录链接",
    emailSent: "登录链接已发送，请检查邮箱。",
    unavailable: "云端登录方式尚未配置，你仍可继续在本机建立行程。",
    active: "进行中",
    archived: "已归档",
    emptyActive: "还没有云端行程。",
    emptyArchived: "没有已归档行程。",
    newTrip: "新建行程",
    importTrip: "导入行程",
    open: "打开",
    share: "生成新分享链接",
    revoke: "撤销当前分享",
    archive: "归档",
    restore: "恢复",
    delete: "删除",
    deleteConfirm: "确定删除这份云端行程吗？如果当前本地工作台正关联这份行程，会解除云端关联。",
    sharedCopied: "新的只读分享链接已复制。",
    sharedReady: "新的只读分享链接已生成。",
    revoked: "当前分享链接已撤销。",
    signedIn: "已登录",
    signOut: "退出登录",
    updated: "更新于",
    version: "云端版本",
    noDates: "未设置日期",
    loading: "正在加载云端行程…",
    conflict: "这份行程已在其他设备更新，请刷新“我的行程”后重试。",
    error: "云端行程暂不可用，本地行程不受影响。",
  },
  "zh-hant": {
    eyebrow: "我的行程",
    title: "集中管理你的雲端行程",
    subtitle: "開啟、封存、分享或刪除行程，同時繼續使用本機優先的工作台。",
    signInTitle: "登入後查看「我的行程」",
    signInBody: "不登入也能繼續規劃；只有需要雲端儲存和跨裝置存取時才需要登入。",
    signIn: "登入",
    google: "使用 Google 繼續",
    emailPlaceholder: "你的電子郵件",
    email: "傳送登入連結",
    emailSent: "登入連結已傳送，請檢查郵件。",
    unavailable: "雲端登入方式尚未設定，你仍可繼續在本機建立行程。",
    active: "進行中",
    archived: "已封存",
    emptyActive: "還沒有雲端行程。",
    emptyArchived: "沒有已封存行程。",
    newTrip: "新增行程",
    importTrip: "匯入行程",
    open: "開啟",
    share: "產生新分享連結",
    revoke: "撤銷目前分享",
    archive: "封存",
    restore: "恢復",
    delete: "刪除",
    deleteConfirm: "確定刪除這份雲端行程嗎？如果目前本機工作台正關聯這份行程，會解除雲端關聯。",
    sharedCopied: "新的唯讀分享連結已複製。",
    sharedReady: "新的唯讀分享連結已產生。",
    revoked: "目前分享連結已撤銷。",
    signedIn: "已登入",
    signOut: "登出",
    updated: "更新於",
    version: "雲端版本",
    noDates: "未設定日期",
    loading: "正在載入雲端行程…",
    conflict: "這份行程已在其他裝置更新，請重新整理「我的行程」後再試。",
    error: "雲端行程暫時無法使用，本機行程不受影響。",
  },
} as const;

function tripsPath(locale: CloudTripLocale): string {
  return locale === "en" ? "/trips" : `/${locale}/trips`;
}

function workspacePath(locale: CloudTripLocale): string {
  return `${tripsPath(locale)}/workspace`;
}

function importPath(locale: CloudTripLocale): string {
  return `${tripsPath(locale)}/new`;
}

function sharePath(locale: CloudTripLocale): string {
  return `${tripsPath(locale)}/share`;
}

function displayDateRange(trip: CloudTripSummary, noDates: string): string {
  if (trip.startDate === null && trip.endDate === null) return noDates;
  if (trip.startDate === trip.endDate || trip.endDate === null) return trip.startDate ?? noDates;
  return `${trip.startDate ?? "?"} → ${trip.endDate}`;
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

export function MyTripsDashboard({ locale }: { readonly locale: CloudTripLocale }): ReactElement {
  const copy = COPY[locale];
  const [health, setHealth] = useState<TripApiHealth | null>(null);
  const [emailAddress, setEmailAddress] = useState<string | null>(null);
  const [email, setEmail] = useState("");
  const [showAuth, setShowAuth] = useState(false);
  const [trips, setTrips] = useState<ReadonlyArray<CloudTripSummary>>([]);
  const [tab, setTab] = useState<"active" | "archived">("active");
  const [loading, setLoading] = useState(true);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [message, setMessage] = useState("");
  const [shareUrl, setShareUrl] = useState<{
    readonly tripId: string;
    readonly url: string;
  } | null>(null);

  const refresh = useCallback(async (): Promise<void> => {
    setLoading(true);
    try {
      const [healthResult, session] = await Promise.all([readTripApiHealth(), getTripSession()]);
      setHealth(healthResult);
      setEmailAddress(session?.email ?? null);
      if (session === null) {
        setTrips([]);
        return;
      }
      setTrips(await listCloudTrips("all"));
    } catch {
      setHealth(null);
      setMessage(copy.error);
    } finally {
      setLoading(false);
    }
  }, [copy.error]);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  const visibleTrips = useMemo(() => trips.filter((trip) => trip.status === tab), [tab, trips]);
  const providerAvailable = health?.providers.google === true || health?.providers.email === true;

  const openTrip = useCallback(
    async (trip: CloudTripSummary): Promise<void> => {
      setBusyId(trip.id);
      setMessage("");
      try {
        const remote = await readCloudTrip(trip.id);
        persistOpenedTrip(remote);
        window.location.assign(workspacePath(locale));
      } catch {
        setMessage(copy.error);
        setBusyId(null);
      }
    },
    [copy.error, locale],
  );

  const changeStatus = useCallback(
    async (trip: CloudTripSummary): Promise<void> => {
      setBusyId(trip.id);
      setMessage("");
      try {
        const nextStatus = trip.status === "active" ? "archived" : "active";
        const updated = await updateCloudTripStatus(trip.id, trip.version, nextStatus);
        setTrips((current) => current.map((item) => (item.id === trip.id ? updated : item)));
      } catch (error: unknown) {
        setMessage(
          error instanceof Error && error.message === "VERSION_CONFLICT"
            ? copy.conflict
            : copy.error,
        );
      } finally {
        setBusyId(null);
      }
    },
    [copy.conflict, copy.error],
  );

  const removeTrip = useCallback(
    async (trip: CloudTripSummary): Promise<void> => {
      if (!window.confirm(copy.deleteConfirm)) return;
      setBusyId(trip.id);
      setMessage("");
      try {
        await deleteCloudTrip(trip.id);
        const metadata = readCloudMetadata();
        if (metadata?.cloudTripId === trip.id) clearCloudMetadata();
        setTrips((current) => current.filter((item) => item.id !== trip.id));
        setShareUrl((current) => (current?.tripId === trip.id ? null : current));
      } catch {
        setMessage(copy.error);
      } finally {
        setBusyId(null);
      }
    },
    [copy.deleteConfirm, copy.error],
  );

  const createShare = useCallback(
    async (trip: CloudTripSummary): Promise<void> => {
      setBusyId(trip.id);
      setMessage("");
      try {
        const share = await createCloudTripShare(trip.id);
        const url = `${window.location.origin}${sharePath(locale)}#token=${encodeURIComponent(share.token)}`;
        setShareUrl({ tripId: trip.id, url });
        try {
          await navigator.clipboard.writeText(url);
          setMessage(copy.sharedCopied);
        } catch {
          setMessage(copy.sharedReady);
        }
      } catch {
        setMessage(copy.error);
      } finally {
        setBusyId(null);
      }
    },
    [copy.error, copy.sharedCopied, copy.sharedReady, locale],
  );

  const revokeShare = useCallback(
    async (trip: CloudTripSummary): Promise<void> => {
      setBusyId(trip.id);
      setMessage("");
      try {
        await revokeCloudTripShare(trip.id);
        setShareUrl((current) => (current?.tripId === trip.id ? null : current));
        setMessage(copy.revoked);
      } catch {
        setMessage(copy.error);
      } finally {
        setBusyId(null);
      }
    },
    [copy.error, copy.revoked],
  );

  const startGoogle = useCallback(async (): Promise<void> => {
    await signInTripWithGoogle(`${window.location.origin}${tripsPath(locale)}`);
  }, [locale]);

  const sendEmail = useCallback(async (): Promise<void> => {
    if (email.trim().length === 0) return;
    const result = await sendTripMagicLink(
      email.trim(),
      `${window.location.origin}${tripsPath(locale)}`,
    );
    setMessage(result.ok ? copy.emailSent : (result.message ?? copy.error));
  }, [copy.emailSent, copy.error, email, locale]);

  const signOut = useCallback(async (): Promise<void> => {
    await signOutTrip();
    setEmailAddress(null);
    setTrips([]);
    setShareUrl(null);
  }, []);

  if (loading) {
    return (
      <section className="info-panel mb-8" aria-label={copy.eyebrow} data-my-trips="loading">
        <p className="eyebrow">{copy.eyebrow}</p>
        <p className="mt-3 text-sm text-muted">{copy.loading}</p>
      </section>
    );
  }

  if (emailAddress === null) {
    return (
      <section className="info-panel mb-8" aria-label={copy.eyebrow} data-my-trips="guest">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
          <div className="max-w-2xl">
            <p className="eyebrow">{copy.eyebrow}</p>
            <h2 className="mt-2 text-2xl font-bold text-foreground">{copy.signInTitle}</h2>
            <p className="mt-2 text-sm leading-6 text-muted">{copy.signInBody}</p>
          </div>
          <button type="button" className="trip-secondary-button" onClick={() => setShowAuth(true)}>
            {copy.signIn}
          </button>
        </div>
        {showAuth ? (
          <div className="mt-4 rounded-xl border border-border/80 bg-surface-elevated p-4">
            {providerAvailable ? (
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
          </div>
        ) : null}
        {message.length > 0 ? <p className="mt-3 text-xs text-muted">{message}</p> : null}
      </section>
    );
  }

  return (
    <section
      className="mb-10 rounded-[2rem] border border-border/80 bg-white p-5 shadow-sm sm:p-7"
      aria-label={copy.eyebrow}
      data-my-trips="authenticated"
    >
      <div className="flex flex-col gap-5 lg:flex-row lg:items-start lg:justify-between">
        <div>
          <p className="eyebrow">{copy.eyebrow}</p>
          <h2 className="mt-2 text-3xl font-bold tracking-[-0.035em] text-foreground">
            {copy.title}
          </h2>
          <p className="mt-2 max-w-2xl text-sm leading-6 text-muted">{copy.subtitle}</p>
          <p className="mt-3 text-xs text-muted">
            {copy.signedIn}: {emailAddress}
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <a className="trip-primary-button" href={`${workspacePath(locale)}?new=1`}>
            {copy.newTrip}
          </a>
          <a className="trip-secondary-button" href={importPath(locale)}>
            {copy.importTrip}
          </a>
          <button type="button" className="trip-secondary-button" onClick={() => void signOut()}>
            {copy.signOut}
          </button>
        </div>
      </div>

      <div className="mt-6 flex gap-2" role="tablist" aria-label={copy.eyebrow}>
        {(["active", "archived"] as const).map((value) => (
          <button
            key={value}
            type="button"
            role="tab"
            aria-selected={tab === value}
            className={tab === value ? "trip-primary-button" : "trip-secondary-button"}
            onClick={() => setTab(value)}
          >
            {value === "active" ? copy.active : copy.archived} (
            {trips.filter((trip) => trip.status === value).length})
          </button>
        ))}
      </div>

      <div className="mt-5 grid gap-4">
        {visibleTrips.length === 0 ? (
          <div className="trip-side-card text-sm text-muted">
            {tab === "active" ? copy.emptyActive : copy.emptyArchived}
          </div>
        ) : (
          visibleTrips.map((trip) => (
            <article key={trip.id} className="trip-process-card">
              <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
                <div>
                  <span>{displayDateRange(trip, copy.noDates)}</span>
                  <h3>{trip.title}</h3>
                  <p>
                    {copy.updated} {new Date(trip.updatedAt).toLocaleString()} · {copy.version}{" "}
                    {trip.version}
                  </p>
                </div>
                <div className="flex flex-wrap gap-2">
                  <button
                    type="button"
                    className="trip-primary-button"
                    disabled={busyId === trip.id}
                    onClick={() => void openTrip(trip)}
                  >
                    {copy.open}
                  </button>
                  <button
                    type="button"
                    className="trip-secondary-button"
                    disabled={busyId === trip.id}
                    onClick={() => void createShare(trip)}
                  >
                    {copy.share}
                  </button>
                  <button
                    type="button"
                    className="trip-secondary-button"
                    disabled={busyId === trip.id}
                    onClick={() => void revokeShare(trip)}
                  >
                    {copy.revoke}
                  </button>
                  <button
                    type="button"
                    className="trip-secondary-button"
                    disabled={busyId === trip.id}
                    onClick={() => void changeStatus(trip)}
                  >
                    {trip.status === "active" ? copy.archive : copy.restore}
                  </button>
                  <button
                    type="button"
                    className="trip-secondary-button"
                    disabled={busyId === trip.id}
                    onClick={() => void removeTrip(trip)}
                  >
                    {copy.delete}
                  </button>
                </div>
              </div>
              {shareUrl?.tripId === trip.id ? (
                <div className="mt-4 rounded-xl border border-border/80 bg-surface-elevated p-3">
                  <input
                    readOnly
                    value={shareUrl.url}
                    className="w-full bg-transparent text-xs text-muted outline-none"
                    aria-label={copy.share}
                  />
                </div>
              ) : null}
            </article>
          ))
        )}
      </div>

      {message.length > 0 ? <p className="mt-4 text-xs text-muted">{message}</p> : null}
    </section>
  );
}
