# Product

<!-- impeccable:product-schema 1 -->

## Platform

web

## Users

- **Évaluateurs (agents DSM TAMIS)** : notent leurs collègues affectés, majoritairement sur PC au bureau, pendant une fenêtre de campagne courte.
- **Managers** : notent leurs collaborateurs ; leur note pèse différemment (pondération collègues / manager définie par campagne).
- **Administrateurs** : gèrent campagnes, critères, sites, utilisateurs et consultent le classement.

## Product Purpose

Plateforme interne de notation de la performance des agents de la Direction des Solutions Maritimes (DSM TAMIS). Succès : chaque évaluateur complète toutes ses notations dans la fenêtre de campagne, sans erreur ni abandon, et l'administration obtient un classement fiable.

## Operating Context

- Campagnes périodiques avec liste d'affectations par évaluateur (triées par nom).
- Notation critère par critère, sur un barème d'appréciations (`getAppreciationOptions`), commentaire optionnel.
- Brouillon sauvegardable, puis soumission finale **définitive et irréversible**.
- Accès aussi possible via QR code (`/qr`).

## Capabilities and Constraints

- Next.js (App Router), Tailwind CSS v4, lucide-react ; déploiement Vercel.
- Auto-évaluation strictement interdite.
- Les critères se débloquent dans l'ordre ; les collaborateurs aussi.
- Langue de l'interface : français.

## Brand Commitments

- Nom : DSM TAMIS — Direction des Solutions Maritimes.
- Charte obligatoire : Navy `#002B49` + Or `#D4AF37`. À conserver.

## Evidence on Hand

- Aucun logo officiel fourni dans le dépôt ; ne pas en inventer.
- Pas de témoignages ni de chiffres marketing à fabriquer.

## Product Principles

1. Terminer la notation vite et sans erreur prime sur l'effet visuel.
2. L'irréversibilité de la soumission doit toujours être claire.
3. L'évaluateur sait à tout moment où il en est (collègue, critère, progression).
4. Sobriété institutionnelle : la marque vit dans les détails, pas dans la décoration.
