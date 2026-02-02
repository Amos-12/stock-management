

# Correction du chevauchement avec la barre d'état Android

## Problème identifié

La barre de menu de l'application s'étend jusqu'à la zone de la barre d'état du téléphone (où se trouvent la batterie, l'heure, et les icônes système), ce qui rend le contenu difficile à lire.

## Solution proposée

### 1. Installer le plugin Capacitor Status Bar

Ajouter le plugin `@capacitor/status-bar` pour contrôler le comportement de la barre d'état sur Android.

### 2. Configurer le Status Bar dans l'application

Modifier `src/App.tsx` pour :
- Initialiser le plugin Status Bar au démarrage
- Désactiver le mode "overlay" (la barre d'état ne sera plus transparente/superposée)

### 3. Ajouter les styles CSS pour les "Safe Areas"

Modifier `src/index.css` et `index.html` pour :
- Ajouter `viewport-fit=cover` dans le meta viewport
- Utiliser les variables CSS `env(safe-area-inset-*)` pour le padding

### 4. Modifier le layout principal

Mettre à jour `src/components/Layout/ResponsiveDashboardLayout.tsx` pour :
- Ajouter un padding-top qui respecte la safe area du téléphone
- Assurer que le header fixe ne chevauche pas la barre d'état

### 5. Configurer le thème Android

Modifier `android/app/src/main/res/values/styles.xml` pour :
- Configurer la barre d'état en mode non-transparent
- Définir une couleur de fond pour la barre d'état

---

## Détails techniques

### Fichiers à modifier

| Fichier | Modification |
|---------|-------------|
| `package.json` | Ajouter `@capacitor/status-bar` |
| `src/App.tsx` | Initialiser StatusBar au démarrage |
| `index.html` | Ajouter `viewport-fit=cover` |
| `src/index.css` | Ajouter styles safe-area |
| `ResponsiveDashboardLayout.tsx` | Utiliser padding safe-area |
| `styles.xml` (Android) | Configurer status bar |

### Code Status Bar (App.tsx)

```typescript
import { StatusBar, Style } from '@capacitor/status-bar';
import { Capacitor } from '@capacitor/core';

// Au démarrage de l'app
if (Capacitor.isNativePlatform()) {
  StatusBar.setOverlaysWebView({ overlay: false });
  StatusBar.setBackgroundColor({ color: '#26A69A' });
}
```

### CSS Safe Area

```css
:root {
  --safe-area-inset-top: env(safe-area-inset-top, 0px);
}

.pt-safe {
  padding-top: var(--safe-area-inset-top);
}
```

---

## Étapes après la modification

1. **Reconstruire le projet** :
   ```bash
   npm install
   npm run build
   ```

2. **Synchroniser avec Android** :
   ```bash
   npx cap sync android
   ```

3. **Générer un nouvel APK** pour tester la correction

