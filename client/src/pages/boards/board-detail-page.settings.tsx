import { ChevronDown, ChevronUp, Plus, Tag, Trash2 } from "lucide-react";
import type React from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { boardBackgroundPresets, type BoardBackgroundPreset } from "@/lib/board-backgrounds";
import { labelColorStyles, labelColors, parseRetentionInput } from "@/pages/boards/board-detail-page.utils";
import type { BoardBackground, BoardLabel, LabelColor, RetentionMode } from "@/types/board";

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
}): JSX.Element {
  return (
    <Card>
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
            className="gap-1"
          >
            {isSettingsOpen ? (<>Hide <ChevronUp className="h-4 w-4" /></>) : (<>Show <ChevronDown className="h-4 w-4" /></>)}
          </Button>
        </div>
      </CardHeader>
      {isSettingsOpen && (
        <CardContent className="space-y-4">
          <Input value={boardName} onChange={(e) => onBoardNameChange(e.target.value)} />
          <textarea
            value={boardDescription}
            onChange={(e) => onBoardDescriptionChange(e.target.value)}
            placeholder="Description"
            className="min-h-[88px] w-full rounded-md border border-input bg-card px-3 py-2 text-sm"
          />
          <div className="grid gap-2 sm:grid-cols-3 lg:grid-cols-5">
            {boardBackgroundPresets.map((preset: BoardBackgroundPreset) => (
              <button
                key={preset.id}
                type="button"
                onClick={() => onApplyBoardBackground(preset.id)}
                className={`overflow-hidden rounded-md border text-left ${boardBackground === preset.id ? "border-primary ring-2 ring-primary/40" : "border-border"}`}
              >
                <div className={`h-10 ${preset.className}`} />
                <p className="px-2 py-1 text-[11px] text-muted-foreground">{preset.label}</p>
              </button>
            ))}
          </div>
          <div className="space-y-3 rounded-lg border border-border/60 bg-background/80 p-3">
            <div className="flex flex-wrap gap-1">
              <p className="text-sm font-medium">Done card retention</p>
              <p className="text-xs text-muted-foreground">Set how long completed cards remain before cleanup.</p>
            </div>
            <div className="grid gap-2 sm:grid-cols-3">
              <label className="space-y-1 text-xs text-muted-foreground">
                <span>Days</span>
                <Input
                  type="number"
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
              >
                Delete card + attachments
              </Button>
              <Button
                type="button"
                variant={retentionMode === "attachments_only" ? "default" : "secondary"}
                onClick={() => onRetentionModeChange("attachments_only")}
              >
                Delete attachments only
              </Button>
            </div>
          </div>
          <div className="space-y-3 rounded-lg border border-border/60 bg-background/80 p-3">
            <div className="flex flex-wrap gap-1">
              <p className="text-sm font-medium">Archive retention</p>
              <p className="text-xs text-muted-foreground">How long archived lists and cards remain before cleanup.</p>
            </div>
            <div className="grid gap-2 sm:grid-cols-3">
              <label className="space-y-1 text-xs text-muted-foreground">
                <span>Days</span>
                <Input
                  type="number"
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
          <div className="space-y-3 rounded-lg border border-border/60 bg-background/80 p-3">
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
                className="h-10 rounded-md border border-input bg-card px-3 text-sm"
              >
                {labelColors.map((color) => (
                  <option key={color} value={color}>
                    {color.charAt(0).toUpperCase() + color.slice(1)}
                  </option>
                ))}
              </select>
              <Button type="submit" className="gap-1">
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
                        className="h-9 max-w-[220px]"
                      />
                      <select
                        value={draftColor}
                        onChange={(event) => {
                          const value = event.target.value as LabelColor;
                          onLabelColorDraftChange(label.id, value);
                          scheduleLabelAutosave(label.id, draftName, value);
                        }}
                        className="h-9 rounded-md border border-input bg-card px-2 text-xs"
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
                        className="h-8 w-8 p-0 text-red-600 hover:text-red-700"
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
              <Button type="button" variant="ghost" onClick={onOpenArchiveBoard}>
                Archive board
              </Button>
              <Button type="button" variant="ghost" onClick={onOpenDeleteBoard}>
                Delete board
              </Button>
            </div>
          </div>
        </CardContent>
      )}
    </Card>
  );
}

