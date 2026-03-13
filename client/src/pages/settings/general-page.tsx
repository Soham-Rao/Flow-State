import { useEffect, useMemo, useState } from "react";

import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";

const FONT_STORAGE_KEY = "flowstate:font";
const SPACING_STORAGE_KEY = "flowstate:spacing";
const THEME_STORAGE_KEY = "flowstate:theme";

type FontOption = "grotesk" | "serif" | "plex" | "merriweather";

type ThemeOption = "light" | "dark" | "system";

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
  },
  {
    value: "plex",
    label: "IBM Plex Sans",
    description: "Professional sans"
  },
  {
    value: "merriweather",
    label: "Merriweather",
    description: "Readable serif"
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

function normalizeStoredFont(value: string | null): FontOption {
  if (value === "dm-sans") return "plex";
  if (value === "playfair") return "merriweather";
  if (value === "plex" || value === "merriweather" || value === "serif" || value === "grotesk") return value;
  return "grotesk";
}

function normalizeStoredTheme(value: string | null): ThemeOption {
  if (value === "light" || value === "dark" || value === "system") return value;
  return "system";
}

function resolveTheme(value: ThemeOption): "light" | "dark" {
  if (value === "system") {
    return window.matchMedia("(prefers-color-scheme: dark)").matches ? "dark" : "light";
  }
  return value;
}

function applyTheme(value: ThemeOption): void {
  document.documentElement.dataset.theme = resolveTheme(value);
}

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
  const [selectedTheme, setSelectedTheme] = useState<ThemeOption>("system");
  const [baselineTheme, setBaselineTheme] = useState<ThemeOption>("system");
  const [status, setStatus] = useState<"idle" | "saved">("idle");

  useEffect(() => {
    try {
      const storedFont = normalizeStoredFont(localStorage.getItem(FONT_STORAGE_KEY));
      const storedSpacing = (localStorage.getItem(SPACING_STORAGE_KEY) as SpacingOption | null) ?? "default";
      const storedTheme = normalizeStoredTheme(localStorage.getItem(THEME_STORAGE_KEY));
      setSelectedFont(storedFont);
      setBaselineFont(storedFont);
      setSelectedSpacing(storedSpacing);
      setBaselineSpacing(storedSpacing);
      setSelectedTheme(storedTheme);
      setBaselineTheme(storedTheme);
      applyFont(storedFont);
      applySpacing(storedSpacing);
      applyTheme(storedTheme);
    } catch {
      applyFont("grotesk");
      applySpacing("default");
      applyTheme("system");
    }
  }, []);

  const hasUnsavedChanges =
    selectedFont !== baselineFont || selectedSpacing !== baselineSpacing || selectedTheme !== baselineTheme;

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
      localStorage.setItem(THEME_STORAGE_KEY, selectedTheme);
    } catch {
      // ignore storage failures
    }
    applyFont(selectedFont);
    applySpacing(selectedSpacing);
    applyTheme(selectedTheme);
    setBaselineFont(selectedFont);
    setBaselineSpacing(selectedSpacing);
    setBaselineTheme(selectedTheme);
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
            <Button
              variant={selectedTheme === "light" ? "default" : "secondary"}
              type="button"
              onClick={() => {
                setSelectedTheme("light");
                setStatus("idle");
              }}
            >
              Light
            </Button>
            <Button
              variant={selectedTheme === "dark" ? "default" : "secondary"}
              type="button"
              onClick={() => {
                setSelectedTheme("dark");
                setStatus("idle");
              }}
            >
              Dark
            </Button>
            <Button
              variant={selectedTheme === "system" ? "default" : "secondary"}
              type="button"
              onClick={() => {
                setSelectedTheme("system");
                setStatus("idle");
              }}
            >
              System
            </Button>
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
