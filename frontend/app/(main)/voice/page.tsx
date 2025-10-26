"use client";

import { useState, useEffect, useRef } from "react";

export default function Voice() {
  const recognitionRef = useRef<any>(null);
const [text, setText] = useState("");

  useEffect(() => {
    const SR =
      (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
    if (!SR) {
      console.warn("Speech recognition not supported in this browser.");
      return;
    }

    const r = new SR();
    r.lang = "en-US";
    r.interimResults = true;
    r.continuous = false;

    r.onresult = (e: SpeechRecognitionEvent) => {
      const res = Array.from(e.results)
        .map((x) => x[0].transcript)
        .join("");

        setText(res);
    };

    r.onend = () => {
      window.postMessage({ type: "VOICE_TEXT", text });
    };

    recognitionRef.current = r;

    return () => {
        try { r.stop(); }
        catch {}
    };
  }, [text]);

  const start = () => {
    recognitionRef.current?.start();
  };

  const stop = () => {
    recognitionRef.current?.stop();
  };

  return (
    <div className="flex flex-col items-center justify-center gap-4 p-6">
      <button
        id="ptt"
        onMouseDown={start}
        onMouseUp={stop}
        onTouchStart={start}
        onTouchEnd={stop}
        className="rounded-full bg-blue-500 px-6 py-3 text-white text-lg font-medium shadow-md hover:bg-blue-600 active:scale-95 transition"
      >
        🎙️ Hold to Talk
      </button>

      <div className="mt-4 w-full max-w-md text-center text-gray-800">
        {text ? (
          <p className="whitespace-pre-wrap">{text}</p>
        ) : (
          <p className="text-gray-500 italic">Press and hold to start speaking...</p>
        )}
      </div>
    </div>
  );
}
