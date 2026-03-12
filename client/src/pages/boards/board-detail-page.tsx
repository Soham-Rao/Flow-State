import { ChevronDown, ChevronUp, GripVertical, Pencil, Trash2 } from "lucide-react";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";

import { ConfirmDialog } from "@/components/ui/confirm-dialog";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { boardBackgroundPresets, getBoardBackgroundClass, getBoardSurfaceClass } from "@/lib/board-backgrounds";
import {
  createList,
  deleteBoard,
  deleteList,
  getBoardById,
  reorderLists,
  updateBoard,
  updateList
} from "@/lib/boards-api";
import type { BoardBackground, BoardDetail, BoardList } from "@/types/board";

interface BoardDraft {
  name: string;
  description: string;
  background: BoardBackground;
}

const AUTO_SAVE_DELAY_MS = 750;
const SAVED_TOAST_SHOW_DELAY_MS = 250;
const SAVED_TOAST_VISIBLE_MS = 1500;

function sortListsByPosition(values: BoardList[]): BoardList[] {
  return [...values].sort((a, b) => a.position - b.position);
}

function moveListIds(listIds: string[], sourceId: string, targetId: string): string[] {
  const sourceIndex = listIds.indexOf(sourceId);
  const targetIndex = listIds.indexOf(targetId);

  if (sourceIndex < 0 || targetIndex < 0 || sourceIndex === targetIndex) {
    return listIds;
  }

  const nextIds = [...listIds];
  const [source] = nextIds.splice(sourceIndex, 1);
  nextIds.splice(targetIndex, 0, source);

  return nextIds;
}

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
  const [editingListId, setEditingListId] = useState<string | null>(null);

  const [isSettingsOpen, setIsSettingsOpen] = useState(false);
  const [isDeleteBoardOpen, setIsDeleteBoardOpen] = useState(false);
  const [listToDelete, setListToDelete] = useState<BoardList | null>(null);

  const [draggingListId, setDraggingListId] = useState<string | null>(null);
  const [dragOverListId, setDragOverListId] = useState<string | null>(null);

  const [isAutosavingBoard, setIsAutosavingBoard] = useState(false);
  const [listSavingIds, setListSavingIds] = useState<Set<string>>(new Set());
  const [showSavedNotice, setShowSavedNotice] = useState(false);

  const autoSaveTimeoutRef = useRef<number | null>(null);
  const listAutoSaveTimeoutsRef = useRef<Record<string, number>>({});
  const listInputRefs = useRef<Record<string, HTMLInputElement | null>>({});
  const savedShowTimeoutRef = useRef<number | null>(null);
  const savedHideTimeoutRef = useRef<number | null>(null);

  const lastSyncedBoardRef = useRef<BoardDraft | null>(null);
  const currentDraftBoardRef = useRef<BoardDraft | null>(null);
  const listSyncedNamesRef = useRef<Record<string, string>>({});
  const initializedBoardRef = useRef(false);

  const orderedLists = useMemo(() => {
    return board ? sortListsByPosition(board.lists) : [];
  }, [board]);

  const activeBannerClass = useMemo(() => {
    return getBoardBackgroundClass(boardBackground);
  }, [boardBackground]);

  const activeSurfaceClass = useMemo(() => {
    return getBoardSurfaceClass(boardBackground);
  }, [boardBackground]);

  const focusListInput = useCallback((listId: string): void => {
    window.requestAnimationFrame(() => {
      const input = listInputRefs.current[listId];
      if (!input) {
        return;
      }

      input.focus({ preventScroll: true });
      const cursorAt = input.value.length;
      input.setSelectionRange(cursorAt, cursorAt);
    });
  }, []);

  const clearSavedNoticeTimers = useCallback((): void => {
    if (savedShowTimeoutRef.current !== null) {
      window.clearTimeout(savedShowTimeoutRef.current);
      savedShowTimeoutRef.current = null;
    }

    if (savedHideTimeoutRef.current !== null) {
      window.clearTimeout(savedHideTimeoutRef.current);
      savedHideTimeoutRef.current = null;
    }
  }, []);

  const triggerSavedNotice = useCallback((): void => {
    setShowSavedNotice(false);
    clearSavedNoticeTimers();

    savedShowTimeoutRef.current = window.setTimeout(() => {
      setShowSavedNotice(true);

      savedHideTimeoutRef.current = window.setTimeout(() => {
        setShowSavedNotice(false);
      }, SAVED_TOAST_VISIBLE_MS);
    }, SAVED_TOAST_SHOW_DELAY_MS);
  }, [clearSavedNoticeTimers]);

  const clearListAutosaveTimeout = (listId: string): void => {
    const timeout = listAutoSaveTimeoutsRef.current[listId];
    if (timeout !== undefined) {
      window.clearTimeout(timeout);
      delete listAutoSaveTimeoutsRef.current[listId];
    }
  };

  const clearAllListAutosaveTimeouts = (): void => {
    Object.values(listAutoSaveTimeoutsRef.current).forEach((timeout) => {
      window.clearTimeout(timeout);
    });

    listAutoSaveTimeoutsRef.current = {};
  };

  const hydrateBoardState = useCallback((data: BoardDetail): void => {
    const sortedLists = sortListsByPosition(data.lists);

    setBoard({
      ...data,
      lists: sortedLists
    });

    setBoardName(data.name);
    setBoardDescription(data.description ?? "");
    setBoardBackground(data.background);
    setListNameDrafts(Object.fromEntries(sortedLists.map((list) => [list.id, list.name])));

    listSyncedNamesRef.current = Object.fromEntries(sortedLists.map((list) => [list.id, list.name]));

    const syncedDraft: BoardDraft = {
      name: data.name.trim(),
      description: (data.description ?? "").trim(),
      background: data.background
    };

    lastSyncedBoardRef.current = syncedDraft;
    currentDraftBoardRef.current = syncedDraft;
    initializedBoardRef.current = true;

    setListSavingIds(new Set());
    setEditingListId((current) => {
      if (!current) {
        return current;
      }

      return sortedLists.some((list) => list.id === current) ? current : null;
    });
  }, []);

  const loadBoard = useCallback(async (): Promise<void> => {
    if (!boardId) {
      return;
    }

    setLoading(true);
    setError(null);

    try {
      const data = await getBoardById(boardId);
      hydrateBoardState(data);
    } catch (loadError) {
      const message = loadError instanceof Error ? loadError.message : "Failed to load board";
      setError(message);
    } finally {
      setLoading(false);
    }
  }, [boardId, hydrateBoardState]);

  useEffect(() => {
    void loadBoard();
  }, [loadBoard]);

  useEffect(() => {
    if (!editingListId) {
      return;
    }

    focusListInput(editingListId);
  }, [editingListId, focusListInput]);

  const runBoardAutosave = useCallback(async (): Promise<void> => {
    if (!boardId) {
      return;
    }

    const draft = currentDraftBoardRef.current;
    const synced = lastSyncedBoardRef.current;

    if (!draft || !synced) {
      return;
    }

    const hasChanges =
      draft.name !== synced.name || draft.description !== synced.description || draft.background !== synced.background;

    if (!hasChanges) {
      return;
    }

    if (draft.name.length < 2) {
      setError("Board name must be at least 2 characters.");
      return;
    }

    setIsAutosavingBoard(true);

    try {
      const updated = await updateBoard(boardId, {
        name: draft.name,
        description: draft.description,
        background: draft.background
      });

      hydrateBoardState(updated);
      setError(null);
      triggerSavedNotice();
    } catch (updateError) {
      const message = updateError instanceof Error ? updateError.message : "Failed to update board";
      setError(message);
    } finally {
      setIsAutosavingBoard(false);
    }
  }, [boardId, hydrateBoardState, triggerSavedNotice]);

  const runListNameAutosave = useCallback(
    async (listId: string, rawName: string): Promise<void> => {
      const name = rawName.trim();
      const syncedName = listSyncedNamesRef.current[listId];

      if (syncedName === undefined) {
        return;
      }

      if (name.length < 1) {
        setError("List name cannot be empty.");
        return;
      }

      if (name === syncedName) {
        return;
      }

      setListSavingIds((current) => {
        const next = new Set(current);
        next.add(listId);
        return next;
      });

      try {
        const updated = await updateList(listId, { name });

        listSyncedNamesRef.current[updated.id] = updated.name;

        setBoard((current) => {
          if (!current) {
            return current;
          }

          return {
            ...current,
            lists: current.lists.map((list) => (list.id === updated.id ? updated : list))
          };
        });

        setListNameDrafts((current) => ({
          ...current,
          [updated.id]: updated.name
        }));

        setError(null);
        triggerSavedNotice();
      } catch (updateError) {
        const message = updateError instanceof Error ? updateError.message : "Failed to update list";
        setError(message);
      } finally {
        setListSavingIds((current) => {
          const next = new Set(current);
          next.delete(listId);
          return next;
        });
      }
    },
    [triggerSavedNotice]
  );

  const scheduleListNameAutosave = useCallback(
    (listId: string, draftName: string): void => {
      clearListAutosaveTimeout(listId);

      listAutoSaveTimeoutsRef.current[listId] = window.setTimeout(() => {
        void runListNameAutosave(listId, draftName);
      }, AUTO_SAVE_DELAY_MS);
    },
    [runListNameAutosave]
  );

  useEffect(() => {
    if (!initializedBoardRef.current || !boardId) {
      return;
    }

    const nextDraft: BoardDraft = {
      name: boardName.trim(),
      description: boardDescription.trim(),
      background: boardBackground
    };

    currentDraftBoardRef.current = nextDraft;

    const synced = lastSyncedBoardRef.current;
    const hasChanges =
      synced !== null &&
      (nextDraft.name !== synced.name ||
        nextDraft.description !== synced.description ||
        nextDraft.background !== synced.background);

    if (!hasChanges) {
      return;
    }

    setShowSavedNotice(false);
    clearSavedNoticeTimers();

    if (autoSaveTimeoutRef.current !== null) {
      window.clearTimeout(autoSaveTimeoutRef.current);
    }

    autoSaveTimeoutRef.current = window.setTimeout(() => {
      void runBoardAutosave();
    }, AUTO_SAVE_DELAY_MS);

    return () => {
      if (autoSaveTimeoutRef.current !== null) {
        window.clearTimeout(autoSaveTimeoutRef.current);
        autoSaveTimeoutRef.current = null;
      }
    };
  }, [boardId, boardName, boardDescription, boardBackground, runBoardAutosave, clearSavedNoticeTimers]);

  useEffect(() => {
    return () => {
      if (autoSaveTimeoutRef.current !== null) {
        window.clearTimeout(autoSaveTimeoutRef.current);
      }

      clearAllListAutosaveTimeouts();
      clearSavedNoticeTimers();
    };
  }, [clearSavedNoticeTimers]);

  const onDeleteBoard = async (): Promise<void> => {
    if (!boardId) {
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
      const created = await createList(boardId, {
        name: newListName.trim(),
        isDoneList: newListDone
      });

      listSyncedNamesRef.current[created.id] = created.name;

      setBoard((current) => {
        if (!current) {
          return current;
        }

        return {
          ...current,
          lists: sortListsByPosition([...current.lists, created])
        };
      });

      setListNameDrafts((current) => ({
        ...current,
        [created.id]: created.name
      }));

      setNewListName("");
      setNewListDone(false);
      setError(null);
    } catch (createError) {
      const message = createError instanceof Error ? createError.message : "Failed to create list";
      setError(message);
    }
  };

  const onToggleDone = async (listId: string, isDoneList: boolean): Promise<void> => {
    try {
      const updated = await updateList(listId, {
        isDoneList: !isDoneList
      });

      setBoard((current) => {
        if (!current) {
          return current;
        }

        return {
          ...current,
          lists: current.lists.map((list) => (list.id === updated.id ? updated : list))
        };
      });

      setError(null);
    } catch (updateError) {
      const message = updateError instanceof Error ? updateError.message : "Failed to update list";
      setError(message);
    }
  };

  const closeListEditor = useCallback(
    async (list: BoardList): Promise<void> => {
      if (editingListId !== list.id) {
        return;
      }

      const draft = listNameDrafts[list.id] ?? list.name;
      const trimmed = draft.trim();

      if (trimmed.length < 1) {
        const syncedName = listSyncedNamesRef.current[list.id] ?? list.name;
        setListNameDrafts((current) => ({
          ...current,
          [list.id]: syncedName
        }));
        setEditingListId(null);
        setError("List name cannot be empty.");
        return;
      }

      setEditingListId(null);
      clearListAutosaveTimeout(list.id);
      await runListNameAutosave(list.id, draft);
    },
    [editingListId, listNameDrafts, runListNameAutosave]
  );

  const cancelListEditor = useCallback((list: BoardList): void => {
    clearListAutosaveTimeout(list.id);
    const syncedName = listSyncedNamesRef.current[list.id] ?? list.name;
    setListNameDrafts((current) => ({
      ...current,
      [list.id]: syncedName
    }));
    setEditingListId(null);
  }, []);

  const onToggleListEdit = async (list: BoardList): Promise<void> => {
    if (editingListId === list.id) {
      await closeListEditor(list);
      return;
    }

    setEditingListId(list.id);
  };

  const onDeleteList = async (): Promise<void> => {
    if (!listToDelete) {
      return;
    }

    try {
      await deleteList(listToDelete.id);

      clearListAutosaveTimeout(listToDelete.id);
      delete listSyncedNamesRef.current[listToDelete.id];

      setBoard((current) => {
        if (!current) {
          return current;
        }

        return {
          ...current,
          lists: current.lists.filter((list) => list.id !== listToDelete.id)
        };
      });

      setListNameDrafts((current) => {
        const nextDrafts = { ...current };
        delete nextDrafts[listToDelete.id];
        return nextDrafts;
      });

      setListSavingIds((current) => {
        const next = new Set(current);
        next.delete(listToDelete.id);
        return next;
      });

      if (editingListId === listToDelete.id) {
        setEditingListId(null);
      }

      setListToDelete(null);
      setError(null);
    } catch (deleteError) {
      const message = deleteError instanceof Error ? deleteError.message : "Failed to delete list";
      setError(message);
    }
  };

  const onDropList = async (targetListId: string): Promise<void> => {
    if (!boardId || !board || !draggingListId) {
      return;
    }

    if (draggingListId === targetListId) {
      return;
    }

    const currentIds = orderedLists.map((list) => list.id);
    const nextIds = moveListIds(currentIds, draggingListId, targetListId);

    if (currentIds.join(":") === nextIds.join(":")) {
      return;
    }

    const byId = new Map(board.lists.map((list) => [list.id, list]));
    const optimisticLists = nextIds
      .map((id, index) => {
        const found = byId.get(id);
        if (!found) {
          return null;
        }

        return {
          ...found,
          position: index
        };
      })
      .filter((list): list is BoardList => list !== null);

    const previousLists = board.lists;

    setBoard((current) => {
      if (!current) {
        return current;
      }

      return {
        ...current,
        lists: optimisticLists
      };
    });

    try {
      const updatedLists = await reorderLists(boardId, nextIds);

      setBoard((current) => {
        if (!current) {
          return current;
        }

        return {
          ...current,
          lists: sortListsByPosition(updatedLists)
        };
      });

      setError(null);
    } catch (reorderError) {
      const message = reorderError instanceof Error ? reorderError.message : "Failed to reorder lists";
      setError(message);

      setBoard((current) => {
        if (!current) {
          return current;
        }

        return {
          ...current,
          lists: previousLists
        };
      });
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
            <Button type="button">Back to boards</Button>
          </Link>
        </CardContent>
      </Card>
    );
  }

  return (
    <>
      <div className={`-mx-4 -my-4 space-y-6 px-4 py-4 lg:-mx-6 lg:-my-6 lg:px-6 lg:py-6 ${activeSurfaceClass}`}>
        <div className={`h-28 rounded-xl ${activeBannerClass}`} />

        <div className="flex items-center justify-between gap-3">
          <div>
            <h2 className="text-2xl font-semibold tracking-tight">{boardName}</h2>
            <p className="text-sm text-muted-foreground">Focus on lists first. Board settings are available below.</p>
          </div>
          <Link to="/boards">
            <Button type="button" variant="ghost">
              Back to boards
            </Button>
          </Link>
        </div>

        {error && (
          <p className="rounded-md border border-destructive/20 bg-destructive/10 px-3 py-2 text-sm text-destructive">
            {error}
          </p>
        )}

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

        <div>
          <p className="mb-3 text-xs uppercase tracking-wide text-muted-foreground">Drag lists to reorder</p>
          <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
            {orderedLists.map((list) => (
              <div
                key={list.id}
                className={dragOverListId === list.id ? "rounded-lg ring-2 ring-primary/40" : ""}
                onDragOver={(event) => {
                  event.preventDefault();
                  if (draggingListId && draggingListId !== list.id) {
                    setDragOverListId(list.id);
                  }
                }}
                onDrop={(event) => {
                  event.preventDefault();
                  void onDropList(list.id);
                  setDragOverListId(null);
                  setDraggingListId(null);
                }}
              >
                <Card>
                  <CardHeader className="pb-3">
                    <div className="flex items-center justify-between gap-2">
                      <CardTitle className="text-base font-semibold">{listNameDrafts[list.id] ?? list.name}</CardTitle>

                      <div className="flex items-center gap-1">
                        <Button
                          type="button"
                          variant="ghost"
                          size="sm"
                          className="h-8 w-8 p-0"
                          onClick={() => {
                            void onToggleListEdit(list);
                          }}
                          title={editingListId === list.id ? "Done editing" : "Edit list name"}
                        >
                          <Pencil className="h-4 w-4" />
                        </Button>

                        <Button
                          type="button"
                          variant="ghost"
                          size="sm"
                          className="h-8 w-8 p-0 text-red-600 hover:text-red-700"
                          onClick={() => setListToDelete(list)}
                          title="Delete list"
                        >
                          <Trash2 className="h-4 w-4" />
                        </Button>

                        <button
                          type="button"
                          draggable
                          onDragStart={() => setDraggingListId(list.id)}
                          onDragEnd={() => {
                            setDraggingListId(null);
                            setDragOverListId(null);
                          }}
                          className="rounded-md p-1 text-muted-foreground hover:bg-secondary/70"
                          title="Drag to reorder"
                        >
                          <GripVertical className="h-4 w-4" />
                        </button>
                      </div>
                    </div>
                  </CardHeader>

                  <CardContent className="space-y-3">
                    {editingListId === list.id && (
                      <div className="space-y-2">
                        <Input
                          ref={(node) => {
                            listInputRefs.current[list.id] = node;
                          }}
                          value={listNameDrafts[list.id] ?? list.name}
                          onChange={(event) => {
                            const value = event.target.value;

                            setListNameDrafts((current) => ({
                              ...current,
                              [list.id]: value
                            }));

                            scheduleListNameAutosave(list.id, value);
                          }}
                          onBlur={() => {
                            void closeListEditor(list);
                          }}
                          onKeyDown={(event) => {
                            if (event.key === "Enter") {
                              event.preventDefault();
                              void closeListEditor(list);
                            }

                            if (event.key === "Escape") {
                              event.preventDefault();
                              cancelListEditor(list);
                            }
                          }}
                        />
                        <p className="text-xs text-muted-foreground">
                          {listSavingIds.has(list.id) ? "Saving..." : "Autosaves after a short pause."}
                        </p>
                      </div>
                    )}

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
</CardContent>
                </Card>
              </div>
            ))}
          </div>
        </div>

        <Card>
          <CardHeader className="pb-3">
            <div className="flex items-center justify-between gap-3">
              <div>
                <CardTitle>Board Settings</CardTitle>
                <CardDescription>Collapsed by default so list work stays front and center.</CardDescription>
              </div>
              <Button
                type="button"
                variant="secondary"
                size="sm"
                onClick={() => setIsSettingsOpen((current) => !current)}
                className="gap-1"
              >
                {isSettingsOpen ? (
                  <>
                    Hide
                    <ChevronUp className="h-4 w-4" />
                  </>
                ) : (
                  <>
                    Show
                    <ChevronDown className="h-4 w-4" />
                  </>
                )}
              </Button>
            </div>
          </CardHeader>

          {isSettingsOpen && (
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

              <div className="flex flex-wrap items-center justify-between gap-2">
                <p className="text-xs text-muted-foreground">
                  {isAutosavingBoard ? "Saving..." : "Changes save automatically"}
                </p>
                <Button type="button" variant="ghost" onClick={() => setIsDeleteBoardOpen(true)}>
                  Delete board
                </Button>
              </div>
            </CardContent>
          )}
        </Card>
      </div>

      {showSavedNotice && (
        <div className="pointer-events-none fixed bottom-5 right-5 z-40 rounded-full border border-emerald-300/60 bg-emerald-100/90 px-4 py-2 text-sm font-medium text-emerald-900 shadow-lg backdrop-blur">
          Saved
        </div>
      )}

      <ConfirmDialog
        open={isDeleteBoardOpen}
        title="Delete board"
        description={`Delete "${board.name}" and all its lists? This cannot be undone.`}
        confirmLabel="Delete"
        cancelLabel="Keep"
        onCancel={() => setIsDeleteBoardOpen(false)}
        onConfirm={() => {
          setIsDeleteBoardOpen(false);
          void onDeleteBoard();
        }}
      />

      <ConfirmDialog
        open={listToDelete !== null}
        title="Delete list"
        description={`Delete "${listToDelete?.name ?? "this list"}"?`}
        confirmLabel="Delete"
        cancelLabel="Keep"
        onCancel={() => setListToDelete(null)}
        onConfirm={() => {
          void onDeleteList();
        }}
      />
    </>
  );
}
























