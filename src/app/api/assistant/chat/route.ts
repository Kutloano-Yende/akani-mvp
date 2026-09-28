import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { rateLimit } from "@/lib/rate-limit";
import { buildSystemPrompt } from "@/lib/assistant/system-prompt";

// Google AI Studio / Gemini API — has a genuine free tier (unlike Anthropic
// or OpenAI, which are pay-per-use only), which is why this app uses it.
// gemini-2.5-flash was retired for new accounts (confirmed against the live
// API, which pointed here); if Google moves the model again, swap it here.
const MODEL = "gemini-3.8-flash";
const MAX_MESSAGES = 20;
const MAX_MESSAGE_CHARS = 2000;

type ChatMessage = { role: "user" | "assistant"; content: string };

function isChatMessage(m: unknown): m is ChatMessage {
  return (
    !!m &&
    typeof m === "object" &&
    ((m as ChatMessage).role === "user" || (m as ChatMessage).role === "assistant") &&
    typeof (m as ChatMessage).content === "string"
  );
}

/**
 * Streams a reply from the in-app guide assistant. The assistant has no
 * database access (see system-prompt.ts) — this route's only job is to
 * authenticate the caller, rate-limit them, and relay text out of Gemini's
 * SSE stream as plain text chunks.
 */
export async function POST(request: Request) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) {
    return NextResponse.json(
      { error: "The assistant isn't configured yet. Add GEMINI_API_KEY on the server." },
      { status: 501 },
    );
  }

  const limit = rateLimit(`assistant:${user.id}`, 20, 60_000);
  if (!limit.allowed) {
    return NextResponse.json(
      { error: "Too many messages — please wait a moment." },
      { status: 429, headers: { "Retry-After": String(Math.ceil(limit.retryAfterMs / 1000)) } },
    );
  }

  const body = await request.json().catch(() => null);
  const rawMessages = Array.isArray(body?.messages) ? body.messages : null;
  if (!rawMessages || rawMessages.length === 0) {
    return NextResponse.json({ error: "messages is required" }, { status: 400 });
  }

  const messages: ChatMessage[] = (rawMessages as unknown[])
    .slice(-MAX_MESSAGES)
    .filter(isChatMessage)
    .map((m: ChatMessage) => ({ role: m.role, content: m.content.slice(0, MAX_MESSAGE_CHARS) }));

  if (messages.length === 0 || messages[messages.length - 1].role !== "user") {
    return NextResponse.json({ error: "The last message must be from the user" }, { status: 400 });
  }

  const { data: profile } = await supabase.from("profiles").select("name, role").eq("id", user.id).single();

  // Gemini uses "user"/"model" (not "assistant") as roles.
  const contents = messages.map((m) => ({
    role: m.role === "assistant" ? "model" : "user",
    parts: [{ text: m.content }],
  }));

  const upstream = await fetch(
    `https://generativelanguage.googleapis.com/v1beta/models/${MODEL}:streamGenerateContent?alt=sse`,
    {
      method: "POST",
      headers: { "x-goog-api-key": apiKey, "content-type": "application/json" },
      body: JSON.stringify({
        contents,
        systemInstruction: { parts: [{ text: buildSystemPrompt(profile?.name ?? "there", profile?.role ?? "sales") }] },
        generationConfig: { maxOutputTokens: 512 },
      }),
      signal: AbortSignal.timeout(30_000),
    },
  );

  if (!upstream.ok || !upstream.body) {
    const detail = await upstream.text().catch(() => "");
    console.error("Assistant upstream error", upstream.status, detail);
    return NextResponse.json({ error: "The assistant is unavailable right now." }, { status: 502 });
  }

  // Gemini sends Server-Sent Events; unwrap them to plain text deltas so the
  // client can just read the stream as text, no SSE parsing needed.
  const decoder = new TextDecoder();
  const encoder = new TextEncoder();
  const reader = upstream.body.getReader();
  let buffer = "";

  const stream = new ReadableStream<Uint8Array>({
    async pull(controller) {
      const { done, value } = await reader.read();
      if (done) {
        controller.close();
        return;
      }
      buffer += decoder.decode(value, { stream: true });
      const lines = buffer.split("\n");
      buffer = lines.pop() ?? "";

      for (const line of lines) {
        if (!line.startsWith("data: ")) continue;
        try {
          const event = JSON.parse(line.slice(6));
          const text = event?.candidates?.[0]?.content?.parts?.[0]?.text;
          if (typeof text === "string") controller.enqueue(encoder.encode(text));
        } catch {
          // A partial/malformed SSE line — skip it rather than break the stream.
        }
      }
    },
    cancel() {
      reader.cancel().catch(() => {});
    },
  });

  return new Response(stream, {
    headers: { "Content-Type": "text/plain; charset=utf-8", "Cache-Control": "no-store" },
  });
}
