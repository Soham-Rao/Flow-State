import { useCallback, useEffect, useMemo, useState } from "react";
import { Pause, Play, RotateCcw, SkipForward, Sparkles, Timer, TrendingUp } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { useAuthStore } from "@/stores/auth-store";

type SessionMode = "focus" | "break";

interface FocusSessionEntry {
  id: string;
  mode: SessionMode;
  durationMinutes: number;
  completedAt: string;
}

const DEFAULT_FOCUS_MINUTES = 90;
const DEFAULT_BREAK_MINUTES = 10;

const PRESET_OPTIONS = [
  { label: "90 / 10 Deep Work", focus: 90, break: 10 },
  { label: "50 / 10 Sustained", focus: 50, break: 10 },
  { label: "25 / 5 Classic", focus: 25, break: 5 }
];

const formatTime = (totalSeconds: number): string => {
  const minutes = Math.floor(totalSeconds / 60);
  const seconds = totalSeconds % 60;
  return `${minutes.toString().padStart(2, "0")}:${seconds.toString().padStart(2, "0")}`;
};

const createId = (): string => {
  if (typeof crypto !== "undefined" && "randomUUID" in crypto) {
    return crypto.randomUUID();
  }
  return `session_${Date.now()}_${Math.random().toString(16).slice(2)}`;
};

export function FocusPage(): JSX.Element {
  const user = useAuthStore((state) => state.user);
  const storageKey = user?.id ? `flowstate:focus:${user.id}` : "flowstate:focus:guest";

  const [focusMinutes, setFocusMinutes] = useState(DEFAULT_FOCUS_MINUTES);
  const [breakMinutes, setBreakMinutes] = useState(DEFAULT_BREAK_MINUTES);
  const [mode, setMode] = useState<SessionMode>("focus");
  const [remainingSeconds, setRemainingSeconds] = useState(DEFAULT_FOCUS_MINUTES * 60);
  const [isRunning, setIsRunning] = useState(false);
  const [history, setHistory] = useState<FocusSessionEntry[]>([]);

  useEffect(() => {
    if (typeof window === "undefined") return;
    const stored = window.localStorage.getItem(storageKey);
    if (!stored) return;
    try {
      const parsed = JSON.parse(stored) as Partial<{
        focusMinutes: number;
        breakMinutes: number;
        history: FocusSessionEntry[];
      }>;
      if (typeof parsed.focusMinutes === "number" && parsed.focusMinutes > 0) {
        setFocusMinutes(parsed.focusMinutes);
      }
      if (typeof parsed.breakMinutes === "number" && parsed.breakMinutes > 0) {
        setBreakMinutes(parsed.breakMinutes);
      }
      if (Array.isArray(parsed.history)) {
        setHistory(parsed.history);
      }
    } catch {
      // Ignore malformed local storage payloads.
    }
  }, [storageKey]);

  useEffect(() => {
    if (typeof window === "undefined") return;
    const payload = JSON.stringify({ focusMinutes, breakMinutes, history });
    window.localStorage.setItem(storageKey, payload);
  }, [breakMinutes, focusMinutes, history, storageKey]);

  useEffect(() => {
    if (isRunning) return;
    const nextDuration = (mode === "focus" ? focusMinutes : breakMinutes) * 60;
    setRemainingSeconds(nextDuration);
  }, [breakMinutes, focusMinutes, isRunning, mode]);

  const addHistoryEntry = useCallback(
    (completedMode: SessionMode) => {
      const duration = completedMode === "focus" ? focusMinutes : breakMinutes;
      const entry: FocusSessionEntry = {
        id: createId(),
        mode: completedMode,
        durationMinutes: duration,
        completedAt: new Date().toISOString()
      };
      setHistory((prev) => [entry, ...prev].slice(0, 200));
    },
    [breakMinutes, focusMinutes]
  );

  const advanceSession = useCallback(
    (recordEntry: boolean) => {
      const completedMode = mode;
      if (recordEntry) {
        addHistoryEntry(completedMode);
      }

      const nextMode = completedMode === "focus" ? "break" : "focus";
      setMode(nextMode);
      setRemainingSeconds((nextMode === "focus" ? focusMinutes : breakMinutes) * 60);
      setIsRunning(false);
    },
    [addHistoryEntry, breakMinutes, focusMinutes, mode]
  );

  useEffect(() => {
    if (!isRunning) return;
    const timerId = window.setInterval(() => {
      setRemainingSeconds((prev) => {
        if (prev <= 1) {
          window.clearInterval(timerId);
          advanceSession(true);
          return 0;
        }
        return prev - 1;
      });
    }, 1000);

    return () => window.clearInterval(timerId);
  }, [advanceSession, isRunning]);

  const totalSeconds = (mode === "focus" ? focusMinutes : breakMinutes) * 60;
  const progress = totalSeconds > 0 ? Math.min(1, Math.max(0, 1 - remainingSeconds / totalSeconds)) : 0;

  const stats = useMemo(() => {
    const now = new Date();
    const todayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    const weekStart = new Date(now);
    const day = weekStart.getDay();
    const diff = day === 0 ? 6 : day - 1;
    weekStart.setDate(weekStart.getDate() - diff);
    weekStart.setHours(0, 0, 0, 0);

    let todayFocusMinutes = 0;
    let weekFocusMinutes = 0;
    let totalFocusMinutes = 0;
    let focusSessions = 0;

    for (const entry of history) {
      if (entry.mode !== "focus") continue;
      focusSessions += 1;
      totalFocusMinutes += entry.durationMinutes;
      const entryDate = new Date(entry.completedAt);
      if (entryDate >= todayStart) {
        todayFocusMinutes += entry.durationMinutes;
      }
      if (entryDate >= weekStart) {
        weekFocusMinutes += entry.durationMinutes;
      }
    }

    return {
      focusSessions,
      totalFocusMinutes,
      todayFocusMinutes,
      weekFocusMinutes
    };
  }, [history]);

  const ringColor = mode === "focus" ? "rgba(34, 197, 94, 0.9)" : "rgba(251, 146, 60, 0.9)";
  const ringTrack = "rgba(148, 163, 184, 0.25)";
  const ringStyle = {
    background: `conic-gradient(${ringColor} ${progress * 360}deg, ${ringTrack} 0deg)`
  };

  const modeLabel = mode === "focus" ? "Focus" : "Break";
  const modeSubLabel = mode === "focus" ? "Deep work session" : "Recovery session";
  const nextModeLabel = mode === "focus" ? "Break" : "Focus";

  const handlePreset = (presetFocus: number, presetBreak: number) => {
    setFocusMinutes(presetFocus);
    setBreakMinutes(presetBreak);
    if (!isRunning) {
      setRemainingSeconds((mode === "focus" ? presetFocus : presetBreak) * 60);
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h2 className="text-2xl font-semibold tracking-tight">Focus mode</h2>
          <p className="text-sm text-muted-foreground">
            Personal Pomodoro sessions with calming visuals and private stats.
          </p>
        </div>
      </div>

      <div className="grid gap-6 lg:grid-cols-[minmax(0,1.15fr)_minmax(0,0.85fr)]">
        <Card className="relative overflow-hidden">
          <div className="absolute inset-0 bg-gradient-to-br from-emerald-400/20 via-sky-400/10 to-indigo-400/20 dark:from-emerald-500/20 dark:via-slate-900/10 dark:to-blue-500/20" />
          <CardHeader className="relative space-y-2">
            <div className="flex items-center gap-2 text-xs font-semibold uppercase tracking-[0.2em] text-muted-foreground">
              <span
                className={`rounded-full px-3 py-1 text-[11px] font-semibold uppercase tracking-[0.2em] ${
                  mode === "focus"
                    ? "bg-emerald-500/15 text-emerald-700 dark:text-emerald-200"
                    : "bg-orange-500/15 text-orange-700 dark:text-orange-200"
                }`}
              >
                {modeLabel}
              </span>
              <span>{modeSubLabel}</span>
            </div>
            <CardTitle className="text-2xl">Stay in the flow</CardTitle>
            <CardDescription>
              Timer runs privately for you. Take a quiet break before the next focus block.
            </CardDescription>
          </CardHeader>
          <CardContent className="relative space-y-6 pb-8">
            <div className="flex flex-col items-center justify-center gap-6">
              <div className="flex items-center gap-3 text-xs font-semibold uppercase tracking-[0.25em] text-muted-foreground">
                <Sparkles className="h-4 w-4" />
                {modeLabel} session
              </div>

              <div className="relative h-64 w-64 rounded-full p-2" style={ringStyle}>
                <div className="absolute inset-3 rounded-full bg-background/80 shadow-inner backdrop-blur">
                  <div className="flex h-full flex-col items-center justify-center gap-2">
                    <span className="text-5xl font-semibold tracking-tight">
                      {formatTime(remainingSeconds)}
                    </span>
                    <span className="text-xs uppercase tracking-[0.3em] text-muted-foreground">
                      {modeLabel} time left
                    </span>
                  </div>
                </div>
              </div>

              <div className="flex flex-wrap items-center justify-center gap-3">
                <Button onClick={() => setIsRunning((running) => !running)} className="gap-2">
                  {isRunning ? <Pause className="h-4 w-4" /> : <Play className="h-4 w-4" />}
                  {isRunning ? "Pause" : "Start"}
                </Button>
                <Button
                  variant="secondary"
                  className="gap-2"
                  onClick={() => {
                    setIsRunning(false);
                    setRemainingSeconds((mode === "focus" ? focusMinutes : breakMinutes) * 60);
                  }}
                >
                  <RotateCcw className="h-4 w-4" />
                  Reset
                </Button>
                <Button variant="ghost" className="gap-2" onClick={() => advanceSession(false)}>
                  <SkipForward className="h-4 w-4" />
                  Skip to {nextModeLabel}
                </Button>
              </div>

              <p className="text-xs text-muted-foreground">
                Next up: {nextModeLabel} - {mode === "focus" ? breakMinutes : focusMinutes} minutes
              </p>
            </div>
          </CardContent>
        </Card>

        <div className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-lg">
                <Timer className="h-4 w-4" />
                Session settings
              </CardTitle>
              <CardDescription>Default is 90/10. Adjust when paused.</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid gap-2">
                <p className="text-xs font-semibold uppercase tracking-[0.2em] text-muted-foreground">
                  Presets
                </p>
                <div className="flex flex-wrap gap-2">
                  {PRESET_OPTIONS.map((preset) => (
                    <Button
                      key={preset.label}
                      type="button"
                      variant="secondary"
                      size="sm"
                      onClick={() => handlePreset(preset.focus, preset.break)}
                      disabled={isRunning}
                    >
                      {preset.label}
                    </Button>
                  ))}
                </div>
              </div>

              <div className="grid gap-3 sm:grid-cols-2">
                <label className="space-y-2 text-sm font-medium">
                  Focus minutes
                  <Input
                    type="number"
                    min={10}
                    max={180}
                    value={focusMinutes}
                    disabled={isRunning}
                    onChange={(event) => {
                      const next = Number(event.target.value);
                      if (!Number.isNaN(next) && next > 0) {
                        setFocusMinutes(next);
                      }
                    }}
                  />
                </label>
                <label className="space-y-2 text-sm font-medium">
                  Break minutes
                  <Input
                    type="number"
                    min={5}
                    max={60}
                    value={breakMinutes}
                    disabled={isRunning}
                    onChange={(event) => {
                      const next = Number(event.target.value);
                      if (!Number.isNaN(next) && next > 0) {
                        setBreakMinutes(next);
                      }
                    }}
                  />
                </label>
              </div>
              {isRunning && (
                <p className="text-xs text-muted-foreground">
                  Pause the timer to edit session lengths.
                </p>
              )}
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-lg">
                <TrendingUp className="h-4 w-4" />
                Focus stats
              </CardTitle>
              <CardDescription>Personal history is stored locally.</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid gap-3 sm:grid-cols-2">
                <div className="rounded-lg border bg-card/60 p-3">
                  <p className="text-xs text-muted-foreground">Today</p>
                  <p className="text-xl font-semibold">{stats.todayFocusMinutes} min</p>
                </div>
                <div className="rounded-lg border bg-card/60 p-3">
                  <p className="text-xs text-muted-foreground">This week</p>
                  <p className="text-xl font-semibold">{stats.weekFocusMinutes} min</p>
                </div>
                <div className="rounded-lg border bg-card/60 p-3">
                  <p className="text-xs text-muted-foreground">Total focus</p>
                  <p className="text-xl font-semibold">{stats.totalFocusMinutes} min</p>
                </div>
                <div className="rounded-lg border bg-card/60 p-3">
                  <p className="text-xs text-muted-foreground">Focus sessions</p>
                  <p className="text-xl font-semibold">{stats.focusSessions}</p>
                </div>
              </div>

              <div className="rounded-lg border bg-card/60 p-3">
                <p className="text-xs font-semibold uppercase tracking-[0.2em] text-muted-foreground">
                  Recent sessions
                </p>
                <div className="mt-3 space-y-2">
                  {history.slice(0, 6).map((entry) => (
                    <div
                      key={entry.id}
                      className="flex items-center justify-between rounded-md border bg-background/60 px-3 py-2 text-xs"
                    >
                      <div>
                        <p className="font-semibold capitalize">{entry.mode}</p>
                        <p className="text-muted-foreground">
                          {new Date(entry.completedAt).toLocaleString()}
                        </p>
                      </div>
                      <span className="font-semibold">{entry.durationMinutes} min</span>
                    </div>
                  ))}
                  {history.length === 0 && (
                    <p className="text-xs text-muted-foreground">
                      Complete a focus session to start tracking history.
                    </p>
                  )}
                </div>
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}
