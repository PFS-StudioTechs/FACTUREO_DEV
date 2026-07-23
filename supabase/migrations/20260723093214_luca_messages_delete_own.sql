-- Permet à l'utilisateur de supprimer ses propres messages Luca (historique
-- devient trop long avec le temps) — table passait de append-only à editable.
CREATE POLICY "luca_msg_delete_own" ON public.luca_messages FOR DELETE TO authenticated USING (auth.uid() = user_id);
