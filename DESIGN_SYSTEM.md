# FACTUREO — Design System v1 (Phase 2)

> Fondation avant refonte écran par écran (Phase 5). Basé sur audit `AUDIT_UX_UI_2026-07-23.md`.

---

## 0. Décision structurante

**Une seule source de vérité : `src/styles/tokens.css`.**

Le système shadcn/Tailwind HSL (`index.css`) est déprécié. `tailwind.config.ts` sera remappé pour que les classes Tailwind (`bg-primary`, `text-muted-foreground`, etc.) consomment directement les tokens `tokens.css`, pas les variables HSL parallèles. `primitives.tsx` (2e lib de composants) est absorbé/supprimé progressivement en Phase 5 — ses composants (Pill, Money, FacturXBadge...) migrent vers `src/components/ui/` mais gardent leur identité visuelle actuelle (déjà bonne).

Dark mode : `tailwind.config.ts` passe de `darkMode: ["class"]` à `darkMode: ["selector", '[data-theme="dark"]']` (supporté Tailwind 3.4+) — aligne Tailwind sur le toggle `data-theme` déjà utilisé par l'app. Zéro changement de comportement runtime, juste fait marcher les variantes `dark:`.

---

## 1. Identité visuelle

Base actuelle (`tokens.css`) déjà bonne : charbon bleuté + ambre/cuivré, professionnel, pas générique-SaaS-bleu. On la **garde comme socle** et on ajoute ce qui manque pour "plus vivant/mémorable" sans la trahir :

### Palette (existant, confirmé)
- Surfaces : `--bg-0` → `--bg-4` (charbon `#07090d` → `#1c2230`, dark) / blancs cassés (light)
- Texte : `--text-1/2/3` + `--text-disabled`
- Accent marque : `--accent #d97706` (ambre), `--accent-bright #f59e0b`, `--accent-deep #b45309`
- États : `--success #10b981`, `--warning #f59e0b`, `--danger #ef4444`, `--info #3b82f6`

### Nouveau — accent IA secondaire
L'ambre reste la couleur "action/marque" (CTA, facture, argent). On introduit un **second accent violet électrique dédié à l'IA/Luca**, pour que toute surface IA soit immédiatement identifiable et distincte du reste du produit :

```css
--ai:        #7c5cff;  /* violet électrique */
--ai-bright: #9b7fff;
--ai-deep:   #5a3fd6;
--ai-soft:   rgba(124, 92, 255, 0.12);
--ai-glow:   0 0 32px rgba(124, 92, 255, 0.35);
```

Usage strict : bulle Luca, panneau chat, cartes de suggestion/recommandation IA, badges "généré par IA". Jamais utilisé pour de l'UI standard — ça préserve sa valeur de signal.

### Dégradés (nouveau, usage ponctuel)
```css
--grad-brand: linear-gradient(135deg, var(--accent) 0%, var(--accent-bright) 100%);
--grad-ai:    linear-gradient(135deg, var(--ai) 0%, var(--ai-bright) 100%);
--grad-hero:  linear-gradient(135deg, var(--bg-1) 0%, var(--bg-2) 60%, rgba(124,92,255,0.08) 100%);
```
Réservés aux moments premium : page de connexion, en-tête dashboard, bouton CTA principal, halo bulle Luca. Pas sur les boutons secondaires/tertiaires — sinon dilution.

### Contraste
Action Phase 2 concrète : auditer `--text-3` (`#5c6678` dark / `#7a8499` light) sur `--bg-2` en usage 10-11px → si sous 4.5:1, soit remonter la taille min à 12px pour ce ton, soit assombrir/éclaircir le token. À vérifier avec un outil de contraste avant Phase 5.

---

## 2. Typographie

Garder **Geist / Geist Mono** (déjà chargé, déjà appliqué en pratique, esthétique SaaS moderne cohérente avec la direction Vercel/Linear citée). **Supprimer** l'import Space Grotesk/Inter dans `index.css` (mort, jamais rendu, coût réseau gratuit à éliminer).

Échelle existante gardée telle quelle (`--fs-12` → `--fs-48`), on formalise les paires taille/graisse/usage :

| Token | Taille | Graisse | Usage |
|---|---|---|---|
| `--fs-12` | 12px | 400/500 | Labels, meta, badges |
| `--fs-13` | 13px | 400 | Texte secondaire, aide |
| `--fs-14` | 14px | 400 | Corps par défaut |
| `--fs-16` | 16px | 400/500 | Corps important, inputs |
| `--fs-18` | 18px | 600 | Titres de carte |
| `--fs-20` | 20px | 600 | Titres de section |
| `--fs-24` | 24px | 600/700 | Titres de page |
| `--fs-30/36` | 30/36px | 700 | KPI chiffrés (dashboard) |
| `--fs-48` | 48px | 700 | Hero (login) |

Règle : sous 12px interdit (a11y). `--text-3` réservé au texte non essentiel uniquement.

---

## 3. Espacements

Formaliser une échelle 4px déjà implicite dans le code, en tokens nommés (actuellement valeurs px en dur partout) :

```css
--sp-1: 4px;  --sp-2: 8px;  --sp-3: 12px; --sp-4: 16px;
--sp-5: 20px; --sp-6: 24px; --sp-7: 32px; --sp-8: 48px; --sp-9: 64px;
```

Grille : padding carte = `--sp-4` (mobile) / `--sp-6` (desktop). Gap listes/kanban = `--sp-3`. Marge sections page = `--sp-6`/`--sp-8`.

---

## 4. Composants — règles d'uniformisation

Un seul composant par rôle, construit sur primitives shadcn restylées avec les tokens ci-dessus (pas de 2e lib parallèle) :

| Composant | Source à garder | Action |
|---|---|---|
| Button | `components/ui/button.tsx` (shadcn) | Remapper variants sur tokens, absorber styles `primitives.tsx` Button (poids visuel actuel plus travaillé) |
| Card | `components/ui/card.tsx` | Idem, garder ombre `--shadow-2`, radius `--r-4` |
| Badge/Pill statut | Un seul composant `StatusBadge` | Fusionner `Badge` shadcn + `Pill` primitives + les 4 status-color-maps dupliqués (`Assistant.tsx`, `Relances.tsx`, `Echeancier.tsx`, `Index.tsx`) en une seule table `--status-draft/sent/late/paid` déjà dans tokens.css |
| Input | `components/ui/input.tsx` | Garder label explicite `htmlFor`/`id`, standardiser sur ce pattern partout |
| Table | `components/ui/table.tsx` | Pas de changement identifié, garder |
| Empty state | **Nouveau** `<EmptyState icon title description action? />` | Remplace 5+ implémentations ad hoc |
| Loading | **Nouveau** `<Skeleton />` généralisé (déjà défini dans `tokens.css:189-194`, sous-utilisé) | Remplace texte "Chargement…" et `Loader2` mélangés |
| Dialog/Sheet | `components/ui/dialog.tsx` + `sheet.tsx` | Pas de changement identifié |
| Icônes | **lucide-react uniquement** | `Icon.tsx` custom supprimé, migration mécanique (viewBox compatible déjà noté dans audit) |
| Graphiques | À définir Phase 5 selon lib utilisée (recharts?) | Palette : `--accent` pour série principale, `--info`/`--success` pour comparaisons, jamais plus de 4 couleurs par graphique |
| Composants IA | **Nouveau** pattern `<AiCard variant="suggestion\|insight\|action">` | Bordure/glow `--ai`, badge "Luca suggère", réutilisé dans dashboard + Luca panel + futures suggestions inline |

---

## 4bis. Mobile-first — règles (Phase 4)

Vérification terrain (`Invoices.tsx`/`InvoiceFilters.tsx`, `Echeancier.tsx`, `Previsionnel.tsx`, `BottomNav.tsx`) : le mobile-first est **déjà globalement respecté** dans le code existant, contrairement à l'intuition initiale. Pattern confirmé à généraliser en Phase 5 :

- **CTA principal** : bouton pleine largeur, ancré en haut de l'écran (pas de FAB flottant qui masquerait du contenu ou entrerait en collision avec la bulle Luca). Vu dans `InvoiceFilters.tsx:50-61` (46px de haut), `Echeancier.tsx:253`. **Référence à répliquer** sur tout écran Phase 5 qui ne le fait pas encore.
- **Layout mobile** : `flexDirection: column`, `alignItems: stretch` pour empiler header/actions/filtres en colonne pleine largeur — pattern déjà présent, à garder.
- **Zone de pouce** : bulle Luca à `bottom: 72px` sur mobile (`LucaBubble.tsx`) — dégagée des 56px de la BottomNav, pas de collision. OK, ne pas modifier.
- **Cible tactile min** : 44px recommandé pour actions isolées ; CTA pleine largeur déjà à 46px (conforme). Chips de filtre à 34px — acceptable en groupe serré (risque de mis-tap faible, espacement suffisant), pas prioritaire à corriger.
- **Seuil unique 768px** (`use-mobile.tsx`) — fonctionne, gardé tel quel (pas de régression à risquer pour un refactor container-queries non demandé).

**Dette identifiée, non bloquante** : très faible densité de préfixes Tailwind `sm:/md:/lg:` (15 occurrences totales) — le responsive est piloté par branches JS `isMobile ? A : B` plutôt que par CSS. Ça marche et c'est déjà cohérent d'un écran à l'autre pour les patterns vérifiés, donc **pas de réécriture globale** — à surveiller au cas par cas lors de la refonte Phase 5 si un écran spécifique s'avère mal géré à la marge (ex. tablette 768-1024px, zone actuellement collapsée côté desktop).

## 5. Identité produit (Phase 3 — aperçu, pas encore implémenté)

Unifier `/assistant` (fil signaux) et Luca (chat) sous une seule identité IA cohérente — même nom, même avatar, même accent `--ai`. Le badge "IA" (`--ai` + `--grad-ai`) devient un signal reconnu dans toute l'app : suggestions inline sur Factures/Clients, pas seulement dans le panneau chat.

---

## Prochaine étape

Implémenter la consolidation technique (fondation, zéro changement d'écran visible) :
1. Fix `darkMode` strategy dans `tailwind.config.ts`.
2. Ajouter tokens `--ai*`, `--grad-*`, `--sp-*` dans `tokens.css`.
3. Supprimer imports fonts morts (`index.css:1`).
4. Remapper `tailwind.config.ts` pour que les classes shadcn pointent vers `tokens.css` au lieu des HSL `index.css`.

Étape 4 = la plus risquée (touche toutes les classes `bg-primary`/`text-muted-foreground` etc. utilisées dans 40+ composants shadcn). À faire avec vérification visuelle avant/après, pas en une seule passe aveugle.

Go pour lancer ces 4 points ?
