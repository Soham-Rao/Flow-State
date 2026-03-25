import { useEffect, useMemo } from "react";
import { Activity } from "lucide-react";

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import type { ActivityLogEntry } from "@/types/activity";
import { formatActivityLabel, formatActivityTime, getActivitySnippet } from "@/lib/activity-utils";
import { useActivityStore } from "@/stores/activity-store";

interface BoardActivityPanelProps {
  boardId: string;
}

const EMPTY_ACTIVITY_EVENTS: ActivityLogEntry[] = [];
const POLL_INTERVAL_MS = 2000;
const MAX_VISIBLE_EVENTS = 20;

type ActivitySectionKey = "comments" | "mentions" | "checklists" | "movement" | "deletions" | "updates" | "other";

const SECTION_TITLES: Record<ActivitySectionKey, string> = {
  comments: "Comments",
  mentions: "Mentions",
  checklists: "Checklists",
  movement: "Movement",
  deletions: "Deletions",
  updates: "Updates",
  other: "Other"
};

function getSectionKey(type: string): ActivitySectionKey {
  if (type.startsWith("comment.")) return "comments";
  if (type.startsWith("mention.")) return "mentions";
  if (type.startsWith("checklist.")) return "checklists";
  if (type === "card.moved" || type === "list.reordered") return "movement";
  if (type.endsWith(".deleted")) return "deletions";
  if (type.endsWith(".created") || type.endsWith(".updated") || type.endsWith(".archived") || type.endsWith(".restored")) {
    return "updates";
  }
  return "other";
}

function buildSections(entries: ActivityLogEntry[]): Array<{ key: ActivitySectionKey; title: string; entries: ActivityLogEntry[] }> {
  const buckets = new Map<ActivitySectionKey, ActivityLogEntry[]>();
  entries.forEach((entry) => {
    const key = getSectionKey(entry.type);
    const list = buckets.get(key) ?? [];
    list.push(entry);
    buckets.set(key, list);
  });

  const ordered: ActivitySectionKey[] = ["comments", "mentions", "checklists", "movement", "deletions", "updates", "other"];
  return ordered
    .map((key) => {
      const list = buckets.get(key);
      if (!list || list.length === 0) return null;
      return { key, title: SECTION_TITLES[key], entries: list };
    })
    .filter((section): section is { key: ActivitySectionKey; title: string; entries: ActivityLogEntry[] } => Boolean(section));
}

export function BoardActivityPanel({ boardId }: BoardActivityPanelProps): JSX.Element {
  const events = useActivityStore((state) => state.board[boardId] ?? EMPTY_ACTIVITY_EVENTS);
  const loadBoardActivity = useActivityStore((state) => state.loadBoard);
  const status = useActivityStore((state) => state.boardStatus[boardId] ?? "idle");

  const visibleEvents = useMemo(() => events.slice(0, MAX_VISIBLE_EVENTS), [events]);
  const sections = useMemo(() => buildSections(visibleEvents), [visibleEvents]);

  useEffect(() => {
    if (!boardId) return;
    void loadBoardActivity(boardId);
    const interval = window.setInterval(() => {
      void loadBoardActivity(boardId);
    }, POLL_INTERVAL_MS);
    return () => window.clearInterval(interval);
  }, [boardId, loadBoardActivity]);

  return (
    <div className="fixed right-0 top-24 z-40 hidden xl:block">
      <div className="relative">
        <button
          type="button"
          aria-label="Show board activity"
          className="peer mr-2 flex h-10 w-10 items-center justify-center rounded-l-lg border border-border/70 bg-card/90 text-muted-foreground shadow-sm transition hover:text-foreground"
        >
          <Activity className="h-4 w-4" />
        </button>
        <div className="pointer-events-none absolute right-0 top-0 w-80 translate-x-full transition-transform duration-200 peer-hover:pointer-events-auto peer-hover:translate-x-0 hover:pointer-events-auto hover:translate-x-0">
          <Card className="border border-border/70 bg-card/90 shadow-lg backdrop-blur">
            <CardHeader className="pb-2">
              <CardTitle className="text-sm">Board activity</CardTitle>
              <CardDescription>Recent updates and mentions.</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4 max-h-96 overflow-y-auto pr-1">
              {status === "loading" && events.length === 0 ? (
                <p className="text-xs text-muted-foreground">Loading activity...</p>
              ) : sections.length === 0 ? (
                <p className="text-xs text-muted-foreground">No activity yet.</p>
              ) : (
                sections.map((section) => (
                  <div key={section.key} className="space-y-2">
                    <div className="flex items-center justify-between text-[11px] font-semibold uppercase tracking-[0.2em] text-muted-foreground">
                      <span>{section.title}</span>
                      <span className="rounded-full border border-border/60 px-2 py-0.5 text-[10px]">
                        {section.entries.length}
                      </span>
                    </div>
                    {section.entries.map((entry) => {
                      const label = formatActivityLabel(entry);
                      const time = formatActivityTime(entry);
                      const snippet = getActivitySnippet(entry);
                      return (
                        <div key={entry.id} className="rounded-md border border-border/60 bg-background/70 px-3 py-2">
                          <p className="text-xs font-semibold text-foreground">{label}</p>
                          {snippet && <p className="mt-1 text-xs text-muted-foreground">{snippet}</p>}
                          <p className="mt-1 text-[10px] text-muted-foreground">{time}</p>
                        </div>
                      );
                    })}
                  </div>
                ))
              )}
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}
