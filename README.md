# Facturéo – Pilotage IA des factures & notes de frais

## Prérequis
- Node 20+ ou Bun (dev Lovable).  
- Supabase CLI pour lancer les fonctions Edge en local.  
- Comptes API : Supabase, Make (webhook) et OpenAI.

## Installation rapide
```bash
pnpm install    # ou npm install / bun install
pnpm dev        # lance Vite + Supabase Studio
```

## Variables d’environnement
Créer un fichier `.env` (ou dupliquer celui partagé) avec au minimum :
```
VITE_SUPABASE_URL=
VITE_SUPABASE_PUBLISHABLE_KEY=
OPENAI_API_KEY=sk-...
OPENAI_API_BASE_URL=https://api.openai.com/v1   # optionnel (laisser vide si API officielle)
OPENAI_VISION_MODEL=gpt-4o-mini                # optionnel, valeur par défaut côté code
```
> Pour Supabase Edge Functions en prod : `supabase secrets set OPENAI_API_KEY="sk-..." OPENAI_API_BASE_URL="https://api.openai.com/v1" OPENAI_VISION_MODEL="gpt-4o-mini"`.

## OCR / Vision (gpt-4o-mini)
- `supabase/functions/process-expense-scan` : extrait date + description d’une note de frais (photo).  
- `supabase/functions/parse-invoice` : lit facture PDF/image, renvoie un JSON structuré (client, montants, TVA, etc.).  
- Les deux fonctions exploitent OpenAI `gpt-4o-mini` via tool calling pour renvoyer un objet fiable tout en permettant un fallback manuel si l’appel API échoue.

## Flux de travail
1. **Saisie vocale** → `extract-voice-invoice` (déclenchement via UI).  
2. **Import facture** → `parse-invoice` → enregistrement Supabase + génération PDF.  
3. **Scan note de frais** → `process-expense-scan` → stockage Supabase Storage → envoi Make via bouton “Envoyer”.

Mettre à jour ce fichier si vous ajoutez de nouveaux services (auth, webhooks, etc.).
