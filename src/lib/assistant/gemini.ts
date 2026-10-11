// Google AI Studio / Gemini API -- see route.ts for why this model was chosen.
export const MODEL = "gemini-3.8-flash";

export type GeminiPart =
  | { text: string }
  | { functionCall: { name: string; args: Record<string, unknown> } }
  | { functionResponse: { name: string; response: unknown } };

export type GeminiContent = { role: "user" | "model"; parts: GeminiPart[] };

export type GeminiEvent = { text?: string; functionCall?: { name: string; args: Record<string, unknown> } };

type FunctionDeclaration = {
  name: string;
  description: string;
  parameters: { type: string; properties: Record<string, unknown> };
};

/**
 * Opens a streaming Gemini call and yields parsed SSE events as they
 * arrive. A functionCall arrives whole in a single event (it's structured
 * JSON, never token-streamed); text arrives incrementally across many
 * events -- callers use this to tell the two paths apart as early as
 * possible without a separate blocking "decision" call.
 */
export async function* streamGemini(
  apiKey: string,
  contents: GeminiContent[],
  systemInstruction: string,
  functionDeclarations: readonly FunctionDeclaration[],
): AsyncGenerator<GeminiEvent> {
  const upstream = await fetch(
    `https://generativelanguage.googleapis.com/v1beta/models/${MODEL}:streamGenerateContent?alt=sse`,
    {
      method: "POST",
      headers: { "x-goog-api-key": apiKey, "content-type": "application/json" },
      body: JSON.stringify({
        contents,
        systemInstruction: { parts: [{ text: systemInstruction }] },
        tools: functionDeclarations.length > 0 ? [{ functionDeclarations }] : undefined,
        generationConfig: { maxOutputTokens: 512 },
      }),
      signal: AbortSignal.timeout(30_000),
    },
  );

  if (!upstream.ok || !upstream.body) {
    const detail = await upstream.text().catch(() => "");
    throw new Error(`Gemini upstream error ${upstream.status}: ${detail}`);
  }

  const decoder = new TextDecoder();
  const reader = upstream.body.getReader();
  let buffer = "";

  for (;;) {
    const { done, value } = await reader.read();
    if (done) return;
    buffer += decoder.decode(value, { stream: true });
    const lines = buffer.split("\n");
    buffer = lines.pop() ?? "";

    for (const line of lines) {
      if (!line.startsWith("data: ")) continue;
      try {
        const event = JSON.parse(line.slice(6));
        const parts = event?.candidates?.[0]?.content?.parts;
        if (!Array.isArray(parts)) continue;
        for (const part of parts) {
          if (typeof part.text === "string") yield { text: part.text };
          if (part.functionCall) yield { functionCall: part.functionCall };
        }
      } catch {
        // A partial/malformed SSE line -- skip it rather than break the stream.
      }
    }
  }
}
