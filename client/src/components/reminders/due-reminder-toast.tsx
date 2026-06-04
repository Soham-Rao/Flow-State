import { CalendarClock, CheckCheck, X } from "lucide-react";
import { useEffect, useState } from "react";
import { Link } from "react-router-dom";

import { Button } from "@/components/ui/button";
import { getPriorityLabel } from "@/pages/boards/board-detail-page.utils";
import type { CardPriority } from "@/types/board";

export interface DueReminderItem {
  id: string;
  title: string;
  priority: CardPriority;
  dueDate: string;
  boardId: string;
  boardName: string;
  listName: string;
  assignee: {
    id: string;
    name: string;
    displayName: string | null;
    username: string | null;
    email: string;
  };
  isAssignedToViewer: boolean;
}

const HOUR_MS = 60 * 60 * 1000;
const DAY_MS = 24 * HOUR_MS;
const STORAGE_PREFIX = "flowstate:due-reminders:v1";
const NOTIFICATION_STORAGE_PREFIX = "flowstate:due-reminder-notifications:v1";

function getAssigneeName(item: DueReminderItem): string {
  return item.assignee.displayName || item.assignee.username || item.assignee.name || item.assignee.email;
}

function getReminderPhase(dueDate: string, nowMs: number): "before" | "today" | "overdue" | null {
  const dueMs = new Date(dueDate).getTime();
  if (Number.isNaN(dueMs)) return null;

  const now = new Date(nowMs);
  const due = new Date(dueMs);
  const sameLocalDay =
    due.getFullYear() === now.getFullYear() &&
    due.getMonth() === now.getMonth() &&
    due.getDate() === now.getDate();

  if (sameLocalDay) return "today";
  if (dueMs < nowMs) return "overdue";
  if (dueMs - nowMs <= DAY_MS) return "before";
  return null;
}

function getSnoozeMs(item: DueReminderItem, phase: "before" | "today" | "overdue"): number {
  if (!item.isAssignedToViewer) {
    return 8 * HOUR_MS;
  }
  if (phase === "before") {
    return 12 * HOUR_MS;
  }
  return 2 * HOUR_MS;
}

function readDismissals(storageKey: string): Record<string, number> {
  if (typeof window === "undefined") return {};
  try {
    return JSON.parse(window.localStorage.getItem(storageKey) ?? "{}") as Record<string, number>;
  } catch {
    return {};
  }
}

function writeDismissals(storageKey: string, value: Record<string, number>): void {
  if (typeof window === "undefined") return;
  window.localStorage.setItem(storageKey, JSON.stringify(value));
}

function canUseBrowserNotifications(): boolean {
  return typeof window !== "undefined" && "Notification" in window;
}

export function DueReminderToasts({
  items,
  nowMs,
  currentUserId,
  surface
}: {
  items: DueReminderItem[];
  nowMs: number;
  currentUserId: string | null | undefined;
  surface: "home" | "board";
}): JSX.Element | null {
  const [, setDismissVersion] = useState(0);
  const storageKey = `${STORAGE_PREFIX}:${surface}:${currentUserId ?? "guest"}`;
  const notificationStorageKey = `${NOTIFICATION_STORAGE_PREFIX}:${surface}:${currentUserId ?? "guest"}`;
  const dismissals = readDismissals(storageKey);

  useEffect(() => {
    const handleDismiss = () => setDismissVersion((current) => current + 1);
    window.addEventListener("flowstate-due-reminder-dismissed", handleDismiss);
    return () => window.removeEventListener("flowstate-due-reminder-dismissed", handleDismiss);
  }, []);

  const activeItems = items
    .map((item) => ({ item, phase: getReminderPhase(item.dueDate, nowMs) }))
    .filter((entry): entry is { item: DueReminderItem; phase: "before" | "today" | "overdue" } => {
      if (!entry.phase) return false;
      const dismissKey = `${entry.item.id}:${entry.item.assignee.id}:${entry.phase}`;
      return (dismissals[dismissKey] ?? 0) <= nowMs;
    })
    .sort((a, b) => new Date(a.item.dueDate).getTime() - new Date(b.item.dueDate).getTime());

  const visible = activeItems.slice(0, 3);

  useEffect(() => {
    if (!canUseBrowserNotifications() || Notification.permission !== "granted") return;
    if (visible.length === 0) return;

    const notified = readDismissals(notificationStorageKey);
    const nextNotified = { ...notified };
    let changed = false;

    for (const { item, phase } of visible) {
      const notificationKey = `${item.id}:${item.assignee.id}:${phase}`;
      if ((notified[notificationKey] ?? 0) > nowMs) continue;

      const assigneeName = getAssigneeName(item);
      const phaseLabel = phase === "before" ? "Due in the next day" : phase === "today" ? "Due today" : "Overdue";
      const body = item.isAssignedToViewer
        ? `${item.title} is assigned to you. ${item.boardName} / ${item.listName}`
        : `${assigneeName} has ${item.title}. ${item.boardName} / ${item.listName}`;

      void new Notification(`FlowState: ${phaseLabel}`, {
        body,
        tag: `flowstate-due-${surface}-${notificationKey}`
      });

      nextNotified[notificationKey] = nowMs + getSnoozeMs(item, phase);
      changed = true;
    }

    if (changed) {
      writeDismissals(notificationStorageKey, nextNotified);
    }
  }, [notificationStorageKey, nowMs, surface, visible]);

  if (visible.length === 0) return null;

  const dismiss = (item: DueReminderItem, phase: "before" | "today" | "overdue"): void => {
    const dismissKey = `${item.id}:${item.assignee.id}:${phase}`;
    writeDismissals(storageKey, {
      ...dismissals,
      [dismissKey]: nowMs + getSnoozeMs(item, phase)
    });
    window.dispatchEvent(new Event("flowstate-due-reminder-dismissed"));
  };

  const dismissAll = (): void => {
    const nextDismissals = { ...dismissals };
    for (const { item, phase } of activeItems) {
      const dismissKey = `${item.id}:${item.assignee.id}:${phase}`;
      nextDismissals[dismissKey] = nowMs + getSnoozeMs(item, phase);
    }
    writeDismissals(storageKey, nextDismissals);
    window.dispatchEvent(new Event("flowstate-due-reminder-dismissed"));
  };

  return (
    <div className="fixed bottom-4 right-4 z-[60] w-[min(92vw,26rem)] space-y-2">
      {activeItems.length > 1 && (
        <div className="flex justify-between items-center bg-white/80 dark:bg-slate-950/80 border border-amber-200/50 dark:border-amber-200/20 backdrop-blur-xl rounded-lg p-2.5 px-3 text-xs shadow-lg transition-all duration-300 animate-in fade-in slide-in-from-bottom-2">
          <span className="font-semibold text-slate-700 dark:text-slate-200 flex items-center gap-1.5">
            <span className="relative flex h-2 w-2">
              <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-amber-400 opacity-75"></span>
              <span className="relative inline-flex rounded-full h-2 w-2 bg-amber-500"></span>
            </span>
            {activeItems.length} active reminders
          </span>
          <Button
            type="button"
            variant="ghost"
            onClick={dismissAll}
            className="h-7 text-xs px-2.5 bg-amber-500/10 hover:bg-amber-500/20 text-amber-700 dark:text-amber-300 dark:hover:bg-amber-400/20 font-semibold rounded-md transition-all duration-200 flex items-center gap-1 border border-amber-500/20"
          >
            <CheckCheck className="h-3.5 w-3.5" />
            Dismiss all
          </Button>
        </div>
      )}
      {visible.map(({ item, phase }) => {
        const assigneeName = getAssigneeName(item);
        const dueLabel = new Date(item.dueDate).toLocaleString();
        const phaseLabel = phase === "before" ? "Due in the next day" : phase === "today" ? "Due today" : "Overdue";
        const message = item.isAssignedToViewer
          ? `${item.title} is assigned to you.`
          : `${assigneeName} has ${item.title}.`;

        return (
          <div
            key={`${item.id}:${item.assignee.id}:${phase}`}
            className="rounded-lg border border-amber-200/70 bg-white/85 p-3 text-slate-900 shadow-[0_18px_50px_rgba(15,23,42,0.25)] backdrop-blur-xl dark:border-amber-200/30 dark:bg-slate-950/85 dark:text-white"
          >
            <div className="flex items-start gap-3">
              <div className="mt-0.5 rounded-full bg-amber-400/20 p-2 text-amber-700 dark:text-amber-200">
                <CalendarClock className="h-4 w-4" />
              </div>
              <div className="min-w-0 flex-1">
                <div className="flex flex-wrap items-center gap-2">
                  <p className="text-sm font-semibold">{phaseLabel}</p>
                  <span className="rounded-full border border-black/10 bg-black/5 px-2 py-0.5 text-[10px] font-semibold uppercase dark:border-white/15 dark:bg-white/10">
                    {getPriorityLabel(item.priority)}
                  </span>
                </div>
                <p className="mt-1 text-sm">{message}</p>
                <p className="mt-1 text-xs text-slate-600 dark:text-white/65">
                  {item.boardName} / {item.listName} / {dueLabel}
                </p>
                <div className="mt-3 flex flex-wrap items-center gap-2">
                  <Link to={`/boards/${item.boardId}#card-${item.id}`}>
                    <Button size="sm" variant="secondary">Open card</Button>
                  </Link>
                  {canUseBrowserNotifications() && Notification.permission === "default" && (
                    <Button
                      type="button"
                      size="sm"
                      variant="secondary"
                      onClick={() => {
                        void Notification.requestPermission();
                      }}
                    >
                      Enable browser reminders
                    </Button>
                  )}
                  <Button
                    type="button"
                    size="sm"
                    variant="ghost"
                    onClick={() => dismiss(item, phase)}
                  >
                    Dismiss
                  </Button>
                </div>
              </div>
              <button
                type="button"
                className="rounded-full p-1 text-slate-500 hover:bg-black/5 hover:text-slate-900 dark:text-white/60 dark:hover:bg-white/10 dark:hover:text-white"
                onClick={() => dismiss(item, phase)}
                aria-label="Dismiss reminder"
              >
                <X className="h-4 w-4" />
              </button>
            </div>
          </div>
        );
      })}
    </div>
  );
}
