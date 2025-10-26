"use client";

import { useEffect, useRef, useState } from "react";

export default function Voice() {
  const recognitionRef = useRef<any>(null);
  const runningRef = useRef(false);

  // refs hold the authoritative text (no re-renders required)
  const finalRef = useRef("");
  const interimRef = useRef("");

  // state is just for UI display
  const [displayText, setDisplayText] = useState("");

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

    r.onend = () => {
      runningRef.current = false;
      // commit any remaining interim to final on end
      if (interimRef.current) {
        finalRef.current = (finalRef.current ? finalRef.current + " " : "") + interimRef.current.trim();
        interimRef.current = "";
        setDisplayText(finalRef.current);
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
  }, []); // IMPORTANT: set up once

  const start = () => {
    if (!recognitionRef.current || runningRef.current) return;
    // reset per-session interim (keep previous final if you want to append across presses)
    finalRef.current = "";
    interimRef.current = "";
    setDisplayText("");
    try {
      recognitionRef.current.start();
      runningRef.current = true;
    } catch {}
  };

  const stop = () => {
    if (!recognitionRef.current || !runningRef.current) return;
    // slight delay so Chrome can deliver the last final result
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
    </div>
  );
}
