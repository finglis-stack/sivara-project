# TOME 5 : DESIGN SYSTEM ATOMIQUE
**CIBLE :** `tailwind.config.ts`, `src/globals.css`, `src/components/ui/*`

## 5.1. ARCHITECTURE "HEADLESS" (SHADCN/RADIX)

Sivara n'utilise pas de librairie de composants "boîte noire" (comme MUI).
*   **Radix UI :** Gère la logique (Accessibilité, Focus Trap, Clavier).
*   **Tailwind :** Gère le style.
*   **Code Source :** Les composants (Boutons, Dialogues) sont copiés dans `src/components/ui`. Nous avons le contrôle total sur leur code.

## 5.2. MOTEUR D'ANIMATION

Dans `tailwind.config.ts`, des animations complexes sont définies :
*   **`wave-undulate` :** Utilisé sur la page d'accueil Device pour l'effet "liquide". C'est une transformation CSS pure (GPU accelerated), pas de JS, garantissant 60fps même sur mobile.
*   **`accordion-down` :** Utilise des variables CSS pour animer la hauteur de `0` à `auto` (impossible en CSS standard sans hack).

## 5.3. TYPOGRAPHIE ET COULEURS

Le système utilise des variables CSS (`--primary`, `--muted`) définies en HSL.
*   Cela permet de changer le thème (Dark Mode) instantanément en modifiant quelques variables CSS, sans re-rendu React.
*   L'utilisation de HSL permet d'utiliser les classes d'opacité Tailwind (`bg-primary/50`).