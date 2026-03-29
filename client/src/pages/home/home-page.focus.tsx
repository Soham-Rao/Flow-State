import { useEffect, useMemo, useState } from "react";
import { Timer } from "lucide-react";
import { Link } from "react-router-dom";

import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { glassCardClass, glassIconClass, glassMutedText, glassPillClass } from "@/pages/home/home-page.styles";

type FocusMode = "focus" | "break";

type FocusSnapshot = {
  status: "idle" | "running" | "paused";
  mode: FocusMode;
  remainingSeconds: number;
};

const formatTimer = (totalSeconds: number): string => {
  const safe = Math.max(0, Math.floor(totalSeconds));
  const minutes = Math.floor(safe / 60);
  const seconds = safe % 60;
  return `${minutes.toString().padStart(2, "0")}:${seconds.toString().padStart(2, "0")}`;
};

const getFocusSnapshot = (storageKey: string): FocusSnapshot => {
  if (typeof window === "undefined") {
    return { status: "idle", mode: "focus", remainingSeconds: 0 };
  }
  const raw = window.localStorage.getItem(storageKey);
  if (!raw) {
    return { status: "idle", mode: "focus", remainingSeconds: 0 };
  }
  try {
    const parsed = JSON.parse(raw) as Partial<{
      focusMinutes: number;
      breakMinutes: number;
      mode: FocusMode;
      remainingSeconds: number;
      isRunning: boolean;
      hasStarted: boolean;
      updatedAt: number;
    }>;
    const focusMinutes = typeof parsed.focusMinutes === "number" && parsed.focusMinutes > 0 ? parsed.focusMinutes : 90;
    const breakMinutes = typeof parsed.breakMinutes === "number" && parsed.breakMinutes > 0 ? parsed.breakMinutes : 10;
    const mode: FocusMode = parsed.mode === "break" ? "break" : "focus";
    const baseTotalSeconds = (mode === "focus" ? focusMinutes : breakMinutes) * 60;
    const storedRemaining = typeof parsed.remainingSeconds === "number"
      ? parsed.remainingSeconds
      : baseTotalSeconds;
    let remaining = storedRemaining;
    if (parsed.isRunning && typeof parsed.updatedAt === "number") {
      const elapsedSeconds = Math.max(0, Math.floor((Date.now() - parsed.updatedAt) / 1000));
      remaining = Math.max(0, storedRemaining - elapsedSeconds);
    }
    const progressThreshold = Math.max(0, baseTotalSeconds - 1);
    const progressMade = storedRemaining < progressThreshold || remaining < progressThreshold;
    const resetLike = !parsed.isRunning && storedRemaining >= progressThreshold && !progressMade;
    const inferredHasStarted = resetLike
      ? false
      : typeof parsed.hasStarted === "boolean"
        ? parsed.hasStarted
        : Boolean(parsed.isRunning || progressMade);
    const hasStarted = inferredHasStarted && remaining > 0;
    if (!hasStarted) {
      return { status: "idle", mode, remainingSeconds: 0 };
    }
    if (remaining <= 0) {
      return { status: "idle", mode, remainingSeconds: 0 };
    }
    return { status: parsed.isRunning ? "running" : "paused", mode, remainingSeconds: remaining };
  } catch {
    return { status: "idle", mode: "focus", remainingSeconds: 0 };
  }
};

export function FocusTimerCard({ storageKey }: { storageKey: string }): JSX.Element {
  const [tick, setTick] = useState(0);
  const focusSnapshot = useMemo(() => getFocusSnapshot(storageKey), [storageKey, tick]);

  useEffect(() => {
    const timer = window.setInterval(() => {
      setTick((value) => value + 1);
    }, 500);
    return () => window.clearInterval(timer);
  }, []);

  return (
    <Card className={glassCardClass}>
      <CardHeader>
        <CardTitle className="flex items-center gap-2 text-lg">
          <Timer className={`h-4 w-4 ${glassIconClass}`} />
          Pomodoro
        </CardTitle>
        <CardDescription>Your personal focus timer.</CardDescription>
      </CardHeader>
      <CardContent className="space-y-3">
        {focusSnapshot.status === "idle" ? (
          <div className="space-y-2">
            <p className={`text-sm ${glassMutedText}`}>Do you want to start focus mode?</p>
            <Link to="/focus" className="inline-flex mt-3 -ml-1">
              <Button size="sm" className={glassPillClass}>Start focus</Button>
            </Link>
          </div>
        ) : (
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <p className="text-sm font-semibold">
                {focusSnapshot.mode === "focus" ? "Focus" : "Break"} session
              </p>
              <span className="rounded-full border border-border/70 bg-secondary/70 px-2 py-0.5 text-[11px] text-muted-foreground">
                {focusSnapshot.status === "running" ? "Running" : "Paused"}
              </span>
            </div>
            <p className="text-2xl font-semibold tracking-tight">
              {formatTimer(focusSnapshot.remainingSeconds)} left
            </p>
            <Link to={focusSnapshot.status === "paused" ? "/focus?resume=1" : "/focus"}>
              <Button size="sm" variant="secondary">
                {focusSnapshot.status === "paused" ? "Resume focus" : "Open focus"}
              </Button>
            </Link>
          </div>
        )}
      </CardContent>
    </Card>
  );
}



