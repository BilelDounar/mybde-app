# Connexion API Mobile

## iOS/Android Physique → API Backend

Par défaut, l'application utilise `localhost:3000` qui fonctionne uniquement sur le simulateur.

### Pour un vrai appareil (iPhone/Android physique)

#### 1. Trouver l'IP de votre PC

**Windows :**
```powershell
ipconfig
```
Cherchez `Adresse IPv4` sous votre carte WiFi (ex: `192.168.1.42`)

**Mac :**
```bash
ifconfig | grep "inet "
```

#### 2. Configuration

```bash
# Copiez le fichier d'exemple
cp .env.example .env.local

# Modifiez .env.local avec votre IP
EXPO_PUBLIC_API_URL=http://192.168.1.42:3000  # Remplacez par votre IP
```

#### 3. Redémarrer Expo

```bash
npx expo start -c
```

#### 4. Prérequis réseau

- 📱 Téléphone et 💻 PC sur le **même WiFi**
- 🔥 Firewall Windows autorisant le port 3000

---

## Dépannage

### "Network Error" sur l'app

| Cause | Solution |
|-------|----------|
| Mauvaise IP | Revérifiez avec `ipconfig` |
| Firewall | Autoriser Node.js dans le pare-feu |
| Pas même WiFi | Connectez les deux appareils au même réseau |

### Tester rapidement

```bash
# Sur votre PC
curl http://192.168.1.42:3000/health

# Devrait retourner : {"status":"ok"}
```

---

## Ngrok (alternative publique)

Pour partager avec d'autres appareils sans config réseau :

```bash
npx ngrok http 3000
```

Copiez l'URL HTTPS dans `.env.local` :
```
EXPO_PUBLIC_API_URL=https://xxxx.ngrok-free.app
```
