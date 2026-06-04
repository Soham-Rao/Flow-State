export type SessionMode = "focus" | "break";

export interface FocusSessionEntry {
  id: string;
  mode: SessionMode;
  durationSeconds: number;
  completedAt: string;
}

export interface StoredFocusTimerState {
  focusMinutes: number;
  breakMinutes: number;
  mode: SessionMode;
  remainingSeconds: number;
  isRunning: boolean;
  hasStarted: boolean;
  history: FocusSessionEntry[];
  updatedAt: number;
}

export interface FocusCompletion {
  fromMode: SessionMode;
  nextMode: SessionMode;
  nextState: StoredFocusTimerState;
}

export const DEFAULT_FOCUS_MINUTES = 90;
export const DEFAULT_BREAK_MINUTES = 10;
export const FOCUS_STATE_CHANGED_EVENT = "flowstate:focus-state-changed";

let audioContext: AudioContext | null = null;
let audioUnlocked = false;

export function getFocusStorageKey(userId: string | undefined | null): string {
  return userId ? `flowstate:focus:${userId}` : "flowstate:focus:guest";
}

export function createFocusId(): string {
  if (typeof crypto !== "undefined" && "randomUUID" in crypto) {
    return crypto.randomUUID();
  }
  return `session_${Date.now()}_${Math.random().toString(16).slice(2)}`;
}

export function normalizeFocusTimerState(raw: string | null): StoredFocusTimerState | null {
  if (!raw) return null;
  try {
    const parsed = JSON.parse(raw) as Partial<StoredFocusTimerState>;
    const focusMinutes =
      typeof parsed.focusMinutes === "number" && parsed.focusMinutes > 0
        ? parsed.focusMinutes
        : DEFAULT_FOCUS_MINUTES;
    const breakMinutes =
      typeof parsed.breakMinutes === "number" && parsed.breakMinutes > 0
        ? parsed.breakMinutes
        : DEFAULT_BREAK_MINUTES;
    const mode: SessionMode = parsed.mode === "break" ? "break" : "focus";
    const totalSeconds = (mode === "focus" ? focusMinutes : breakMinutes) * 60;
    const remainingSeconds = typeof parsed.remainingSeconds === "number"
      ? Math.max(0, Math.floor(parsed.remainingSeconds))
      : totalSeconds;
    const history = Array.isArray(parsed.history)
      ? parsed.history.filter((entry): entry is FocusSessionEntry =>
          Boolean(entry?.id) &&
          (entry.mode === "focus" || entry.mode === "break") &&
          typeof entry.durationSeconds === "number" &&
          entry.durationSeconds > 0 &&
          typeof entry.completedAt === "string"
        )
      : [];

    return {
      focusMinutes,
      breakMinutes,
      mode,
      remainingSeconds,
      isRunning: Boolean(parsed.isRunning && remainingSeconds > 0),
      hasStarted: Boolean(parsed.hasStarted),
      history,
      updatedAt: typeof parsed.updatedAt === "number" ? parsed.updatedAt : Date.now()
    };
  } catch {
    return null;
  }
}

export function readFocusTimerState(storageKey: string): StoredFocusTimerState | null {
  if (typeof window === "undefined") return null;
  return normalizeFocusTimerState(window.localStorage.getItem(storageKey));
}

export function writeFocusTimerState(storageKey: string, state: StoredFocusTimerState): void {
  if (typeof window === "undefined") return;
  window.localStorage.setItem(storageKey, JSON.stringify(state));
  window.dispatchEvent(new CustomEvent(FOCUS_STATE_CHANGED_EVENT));
}

export function completeFocusTimerSession(state: StoredFocusTimerState, completedAt = new Date()): FocusCompletion {
  const fromMode = state.mode;
  const nextMode: SessionMode = fromMode === "focus" ? "break" : "focus";
  const totalSeconds = (fromMode === "focus" ? state.focusMinutes : state.breakMinutes) * 60;
  const elapsedSeconds = Math.max(0, totalSeconds);
  const nextRemaining = (nextMode === "focus" ? state.focusMinutes : state.breakMinutes) * 60;
  const entry: FocusSessionEntry = {
    id: createFocusId(),
    mode: fromMode,
    durationSeconds: elapsedSeconds,
    completedAt: completedAt.toISOString()
  };

  return {
    fromMode,
    nextMode,
    nextState: {
      ...state,
      mode: nextMode,
      remainingSeconds: nextRemaining,
      isRunning: false,
      hasStarted: false,
      history: [entry, ...state.history].slice(0, 200),
      updatedAt: Date.now()
    }
  };
}

function getAudioContext(): AudioContext | null {
  if (audioContext) return audioContext;
  if (typeof window === "undefined") return null;
  const AudioContextCtor = window.AudioContext;
  if (!AudioContextCtor) return null;
  audioContext = new AudioContextCtor();
  return audioContext;
}

export function isFocusAudioUnlocked(): boolean {
  return audioUnlocked;
}

export function unlockFocusAudio(): void {
  const context = getAudioContext();
  if (!context) return;
  if (context.state === "suspended") {
    void context.resume();
  }
  audioUnlocked = true;
}

export function playFocusChime(): void {
  const context = getAudioContext();
  if (!context) return;
  if (context.state === "suspended") {
    void context.resume();
  }
  const now = context.currentTime;
  const gain = context.createGain();
  gain.gain.value = 0.0001;
  gain.connect(context.destination);

  const beep = (time: number, frequency: number): void => {
    const osc = context.createOscillator();
    osc.type = "sine";
    osc.frequency.value = frequency;
    osc.connect(gain);
    osc.start(time);
    osc.stop(time + 0.12);
    gain.gain.setValueAtTime(0.0001, time);
    gain.gain.exponentialRampToValueAtTime(0.2, time + 0.02);
    gain.gain.exponentialRampToValueAtTime(0.0001, time + 0.12);
  };

  beep(now, 880);
  beep(now + 0.2, 880);
  beep(now + 0.4, 660);
}
