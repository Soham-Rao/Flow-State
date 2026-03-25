import { useEffect, useState } from "react";
import { Activity, CalendarDays, CheckCircle2, ListTodo, type LucideIcon } from "lucide-react";
import { Link } from "react-router-dom";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { createInvite, listInvites, revokeInvite } from "@/lib/invites-api";
import { formatActivityLabel, formatActivityTime } from "@/lib/activity-utils";
import { useActivityStore } from "@/stores/activity-store";
import { useAuthStore } from "@/stores/auth-store";
import type { InviteSummary } from "@/types/invite";

type DashboardCard = {
  title: string;
  icon: LucideIcon;
  description: string;
  value: string;
  subtitle?: string | null;
};

const dashboardCards: DashboardCard[] = [
  {
    title: "My Tasks",
    icon: ListTodo,
    description: "Cards assigned to you across every board.",
    value: "0"
  },
  {
    title: "Completed Today",
    icon: CheckCircle2,
    description: "Cards moved to done lists.",
    value: "0"
  },
  {
    title: "Upcoming Deadlines",
    icon: CalendarDays,
    description: "Tasks due within the next 7 days.",
    value: "0"
  },
  {
    title: "Team Pulse",
    icon: Activity,
    description: "Recent team activity and momentum.",
    value: "No events yet"
  }
];

export function HomePage(): JSX.Element {
  const user = useAuthStore((state) => state.user);

  const isAdmin = user?.role === "admin";

  const activity = useActivityStore((state) => state.workspace);
  const activityStatus = useActivityStore((state) => state.workspaceStatus);
  const loadWorkspaceActivity = useActivityStore((state) => state.loadWorkspace);

  const [inviteEmail, setInviteEmail] = useState("");
  const [inviteLink, setInviteLink] = useState<string | null>(null);
  const [invites, setInvites] = useState<InviteSummary[]>([]);
  const [inviteLoading, setInviteLoading] = useState(false);
  const [inviteError, setInviteError] = useState<string | null>(null);
  const [copiedInviteId, setCopiedInviteId] = useState<string | null>(null);
  const [copiedInviteLink, setCopiedInviteLink] = useState(false);
  const [isInviteModalOpen, setIsInviteModalOpen] = useState(false);

  const canShare = typeof navigator !== "undefined" && typeof navigator.share === "function";

  const pendingInvites = invites.filter((invite) => invite.status === "pending");
  const acceptedInvites = invites.filter((invite) => invite.status === "accepted");
  const revokedInvites = invites.filter((invite) => invite.status === "revoked");
  const expiredInvites = invites.filter((invite) => invite.status === "expired");

  const teamPulseItems = activity.slice(0, 4);
  const hasTeamPulse = teamPulseItems.length > 0;
  const isTeamPulseLoading = activityStatus === "loading" && !hasTeamPulse;
  const teamPulseCard = dashboardCards.find((card) => card.title === "Team Pulse") ?? {
    title: "Team Pulse",
    icon: Activity,
    description: "Recent team activity and momentum.",
    value: "No events yet"
  };
  const TeamPulseIcon = teamPulseCard.icon;
  const cards = dashboardCards.filter((card) => card.title !== "Team Pulse");

  const loadInvites = async (): Promise<void> => {
    if (!isAdmin) return;

    setInviteError(null);

    try {
      const data = await listInvites();
      setInvites(data);
    } catch (loadError) {
      const message = loadError instanceof Error ? loadError.message : "Failed to load invites";
      setInviteError(message);
    }
  };

  const onCreateInvite = async (event: React.FormEvent<HTMLFormElement>): Promise<void> => {
    event.preventDefault();

    if (!isAdmin) return;

    setInviteLoading(true);
    setInviteError(null);

    try {
      const payload = inviteEmail.trim() ? { email: inviteEmail.trim() } : {};
      const created = await createInvite(payload);
      setInviteLink(created.inviteUrl);
      setInviteEmail("");
      await loadInvites();
    } catch (error) {
      const message = error instanceof Error ? error.message : "Failed to create invite";
      setInviteError(message);
    } finally {
      setInviteLoading(false);
    }
  };

  const onRevokeInvite = async (inviteId: string): Promise<void> => {
    if (!isAdmin) return;

    try {
      await revokeInvite(inviteId);
      await loadInvites();
    } catch (error) {
      const message = error instanceof Error ? error.message : "Failed to revoke invite";
      setInviteError(message);
    }
  };

  const onCopyInvite = async (inviteUrl: string, inviteId?: string): Promise<void> => {
    try {
      await navigator.clipboard.writeText(inviteUrl);
      if (inviteId) {
        setCopiedInviteId(inviteId);
        setTimeout(() => setCopiedInviteId(null), 1500);
      } else {
        setCopiedInviteLink(true);
        setTimeout(() => setCopiedInviteLink(false), 1500);
      }
    } catch {
      window.prompt("Copy invite link:", inviteUrl);
    }
  };

  const onShareInvite = async (inviteUrl: string): Promise<void> => {
    if (typeof navigator === "undefined" || !navigator.share) {
      await onCopyInvite(inviteUrl);
      return;
    }

    try {
      await navigator.share({ title: "FlowState invite", url: inviteUrl });
    } catch {
      // Ignore share cancellation.
    }
  };

  useEffect(() => {
    if (!isAdmin) {
      setInvites([]);
      return;
    }

    void loadInvites();
  }, [isAdmin]);

  useEffect(() => {
    if (!user) return;
    void loadWorkspaceActivity();
    const workspaceInterval = window.setInterval(() => {
      void loadWorkspaceActivity();
    }, 2000);
    return () => window.clearInterval(workspaceInterval);
  }, [user, loadWorkspaceActivity]);

  useEffect(() => {
    if (!isInviteModalOpen) return;
    const handleKeyDown = (event: KeyboardEvent): void => {
      if (event.key === "Escape") {
        event.preventDefault();
        setIsInviteModalOpen(false);
      }
    };
    void loadInvites();
    const interval = window.setInterval(() => {
      void loadInvites();
    }, 5000);
    window.addEventListener("keydown", handleKeyDown);
    return () => {
      window.removeEventListener("keydown", handleKeyDown);
      window.clearInterval(interval);
    };
  }, [isInviteModalOpen]);

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h2 className="text-2xl font-semibold tracking-tight">Dashboard</h2>
          <p className="text-sm text-muted-foreground">
            Signed in as <span className="font-medium text-foreground">{user?.email}</span>.
          </p>
        </div>

        <Link to="/boards">
          <Button>Open boards</Button>
        </Link>
      </div>

      {isAdmin && (
        <Card>
          <CardHeader>
            <CardTitle>Team invitations</CardTitle>
            <CardDescription>Invite teammates by email or share a link.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            {inviteError && (
              <p className="rounded-md border border-destructive/20 bg-destructive/10 px-3 py-2 text-xs text-destructive">
                {inviteError}
              </p>
            )}

            <form className="space-y-2" onSubmit={onCreateInvite}>
              <div className="flex flex-wrap gap-2">
                <Input
                  value={inviteEmail}
                  onChange={(event) => setInviteEmail(event.target.value)}
                  type="email"
                  placeholder="Email (optional)"
                  className="min-w-[220px] flex-1"
                />
                <Button type="submit" disabled={inviteLoading}>
                  {inviteLoading ? "Creating..." : "Create invite"}
                </Button>
              </div>
              <p className="text-xs text-muted-foreground">Leave email blank to generate a shareable link.</p>
            </form>

            {inviteLink && (
              <div className="rounded-md border border-primary/20 bg-primary/5 px-3 py-2">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <p className="text-xs font-semibold text-primary">Invite link ready</p>
                  <div className="flex flex-wrap items-center gap-2">
                    <Button type="button" size="sm" variant="secondary" onClick={() => { void onCopyInvite(inviteLink); }}>{copiedInviteLink ? "Copied" : "Copy link"}</Button>
                    {canShare && (
                      <Button type="button" size="sm" variant="ghost" onClick={() => { void onShareInvite(inviteLink); }}>Share</Button>
                    )}
                  </div>
                </div>
                <p className="mt-2 break-all text-xs text-muted-foreground">{inviteLink}</p>
              </div>
            )}

            <div className="flex flex-wrap items-center gap-2">
              <Button type="button" variant="secondary" onClick={() => setIsInviteModalOpen(true)}>
                View invite status
              </Button>
              <p className="text-xs text-muted-foreground">{invites.length} total invites</p>
            </div>
          </CardContent>
        </Card>
      )}

      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        {cards.map(({ title, icon: Icon, description, value }) => (
          <Card key={title}>
            <CardHeader className="space-y-3 pb-3">
              <div className="inline-flex h-9 w-9 items-center justify-center rounded-lg bg-secondary text-secondary-foreground">
                <Icon className="h-4 w-4" />
              </div>
              <CardTitle className="text-base">{title}</CardTitle>
              <CardDescription>{description}</CardDescription>
            </CardHeader>
            <CardContent>
              <p className="text-2xl font-semibold tracking-tight">{value}</p>
            </CardContent>
          </Card>
        ))}
        <Card>
          <CardHeader className="space-y-3 pb-3">
            <div className="inline-flex h-9 w-9 items-center justify-center rounded-lg bg-secondary text-secondary-foreground">
              <TeamPulseIcon className="h-4 w-4" />
            </div>
            <CardTitle className="text-base">{teamPulseCard.title}</CardTitle>
            <CardDescription>{teamPulseCard.description}</CardDescription>
          </CardHeader>
          <CardContent>
            {isTeamPulseLoading ? (
              <p className="text-xs text-muted-foreground">Loading...</p>
            ) : teamPulseItems.length === 0 ? (
              <p className="text-xs text-muted-foreground">No events yet.</p>
            ) : (
              <div className="space-y-2 max-h-32 overflow-y-auto pr-1">
                {teamPulseItems.map((entry) => (
                  <div key={entry.id} className="rounded-md border border-border/60 bg-background/70 px-3 py-2">
                    <p className="text-xs font-semibold text-foreground">{formatActivityLabel(entry)}</p>
                    <p className="mt-1 text-[10px] text-muted-foreground">{formatActivityTime(entry)}</p>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      {isInviteModalOpen && (
        <div className="fixed inset-0 z-40 flex items-center justify-center bg-black/45 p-4"
          onMouseDown={(event) => {
            if (event.target === event.currentTarget) {
              setIsInviteModalOpen(false);
            }
          }}
        >
          <Card className="w-full max-w-3xl" onMouseDown={(event) => event.stopPropagation()}>
            <CardHeader className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
              <div>
                <CardTitle>Invite status</CardTitle>
                <CardDescription>Track pending and completed invitations.</CardDescription>
              </div>
              <Button type="button" variant="ghost" onClick={() => setIsInviteModalOpen(false)}>
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
                <div key={section.label} className="rounded-lg border bg-card/60 p-3">
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
                        <div key={invite.id} className="flex flex-wrap items-center justify-between gap-2 rounded-md border bg-card/70 px-3 py-2">
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
                              <Button type="button" size="sm" variant="ghost" onClick={() => { void onShareInvite(invite.inviteUrl); }}>Share</Button>
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
      )}
    </div>
  );
}




