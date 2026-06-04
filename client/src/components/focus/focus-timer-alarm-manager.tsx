import { useCallback, useEffect, useRef, useState } from "react";
import { useLocation } from "react-router-dom";

import { ConfirmDialog } from "@/components/ui/confirm-dialog";
import {
  completeFocusTimerSession,
  FOCUS_STATE_CHANGED_EVENT,
  getFocusStorageKey,
  isFocusAudioUnlocked,
  playFocusChime,
  readFocusTimerState,
  unlockFocusAudio,
  writeFocusTimerState,
  type SessionMode
} from "@/lib/focus-timer";
import { useAuthStore } from "@/stores/auth-store";

interface AlarmState {
  fromMode: SessionMode;
  nextMode: SessionMode;
}

function getAlarmDescription(alarmState: AlarmState | null): string {
  if (!alarmState) return "";
  const fromLabel = alarmState.fromMode === "focus" ? "Focus" : "Break";
  const nextLabel = alarmState.nextMode === "focus" ? "Focus" : "Break";
  return `${fromLabel} session complete. ${nextLabel} is ready. The alarm will keep ringing until you dismiss it.`;
}

export function FocusTimerAlarmManager(): JSX.Element | null {
  const user = useAuthStore((state) => state.user);
  const location = useLocation();
  const [alarmState, setAlarmState] = useState<AlarmState | null>(null);
  const alarmIntervalRef = useRef<number | null>(null);
  const completionHandledRef = useRef<string | null>(null);
  const storageKey = getFocusStorageKey(user?.id);

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

  const startAlarm = useCallback((fromMode: SessionMode, nextMode: SessionMode) => {
    if (!isFocusAudioUnlocked()) {
      unlockFocusAudio();
    }
    setAlarmState({ fromMode, nextMode });
    clearAlarmInterval();

    const ring = () => {
      playFocusChime();
      window.setTimeout(playFocusChime, 650);
    };
    ring();
    alarmIntervalRef.current = window.setInterval(ring, 3500);

    if (typeof window === "undefined" || !("Notification" in window)) {
      return;
    }
    if (Notification.permission === "granted") {
      const fromLabel = fromMode === "focus" ? "Focus" : "Break";
      const nextLabel = nextMode === "focus" ? "Focus" : "Break";
      void new Notification(`${fromLabel} session complete`, {
        body: `Time for ${nextLabel}.`
      });
    }
  }, [clearAlarmInterval]);

  const checkForCompletion = useCallback(() => {
    if (!user) return;
    if (location.pathname === "/focus") return;

    const state = readFocusTimerState(storageKey);
    if (!state?.isRunning || state.remainingSeconds <= 0) {
      return;
    }

    const completionKey = `${state.mode}:${state.updatedAt}:${state.remainingSeconds}`;
    const elapsedSeconds = Math.max(0, Math.floor((Date.now() - state.updatedAt) / 1000));
    if (elapsedSeconds < state.remainingSeconds) {
      return;
    }
    if (completionHandledRef.current === completionKey) {
      return;
    }

    completionHandledRef.current = completionKey;
    const completion = completeFocusTimerSession(state);
    writeFocusTimerState(storageKey, completion.nextState);
    startAlarm(completion.fromMode, completion.nextMode);
  }, [location.pathname, startAlarm, storageKey, user]);

  useEffect(() => {
    if (!user) {
      stopAlarm();
      completionHandledRef.current = null;
      return;
    }

    checkForCompletion();
    const interval = window.setInterval(checkForCompletion, 1000);
    const onWake = () => checkForCompletion();
    window.addEventListener("focus", onWake);
    window.addEventListener("storage", onWake);
    window.addEventListener(FOCUS_STATE_CHANGED_EVENT, onWake);
    document.addEventListener("visibilitychange", onWake);

    return () => {
      window.clearInterval(interval);
      window.removeEventListener("focus", onWake);
      window.removeEventListener("storage", onWake);
      window.removeEventListener(FOCUS_STATE_CHANGED_EVENT, onWake);
      document.removeEventListener("visibilitychange", onWake);
    };
  }, [checkForCompletion, stopAlarm, user]);

  useEffect(() => () => clearAlarmInterval(), [clearAlarmInterval]);

  return (
    <ConfirmDialog
      open={alarmState !== null}
      title="Timer complete"
      description={getAlarmDescription(alarmState)}
      confirmLabel="Dismiss alarm"
      showCancel={false}
      overlayClassName="z-[70]"
      onConfirm={stopAlarm}
      onCancel={() => {}}
    />
  );
}
