# Agenda à deux

Agenda et listes de tâches partagés à deux : une application web installable (PWA) sur les deux téléphones, synchronisée en temps réel.

- **Aujourd'hui** : rendez-vous du jour, tâches du jour, progression.
- **À venir** : semaine, 7 prochains jours groupés.
- **Listes** : Maison, Courses, Enfants, Admin & papiers, avec filtre par personne.
- **Mois** : calendrier, détail du jour, « qui fait quoi cette semaine ».
- **Ajout rapide** : on écrit ou on dicte « Appeler la crèche mardi 10h pour Karin », l'app remplit la date, l'heure, la personne et la liste (analyse locale, sans IA).

## Stack

Vite + React + TypeScript, Firebase Auth (Google), Firestore (cache hors ligne), Firebase Hosting.

## Développer

```bash
npm install
npm run dev
```

## Déployer

```bash
npm run deploy   # build + firebase deploy (hosting + règles Firestore)
```

Production : https://agenda-a-deux-dm.web.app

## Premier lancement

1. La première personne se connecte avec Google et crée l'agenda : un code à 8 caractères s'affiche.
2. La seconde personne se connecte et entre ce code. Un agenda accepte deux membres.
