"use client";

import { useCallback, useEffect, useState, type ReactElement } from "react";
import {
  createCloudTripInvite,
  readCloudTripCollaborators,
  removeCloudTripMember,
  revokeCloudTripInvite,
  updateCloudTripMemberRole,
  type CloudTripCollaborators,
  type CollaborationRole,
} from "../trips/cloud-sync";
import type { CloudTripLocale } from "./CloudTripControls";

const COPY = {
  en: {
    title: "Collaborators",
    invite: "Invite collaborator",
    email: "Email address",
    editor: "Editor",
    viewer: "Viewer",
    send: "Create invite",
    sending: "Creating…",
    members: "Members",
    pending: "Pending invites",
    none: "No collaborators yet.",
    noPending: "No pending invites.",
    remove: "Remove",
    revoke: "Revoke",
    copied: "Invite link copied.",
    ready: "Invite created. Copy the link below.",
    emailed: "Invite created and email sent.",
    error: "Collaboration settings are temporarily unavailable.",
    removeConfirm: "Remove this collaborator from the trip?",
    roleHint: "Editors can change the itinerary. Viewers can only read it.",
  },
  "zh-cn": {
    title: "协作成员",
    invite: "邀请协作者",
    email: "邮箱地址",
    editor: "可编辑",
    viewer: "仅查看",
    send: "创建邀请",
    sending: "正在创建…",
    members: "已加入成员",
    pending: "待接受邀请",
    none: "还没有协作成员。",
    noPending: "没有待接受邀请。",
    remove: "移除",
    revoke: "撤销邀请",
    copied: "邀请链接已复制。",
    ready: "邀请已创建，可复制下方链接发送给对方。",
    emailed: "邀请已创建并发送邮件。",
    error: "协作设置暂时不可用。",
    removeConfirm: "确定将这位协作者移出当前行程吗？",
    roleHint: "可编辑成员能修改行程；仅查看成员只能阅读。",
  },
  "zh-hant": {
    title: "協作成員",
    invite: "邀請協作者",
    email: "電子郵件",
    editor: "可編輯",
    viewer: "僅查看",
    send: "建立邀請",
    sending: "正在建立…",
    members: "已加入成員",
    pending: "待接受邀請",
    none: "還沒有協作成員。",
    noPending: "沒有待接受邀請。",
    remove: "移除",
    revoke: "撤銷邀請",
    copied: "邀請連結已複製。",
    ready: "邀請已建立，可複製下方連結傳給對方。",
    emailed: "邀請已建立並寄出郵件。",
    error: "協作設定暫時無法使用。",
    removeConfirm: "確定將這位協作者移出目前行程嗎？",
    roleHint: "可編輯成員能修改行程；僅查看成員只能閱讀。",
  },
} as const;

function invitePath(locale: CloudTripLocale): string {
  return locale === "en" ? "/trips/invite" : `/${locale}/trips/invite`;
}

export function TripCollaboratorManager({
  tripId,
  locale,
}: {
  readonly tripId: string;
  readonly locale: CloudTripLocale;
}): ReactElement {
  const copy = COPY[locale];
  const [data, setData] = useState<CloudTripCollaborators | null>(null);
  const [email, setEmail] = useState("");
  const [role, setRole] = useState<CollaborationRole>("editor");
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState("");
  const [inviteUrl, setInviteUrl] = useState("");

  const refresh = useCallback(async (): Promise<void> => {
    try {
      setData(await readCloudTripCollaborators(tripId));
    } catch {
      setMessage(copy.error);
    }
  }, [copy.error, tripId]);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  const createInvite = useCallback(async (): Promise<void> => {
    if (email.trim().length === 0) return;
    setBusy(true);
    setMessage("");
    try {
      const created = await createCloudTripInvite(tripId, email.trim(), role, locale);
      const url = `${window.location.origin}${invitePath(locale)}#token=${encodeURIComponent(created.token)}`;
      setInviteUrl(url);
      setEmail("");
      await refresh();
      try {
        await navigator.clipboard.writeText(url);
        setMessage(created.emailSent ? copy.emailed : copy.copied);
      } catch {
        setMessage(created.emailSent ? copy.emailed : copy.ready);
      }
    } catch {
      setMessage(copy.error);
    } finally {
      setBusy(false);
    }
  }, [copy, email, locale, refresh, role, tripId]);

  const changeRole = useCallback(
    async (userId: string, nextRole: CollaborationRole): Promise<void> => {
      setBusy(true);
      try {
        await updateCloudTripMemberRole(tripId, userId, nextRole);
        await refresh();
      } catch {
        setMessage(copy.error);
      } finally {
        setBusy(false);
      }
    },
    [copy.error, refresh, tripId],
  );

  const removeMember = useCallback(
    async (userId: string): Promise<void> => {
      if (!window.confirm(copy.removeConfirm)) return;
      setBusy(true);
      try {
        await removeCloudTripMember(tripId, userId);
        await refresh();
      } catch {
        setMessage(copy.error);
      } finally {
        setBusy(false);
      }
    },
    [copy.error, copy.removeConfirm, refresh, tripId],
  );

  const revokeInvite = useCallback(
    async (inviteId: string): Promise<void> => {
      setBusy(true);
      try {
        await revokeCloudTripInvite(tripId, inviteId);
        await refresh();
      } catch {
        setMessage(copy.error);
      } finally {
        setBusy(false);
      }
    },
    [copy.error, refresh, tripId],
  );

  return (
    <div className="mt-4 rounded-2xl border border-border/80 bg-surface-elevated p-4" data-trip-collaboration="owner-manager">
      <h4 className="text-base font-bold text-foreground">{copy.title}</h4>
      <p className="mt-1 text-xs leading-5 text-muted">{copy.roleHint}</p>

      <div className="mt-4 grid gap-2 sm:grid-cols-[minmax(0,1fr)_9rem_auto]">
        <input
          type="email"
          value={email}
          placeholder={copy.email}
          className="min-h-11 rounded-xl border border-border bg-white px-3 text-sm"
          onChange={(event) => setEmail(event.target.value)}
        />
        <select
          value={role}
          className="min-h-11 rounded-xl border border-border bg-white px-3 text-sm"
          onChange={(event) => setRole(event.target.value as CollaborationRole)}
        >
          <option value="editor">{copy.editor}</option>
          <option value="viewer">{copy.viewer}</option>
        </select>
        <button
          type="button"
          className="trip-primary-button"
          disabled={busy || email.trim().length === 0}
          onClick={() => void createInvite()}
        >
          {busy ? copy.sending : copy.send}
        </button>
      </div>

      {inviteUrl.length > 0 ? (
        <input
          readOnly
          value={inviteUrl}
          aria-label={copy.invite}
          className="mt-3 min-h-10 w-full rounded-xl border border-border bg-white px-3 text-xs"
          onFocus={(event) => event.currentTarget.select()}
        />
      ) : null}

      <div className="mt-5 grid gap-4 lg:grid-cols-2">
        <section>
          <h5 className="text-xs font-bold uppercase tracking-[0.12em] text-muted">{copy.members}</h5>
          <div className="mt-2 grid gap-2">
            {data === null || data.members.length === 0 ? (
              <p className="text-sm text-muted">{copy.none}</p>
            ) : (
              data.members.map((member) => (
                <div key={member.userId} className="flex flex-wrap items-center justify-between gap-2 rounded-xl bg-white p-3">
                  <div className="min-w-0">
                    <p className="truncate text-sm font-semibold text-foreground">{member.email}</p>
                  </div>
                  <div className="flex items-center gap-2">
                    <select
                      value={member.role}
                      disabled={busy}
                      className="min-h-9 rounded-lg border border-border bg-white px-2 text-xs"
                      onChange={(event) =>
                        void changeRole(member.userId, event.target.value as CollaborationRole)
                      }
                    >
                      <option value="editor">{copy.editor}</option>
                      <option value="viewer">{copy.viewer}</option>
                    </select>
                    <button
                      type="button"
                      className="trip-secondary-button"
                      disabled={busy}
                      onClick={() => void removeMember(member.userId)}
                    >
                      {copy.remove}
                    </button>
                  </div>
                </div>
              ))
            )}
          </div>
        </section>

        <section>
          <h5 className="text-xs font-bold uppercase tracking-[0.12em] text-muted">{copy.pending}</h5>
          <div className="mt-2 grid gap-2">
            {data === null || data.invites.length === 0 ? (
              <p className="text-sm text-muted">{copy.noPending}</p>
            ) : (
              data.invites.map((invite) => (
                <div key={invite.id} className="flex flex-wrap items-center justify-between gap-2 rounded-xl bg-white p-3">
                  <div className="min-w-0">
                    <p className="truncate text-sm font-semibold text-foreground">{invite.email}</p>
                    <p className="mt-1 text-xs text-muted">
                      {invite.role === "editor" ? copy.editor : copy.viewer} · {invite.tokenPrefix}…
                    </p>
                  </div>
                  <button
                    type="button"
                    className="trip-secondary-button"
                    disabled={busy}
                    onClick={() => void revokeInvite(invite.id)}
                  >
                    {copy.revoke}
                  </button>
                </div>
              ))
            )}
          </div>
        </section>
      </div>

      {message.length > 0 ? <p className="mt-3 text-xs text-muted">{message}</p> : null}
    </div>
  );
}
