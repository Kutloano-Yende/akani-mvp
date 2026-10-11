import { describe, expect, it, vi, afterEach } from "vitest";
import { runAssistantTurn } from "./tool-loop";

vi.mock("./tool-handlers", async (importOriginal) => {
  const actual = await importOriginal<typeof import("./tool-handlers")>();
  return { ...actual, TOOL_HANDLERS: { count_leads: vi.fn(), failing_tool: vi.fn() } };
});

function sseResponse(events: unknown[]): Response {
  const body = events.map((e) => `data: ${JSON.stringify(e)}\n\n`).join("");
  return {
    ok: true,
    body: new ReadableStream<Uint8Array>({
      start(controller) {
        controller.enqueue(new TextEncoder().encode(body));
        controller.close();
      },
    }),
  } as Response;
}

function textEvent(text: string) {
  return { candidates: [{ content: { parts: [{ text }] } }] };
}
function functionCallEvent(name: string, args: Record<string, unknown> = {}) {
  return { candidates: [{ content: { parts: [{ functionCall: { name, args } }] } }] };
}

async function readAll(stream: ReadableStream<Uint8Array>): Promise<string> {
  const reader = stream.getReader();
  const decoder = new TextDecoder();
  let out = "";
  for (;;) {
    const { done, value } = await reader.read();
    if (done) break;
    out += decoder.decode(value);
  }
  return out;
}

const baseOpts = {
  apiKey: "test-key",
  systemInstruction: "be helpful",
  isPlatformAdmin: false,
  supabase: {} as never,
  ctx: { role: "admin" as const, isPlatformAdmin: false },
};

describe("runAssistantTurn", () => {
  afterEach(() => vi.unstubAllGlobals());

  it("streams plain text immediately with a single fetch call (no tool needed)", async () => {
    const fetchMock = vi.fn(async () => sseResponse([textEvent("Go to "), textEvent("Settings.")]));
    vi.stubGlobal("fetch", fetchMock);

    const stream = await runAssistantTurn({ ...baseOpts, history: [{ role: "user", parts: [{ text: "where are settings" }] }] });
    const text = await readAll(stream);

    expect(text).toBe("Go to Settings.");
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });

  it("calls the tool, then streams the follow-up answer (two fetch calls)", async () => {
    const { TOOL_HANDLERS } = await import("./tool-handlers");
    (TOOL_HANDLERS.count_leads as ReturnType<typeof vi.fn>).mockResolvedValue({ count: 5, window: "this_week" });

    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce(sseResponse([functionCallEvent("count_leads", { window: "this_week" })]))
      .mockResolvedValueOnce(sseResponse([textEvent("You have 5 leads this week.")]));
    vi.stubGlobal("fetch", fetchMock);

    const stream = await runAssistantTurn({ ...baseOpts, history: [{ role: "user", parts: [{ text: "how many leads this week" }] }] });
    const text = await readAll(stream);

    expect(text).toBe("You have 5 leads this week.");
    expect(fetchMock).toHaveBeenCalledTimes(2);
    expect(TOOL_HANDLERS.count_leads).toHaveBeenCalledWith({}, { role: "admin", isPlatformAdmin: false }, { window: "this_week" });
  });

  it("feeds a tool error back to the model instead of throwing", async () => {
    const { TOOL_HANDLERS } = await import("./tool-handlers");
    (TOOL_HANDLERS.failing_tool as ReturnType<typeof vi.fn>).mockRejectedValue(new Error("db down"));

    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce(sseResponse([functionCallEvent("failing_tool")]))
      .mockResolvedValueOnce(sseResponse([textEvent("I couldn't fetch that right now.")]));
    vi.stubGlobal("fetch", fetchMock);

    const stream = await runAssistantTurn({ ...baseOpts, history: [{ role: "user", parts: [{ text: "trigger failure" }] }] });
    const text = await readAll(stream);

    expect(text).toBe("I couldn't fetch that right now.");
    expect(fetchMock).toHaveBeenCalledTimes(2);
  });

  it("stops at the iteration cap and returns a safe fallback instead of looping forever", async () => {
    const { TOOL_HANDLERS } = await import("./tool-handlers");
    (TOOL_HANDLERS.count_leads as ReturnType<typeof vi.fn>).mockResolvedValue({ count: 1, window: "all" });

    const fetchMock = vi.fn(async () => sseResponse([functionCallEvent("count_leads")]));
    vi.stubGlobal("fetch", fetchMock);

    const stream = await runAssistantTurn({ ...baseOpts, history: [{ role: "user", parts: [{ text: "loop forever" }] }] });
    const text = await readAll(stream);

    expect(text).toContain("wasn't able to pull that up");
    expect(fetchMock).toHaveBeenCalledTimes(3);
  });
});
