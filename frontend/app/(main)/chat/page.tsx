"use client";

/* eslint-disable  @typescript-eslint/no-explicit-any */

import { useEffect, useRef, useState } from "react";
import ReactMarkdown from "react-markdown";
type Msg = { role: "user" | "assistant" | "system"; text: string };

export default function Chatbot() {
  const [messages, setMessages] = useState<Msg[]>([
    { role: "system", text: "Hi! Ask me about Technical Accelerators." },
  ]);
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);
  const [apiError, setApiError] = useState<string | null>(null);

  const endRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    endRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages, loading]);

  async function sendMessage(text: string) {
    const trimmed = text.trim();
    if (!trimmed || loading) return;

    setApiError(null);
    setLoading(true);
    setMessages((m) => [...m, { role: "user", text: trimmed }]);
    setInput("");

    try {
      const url = `http://127.0.0.1:8000/query?payload=${encodeURIComponent(
        trimmed
      )}&mode=chat`;
      const res = await fetch(url, { method: "GET" });

      if (!res.ok) throw new Error(`HTTP ${res.status}`);

      let reply: string;
      const ctype = res.headers.get("content-type") || "";
      if (ctype.includes("application/json")) {
        const data = await res.json();
        reply =
          typeof data === "string"
            ? data
            : data?.model?.json?.recommendation
            ? `${data.model.json.recommendation}\n\n${
                data.model.json.rationale ?? ""
              }`
            : data?.message || JSON.stringify(data, null, 2);
      } else {
        reply = await res.text();
      }

      setMessages((m) => [...m, { role: "assistant", text: reply }]);
    } catch (e: any) {
      const msg = e?.message || "Request failed";
      setApiError(msg);
      setMessages((m) => [
        ...m,
        { role: "assistant", text: "Sorry—something went wrong." },
      ]);
    } finally {
      setLoading(false);
    }
  }

  function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    void sendMessage(input);
  }

  return (
    <div className="flex w-full items-center justify-center bg-[#073561] p-4">
      <div className="flex w-full max-w-2xl flex-col rounded-2xl bg-[#e8ecee] p-4 shadow-lg ring-1 ring-white/10 h-[calc(100vh-120px)]">
        <div className="flex-1 space-y-3 pr-2 overflow-y-auto">
          {messages.map((m, i) => (
            <div
              key={i}
              className={`flex w-full ${
                m.role === "user" ? "justify-end" : "justify-start"
              }`}
            >
              <div
                className={`inline-block max-w-[75%] whitespace-pre-wrap break-words rounded-2xl px-4 py-2 text-sm ${
                  m.role === "user"
                    ? "bg-blue-600 text-white shadow"
                    : m.role === "assistant" || m.role === "system"
                    ? "bg-[#63df4e] text-black"
                    : ""
                }`}
              >
                <ReactMarkdown>{m.text}</ReactMarkdown>
              </div>
            </div>
          ))}

          {loading && (
            <div className="flex w-full justify-start">
              <div className="inline-block max-w-[75%] rounded-2xl bg-[#63df4e]/70 px-4 py-2 text-sm text-black">
                Thinking…
              </div>
            </div>
          )}
          <div ref={endRef} />
        </div>

        {apiError && (
          <div className="mt-2 rounded-lg border border-red-600/40 bg-red-900/20 px-3 py-2 text-xs text-red-300">
            {apiError}
          </div>
        )}

        <form onSubmit={onSubmit} className="mt-3 flex gap-2">
          <input
            className="flex-1 rounded-xl bg-white px-4 py-3 text-sm text-black outline-none ring-1 ring-gray-400 placeholder:text-gray-500 focus:ring-2 focus:ring-blue-500"
            placeholder="Type your message…"
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter" && !e.shiftKey) {
                e.preventDefault();
                void sendMessage(input);
              }
            }}
            disabled={loading}
          />
          <button
            type="submit"
            disabled={loading || !input.trim()}
            className="rounded-xl bg-blue-600 px-4 py-3 text-sm font-medium text-white shadow hover:bg-blue-500 disabled:cursor-not-allowed disabled:opacity-50"
          >
            Send
          </button>
        </form>
      </div>
    </div>
  );
}
