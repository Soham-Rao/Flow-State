import { AUDIO_EXTENSIONS, IMAGE_EXTENSIONS, VIDEO_EXTENSIONS } from "./threads-page.constants";

export function getAttachmentKind(mimeType: string | null, filename: string): "image" | "video" | "audio" | "file" {
  if (mimeType?.startsWith("image/")) return "image";
  if (mimeType?.startsWith("video/")) return "video";
  if (mimeType?.startsWith("audio/")) return "audio";
  const lower = filename.toLowerCase();
  const dotIndex = lower.lastIndexOf(".");
  const ext = dotIndex >= 0 ? lower.slice(dotIndex) : "";
  if (IMAGE_EXTENSIONS.has(ext)) return "image";
  if (VIDEO_EXTENSIONS.has(ext)) return "video";
  if (AUDIO_EXTENSIONS.has(ext)) return "audio";
  return "file";
}

export function formatTimestamp(value: string | null): string {
  if (!value) return "";
  const date = new Date(value);
  return date.toLocaleString();
}

export function formatTime(value: string | null): string {
  if (!value) return "";
  const date = new Date(value);
  return date.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
}

export function formatDateHeading(value: string | null): string {
  if (!value) return "";
  const date = new Date(value);
  return date.toLocaleDateString([], { weekday: "short", month: "short", day: "numeric" });
}

export function formatPreview(text: string | null): string {
  if (!text) return "No messages yet";
  return text.length > 80 ? `${text.slice(0, 80)}…` : text;
}

export function formatDuration(totalSeconds: number): string {
  const safe = Number.isFinite(totalSeconds) ? Math.max(0, Math.round(totalSeconds)) : 0;
  const minutes = Math.floor(safe / 60);
  const seconds = safe % 60;
  if (minutes > 0) {
    return `${minutes}m ${seconds.toString().padStart(2, "0")}s`;
  }
  return `${seconds}s`;
}

export function resolveAudioDuration(blob: Blob, fallbackSeconds: number): Promise<number> {
  return new Promise((resolve) => {
    const url = URL.createObjectURL(blob);
    const audio = new Audio();
    let settled = false;

    const finalize = (duration: number) => {
      if (settled) return;
      settled = true;
      URL.revokeObjectURL(url);
      resolve(Number.isFinite(duration) ? duration : fallbackSeconds);
    };

    audio.addEventListener("loadedmetadata", () => finalize(audio.duration));
    audio.addEventListener("error", () => finalize(fallbackSeconds));
    audio.src = url;
    audio.load();
    window.setTimeout(() => finalize(fallbackSeconds), 2000);
  });
}

export function getInitial(value: string | null | undefined): string {
  if (!value) return "U";
  const trimmed = value.trim();
  return trimmed.length > 0 ? trimmed[0].toUpperCase() : "U";
}
