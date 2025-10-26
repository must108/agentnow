"use client";
/* eslint-disable  @typescript-eslint/no-explicit-any */

import { useEffect, useMemo, useRef, useState } from "react";

type ModelProps = {
  text: string;
  title: string;
  use_case?:
    | "existing_user_request"
    | "non_existing_user_request"
    | "not_relevant"
    | "unknown"
    | string;
};
import { FaWandMagicSparkles } from "react-icons/fa6";

type HistoryItem = {
  id: string;
  title: string;
  text: string;
  use_case: string;
  utterance: string;
  at: number;
};

export default function AssistWrapperPage() {
  const recognitionRef = useRef<any>(null);
  const runningRef = useRef(false);
  const finalRef = useRef("");
  const interimRef = useRef("");

  const [listening, setListening] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [displayedText, setDisplayedText] = useState("");
  const [typing, setTyping] = useState(false);
  const [history, setHistory] = useState<HistoryItem[]>([]);

  const [latest, setLatest] = useState<ModelProps | null>(null);
  const title = latest?.title ?? "";
  const use_case = (latest?.use_case ?? "unknown") as string;
  const useCasePretty = use_case.replaceAll("_", " ");
  const [lastUtterance, setLastUtterance] = useState("");

  const sanitizeSuggestion = (s: string) =>
    (s ?? "")
      .replace(/\b(undefined|null)\s*$/i, "") // strip trailing undefined/null
      .replace(/\s{2,}/g, " ")
      .trim();

  useEffect(() => {
    const SR =
      (window as any).SpeechRecognition ||
      (window as any).webkitSpeechRecognition;
    if (!SR) {
      console.warn("Speech recognition not supported.");
      setError("Speech recognition not supported in this browser.");
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
        finalRef.current =
          (finalRef.current ? finalRef.current + " " : "") +
          finalChunk.trim();
      }
      interimRef.current = interimChunk;
    };

    r.onend = async () => {
      runningRef.current = false;
      setListening(false);

      if (interimRef.current) {
        finalRef.current =
          (finalRef.current ? finalRef.current + " " : "") +
          interimRef.current.trim();
        interimRef.current = "";
      }

      const finalText = finalRef.current.trim();
      setLastUtterance(finalText);

      if (!finalText) return;

      try {
        setError(null);
        const url = `http://127.0.0.1:8000/query?payload=${encodeURIComponent(
          finalText
        )}&mode=voice`;
        const res = await fetch(url, { method: "GET" });
        if (!res.ok) throw new Error(`HTTP ${res.status}`);

        const contentType = (res.headers.get("content-type") || "")
          .toLowerCase()
          .trim();

        let parsed: ModelProps;
        if (contentType.includes("application/json")) {
          const data = (await res.json().catch(() => ({}))) as any;
          parsed = {
            text: typeof data?.text === "string" ? data.text : "",
            title: typeof data?.title === "string" ? data.title : "",
            use_case:
              typeof data?.use_case === "string" ? data.use_case : "unknown",
          };
        } else {
          const txt = await res.text();
          parsed = {
            text: typeof txt === "string" ? txt : "",
            title: "",
            use_case: "not_relevant",
          };
        }

        // sanitize before setting
        parsed.text = sanitizeSuggestion(parsed.text);

        setLatest(parsed);

        const item: HistoryItem = {
          id: `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
          title: parsed.title || "No accelerator title",
          text: parsed.text || "",
          use_case: (parsed.use_case || "unknown") as string,
          utterance: finalText,
          at: Date.now(),
        };
        setHistory((h) => [item, ...h].slice(0, 50));
      } catch (e: any) {
        setError(e?.message || "Request failed");
      } finally {
        finalRef.current = "";
        interimRef.current = "";
      }
    };

    r.onerror = (err: any) => {
      if (err?.error !== "aborted") {
        console.warn("Speech error:", err);
        setError(err?.message || String(err));
      }
      runningRef.current = false;
      setListening(false);
    };

    recognitionRef.current = r;

    return () => {
      try {
        if (
          recognitionRef.current &&
          typeof recognitionRef.current.abort === "function"
        ) {
          recognitionRef.current.abort();
        } else {
          r.stop();
        }
      } catch {}
      runningRef.current = false;
      setListening(false);
    };
  }, []);

  const start = () => {
    if (!recognitionRef.current || runningRef.current) return;
    finalRef.current = "";
    interimRef.current = "";
    setLatest(null);
    setLastUtterance("");
    setDisplayedText("");
    setTyping(false);
    setError(null);

    try {
      recognitionRef.current.start();
      runningRef.current = true;
      setListening(true);
    } catch (e: any) {
      setError(e?.message || "Failed to start microphone.");
    }
  };

  const stop = () => {
    if (!recognitionRef.current || !runningRef.current) return;
    try {
      if (typeof recognitionRef.current.stop === "function") {
        recognitionRef.current.stop();
      } else if (typeof recognitionRef.current.abort === "function") {
        recognitionRef.current.abort();
      }
    } catch (e: any) {
      setError(e?.message || "Failed to stop microphone.");
    }
  };

  // Typewriter over sanitized text
  useEffect(() => {
    const raw = typeof latest?.text === "string" ? latest.text : "";
    const t = sanitizeSuggestion(raw);

    if (!t) {
      setDisplayedText("");
      setTyping(false);
      return;
    }

    setDisplayedText("");
    setTyping(true);
    let i = 0;
    const interval = setInterval(() => {
      if (i < t.length - 1) {
        setDisplayedText((prev) => prev + t[i]);
        i++;
      } else {
        clearInterval(interval);
        setTyping(false);
      }
    }, 20);

    return () => clearInterval(interval);
  }, [latest?.text]);

  const headerBadge = useMemo(
    () => (
      <span className="inline-block rounded-full bg-white/10 px-2 py-1 text-xs uppercase tracking-wide">
        {useCasePretty || "unknown"}
      </span>
    ),
    [useCasePretty]
  );

  return (
    <div className="min-h-screen w-full bg-[#073561] text-white">
      <header className="sticky top-0 z-10 border-b border-white/10 bg-[#073561]/80 backdrop-blur">
        <div className="mx-auto flex max-w-6xl items-center justify-between px-6 py-4">
          <div className="flex items-center gap-3">
            <FaWandMagicSparkles />
            <h1 className="text-lg font-semibold">Meeting Assist</h1>
          </div>

          <div className="flex items-center gap-3">
            {!listening ? (
              <button
                onClick={start}
                className="rounded-xl bg-[#63df4e] px-4 py-2 text-sm font-medium text-white shadow hover:bg-[#6df056]" 
              >
                Start
              </button>
            ) : (
              <button
                onClick={stop}
                className="rounded-xl bg-red-600 px-4 py-2 text-sm font-medium text-white shadow hover:bg-red-500"
              >
                Stop
              </button>
            )}
          </div>
        </div>
      </header>

      <main className="mx-auto grid max-w-6xl grid-cols-1 gap-6 px-6 py-6 md:grid-cols-5">
        <section className="md:col-span-3">
          <div className="rounded-2xl bg-black/25 p-5 ring-1 ring-white/10">
            <div className="mb-3 flex items-center justify-between gap-3">
              <h2 className="text-xl font-semibold">Live Suggestion</h2>
              <div className="flex items-center gap-2">
                {headerBadge}
                <span
                  className={`inline-flex items-center gap-2 rounded-full px-2 py-1 text-xs ${
                    listening
                      ? "bg-green-500/20 text-green-200"
                      : "bg-white/10 text-white/80"
                  }`}
                >
                  <span
                    className={`h-2 w-2 rounded-full ${
                      listening ? "bg-green-400" : "bg-white/40"
                    }`}
                  ></span>
                  {listening ? "Listening" : "Idle"}
                </span>
              </div>
            </div>

            <div className="space-y-3">
              <div className="rounded-xl bg-white/5 p-4">
                <div className="mb-1 text-sm text-white/70">Title</div>
                <div className="text-lg font-semibold">
                  {title || "No accelerator title"}
                </div>
              </div>

              <div className="rounded-xl bg-white/5 p-4">
                <div className="mb-1 text-sm text-white/70">Suggestion</div>
                <p
                  className={`whitespace-pre-wrap break-words text-sm opacity-90 ${
                    typing ? "border-r-2 border-white pr-1 animate-pulse" : ""
                  }`}
                >
                  {displayedText || "—"}
                </p>
              </div>

              {lastUtterance ? (
                <div className="rounded-xl bg-white/5 p-4">
                  <div className="mb-1 text-sm text-white/70">
                    Your recent utterance
                  </div>
                  <p className="text-xs opacity-80 whitespace-pre-wrap break-words">
                    {lastUtterance}
                  </p>
                </div>
              ) : null}

              {error && (
                <div className="rounded-xl border border-red-400/30 bg-red-500/10 p-3 text-sm text-red-200">
                  {error}
                </div>
              )}
            </div>
          </div>
        </section>

        <aside className="md:col-span-2">
          <div className="rounded-2xl bg-black/25 p-5 ring-1 ring-white/10">
            <div className="mb-3 flex items-center justify-between gap-3">
              <h2 className="text-xl font-semibold">History</h2>
              <button
                className="text-xs underline decoration-dotted text-white/70 hover:text-white"
                onClick={() => setHistory([])}
              >
                Clear
              </button>
            </div>

            {history.length === 0 ? (
              <div className="rounded-xl bg-white/5 p-4 text-sm text-white/70">
                No suggestions yet. Press <strong>Start</strong> and speak.
              </div>
            ) : (
              <div className="max-h-[60vh] overflow-y-auto pr-1">
                <ul className="space-y-3">
                  {history.map((h) => (
                    <li key={h.id} className="rounded-xl bg-white/5 p-4">
                      <div className="mb-1 flex items-center justify-between">
                        <div className="text-sm font-semibold">{h.title}</div>
                        <span className="ml-3 inline-block rounded-full bg-white/10 px-2 py-1 text-[10px] uppercase tracking-wide text-center">
                          {h.use_case}
                        </span>
                      </div>
                      {h.utterance ? (
                        <details className="mt-2 text-[11px] text-white/70">
                          <summary className="cursor-pointer select-none opacity-90">
                            Utterance
                          </summary>
                          <div className="mt-1 whitespace-pre-wrap break-words">
                            {h.utterance}
                          </div>
                        </details>
                      ) : null}
                      <div className="mt-2 text-[10px] text-white/50">
                        {new Date(h.at).toLocaleTimeString()}
                      </div>
                    </li>
                  ))}
                </ul>
              </div>
            )}
          </div>
        </aside>
      </main>
    </div>
  );
}
