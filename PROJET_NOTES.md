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
| 2026-07-22 | Branche `feat/obligations-societe` (basée sur `feat/echeancier`, qui inclut `feat/profil-fiscal` — dépendance réelle, pas mergeable seule). Catalogue enrichi pour SASU/SAS, EURL, SARL (IS acompte+solde, liasse fiscale, cotisations dirigeant DSN vs TNS selon la forme, TVA réel déjà couverte par les règles existantes). Marqueur "non-officiel" (`verifie: boolean`) ajouté aux obligations, rendu visible via suffixe " (à confirmer)" sur le titre des échéances auto (pas de migration, module additif). **Bug découvert et documenté, non corrigé** : la clé de dédup/index unique `(company_id, categorie, date_echeance)` ne distingue pas deux obligations différentes partageant catégorie+périodicité — `is_solde`/`liasse_fiscale`/`cfe` collisionnent pour une société à l'IS. Limite pré-existante (déjà vraie pour micro avec `irpp_2042_c_pro`+`cfe`, jamais testée), aggravée par les nouvelles obligations. Risque : une société pourrait ne recevoir aucune échéance auto (insert en lot sans ON CONFLICT, erreurs 23505 avalées silencieusement). À corriger en tâche dédiée : élargir la clé d'unicité pour inclure le type d'obligation. 33 tests sur la branche, poussée, non fusionnée. |
| 2026-07-22 | Branche `feat/profil-fiscal` : socle "obligations administratives" évolutif micro → société. Migration `companies` : `forme_juridique_categorie` (micro/ei/eurl/sasu/sarl/autre — nom distinct de `forme_juridique` déjà existant en texte libre, pour ne pas casser l'affichage), `regime_tva` (franchise/réel simplifié/réel normal), `regime_fiscal` (micro/ir/is). Défauts sûrs (micro/franchise/micro). Front : section "Profil fiscal" + Select shadcn dans `CompanyDetail.tsx`. Nouveau `src/lib/obligations/` (catalogue déclaratif + `getObligationsProfile()` pur, testé) — couvre le micro, structuré pour extension société. Pas d'écran d'échéancier (hors scope). Branche poussée, non fusionnée vers `main`. |
| 2026-07-22 | Branche `feat/echeancier` (basée sur `feat/profil-fiscal`, pas sur `main` — dépendance réelle à `getObligationsProfile`, à merger dans cet ordre). Table `echeances` (RLS + index unique partiel anti-doublon sur les auto). Page `/echeancier` : liste + badges d'urgence (vert/orange/rouge/gris) + filtres + formulaire React Hook Form/Zod (première vraie utilisation de ce combo dans le repo). Génération auto depuis `getObligationsProfile()` au montage, dédupliquée. Clôturer une échéance récurrente régénère la suivante. Bug trouvé en testant : `toISOString()` décalait les dates locales d'un jour (fix : formatage manuel). 23 tests, branche poussée, non fusionnée. |

