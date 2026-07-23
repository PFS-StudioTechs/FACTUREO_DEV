# FACTUREO — Audit UX/UI Phase 1

> 2026-07-23 · Lecture seule, aucune modification. Prépare Phase 2 (Design System) + Phase 5 (refonte écrans).

---

## 1. Inventaire pages (src/pages, routes src/App.tsx)

| Page | Route | Lignes | Notes |
|---|---|---|---|
| Index.tsx | `/` | 611 | Dashboard : KPIs, kanban preview, charts. Plus complexe. |
| Invoices.tsx | `/factures` | 509 | Kanban+liste, sheet, modal création, voix, envoi email. Cœur produit. |
| Previsionnel.tsx | `/previsionnel` | 506 | Prévisionnel trésorerie. |
| UserManagement.tsx | `/utilisateurs` (admin) | 503 | Liste users/rôles admin. |
| Auth.tsx | `/auth` | 456 | Login/signup multi-étapes. |
| Echeancier.tsx | `/echeancier` | 444 | Échéancier paiements. |
| CompanyDetail.tsx | `/entreprises/:id` | 438 | Fiche entreprise. |
| Companies.tsx | `/entreprises` | 373 | Liste + création KBIS avec extraction IA. |
| Clients.tsx | `/clients` | 381 | CRUD clients, parsing contrat. |
| CompleteProfile.tsx | `/complete-profile` | 356 | Onboarding (hors shell). |
| ExpenseScans.tsx | `/notes-de-frais` | 292 | Scan notes de frais (IA). |
| Coffre.tsx | `/coffre` | 269 | Coffre documents. |
| Relances.tsx | `/relances` | 247 | Relances impayés. |
| InvoiceSettings.tsx | `/parametrage` (admin) | 211 | Numérotation/templates facture. |
| UploadKbis.tsx | `/upload-kbis` | 205 | Gate KBIS (hors shell). |
| Assistant.tsx | `/assistant` | 79 | Fil "signaux" lecture seule — **pas** le chat Luca. |
| ResetPassword.tsx | `/reset-password` | 135 | Reset mdp. |
| AuthCallback.tsx | `/auth/callback` | 56 | Redirect OAuth. |
| NotFound.tsx | `*` | 24 | 404 générique, copy anglaise, look shadcn brut. |

Route guards propres dans `App.tsx:34-96` (`ProtectedRoutes`, `AuthRequiredRoute`, `AdminRoute`).

---

## 2. État Design System — problème central

**Deux design systems parallèles incompatibles, chargés en même temps** (`src/main.tsx:3-4`) :

- **Système A — shadcn/Tailwind** : `index.css:8-92` (HSL vars, `--primary: 245 58% 51%` indigo), `tailwind.config.ts:16-64`. Fonts Space Grotesk+Inter (Google Fonts). `darkMode: ["class"]`.
- **Système B — tokens custom** : `src/styles/tokens.css` — palette charcoal/bleu-noir, accent ambre `#d97706`, échelle texte/radii/shadows séparée. Bridgé dans `tailwind.config.ts:66-88` mais dark mode togglé via `data-theme` (`AppShell.tsx:39`), **pas** via `class` — donc `dark:` Tailwind ne s'active jamais pour ce système (seulement 2 fichiers utilisent `dark:`).
- shadcn primitives (`src/components/ui/`, 40+ fichiers) = **stock, non custom**.
- **2e librairie de composants faite main** : `src/components/ui/primitives.tsx` (Button, Pill, Card, Input, Avatar, Money, Progress, FacturXBadge) + `Icon.tsx` (set SVG custom, ~34 fichiers) — tout en `style={{ }}` inline sur tokens Système B, zéro classe Tailwind.
- Résultat : `Invoices.tsx`, `Clients.tsx`, `Companies.tsx`, `Coffre.tsx` importent **les deux systèmes en même temps**.
- `App.css` = boilerplate Vite/React jamais nettoyé, mort.
- Double `@import` Google Fonts (index.css + tokens.css) — Space Grotesk/Inter chargés réseau mais jamais appliqués (cascade gagnée par Geist de tokens.css).

**→ Priorité #1 Phase 2 : choisir UN système (tokens.css a la meilleure architecture), migrer dessus, tuer l'autre.**

---

## 3. Incohérences visuelles/UX

- 2 librairies icônes en parallèle : lucide-react (28 fichiers) vs `Icon.tsx` maison (34 fichiers) — mélange de styles de trait sur le même écran.
- Boutons/cards/badges dupliqués : shadcn (Tailwind, indigo) vs `primitives.tsx` (inline, ambre) — rayons/tailles/hover différents selon l'écran.
- Couleurs de statut redéfinies par page au lieu d'une source unique : `Assistant.tsx:8-12`, `Relances.tsx:32`, `Echeancier.tsx:67`, `Index.tsx:136` — avec fallbacks hex inline. `CompanyDetail.tsx:316` utilise `--green`/`--green-subtle`, tokens qui **n'existent nulle part**.
- États loading incohérents : texte brut "Chargement…" (7 fichiers) vs `Loader2` lucide animé (5 fichiers) vs classe `.skeleton` définie mais quasi jamais utilisée.
- Empty states ad hoc répétés identiques (icône + ligne + CTA) sans composant partagé — 5+ occurrences.
- Layout/Luca (`Sidebar.tsx`, `Topbar.tsx`, `BottomNav.tsx`, `AppShell.tsx`, `Luca*.tsx`) = 100% inline-style, hover géré en JS `onMouseEnter/Leave` au lieu de CSS `:hover`/`hover:`.

---

## 4. Mobile-first / responsive

- `useIsMobile` (`src/hooks/use-mobile.tsx`) = seuil unique 768px JS, bascule layouts entiers (Sidebar ↔ BottomNav) plutôt que classes responsive Tailwind.
- Préfixes `sm:/md:/lg:/xl:` : seulement 15 usages dans tout `src/pages`+`src/components` — quasi tout le responsive est du rendu conditionnel JS dupliqué, pas du CSS.
- `BottomNav.tsx` = bon pattern mobile (barre + drawer "plus", `env(safe-area-inset-bottom)` géré) — solide, à garder.
- Pas de container queries, pas de typo fluide, tablette collapse sur mobile ou desktop selon le seuil unique.

---

## 5. Accessibilité — points rouges

- Boutons icon-only sans `aria-label` majoritaires : 6 `aria-label` total vs 21 `<button>` bruts rien que dans `layout/`+`luca/`. Ex : cloche notif (`Topbar.tsx:82-99`), déconnexion (`Sidebar.tsx:244-252`, `title` seul ≠ nom accessible), workspace switcher (`Sidebar.tsx:59-83`).
- `LucaBubble.tsx:29` a `aria-label="Ouvrir Luca"` correct — modèle à répliquer.
- Contraste à risque : `--text-3: #5c6678` sur `--bg-2: #11151d` en texte 10-11px répété partout (timestamps, hints) — à vérifier WCAG AA.
- Backdrop `<div onClick>` sans role/clavier (`BottomNav.tsx:44-52`).
- Focus-visible global défini une fois (`tokens.css:165-169`, bon), mais boutons custom gèrent hover en JS sans état focus clavier distinct.

---

## 6. Éléments datés / dette

- `App.css` boilerplate mort, jamais référencé.
- `NotFound.tsx` copy anglaise ("Oops! Page not found") dans une app 100% française — reliquat scaffold jamais traduit.
- Double chargement fonts Google (réseau gaspillé, une des deux jamais visible).
- Lien nav "Design system" (`Sidebar.tsx:196-222`, prop `onOpenDS`) jamais branché dans `AppShell.tsx` — affordance morte.
- Dark mode Tailwind configuré (`class` strategy) mais non fonctionnel sur 95% de l'UI (app togg `data-theme`).

---

## 7. Surface IA/Luca actuelle

- Bulle flottante bas-droite (`LucaBubble.tsx`), globale sur tout écran authentifié, ouvre panneau chat (`LucaPanel.tsx`, docké desktop / plein écran mobile). Voix via Web Speech API.
- Auto-open une fois par session (`useLucaGreeting`) — seul nudge "IA présente" actuel.
- Cartes de confirmation d'action (`components/luca/actions/*`, 6 types) + deep-link prefill vers autres pages (`Invoices.tsx:59-68`) — bonne intégration cross-feature déjà là.
- **Confusion naming** : route `/assistant` (nav "Assistant", icône cloche) = fil signaux lecture seule, **sans lien** avec le chat "Luca" (autre branding, autre avatar). Deux identités IA différentes dans la même app.
- Prominence actuelle faible : bulle discrète, pas de pulse/badge/glow signalant du nouveau, pas de suggestions IA inline dans les écrans (Factures/Clients) hors du panneau chat.

**→ Phase 3 (identité produit "copilote IA") : unifier Assistant+Luca sous une seule identité, ajouter présence IA ambiante dans les écrans métier.**

---

## 8. Déjà solide — ne pas casser

- Architecture tokens de `tokens.css` — structurée, complète (surfaces/texte/bordures/statuts/shadows/radii, light+dark) — **base à garder comme socle unique** si on tue le doublon shadcn HSL.
- `BottomNav.tsx` — pattern mobile solide.
- Route guards `App.tsx:34-96` — propre, pas à toucher.
- Système cartes de confirmation Luca + deep-link prefill — bon scaffolding IA à étendre.
- `FacturXBadge` (`primitives.tsx:196-243`) — détail visuel signature (tampon animé) à préserver, pas à génériciser.
- Focus-visible + scrollbar theming globaux déjà soignés.
- `Icon.tsx` compatible visuellement lucide (viewBox 24×24, même convention de trait) — migration vers un seul système d'icônes = mécanique, risque faible.

---

## Synthèse — verrou avant Phase 2

Le vrai problème n'est pas "manque de personnalité visuelle", c'est **deux design systems qui se battent en silence** (shadcn/Tailwind vs tokens.css/primitives.tsx) sur les mêmes écrans. Toute nouvelle palette/composant doit d'abord trancher lequel des deux devient la seule source de vérité — sinon la refonte ajoute un 3e système au lieu d'en unifier deux.

Recommandation : garder l'architecture `tokens.css` (déjà riche, déjà pensée dark/light), migrer shadcn dessus (remapper les CSS vars shadcn consomme vers les tokens System B), supprimer `primitives.tsx`/doublons progressivement écran par écran en Phase 5.
