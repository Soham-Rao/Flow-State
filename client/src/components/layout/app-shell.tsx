import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Bell, ChevronDown, Command, LayoutDashboard, ListTodo, LogOut, MessageCircle, MessageSquareText, Settings, Sliders, Timer, User } from "lucide-react";
import { NavLink, useLocation, useNavigate } from "react-router-dom";

import { Button } from "@/components/ui/button";
import { ConfirmDialog } from "@/components/ui/confirm-dialog";
import { useAuthStore } from "@/stores/auth-store";
import { useThreadSettingsStore } from "@/stores/thread-settings-store";
import { useMentionStore } from "@/stores/mentions-store";
import { usePresenceStore } from "@/stores/presence-store";
import { useSocketStore } from "@/stores/socket-store";
import { usePermissionErrorStore } from "@/stores/permission-error-store";
import { useAppFeedbackStore } from "@/stores/app-feedback-store";
import { getBugReportSummary } from "@/lib/bug-reports-api";
import { listChannelConversations, listDmConversations } from "@/lib/threads-api";
import type { PresenceUser } from "@/types/presence";

interface AppShellProps {
  children: React.ReactNode;
}


function getInitials(user: PresenceUser): string {
  const raw = user.displayName || user.username || user.name || user.email || "?";
  const label = raw.includes("@") ? raw.split("@")[0] : raw;
  const parts = label.trim().split(/\s+/).filter(Boolean);
  const initials = parts.slice(0, 2).map((part) => part[0]).join("");
  return initials ? initials.toUpperCase() : "?";
}
const navItems = [
  { to: "/", label: "Dashboard", icon: LayoutDashboard },
  { to: "/boards", label: "Boards", icon: ListTodo },
  { to: "/focus", label: "Focus", icon: Timer }
];

const settingsItems = [
  { to: "/settings/profile", label: "Profile", icon: User },
  { to: "/settings/general", label: "General", icon: Settings },
  { to: "/settings/advanced", label: "Advanced", icon: Sliders }
];

export function AppShell({ children }: AppShellProps): JSX.Element {
  const user = useAuthStore((state) => state.user);
  const logout = useAuthStore((state) => state.logout);
  const status = useAuthStore((state) => state.status);
  const refreshMentions = useMentionStore((state) => state.refresh);
  const mentionCounts = useMentionStore((state) => state.counts);
  const boardMentionCount = mentionCounts?.comments ?? 0;
  const assignmentBadgeCount = mentionCounts?.assignments ?? 0;
  const threadBadgeMode = useThreadSettingsStore((state) => state.threadBadgeMode);
  const [threadCounts, setThreadCounts] = useState({ dms: 0, channels: 0 });
  const [bugInboxCount, setBugInboxCount] = useState<number | null>(null);
  const workspacePresence = usePresenceStore((state) => state.workspace);
  const connectSocket = useSocketStore((state) => state.connect);
  const disconnectSocket = useSocketStore((state) => state.disconnect);
  const subscribeThreadEvents = useSocketStore((state) => state.subscribeThreadEvents);
  const permissionErrorMessage = usePermissionErrorStore((state) => state.message);
  const clearPermissionError = usePermissionErrorStore((state) => state.clear);
  const feedbackDialog = useAppFeedbackStore((state) => state.dialog);
  const clearFeedbackDialog = useAppFeedbackStore((state) => state.clearDialog);


  const refreshThreadCounts = useCallback(async (): Promise<void> => {
    if (!user) return;
    try {
      const [dmConversations, channelConversations] = await Promise.all([
        listDmConversations(),
        listChannelConversations()
      ]);

      const countForMode = (conversations: Array<{ unreadMentions: number; unreadReplyMentions: number; hasUnread: boolean }>) => {
        if (threadBadgeMode === "never") return 0;
        if (threadBadgeMode === "mentions") {
          return conversations.filter((conversation) =>
            (conversation.unreadMentions ?? 0) + (conversation.unreadReplyMentions ?? 0) > 0
          ).length;
        }
        return conversations.filter((conversation) =>
          Boolean(conversation.hasUnread) || (conversation.unreadMentions ?? 0) + (conversation.unreadReplyMentions ?? 0) > 0
        ).length;
      };

      setThreadCounts({
        dms: countForMode(dmConversations),
        channels: countForMode(channelConversations)
      });
    } catch {
      // ignore
    }
  }, [user, threadBadgeMode]);
  useEffect(() => {
    if (!user) return;
    void refreshMentions();
    void refreshThreadCounts();
    const interval = window.setInterval(() => {
      void refreshMentions();
      void refreshThreadCounts();
    }, 3000);
    return () => window.clearInterval(interval);
  }, [user, refreshMentions, refreshThreadCounts]);

  useEffect(() => {
    if (!user || user.role !== "admin") {
      setBugInboxCount(null);
      return;
    }

    const refreshBugSummary = async (): Promise<void> => {
      try {
        const summary = await getBugReportSummary();
        setBugInboxCount(summary.openCount ?? 0);
      } catch {
        // ignore
      }
    };

    void refreshBugSummary();
    const interval = window.setInterval(() => {
      void refreshBugSummary();
    }, 15000);

    return () => window.clearInterval(interval);
  }, [user]);

  useEffect(() => {
    if (!user) return;
    let timer: number | null = null;
    const unsubscribe = subscribeThreadEvents(() => {
      if (timer !== null) return;
      timer = window.setTimeout(() => {
        timer = null;
        void refreshThreadCounts();
      }, 250);
    });
    return () => {
      if (timer !== null) {
        window.clearTimeout(timer);
      }
      unsubscribe();
    };
  }, [user, subscribeThreadEvents, refreshThreadCounts]);

  useEffect(() => {
    if (!user) {
      disconnectSocket();
      return;
    }

    connectSocket();
    return () => {
      disconnectSocket();
    };
  }, [user, connectSocket, disconnectSocket]);

  const navigate = useNavigate();
  const location = useLocation();
  const isSubmitting = status === "loading";

  const menuRef = useRef<HTMLDivElement | null>(null);
  const [menuOpen, setMenuOpen] = useState(false);
  const [threadsOpen, setThreadsOpen] = useState(true);

  const displayName = useMemo(() => {
    return user?.displayName || user?.username || "Teammate";
  }, [user]);

  const roleLabel = useMemo(() => (user?.role ?? "guest").toUpperCase(), [user]);

  const threadsTab = useMemo(() => {
    const tab = new URLSearchParams(location.search).get("tab");
    return tab === "channels" ? "channels" : "dms";
  }, [location.search]);

  const isThreadsPath = location.pathname === "/threads";

  useEffect(() => {
    if (!menuOpen) {
      return;
    }

    const handleClick = (event: MouseEvent) => {
      const target = event.target as Node | null;
      if (!target || !menuRef.current?.contains(target)) {
        setMenuOpen(false);
      }
    };

    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        setMenuOpen(false);
      }
    };

    document.addEventListener("mousedown", handleClick);
    document.addEventListener("keydown", handleKeyDown);
    return () => {
      document.removeEventListener("mousedown", handleClick);
      document.removeEventListener("keydown", handleKeyDown);
    };
  }, [menuOpen]);

  const onLogout = async (): Promise<void> => {
    await logout();
    navigate("/login");
  };

  return (
    <>
      <ConfirmDialog
      open={permissionErrorMessage !== null}
      title="Permission denied"
      description={permissionErrorMessage ?? "You do not have permission to perform this action."}
      confirmLabel="OK"
      overlayClassName="z-[200]"
      showCancel={false}
      onCancel={clearPermissionError}
      onConfirm={clearPermissionError}
    />
    <ConfirmDialog
      open={feedbackDialog !== null}
      title={feedbackDialog?.title ?? "Notice"}
      description={feedbackDialog?.description ?? ""}
      confirmLabel={feedbackDialog?.confirmLabel ?? "OK"}
      overlayClassName="z-[210]"
      showCancel={false}
      onCancel={clearFeedbackDialog}
      onConfirm={() => {
        const nextAction = feedbackDialog?.onConfirm;
        clearFeedbackDialog();
        nextAction?.();
      }}
    />
    <div className="min-h-screen bg-[radial-gradient(900px_circle_at_top_left,rgba(45,212,191,0.55),transparent_60%),radial-gradient(800px_circle_at_bottom_right,rgba(99,102,241,0.5),transparent_60%),radial-gradient(700px_circle_at_top_right,rgba(251,191,36,0.35),transparent_65%),linear-gradient(135deg,#f8fafc,#eef2ff)] dark:bg-[radial-gradient(900px_circle_at_top_left,rgba(99,102,241,0.32),transparent_58%),radial-gradient(800px_circle_at_bottom_right,rgba(16,185,129,0.28),transparent_60%),radial-gradient(700px_circle_at_top_right,rgba(236,72,153,0.25),transparent_62%),linear-gradient(135deg,#0a0f1f,#030712)]">
      <div className="group/sidebar">
        <div className="hidden lg:block fixed inset-y-0 left-0 z-40 w-3" />
        <aside className="border-b border-white/30 bg-white/14 px-4 py-4 text-slate-900 backdrop-blur-xl lg:fixed lg:top-0 lg:left-0 lg:z-50 lg:h-screen lg:w-[280px] lg:-translate-x-full lg:border-b-0 lg:border-r lg:border-white/30 lg:px-6 lg:py-6 lg:transition-transform lg:duration-200 lg:group-hover/sidebar:translate-x-0 dark:border-white/18 dark:bg-white/6 dark:text-white/90">
        <div className="mb-6 flex items-center justify-between lg:mb-8">
          <NavLink to="/" className="text-xl font-bold tracking-tight text-slate-900 dark:text-white">
            FlowState
          </NavLink>
          <Button variant="secondary" size="sm" className="gap-2 border border-black/10 bg-white/70 text-slate-900 hover:bg-white/80 dark:border-white/20 dark:bg-white/10 dark:text-white/90 dark:hover:bg-white/14">
            <Command className="h-4 w-4" />
            Cmd+K
          </Button>
        </div>

        <nav className="grid gap-2">
          {navItems.map(({ to, label, icon: Icon }) => (
            <NavLink
              key={label}
              to={to}
              className={({ isActive }) =>
                `flex items-center justify-between gap-3 rounded-lg px-3 py-2 text-sm font-medium transition-colors ${
                  isActive
                    ? "bg-black/5 text-slate-900 dark:bg-white/15 dark:text-white"
                    : "text-slate-700 hover:bg-black/5 hover:text-slate-900 dark:text-white/70 dark:hover:bg-white/10 dark:hover:text-white"
                }`
              }
            >
              <span className="flex items-center gap-3">
                <Icon className="h-4 w-4" />
                {label}
              </span>
                            {label === "Boards" && (boardMentionCount > 0 || assignmentBadgeCount > 0) && (
                <span className="flex items-center gap-1">
                  {boardMentionCount > 0 && (
                    <span className="rounded-full bg-rose-500/90 px-2 py-0.5 text-[10px] font-semibold text-white">
                      {boardMentionCount}
                    </span>
                  )}
                  {assignmentBadgeCount > 0 && (
                    <span className="rounded-full bg-sky-500/90 px-2 py-0.5 text-[10px] font-semibold text-white">
                      {assignmentBadgeCount}
                    </span>
                  )}
                </span>
              )}            </NavLink>
          ))}
        </nav>

        <div className="mt-8">
          <button
            type="button"
            onClick={() => setThreadsOpen((open) => !open)}
            className="flex w-full items-center justify-between rounded-lg px-2 py-1 text-left text-xs font-semibold uppercase tracking-[0.2em] text-slate-500 transition hover:text-slate-900 dark:text-white/60 dark:hover:text-white"
          >
            <span>Threads</span>
            <ChevronDown className={`h-4 w-4 transition ${threadsOpen ? "" : "-rotate-90"}`} />
          </button>
          {threadsOpen && (
            <nav className="mt-2 grid gap-1">
              <NavLink
                to="/threads?tab=dms"
                className={() =>
                  `flex items-center justify-between rounded-lg px-3 py-2 text-sm font-medium transition-colors ${
                    isThreadsPath && threadsTab === "dms"
                      ? "bg-black/5 text-slate-900 dark:bg-white/15 dark:text-white"
                      : "text-slate-700 hover:bg-black/5 hover:text-slate-900 dark:text-white/70 dark:hover:bg-white/10 dark:hover:text-white"
                  }`
                }
              >
                <span className="flex items-center gap-3">
                  <MessageCircle className="h-4 w-4" />
                  DMs
                </span>
                {threadCounts.dms > 0 && threadBadgeMode !== "never" && (
                  <span className="rounded-full bg-rose-500/90 px-2 py-0.5 text-[10px] font-semibold text-white">
                    {threadCounts.dms}
                  </span>
                )}
              </NavLink>
              <NavLink
                to="/threads?tab=channels"
                className={() =>
                  `flex items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium transition-colors ${
                    isThreadsPath && threadsTab === "channels"
                      ? "bg-black/5 text-slate-900 dark:bg-white/15 dark:text-white"
                      : "text-slate-700 hover:bg-black/5 hover:text-slate-900 dark:text-white/70 dark:hover:bg-white/10 dark:hover:text-white"
                  }`
                }
              >
                <MessageSquareText className="h-4 w-4" />
                Channels
                {threadCounts.channels > 0 && threadBadgeMode !== "never" && (
                  <span className="rounded-full bg-rose-500/90 px-2 py-0.5 text-[10px] font-semibold text-white">
                    {threadCounts.channels}
                  </span>
                )}
              </NavLink>
            </nav>
          )}
        </div>

        <div className="mt-8">
          <p className="mb-2 text-xs font-semibold uppercase tracking-[0.2em] text-slate-500 dark:text-white/60">
            Settings
          </p>
          <nav className="grid gap-2">
            {settingsItems.map(({ to, label, icon: Icon }) => (
              <NavLink
                key={label}
                to={to}
                className={({ isActive }) =>
                  `flex items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium transition-colors ${
                    isActive
                      ? "bg-black/5 text-slate-900 dark:bg-white/15 dark:text-white"
                      : "text-slate-700 hover:bg-black/5 hover:text-slate-900 dark:text-white/70 dark:hover:bg-white/10 dark:hover:text-white"
                  }`
                }
              >
                <Icon className="h-4 w-4" />
                {label}
                {label === "Advanced" && (bugInboxCount ?? 0) > 0 && (
                  <span className="ml-auto rounded-full bg-amber-500/90 px-2 py-0.5 text-[10px] font-semibold text-white">
                    {bugInboxCount}
                  </span>
                )}
              </NavLink>
            ))}
          </nav>
        </div>
      </aside>
      </div>

      <main className="flex min-h-screen flex-col">
        <header className="sticky top-0 z-10 border-b border-white/30 bg-white/25 px-4 py-2 backdrop-blur-xl lg:px-6 dark:border-white/15 dark:bg-black/35 dark:backdrop-blur-2xl">
          <div className="flex items-center justify-between gap-4">
                        <div className="flex items-center gap-2 text-sm font-semibold text-slate-900 dark:text-white/90">
              <span>{displayName}</span>
              <span className="rounded-full border border-black/10 bg-black/5 px-2 py-0.5 text-[10px] font-semibold tracking-[0.2em] text-slate-700 dark:border-white/20 dark:bg-white/10 dark:text-white/80">
                {roleLabel}
              </span>
            </div>

            <div className="flex items-center gap-3">
              {workspacePresence.length > 0 && (
                <div className="flex items-center gap-2">
                  <div className="flex -space-x-2">
                    {workspacePresence.slice(0, 4).map((member) => (
                      <div
                        key={member.id}
                        className="flex h-7 w-7 items-center justify-center rounded-full border border-black/10 bg-white/70 text-[10px] font-semibold text-slate-700 shadow-sm dark:border-white/20 dark:bg-black/20 dark:text-white/70"
                        title={member.displayName ?? member.username ?? member.email}
                      >
                        {getInitials(member)}
                      </div>
                    ))}
                    {workspacePresence.length > 4 && (
                      <div className="flex h-7 w-7 items-center justify-center rounded-full border border-black/10 bg-white/70 text-[10px] font-semibold text-slate-700 shadow-sm dark:border-white/20 dark:bg-black/20 dark:text-white/70">
                        +{workspacePresence.length - 4}
                      </div>
                    )}
                  </div>
                  <span className="text-[10px] font-semibold uppercase tracking-[0.2em] text-slate-500 dark:text-white/60">Online</span>
                </div>
              )}
            </div>

            <div className="flex items-center gap-2">
              <div ref={menuRef} className="relative">
                <button
                  type="button"
                  onClick={() => setMenuOpen((open) => !open)}
                  className="flex items-center gap-2 rounded-lg border border-white/35 bg-white/30 px-3 py-1.5 text-right text-slate-900 backdrop-blur-xl transition hover:bg-white/40 hover:border-white/60 dark:border-white/16 dark:bg-black/30 dark:text-white/90 dark:hover:bg-black/40"
                >
                  <div>
                    <p className="text-sm font-medium leading-tight">{displayName}</p>
                  </div>
                  <ChevronDown className="h-4 w-4 text-slate-500 dark:text-white/70" />
                </button>

                {menuOpen && (
                  <div className="absolute right-0 mt-2 w-56 rounded-lg border border-white/45 bg-white/45 p-2 text-slate-900 shadow-xl backdrop-blur-2xl dark:border-white/16 dark:bg-black/40 dark:text-white/95">
                    <button
                      type="button"
                      className="flex w-full items-center gap-2 rounded-md px-3 py-2 text-sm font-medium hover:bg-black/5 dark:hover:bg-white/10"
                      onClick={() => {
                        setMenuOpen(false);
                        navigate("/settings/profile");
                      }}
                    >
                      <User className="h-4 w-4" />
                      Profile
                    </button>
                    <button
                      type="button"
                      className="flex w-full items-center gap-2 rounded-md px-3 py-2 text-sm font-medium hover:bg-black/5 dark:hover:bg-white/10"
                      onClick={() => {
                        setMenuOpen(false);
                        navigate("/settings/general");
                      }}
                    >
                      <Settings className="h-4 w-4" />
                      Settings
                    </button>
                    <button
                      type="button"
                      className="flex w-full items-center gap-2 rounded-md px-3 py-2 text-sm font-medium text-slate-500 dark:text-white/70"
                      disabled
                    >
                      <Bell className="h-4 w-4" />
                      Help center
                    </button>
                    <div className="my-2 border-t border-black/10 dark:border-white/10" />
                    <button
                      type="button"
                      className="flex w-full items-center gap-2 rounded-md px-3 py-2 text-sm font-medium text-red-400 hover:bg-red-500/10"
                      onClick={() => void onLogout()}
                      disabled={isSubmitting}
                    >
                      <LogOut className="h-4 w-4" />
                      Log out
                    </button>
                  </div>
                )}
              </div>

              <Button variant="ghost" size="sm" className="gap-2 text-slate-700 hover:text-slate-900 hover:bg-black/5 dark:text-white/80 dark:hover:text-white dark:hover:bg-white/10">
                <Bell className="h-4 w-4" />
                Alerts
              </Button>
            </div>
          </div>
        </header>

        <section className="flex-1 px-4 pb-1 pt-1.5 lg:px-6 lg:pb-2 lg:pt-2">{children}</section>
      </main>
    </div>
    </>
  );
}
































