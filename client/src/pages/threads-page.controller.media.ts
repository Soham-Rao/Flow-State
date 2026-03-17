import { useEffect, useRef, useState } from "react";

import {
  createThreadMessage,
  createThreadVoiceNote,
  fetchThreadAttachmentBlob,
  fetchThreadVoiceNote,
  listDmConversations
} from "@/lib/threads-api";
import type { DmConversationSummary, ThreadMessageSummary } from "@/types/threads";
import { getAttachmentKind, resolveAudioDuration } from "./threads-page.utils";

type ThreadMediaParams = {
  activeConversationId: string | null;
  messages: ThreadMessageSummary[];
  setMessages: React.Dispatch<React.SetStateAction<ThreadMessageSummary[]>>;
  setDmConversations: React.Dispatch<React.SetStateAction<DmConversationSummary[]>>;
  setSendError: React.Dispatch<React.SetStateAction<string | null>>;
};

type ThreadMediaState = {
  recording: boolean;
  recordingDuration: number;
  startRecording: () => void;
  stopRecording: () => void;
  cancelRecording: () => void;
  voiceUrls: Record<string, string>;
  attachmentPreviewUrls: Record<string, string>;
};

export function useThreadMedia({
  activeConversationId,
  messages,
  setMessages,
  setDmConversations,
  setSendError
}: ThreadMediaParams): ThreadMediaState {
  const [recording, setRecording] = useState(false);
  const [recordingDuration, setRecordingDuration] = useState(0);
  const [recordingError, setRecordingError] = useState<string | null>(null);
  const [sendingVoice, setSendingVoice] = useState(false);
  const [voiceUrls, setVoiceUrls] = useState<Record<string, string>>({});
  const [attachmentPreviewUrls, setAttachmentPreviewUrls] = useState<Record<string, string>>({});

  const recorderRef = useRef<MediaRecorder | null>(null);
  const recorderStreamRef = useRef<MediaStream | null>(null);
  const recorderChunksRef = useRef<Blob[]>([]);
  const recordingTimerRef = useRef<number | null>(null);
  const recordingDurationRef = useRef(0);
  const recordingCanceledRef = useRef(false);
  const voiceFetchRef = useRef<Set<string>>(new Set());
  const voiceUrlsRef = useRef<Record<string, string>>({});
  const attachmentPreviewUrlsRef = useRef<Record<string, string>>({});
  const attachmentPreviewFetchRef = useRef<Set<string>>(new Set());

  const setVoiceUrl = (voiceNoteId: string, url: string) => {
    const next = { ...voiceUrlsRef.current, [voiceNoteId]: url };
    voiceUrlsRef.current = next;
    setVoiceUrls(next);
  };

  const setAttachmentPreviewUrl = (attachmentId: string, url: string) => {
    const next = { ...attachmentPreviewUrlsRef.current, [attachmentId]: url };
    attachmentPreviewUrlsRef.current = next;
    setAttachmentPreviewUrls(next);
  };

  useEffect(() => {
    Object.values(voiceUrlsRef.current).forEach((url) => URL.revokeObjectURL(url));
    voiceUrlsRef.current = {};
    voiceFetchRef.current = new Set();
    setVoiceUrls({});
    Object.values(attachmentPreviewUrlsRef.current).forEach((url) => URL.revokeObjectURL(url));
    attachmentPreviewUrlsRef.current = {};
    attachmentPreviewFetchRef.current = new Set();
    setAttachmentPreviewUrls({});
    setRecording(false);
    setRecordingDuration(0);
    setRecordingError(null);
    setSendingVoice(false);
  }, [activeConversationId]);

  useEffect(() => {
    if (messages.length === 0) return;
    let cancelled = false;
    const fetchMissing = async () => {
      for (const message of messages) {
        const voiceNote = message.voiceNote;
        if (!voiceNote) continue;
        if (voiceUrlsRef.current[voiceNote.id]) continue;
        if (voiceFetchRef.current.has(voiceNote.id)) continue;
        voiceFetchRef.current.add(voiceNote.id);
        try {
          const blob = await fetchThreadVoiceNote(voiceNote.id);
          if (cancelled) return;
          const url = URL.createObjectURL(blob);
          setVoiceUrl(voiceNote.id, url);
        } catch {
          voiceFetchRef.current.delete(voiceNote.id);
        }
      }
    };
    void fetchMissing();
    return () => {
      cancelled = true;
    };
  }, [messages]);

  useEffect(() => {
    if (messages.length === 0) return;
    let cancelled = false;
    const fetchAttachmentPreview = async () => {
      for (const message of messages) {
        for (const attachment of message.attachments ?? []) {
          const kind = getAttachmentKind(attachment.mimeType, attachment.originalName);
          if (kind === "file") continue;
          if (attachmentPreviewUrlsRef.current[attachment.id]) continue;
          if (attachmentPreviewFetchRef.current.has(attachment.id)) continue;
          attachmentPreviewFetchRef.current.add(attachment.id);
          try {
            const blob = await fetchThreadAttachmentBlob(attachment.id);
            if (cancelled) return;
            const url = URL.createObjectURL(blob);
            setAttachmentPreviewUrl(attachment.id, url);
          } catch {
            attachmentPreviewFetchRef.current.delete(attachment.id);
          }
        }
      }
    };
    void fetchAttachmentPreview();
    return () => {
      cancelled = true;
    };
  }, [messages]);

  const stopRecordingTimer = () => {
    if (recordingTimerRef.current) {
      window.clearInterval(recordingTimerRef.current);
      recordingTimerRef.current = null;
    }
  };

  const cleanupRecordingStream = () => {
    recorderStreamRef.current?.getTracks().forEach((track) => track.stop());
    recorderStreamRef.current = null;
    recorderRef.current = null;
  };

  const startRecordingTimer = () => {
    recordingDurationRef.current = 0;
    setRecordingDuration(0);
    recordingTimerRef.current = window.setInterval(() => {
      recordingDurationRef.current += 1;
      setRecordingDuration(recordingDurationRef.current);
    }, 1000);
  };

  const handleSendVoiceNote = async (blob: Blob, durationSec: number) => {
    if (!activeConversationId || sendingVoice) return;
    setSendingVoice(true);
    setSendError(null);
    try {
      const created = await createThreadMessage(activeConversationId, {
        body: "",
        hasVoiceNote: true
      });
      const file = new File([blob], `voice-${created.id}.webm`, { type: blob.type || "audio/webm" });
      const voiceNote = await createThreadVoiceNote(created.id, file, durationSec);
      const url = URL.createObjectURL(blob);
      setVoiceUrl(voiceNote.id, url);
      const enriched = { ...created, voiceNote };
      setMessages((prev) => [...prev, enriched]);
      const refreshed = await listDmConversations();
      setDmConversations(refreshed);
    } catch (error) {
      setSendError(error instanceof Error ? error.message : "Unable to send voice message right now.");
    } finally {
      setSendingVoice(false);
    }
  };

  const startRecording = async () => {
    if (recording || sendingVoice) return;
    setRecordingError(null);
    if (!navigator.mediaDevices?.getUserMedia) {
      setRecordingError("Voice recording isn't supported in this browser.");
      return;
    }
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      recorderStreamRef.current = stream;
      const recorder = new MediaRecorder(stream);
      recorderRef.current = recorder;
      recorderChunksRef.current = [];
      recordingCanceledRef.current = false;
      recorder.ondataavailable = (event) => {
        if (event.data.size > 0) {
          recorderChunksRef.current.push(event.data);
        }
      };
      recorder.onstop = () => {
        stopRecordingTimer();
        cleanupRecordingStream();
        setRecording(false);
        const fallbackDuration = recordingDurationRef.current;
        const chunks = recorderChunksRef.current;
        recorderChunksRef.current = [];
        if (recordingCanceledRef.current) {
          recordingCanceledRef.current = false;
          return;
        }
        if (chunks.length === 0) {
          setRecordingError("No audio captured.");
          return;
        }
        const blob = new Blob(chunks, { type: recorder.mimeType || "audio/webm" });
        void resolveAudioDuration(blob, fallbackDuration).then((duration) => {
          void handleSendVoiceNote(blob, duration);
        });
      };
      recorder.start();
      setRecording(true);
      startRecordingTimer();
    } catch {
      cleanupRecordingStream();
      setRecordingError("Microphone access was blocked.");
    }
  };

  const stopRecording = () => {
    if (!recorderRef.current) return;
    recorderRef.current.stop();
  };

  const cancelRecording = () => {
    if (!recorderRef.current) {
      setRecording(false);
      stopRecordingTimer();
      cleanupRecordingStream();
      return;
    }
    recordingCanceledRef.current = true;
    recorderRef.current.stop();
  };

  return {
    recording,
    recordingDuration,
    startRecording,
    stopRecording,
    cancelRecording,
    voiceUrls,
    attachmentPreviewUrls
  };
}
