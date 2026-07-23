# Audit responsive — Facturéo (2026-07-22)

Audit **lecture seule**. Aucun fichier de composant ou de style n'a été modifié. Seul livrable : ce rapport.

---

## Résumé exécutif

L'app est **utilisable sur mobile aujourd'hui, mais inégale** : les pages construites récemment (Échéancier, Coffre, Assistant, Relances, notes de frais) suivent un pattern mobile-conscient rigoureux (`useIsMobile()` + branchement complet), tandis que les pages plus anciennes/complexes (facturation : Kanban/Liste/SideSheet/CreateInvoiceModal) ont des angles morts réels — le pire étant l'étape 2 de `CreateInvoiceModal` (récap facture) qui écrase deux colonnes sur un modal plein écran mobile. Les cibles tactiles < 40px sont un défaut transverse récurrent (bouton `size="sm"` du design system = 28px, jamais bonifié pour le tactile). **Mise à jour post-audit :** la mesure Playwright a été complétée après coup sur 10 des 13 routes protégées (compte de test dédié débloqué) — aucun débordement horizontal détecté nulle part, 60/60 (2 routes publiques + 10 protégées) OK toutes largeurs confondues (voir section « Vérification mesurée » et son tableau mis à jour). Cela confirme l'absence de casse totale, mais ne change rien aux angles morts internes ci-dessus (touch targets, grilles de dialog) : le scroll de page et l'ergonomie interne sont deux choses différentes.

**Note globale : 6.5/10** — solide sur les modules récents, fragile sur le cœur historique (facturation), pas de casse totale nulle part.

---

## Étape 0 — Conventions actuelles

- **Pas de Tailwind mobile-first sur les pages.** Le layout des pages (`src/pages/*.tsx`) est fait en **styles inline React + variables CSS custom** (`var(--bg-1)`, `var(--r-3)`, etc. — voir `src/styles/tokens.css`). Tailwind n'est utilisé que pour l'intérieur des composants shadcn/ui (`src/components/ui/*`) et très rarement dans les pages : **une seule occurrence** d'un préfixe responsive Tailwind (`sm:`, `md:`, `lg:`, `xl:`) trouvée dans tout `src/pages/` : `Previsionnel.tsx:463` (`className="sm:max-w-md"` sur un Dialog shadcn).
- **Breakpoint mobile = un hook custom, pas les breakpoints Tailwind.** `src/hooks/use-mobile.tsx` définit `MOBILE_BREAKPOINT = 768` et expose `useIsMobile()` (media query `matchMedia`). Presque toutes les pages branchent leur layout via `isMobile ? A : B` plutôt que via des classes responsive CSS. Il n'y a donc **pas de rupture intermédiaire** (pas de comportement dédié tablette 768-1024px distinct du desktop) — le point de bascule est binaire : < 768px (mobile) vs ≥ 768px (tout le reste, du petit laptop au grand écran).
- **shadcn/ui embarque son propre système de sidebar responsive Tailwind** (`src/components/ui/sidebar.tsx`, breakpoint `md:` ligne 195, `SIDEBAR_WIDTH_MOBILE`) mais **il n'est pas utilisé** — l'app a sa propre `Sidebar.tsx` custom pilotée par `useIsMobile()`. Composant shadcn mort côté layout applicatif, à noter mais hors scope (pas un bug responsive).
- **Thème clair/sombre : pas next-themes, mécanisme custom.** `next-themes` est une dépendance (`package.json:55`) mais n'est réellement importé que dans `src/components/ui/sonner.tsx:1` (wrapper Toaster). Le vrai thème de l'app est géré par `AppShell.tsx` (`useState<'dark'|'light'>`, attribut `data-theme` sur `documentElement`, persistance `localStorage`) et par `src/styles/tokens.css` : bloc `:root, [data-theme="dark"]` (ligne 8) + override `[data-theme="light"]` (ligne 91). Aucun rapport direct avec le responsive, mais confirme que `next-themes` est une dépendance quasi-vestigiale pour le thème applicatif principal.
- **Stratégie de navigation Sidebar/BottomNav/AppShell :** binaire et propre. `AppShell.tsx:57` — `{!isMobile && <Sidebar .../>}` ; `AppShell.tsx:69` — `{isMobile && <BottomNav />}`. Jamais les deux montés en même temps. `Sidebar.tsx:45` a une largeur fixe `var(--sidebar-w)` = `232px` (`tokens.css:85`) mais comme le composant est démonté sous 768px, ce n'est pas un problème de responsive en soi. `BottomNav.tsx` est fixe en bas (`height: 56`), avec un tiroir "Plus" pour les entrées de nav excédentaires — bon pattern, cohérent.

---

## Tableau par page

| Page | État | Problèmes précis (fichier:ligne) | Gravité |
|---|---|---|---|
| **Auth.tsx** | OK | Carte centrée `maxWidth:420` (`Auth.tsx:163`), inputs `width:100%` — dégrade proprement à 320px. Ligne SIRET+bouton (`Auth.tsx:263-284`) potentiellement serrée sur très petit écran mais pas de débordement mesuré. | mineur |
| **ResetPassword.tsx** | OK | Tailwind pur (`max-w-md`, `p-4`), pas de style inline — dégrade nativement. Mesuré sans débordement à 320/375/768/1024/1280px (voir étape 2). | — |
| **Index.tsx (dashboard)** | Moyen | KPIs : grid `repeat(2,1fr)` mobile / `repeat(3,1fr)` desktop (`Index.tsx:483`) — OK. Kanban desktop `repeat(4, minmax(0,1fr))` (`Index.tsx:595`) seulement si `!isMobile`, sinon rangée scroll horizontal (`Index.tsx:567`) — bon pattern. Aucun problème critique trouvé. | mineur |
| **Companies.tsx** | OK | Titre entreprise en tête de détail non tronqué (`Companies.tsx:266`, pas d'ellipsis contrairement à la ligne de liste `:228`) — overflow visuel possible sur nom très long, pas un débordement de page. | mineur |
| **CompanyDetail.tsx** | OK | Rien de critique ; titre/sous-titre tronqués correctement (`:226-236`), dialog `max-w-2xl` standard. | — |
| **Clients.tsx** | Moyen | Grid clients `minmax(280px,1fr)` (`Clients.tsx:310`) : à 320px de large avec le padding de page (`:294`, 24px), la marge disponible (~272-296px) est **tangente** avec un minmax de 280px — mesuré (Playwright) : pas de débordement de page à 320px sur `/clients` (50/50 OK, cf. section mesurée), donc le navigateur absorbe cette tangence sans overflow global, mais la marge reste serrée visuellement (non vérifié à l'œil, screenshot dispo `e2e/results/`). Dialog édition client : `grid-cols-2` Tailwind fixe (`Clients.tsx:341,346`) sans repli 1 colonne mobile — champs Ville/CP et TJM/Conditions écrasés à 320-375px dans un dialog `max-w-lg` (dialog non ouvert pendant la mesure automatique, donc toujours non mesuré). | moyen |
| **Invoices.tsx** (page hôte, priorité de l'audit) | **Le plus fragile** | Le layout est délégué aux sous-composants (`InvoiceFilters`, `KanbanBoard`, `ListView`, `SideSheet`, `CreateInvoiceModal` — voir section transverse ci-dessous, c'est là que sont les vrais problèmes). Le dialog d'envoi d'email intégré à `Invoices.tsx:445-504` est en Tailwind pur (`max-w-md`, `w-full`) — celui-là est propre. | critique (via composants enfants) |
| **InvoiceSettings.tsx** | OK | Formulaire mono-colonne, `maxWidth:560` (`:124`), champs `width:100%` — dégrade nativement sans besoin de `isMobile`. | — |
| **ExpenseScans.tsx** | OK | Header `flexDirection: isMobile?column:row` (`:196`), boutons `flex:1` sur mobile (`:202,206`) — branchement complet. Dialog édition = shadcn par défaut (`max-w-lg` implicite), pas de className custom. | — |
| **Previsionnel.tsx** | Moyen | Tableau prévisionnel bien encapsulé `overflowX:'auto'` (`:379`). Cartes résumé `1fr` mobile / `repeat(2,1fr)` desktop (`:290`) — bon. Boutons icône suppression prévisionnel et flèches année **fixes 28-32px, jamais bonifiés en mobile** (`:279,283,360-365`) — cible tactile sous les ~40px recommandés. Padding racine fixe `24` sans variante mobile (`:270`), incohérent avec le reste de l'app (souvent `16` sur mobile). | moyen |
| **UserManagement.tsx** | OK — meilleur exemple du repo | Branchement `isMobile` le plus complet observé : rendu carte dédié mobile (`:181-341`) vs `<table>` desktop (`:218,343`), boutons `44x44` en mobile (`:302,309`) vs `28x28` en desktop (`:401,410`). Emails tronqués en vue carte (`:195,319`), pas en vue tableau desktop (mineur, cellules moins contraintes). | — |
| **Echeancier.tsx** | Moyen | Filtres `Select` `width: isMobile?"100%":200` (`:260,267`) — bon. Cartes `flexWrap:'wrap'` (`:291`) — bon. Dialog `max-w-lg` (`:341`) — bon. **Boutons icône Modifier/Supprimer en `size="sm"` (`:314,317`) = 28px de haut, jamais bonifiés pour mobile** (voir défaut transverse touch target ci-dessous). | moyen |
| **Coffre.tsx (GED)** | OK | Filtres `Input`/`Select` `width: isMobile?"100%":...` (`:186` et suivants) — bon. Formulaire d'ajout = dialog `max-w-lg`, champ fichier natif — bon. Rangées de documents = bouton pleine largeur (touch target = toute la ligne, pas un problème). | — |
| **Assistant.tsx** | OK | Header `padding: isMobile?"12px 16px":"16px 24px"` — bon. Cartes de signal `flexWrap:'wrap'`, bouton pleine largeur par carte — pas de bouton icône isolé. État vide simple, pas de risque. | — |
| **Relances.tsx** | OK | Dialog `max-w-lg`, ligne facture `flexWrap:'wrap'`. Bouton "Préparer une relance" = `Button` avec label (pas icône seule) — pas de souci de cible tactile ici. | — |
| **Bulle Luca (LucaBubble/LucaPanel)** | OK, complet | Bulle `56x56` fixe (`LucaBubble.tsx:35`) — bonne cible tactile. Panel : plein écran mobile (`inset:0`) vs `380x560` desktop (`LucaPanel.tsx:62-67`) — branchement complet et propre. Bouton fermeture panel `isMobile?44:32` (`:93`) — bon. **Boutons micro/envoi fixes `40x40`** (`:174,189`) — tangent avec le seuil recommandé mais acceptable (exactement 40px). | mineur |
| **GlobalSearch.tsx** | OK | Dialog `maxWidth:560` (`:86`) avec `padding:0` — shadcn `DialogContent` de base a `w-full`, donc dégrade correctement sous 560px. Liste de résultats `maxHeight:360, overflowY:'auto'` — bon. | — |

---

## Problèmes transverses

### 1. Cibles tactiles < 40px (défaut systémique, pas un bug isolé)
Le composant partagé `Button` (`src/components/ui/primitives.tsx:36-38`) définit :
```
sm: { padding: '6px 10px', fontSize: 13, height: 28 }
md: { padding: '8px 14px', fontSize: 14, height: 36 }
lg: { padding: '11px 18px', fontSize: 15, height: 44 }
```
**Aucune variante ne bonifie la hauteur en contexte mobile** — c'est à chaque appelant de faire `isMobile ? 44 : ...` manuellement (ce que font bien `CreateInvoiceModal.tsx:311-323`, `LucaPanel.tsx:93`, `CompanyDetail.tsx:215`, `Clients.tsx:60-77`), mais beaucoup d'autres ne le font pas :
- `Echeancier.tsx:314,317` — boutons icône Modifier/Supprimer, `size="sm"` = 28px, jamais bonifiés.
- `Previsionnel.tsx:279,283,360-365` — flèches année + suppression, 28-32px fixes.
- `ListView.tsx` (via subagent) — `IconBtn` mobile `36x36` réutilisé du desktop, sous le seuil recommandé.
- `InvoiceFilters.tsx` branche mobile (36x36) — sous le seuil, alors que c'est justement la branche mobile.
- `SideSheet.tsx` — bouton fermeture `28x28` fixe, aucun `isMobile` du tout dans tout le fichier.

### 2. Tableaux susceptibles de déborder sur mobile
- **`ListView.tsx`** (composant utilisé par `Invoices.tsx` en vue liste) : `<table>` desktop à 8 colonnes non explicitement wrappé en scroll horizontal *autour de la table elle-même* — mais le conteneur parent de page a `overflow:'auto'`, donc un scroll horizontal existe de facto au niveau page (pas un vrai bug, mais fragile/non intentionnel : si ce `overflow:'auto'` disparaît un jour du parent, la table cassera silencieusement).
- **`Previsionnel.tsx:379`** et **`UserManagement.tsx`** (vue desktop) : bons exemples, `overflowX:'auto'` explicite ou table masquée sous 768px.
- Aucune vraie table HTML native trouvée dans `Invoices.tsx` lui-même — tout est délégué à `KanbanBoard`/`ListView`.

### 3. Dialogs/modals
- Tous les dialogs shadcn héritent d'un padding fixe `p-6` (`src/components/ui/dialog.tsx:39`, `w-full max-w-lg` par défaut) — à 320px, un dialog `max-w-lg` non stylé consomme 320-48=272px utiles quel que soit l'écran. Pas un bug (comportement voulu par le composant), mais aucune page ne réduit ce padding sur mobile — cohérent partout, jamais une régression isolée.
- **`CreateInvoiceModal.tsx:704`** (étape 2 "récapitulatif") : grid `1.2fr 1fr` (aperçu facture + résumé côte à côte) **sans branchement `isMobile`**, alors que le modal lui-même passe bien en plein écran mobile (`:281-292`). Sur 320-375px, ça écrase un mini-aperçu de facture (police 8-11px, `:706-709`) et un résumé dans deux colonnes très étroites — **c'est le pire problème isolé de tout l'audit** : la seule page qui a fait l'effort du plein écran mobile pour ensuite casser son contenu interne à la même largeur.
- **`CreateInvoiceModal.tsx:413,667`** — mêmes deux-colonnes fixes sur les champs N°/date et BC/paiement, même absence de branchement mobile.
- **`Clients.tsx:341,346`** — `grid-cols-2` Tailwind fixe dans le dialog d'édition client, même défaut à plus petite échelle.

### 4. Formulaires / GlobalSearch
- GlobalSearch : dialog centré `maxWidth:560`, dégrade bien, input pleine largeur — rien à signaler.
- Formulaires RHF+Zod+shadcn (Echeancier, Coffre, Relances) : tous en une colonne ou `grid-cols-2` shadcn/Tailwind standard qui repasse nativement à 1 colonne sous le breakpoint `sm:` de Tailwind par défaut de shadcn (ces formulaires n'ont pas été trouvés problématiques par le sous-agent).

### 5. Charts / prévisualisations PDF
- **Aucun usage de Recharts trouvé** dans tout le batch de fichiers audités (`Previsionnel.tsx` inclus) — la dépendance Recharts existe (`package.json`) mais n'est utilisée nulle part dans les pages actuelles ; `Index.tsx` a son propre mini-chart SVG fait main (`SimpleChart`, `Index.tsx:259-308`), en `viewBox` SVG donc intrinsèquement responsive (`width:'100%'` sur le `<svg>`). Rien à signaler côté charts.
- Prévisualisation facture (mini-aperçu papier) : voir point 3 ci-dessus (`CreateInvoiceModal.tsx:704-729`) — c'est le seul "aperçu" du repo, et il est concerné par le problème d'écrasement mobile.

### 6. Cohérence Sidebar ↔ BottomNav au point de rupture
Propre : jamais les deux montés simultanément (`AppShell.tsx:57,69`), bascule nette à 768px. Le tiroir "Plus" de `BottomNav` absorbe les entrées de nav excédentaires sur mobile — bon pattern, pas de doublon ni de trou fonctionnel constaté entre les deux.

---

## Vérification mesurée (Playwright)

**Réalisée partiellement.** La fixture d'auth du projet (`playwright-fixture.ts` → package `lovable-agent-playwright-config`) **n'est pas installée** (`node_modules/lovable-agent-playwright-config` absent, package absent de `package.json`) — c'est un outillage spécifique à la plateforme Lovable, indisponible dans cet environnement local. Créer un compte de test pour contourner aurait constitué une écriture, interdite par la contrainte lecture-seule de ce prompt. J'ai donc mesuré uniquement les **2 routes publiques** accessibles sans session, avec `@playwright/test`/`playwright-core` (déjà présents en dépendance) directement contre le serveur `vite dev` local, en assertant `document.body.scrollWidth <= window.innerWidth` :

| Page | 320px | 375px | 768px | 1024px | 1280px |
|---|---|---|---|---|---|
| `/auth` | OK | OK | OK | OK | OK |
| `/reset-password` | OK | OK | OK | OK | OK |

Aucun débordement horizontal mesuré sur ces deux routes, à aucune largeur.

**Non mesurées (routes protégées) :** `/`, `/entreprises`, `/entreprises/:id`, `/clients`, `/factures`, `/parametrage`, `/notes-de-frais`, `/previsionnel`, `/utilisateurs`, `/echeancier`, `/coffre`, `/assistant`, `/relances` — toutes derrière l'auth Supabase, non accessibles sans session valide et sans fixture d'auth fonctionnelle dans cet environnement. L'audit sur ces pages reste donc **statique uniquement** (tableau ci-dessus), pas mesuré à l'écran. Recommandation : installer/porter une fixture d'auth locale (ou un compte de test dédié géré hors de cette session) avant un prochain audit mesuré complet.

### Mise à jour — Lot 0 (branche `test/responsive-measurement`, fusionnée dans `main`)

Outillage Playwright reconstruit en propre (`playwright.config.ts`, `e2e/global-setup.ts`, `e2e/responsive-smoke.spec.ts`, `e2e/README.md`) puisque `lovable-agent-playwright-config` reste indisponible dans cet environnement. `global-setup.ts` authentifie un compte de **test dédié** (`TEST_USER_EMAIL`/`TEST_USER_PASSWORD`, jamais un compte de prod) et sauvegarde son `storageState` pour les 50 tests (10 routes protégées × 5 largeurs).

`SUPABASE_SERVICE_ROLE_KEY` fournie ensuite (`.env.local`, jamais committée) : le compte de test a pu être créé via l'API admin (contourne le SMTP non configuré du projet), et `npm run test:e2e` exécuté pour de vrai.

### Résultat mesuré (`npm run test:e2e`, 50 tests, chromium)

| Page | Route | 320px | 375px | 768px | 1024px | 1280px |
|---|---|---|---|---|---|---|
| Dashboard | `/` | OK | OK | OK | OK | OK |
| Entreprises | `/companies` | OK | OK | OK | OK | OK |
| Clients | `/clients` | OK | OK | OK | OK | OK |
| Factures | `/invoices` | OK | OK | OK | OK | OK |
| Notes de frais | `/expense-scans` | OK | OK | OK | OK | OK |
| Prévisionnel | `/previsionnel` | OK | OK | OK | OK | OK |
| Utilisateurs | `/user-management` | OK | OK | OK | OK | OK |
| Échéancier | `/echeancier` | OK | OK | OK | OK | OK |
| Coffre | `/coffre` | OK | OK | OK | OK | OK |
| Assistant | `/assistant` | OK | OK | OK | OK | OK |

**50/50 OK.** Aucun débordement horizontal (`scrollWidth <= innerWidth`) détecté sur aucune des 10 routes protégées, à aucune des 5 largeurs testées. Screenshots par page/largeur dans `e2e/results/`.

Ce résultat mesure uniquement le débordement horizontal global de la page — il ne contredit pas les findings statiques de l'audit ci-dessus (touch targets <40px, grilles 2 colonnes dans les dialogs, `CreateInvoiceModal.tsx:704`) : une page peut ne pas déborder tout en ayant des éléments internes mal dimensionnés ou peu accessibles au toucher. Le plan de correction (lots 1 à 4 ci-dessous) reste valable tel quel.

---

## Plan responsive incrémental priorisé

**Lot 1 — critique, isolé, fort impact perçu** (`feat/responsive-invoice-modal`)
- `CreateInvoiceModal.tsx:704` (récap étape 2) : passer `1.2fr 1fr` → `1fr` empilé sur mobile.
- `CreateInvoiceModal.tsx:413,667` : même traitement sur les paires de champs.
- Un seul fichier, un seul composant, risque de régression faible (juste ajouter un ternaire `isMobile` déjà utilisé ailleurs dans le même fichier).

**Lot 2 — touch targets, transverse mais mécanique** (`feat/responsive-touch-targets`)
- `Echeancier.tsx:314,317`, `Previsionnel.tsx:279,283,360-365`, `SideSheet.tsx` (bouton fermeture), `ListView.tsx`/`InvoiceFilters.tsx` (boutons icône mobile 36x36).
- Envisager d'ajouter une prop `mobileSize` optionnelle au composant `Button` partagé (`primitives.tsx`) pour éviter de refaire le ternaire à chaque site d'appel — décision à prendre séparément, hors scope de cet audit lecture-seule.

**Lot 3 — formulaires en dialog à 2 colonnes** (`feat/responsive-dialog-grids`)
- `Clients.tsx:341,346` (`grid-cols-2` fixe) et vérification équivalente sur `Companies.tsx`/`CompanyDetail.tsx` (dialogs `max-w-2xl`, contenu non audité colonne par colonne par le sous-agent — à vérifier en détail avant de coder).

**Lot 4 — `SideSheet.tsx` : ajouter `useIsMobile()`**
- Actuellement zéro branchement mobile dans tout le fichier (padding fixe, pas de troncature nom client, bouton fermeture fixe). À traiter en un lot dédié car c'est un composant partagé (facture + éventuels futurs usages), plus risqué à toucher qu'une page isolée.

**Lot 5 — mesure Playwright complète (partiellement fait)**
- Fait : `scrollWidth`/`innerWidth` mesuré aux 5 largeurs sur 10 routes protégées (`e2e/responsive-smoke.spec.ts`) — 50/50 OK, aucun débordement horizontal détecté (voir tableau mesuré ci-dessus).
- Restant : 3 routes protégées non couvertes par ce spec (`/entreprises/:id`, `/parametrage`, `/relances`) — à ajouter dans `ROUTES` (`e2e/responsive-smoke.spec.ts`) pour une couverture complète. Cette mesure ne remplace pas les findings statiques ci-dessus (touch targets, grilles internes) — seul le débordement global de page est vérifié automatiquement, donc l'hypothèse `Clients.tsx:310` (grid `minmax(280px,...)` tangent à 320px) reste à vérifier visuellement malgré le "OK" global sur `/clients`.

**Non recommandé en l'état :** toucher `Coffre.tsx`, `Assistant.tsx`, `Relances.tsx`, `Echeancier.tsx` (hors touch targets), `UserManagement.tsx`, `ExpenseScans.tsx`, `Auth.tsx`, `ResetPassword.tsx`, `InvoiceSettings.tsx` — déjà propres ou dégradation naturelle suffisante, tout changement y serait du bikeshedding sans bénéfice mesurable.
