import { useEffect, useState } from "react";
import { Link, useNavigate } from "react-router-dom";

import { ConfirmDialog } from "@/components/ui/confirm-dialog";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { boardBackgroundPresets, getBoardBackgroundClass } from "@/lib/board-backgrounds";
import { createBoard, deleteBoard, getBoards } from "@/lib/boards-api";
import type { BoardBackground, BoardSummary } from "@/types/board";

export function BoardsPage(): JSX.Element {
  const [boards, setBoards] = useState<BoardSummary[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [isCreateOpen, setIsCreateOpen] = useState(false);
  const [boardToDelete, setBoardToDelete] = useState<BoardSummary | null>(null);

  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [background, setBackground] = useState<BoardBackground>("teal-gradient");

  const navigate = useNavigate();

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

  return (
    <>
      <div className="space-y-6">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <h2 className="text-2xl font-semibold tracking-tight">Boards</h2>
            <p className="text-sm text-muted-foreground">Create and organize your team workspaces.</p>
          </div>

          <Button type="button" onClick={() => setIsCreateOpen(true)}>
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
        ) : boards.length === 0 ? (
          <Card>
            <CardHeader>
              <CardTitle>No boards yet</CardTitle>
              <CardDescription>Create your first board to start organizing lists and tasks.</CardDescription>
            </CardHeader>
          </Card>
        ) : (
          <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
            {boards.map((board) => (
              <Card key={board.id} className="overflow-hidden">
                <Link to={`/boards/${board.id}`}>
                  <div className={`h-24 w-full ${getBoardBackgroundClass(board.background)}`} />
                </Link>
                <CardHeader className="pb-3">
                  <CardTitle className="line-clamp-1 text-lg">{board.name}</CardTitle>
                  <CardDescription className="line-clamp-2">{board.description ?? "No description"}</CardDescription>
                </CardHeader>
                <CardContent className="flex items-center justify-between gap-3">
                  <p className="text-sm text-muted-foreground">{board.listCount} lists</p>
                  <div className="flex gap-2">
                    <Link to={`/boards/${board.id}`}>
                      <Button type="button" variant="secondary" size="sm">
                        Open
                      </Button>
                    </Link>
                    <Button type="button" variant="ghost" size="sm" onClick={() => setBoardToDelete(board)}>
                      Delete
                    </Button>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        )}

        {isCreateOpen && (
          <div className="fixed inset-0 z-40 flex items-center justify-center bg-black/45 p-4">
            <Card className="w-full max-w-lg">
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
                    minLength={2}
                    required
                  />
                  <textarea
                    value={description}
                    onChange={(event) => setDescription(event.target.value)}
                    placeholder="Description (optional)"
                    className="min-h-[88px] w-full rounded-md border border-input bg-card px-3 py-2 text-sm"
                    maxLength={500}
                  />

                  <div className="grid gap-2 sm:grid-cols-2">
                    {boardBackgroundPresets.map((preset) => (
                      <button
                        key={preset.id}
                        type="button"
                        onClick={() => setBackground(preset.id)}
                        className={`overflow-hidden rounded-md border text-left ${
                          background === preset.id ? "border-primary ring-2 ring-primary/40" : "border-border"
                        }`}
                      >
                        <div className={`h-12 ${preset.className}`} />
                        <p className="px-2 py-1 text-xs text-muted-foreground">{preset.label}</p>
                      </button>
                    ))}
                  </div>

                  <div className="flex justify-end gap-2">
                    <Button
                      type="button"
                      variant="ghost"
                      onClick={() => {
                        setIsCreateOpen(false);
                        resetCreateForm();
                      }}
                    >
                      Cancel
                    </Button>
                    <Button type="submit">Create</Button>
                  </div>
                </form>
              </CardContent>
            </Card>
          </div>
        )}
      </div>

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
