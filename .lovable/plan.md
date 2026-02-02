

# Correction de la redirection vers la page web

## Problème identifié

L'application Android redirige vers la page web parce que la configuration Capacitor contient une URL de serveur de développement :

```typescript
server: {
  url: 'https://964f3753-4441-40ac-acf5-cd66e737e71f.lovableproject.com?forceHideBadge=true',
  cleartext: true
}
```

Cette configuration indique à l'application d'afficher le contenu depuis cette URL distante au lieu d'utiliser les fichiers HTML/JS/CSS inclus directement dans l'APK.

## Solution proposée

Supprimer la section `server` de la configuration Capacitor pour que l'application utilise les fichiers locaux (`dist/`) intégrés dans l'APK.

### Modification du fichier `capacitor.config.ts`

**Avant :**
```typescript
const config: CapacitorConfig = {
  appId: 'com.SM.app',
  appName: 'SM - System Management',
  webDir: 'dist',
  server: {
    url: 'https://964f3753-4441-40ac-acf5-cd66e737e71f.lovableproject.com?forceHideBadge=true',
    cleartext: true
  }
};
```

**Après :**
```typescript
const config: CapacitorConfig = {
  appId: 'com.SM.app',
  appName: 'SM - System Management',
  webDir: 'dist'
};
```

## Étapes après la modification

1. **Reconstruire le projet** :
   ```bash
   npm run build
   ```

2. **Synchroniser avec Android** :
   ```bash
   npx cap sync android
   ```

3. **Générer un nouvel APK** via Android Studio ou en ligne de commande

## Note technique

- **Mode développement** : Si vous avez besoin du hot-reload pendant le développement, vous pouvez réactiver temporairement la section `server` avec votre URL locale
- **Mode production** : Pour l'APK final, cette section doit être absente afin que l'application fonctionne de manière autonome, même sans connexion internet (sauf pour les appels API vers Supabase)

