import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

const CHAT_URL = `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/call-luca`;

interface StreamLucaChatOptions {
  conversationId: string;
  message: string;
  route?: string;
  onChunk: (accumulated: string) => void;
  onDone?: (finalText: string) => void;
}

export async function streamLucaChat({
  conversationId, message, route, onChunk, onDone,
}: StreamLucaChatOptions): Promise<string | null> {
  const { data: { session } } = await supabase.auth.getSession();
  if (!session?.access_token) {
    toast.error("Session expirée, reconnecte-toi.");
    return null;
  }

  const resp = await fetch(CHAT_URL, {
    method: "POST",
    headers: { "Content-Type": "application/json", Authorization: `Bearer ${session.access_token}` },
    body: JSON.stringify({ conversationId, message, route }),
  });

  if (resp.status === 429) { toast.error("Limite atteinte, réessaie dans un instant."); return null; }
  if (resp.status === 401) { toast.error("Session invalide, reconnecte-toi."); return null; }
  if (!resp.ok || !resp.body) {
    const body = await resp.json().catch(() => ({ error: "Erreur de connexion" }));
    toast.error(body.error || "Erreur de connexion à Luca");
    return null;
  }

  const reader = resp.body.getReader();
  const decoder = new TextDecoder();
  let textBuffer = "";
  let accumulated = "";
  let streamDone = false;

  while (!streamDone) {
    const { done, value } = await reader.read();
    if (done) break;
    textBuffer += decoder.decode(value, { stream: true });

    let idx: number;
    while ((idx = textBuffer.indexOf("\n")) !== -1) {
      let line = textBuffer.slice(0, idx);
      textBuffer = textBuffer.slice(idx + 1);
      if (line.endsWith("\r")) line = line.slice(0, -1);
      if (line.startsWith(":") || line.trim() === "" || !line.startsWith("data: ")) continue;

      const json = line.slice(6).trim();
      if (json === "[DONE]") { streamDone = true; break; }

      try {
        const parsed = JSON.parse(json);
        const content = parsed.choices?.[0]?.delta?.content;
        if (content) { accumulated += content; onChunk(accumulated); }
      } catch {
        textBuffer = line + "\n" + textBuffer;
        break;
      }
    }
  }

  onDone?.(accumulated);
  return accumulated;
}
