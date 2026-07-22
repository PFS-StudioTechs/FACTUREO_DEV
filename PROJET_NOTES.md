# Facturéo — Notes de projet

> Fichier de référence pour les sessions Claude Code. Mis à jour au fil des conversations.

---

## Vue d'ensemble

**Facturéo** est une plateforme de facturation et gestion de notes de frais alimentée par l'IA, destinée aux freelances et TPE françaises.

Fonctionnalités principales :
- Gestion de factures multi-entreprises / multi-clients
- Parsing intelligent de documents (IA vision) pour extraction automatique de données
- Génération de PDF conformes **Factur-X** (norme EN 16931)
- Scan et suivi de notes de frais avec OCR
- Création de facture par **dictée vocale**
- Rapports hebdomadaires automatiques par email
- Gestion multi-utilisateurs avec RBAC (admin / user)

---

## Architecture générale

```
factureo-dev-main/
├── src/                        # Frontend React/TypeScript
│   ├── pages/                  # Auth, Companies, Clients, Invoices, ExpenseScans, Previsionnel, UserManagement, InvoiceSettings
│   ├── components/             # Composants UI réutilisables (shadcn/ui)
│   ├── integrations/           # Couche Supabase
│   ├── contexts/               # AuthContext
│   ├── hooks/                  # Hooks personnalisés
│   └── lib/                    # Utilitaires
├── services/
│   ├── facturx-service/        # Microservice Python FastAPI — génération PDF Factur-X
│   └── n8n/                    # Workflows d'automatisation (3 workflows)
├── supabase/
│   ├── functions/              # Edge Functions Deno (TypeScript)
│   ├── migrations/             # Schéma BDD (SQL)
│   └── config.toml             # Project ID : dtkgzfomtjxnfzrbapbu
└── public/                     # Assets statiques
```

---

## Stack technique

| Couche | Technologie |
|---|---|
| Frontend | React 18, TypeScript, Vite 5, React Router 6, TanStack Query 5 |
| UI | shadcn/ui, Radix UI, Tailwind CSS, Lucide React |
| Formulaires | React Hook Form + Zod |
| Charts | Recharts |
| PDF client | jsPDF, jsPDF-autotable |
| Backend BDD / Auth | Supabase (PostgreSQL + RLS + Auth JWT + Storage + Realtime) |
| Edge Functions | Deno runtime (TypeScript) |
| Microservice PDF | FastAPI 0.115, Python 3.12, ReportLab, factur-x 2.0.0 |
| Workflows | n8n (self-hosted sur VPS Hostinger) |
| IA parsing docs | OpenAI GPT-4o-mini (vision + tool calling) |
| IA parsing factures | Anthropic Claude Haiku |
| Email | Resend API |
| PDF HTML→PDF | Gotenberg (Docker) |
| Infra | Docker, Nginx, VPS Hostinger |

---

## Services détaillés

### 1. Frontend React (`src/`)
- Routes protégées, RBAC admin/user
- React Query pour le fetching/cache
- Supabase client pour auth, BDD et storage

### 2. Supabase Edge Functions (`supabase/functions/`)

| Fonction | Rôle | IA utilisée |
|---|---|---|
| `parse-invoice` | Extraction données depuis PDF/image | Claude Haiku |
| `process-expense-scan` | Analyse reçus de notes de frais | GPT-4o-mini |
| `extract-voice-invoice` | Dictée vocale → données facture | GPT-4o-mini |
| `parse-company` | Extraction infos entreprise | GPT-4o-mini vision |
| `parse-contract` | Parsing contrats | — |
| `generate-invoice-email` | Génération email facture | — |
| `send-expense-email` | Envoi email notes de frais | — |
| `notify-admin-new-signup` | Notif admin à l'inscription | — |
| `notify-user-access` | Notif utilisateur accès accordé | — |

### 3. Factur-X Microservice (`services/facturx-service/`)
- FastAPI sur port 8000 (8001 proxied)
- Authentification par header `X-Api-Key`
- Génère des PDF/A-3 avec XML Factur-X embarqué (norme BASIC EN 16931)
- Déployé en Docker sur VPS

### 4. Workflows n8n (`services/n8n/`)

| Workflow | Déclencheur | Rôle |
|---|---|---|
| `workflow_invoice_facturx.json` | Webhook depuis app | Génère PDF Factur-X et stocke dans Supabase Storage |
| `workflow_expense_processing.json` | Webhook après upload | Traite image reçu, génère PDF via Gotenberg |
| `workflow_expense_weekly.json` | Cron vendredi 17h UTC | Rapport hebdomadaire notes de frais par email |

---

## Base de données (schéma principal)

| Table | Rôle |
|---|---|
| `profiles` | Métadonnées utilisateur (pseudo) |
| `companies` | Multi-entreprises par utilisateur |
| `clients` | Clients avec TJM par défaut et conditions de paiement |
| `invoices` | Factures avec données financières complètes |
| `invoice_settings` | Format numérotation par entreprise |
| `expense_scans` | Notes de frais scannées |

RLS (Row Level Security) activé sur toutes les tables — isolation stricte par utilisateur.

---

## Variables d'environnement clés

**Frontend (`.env`):**
- `VITE_SUPABASE_URL`
- `VITE_SUPABASE_PUBLISHABLE_KEY`
- `OPENAI_API_KEY`
- `OPENAI_API_BASE_URL`
- `OPENAI_VISION_MODEL` (défaut : gpt-4o-mini)

**Factur-X service:**
- `FACTURX_API_KEY`

**n8n (configuré dans l'interface n8n) :**
- `SUPABASE_URL`, `SUPABASE_SERVICE_KEY`
- `FACTURX_SERVICE_URL`, `FACTURX_API_KEY`
- `ANTHROPIC_API_KEY`
- `GOTENBERG_URL`
- `RESEND_API_KEY`
- `FROM_EMAIL`, `ACCOUNTANT_EMAIL`

---

## Flux de données principal

```
1. Utilisateur upload document
2. Edge Function extrait les données via IA vision
3. Données stockées en BDD Supabase (avec RLS)
4. Utilisateur valide la facture → webhook vers n8n
5. n8n orchestre la génération PDF Factur-X
6. PDF stocké dans Supabase Storage
7. Cron vendredi → email récapitulatif notes de frais
```

---

## Sécurité

- Auth JWT via Supabase Auth
- RLS sur toutes les tables (isolation par utilisateur)
- API Key pour le microservice Factur-X
- Service Role Key côté n8n (bypass RLS serveur uniquement)
- Toutes les clés sensibles en variables d'environnement

---

## Audit du 2026-04-30

### Critiques (à corriger immédiatement)

| # | Fichier | Problème |
|---|---|---|
| C1 | `supabase/functions/*/index.ts` | CORS `Access-Control-Allow-Origin: "*"` sur toutes les Edge Functions — n'importe quel domaine peut les appeler |
| C2 | `src/pages/Invoices.tsx:275` | Webhook n8n appelé sans vérification d'ownership — IDOR possible sur la génération PDF |
| C3 | `services/facturx-service/main.py:25` | `API_KEY=""` par défaut → si `.env` absent, endpoint complètement ouvert |
| C4 | `supabase/migrations/20260429120000_*.sql:21` | Policy service role sur `expense_scans` avec `USING (true)` — n8n peut modifier les scans de tous les utilisateurs |

### Hauts (à traiter sous 2 semaines)

| # | Fichier | Problème |
|---|---|---|
| H1 | `services/facturx-service/main.py:128` | Injection XML : `d.designation` et `d.descriptif_mission` insérés sans escaping dans le XML Factur-X |
| H2 | `supabase/functions/` | Aucun rate limiting sur les appels OpenAI/Anthropic — risque de dépassement de quota |
| H3 | `services/n8n/workflow_expense_processing.json:31` | Service key Supabase visible dans la définition du workflow |

### Moyens (roadmap)

- Indexes manquants sur `company_id`, `client_id`, `user_id` dans `invoices`, `expense_scans`, `clients`
- `invoice_settings.code` référencé mais non défini → bug génération numéro de facture (`Invoices.tsx:133`)
- Webhook n8n fire-and-forget sans retour d'erreur utilisateur (`Invoices.tsx:275`)
- `notify-admin-new-signup` : ne fait que `console.log`, n'envoie jamais d'email
- `extract-voice-invoice` : liste clients passée au prompt sans limite de taille
- TVA hardcodée à 20% (`Invoices.tsx:248`) — pas de support 5.5% / 10%
- Pas de pagination sur `UserManagement.tsx` (select `*` sans LIMIT)
- `generate-invoice-email` dépend de `ai.gateway.lovable.dev` (infrastructure tiers)

### Low

- `index.html` : `<title>` et `og:title` non renseignés
- Base64 manuel dans `parse-invoice/index.ts` (fonctionnel mais non-standard)
- Pas de fichier `.env.example` documentant les variables requises

---

## Infrastructure

- Supabase project ID : `dphabbucdbxzmtnewfns`
- n8n : `https://n8n.srv1631367.hstgr.cloud` (nouveau serveur session 4)
- n8n API key REST : dans mcp.json (aud: public-api)
- n8n MCP : configuré dans `~/.claude/mcp.json`
- Email : **SendGrid** (pas Resend) — clé `SG.-mYTQ8_7...`
- Frontend déployé sur Vercel : `https://factureo-dev.vercel.app`

## Workflows n8n (actifs)

| ID | Nom | Statut |
|---|---|---|
| `Iy2o7dCTfUUCDt8L` | Génération Factur-X | ✅ actif |
| `oa6nZvdk1U641DvF` | Traitement Notes de Frais | ✅ actif |
| `1XpX8bxMDLCRmZJO` | Envoi Hebdo Notes de Frais | ✅ actif |

Env vars hardcodées dans les workflows (plan Community n8n = pas de Variables).

---

## Notes de sessions

| Date | Note |
|---|---|
| 2026-04-30 | Création de ce fichier — résumé initial du projet |
| 2026-04-30 | Audit complet réalisé — voir section Audit ci-dessus |
| 2026-04-30 | Session 2 : fixes sécurité C1/C2/C3/H1 + création 3 workflows n8n via API |
| 2026-04-30 | Session 3 : découverte infra VPS — n8n en Docker sans compose. Prochain : créer docker-compose.yml n8n avec env vars |
| 2026-05-04 | Session 4 : nouveau serveur n8n (srv1631367). 3 workflows recréés + activés. SendGrid remplace Resend. 9 Edge Functions déployées. |
| 2026-07-22 | Audit DELTA (`AUDIT_2026-07-22.md`) : n8n confirmé hors circuit (Factur-X passe désormais en direct via `generate-facturx`), TVA multi-taux résolue, mais découverte d'un IDOR systémique sur 4 Edge Functions neuves (`generate-facturx`, `create-payment-link`, `stripe-connect-start`, `stripe-connect-status`) — service-role sans vérif d'appartenance. Branche `fix/security-idor` : ajout de `supabase/functions/_shared/ownership.ts` (résolution appelant via JWT + vérif `user_id`), les 4 fonctions refactorisées en `handle(req, corsHeaders, deps)` injectable, 2 tests Vitest par fonction (non-propriétaire → 403, propriétaire → 200). `config.toml` corrigé (`dphabbucdbxzmtnewfns`, committé). Fusionnée dans `main`. |
| 2026-07-22 | Branche `chore/cleanup-n8n-ocr` : n8n confirmé mort (0 référence appelante hors code déjà inatteignable) — suppression de `N8N_EXPENSE_WEBHOOK`/`src/lib/config.ts`. Régression trouvée et corrigée : un scan de note de frais restait bloqué en statut "traitement" (plus rien ne le faisait passer à "à revoir" depuis le retrait de n8n). Fix : `src/pages/ExpenseScans.tsx` appelle désormais directement `process-expense-scan` après upload et écrit le résultat (`src/lib/expenseOcr.ts`, testé). Fusionnée dans `main`. |
| 2026-07-22 | Branche `feat/profil-fiscal` : socle "obligations administratives" évolutif micro → société. Migration `companies` : `forme_juridique_categorie` (micro/ei/eurl/sasu/sarl/autre — nom distinct de `forme_juridique` déjà existant en texte libre, pour ne pas casser l'affichage), `regime_tva` (franchise/réel simplifié/réel normal), `regime_fiscal` (micro/ir/is). Défauts sûrs (micro/franchise/micro). Front : section "Profil fiscal" + Select shadcn dans `CompanyDetail.tsx`. Nouveau `src/lib/obligations/` (catalogue déclaratif + `getObligationsProfile()` pur, testé) — couvre le micro, structuré pour extension société. Pas d'écran d'échéancier (hors scope). Fusionnée dans `main`. |
| 2026-07-22 | Branche `feat/echeancier` (basée sur `feat/profil-fiscal`). Table `echeances` (RLS + index unique partiel anti-doublon sur les auto). Page `/echeancier` : liste + badges d'urgence (vert/orange/rouge/gris) + filtres + formulaire React Hook Form/Zod (première vraie utilisation de ce combo dans le repo). Génération auto depuis `getObligationsProfile()` au montage, dédupliquée. Clôturer une échéance récurrente régénère la suivante. Bug trouvé en testant : `toISOString()` décalait les dates locales d'un jour (fix : formatage manuel). 23 tests. Fusionnée dans `main`. |
| 2026-07-22 | Branche `feat/obligations-societe` (basée sur `feat/echeancier`). Catalogue enrichi pour SASU/SAS, EURL, SARL (IS acompte+solde, liasse fiscale, cotisations dirigeant DSN vs TNS selon la forme, TVA réel déjà couverte par les règles existantes). Marqueur "non-officiel" (`verifie: boolean`) ajouté aux obligations, rendu visible via suffixe " (à confirmer)" sur le titre des échéances auto (pas de migration, module additif). **Bug découvert et documenté, non corrigé** : la clé de dédup/index unique `(company_id, categorie, date_echeance)` ne distingue pas deux obligations différentes partageant catégorie+périodicité — `is_solde`/`liasse_fiscale`/`cfe` collisionnent pour une société à l'IS. Limite pré-existante (déjà vraie pour micro avec `irpp_2042_c_pro`+`cfe`, jamais testée), aggravée par les nouvelles obligations. Risque : une société pourrait ne recevoir aucune échéance auto (insert en lot sans ON CONFLICT, erreurs 23505 avalées silencieusement). **À corriger avant mise en prod société** : élargir la clé d'unicité pour inclure le type d'obligation. 33 tests. Fusionnée dans `main`. |
| 2026-07-22 | Branche `feat/relances` (basée sur `main`). Découverte : le suivi paiement était déjà largement construit (statut_paiement, paid_at, reminder_level, last_reminder_at, stripe_payment_link/session_id, table payment_reminders — migration 20260601180000) et `stripe-webhook` existait déjà avec vérif de signature HMAC correcte ; rien recréé de zéro, complété : `montant_paye` ajouté, CHECK élargi (partiel/en_retard), `metadata[user_id]` ajouté à `create-payment-link` (fusionné avec le fix IDOR de `fix/security-idor` sur ce même fichier), webhook gère aussi `payment_intent.succeeded` et vérifie que `metadata.user_id` correspond au vrai propriétaire avant d'agir. Nouveau `src/lib/payments/` (lateStatus, reconcilePayment, reminderTemplates — 3 gabarits déterministes, pas d'IA externe) + page `/relances`. `types.ts` complété au passage (plusieurs colonnes déjà en base manquaient des types généré, dette pré-existante). 29 tests sur la branche. Fusionnée dans `main`. |
| 2026-07-22 | **Fusion des 6 branches dans `main`** (ordre : fix/security-idor → chore/cleanup-n8n-ocr → feat/profil-fiscal → feat/echeancier → feat/obligations-societe → feat/relances). Conflits résolus : `PROJET_NOTES.md` (à chaque étape, lignes de journal cumulées), nav (App.tsx/AppShell/BottomNav/GlobalSearch/Sidebar — échéancier et relances ajoutaient chacun leur route au même endroit, gardé les deux), `create-payment-link/index.ts` (le fix IDOR et l'ajout `metadata[user_id]` touchaient le même fichier — gardé la version avec ownership check + ajouté la ligne metadata manquante). `tsc`/`build`/Vitest (49 tests) verts après chaque merge. |
| 2026-07-22 | Branche `feat/ged` (basée sur `main`, poussée, non fusionnée). Découverte (étape 0) : 3 buckets Storage existants (`invoices` privé, `expense-scans` public historique, `artisan-documents` privé) et aucune table d'index — les seules références fichier existantes sont `expense_scans.image_url`/`pdf_url` (chemins bruts) et `profiles.kbis_url` (URL publique historique, même si le bucket est privé — bug pré-existant non touché, contourné en extrayant le chemin relatif). `invoices.facturx_url` existait en colonne mais n'était **jamais écrit** : `generate-facturx` renvoyait juste les octets du PDF au navigateur sans persistance Storage — tâche corrigée au passage (upload + `facturx_url` mis à jour) car explicitement demandé par le prompt ("Factur-X généré" doit s'auto-indexer). Nouvelle table `documents` (index pur, RLS, `UNIQUE(storage_bucket, storage_path)` anti-doublon) + backfill unique en migration (notes de frais + kbis déjà existants) + branchement des 3 chemins d'écriture (upload note de frais, upload Kbis en 2 endroits, génération Factur-X) via des builders purs testables (`src/lib/documents/buildDocumentPayload.ts`). Helper `computeDateConservationMin` (10 ans facture/factur-x/justificatif, 5 ans contrat, repères indicatifs non certifiés, surchargeable). Page `/coffre` : liste filtrable (type/entreprise/recherche titre), ouverture via URL signée uniquement (jamais de lien public), formulaire d'ajout manuel RHF+Zod+shadcn Form. Filtre "client" volontairement omis : `documents` n'a pas de `client_id` direct (seulement `related_type`/`related_id`), un filtre client nécessiterait une jointure via facture — différé. Nav ajoutée aux 4 endroits habituels. 17 tests (conservation, mapping backfill, isolation user_id + URL signée simulées via un client Supabase minimal injecté — pas de test d'intégration RLS live, cohérent avec l'approche du reste du repo). `tsc`/`build`/Vitest (94 tests) verts. |

