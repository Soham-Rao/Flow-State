import { ChevronDown, ChevronUp, Plus, Tag, Trash2 } from "lucide-react";
import React, { useState } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { boardGlassCard, boardGlassInput, boardGlassPill, boardGlassSubtle } from "@/pages/boards/board-glass.styles";
import { boardBackgroundPresets, type BoardBackgroundPreset } from "@/lib/board-backgrounds";
import { labelColorStyles, labelColors, parseRetentionInput } from "@/pages/boards/board-detail-page.utils";
import type { BoardBackground, BoardLabel, LabelColor, RetentionMode } from "@/types/board";
import type { BoardMemberSummary } from "@/lib/boards-api";

export function BoardSettingsSection({
  isSettingsOpen,
  onToggleSettingsOpen,
  boardName,
  onBoardNameChange,
  boardDescription,
  onBoardDescriptionChange,
  boardBackground,
  onApplyBoardBackground,
  retentionDays,
  retentionHours,
  retentionMinutesPart,
  retentionMode,
  onRetentionModeChange,
  applyRetentionParts,
  archiveRetentionDays,
  archiveRetentionHours,
  archiveRetentionMinutesPart,
  applyArchiveRetentionParts,
  newLabelName,
  onNewLabelNameChange,
  newLabelColor,
  onNewLabelColorChange,
  boardLabels,
  labelDrafts,
  labelColorDrafts,
  onLabelDraftChange,
  onLabelColorDraftChange,
  scheduleLabelAutosave,
  onLabelDelete,
  labelSavingIds,
  onCreateLabel,
  isAutosavingBoard,
  onOpenArchiveBoard,
  onOpenDeleteBoard,
  workspaceUsers,
  boardMembers,
  onAddBoardMembers,
  onUpdateBoardMemberOverride,
  onRemoveBoardMember,
  boardCreatorId,
}: {
  isSettingsOpen: boolean;
  onToggleSettingsOpen: () => void;
  boardName: string;
  onBoardNameChange: (value: string) => void;
  boardDescription: string;
  onBoardDescriptionChange: (value: string) => void;
  boardBackground: BoardBackground;
  onApplyBoardBackground: (background: BoardBackground) => void;
  retentionDays: number;
  retentionHours: number;
  retentionMinutesPart: number;
  retentionMode: RetentionMode;
  onRetentionModeChange: (mode: RetentionMode) => void;
  applyRetentionParts: (days: number, hours: number, minutes: number) => void;
  archiveRetentionDays: number;
  archiveRetentionHours: number;
  archiveRetentionMinutesPart: number;
  applyArchiveRetentionParts: (days: number, hours: number, minutes: number) => void;
  newLabelName: string;
  onNewLabelNameChange: (value: string) => void;
  newLabelColor: LabelColor;
  onNewLabelColorChange: (value: LabelColor) => void;
  boardLabels: BoardLabel[];
  labelDrafts: Record<string, string>;
  labelColorDrafts: Record<string, LabelColor>;
  onLabelDraftChange: (labelId: string, value: string) => void;
  onLabelColorDraftChange: (labelId: string, value: LabelColor) => void;
  scheduleLabelAutosave: (labelId: string, name: string, color: LabelColor) => void;
  onLabelDelete: (label: BoardLabel) => void;
  labelSavingIds: Set<string>;
  onCreateLabel: (event: React.FormEvent<HTMLFormElement>) => Promise<void>;
  isAutosavingBoard: boolean;
  onOpenArchiveBoard: () => void;
  onOpenDeleteBoard: () => void;
  workspaceUsers?: Array<{ id: string; name: string; displayName: string | null; username: string; email: string }>;
  boardMembers?: BoardMemberSummary[];
  onAddBoardMembers?: (userIds: string[]) => void;
  onUpdateBoardMemberOverride?: (memberId: string, permission: string, access: "allow" | "deny" | "none") => void;
  onRemoveBoardMember?: (memberId: string) => void;
  boardCreatorId?: string;
}): JSX.Element {
  const [selectedAddUserId, setSelectedAddUserId] = useState("");
  const [permissionsOpenFor, setPermissionsOpenFor] = useState<string | null>(null);

  const retentionDisabled = retentionDays === 0 && retentionHours === 0 && retentionMinutesPart === 0;
  return (
    <Card className={boardGlassCard}>
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between gap-3">
          <div>
            <CardTitle>Board Settings</CardTitle>
          </div>
          <Button
            type="button"
            variant="secondary"
            size="sm"
            onClick={onToggleSettingsOpen}
            className={`gap-1 ${boardGlassPill}`}
          >
            {isSettingsOpen ? (<>Hide <ChevronUp className="h-4 w-4" /></>) : (<>Show <ChevronDown className="h-4 w-4" /></>)}
          </Button>
        </div>
      </CardHeader>
      {isSettingsOpen && (
        <CardContent className="space-y-4">
          <Input value={boardName} onChange={(e) => onBoardNameChange(e.target.value)} className={boardGlassInput} />
          <textarea
            value={boardDescription}
            onChange={(e) => onBoardDescriptionChange(e.target.value)}
            placeholder="Description"
            className={`min-h-[88px] w-full rounded-md px-3 py-2 text-sm ${boardGlassInput}`}
          />
          <div className="grid gap-2 sm:grid-cols-3 lg:grid-cols-5">
            {boardBackgroundPresets.map((preset: BoardBackgroundPreset) => (
              <button
                key={preset.id}
                type="button"
                onClick={() => onApplyBoardBackground(preset.id)}
                className={`overflow-hidden rounded-md border text-left ${boardGlassSubtle} ${boardBackground === preset.id ? "border-primary ring-2 ring-primary/40" : "border-border"}`}
              >
                <div className={`h-10 ${preset.className}`} />
                <p className="px-2 py-1 text-[11px] text-muted-foreground">{preset.label}</p>
              </button>
            ))}
          </div>

          {/* Members & Permissions Section */}
          {boardMembers && workspaceUsers && (
            <div className={`space-y-3 rounded-lg p-3 ${boardGlassSubtle}`}>
              <p className="text-sm font-semibold uppercase tracking-[0.1em] text-muted-foreground">Members & permissions</p>
              
              <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
                <select
                  value={selectedAddUserId}
                  onChange={(e) => setSelectedAddUserId(e.target.value)}
                  className={`h-9 flex-1 rounded-md px-3 text-xs bg-background/50 border border-border/60 ${boardGlassInput}`}
                >
                  <option value="">Select workspace user to add...</option>
                  {workspaceUsers
                    .filter((u) => !boardMembers.some((m) => m.user.id === u.id))
                    .map((u) => (
                      <option key={u.id} value={u.id}>
                        {u.displayName ?? u.name} (@{u.username})
                      </option>
                    ))}
                </select>
                <Button
                  type="button"
                  size="sm"
                  disabled={!selectedAddUserId}
                  onClick={() => {
                    if (onAddBoardMembers && selectedAddUserId) {
                      onAddBoardMembers([selectedAddUserId]);
                      setSelectedAddUserId("");
                    }
                  }}
                  className={`gap-1 ${boardGlassPill}`}
                >
                  <Plus className="h-4 w-4" /> Add
                </Button>
              </div>

              <div className="mt-3 space-y-2">
                {boardMembers.length === 0 && (
                  <p className="text-xs text-muted-foreground">No members yet.</p>
                )}
                {boardMembers.map((member) => {
                  const isCreator = member.user.id === boardCreatorId;
                  const overridesByPermission = new Map(
                    member.overrides.map((override) => [override.permission, override.access])
                  );

                  const resolveChecked = (permission: string, fallback: boolean) => {
                    const override = overridesByPermission.get(permission);
                    if (override === "allow") return true;
                    if (override === "deny") return false;
                    return fallback;
                  };

                  const permissionOptions: {
                    key: string;
                    label: string;
                    fallback: boolean;
                  }[] = [
                    { key: "view_boards", label: "View board", fallback: member.effectivePermissions.view_boards },
                    { key: "edit_boards", label: "Edit settings", fallback: member.effectivePermissions.edit_boards },
                    { key: "delete_boards", label: "Delete board", fallback: member.effectivePermissions.delete_boards },
                    { key: "manage_lists", label: "Manage lists", fallback: member.effectivePermissions.manage_lists },
                    { key: "create_cards", label: "Create cards", fallback: member.effectivePermissions.create_cards },
                    { key: "edit_cards", label: "Edit / move cards", fallback: member.effectivePermissions.edit_cards },
                    { key: "comment", label: "Add comments", fallback: member.effectivePermissions.comment },
                    { key: "manage_labels", label: "Manage labels", fallback: member.effectivePermissions.manage_labels },
                    { key: "assign_members", label: "Assign card members", fallback: member.effectivePermissions.assign_members },
                    { key: "set_due_dates", label: "Set due dates", fallback: member.effectivePermissions.set_due_dates }
                  ];

                  return (
                    <div
                      key={member.user.id}
                      className="flex flex-col gap-2 rounded-lg border border-border/40 bg-background/50 p-2 text-xs"
                    >
                      <div className="flex items-center justify-between gap-2">
                        <div>
                          <p className="font-semibold text-sm">
                            {member.user.displayName ?? member.user.name}
                            {isCreator && <span className="ml-2 text-[10px] text-primary/80 font-normal border border-primary/30 rounded px-1 py-0.5">Creator</span>}
                          </p>
                          <p className="text-[10px] text-muted-foreground">@{member.user.username}</p>
                        </div>
                        <div className="flex items-center gap-2">
                          <button
                            type="button"
                            onClick={() =>
                              setPermissionsOpenFor((prev) => (prev === member.user.id ? null : member.user.id))
                            }
                            className="rounded-full border border-border/60 px-2 py-1 text-[10px] text-muted-foreground hover:border-primary hover:text-primary transition"
                          >
                            Permissions
                          </button>
                          {!isCreator && onRemoveBoardMember && (
                            <Button
                              type="button"
                              variant="ghost"
                              size="sm"
                              onClick={() => onRemoveBoardMember(member.user.id)}
                              className="h-7 w-7 p-0 text-red-600 hover:text-red-700 hover:bg-red-50 dark:hover:bg-red-950/20"
                            >
                              <Trash2 className="h-3.5 w-3.5" />
                            </Button>
                          )}
                        </div>
                      </div>

                      {permissionsOpenFor === member.user.id && (
                        <div className="mt-2 space-y-2 border-t border-border/40 pt-2 text-[11px] text-muted-foreground">
                          {permissionOptions.map((option) => {
                            const overrideVal = overridesByPermission.get(option.key) ?? "none";
                            return (
                              <div
                                key={option.key}
                                className="flex items-center justify-between gap-2 rounded px-1 py-0.5 hover:bg-muted/40"
                              >
                                <span className="font-medium">{option.label}</span>
                                <select
                                  value={overrideVal}
                                  onChange={(e) => {
                                    if (onUpdateBoardMemberOverride) {
                                      onUpdateBoardMemberOverride(member.user.id, option.key, e.target.value as any);
                                    }
                                  }}
                                  className="h-6 rounded border border-border/60 bg-background px-1 text-[10px]"
                                >
                                  <option value="none">Inherit ({option.fallback ? "Allow" : "Deny"})</option>
                                  <option value="allow">Allow</option>
                                  <option value="deny">Deny</option>
                                </select>
                              </div>
                            );
                          })}
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            </div>
          )}
          <div className={`space-y-3 rounded-lg p-3 ${boardGlassSubtle}`}>
            <div className="flex flex-wrap gap-1">
              <p className="text-sm font-medium">Done card retention</p>
              <p className="text-xs text-muted-foreground">
                {retentionDisabled
                  ? "Never auto-delete completed cards unless you set a duration."
                  : "Set how long completed cards remain before cleanup."}
              </p>
            </div>
            <div className="grid gap-2 sm:grid-cols-3">
              <label className="space-y-1 text-xs text-muted-foreground">
                <span>Days</span>
                <Input
                  type="number"
                  className={boardGlassInput}
                  min={0}
                  max={365}
                  value={retentionDays}
                  onChange={(event) => {
                    const value = parseRetentionInput(event.target.value);
                    applyRetentionParts(value, retentionHours, retentionMinutesPart);
                  }}
                />
              </label>
              <label className="space-y-1 text-xs text-muted-foreground">
                <span>Hours</span>
                <Input
                  type="number"
                  className={boardGlassInput}
                  min={0}
                  max={23}
                  value={retentionHours}
                  onChange={(event) => {
                    const value = parseRetentionInput(event.target.value);
                    applyRetentionParts(retentionDays, value, retentionMinutesPart);
                  }}
                />
              </label>
              <label className="space-y-1 text-xs text-muted-foreground">
                <span>Minutes</span>
                <Input
                  type="number"
                  className={boardGlassInput}
                  min={0}
                  max={59}
                  value={retentionMinutesPart}
                  onChange={(event) => {
                    const value = parseRetentionInput(event.target.value);
                    applyRetentionParts(retentionDays, retentionHours, value);
                  }}
                />
              </label>
            </div>
            <div className="grid gap-2 sm:grid-cols-2">
              <Button
                type="button"
                variant={retentionMode === "card_and_attachments" ? "default" : "secondary"}
                onClick={() => onRetentionModeChange("card_and_attachments")}
                className={`${boardGlassPill} ${retentionMode === "card_and_attachments" ? "ring-2 ring-primary/60 border-primary/60 bg-white/80 dark:bg-black/70" : "opacity-85 hover:opacity-100 hover:border-primary/40"}`}
              >
                Delete card + attachments
              </Button>
              <Button
                type="button"
                variant={retentionMode === "attachments_only" ? "default" : "secondary"}
                onClick={() => onRetentionModeChange("attachments_only")}
                className={`${boardGlassPill} ${retentionMode === "attachments_only" ? "ring-2 ring-primary/60 border-primary/60 bg-white/80 dark:bg-black/70" : "opacity-85 hover:opacity-100 hover:border-primary/40"}`}
              >
                Delete attachments only
              </Button>
            </div>
            {retentionDisabled && (
              <p className="text-xs font-medium text-muted-foreground">Current cleanup timer: Never</p>
            )}
          </div>
          <div className={`space-y-3 rounded-lg p-3 ${boardGlassSubtle}`}>
            <div className="flex flex-wrap gap-1">
              <p className="text-sm font-medium">Archive retention</p>
              <p className="text-xs text-muted-foreground">How long archived lists and cards remain before cleanup.</p>
            </div>
            <div className="grid gap-2 sm:grid-cols-3">
              <label className="space-y-1 text-xs text-muted-foreground">
                <span>Days</span>
                <Input
                  type="number"
                  className={boardGlassInput}
                  min={0}
                  max={365}
                  value={archiveRetentionDays}
                  onChange={(event) => {
                    const value = parseRetentionInput(event.target.value);
                    applyArchiveRetentionParts(value, archiveRetentionHours, archiveRetentionMinutesPart);
                  }}
                />
              </label>
              <label className="space-y-1 text-xs text-muted-foreground">
                <span>Hours</span>
                <Input
                  type="number"
                  className={boardGlassInput}
                  min={0}
                  max={23}
                  value={archiveRetentionHours}
                  onChange={(event) => {
                    const value = parseRetentionInput(event.target.value);
                    applyArchiveRetentionParts(archiveRetentionDays, value, archiveRetentionMinutesPart);
                  }}
                />
              </label>
              <label className="space-y-1 text-xs text-muted-foreground">
                <span>Minutes</span>
                <Input
                  type="number"
                  className={boardGlassInput}
                  min={0}
                  max={59}
                  value={archiveRetentionMinutesPart}
                  onChange={(event) => {
                    const value = parseRetentionInput(event.target.value);
                    applyArchiveRetentionParts(archiveRetentionDays, archiveRetentionHours, value);
                  }}
                />
              </label>
            </div>
          </div>
          <div className={`space-y-3 rounded-lg p-3 ${boardGlassSubtle}`}>
            <div className="flex items-center gap-2 text-sm font-medium">
              <Tag className="h-4 w-4 text-muted-foreground" />
              Labels
            </div>
            <form className="grid gap-2 sm:grid-cols-[1fr_auto_auto]" onSubmit={onCreateLabel}>
              <Input
                value={newLabelName}
                onChange={(event) => onNewLabelNameChange(event.target.value)}
                placeholder="New label name"
              />
              <select
                value={newLabelColor}
                onChange={(event) => onNewLabelColorChange(event.target.value as LabelColor)}
                className={`h-10 rounded-md px-3 text-sm ${boardGlassInput}`}
              >
                {labelColors.map((color) => (
                  <option key={color} value={color}>
                    {color.charAt(0).toUpperCase() + color.slice(1)}
                  </option>
                ))}
              </select>
              <Button type="submit" className={`gap-1 ${boardGlassPill}`}>
                <Plus className="h-4 w-4" />
                Add label
              </Button>
            </form>
            {boardLabels.length === 0 ? (
              <p className="text-xs text-muted-foreground">No labels yet.</p>
            ) : (
              <div className="space-y-2">
                {boardLabels.map((label) => {
                  const draftName = labelDrafts[label.id] ?? label.name;
                  const draftColor = labelColorDrafts[label.id] ?? label.color;
                  return (
                    <div key={label.id} className="flex flex-wrap items-center gap-2">
                      <span className={`h-2.5 w-2.5 rounded-full ${labelColorStyles[draftColor].dot}`} />
                      <Input
                        value={draftName}
                        onChange={(event) => {
                          const value = event.target.value;
                          onLabelDraftChange(label.id, value);
                          scheduleLabelAutosave(label.id, value, draftColor);
                        }}
                        className={`h-9 max-w-[220px] ${boardGlassInput}`}
                      />
                      <select
                        value={draftColor}
                        onChange={(event) => {
                          const value = event.target.value as LabelColor;
                          onLabelColorDraftChange(label.id, value);
                          scheduleLabelAutosave(label.id, draftName, value);
                        }}
                        className={`h-9 rounded-md px-2 text-xs ${boardGlassInput}`}
                      >
                        {labelColors.map((color) => (
                          <option key={color} value={color}>
                            {color.charAt(0).toUpperCase() + color.slice(1)}
                          </option>
                        ))}
                      </select>
                      <Button
                        type="button"
                        variant="ghost"
                        size="sm"
                        className={`h-8 w-8 p-0 text-red-600 hover:text-red-700 ${boardGlassPill}`}
                        onClick={() => onLabelDelete(label)}
                        title="Delete label"
                      >
                        <Trash2 className="h-4 w-4" />
                      </Button>
                      {labelSavingIds.has(label.id) && (
                        <span className="text-xs text-muted-foreground">Saving...</span>
                      )}
                    </div>
                  );
                })}
              </div>
            )}
          </div>
          <div className="flex flex-wrap items-center justify-between gap-2">
            <p className="text-xs text-muted-foreground">
              {isAutosavingBoard ? "Saving..." : "Changes save automatically"}
            </p>
            <div className="flex flex-wrap items-center gap-2">
              <Button type="button" variant="ghost" className={boardGlassPill} onClick={onOpenArchiveBoard}>
                Archive board
              </Button>
              <Button type="button" variant="ghost" className={boardGlassPill} onClick={onOpenDeleteBoard}>
                Delete board
              </Button>
            </div>
          </div>
        </CardContent>
      )}
    </Card>
  );
}








