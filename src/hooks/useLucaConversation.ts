import { useEffect, useState } from "react";
import { useAuth } from "@/contexts/AuthContext";
import { supabase } from "@/integrations/supabase/client";
import { streamLucaChat } from "./useLucaChat";

export interface LucaChatMessage {
  id: string;
  role: "user" | "assistant";
  content: string;
}

export function useLucaConversation() {
  const { user } = useAuth();
  const [conversationId, setConversationId] = useState<string | null>(null);
  const [messages, setMessages] = useState<LucaChatMessage[]>([]);
  const [loading, setLoading] = useState(false);
  const [sending, setSending] = useState(false);

  useEffect(() => {
    if (!user) return;
    let cancelled = false;
    (async () => {
      setLoading(true);
      const { data: conv } = await supabase
        .from("luca_conversations")
        .select("id")
        .eq("user_id", user.id)
        .order("updated_at", { ascending: false })
        .limit(1)
        .maybeSingle();
      if (cancelled) return;
      if (conv) {
        setConversationId(conv.id);
        const { data: msgs } = await supabase
          .from("luca_messages")
          .select("id, role, content")
          .eq("conversation_id", conv.id)
          .order("created_at", { ascending: true });
        if (!cancelled) setMessages((msgs ?? []) as LucaChatMessage[]);
      }
      if (!cancelled) setLoading(false);
    })();
    return () => { cancelled = true; };
  }, [user]);

  const ensureConversation = async (): Promise<string> => {
    if (conversationId) return conversationId;
    const { data, error } = await supabase
      .from("luca_conversations")
      .insert({ user_id: user!.id, titre: "" })
      .select("id").single();
    if (error) throw error;
    setConversationId(data.id);
    return data.id;
  };

  const sendMessage = async (text: string, route?: string) => {
    if (!text.trim() || sending || !user) return;
    setSending(true);
    try {
      const convId = await ensureConversation();
      setMessages(prev => [...prev, { id: crypto.randomUUID(), role: "user", content: text }]);
      const assistantId = crypto.randomUUID();
      setMessages(prev => [...prev, { id: assistantId, role: "assistant", content: "" }]);

      await streamLucaChat({
        conversationId: convId,
        message: text,
        route,
        onChunk: (accumulated) => {
          setMessages(prev => prev.map(m => m.id === assistantId ? { ...m, content: accumulated } : m));
        },
      });
    } finally {
      setSending(false);
    }
  };

  return { messages, sendMessage, loading, sending };
}
