import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { getArchiveCountdownLabel } from "@/pages/boards/board-detail-page.utils";
import type { ArchivedListEntry, BoardCard } from "@/types/board";

export function ArchivedListsModal({
  open,
  archivedLoading,
  archivedError,
  archivedLists,
  nowMs,
  archiveRetentionTotalMinutes,
  onClose,
  onRestore,
  onRestoreCard
}: {
  open: boolean;
  archivedLoading: boolean;
  archivedError: string | null;
  archivedLists: ArchivedListEntry[];
  nowMs: number;
  archiveRetentionTotalMinutes: number;
  onClose: () => void;
  onRestore: (entry: ArchivedListEntry) => void;
  onRestoreCard: (entry: ArchivedListEntry, card: BoardCard) => void;
}): JSX.Element | null {
  if (!open) return null;
  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/45 p-4"
      onMouseDown={(event) => {
        if (event.target === event.currentTarget) {
          onClose();
        }
      }}
    >
      <Card
        className="flex max-h-[85vh] w-full max-w-3xl flex-col overflow-hidden"
        onMouseDown={(event) => event.stopPropagation()}
      >
        <CardHeader className="flex flex-row items-start justify-between gap-3">
          <div>
            <CardTitle>Archived lists</CardTitle>
            <CardDescription>Restore archived lists and cards before they are cleaned up.</CardDescription>
          </div>
          <Button type="button" variant="ghost" onClick={onClose}>
            Close
          </Button>
        </CardHeader>
        <CardContent className="min-h-0 flex-1 space-y-4 overflow-y-auto pr-1">
          {archivedLoading ? (
            <p className="text-sm text-muted-foreground">Loading archived lists...</p>
          ) : archivedError ? (
            <p className="text-sm text-destructive">{archivedError}</p>
          ) : archivedLists.length === 0 ? (
            <p className="text-sm text-muted-foreground">No archived lists yet.</p>
          ) : (
            <div className="space-y-3">
              {archivedLists.map((entry) => {
                const entryCountdown = entry.kind === "list"
                  ? getArchiveCountdownLabel(entry.archivedAt, nowMs, archiveRetentionTotalMinutes)
                  : "";
                return (
                  <div key={entry.id} className="rounded-lg border border-border/60 bg-background/80 p-3">
                    <div className="flex flex-wrap items-start justify-between gap-3">
                      <div>
                        <p className="text-sm font-semibold text-foreground">{entry.name}</p>
                        <div className="mt-1 flex flex-wrap items-center gap-2">
                          <p className="text-xs text-muted-foreground">
                            {entry.kind === "list" ? "Archived list" : "Archived cards"}
                          </p>
                          {entryCountdown && (
                            <span className="rounded-full border badge-rose px-2 py-0.5 text-[10px] font-semibold">
                              {entryCountdown}
                            </span>
                          )}
                        </div>
                        {entry.archivedAt && (
                          <p className="text-[11px] text-muted-foreground">
                            Archived {new Date(entry.archivedAt).toLocaleDateString()}
                          </p>
                        )}
                      </div>
                      <Button type="button" size="sm" onClick={() => onRestore(entry)}>
                        Restore
                      </Button>
                    </div>
                    {entry.cards.length > 0 && (
                      <div className="mt-2 flex flex-wrap gap-1">
                        {entry.cards.map((card) => {
                          const cardCountdown = getArchiveCountdownLabel(card.archivedAt, nowMs, archiveRetentionTotalMinutes);
                          return (
                            <div
                              key={card.id}
                              className="flex items-center gap-2 rounded-md border border-border/50 bg-card/70 px-2 py-1 text-xs text-muted-foreground"
                            >
                              <span className="font-medium text-foreground">{card.title}</span>
                              {entry.kind === "cards" && cardCountdown && (
                                <span className="rounded-full border badge-rose px-2 py-0.5 text-[10px] font-semibold">
                                  {cardCountdown}
                                </span>
                              )}
                              {entry.kind === "cards" && (
                                <Button
                                  type="button"
                                  size="sm"
                                  variant="ghost"
                                  className="h-7 px-2 text-[11px]"
                                  onClick={() => onRestoreCard(entry, card)}
                                >
                                  Restore
                                </Button>
                              )}
                            </div>
                          );
                        })}
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
