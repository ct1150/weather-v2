"use client";

import { useCallback, useMemo, useState, type ReactElement } from "react";
import {
  createCloudTripComment,
  createCloudTripDecision,
  deleteCloudTripComment,
  deleteCloudTripDecision,
  listCloudTripActivity,
  listCloudTripComments,
  listCloudTripDecisions,
  readCloudTripRevisionDiff,
  updateCloudTripDecisionStatus,
  type CloudTripActivity,
  type CloudTripComment,
  type CloudTripDecision,
  type CloudTripRevisionChange,
  type CloudTripRevisionDiff,
  type TripAccessRole,
} from "../trips/cloud-sync";
import type { TripWorkspace } from "../trips/workspace";
import type { CloudTripLocale } from "./CloudTripControls";

const COPY = {
  en: {
    open: "Collaboration",
    close: "Hide collaboration",
    intro: "See what changed, discuss context and keep explicit decisions separate from chat.",
    activity: "Activity",
    comments: "Discussion",
    decisions: "Decisions",
    refresh: "Refresh",
    loading: "Loading collaboration…",
    emptyActivity: "No collaboration activity yet.",
    emptyComments: "No comments yet.",
    emptyDecisions: "No decisions yet.",
    viewer: "Read only",
    commentPlaceholder: "Add context, a question or a suggestion…",
    addComment: "Add comment",
    dayContext: "Day context",
    wholeTrip: "Whole trip",
    revisionContext: "Current cloud version",
    decisionTitle: "Decision to make",
    decisionDetail: "Why this matters / what was agreed",
    addDecision: "Record decision",
    openDecision: "Open",
    resolvedDecision: "Resolved",
    resolve: "Resolve",
    reopen: "Reopen",
    delete: "Delete",
    deleteCommentConfirm: "Delete this comment from the shared trip?",
    deleteDecisionConfirm: "Delete this decision record from the shared trip?",
    changes: "View changes",
    hideChanges: "Hide changes",
    from: "From",
    to: "to",
    initial: "Initial version",
    noChanges: "No itinerary fields changed in this revision.",
    collaborator: "Collaborator",
    failed: "Collaboration data is temporarily unavailable.",
    addedComment: "added a comment",
    deletedComment: "removed a comment",
    createdDecision: "recorded a decision",
    resolved: "resolved a decision",
    reopened: "reopened a decision",
    deletedDecision: "removed a decision",
    updatedTrip: "updated the itinerary",
    restoredTrip: "restored an earlier itinerary version",
    version: "version",
    fieldTitle: "Trip title",
    fieldParty: "Travel party",
    fieldDay: "Day",
    fieldDate: "Date",
    fieldDestination: "Destination",
    fieldTheme: "Day type",
    fieldFlexible: "Flexible",
    fieldActivities: "Activities",
    fieldNotes: "Notes",
  },
  "zh-cn": {
    open: "协作",
    close: "收起协作",
    intro: "查看谁改了什么、讨论上下文，并把真正达成的决定从聊天里独立记录下来。",
    activity: "动态",
    comments: "讨论",
    decisions: "决定",
    refresh: "刷新",
    loading: "正在加载协作信息…",
    emptyActivity: "还没有协作动态。",
    emptyComments: "还没有讨论。",
    emptyDecisions: "还没有明确的决定。",
    viewer: "仅查看",
    commentPlaceholder: "补充背景、问题或建议…",
    addComment: "添加评论",
    dayContext: "关联日期",
    wholeTrip: "整份行程",
    revisionContext: "当前云端版本",
    decisionTitle: "需要明确的决定",
    decisionDetail: "原因 / 已达成的共识",
    addDecision: "记录决定",
    openDecision: "待确认",
    resolvedDecision: "已确定",
    resolve: "标记已确定",
    reopen: "重新打开",
    delete: "删除",
    deleteCommentConfirm: "确定从共享行程中删除这条评论吗？",
    deleteDecisionConfirm: "确定删除这条决定记录吗？",
    changes: "查看改动",
    hideChanges: "收起改动",
    from: "从",
    to: "到",
    initial: "初始版本",
    noChanges: "这个版本没有可识别的行程字段变化。",
    collaborator: "协作者",
    failed: "协作信息暂时不可用。",
    addedComment: "添加了评论",
    deletedComment: "删除了评论",
    createdDecision: "记录了决定",
    resolved: "确认了一项决定",
    reopened: "重新打开了一项决定",
    deletedDecision: "删除了决定",
    updatedTrip: "更新了行程",
    restoredTrip: "恢复了历史行程版本",
    version: "版本",
    fieldTitle: "行程标题",
    fieldParty: "出行成员",
    fieldDay: "行程日",
    fieldDate: "日期",
    fieldDestination: "目的地",
    fieldTheme: "当天类型",
    fieldFlexible: "是否灵活",
    fieldActivities: "活动安排",
    fieldNotes: "备注",
  },
  "zh-hant": {
    open: "協作",
    close: "收起協作",
    intro: "查看誰改了什麼、討論上下文，並把真正達成的決定從聊天中獨立記錄下來。",
    activity: "動態",
    comments: "討論",
    decisions: "決定",
    refresh: "重新整理",
    loading: "正在載入協作資訊…",
    emptyActivity: "還沒有協作動態。",
    emptyComments: "還沒有討論。",
    emptyDecisions: "還沒有明確的決定。",
    viewer: "僅查看",
    commentPlaceholder: "補充背景、問題或建議…",
    addComment: "新增評論",
    dayContext: "關聯日期",
    wholeTrip: "整份行程",
    revisionContext: "目前雲端版本",
    decisionTitle: "需要明確的決定",
    decisionDetail: "原因 / 已達成的共識",
    addDecision: "記錄決定",
    openDecision: "待確認",
    resolvedDecision: "已確定",
    resolve: "標記已確定",
    reopen: "重新開啟",
    delete: "刪除",
    deleteCommentConfirm: "確定從共享行程中刪除這則評論嗎？",
    deleteDecisionConfirm: "確定刪除這則決定記錄嗎？",
    changes: "查看改動",
    hideChanges: "收起改動",
    from: "從",
    to: "到",
    initial: "初始版本",
    noChanges: "這個版本沒有可識別的行程欄位變化。",
    collaborator: "協作者",
    failed: "協作資訊暫時無法使用。",
    addedComment: "新增了評論",
    deletedComment: "刪除了評論",
    createdDecision: "記錄了決定",
    resolved: "確認了一項決定",
    reopened: "重新開啟了一項決定",
    deletedDecision: "刪除了決定",
    updatedTrip: "更新了行程",
    restoredTrip: "恢復了歷史行程版本",
    version: "版本",
    fieldTitle: "行程標題",
    fieldParty: "出行成員",
    fieldDay: "行程日",
    fieldDate: "日期",
    fieldDestination: "目的地",
    fieldTheme: "當天類型",
    fieldFlexible: "是否彈性",
    fieldActivities: "活動安排",
    fieldNotes: "備註",
  },
} as const;

type Tab = "activity" | "comments" | "decisions";

function valueText(value: unknown): string {
  if (value === null || value === undefined || value === "") return "—";
  if (typeof value === "boolean") return value ? "✓" : "×";
  if (typeof value === "string" || typeof value === "number") return String(value);
  if (Array.isArray(value)) return value.map(valueText).join(" · ");
  if (typeof value === "object") {
    const object = value as Record<string, unknown>;
    if (typeof object.cityName === "string") {
      return [object.countryName, object.cityName].filter(Boolean).join(" · ");
    }
  }
  return JSON.stringify(value);
}

function dayLabel(workspace: TripWorkspace, dayId: string | null): string | null {
  if (dayId === null) return null;
  const day = workspace.days.find((item) => item.id === dayId);
  return day === undefined ? dayId : `D${day.dayNumber} · ${day.cityName || day.date}`;
}

function fieldLabel(
  field: CloudTripRevisionChange["field"],
  copy: (typeof COPY)[CloudTripLocale],
): string {
  if (field === "trip.title") return copy.fieldTitle;
  if (field === "trip.partyProfile") return copy.fieldParty;
  if (field === "day") return copy.fieldDay;
  if (field === "day.date") return copy.fieldDate;
  if (field === "day.destination") return copy.fieldDestination;
  if (field === "day.theme") return copy.fieldTheme;
  if (field === "day.flexible") return copy.fieldFlexible;
  if (field === "day.activities") return copy.fieldActivities;
  return copy.fieldNotes;
}

function activityText(
  item: CloudTripActivity,
  copy: (typeof COPY)[CloudTripLocale],
): string {
  if (item.kind === "comment_created") return copy.addedComment;
  if (item.kind === "comment_deleted") return copy.deletedComment;
  if (item.kind === "decision_created") return copy.createdDecision;
  if (item.kind === "decision_resolved") return copy.resolved;
  if (item.kind === "decision_reopened") return copy.reopened;
  if (item.kind === "decision_deleted") return copy.deletedDecision;
  const operation = typeof item.payload.operation === "string" ? item.payload.operation : "update";
  const version = typeof item.payload.version === "number" ? item.payload.version : null;
  return `${operation.startsWith("restore:") ? copy.restoredTrip : copy.updatedTrip}${
    version === null ? "" : ` · ${copy.version} ${version}`
  }`;
}

export function TripCollaborationPanel({
  locale,
  tripId,
  accessRole,
  workspace,
  currentVersion,
}: {
  readonly locale: CloudTripLocale;
  readonly tripId: string;
  readonly accessRole: TripAccessRole;
  readonly workspace: TripWorkspace;
  readonly currentVersion: number;
}): ReactElement {
  const copy = COPY[locale];
  const [open, setOpen] = useState(false);
  const [tab, setTab] = useState<Tab>("activity");
  const [activity, setActivity] = useState<ReadonlyArray<CloudTripActivity>>([]);
  const [comments, setComments] = useState<ReadonlyArray<CloudTripComment>>([]);
  const [decisions, setDecisions] = useState<ReadonlyArray<CloudTripDecision>>([]);
  const [diff, setDiff] = useState<CloudTripRevisionDiff | null>(null);
  const [diffVersion, setDiffVersion] = useState<number | null>(null);
  const [commentBody, setCommentBody] = useState("");
  const [commentDay, setCommentDay] = useState("");
  const [decisionTitle, setDecisionTitle] = useState("");
  const [decisionDetail, setDecisionDetail] = useState("");
  const [decisionDay, setDecisionDay] = useState("");
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState("");

  const writable = accessRole !== "viewer";
  const owner = accessRole === "owner";

  const refresh = useCallback(async (): Promise<void> => {
    setLoading(true);
    setMessage("");
    try {
      const [nextActivity, nextComments, nextDecisions] = await Promise.all([
        listCloudTripActivity(tripId),
        listCloudTripComments(tripId),
        listCloudTripDecisions(tripId),
      ]);
      setActivity(nextActivity);
      setComments(nextComments);
      setDecisions(nextDecisions);
    } catch {
      setMessage(copy.failed);
    } finally {
      setLoading(false);
    }
  }, [copy.failed, tripId]);

  const toggle = useCallback((): void => {
    setOpen((current) => {
      const next = !current;
      if (next) void refresh();
      return next;
    });
  }, [refresh]);

  const addComment = useCallback(async (): Promise<void> => {
    if (!writable || commentBody.trim().length === 0) return;
    setLoading(true);
    try {
      await createCloudTripComment(
        tripId,
        commentBody.trim(),
        commentDay || null,
        currentVersion,
      );
      setCommentBody("");
      await refresh();
      setTab("comments");
    } catch {
      setMessage(copy.failed);
      setLoading(false);
    }
  }, [commentBody, commentDay, copy.failed, currentVersion, refresh, tripId, writable]);

  const addDecision = useCallback(async (): Promise<void> => {
    if (!writable || decisionTitle.trim().length === 0) return;
    setLoading(true);
    try {
      await createCloudTripDecision(
        tripId,
        decisionTitle.trim(),
        decisionDetail.trim(),
        decisionDay || null,
      );
      setDecisionTitle("");
      setDecisionDetail("");
      await refresh();
      setTab("decisions");
    } catch {
      setMessage(copy.failed);
      setLoading(false);
    }
  }, [copy.failed, decisionDay, decisionDetail, decisionTitle, refresh, tripId, writable]);

  const setDecisionStatus = useCallback(
    async (decision: CloudTripDecision): Promise<void> => {
      if (!writable) return;
      setLoading(true);
      try {
        await updateCloudTripDecisionStatus(
          tripId,
          decision.id,
          decision.status === "open" ? "resolved" : "open",
        );
        await refresh();
      } catch {
        setMessage(copy.failed);
        setLoading(false);
      }
    },
    [copy.failed, refresh, tripId, writable],
  );

  const removeComment = useCallback(
    async (commentId: string): Promise<void> => {
      if (!owner || !window.confirm(copy.deleteCommentConfirm)) return;
      await deleteCloudTripComment(tripId, commentId);
      await refresh();
    },
    [copy.deleteCommentConfirm, owner, refresh, tripId],
  );

  const removeDecision = useCallback(
    async (decisionId: string): Promise<void> => {
      if (!owner || !window.confirm(copy.deleteDecisionConfirm)) return;
      await deleteCloudTripDecision(tripId, decisionId);
      await refresh();
    },
    [copy.deleteDecisionConfirm, owner, refresh, tripId],
  );

  const revisionVersions = useMemo(
    () =>
      activity
        .filter((item) => item.kind === "revision" && typeof item.payload.version === "number")
        .map((item) => item.payload.version as number),
    [activity],
  );

  const showDiff = useCallback(
    async (version: number): Promise<void> => {
      if (diffVersion === version) {
        setDiffVersion(null);
        setDiff(null);
        return;
      }
      setLoading(true);
      try {
        setDiff(await readCloudTripRevisionDiff(tripId, version));
        setDiffVersion(version);
      } catch {
        setMessage(copy.failed);
      } finally {
        setLoading(false);
      }
    },
    [copy.failed, diffVersion, tripId],
  );

  return (
    <div className="mt-4" data-trip-collaboration-intelligence={open ? "open" : "closed"}>
      <button type="button" className="trip-secondary-button" onClick={toggle}>
        {open ? copy.close : copy.open}
      </button>

      {open ? (
        <div className="mt-4 rounded-2xl border border-border/80 bg-white p-4 sm:p-5">
          <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
            <div>
              <h3 className="text-base font-bold text-foreground">{copy.open}</h3>
              <p className="mt-1 max-w-2xl text-xs leading-5 text-muted">{copy.intro}</p>
            </div>
            <div className="flex items-center gap-2">
              {accessRole === "viewer" ? (
                <span className="rounded-full bg-surface-elevated px-3 py-1 text-xs font-semibold text-muted">
                  {copy.viewer}
                </span>
              ) : null}
              <button type="button" className="trip-secondary-button" onClick={() => void refresh()}>
                {copy.refresh}
              </button>
            </div>
          </div>

          <div className="mt-4 flex flex-wrap gap-2" role="tablist" aria-label={copy.open}>
            {(["activity", "comments", "decisions"] as const).map((value) => (
              <button
                key={value}
                type="button"
                role="tab"
                aria-selected={tab === value}
                className={tab === value ? "trip-primary-button" : "trip-secondary-button"}
                onClick={() => setTab(value)}
              >
                {value === "activity"
                  ? copy.activity
                  : value === "comments"
                    ? `${copy.comments} (${comments.length})`
                    : `${copy.decisions} (${decisions.filter((item) => item.status === "open").length})`}
              </button>
            ))}
          </div>

          {message ? <p className="mt-3 text-xs text-muted">{message}</p> : null}
          {loading ? <p className="mt-3 text-xs text-muted">{copy.loading}</p> : null}

          {tab === "activity" ? (
            <div className="mt-4 grid gap-3" data-trip-activity-feed="visible">
              {activity.length === 0 ? (
                <p className="text-xs text-muted">{copy.emptyActivity}</p>
              ) : (
                activity.map((item) => {
                  const version =
                    item.kind === "revision" && typeof item.payload.version === "number"
                      ? item.payload.version
                      : null;
                  return (
                    <article key={item.id} className="rounded-xl bg-surface-elevated p-3">
                      <div className="flex flex-wrap items-start justify-between gap-3">
                        <div>
                          <p className="text-sm font-semibold text-foreground">
                            {item.actorEmail ?? copy.collaborator} · {activityText(item, copy)}
                          </p>
                          <p className="mt-1 text-xs text-muted">
                            {new Date(item.createdAt).toLocaleString()}
                          </p>
                        </div>
                        {version !== null && revisionVersions.includes(version) ? (
                          <button
                            type="button"
                            className="trip-secondary-button"
                            onClick={() => void showDiff(version)}
                          >
                            {diffVersion === version ? copy.hideChanges : copy.changes}
                          </button>
                        ) : null}
                      </div>
                      {diffVersion === version && diff !== null ? (
                        <div className="mt-3 grid gap-2" data-revision-diff={version}>
                          <p className="text-xs font-semibold text-muted">
                            {diff.fromVersion === null
                              ? copy.initial
                              : `${copy.from} v${diff.fromVersion} ${copy.to} v${diff.toVersion}`}
                          </p>
                          {diff.changes.length === 0 ? (
                            <p className="text-xs text-muted">{copy.noChanges}</p>
                          ) : (
                            diff.changes.map((change, index) => (
                              <div key={`${change.field}-${change.dayId ?? "trip"}-${index}`} className="rounded-lg bg-white p-2 text-xs">
                                <strong className="text-foreground">
                                  {change.dayNumber === null ? "" : `D${change.dayNumber} · `}
                                  {fieldLabel(change.field, copy)}
                                </strong>
                                <p className="mt-1 break-words text-muted">
                                  {valueText(change.before)} → {valueText(change.after)}
                                </p>
                              </div>
                            ))
                          )}
                        </div>
                      ) : null}
                    </article>
                  );
                })
              )}
            </div>
          ) : null}

          {tab === "comments" ? (
            <div className="mt-4 grid gap-4" data-trip-comments="visible">
              {writable ? (
                <div className="rounded-xl bg-surface-elevated p-3">
                  <textarea
                    value={commentBody}
                    maxLength={1500}
                    placeholder={copy.commentPlaceholder}
                    className="min-h-24 w-full rounded-xl border border-border bg-white p-3 text-sm"
                    onChange={(event) => setCommentBody(event.target.value)}
                  />
                  <div className="mt-3 flex flex-wrap items-end gap-2">
                    <label className="min-w-48 flex-1 text-xs text-muted">
                      <span className="mb-1 block">{copy.dayContext}</span>
                      <select
                        value={commentDay}
                        className="min-h-10 w-full rounded-xl border border-border bg-white px-3 text-sm"
                        onChange={(event) => setCommentDay(event.target.value)}
                      >
                        <option value="">{copy.wholeTrip}</option>
                        {workspace.days.map((day) => (
                          <option key={day.id} value={day.id}>
                            D{day.dayNumber} · {day.cityName || day.date}
                          </option>
                        ))}
                      </select>
                    </label>
                    <span className="text-xs text-muted">
                      {copy.revisionContext}: v{currentVersion}
                    </span>
                    <button type="button" className="trip-primary-button" onClick={() => void addComment()}>
                      {copy.addComment}
                    </button>
                  </div>
                </div>
              ) : null}
              {comments.length === 0 ? (
                <p className="text-xs text-muted">{copy.emptyComments}</p>
              ) : (
                comments.map((comment) => (
                  <article key={comment.id} className="rounded-xl border border-border/80 p-3">
                    <div className="flex items-start justify-between gap-3">
                      <div>
                        <p className="text-xs font-semibold text-foreground">{comment.authorEmail}</p>
                        <p className="mt-2 whitespace-pre-wrap text-sm leading-6 text-foreground">{comment.body}</p>
                        <p className="mt-2 text-xs text-muted">
                          {[dayLabel(workspace, comment.dayId), `v${comment.revisionVersion ?? currentVersion}`, new Date(comment.createdAt).toLocaleString()]
                            .filter(Boolean)
                            .join(" · ")}
                        </p>
                      </div>
                      {owner ? (
                        <button type="button" className="trip-secondary-button" onClick={() => void removeComment(comment.id)}>
                          {copy.delete}
                        </button>
                      ) : null}
                    </div>
                  </article>
                ))
              )}
            </div>
          ) : null}

          {tab === "decisions" ? (
            <div className="mt-4 grid gap-4" data-trip-decisions="visible">
              {writable ? (
                <div className="rounded-xl bg-surface-elevated p-3">
                  <input
                    value={decisionTitle}
                    maxLength={160}
                    placeholder={copy.decisionTitle}
                    className="min-h-11 w-full rounded-xl border border-border bg-white px-3 text-sm"
                    onChange={(event) => setDecisionTitle(event.target.value)}
                  />
                  <textarea
                    value={decisionDetail}
                    maxLength={2000}
                    placeholder={copy.decisionDetail}
                    className="mt-2 min-h-20 w-full rounded-xl border border-border bg-white p-3 text-sm"
                    onChange={(event) => setDecisionDetail(event.target.value)}
                  />
                  <div className="mt-3 flex flex-wrap items-end gap-2">
                    <label className="min-w-48 flex-1 text-xs text-muted">
                      <span className="mb-1 block">{copy.dayContext}</span>
                      <select
                        value={decisionDay}
                        className="min-h-10 w-full rounded-xl border border-border bg-white px-3 text-sm"
                        onChange={(event) => setDecisionDay(event.target.value)}
                      >
                        <option value="">{copy.wholeTrip}</option>
                        {workspace.days.map((day) => (
                          <option key={day.id} value={day.id}>
                            D{day.dayNumber} · {day.cityName || day.date}
                          </option>
                        ))}
                      </select>
                    </label>
                    <button type="button" className="trip-primary-button" onClick={() => void addDecision()}>
                      {copy.addDecision}
                    </button>
                  </div>
                </div>
              ) : null}
              {decisions.length === 0 ? (
                <p className="text-xs text-muted">{copy.emptyDecisions}</p>
              ) : (
                decisions.map((decision) => (
                  <article key={decision.id} className="rounded-xl border border-border/80 p-3">
                    <div className="flex flex-wrap items-start justify-between gap-3">
                      <div className="min-w-0 flex-1">
                        <div className="flex flex-wrap items-center gap-2">
                          <span className="rounded-full bg-surface-elevated px-2 py-1 text-[11px] font-semibold text-muted">
                            {decision.status === "open" ? copy.openDecision : copy.resolvedDecision}
                          </span>
                          {dayLabel(workspace, decision.dayId) ? (
                            <span className="text-xs text-muted">{dayLabel(workspace, decision.dayId)}</span>
                          ) : null}
                        </div>
                        <h4 className="mt-2 text-sm font-bold text-foreground">{decision.title}</h4>
                        {decision.detail ? (
                          <p className="mt-2 whitespace-pre-wrap text-sm leading-6 text-muted">{decision.detail}</p>
                        ) : null}
                        <p className="mt-2 text-xs text-muted">
                          {decision.createdByEmail} · {new Date(decision.createdAt).toLocaleString()}
                          {decision.resolvedByEmail ? ` · ${decision.resolvedByEmail}` : ""}
                        </p>
                      </div>
                      <div className="flex flex-wrap gap-2">
                        {writable ? (
                          <button type="button" className="trip-secondary-button" onClick={() => void setDecisionStatus(decision)}>
                            {decision.status === "open" ? copy.resolve : copy.reopen}
                          </button>
                        ) : null}
                        {owner ? (
                          <button type="button" className="trip-secondary-button" onClick={() => void removeDecision(decision.id)}>
                            {copy.delete}
                          </button>
                        ) : null}
                      </div>
                    </div>
                  </article>
                ))
              )}
            </div>
          ) : null}
        </div>
      ) : null}
    </div>
  );
}
