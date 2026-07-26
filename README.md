# MyBDE — Application

Application mobile et web du projet **MyBDE** (gestion de Bureau des Étudiants), développée avec **React Native** et **Expo**. Elle consomme l'API MyBDE (dépôt `mybde-api`).

## Démarrage

```bash
npm install
cp .env.example .env.local     # renseigner l'URL de l'API
npx expo start                 # web, iOS, Android
```

## Tests et qualité

```bash
npm test        # Jest + React Native Testing Library
npm run lint    # ESLint (expo lint)
```

## Configuration de l'API

Voir [`API_SETUP.md`](API_SETUP.md) pour connecter l'application à l'API selon le contexte (simulateur, appareil physique, production).

## Structure

```
app/          Écrans et navigation (Expo Router, file-based)
components/    Composants d'interface réutilisables
context/       État global (authentification, modales)
services/      Client API, stockage de session, formatage
constants/     Thème (couleurs, tailles, espacements)
types/         Types TypeScript partagés
```
