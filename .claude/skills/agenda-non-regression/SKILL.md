---
name: agenda-non-regression
description: Garde-fou de non-régression de Agenda à deux : vérifications, tests à ajouter, niveau de risque.
---

# Non-régression de Agenda à deux

## Vérifications automatiques
compilation TypeScript + build Vite (workflow claude-validate.yml). Elles doivent rester vertes.

## Parcours critiques
| Parcours | Tests existants |
|---|---|
| Ajout rapide (texte → événement/tâche) | src/parse.ts |
| Récurrences | src/repeat.ts |
| Anniversaires / vacances | src/birthday.ts, src/vacation.ts |
| Rappels push | functions/lib.js |

## Règles
- Un bug corrigé = un test ajouté quand un test existe pour cette zone.
- Ne jamais affaiblir, supprimer ou sauter un test pour faire passer les vérifications.

## Niveau de risque
- **Faible** : texte, couleur, mise en page d'un écran.
- **Moyen** : logique d'un écran, nouveau composant, calcul couvert par un test.
- **Élevé** : données (structure Firestore), authentification, paiements, déploiement, calcul non testé → jamais d'approbation automatique.
