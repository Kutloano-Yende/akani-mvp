import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/types/database";
import { streamGemini, type GeminiContent, type GeminiEvent } from "./gemini";
import { declarationsFor, getHandler, type ToolContext } from "./tools";

const MAX_ITERATIONS = 3;

type CollectResult =
  | { kind: "text"; first: string }
  | { kind: "functionCall"; name: string; args: Record<string, unknown> }
  | { kind: "empty" };

async function collectFirst(gen: AsyncGenerator<GeminiEvent>): Promise<CollectResult> {
  const { value, done } = await gen.next();
  if (done || !value) return { kind: "empty" };
  if (value.functionCall) return { kind: "functionCall", name: value.functionCall.name, args: value.functionCall.args };
  if (typeof value.text === "string") return { kind: "text", first: value.text };
  return collectFirst(gen);
}

/**
 * Streams the already-open generator's remaining text as it arrives,
 * having already consumed its first event (passed in as `first`). This is
 * what keeps a plain guidance question exactly as fast as before this
 * change -- no blocking "decide if a tool is needed" call up front, we just
 * read the stream and act on what the first event turns out to be.
 */
function textStream(gen: AsyncGenerator<GeminiEvent>, first: string): ReadableStream<Uint8Array> {
  const encoder = new TextEncoder();
  let sentFirst = false;
  return new ReadableStream<Uint8Array>({
    async pull(controller) {
      if (!sentFirst) {
        sentFirst = true;
        controller.enqueue(encoder.encode(first));
        return;
      }
      const { value, done } = await gen.next();
      if (done) {
        controller.close();
        return;
      }
      // A functionCall mid-stream after text already started is an
      // uncommon edge case (see tool-loop design notes) -- the text
      // already shown stays, and we simply don't act on a second tool
      // request within the same turn rather than adding complexity to
      // handle it.
      if (typeof value.text === "string") controller.enqueue(encoder.encode(value.text));
    },
    cancel() {
      gen.return?.(undefined);
    },
  });
}

function fallbackStream(text: string): ReadableStream<Uint8Array> {
  const encoder = new TextEncoder();
  return new ReadableStream<Uint8Array>({
    start(controller) {
      controller.enqueue(encoder.encode(text));
      controller.close();
    },
  });
}

export async function runAssistantTurn(opts: {
  apiKey: string;
  systemInstruction: string;
  history: GeminiContent[];
  isPlatformAdmin: boolean;
  supabase: SupabaseClient<Database>;
  ctx: ToolContext;
}): Promise<ReadableStream<Uint8Array>> {
  const declarations = declarationsFor(opts.isPlatformAdmin);
  let contents = opts.history;

  for (let i = 0; i < MAX_ITERATIONS; i++) {
    const gen = streamGemini(opts.apiKey, contents, opts.systemInstruction, declarations);
    const first = await collectFirst(gen);

    if (first.kind === "text") return textStream(gen, first.first);
    if (first.kind === "empty") break;

    const handler = getHandler(first.name);
    let response: unknown;
    if (!handler) {
      response = { error: `Unknown tool "${first.name}".` };
    } else {
      try {
        response = await handler(opts.supabase, opts.ctx, first.args ?? {});
      } catch (e) {
        response = { error: e instanceof Error ? e.message : "Tool failed." };
      }
    }

    contents = [
      ...contents,
      { role: "model", parts: [{ functionCall: { name: first.name, args: first.args ?? {} } }] },
      // Gemini rejects a separate "function" role (confirmed against the
      // live API: "Role 'function' is not supported") -- the result goes
      // back as a "user" turn carrying a functionResponse part instead.
      { role: "user", parts: [{ functionResponse: { name: first.name, response } }] },
    ];
  }

  return fallbackStream("I wasn't able to pull that up — try asking about it from the relevant page.");
}
