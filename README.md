# MyBDE — application

Application mobile et web du réseau des bureaux des étudiants : actualités,
événements et billetterie d'un BDE, plus les écrans d'administration.

Construite avec [Expo](https://docs.expo.dev) (React Native + react-native-web)
et [expo-router](https://docs.expo.dev/router/introduction). L'API qui
l'alimente vit dans un dépôt séparé (`mybde-api`).

## Démarrer

```bash
npm install
```

```bash
cp .env.example .env.local
```

`EXPO_PUBLIC_API_URL` pointe par défaut sur `http://localhost:3000`, ce qui ne
fonctionne que sur simulateur ou navigateur. Pour un téléphone physique, il faut
l'IP locale du poste : voir [API_SETUP.md](API_SETUP.md).

```bash
npx expo start
```

| Commande | Effet |
|---|---|
| `npm run web` | ouvre la version navigateur |
| `npm run android` / `npm run ios` | ouvre sur émulateur ou appareil |
| `npm run lint` | ESLint |
| `npm test` | Jest |
| `npx tsc --noEmit` | vérification des types |

## Organisation

```
app/            routes (expo-router : un fichier = une URL)
  (auth)/       connexion, inscription — écrans publics
  (tabs)/       accueil, événements, billets, gestion, profil — écrans privés
  event/[id]    fiche d'un événement
  ticketing/    tunnel d'achat d'un billet
  info/[topic]  pages légales — publiques
components/     composants partagés (ui/ pour la brique de base)
context/        état applicatif (auth, dialogues, invalidation)
services/       accès API, stockage de session, formatage
hooks/          hooks réutilisables
constants/      thème, catégories d'événements
```

## Rôles

Trois rôles, portés par le compte et relus à chaque requête côté API :

- **`student`** — consulte les actus, achète des billets, rejoint un BDE via son
  code à 6 chiffres.
- **`admin_bde`** — administre les BDE dont il est membre administrateur :
  événements, actualités, membres, trésorerie. L'onglet Billets devient un outil
  de contrôle des présences.
- **`super_admin`** — supervise la plateforme : comptes, création de BDE,
  tableau de bord global. Il n'est membre d'aucun BDE, donc les onglets scopés
  aux BDE rejoints lui sont masqués. Il **consulte** la trésorerie d'un BDE mais
  ne peut pas en retirer les fonds : cet argent appartient à l'association, et
  l'API refuse le retrait à qui n'est pas administrateur de ce BDE.

## Conventions à connaître

Trois mécanismes transverses qu'il vaut mieux connaître avant de toucher aux
écrans, chacun corrigeant un problème qui se reproduit facilement.

### Écrans privés : `AuthGate`

Toute route privée est enveloppée dans [`AuthGate`](components/AuthGate.tsx),
qui affiche un indicateur pendant la restauration de session puis redirige vers
la connexion si elle est absente.

C'est indispensable parce que **chaque route est un point d'entrée** : sur le
web l'utilisateur recharge la page ou ouvre un lien partagé sans jamais passer
par `/`. Une redirection posée sur l'écran racine ne protège rien. Sans
barrière, l'écran s'affiche à vide — ni nom ni rôle, alors que les actions
restent visibles.

Le contenu est monté en un bloc (`<AuthGate><Écran /></AuthGate>`) plutôt que
court-circuité par un `return` anticipé à l'intérieur de l'écran : le nombre de
hooks appelés changerait d'un rendu à l'autre une fois la session restaurée.

Restent publics : `(auth)`, `info/[topic]` et `+not-found`.

### Fraîcheur des données : `markDirty` / `useRefreshWhenStale`

Les onglets d'expo-router **restent montés en arrière-plan**. Un `useEffect` de
montage ne se rejoue jamais : sans signal, un écran affiche indéfiniment les
données chargées à l'ouverture, et un compteur reste à zéro après la première
publication.

Toute écriture réussie appelle donc `markDirty()`
([TransitionContext](context/TransitionContext.tsx)), qui incrémente un compteur
`dataVersion`. Les écrans s'y abonnent via
[`useRefreshWhenStale(reload)`](hooks/use-refresh-when-stale.ts) : le
rechargement a lieu au retour au premier plan, ou immédiatement si l'écran est
déjà affiché.

En pratique : après une création ou une suppression, appelez `markDirty()` — pas
besoin de recharger la liste courante à la main, c'est inclus.

### Session : rotation du refresh token

L'API révoque le refresh token dès qu'il est consommé. Comme tous les écrans
montés appellent l'API en parallèle, ils reçoivent leurs 401 ensemble : envoyer
le même refresh token depuis chaque appel ferait invalider par la première
rotation celui que les autres s'apprêtent à utiliser, et la session serait
effacée alors qu'elle est valide.

[`services/api.ts`](services/api.ts) mutualise donc les tentatives — une seule
rotation à la fois — et rejoue simplement les requêtes parties avant un
renouvellement. À conserver en cas de refonte de la couche réseau.

## Tests

```bash
npm test
```

Jest (`jest-expo`) et `@testing-library/react-native`. Les tests couvrent la
couche API (mapping, auto-refresh, concurrence), le stockage de session, les
contextes et quelques composants sensibles. Les fichiers vivent dans un
`__tests__/` à côté du code testé.

## Déploiement

- **Web** : `Dockerfile` à la racine — export Expo statique servi par nginx
  (`nginx.conf`), déployé par Coolify. `EXPO_PUBLIC_API_URL` est un `ARG` de
  build : la valeur est figée dans le bundle, un changement impose une
  reconstruction.
- **Mobile** : EAS Build (`eas.json`). Les variables y sont déclarées par
  profil ; `.env.local` n'est pas transmis au service de build.
