"use client";
import { useCallback, useEffect, useRef, useState } from "react";

/* eslint-disable  @typescript-eslint/no-explicit-any */

export type Suggestion = { text: string; title: string; use_case?: string };
export type LiveState = {
  utterance?: string;
  suggestion?: Suggestion;
};

export function useLiveSuggestions(
  endpoint = "http://127.0.0.1:8000/transcribe_chunk",
  pollEndpoint = "http://127.0.0.1:8000/live_state"
) {
  const recRef = useRef<MediaRecorder | null>(null);
  const [listening, setListening] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [lastSuggestion, setLastSuggestion] = useState<LiveState | null>(null);

  const start = useCallback(async () => {
    setError(null);
    const stream = await navigator.mediaDevices.getUserMedia({
      audio: { echoCancellation: true, noiseSuppression: true, autoGainControl: true },
      video: false,
    });

    const rec = new MediaRecorder(stream, { mimeType: "audio/webm;codecs=opus" });
    rec.ondataavailable = async (e) => {
      if (!e.data.size || e.data.size < 8 * 1024) return;
      try {
        const fd = new FormData();
        fd.append("file", e.data, `chunk-${Date.now()}.webm`);
        const res = await fetch(endpoint, { method: "POST", body: fd });
        if (!res.ok) return; // non-blocking
        const json = await res.json();
        if (json?.finalized && json?.suggestion) {
          setLastSuggestion({ utterance: json.utterance, suggestion: json.suggestion });
        }
      } catch (err: any) {
        setError(err?.message || "upload failed");
      }
    };
    rec.start(2000);
    setTimeout(() => rec.requestData(), 250);
    recRef.current = rec;
    setListening(true);
  }, [endpoint]);

  const stop = useCallback(() => {
    try { recRef.current?.stop(); } catch {}
    recRef.current = null;
    setListening(false);
  }, []);

  useEffect(() => {
    if (!listening) return;
    const id = setInterval(async () => {
      try {
        const res = await fetch(pollEndpoint, { cache: "no-store" });
        if (!res.ok) return;
        const json = await res.json();
        if (json?.suggestion) setLastSuggestion(json);
      } catch {}
    }, 1500);
    return () => clearInterval(id);
  }, [listening, pollEndpoint]);

  return { start, stop, listening, error, lastSuggestion };
}
