import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { BellRing, Pause, Play, RotateCcw, SkipForward, Sparkles, Timer, TrendingUp } from "lucide-react";
import { useSearchParams } from "react-router-dom";

import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { ConfirmDialog } from "@/components/ui/confirm-dialog";
import { Input } from "@/components/ui/input";
import { isFocusAudioUnlocked, playFocusChime, unlockFocusAudio } from "@/lib/focus-timer";
import { glassCardClass, glassInputClass, glassStrongClass, glassSubtleClass } from "@/pages/glassmorphism.styles";
import { useAuthStore } from "@/stores/auth-store";

type SessionMode = "focus" | "break";

interface FocusSessionEntry {
  id: string;
  mode: SessionMode;
  durationSeconds: number;
  completedAt: string;
}

interface AlarmState {
  fromMode: SessionMode;
  nextMode: SessionMode;
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

const formatDuration = (totalSeconds: number): string => {
  const clamped = Math.max(0, Math.floor(totalSeconds));
  const hours = Math.floor(clamped / 3600);
  const minutes = Math.floor((clamped % 3600) / 60);
  const seconds = clamped % 60;

  if (hours > 0) {
    return `${hours}h ${minutes}m ${seconds}s`;
  }
  if (minutes > 0) {
    return `${minutes}m ${seconds}s`;
  }
  return `${seconds}s`;
};

const createId = (): string => {
  if (typeof crypto !== "undefined" && "randomUUID" in crypto) {
    return crypto.randomUUID();
  }
  return `session_${Date.now()}_${Math.random().toString(16).slice(2)}`;
};

export function FocusPage(): JSX.Element {
  const user = useAuthStore((state) => state.user);
  const [searchParams, setSearchParams] = useSearchParams();
  const storageKey = user?.id ? `flowstate:focus:${user.id}` : "flowstate:focus:guest";

  const [focusMinutes, setFocusMinutes] = useState(DEFAULT_FOCUS_MINUTES);
  const [breakMinutes, setBreakMinutes] = useState(DEFAULT_BREAK_MINUTES);
  const [mode, setMode] = useState<SessionMode>("focus");
  const [remainingSeconds, setRemainingSeconds] = useState(DEFAULT_FOCUS_MINUTES * 60);
  const [isRunning, setIsRunning] = useState(false);
  const [hasStarted, setHasStarted] = useState(false);
  const [hasLoaded, setHasLoaded] = useState(false);
  const [history, setHistory] = useState<FocusSessionEntry[]>([]);
  const [sessionId, setSessionId] = useState(() => createId());
  const [alarmState, setAlarmState] = useState<AlarmState | null>(null);
  const lastRecordedSessionId = useRef<string | null>(null);
  const lastDurationKey = useRef<string>("focus:90-break:10-mode:focus");

  const alarmIntervalRef = useRef<number | null>(null);

  useEffect(() => {
  if (typeof window === "undefined") return;
  const stored = window.localStorage.getItem(storageKey);
  if (!stored) {
    setHasLoaded(true);
    return;
  }
  try {
    const parsed = JSON.parse(stored) as Partial<{
      focusMinutes: number;
      breakMinutes: number;
      mode: SessionMode;
      remainingSeconds: number;
      isRunning: boolean;
      updatedAt: number;
      hasStarted: boolean;
      history: Array<FocusSessionEntry & { durationMinutes?: number }>;
    }>;
    const nextFocus =
      typeof parsed.focusMinutes === "number" && parsed.focusMinutes > 0
        ? parsed.focusMinutes
        : DEFAULT_FOCUS_MINUTES;
    const nextBreak =
      typeof parsed.breakMinutes === "number" && parsed.breakMinutes > 0
        ? parsed.breakMinutes
        : DEFAULT_BREAK_MINUTES;
    const nextMode: SessionMode = parsed.mode === "break" ? "break" : "focus";
    const baseTotalSeconds = (nextMode === "focus" ? nextFocus : nextBreak) * 60;
    let nextRemaining =
      typeof parsed.remainingSeconds === "number" ? parsed.remainingSeconds : baseTotalSeconds;
    if (parsed.isRunning && typeof parsed.updatedAt === "number") {
      const elapsedSeconds = Math.max(0, Math.floor((Date.now() - parsed.updatedAt) / 1000));
      nextRemaining = Math.max(0, nextRemaining - elapsedSeconds);
    }
    const inferredHasStarted = typeof parsed.hasStarted === "boolean"
      ? parsed.hasStarted
      : Boolean(parsed.isRunning || (typeof parsed.remainingSeconds === "number" && parsed.remainingSeconds < baseTotalSeconds));
    const nextHasStarted = inferredHasStarted && nextRemaining > 0;
    setFocusMinutes(nextFocus);
    setBreakMinutes(nextBreak);
    setMode(nextMode);
    setRemainingSeconds(nextRemaining);
    setIsRunning(Boolean(parsed.isRunning && nextRemaining > 0));
    setHasStarted(nextHasStarted);
    lastDurationKey.current = `focus:${nextFocus}-break:${nextBreak}-mode:${nextMode}`;
    if (Array.isArray(parsed.history)) {
      const normalizedHistory = parsed.history
        .map((entry) => {
          const durationSeconds =
            typeof entry.durationSeconds === "number"
              ? entry.durationSeconds
              : typeof entry.durationMinutes === "number"
                ? Math.round(entry.durationMinutes * 60)
                : 0;
          if (!entry.id || !entry.completedAt) {
            return null;
          }
          return {
            id: entry.id,
            mode: entry.mode,
            durationSeconds,
            completedAt: entry.completedAt
          } satisfies FocusSessionEntry;
        })
        .filter((entry): entry is FocusSessionEntry => entry !== null && entry.durationSeconds > 0);
      setHistory(normalizedHistory);
    }
  } catch {
    // Ignore malformed local storage payloads.
  }
  setHasLoaded(true);
}, [storageKey]);

  useEffect(() => {
    if (!hasLoaded) return;
    if (typeof window === "undefined") return;
    const payload = JSON.stringify({ focusMinutes, breakMinutes, history, mode, remainingSeconds, isRunning, hasStarted, updatedAt: Date.now() });
    window.localStorage.setItem(storageKey, payload);
  }, [breakMinutes, focusMinutes, hasLoaded, history, isRunning, mode, remainingSeconds, storageKey]);

  const persistFocusState = useCallback((next: {
    focusMinutes: number;
    breakMinutes: number;
    mode: SessionMode;
    remainingSeconds: number;
    isRunning: boolean;
    hasStarted: boolean;
    history: FocusSessionEntry[];
  }) => {
    if (typeof window === "undefined") return;
    const payload = JSON.stringify({
      focusMinutes: next.focusMinutes,
      breakMinutes: next.breakMinutes,
      history: next.history,
      mode: next.mode,
      remainingSeconds: next.remainingSeconds,
      isRunning: next.isRunning,
      hasStarted: next.hasStarted,
      updatedAt: Date.now()
    });
    window.localStorage.setItem(storageKey, payload);
  }, [storageKey]);




  useEffect(() => {
    if (!hasLoaded) return;
    if (isRunning) return;
    const nextKey = `focus:${focusMinutes}-break:${breakMinutes}-mode:${mode}`;
    if (nextKey === lastDurationKey.current) return;
    lastDurationKey.current = nextKey;
    const nextDuration = (mode === "focus" ? focusMinutes : breakMinutes) * 60;
    setRemainingSeconds(nextDuration);
  }, [breakMinutes, focusMinutes, isRunning, mode]);

  const totalSeconds = (mode === "focus" ? focusMinutes : breakMinutes) * 60;
  const progress = totalSeconds > 0 ? Math.min(1, Math.max(0, 1 - remainingSeconds / totalSeconds)) : 0;

  const recordSession = useCallback(
    (elapsedSeconds?: number) => {
      if (lastRecordedSessionId.current === sessionId) {
        return;
      }
      const spentSeconds = Math.max(
        0,
        Math.floor(elapsedSeconds ?? Math.max(0, totalSeconds - remainingSeconds))
      );
      if (spentSeconds <= 0) {
        return;
      }

      const entry: FocusSessionEntry = {
        id: createId(),
        mode,
        durationSeconds: spentSeconds,
        completedAt: new Date().toISOString()
      };
      setHistory((prev) => [entry, ...prev].slice(0, 200));
      lastRecordedSessionId.current = sessionId;
    },
    [mode, remainingSeconds, sessionId, totalSeconds]
  );
  const unlockAudio = useCallback(() => {
    unlockFocusAudio();
  }, []);

useEffect(() => {
  const shouldResume = searchParams.get("resume") === "1";
  if (!shouldResume) return;
  if (!hasLoaded) return;
  if (!isRunning) {
    if (remainingSeconds <= 0) {
      setRemainingSeconds((mode === "focus" ? focusMinutes : breakMinutes) * 60);
    }
    unlockAudio();
    setHasStarted(true);
    setIsRunning(true);
    const nextRemaining = remainingSeconds <= 0
      ? (mode === "focus" ? focusMinutes : breakMinutes) * 60
      : remainingSeconds;
    persistFocusState({
      focusMinutes,
      breakMinutes,
      mode,
      remainingSeconds: nextRemaining,
      isRunning: true,
      hasStarted: true,
      history
    });
  }
  const nextParams = new URLSearchParams(searchParams);
  nextParams.delete("resume");
  setSearchParams(nextParams, { replace: true });
}, [breakMinutes, focusMinutes, hasLoaded, history, isRunning, mode, remainingSeconds, searchParams, setSearchParams, unlockAudio, persistFocusState]);

  const playChime = useCallback(() => {
    playFocusChime();
  }, []);

  const clearAlarmInterval = useCallback(() => {
    if (alarmIntervalRef.current !== null) {
      window.clearInterval(alarmIntervalRef.current);
      alarmIntervalRef.current = null;
    }
  }, []);

  const stopAlarm = useCallback(() => {
    clearAlarmInterval();
    setAlarmState(null);
  }, [clearAlarmInterval]);

  const startSessionAlarm = useCallback((fromMode: SessionMode, nextMode: SessionMode) => {
    if (!isFocusAudioUnlocked()) {
      unlockAudio();
    }
    setAlarmState({ fromMode, nextMode });
    clearAlarmInterval();

    const ring = () => {
      playChime();
      window.setTimeout(playChime, 650);
    };
    ring();
    alarmIntervalRef.current = window.setInterval(ring, 3500);

    if (typeof window === "undefined" || !("Notification" in window)) {
      return;
    }
    if (Notification.permission === "granted") {
      const label = fromMode === "focus" ? "Focus" : "Break";
      const nextLabel = nextMode === "focus" ? "Focus" : "Break";
      void new Notification(`${label} session complete`, {
        body: `Time for ${nextLabel}.`
      });
    }
  }, [clearAlarmInterval, playChime, unlockAudio]);

  useEffect(() => () => clearAlarmInterval(), [clearAlarmInterval]);



  const advanceSession = useCallback(
    (options?: { record?: boolean; elapsedSeconds?: number; ringAlarm?: boolean }) => {
      if (options?.record) {
        recordSession(options.elapsedSeconds);
      }

      const nextMode = mode === "focus" ? "break" : "focus";
      if (options?.ringAlarm !== false) {
        startSessionAlarm(mode, nextMode);
      }
      const nextRemaining = (nextMode === "focus" ? focusMinutes : breakMinutes) * 60;
      setMode(nextMode);
      setRemainingSeconds(nextRemaining);
      setIsRunning(false);
      setHasStarted(false);
      setSessionId(createId());
      lastDurationKey.current = `focus:${focusMinutes}-break:${breakMinutes}-mode:${nextMode}`;
      persistFocusState({
        focusMinutes,
        breakMinutes,
        mode: nextMode,
        remainingSeconds: nextRemaining,
        isRunning: false,
        hasStarted: false,
        history
      });
    },
    [breakMinutes, focusMinutes, history, mode, persistFocusState, recordSession, startSessionAlarm]
  );

  useEffect(() => {
    if (!isRunning) return;
    const timerId = window.setInterval(() => {
      setRemainingSeconds((prev) => {
        if (prev <= 1) {
          window.clearInterval(timerId);
          advanceSession({ record: true, elapsedSeconds: totalSeconds });
          return 0;
        }
        return prev - 1;
      });
    }, 1000);

    return () => window.clearInterval(timerId);
  }, [advanceSession, isRunning, totalSeconds]);

  const stats = useMemo(() => {
    const now = new Date();
    const todayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    const weekStart = new Date(now);
    const day = weekStart.getDay();
    const diff = day === 0 ? 6 : day - 1;
    weekStart.setDate(weekStart.getDate() - diff);
    weekStart.setHours(0, 0, 0, 0);

    let todayFocusSeconds = 0;
    let weekFocusSeconds = 0;
    let totalFocusSeconds = 0;
    let focusSessions = 0;

    for (const entry of history) {
      if (entry.mode !== "focus") continue;
      focusSessions += 1;
      totalFocusSeconds += entry.durationSeconds;
      const entryDate = new Date(entry.completedAt);
      if (entryDate >= todayStart) {
        todayFocusSeconds += entry.durationSeconds;
      }
      if (entryDate >= weekStart) {
        weekFocusSeconds += entry.durationSeconds;
      }
    }

    return {
      focusSessions,
      totalFocusSeconds,
      todayFocusSeconds,
      weekFocusSeconds
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
  const alarmDescription = alarmState
    ? `${alarmState.fromMode === "focus" ? "Focus" : "Break"} session complete. ${alarmState.nextMode === "focus" ? "Focus" : "Break"} is ready. The alarm will keep ringing until you dismiss it.`
    : "";

  const handlePreset = (presetFocus: number, presetBreak: number) => {
    setFocusMinutes(presetFocus);
    setBreakMinutes(presetBreak);
    if (!isRunning) {
      setRemainingSeconds((mode === "focus" ? presetFocus : presetBreak) * 60);
      lastDurationKey.current = `focus:${presetFocus}-break:${presetBreak}-mode:${mode}`;
    }
  };

  const handleTimerToggle = async (): Promise<void> => {
    unlockAudio();
    stopAlarm();
    if (typeof window !== "undefined" && "Notification" in window && Notification.permission === "default") {
      void Notification.requestPermission();
    }

    const nextIsRunning = !isRunning;
    const nextRemaining = !isRunning && remainingSeconds <= 0 ? totalSeconds : remainingSeconds;

    if (!isRunning && remainingSeconds <= 0) {
      setRemainingSeconds(nextRemaining);
    }
    if (nextIsRunning) {
      setHasStarted(true);
    }
    setIsRunning(nextIsRunning);
    persistFocusState({
      focusMinutes,
      breakMinutes,
      mode,
      remainingSeconds: nextRemaining,
      isRunning: nextIsRunning,
      hasStarted: nextIsRunning || hasStarted,
      history
    });
  };

  return (
    <>
    <ConfirmDialog
      open={alarmState !== null}
      title="Timer complete"
      description={alarmDescription}
      confirmLabel="Dismiss alarm"
      showCancel={false}
      overlayClassName="z-[70]"
      onConfirm={stopAlarm}
      onCancel={() => {}}
    />
    <div className="space-y-6">
      <div className={`flex flex-wrap items-center justify-between gap-3 rounded-xl p-4 ${glassSubtleClass}`}>
        <div>
          <h2 className="text-2xl font-semibold tracking-tight">Focus mode</h2>
          <p className="text-sm text-muted-foreground">
            Personal Pomodoro sessions with calming visuals and private stats.
          </p>
        </div>
      </div>

      <div className="grid gap-6 lg:grid-cols-[minmax(0,1.15fr)_minmax(0,0.85fr)]">
        <Card className={`relative overflow-hidden ${glassStrongClass}`}>
          <div
            className={`absolute inset-0 focus-timer-surface ${
              mode === "focus" ? "focus-timer-focus" : "focus-timer-break"
            } ${isRunning ? "focus-timer-running" : ""}`}
          />
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
            {alarmState && (
              <div className={`flex flex-wrap items-center justify-between gap-3 rounded-lg p-3 ${glassSubtleClass}`}>
                <div className="flex items-center gap-2 text-sm font-semibold">
                  <BellRing className="h-4 w-4 text-orange-500" />
                  Session alarm is ringing
                </div>
                <Button size="sm" onClick={stopAlarm}>Dismiss alarm</Button>
              </div>
            )}
            <div className="flex flex-col items-center justify-center gap-6">
              <div className="flex items-center gap-3 text-xs font-semibold uppercase tracking-[0.25em] text-muted-foreground">
                <Sparkles className="h-4 w-4" />
                {modeLabel} session
              </div>

              <div className="relative h-64 w-64 rounded-full p-2" style={ringStyle}>
                <div className={`absolute inset-3 rounded-full ${glassSubtleClass} shadow-inner`}>
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
                <Button onClick={() => { void handleTimerToggle(); }} className="gap-2">
                  {isRunning ? <Pause className="h-4 w-4" /> : <Play className="h-4 w-4" />}
                  {isRunning ? "Pause" : hasStarted ? "Resume" : "Start"}
                </Button>
                <Button
                  variant="secondary"
                  className="gap-2"
                  onClick={() => {
                    unlockAudio();
                    stopAlarm();
                    const nextRemaining = (mode === "focus" ? focusMinutes : breakMinutes) * 60;
                    setIsRunning(false);
                    setRemainingSeconds(nextRemaining);
                    setHasStarted(false);
                    setSessionId(createId());
                    lastDurationKey.current = `focus:${focusMinutes}-break:${breakMinutes}-mode:${mode}`;
                    persistFocusState({
                      focusMinutes,
                      breakMinutes,
                      mode,
                      remainingSeconds: nextRemaining,
                      isRunning: false,
                      hasStarted: false,
                      history
                    });
                  }}
                >
                  <RotateCcw className="h-4 w-4" />
                  Reset
                </Button>
                <Button
                  variant="ghost"
                  className="gap-2"
                  onClick={() => {
                    unlockAudio();
                    stopAlarm();
                    const elapsedSeconds = Math.max(0, totalSeconds - remainingSeconds);
                    advanceSession({ record: true, elapsedSeconds, ringAlarm: false });
                  }}
                >
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
          <Card className={glassCardClass}>
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
                    className={glassInputClass}
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
                    className={glassInputClass}
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

          <Card className={glassCardClass}>
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-lg">
                <TrendingUp className="h-4 w-4" />
                Focus stats
              </CardTitle>
              <CardDescription>Personal history is stored locally.</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid gap-3 sm:grid-cols-2">
                <div className={`rounded-lg p-3 ${glassSubtleClass}`}>
                  <p className="text-xs text-muted-foreground">Today</p>
                  <p className="text-xl font-semibold">{formatDuration(stats.todayFocusSeconds)}</p>
                </div>
                <div className={`rounded-lg p-3 ${glassSubtleClass}`}>
                  <p className="text-xs text-muted-foreground">This week</p>
                  <p className="text-xl font-semibold">{formatDuration(stats.weekFocusSeconds)}</p>
                </div>
                <div className={`rounded-lg p-3 ${glassSubtleClass}`}>
                  <p className="text-xs text-muted-foreground">Total focus</p>
                  <p className="text-xl font-semibold">{formatDuration(stats.totalFocusSeconds)}</p>
                </div>
                <div className={`rounded-lg p-3 ${glassSubtleClass}`}>
                  <p className="text-xs text-muted-foreground">Focus sessions</p>
                  <p className="text-xl font-semibold">{stats.focusSessions}</p>
                </div>
              </div>

              <div className={`rounded-lg p-3 ${glassSubtleClass}`}>
                <p className="text-xs font-semibold uppercase tracking-[0.2em] text-muted-foreground">
                  Recent sessions
                </p>
                <div className="mt-3 space-y-2">
                  {history.slice(0, 6).map((entry) => (
                    <div
                      key={entry.id}
                      className={`flex items-center justify-between rounded-md px-3 py-2 text-xs ${glassSubtleClass}`}
                    >
                      <div>
                        <p className="font-semibold capitalize">{entry.mode}</p>
                        <p className="text-muted-foreground">
                          {new Date(entry.completedAt).toLocaleString()}
                        </p>
                      </div>
                      <span className="font-semibold">{formatDuration(entry.durationSeconds)}</span>
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
    </>
  );
}




