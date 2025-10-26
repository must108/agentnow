"use client";

import { useEffect, useMemo, useState } from "react";
import { useLiveSuggestions } from "@/app/hooks/useLiveSuggestions";

type HistoryItem = {
  id: string;
  title: string;
  text: string;
  useCase: string;
  utterance?: string;
  at: number;
};

export default function AssistWrapperPage() {
  const { start, stop, listening, error, lastSuggestion } = useLiveSuggestions();
  const [displayedText, setDisplayedText] = useState("");
  const [typing, setTyping] = useState(false);
  const [history, setHistory] = useState<HistoryItem[]>([]);

  const title = lastSuggestion?.suggestion?.title ?? "";
  const text = lastSuggestion?.suggestion?.text ?? "";
  const useCase = (lastSuggestion?.suggestion?.use_case ?? "unknown").replaceAll("_", " ");
  const utterance = lastSuggestion?.utterance ?? "";

  useEffect(() => {
    if (!text) return;
    setDisplayedText("");
    setTyping(true);
    let i = 0;
    const interval = setInterval(() => {
      setDisplayedText((prev) => prev + text[i]);
      i++;
      if (i >= text.length) {
        clearInterval(interval);
        setTyping(false);
      }
    }, 20);
    return () => clearInterval(interval);
  }, [text]);

  useEffect(() => {
    if (!title && !text) return;
    const id = `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
    const item: HistoryItem = {
      id,
      title: title || "No accelerator title",
      text,
      useCase,
      utterance,
      at: Date.now(),
    };
    setHistory((h) => [item, ...h].slice(0, 50))
  }, [title, text, useCase, utterance]);

  const headerBadge = useMemo(
    () => (
      <span className="inline-block rounded-full bg-white/10 px-2 py-1 text-xs uppercase tracking-wide">
        {useCase || "unknown"}
      </span>
    ),
    [useCase]
  );

  return (
    <div className="min-h-screen w-full bg-[#073561] text-white">
      <header className="sticky top-0 z-10 border-b border-white/10 bg-[#073561]/80 backdrop-blur">
        <div className="mx-auto flex max-w-6xl items-center justify-between px-6 py-4">
          <div className="flex items-center gap-3">
            <div className="h-8 w-8 rounded-lg bg-[#63df4e]" />
            <h1 className="text-lg font-semibold">Meeting Assist</h1>
          </div>

          <div className="flex items-center gap-3">
            {!listening ? (
              <button
                onClick={start}
                className="rounded-xl bg-green-600 px-4 py-2 text-sm font-medium text-white shadow hover:bg-green-500"
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
                    listening ? "bg-green-500/20 text-green-200" : "bg-white/10 text-white/80"
                  }`}
                >
                  <span className={`h-2 w-2 rounded-full ${listening ? "bg-green-400" : "bg-white/40"}`}></span>
                  {listening ? "Listening" : "Idle"}
                </span>
              </div>
            </div>

            <div className="space-y-3">
              <div className="rounded-xl bg-white/5 p-4">
                <div className="mb-1 text-sm text-white/70">Title</div>
                <div className="text-lg font-semibold">{title || "No accelerator title"}</div>
              </div>

              <div className="rounded-xl bg-white/5 p-4">
                <div className="mb-1 text-sm text-white/70">Suggestion</div>
                <p
                  className={`whitespace-pre-wrap wrap-break-word text-sm opacity-90 ${
                    typing ? "border-r-2 border-white pr-1 animate-pulse" : ""
                  }`}
                >
                  {displayedText || "—"}
                </p>
              </div>

              {utterance ? (
                <div className="rounded-xl bg-white/5 p-4">
                  <div className="mb-1 text-sm text-white/70">Your recent utterance</div>
                  <p className="text-xs opacity-80 whitespace-pre-wrap wrap-break-words">{utterance}</p>
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
              <ul className="space-y-3">
                {history.map((h) => (
                  <li key={h.id} className="rounded-xl bg-white/5 p-4">
                    <div className="mb-1 flex items-center justify-between">
                      <div className="text-sm font-semibold">{h.title}</div>
                      <span className="ml-3 inline-block rounded-full bg-white/10 px-2 py-1 text-[10px] uppercase tracking-wide text-center">
                        {h.useCase}
                      </span>
                    </div>
                    {/* <div className="line-clamp-3 text-xs opacity-80">{h.text}</div> */}
                    {h.utterance ? (
                      <details className="mt-2 text-[11px] text-white/70">
                        <summary className="cursor-pointer select-none opacity-90">Utterance</summary>
                        <div className="mt-1 whitespace-pre-wrap wrap-break-words">{h.utterance}</div>
                      </details>
                    ) : null}
                    <div className="mt-2 text-[10px] text-white/50">
                      {new Date(h.at).toLocaleTimeString()}
                    </div>
                  </li>
                ))}
              </ul>
            )}
          </div>
        </aside>
      </main>
    </div>
  );
}
