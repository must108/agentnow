"use client";

/* eslint-disable  @typescript-eslint/no-explicit-any */

import { useEffect, useRef, useState } from "react";

export default function Voice() {
  const recognitionRef = useRef<any>(null);
  const runningRef = useRef(false);

  const finalRef = useRef("");
  const interimRef = useRef("");
  const [apiData, setApiData] = useState<any>(null);
  const [apiError, setApiError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  const [displayText, setDisplayText] = useState("");

  const speak = async (text: string) => {
    try {
      const res = await fetch("/api/tts", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ text }),
      });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);

      const blob = await res.blob();
      const url = URL.createObjectURL(blob);
      const audio = new Audio(url);
      await audio.play();
    } catch (err) {
      console.warn("TTS error:", err);
    }
  };

  useEffect(() => {
    const SR =
      (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
    if (!SR) {
      console.warn("Speech recognition not supported.");
      return;
    }

    const r = new SR();
    r.lang = "en-US";
    r.interimResults = true;
    r.continuous = true;
    r.maxAlternatives = 1;

    r.onresult = (e: any) => {
      let interimChunk = "";
      let finalChunk = "";

      for (let i = e.resultIndex; i < e.results.length; i++) {
        const transcript = e.results[i][0].transcript;
        if (e.results[i].isFinal) finalChunk += transcript;
        else interimChunk += transcript;
      }

      if (finalChunk) {
        finalRef.current = (finalRef.current ? finalRef.current + " " : "") + finalChunk.trim();
      }
      interimRef.current = interimChunk;
      setDisplayText((finalRef.current + " " + interimRef.current).trim());
    };

    r.onend = async () => {
      runningRef.current = false;

      if (interimRef.current) {
        finalRef.current = (finalRef.current ? finalRef.current + " " : "") + interimRef.current.trim();
        interimRef.current = "";
        setDisplayText(finalRef.current);
      }

      const finalText = finalRef.current.trim();

      if (finalText) {
        setLoading(true);
        setApiError(null);
        setApiData(null);
        try {
          const url = `http://127.0.0.1:8000/query?payload=${encodeURIComponent(finalText)}&mode=voice`;
          const res = await fetch(url, { method: "GET" });
          if (!res.ok) throw new Error(`HTTP ${res.status}`);
          const data = await res;
          setApiData(data);

          const reply = data as unknown as string;
          speak(reply);
        } catch (e: any) {
          setApiError(e?.message || "Request failed");
        } finally {
          setLoading(false);
        }
      }

      window.postMessage({ type: "VOICE_TEXT", text: finalRef.current });
    };

    r.onerror = (err: any) => {
      if (err?.error !== "aborted") console.warn("Speech error:", err);
      runningRef.current = false;
    };

    recognitionRef.current = r;

    return () => {
      try { r.stop(); } catch {}
      runningRef.current = false;
    };
  }, []);

  const start = () => {
    if (!recognitionRef.current || runningRef.current) return;
    finalRef.current = "";
    interimRef.current = "";
    setApiData(null);
    setApiError(null);
    setDisplayText("");
    try {
      recognitionRef.current.start();
      runningRef.current = true;
    } catch {}
  };

  const stop = () => {
    if (!recognitionRef.current || !runningRef.current) return;
    setTimeout(() => {
      try { recognitionRef.current.stop(); } catch {}
    }, 120);
  };

  return (
    <div className="flex flex-col items-center justify-center gap-4 p-6 select-none">
      <button
        id="ptt"
        onPointerDown={(e) => { e.preventDefault(); start(); }}
        onPointerUp={(e) => { e.preventDefault(); stop(); }}
        onContextMenu={(e) => e.preventDefault()}
        className="rounded-full bg-blue-500 px-6 py-3 text-white text-lg font-medium shadow-md hover:bg-blue-600 active:scale-95 transition"
      >
        🎙️ Hold to Talk
      </button>

      <div className="mt-4 w-full max-w-md text-center text-white">
        {displayText ? (
          <p className="whitespace-pre-wrap">
            {displayText}
          </p>
        ) : (
          <p className="text-white italic">Press and hold to start speaking...</p>
        )}
      </div>

      <div className="w-full max-w-md mt-2 text-sm text-white">
        {loading && <p className="text-gray-200">Fetching response…</p>}
        {apiError && <p className="text-red-300">Error: {apiError}</p>}
        {apiData && (
          <pre className="mt-2 rounded-lg bg-black/30 p-3 text-white whitespace-pre-wrap wrap-break-word">
            {apiData}
          </pre>
        )}
      </div>
    </div>
  );
}
