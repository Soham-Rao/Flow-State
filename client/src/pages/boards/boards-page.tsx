import { useEffect, useMemo, useRef, useState } from "react";
import { Link, useNavigate } from "react-router-dom";

import { ConfirmDialog } from "@/components/ui/confirm-dialog";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { boardBackgroundPresets, getBoardBackgroundClass, type BoardBackgroundPreset } from "@/lib/board-backgrounds";
import { archiveBoard, createBoard, deleteBoard, getBoards, restoreBoard } from "@/lib/boards-api";
import { listUnreadCommentMentions } from "@/lib/mentions-api";
import { useMentionStore } from "@/stores/mentions-store";
import type { BoardBackground, BoardSummary } from "@/types/board";
import type { CommentMentionDetail } from "@/types/mentions";
import { boardGlassCard, boardGlassModal, boardGlassModalInput, boardGlassOverlay, boardGlassOverlayDark, boardGlassPill, boardGlassStrong, boardGlassSubtle } from "@/pages/boards/board-glass.styles";
const BOARD_ARCHIVE_RETENTION_MINUTES = 7 * 24 * 60;

function getArchiveCountdownLabel(archivedAt: string | null, retentionMinutes: number, expiredLabel = "Deleting soon"): string {
  if (!archivedAt) return "";
  const archivedAtMs = new Date(archivedAt).getTime();
  if (Number.isNaN(archivedAtMs)) return "";
  const retentionMs = retentionMinutes * 60 * 1000;
  const remainingMs = retentionMs - (Date.now() - archivedAtMs);
  if (remainingMs <= 0) return expiredLabel;

  const second = 1000;
  const minute = 60 * second;
  const hour = 60 * minute;
  const day = 24 * hour;

  if (remainingMs >= 2 * day) {
    return `${Math.ceil(remainingMs / day)}d left`;
  }
  if (remainingMs >= 2 * hour) {
    return `${Math.ceil(remainingMs / hour)}h left`;
  }
  if (remainingMs >= 2 * minute) {
    return `${Math.ceil(remainingMs / minute)}m left`;
  }
  return `${Math.max(1, Math.ceil(remainingMs / second))}s left`;
}

export function BoardsPage(): JSX.Element {
  const [boards, setBoards] = useState<BoardSummary[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [commentMentions, setCommentMentions] = useState<CommentMentionDetail[]>([]);
  const refreshMentions = useMentionStore((state) => state.refresh);

  const [isCreateOpen, setIsCreateOpen] = useState(false);
  const [boardToDelete, setBoardToDelete] = useState<BoardSummary | null>(null);
  const [boardToArchive, setBoardToArchive] = useState<BoardSummary | null>(null);

  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [background, setBackground] = useState<BoardBackground>("teal-gradient");

  const navigate = useNavigate();

  const activeBoards = boards.filter((board) => !board.archivedAt);
  const archivedBoards = boards.filter((board) => Boolean(board.archivedAt));

  const mentionsByBoard = useMemo(() => {
    const map = new Map<string, CommentMentionDetail[]>();
    commentMentions.forEach((mention) => {
      const list = map.get(mention.boardId) ?? [];
      list.push(mention);
      map.set(mention.boardId, list);
    });
    for (const list of map.values()) {
      list.sort((a, b) => b.createdAt - a.createdAt);
    }
    return map;
  }, [commentMentions]);

  const loadCommentMentions = async (): Promise<void> => {
    try {
      const data = await listUnreadCommentMentions();
      setCommentMentions(data);
    } catch {
      // Silent fail; main boards list should still load.
    }
  };

  const getMentionLocation = (mention: CommentMentionDetail): string => {
    if (mention.cardTitle) {
      return `${mention.listName ?? "List"} • ${mention.cardTitle}`;
    }
    if (mention.listName) {
      return mention.listName;
    }
    return "Board comment";
  };

  const getMentionSnippet = (body: string): string => {
    const trimmed = body.trim();
    if (trimmed.length <= 80) return trimmed;
    return `${trimmed.slice(0, 80)}…`;
  };

  const loadBoards = async (showLoading = false): Promise<void> => {
    if (showLoading) {
      setLoading(true);
    }

    setError(null);

    try {
      const data = await getBoards();
      setBoards(data);
    } catch (loadError) {
      const message = loadError instanceof Error ? loadError.message : "Failed to load boards";
      setError(message);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    void loadBoards(true);
  }, []);

  useEffect(() => {
    void loadCommentMentions();
    const interval = window.setInterval(() => {
      void loadCommentMentions();
    }, 3000);
    return () => window.clearInterval(interval);
  }, []);

  useEffect(() => {
    if (!isCreateOpen) return;
    const handleKeyDown = (event: KeyboardEvent): void => {
      if (event.key === "Escape") {
        event.preventDefault();
        setIsCreateOpen(false);
        resetCreateForm();
      }
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [isCreateOpen]);

  const resetCreateForm = (): void => {
    setName("");
    setDescription("");
    setBackground("teal-gradient");
  };

  const onCreateBoard = async (event: React.FormEvent<HTMLFormElement>): Promise<void> => {
    event.preventDefault();

    if (name.trim().length < 2) {
      setError("Board name must be at least 2 characters.");
      return;
    }

    try {
      const created = await createBoard({
        name: name.trim(),
        description: description.trim(),
        background
      });

      resetCreateForm();
      setIsCreateOpen(false);
      navigate(`/boards/${created.id}`);
    } catch (createError) {
      const message = createError instanceof Error ? createError.message : "Failed to create board";
      setError(message);
    }
  };

  const confirmDeleteBoard = async (): Promise<void> => {
    if (!boardToDelete) {
      return;
    }

    try {
      await deleteBoard(boardToDelete.id);
      setBoards((current) => current.filter((board) => board.id !== boardToDelete.id));
      setBoardToDelete(null);
      setError(null);
    } catch (deleteError) {
      const message = deleteError instanceof Error ? deleteError.message : "Failed to delete board";
      setError(message);
    }
  };

  const confirmArchiveBoard = async (): Promise<void> => {
    if (!boardToArchive) {
      return;
    }

    try {
      await archiveBoard(boardToArchive.id);
      setBoardToArchive(null);
      await loadBoards();
      setError(null);
    } catch (archiveError) {
      const message = archiveError instanceof Error ? archiveError.message : "Failed to archive board";
      setError(message);
    }
  };

  const onRestoreBoard = async (boardId: string): Promise<void> => {
    try {
      await restoreBoard(boardId);
      await loadBoards();
      setError(null);
    } catch (restoreError) {
      const message = restoreError instanceof Error ? restoreError.message : "Failed to restore board";
      setError(message);
    }
  };

  return (
    <>
      <div className="space-y-6">
        <div className={`flex flex-wrap items-center justify-between gap-3 rounded-2xl px-4 py-3 ${boardGlassCard}`}>
          <div>
            <h2 className="text-2xl font-semibold tracking-tight">Boards</h2>
            <p className="text-sm text-muted-foreground">Create and organize your team workspaces.</p>
          </div>

          <Button type="button" onClick={() => setIsCreateOpen(true)} className={boardGlassPill}>
            New board
          </Button>
        </div>

        {error && (
          <p className="rounded-md border border-destructive/20 bg-destructive/10 px-3 py-2 text-sm text-destructive">
            {error}
          </p>
        )}

        {loading ? (
          <p className="text-sm text-muted-foreground">Loading boards...</p>
        ) : activeBoards.length === 0 ? (
          <Card className={boardGlassCard}>
            <CardHeader>
              <CardTitle>No active boards yet</CardTitle>
              <CardDescription>
                {archivedBoards.length > 0
                  ? "All current boards are archived. Restore one below or create a new board."
                  : "Create your first board to start organizing lists and tasks."}
              </CardDescription>
            </CardHeader>
          </Card>
        ) : (
          <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
            {activeBoards.map((board) => (
              <Card key={board.id} className={`overflow-hidden ${boardGlassCard}`}>
                <Link to={`/boards/${board.id}`}>
                  <div className={`h-24 w-full ${getBoardBackgroundClass(board.background)}`} />
                </Link>
                <CardHeader className="pb-3">
                  <div className="flex items-start justify-between gap-2">
                    <CardTitle className="line-clamp-1 text-lg">{board.name}</CardTitle>
                    {(() => {
                      const boardMentions = mentionsByBoard.get(board.id) ?? [];
                      const badgeMentions = boardMentions;
                      if (badgeMentions.length === 0) return null;
                      return (
                        <div className="relative group/mentions">
                          <button
                            type="button"
                            className="rounded-full bg-rose-500/90 px-2 py-0.5 text-[10px] font-semibold text-white shadow-sm"
                          >
                            {badgeMentions.length}
                          </button>
                          <div className={`pointer-events-none absolute right-0 top-7 z-10 w-72 translate-y-1 rounded-lg p-3 text-left opacity-0 shadow-lg transition ${boardGlassStrong} group-hover/mentions:pointer-events-auto group-hover/mentions:opacity-100`}>
                            <p className="text-[10px] font-semibold uppercase tracking-[0.2em] text-muted-foreground">Mentions</p>
                            <div className="mt-2 space-y-2">
                              {badgeMentions.map((mention) => (
                                <div key={mention.commentId} className={`rounded-md px-2 py-2 ${boardGlassSubtle}`}>
                                  <p className="text-xs font-semibold">{getMentionLocation(mention)}</p>
                                  <p className="mt-1 text-[10px] text-muted-foreground">{getMentionSnippet(mention.body)}</p>
                                </div>
                              ))}
                            </div>
                            <p className="mt-2 text-[10px] text-muted-foreground">Open the board to review mentions.</p>
                          </div>
                        </div>
                      );
                    })()}
                  </div>
                  <CardDescription className="line-clamp-2">{board.description ?? "No description"}</CardDescription>
                </CardHeader>
                <CardContent className="flex items-center justify-between gap-3">
                  <p className="text-sm text-muted-foreground">{board.listCount} lists</p>
                  <div className="flex gap-2">
                    <Link to={`/boards/${board.id}`}>
                      <Button type="button" variant="secondary" size="sm" className={boardGlassPill}>
                        Open
                      </Button>
                    </Link>
                    <Button
                      type="button"
                      variant="ghost"
                      size="sm"
                      className={`text-amber-600 hover:text-amber-700 ${boardGlassPill}`}
                      onClick={() => setBoardToArchive(board)}
                    >
                      Archive
                    </Button>
                    <Button type="button" variant="ghost" size="sm" className={boardGlassPill} onClick={() => setBoardToDelete(board)}>
                      Delete
                    </Button>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        )}

        {archivedBoards.length > 0 && (
          <div className="space-y-3">
            <div>
              <h3 className="text-lg font-semibold">Archived boards</h3>
              <p className="text-xs text-muted-foreground">
                Archived boards auto-delete after 7 days unless restored.
              </p>
            </div>
            <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
              {archivedBoards.map((board) => {
                const countdownLabel = getArchiveCountdownLabel(board.archivedAt, BOARD_ARCHIVE_RETENTION_MINUTES);
                return (
                <Card key={board.id} className={`overflow-hidden ${boardGlassCard} border-amber-200/60 dark:border-amber-200/30`}>
                  <div className={`h-20 w-full ${getBoardBackgroundClass(board.background)}`} />
                  <CardHeader className="pb-3">
                    <div className="flex items-center justify-between gap-2">
                      <CardTitle className="line-clamp-1 text-lg">{board.name}</CardTitle>
                      <div className="flex items-center gap-2">
                        <span className="rounded-full border badge-amber px-2 py-0.5 text-[10px] font-semibold">
                          Archived
                        </span>
                        {countdownLabel && (
                          <span className="rounded-full border badge-rose px-2 py-0.5 text-[10px] font-semibold">
                            {countdownLabel}
                          </span>
                        )}
                      </div>
                    </div>
                    <CardDescription className="line-clamp-2">{board.description ?? "No description"}</CardDescription>
                  </CardHeader>
                  <CardContent className="flex items-center justify-between gap-3">
                    <p className="text-xs text-muted-foreground">
                      Archived {board.archivedAt ? new Date(board.archivedAt).toLocaleDateString() : "recently"}
                    </p>
                    <Button type="button" size="sm" className={boardGlassPill} onClick={() => { void onRestoreBoard(board.id); }}>
                      Restore
                    </Button>
                  </CardContent>
                </Card>
              );
              })}
            </div>
          </div>
        )}

        {isCreateOpen && (
          <div className={`fixed inset-0 z-[70] h-[100dvh] w-screen flex items-center justify-center ${boardGlassOverlay} ${boardGlassOverlayDark} p-4`}
            onMouseDown={(event) => {
              if (event.target === event.currentTarget) {
                setIsCreateOpen(false);
                resetCreateForm();
              }
            }}
          >
            <Card className={`w-full max-w-lg ${boardGlassModal}`} onMouseDown={(event) => event.stopPropagation()}>
              <CardHeader>
                <CardTitle>Create board</CardTitle>
                <CardDescription>Choose a name, short description, and visual background.</CardDescription>
              </CardHeader>
              <CardContent>
                <form className="space-y-4" onSubmit={onCreateBoard}>
                  <Input
                    value={name}
                    onChange={(event) => setName(event.target.value)}
                    placeholder="Board name"
                    className={boardGlassModalInput}
                    minLength={2}
                    required
                  />
                  <textarea
                    value={description}
                    onChange={(event) => setDescription(event.target.value)}
                    placeholder="Description (optional)"
                    className={`min-h-[88px] w-full rounded-md px-3 py-2 text-sm ${boardGlassModalInput}`}
                    maxLength={500}
                  />

                  <div className="grid gap-2 sm:grid-cols-2">
                    {boardBackgroundPresets.map((preset: BoardBackgroundPreset) => (
                      <button
                        key={preset.id}
                        type="button"
                        onClick={() => setBackground(preset.id)}
                        className={`overflow-hidden rounded-md border text-left ${boardGlassSubtle} ${
                          background === preset.id ? "border-primary ring-2 ring-primary/40" : "border-border"
                        }`}
                      >
                        <div className={`h-12 ${preset.className}`} />
                        <p className="px-2 py-1 text-xs text-white">{preset.label}</p>
                      </button>
                    ))}
                  </div>

                  <div className="flex justify-end gap-2">
                    <Button
                      type="button"
                      variant="ghost"
                      className={`${boardGlassPill}`}
                      onClick={() => {
                        setIsCreateOpen(false);
                        resetCreateForm();
                      }}
                    >
                      Cancel
                    </Button>
                    <Button type="submit" className={`${boardGlassPill}`}>Create</Button>
                  </div>
                </form>
              </CardContent>
            </Card>
          </div>
        )}
      </div>

      <ConfirmDialog
        open={boardToArchive !== null}
        title="Archive board"
        description={`Archive "${boardToArchive?.name ?? "this board"}"? You can restore it for 7 days.`}
        confirmLabel="Archive"
        cancelLabel="Cancel"
        onCancel={() => setBoardToArchive(null)}
        onConfirm={() => {
          void confirmArchiveBoard();
        }}
      />
      <ConfirmDialog
        open={boardToDelete !== null}
        title="Delete board"
        description={`Delete "${boardToDelete?.name ?? "this board"}" and all of its lists?`}
        confirmLabel="Delete"
        cancelLabel="Keep"
        onCancel={() => setBoardToDelete(null)}
        onConfirm={() => {
          void confirmDeleteBoard();
        }}
      />
    </>
  );
}































