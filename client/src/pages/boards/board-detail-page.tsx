import { useCallback, useEffect, useMemo, useState } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";

import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { boardBackgroundPresets, getBoardBackgroundClass } from "@/lib/board-backgrounds";
import {
  createList,
  deleteBoard,
  deleteList,
  getBoardById,
  reorderLists,
  updateBoard,
  updateList
} from "@/lib/boards-api";
import type { BoardBackground, BoardDetail } from "@/types/board";

export function BoardDetailPage(): JSX.Element {
  const { boardId } = useParams<{ boardId: string }>();
  const navigate = useNavigate();

  const [board, setBoard] = useState<BoardDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [boardName, setBoardName] = useState("");
  const [boardDescription, setBoardDescription] = useState("");
  const [boardBackground, setBoardBackground] = useState<BoardBackground>("teal-gradient");

  const [newListName, setNewListName] = useState("");
  const [newListDone, setNewListDone] = useState(false);
  const [listNameDrafts, setListNameDrafts] = useState<Record<string, string>>({});

  const activeBackgroundClass = useMemo(() => {
    return board ? getBoardBackgroundClass(board.background) : "";
  }, [board]);

  const loadBoard = useCallback(async (): Promise<void> => {
    if (!boardId) {
      return;
    }

    setLoading(true);
    setError(null);

    try {
      const data = await getBoardById(boardId);
      setBoard(data);
      setBoardName(data.name);
      setBoardDescription(data.description ?? "");
      setBoardBackground(data.background);
      setListNameDrafts(Object.fromEntries(data.lists.map((list) => [list.id, list.name])));
    } catch (loadError) {
      const message = loadError instanceof Error ? loadError.message : "Failed to load board";
      setError(message);
    } finally {
      setLoading(false);
    }
  }, [boardId]);

  useEffect(() => {
    void loadBoard();
  }, [loadBoard]);

  const onSaveBoard = async (): Promise<void> => {
    if (!boardId) {
      return;
    }

    if (boardName.trim().length < 2) {
      setError("Board name must be at least 2 characters.");
      return;
    }

    try {
      const updated = await updateBoard(boardId, {
        name: boardName.trim(),
        description: boardDescription.trim(),
        background: boardBackground
      });

      setBoard(updated);
      setError(null);
    } catch (updateError) {
      const message = updateError instanceof Error ? updateError.message : "Failed to update board";
      setError(message);
    }
  };

  const onDeleteBoard = async (): Promise<void> => {
    if (!boardId) {
      return;
    }

    const confirmed = window.confirm("Delete this board and all of its lists?");
    if (!confirmed) {
      return;
    }

    try {
      await deleteBoard(boardId);
      navigate("/boards");
    } catch (deleteError) {
      const message = deleteError instanceof Error ? deleteError.message : "Failed to delete board";
      setError(message);
    }
  };

  const onCreateList = async (event: React.FormEvent<HTMLFormElement>): Promise<void> => {
    event.preventDefault();

    if (!boardId) {
      return;
    }

    if (newListName.trim().length < 1) {
      setError("List name cannot be empty.");
      return;
    }

    try {
      await createList(boardId, {
        name: newListName.trim(),
        isDoneList: newListDone
      });

      setNewListName("");
      setNewListDone(false);
      await loadBoard();
    } catch (createError) {
      const message = createError instanceof Error ? createError.message : "Failed to create list";
      setError(message);
    }
  };

  const onSaveList = async (listId: string): Promise<void> => {
    const draft = listNameDrafts[listId];
    if (!draft || draft.trim().length < 1) {
      setError("List name cannot be empty.");
      return;
    }

    try {
      await updateList(listId, {
        name: draft.trim()
      });
      await loadBoard();
    } catch (updateError) {
      const message = updateError instanceof Error ? updateError.message : "Failed to update list";
      setError(message);
    }
  };

  const onToggleDone = async (listId: string, isDoneList: boolean): Promise<void> => {
    try {
      await updateList(listId, {
        isDoneList: !isDoneList
      });
      await loadBoard();
    } catch (updateError) {
      const message = updateError instanceof Error ? updateError.message : "Failed to update list";
      setError(message);
    }
  };

  const onDeleteList = async (listId: string): Promise<void> => {
    const confirmed = window.confirm("Delete this list?");
    if (!confirmed) {
      return;
    }

    try {
      await deleteList(listId);
      await loadBoard();
    } catch (deleteError) {
      const message = deleteError instanceof Error ? deleteError.message : "Failed to delete list";
      setError(message);
    }
  };

  const onMoveList = async (listId: string, direction: -1 | 1): Promise<void> => {
    if (!boardId || !board) {
      return;
    }

    const index = board.lists.findIndex((list) => list.id === listId);
    const targetIndex = index + direction;

    if (index < 0 || targetIndex < 0 || targetIndex >= board.lists.length) {
      return;
    }

    const reordered = [...board.lists];
    const [item] = reordered.splice(index, 1);
    reordered.splice(targetIndex, 0, item);

    try {
      await reorderLists(
        boardId,
        reordered.map((list) => list.id)
      );
      await loadBoard();
    } catch (reorderError) {
      const message = reorderError instanceof Error ? reorderError.message : "Failed to reorder lists";
      setError(message);
    }
  };

  if (loading) {
    return <p className="text-sm text-muted-foreground">Loading board...</p>;
  }

  if (!board) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>Board not found</CardTitle>
          <CardDescription>The board may have been deleted or is unavailable.</CardDescription>
        </CardHeader>
        <CardContent>
          <Link to="/boards">
            <Button>Back to boards</Button>
          </Link>
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-6">
      <div className={`h-28 rounded-xl ${activeBackgroundClass}`} />

      <div className="flex items-center justify-between gap-3">
        <div>
          <h2 className="text-2xl font-semibold tracking-tight">{board.name}</h2>
          <p className="text-sm text-muted-foreground">Manage lists and board settings.</p>
        </div>
        <Link to="/boards">
          <Button variant="ghost">Back to boards</Button>
        </Link>
      </div>

      {error && (
        <p className="rounded-md border border-destructive/20 bg-destructive/10 px-3 py-2 text-sm text-destructive">
          {error}
        </p>
      )}

      <Card>
        <CardHeader>
          <CardTitle>Board Settings</CardTitle>
          <CardDescription>Update name, description and background.</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <Input value={boardName} onChange={(event) => setBoardName(event.target.value)} />
          <textarea
            value={boardDescription}
            onChange={(event) => setBoardDescription(event.target.value)}
            placeholder="Description"
            className="min-h-[88px] w-full rounded-md border border-input bg-card px-3 py-2 text-sm"
          />

          <div className="grid gap-2 sm:grid-cols-3 lg:grid-cols-5">
            {boardBackgroundPresets.map((preset) => (
              <button
                key={preset.id}
                type="button"
                onClick={() => setBoardBackground(preset.id)}
                className={`overflow-hidden rounded-md border text-left ${
                  boardBackground === preset.id ? "border-primary ring-2 ring-primary/40" : "border-border"
                }`}
              >
                <div className={`h-10 ${preset.className}`} />
                <p className="px-2 py-1 text-[11px] text-muted-foreground">{preset.label}</p>
              </button>
            ))}
          </div>

          <div className="flex flex-wrap gap-2">
            <Button onClick={() => void onSaveBoard()}>Save board</Button>
            <Button variant="ghost" onClick={() => void onDeleteBoard()}>
              Delete board
            </Button>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Create List</CardTitle>
          <CardDescription>Add a new column to this board.</CardDescription>
        </CardHeader>
        <CardContent>
          <form className="grid gap-3 sm:grid-cols-[1fr_auto_auto]" onSubmit={onCreateList}>
            <Input
              value={newListName}
              onChange={(event) => setNewListName(event.target.value)}
              placeholder="List name"
            />
            <label className="flex items-center gap-2 text-sm text-muted-foreground">
              <input
                type="checkbox"
                checked={newListDone}
                onChange={(event) => setNewListDone(event.target.checked)}
              />
              Done list
            </label>
            <Button type="submit">Add list</Button>
          </form>
        </CardContent>
      </Card>

      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
        {board.lists.map((list, index) => (
          <Card key={list.id}>
            <CardHeader className="pb-3">
              <CardTitle className="text-base">List {index + 1}</CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              <Input
                value={listNameDrafts[list.id] ?? list.name}
                onChange={(event) =>
                  setListNameDrafts((current) => ({
                    ...current,
                    [list.id]: event.target.value
                  }))
                }
              />

              <div className="flex items-center justify-between text-xs text-muted-foreground">
                <span>{list.isDoneList ? "Done list" : "Active list"}</span>
                <button
                  type="button"
                  className="underline underline-offset-2"
                  onClick={() => void onToggleDone(list.id, list.isDoneList)}
                >
                  Toggle
                </button>
              </div>

              <div className="rounded-md border border-dashed border-border/70 px-3 py-3 text-sm text-muted-foreground">
                Cards will be available in Phase 3.
              </div>

              <div className="flex flex-wrap gap-2">
                <Button size="sm" variant="secondary" onClick={() => void onSaveList(list.id)}>
                  Save
                </Button>
                <Button size="sm" variant="ghost" onClick={() => void onMoveList(list.id, -1)}>
                  Move left
                </Button>
                <Button size="sm" variant="ghost" onClick={() => void onMoveList(list.id, 1)}>
                  Move right
                </Button>
                <Button size="sm" variant="ghost" onClick={() => void onDeleteList(list.id)}>
                  Delete
                </Button>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>
    </div>
  );
}
