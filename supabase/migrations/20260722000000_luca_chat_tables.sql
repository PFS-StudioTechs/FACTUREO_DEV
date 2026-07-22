-- Luca assistant: conversations + messages (append-only), RLS scoped per user

CREATE TABLE public.luca_conversations (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  titre text NOT NULL DEFAULT '',
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.luca_conversations ENABLE ROW LEVEL SECURITY;

CREATE POLICY "luca_conv_select_own" ON public.luca_conversations FOR SELECT TO authenticated USING (auth.uid() = user_id);
CREATE POLICY "luca_conv_insert_own" ON public.luca_conversations FOR INSERT TO authenticated WITH CHECK (auth.uid() = user_id);
CREATE POLICY "luca_conv_update_own" ON public.luca_conversations FOR UPDATE TO authenticated USING (auth.uid() = user_id);
CREATE POLICY "luca_conv_delete_own" ON public.luca_conversations FOR DELETE TO authenticated USING (auth.uid() = user_id);

CREATE TABLE public.luca_messages (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  conversation_id uuid NOT NULL REFERENCES public.luca_conversations(id) ON DELETE CASCADE,
  user_id uuid NOT NULL,
  role text NOT NULL DEFAULT 'user' CHECK (role IN ('user', 'assistant')),
  content text NOT NULL DEFAULT '',
  created_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.luca_messages ENABLE ROW LEVEL SECURITY;

CREATE POLICY "luca_msg_select_own" ON public.luca_messages FOR SELECT TO authenticated USING (auth.uid() = user_id);
CREATE POLICY "luca_msg_insert_own" ON public.luca_messages FOR INSERT TO authenticated WITH CHECK (auth.uid() = user_id);

CREATE TRIGGER update_luca_conversations_updated_at
  BEFORE UPDATE ON public.luca_conversations
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
