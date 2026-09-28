"use client";

import { useEffect, useRef, useState } from "react";

type Message = { role: "user" | "assistant"; content: string };

const GREETING =
  "Hi! I can help you find your way around Akani — ask me things like \"where do I import a business\" or \"how do campaigns work\".";

export function AssistantWidget() {
  const [open, setOpen] = useState(false);
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState("");
  const [sending, setSending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const listRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);

  useEffect(() => {
    if (open) inputRef.current?.focus();
  }, [open]);

  useEffect(() => {
    listRef.current?.scrollTo({ top: listRef.current.scrollHeight });
  }, [messages, open]);

  async function send() {
    const text = input.trim();
    if (!text || sending) return;
    setError(null);
    setInput("");
    const nextMessages: Message[] = [...messages, { role: "user", content: text }];
    setMessages([...nextMessages, { role: "assistant", content: "" }]);
    setSending(true);

    try {
      const res = await fetch("/api/assistant/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ messages: nextMessages }),
      });

      // A redirect followed to a 200 (e.g. the session expired and middleware sent this
      // to /login) is still `res.ok` with a body, so content-type is what actually tells
      // a real streamed reply apart from an HTML page landing here instead.
      const isStream = res.headers.get("content-type")?.includes("text/plain");
      if (!res.ok || !res.body || !isStream) {
        const data = res.headers.get("content-type")?.includes("application/json")
          ? await res.json().catch(() => null)
          : null;
        throw new Error(
          data?.error ?? (res.status === 401 || res.redirected ? "Please sign in again." : "The assistant is unavailable right now."),
        );
      }

      const reader = res.body.getReader();
      const decoder = new TextDecoder();
      let full = "";
      for (;;) {
        const { done, value } = await reader.read();
        if (done) break;
        full += decoder.decode(value, { stream: true });
        setMessages([...nextMessages, { role: "assistant", content: full }]);
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : "The assistant is unavailable right now.");
      setMessages(nextMessages); // drop the empty placeholder reply
    } finally {
      setSending(false);
    }
  }

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        aria-label={open ? "Close assistant" : "Open assistant"}
        aria-expanded={open}
        className="fixed bottom-5 right-5 z-40 flex h-12 w-12 items-center justify-center rounded-full bg-akani-navy text-white shadow-lg transition hover:bg-akani-deep-blue"
      >
        {open ? (
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" aria-hidden="true">
            <path d="M6 6l12 12M18 6 6 18" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
          </svg>
        ) : (
          <svg width="22" height="22" viewBox="0 0 24 24" fill="none" aria-hidden="true">
            <path
              d="M4 6h16v10H8l-4 4V6z"
              stroke="currentColor"
              strokeWidth="1.8"
              strokeLinejoin="round"
              strokeLinecap="round"
            />
            <circle cx="9" cy="11" r="1" fill="currentColor" />
            <circle cx="13" cy="11" r="1" fill="currentColor" />
            <circle cx="17" cy="11" r="1" fill="currentColor" />
          </svg>
        )}
      </button>

      {open && (
        <div className="fixed inset-x-3 bottom-20 top-16 z-40 flex flex-col overflow-hidden rounded-xl border border-akani-card-border bg-white shadow-2xl sm:inset-x-auto sm:bottom-20 sm:right-5 sm:top-auto sm:h-[32rem] sm:w-96">
          <div className="flex shrink-0 items-center justify-between border-b border-akani-card-border px-4 py-3">
            <p className="text-sm font-semibold text-akani-text-primary">Akani Assistant</p>
            <p className="text-xs text-akani-text-muted">Guidance only — can&apos;t see your data</p>
          </div>

          <div ref={listRef} className="flex-1 space-y-3 overflow-y-auto px-4 py-3">
            <AssistantBubble text={GREETING} />
            {messages.map((m, i) =>
              m.role === "user" ? (
                <div key={i} className="flex justify-end">
                  <p className="max-w-[85%] rounded-lg rounded-br-sm bg-akani-navy px-3 py-2 text-sm text-white">
                    {m.content}
                  </p>
                </div>
              ) : (
                <AssistantBubble
                  key={i}
                  text={m.content || (sending && i === messages.length - 1 ? "…" : "")}
                />
              ),
            )}
            {error && <div className="rounded-md bg-akani-error-bg px-3 py-2 text-sm text-akani-error">{error}</div>}
          </div>

          <form
            onSubmit={(e) => {
              e.preventDefault();
              send();
            }}
            className="flex shrink-0 items-end gap-2 border-t border-akani-card-border p-3"
          >
            <textarea
              ref={inputRef}
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter" && !e.shiftKey) {
                  e.preventDefault();
                  send();
                }
              }}
              rows={1}
              placeholder="Ask how to do something…"
              className="input max-h-24 min-h-[2.5rem] flex-1 resize-none py-2"
            />
            <button
              type="submit"
              disabled={sending || !input.trim()}
              aria-label="Send"
              className="flex h-10 w-10 shrink-0 items-center justify-center rounded-md bg-akani-navy text-white transition hover:bg-akani-deep-blue disabled:opacity-50"
            >
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" aria-hidden="true">
                <path d="M4 12h16M13 5l7 7-7 7" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
              </svg>
            </button>
          </form>
        </div>
      )}
    </>
  );
}

function AssistantBubble({ text }: { text: string }) {
  return (
    <div className="flex justify-start">
      <p className="max-w-[85%] whitespace-pre-wrap rounded-lg rounded-bl-sm bg-akani-page-bg px-3 py-2 text-sm text-akani-text-primary">
        {text}
      </p>
    </div>
  );
}
