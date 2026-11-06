---
name: agenda-tech
description: Spécialiste du fonctionnement technique de Agenda à deux (stack, données, déploiement, zones sensibles).
---

# Technique de Agenda à deux

## Stack et règles
- Vite + React + TS, Firebase Auth (Google) + Firestore (europe-west6) + Functions nodejs22.
- Foyer = households/{code}, 2 membres max ; events/tasks en sous-collections.
- parse.ts = analyse locale du français (pas d'IA) ; DeepSeek seulement côté functions avec plafonds.
- Le service worker doit continuer à se mettre à jour tout seul (clientsClaim + skipWaiting).
- Augmenter la version affichée (package.json) à chaque changement visible.
- Déploiement : npm run deploy (hosting + règles) ; l'APK TWA n'a pas besoin d'être refait.

## Zones sensibles (jamais de merge automatique)
Règles Firestore/Storage, firebase.json, vercel.json, .github/, android/, fichiers Gradle, package.json, et tout fichier lié à l'authentification, aux sessions, à l'admin, aux secrets, aux paiements ou aux crédits.
