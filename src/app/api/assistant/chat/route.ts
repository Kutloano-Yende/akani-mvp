import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { rateLimit } from "@/lib/rate-limit";
import { buildSystemPrompt } from "@/lib/assistant/system-prompt";
import { runAssistantTurn } from "@/lib/assistant/tool-loop";
import type { GeminiContent } from "@/lib/assistant/gemini";

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
 * Streams a reply from the in-app guide assistant. For plain guidance
 * questions this is a single streaming call, same as before. For questions
 * that need real data, the model can call a small set of tools (see
 * src/lib/assistant/tools.ts) -- each one queries through this request's
 * own Supabase session client, so RLS does all the tenant/role scoping; no
 * manual filtering happens here.
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

  const [{ data: profile }, { data: isPlatformAdmin }] = await Promise.all([
    supabase.from("profiles").select("name, role").eq("id", user.id).single(),
    supabase.rpc("is_platform_admin"),
  ]);

  const role = profile?.role ?? "sales";
  const platformAdmin = isPlatformAdmin === true;

  // Gemini uses "user"/"model" (not "assistant") as roles.
  const contents: GeminiContent[] = messages.map((m) => ({
    role: m.role === "assistant" ? "model" : "user",
    parts: [{ text: m.content }],
  }));

  let stream: ReadableStream<Uint8Array>;
  try {
    stream = await runAssistantTurn({
      apiKey,
      systemInstruction: buildSystemPrompt(profile?.name ?? "there", role, platformAdmin),
      history: contents,
      isPlatformAdmin: platformAdmin,
      supabase,
      ctx: { role, isPlatformAdmin: platformAdmin },
    });
  } catch (err) {
    console.error("Assistant upstream error", err);
    return NextResponse.json({ error: "The assistant is unavailable right now." }, { status: 502 });
  }

  return new Response(stream, {
    headers: { "Content-Type": "text/plain; charset=utf-8", "Cache-Control": "no-store" },
  });
}
