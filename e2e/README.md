# Tests Playwright (e2e)

Smoke test responsive : vérifie qu'aucune route protégée ne déborde horizontalement
aux largeurs 320/375/768/1024/1280px. Complète l'audit statique `AUDIT_RESPONSIVE_2026-07-22.md`.

## Prérequis

1. Navigateurs Playwright installés : `npx playwright install` (déjà fait si `~/AppData/Local/ms-playwright` existe).
2. Un compte **de test dédié** sur le projet Supabase (jamais un compte de prod). Fournir ses
   credentials via variables d'environnement ou un fichier `.env.local` (déjà gitignoré) :

   ```
   TEST_USER_EMAIL=test-e2e@example.com
   TEST_USER_PASSWORD=un-mot-de-passe-suffisamment-long
   ```

3. Si le compte n'existe pas encore, `global-setup.ts` le crée automatiquement.
   Deux chemins possibles :
   - **Sans `SUPABASE_SERVICE_ROLE_KEY`** : `signUp` (client anon) — échoue si le projet
     Supabase n'a pas de SMTP configuré pour l'email de confirmation (erreur
     "Error sending confirmation email").
   - **Avec `SUPABASE_SERVICE_ROLE_KEY`** (recommandé, dans `.env.local`, jamais committée) :
     création via l'API admin (`auth.admin.createUser` avec `email_confirm: true`),
     qui ne dépend pas du SMTP du projet — chemin fiable pour un compte de test.

## Lancer

```
npm run test:e2e
```

Démarre automatiquement `npm run dev` (port 8080) si non déjà lancé, authentifie le
compte de test (session sauvegardée dans `e2e/.auth/user.json`, jamais committée),
puis exécute `e2e/responsive-smoke.spec.ts` sur toutes les routes protégées.

Rapport HTML : `npx playwright show-report`. Screenshots par route/largeur : `e2e/results/`.

## Fichiers

- `e2e/env.ts` — charge `.env`/`.env.local` pour Node (Vite ne le fait que côté app).
- `e2e/global-setup.ts` — authentifie le compte de test, injecte la session Supabase
  dans `localStorage` via Playwright, sauvegarde le `storageState`.
- `e2e/responsive-smoke.spec.ts` — le test de fumée responsive lui-même.
- `playwright.config.ts` — config racine (remplace l'ancienne config qui référençait
  `lovable-agent-playwright-config`, package Lovable-platform absent de cet environnement).
