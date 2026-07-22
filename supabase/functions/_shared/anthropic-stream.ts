// Transforms Anthropic's SSE stream into a minimal OpenAI-like SSE stream
// (`data: {"choices":[{"delta":{"content":"..."}}]}\n\n`) so the frontend
// only needs one simple parser regardless of which LLM provider is behind it.
// `onDone` receives the full accumulated text once the stream ends, so the
// caller can persist the assistant message without buffering the response itself.
export function anthropicToOpenAiSse(
  anthropicStream: ReadableStream<Uint8Array>,
  onDone?: (fullText: string) => void,
): ReadableStream<Uint8Array> {
  const encoder = new TextEncoder();
  const decoder = new TextDecoder();
  let buffer = "";
  let fullText = "";

  return new ReadableStream({
    async start(controller) {
      const reader = anthropicStream.getReader();
      try {
        while (true) {
          const { done, value } = await reader.read();
          if (done) break;
          buffer += decoder.decode(value, { stream: true });

          let idx: number;
          while ((idx = buffer.indexOf("\n")) !== -1) {
            const line = buffer.slice(0, idx).trimEnd();
            buffer = buffer.slice(idx + 1);
            if (!line.startsWith("data: ")) continue;

            const json = line.slice(6).trim();
            if (json === "[DONE]" || json === "") continue;

            try {
              const parsed = JSON.parse(json);
              if (parsed.type === "content_block_delta" && parsed.delta?.type === "text_delta" && parsed.delta?.text) {
                fullText += parsed.delta.text;
                const chunk = JSON.stringify({ choices: [{ delta: { content: parsed.delta.text } }] });
                controller.enqueue(encoder.encode(`data: ${chunk}\n\n`));
              } else if (parsed.type === "message_stop") {
                controller.enqueue(encoder.encode("data: [DONE]\n\n"));
              }
            } catch {
              // incomplete/non-JSON line, ignore
            }
          }
        }
      } finally {
        reader.releaseLock();
        controller.close();
        onDone?.(fullText);
      }
    },
  });
}
