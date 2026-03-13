import { useEffect, useMemo, useState } from "react";

import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";

const FONT_STORAGE_KEY = "flowstate:font";
const SPACING_STORAGE_KEY = "flowstate:spacing";

type FontOption = "grotesk" | "serif";

type SpacingOption = "tight" | "compact" | "default" | "spacious";

const fontOptions: Array<{ value: FontOption; label: string; description: string }> = [
  {
    value: "grotesk",
    label: "Space Grotesk",
    description: "Clean geometric sans"
  },
  {
    value: "serif",
    label: "Fraunces",
    description: "Editorial serif"
  }
];

const spacingOptions: Array<{ value: SpacingOption; label: string; description: string }> = [
  {
    value: "tight",
    label: "Tight",
    description: "Dense and compact"
  },
  {
    value: "compact",
    label: "Compact",
    description: "Slightly tighter"
  },
  {
    value: "default",
    label: "Default",
    description: "Balanced spacing"
  },
  {
    value: "spacious",
    label: "Spacious",
    description: "Airy and relaxed"
  }
];

function applyFont(value: FontOption): void {
  document.documentElement.dataset.font = value;
}

function applySpacing(value: SpacingOption): void {
  document.documentElement.dataset.spacing = value;
}

export function GeneralSettingsPage(): JSX.Element {
  const [selectedFont, setSelectedFont] = useState<FontOption>("grotesk");
  const [baselineFont, setBaselineFont] = useState<FontOption>("grotesk");
  const [selectedSpacing, setSelectedSpacing] = useState<SpacingOption>("default");
  const [baselineSpacing, setBaselineSpacing] = useState<SpacingOption>("default");
  const [status, setStatus] = useState<"idle" | "saved">("idle");

  useEffect(() => {
    try {
      const storedFont = (localStorage.getItem(FONT_STORAGE_KEY) as FontOption | null) ?? "grotesk";
      const storedSpacing = (localStorage.getItem(SPACING_STORAGE_KEY) as SpacingOption | null) ?? "default";
      setSelectedFont(storedFont);
      setBaselineFont(storedFont);
      setSelectedSpacing(storedSpacing);
      setBaselineSpacing(storedSpacing);
      applyFont(storedFont);
      applySpacing(storedSpacing);
    } catch {
      applyFont("grotesk");
      applySpacing("default");
    }
  }, []);

  const hasUnsavedChanges = selectedFont !== baselineFont || selectedSpacing !== baselineSpacing;

  const helperText = useMemo(() => {
    if (status === "saved" && !hasUnsavedChanges) {
      return "Settings saved.";
    }

    return "Some settings apply after saving. Collaboration controls will be wired up later.";
  }, [status, hasUnsavedChanges]);

  const onSave = (): void => {
    try {
      localStorage.setItem(FONT_STORAGE_KEY, selectedFont);
      localStorage.setItem(SPACING_STORAGE_KEY, selectedSpacing);
    } catch {
      // ignore storage failures
    }
    applyFont(selectedFont);
    applySpacing(selectedSpacing);
    setBaselineFont(selectedFont);
    setBaselineSpacing(selectedSpacing);
    setStatus("saved");
  };

  return (
    <div className="space-y-6">
      <header className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h2 className="text-2xl font-semibold">General settings</h2>
          <p className="text-sm text-muted-foreground">{helperText}</p>
        </div>
        {hasUnsavedChanges && (
          <span className="rounded-full bg-amber-100 px-3 py-1 text-xs font-semibold uppercase tracking-wide text-amber-700">
            Unsaved changes
          </span>
        )}
      </header>

      <div className="grid gap-4 lg:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle>Roles</CardTitle>
            <CardDescription>Manage permissions and role assignments.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-2 text-sm text-muted-foreground">
            <p>Role management will be available once collaboration settings are ready.</p>
            <Button variant="secondary" disabled>
              Coming soon
            </Button>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Appearance</CardTitle>
            <CardDescription>Pick a theme that fits your focus.</CardDescription>
          </CardHeader>
          <CardContent className="flex flex-wrap gap-2">
            <Button variant="secondary" type="button">Light</Button>
            <Button variant="secondary" type="button">Dark</Button>
            <Button variant="secondary" type="button">System</Button>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Typography</CardTitle>
            <CardDescription>Choose the reading style you prefer.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-3">
            <label className="text-xs uppercase tracking-wide text-muted-foreground">Font</label>
            <select
              className="h-10 w-full rounded-md border border-input bg-card px-3 text-sm"
              value={selectedFont}
              onChange={(event) => {
                setSelectedFont(event.target.value as FontOption);
                setStatus("idle");
              }}
            >
              {fontOptions.map((option) => (
                <option key={option.value} value={option.value}>
                  {option.label} · {option.description}
                </option>
              ))}
            </select>
            <label className="text-xs uppercase tracking-wide text-muted-foreground">Spacing</label>
            <select
              className="h-10 w-full rounded-md border border-input bg-card px-3 text-sm"
              value={selectedSpacing}
              onChange={(event) => {
                setSelectedSpacing(event.target.value as SpacingOption);
                setStatus("idle");
              }}
            >
              {spacingOptions.map((option) => (
                <option key={option.value} value={option.value}>
                  {option.label} · {option.description}
                </option>
              ))}
            </select>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Notifications</CardTitle>
            <CardDescription>Adjust email and in-app alerts.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-2 text-sm text-muted-foreground">
            <p>Notification rules will sync here once messaging is enabled.</p>
            <Button variant="secondary" disabled>
              Coming soon
            </Button>
          </CardContent>
        </Card>
      </div>

      <div className="flex flex-wrap items-center justify-between gap-3">
        <p className="text-sm text-muted-foreground">
          Typography updates apply after saving.
        </p>
        <Button type="button" onClick={onSave} disabled={!hasUnsavedChanges}>
          {hasUnsavedChanges ? "Save changes" : "Up to date"}
        </Button>
      </div>
    </div>
  );
}
