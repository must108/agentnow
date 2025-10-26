"use client";
import { HiOutlineMicrophone } from "react-icons/hi2";

/* eslint-disable  @typescript-eslint/no-explicit-any */

import { useEffect, useRef, useState } from "react";

type ModelProps = {
  text: string;
  title: string;
  use_case?: "existing_user_request" | "non_existing_user_request" | "not_relevant" | "unknown" | string;
};

type HistoryItem = {
  id: string;
  title: string;
  text: string;
  use_case: string;
  utterance: string; 
  at: number;     
};

export default function Voice() {
  const recognitionRef = useRef<any>(null);
  const runningRef = useRef(false);

  const finalRef = useRef("");
  const interimRef = useRef("");
  const [apiData, setApiData] = useState<ModelProps | null>(null);
  const [apiError, setApiError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [displayText, setDisplayText] = useState("");

  const [history, setHistory] = useState<HistoryItem[]>([]);

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

          let parsed: ModelProps;

          const contentType = res.headers.get("content-type") || "";
          if (contentType.includes("application/json")) {
            const data = await res.json();
            parsed = {
              text: data?.text ?? "",
              title: data?.title ?? "",
              use_case: data?.use_case ?? "unknown",
            };
          } else {
            const txt = await res.text();
            parsed = { text: txt, title: "", use_case: "not_relevant" };
          }

          setApiData(parsed);
          const item: HistoryItem = {
            id: `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
            title: parsed.title || "No accelerator title",
            text: parsed.text || "",
            use_case: (parsed.use_case || "unknown") as string,
            utterance: finalText,
            at: Date.now(),
          };
          setHistory((h) => [item, ...h].slice(0, 50));

          speak(parsed.text);
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
    <div className="flex flex-col items-center justify-center gap-6 p-6 select-none bg-[#073561]">
      <div className="flex items-center gap-3">
        <div className="h-8 w-8 rounded-lg bg-[#63df4e]" />
        <h1 className="text-lg font-semibold">Speak with an AI Agent</h1>
      </div>
      <button
        id="ptt"
        onPointerDown={(e) => {
          e.preventDefault();
          start();
        }}
        onPointerUp={(e) => {
          e.preventDefault();
          stop();
        }}
        onContextMenu={(e) => e.preventDefault()}
        className="flex items-center justify-center w-28 h-28 rounded-full bg-[#63df4e] text-white text-3xl shadow-md hover:bg-[#6df056] active:scale-95 transition"
        aria-label="Press and hold to talk"
      >
        <HiOutlineMicrophone size={50} />
      </button>

      <div className="mt-2 max-w-2xl text-center text-white">
        {displayText ? (
          <p className="whitespace-pre-wrap">{displayText}</p>
        ) : (
          <p className="text-white text-lg italic">Press and hold to start speaking...</p>
        )}
      </div>

      <div className="w-full max-w-2xl mt-2 text-sm text-white">
        {loading && <p className="text-gray-200 text-center">Fetching response…</p>}
        {apiError && (
          <div className="text-center rounded-lg border border-red-600/40 bg-red-900/20 px-3 py-2 text-xs text-red-300">
            {apiError}
          </div>
        )}
        {apiData && (
          <div className="mt-3 rounded-lg bg-black/30 p-4 text-white space-y-2">
            {apiData.title ? (
              <h3 className="text-lg font-semibold text-center">{apiData.title}</h3>
            ) : (
              <h3 className="text-lg font-semibold text-gray-300 text-center">No accelerator title</h3>
            )}

            {apiData.use_case && (
              <div className="text-center">
                <span className="inline-block rounded-full bg-white/10 px-2 py-1 text-xs uppercase tracking-wide">
                  {apiData.use_case.replaceAll("_", " ")}
                </span>
              </div>
            )}

            {/* <p className="whitespace-pre-wrap wrap-break-words text-sm opacity-90 mt-2 text-center">
              {apiData.text}
            </p> */}
          </div>
        )}
      </div>

      <div className="w-full max-w-2xl mt-4 flex flex-col flex-grow overflow-hidden">
        <div className="mb-2 flex items-center justify-between">
          <h4 className="text-white/90 font-semibold">History</h4>
          <button
            onClick={() => setHistory([])}
            className="text-xs text-white/70 underline decoration-dotted hover:text-white"
          >
            Clear
          </button>
        </div>

        {history.length === 0 ? (
          <div className="rounded-lg bg-black/20 p-4 text-white/70 text-sm">
            No suggestions yet. Speak and release to see them here.
          </div>
        ) : (
          <ul className="space-y-2 max-h-[40vh] overflow-y-auto pr-2 scrollbar-thin scrollbar-thumb-white/20 scrollbar-track-transparent">
            {history.map((h) => (
              <li key={h.id} className="rounded-lg bg-black/30 p-3">
                <div className="flex items-center justify-between gap-2">
                  <div className="text-sm font-semibold">{h.title}</div>
                  <span className="inline-block rounded-full bg-white/10 px-2 py-0.5 text-[10px] uppercase tracking-wide">
                    {h.use_case}
                  </span>
                </div>
                {/* {h.text && (
                  <div className="mt-1 text-xs text-white/80 line-clamp-3">{h.text}</div>
                )} */}
                {h.utterance && (
                  <details className="mt-2 text-[11px] text-white/70">
                    <summary className="cursor-pointer select-none opacity-90">Your utterance</summary>
                    <div className="mt-1 whitespace-pre-wrap break-words">{h.utterance}</div>
                  </details>
                )}
                <div className="mt-2 text-[10px] text-white/50">
                  {new Date(h.at).toLocaleTimeString()}
                </div>
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  );
}
