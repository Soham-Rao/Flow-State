import type { FormEvent } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import type { AnnouncementAudience, AnnouncementAudienceOptions, AnnouncementDetail } from "@/types/announcements";
import type { InviteSummary } from "@/types/invite";
import { glassStrongClass, glassSubtleClass } from "@/pages/home/home-page.styles";

const formatAnnouncementTime = (value: number): string => {
  return new Date(value).toLocaleString();
};

const getAnnouncementAuthorLabel = (announcement: AnnouncementDetail): string => {
  return announcement.author.displayName ?? announcement.author.name ?? announcement.author.email;
};

export function InviteStatusModal({
  open,
  onClose,
  pendingInvites,
  acceptedInvites,
  revokedInvites,
  expiredInvites,
  copiedInviteId,
  canShare,
  onCopyInvite,
  onShareInvite,
  onRevokeInvite
}: {
  open: boolean;
  onClose: () => void;
  pendingInvites: InviteSummary[];
  acceptedInvites: InviteSummary[];
  revokedInvites: InviteSummary[];
  expiredInvites: InviteSummary[];
  copiedInviteId: string | null;
  canShare: boolean;
  onCopyInvite: (inviteUrl: string, inviteId?: string) => void;
  onShareInvite: (inviteUrl: string) => void;
  onRevokeInvite: (inviteId: string) => void;
}): JSX.Element | null {
  if (!open) return null;

  return (
    <div
      className="fixed inset-0 z-40 flex items-start justify-center overflow-y-auto bg-black/40 p-3 sm:items-center sm:p-4"
      onMouseDown={(event) => {
        if (event.target === event.currentTarget) {
          onClose();
        }
      }}
    >
      <Card className={`w-[min(100%,48rem)] max-h-[calc(100dvh-1.5rem)] overflow-hidden ${glassStrongClass} bg-white/60 border-white/60 sm:max-h-[calc(100dvh-2rem)]`} onMouseDown={(event) => event.stopPropagation()}>
        <CardHeader className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <CardTitle>Invite status</CardTitle>
            <CardDescription>Track pending and completed invitations.</CardDescription>
          </div>
          <Button type="button" variant="ghost" onClick={onClose}>
            Close
          </Button>
        </CardHeader>
        <CardContent className="space-y-4 max-h-[70vh] overflow-y-auto pr-2">
          {[
            { label: "Pending", items: pendingInvites },
            { label: "Accepted", items: acceptedInvites },
            { label: "Revoked", items: revokedInvites },
            { label: "Expired", items: expiredInvites }
          ].map((section) => (
            <div key={section.label} className={`rounded-lg p-3 ${glassSubtleClass}`}>
              <div className="flex items-center justify-between">
                <p className="text-sm font-semibold">{section.label}</p>
                <span className="rounded-full border border-muted-foreground/20 bg-muted/60 px-2 py-0.5 text-[10px] font-semibold uppercase text-muted-foreground">
                  {section.items.length}
                </span>
              </div>
              {section.items.length === 0 ? (
                <p className="mt-2 text-xs text-muted-foreground">No {section.label.toLowerCase()} invites.</p>
              ) : (
                <div className="mt-3 space-y-2">
                  {section.items.map((invite) => (
                    <div key={invite.id} className={`flex flex-wrap items-center justify-between gap-2 rounded-md px-3 py-2 ${glassSubtleClass}`}>
                      <div className="space-y-1">
                        <p className="text-sm font-medium">{invite.email ?? "Anyone with link"}</p>
                        <p className="text-xs text-muted-foreground">
                          Expires {new Date(invite.expiresAt).toLocaleDateString()}
                        </p>
                      </div>
                      <div className="flex flex-wrap items-center gap-2">
                        <Button
                          type="button"
                          size="sm"
                          variant="secondary"
                          onClick={() => { void onCopyInvite(invite.inviteUrl, invite.id); }}
                        >
                          {copiedInviteId === invite.id ? "Copied" : "Copy link"}
                        </Button>
                        {canShare && (
                          <Button type="button" size="sm" variant="ghost" onClick={() => { void onShareInvite(invite.inviteUrl); }}>
                            Share
                          </Button>
                        )}
                        {section.label === "Pending" && (
                          <Button
                            type="button"
                            size="sm"
                            variant="ghost"
                            className="text-amber-600 hover:text-amber-700"
                            onClick={() => { void onRevokeInvite(invite.id); }}
                          >
                            Revoke
                          </Button>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          ))}
        </CardContent>
      </Card>
    </div>
  );
}

export function AnnouncementComposeModal({
  open,
  onClose,
  onSend,
  error,
  sending,
  subject,
  onSubjectChange,
  body,
  onBodyChange,
  audience,
  onAudienceChange,
  options,
  optionsStatus,
  toggleRoleAudience,
  toggleIncludeUser,
  toggleExcludeUser
}: {
  open: boolean;
  onClose: () => void;
  onSend: (event: FormEvent<HTMLFormElement>) => void;
  error: string | null;
  sending: boolean;
  subject: string;
  onSubjectChange: (value: string) => void;
  body: string;
  onBodyChange: (value: string) => void;
  audience: AnnouncementAudience;
  onAudienceChange: (next: AnnouncementAudience) => void;
  options: AnnouncementAudienceOptions | null;
  optionsStatus: "idle" | "loading" | "ready" | "error";
  toggleRoleAudience: (roleId: string, mode: "include" | "exclude") => void;
  toggleIncludeUser: (userId: string) => void;
  toggleExcludeUser: (userId: string) => void;
}): JSX.Element | null {
  if (!open) return null;

  return (
    <div
      className="fixed inset-0 z-50 flex items-start justify-center overflow-y-auto bg-slate-900/20 p-3 sm:items-center sm:p-4 dark:bg-black/55"
      onMouseDown={(event) => {
        if (event.target === event.currentTarget) {
          onClose();
        }
      }}
    >
      <Card className={`w-[min(100%,64rem)] max-h-[calc(100dvh-1.5rem)] overflow-hidden ${glassStrongClass} bg-white/60 border-white/70 shadow-[0_24px_70px_rgba(15,23,42,0.12)] sm:max-h-[calc(100dvh-2rem)] dark:!bg-black/45 dark:!border-white/20 dark:text-white/95 dark:!backdrop-blur-2xl`} onMouseDown={(event) => event.stopPropagation()}>
        <CardHeader className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <CardTitle>New announcement</CardTitle>
            <CardDescription>Write a workspace-wide update.</CardDescription>
          </div>
          <Button type="button" variant="ghost" onClick={onClose}>
            Close
          </Button>
        </CardHeader>
        <CardContent className="max-h-[calc(100dvh-9rem)] overflow-y-auto pr-2">
          <form className="space-y-4" onSubmit={onSend}>
            {error && (
              <p className="rounded-md border border-destructive/20 bg-destructive/10 px-3 py-2 text-xs text-destructive">
                {error}
              </p>
            )}
            <label className="grid gap-1 text-sm font-medium">
              Subject
              <Input
                value={subject}
                onChange={(event) => onSubjectChange(event.target.value)}
                placeholder="Announcement subject"
                className="bg-white/50 border-white/60 text-slate-900 placeholder:text-slate-500 backdrop-blur-md dark:!bg-black/35 dark:!border-white/20 dark:text-white/95 dark:placeholder:text-white/60"
              />
            </label>
            <label className="grid gap-1 text-sm font-medium">
              Body
              <textarea
                className="min-h-[140px] rounded-lg border border-white/60 bg-white/50 px-3 py-2 text-sm text-slate-900 outline-none placeholder:text-slate-500 backdrop-blur-md dark:!border-white/20 dark:!bg-black/35 dark:text-white/95 dark:placeholder:text-white/60"
                value={body}
                onChange={(event) => onBodyChange(event.target.value)}
                placeholder="Write your announcement..."
              />
            </label>
            <div className={`space-y-3 rounded-lg p-3 ${glassSubtleClass}`}>
              <div className="flex items-center justify-between gap-2">
                <p className="text-sm font-semibold">Audience</p>
                <span className="text-[11px] text-muted-foreground">Choose who receives this announcement.</span>
              </div>
              <label className="flex items-center gap-2 text-sm">
                <input
                  type="checkbox"
                  className="h-4 w-4 accent-primary"
                  checked={audience.sendToAll}
                  onChange={(event) =>
                    onAudienceChange({
                      ...audience,
                      sendToAll: event.target.checked
                    })
                  }
                />
                Send to everyone in the workspace
              </label>
              {optionsStatus === "loading" && (
                <p className="text-xs text-muted-foreground">Loading audience options...</p>
              )}
              {optionsStatus === "error" && (
                <p className="text-xs text-destructive">Unable to load audience options.</p>
              )}
              {options && (
                <div className="grid gap-3 md:grid-cols-2">
                  <div className={`rounded-md p-2 ${glassSubtleClass}`}>
                    <p className="text-[11px] font-semibold uppercase tracking-[0.2em] text-muted-foreground">Include roles</p>
                    <div className="mt-2 space-y-1 max-h-32 overflow-y-auto pr-1">
                      {options.roles.length === 0 && (
                        <p className="text-[11px] text-muted-foreground">No roles available.</p>
                      )}
                      {options.roles.map((role) => (
                        <label key={role.id} className="flex items-center gap-2 text-xs">
                          <input
                            type="checkbox"
                            className="h-3.5 w-3.5 accent-primary"
                            checked={audience.includeRoleIds.includes(role.id)}
                            onChange={() => toggleRoleAudience(role.id, "include")}
                          />
                          <span className="h-2 w-2 rounded-full" style={{ backgroundColor: role.color }} />
                          <span>{role.name}</span>
                        </label>
                      ))}
                    </div>
                  </div>
                  <div className={`rounded-md p-2 ${glassSubtleClass}`}>
                    <p className="text-[11px] font-semibold uppercase tracking-[0.2em] text-muted-foreground">Exclude roles</p>
                    <div className="mt-2 space-y-1 max-h-32 overflow-y-auto pr-1">
                      {options.roles.length === 0 && (
                        <p className="text-[11px] text-muted-foreground">No roles available.</p>
                      )}
                      {options.roles.map((role) => (
                        <label key={role.id} className="flex items-center gap-2 text-xs">
                          <input
                            type="checkbox"
                            className="h-3.5 w-3.5 accent-primary"
                            checked={audience.excludeRoleIds.includes(role.id)}
                            onChange={() => toggleRoleAudience(role.id, "exclude")}
                          />
                          <span className="h-2 w-2 rounded-full" style={{ backgroundColor: role.color }} />
                          <span>{role.name}</span>
                        </label>
                      ))}
                    </div>
                  </div>
                </div>
              )}
              {options && (
                <div className="grid gap-3 md:grid-cols-2">
                  <div className={`rounded-md p-2 ${glassSubtleClass}`}>
                    <p className="text-[11px] font-semibold uppercase tracking-[0.2em] text-muted-foreground">Include teammates</p>
                    <div className="mt-2 space-y-1 max-h-36 overflow-y-auto pr-1">
                      {options.users.length === 0 && (
                        <p className="text-[11px] text-muted-foreground">No teammates available.</p>
                      )}
                      {options.users.map((person) => (
                        <label key={person.id} className="flex items-center gap-2 text-xs">
                          <input
                            type="checkbox"
                            className="h-3.5 w-3.5 accent-primary"
                            checked={audience.includeUserIds.includes(person.id)}
                            onChange={() => toggleIncludeUser(person.id)}
                          />
                          <span>{person.displayName ?? person.name}</span>
                          <span className="text-[11px] text-muted-foreground">@{person.username ?? person.email} • {person.role}</span>
                        </label>
                      ))}
                    </div>
                  </div>
                  <div className={`rounded-md p-2 ${glassSubtleClass}`}>
                    <p className="text-[11px] font-semibold uppercase tracking-[0.2em] text-muted-foreground">Exclude teammates</p>
                    <div className="mt-2 space-y-1 max-h-36 overflow-y-auto pr-1">
                      {options.users.length === 0 && (
                        <p className="text-[11px] text-muted-foreground">No teammates available.</p>
                      )}
                      {options.users.map((person) => (
                        <label key={person.id} className="flex items-center gap-2 text-xs">
                          <input
                            type="checkbox"
                            className="h-3.5 w-3.5 accent-primary"
                            checked={audience.excludeUserIds.includes(person.id)}
                            onChange={() => toggleExcludeUser(person.id)}
                          />
                          <span>{person.displayName ?? person.name}</span>
                          <span className="text-[11px] text-muted-foreground">@{person.username ?? person.email} • {person.role}</span>
                        </label>
                      ))}
                    </div>
                  </div>
                </div>
              )}
            </div>
            <div className="flex items-center justify-end gap-2">
              <Button type="button" variant="ghost" onClick={onClose}>
                Cancel
              </Button>
              <Button type="submit" disabled={sending}>
                {sending ? "Sending..." : "Send announcement"}
              </Button>
            </div>
          </form>
        </CardContent>
      </Card>
    </div>
  );
}

export function AnnouncementViewModal({
  announcement,
  onClose
}: {
  announcement: AnnouncementDetail | null;
  onClose: () => void;
}): JSX.Element | null {
  if (!announcement) return null;

  return (
    <div
      className="fixed inset-0 z-50 flex items-start justify-center overflow-y-auto bg-slate-900/20 p-3 sm:items-center sm:p-4 dark:bg-black/55"
      onMouseDown={(event) => {
        if (event.target === event.currentTarget) {
          onClose();
        }
      }}
    >
      <Card className={`w-[min(100%,42rem)] max-h-[calc(100dvh-1.5rem)] overflow-hidden ${glassStrongClass} bg-white/60 border-white/60 sm:max-h-[calc(100dvh-2rem)]`} onMouseDown={(event) => event.stopPropagation()}>
        <CardHeader className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <CardTitle>{announcement.subject}</CardTitle>
            <CardDescription>
              From {getAnnouncementAuthorLabel(announcement)} • {formatAnnouncementTime(announcement.createdAt)}
            </CardDescription>
          </div>
          <Button type="button" variant="ghost" onClick={onClose}>
            Close
          </Button>
        </CardHeader>
        <CardContent className="max-h-[calc(100dvh-9rem)] space-y-4 overflow-y-auto pr-2">
          <div className={`rounded-md p-4 ${glassSubtleClass}`}>
            <p className="whitespace-pre-wrap text-sm text-foreground">{announcement.body}</p>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}







