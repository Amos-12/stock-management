

# Correction définitive de l'affichage Android - Safe Areas

## Problème diagnostiqué

Sur la capture d'écran, on voit clairement que :
1. La barre de menu (header) passe sous les icônes de la barre d'état du téléphone (batterie, signal, etc.)
2. Le contenu ne respecte pas la zone de sécurité du haut de l'écran

Les configurations natives précédentes (`fitsSystemWindows`, `WindowCompat.setDecorFitsSystemWindows`) ne fonctionnent pas car **Capacitor 7 avec `core-splashscreen` force le mode edge-to-edge** et gère son propre WebView indépendamment de nos configurations de layout XML.

## Solution proposée

La solution consiste à utiliser une **approche hybride** :

### 1. Injecter un JavaScript pour détecter la hauteur de la barre d'état

Créer un script qui détecte la hauteur réelle de la barre d'état via Capacitor et l'applique comme variable CSS.

### 2. Modifier le layout React pour utiliser cette variable

Le header et le conteneur principal utiliseront une variable CSS dynamique `--status-bar-height` au lieu de valeurs fixes.

### 3. Alternative plus robuste : utiliser le plugin Capacitor Safe Area

Installer `@aashu-dubey/capacitor-statusbar-safe-area` qui expose correctement les insets de la barre d'état au web.

---

## Approche retenue : Solution native + CSS fallback

### Étape 1 : Créer un hook React pour détecter la safe area

Créer un nouveau hook `useSafeArea.ts` qui :
- Détecte si on est sur une plateforme native
- Récupère la hauteur de la barre d'état via le plugin StatusBar
- Applique une variable CSS `--safe-area-top` au document

### Étape 2 : Modifier le CSS global

Dans `src/index.css`, définir une variable CSS avec un fallback :

```css
:root {
  --safe-area-top: 0px;
  --safe-area-bottom: 0px;
}

/* Fallback pour iOS */
@supports (padding-top: env(safe-area-inset-top)) {
  :root {
    --safe-area-top: env(safe-area-inset-top);
    --safe-area-bottom: env(safe-area-inset-bottom);
  }
}
```

### Étape 3 : Modifier App.tsx pour définir la safe area Android

Ajouter du code pour détecter la hauteur de la barre d'état et l'appliquer :

```typescript
import { Capacitor } from "@capacitor/core";
import { StatusBar } from "@capacitor/status-bar";

const configureStatusBar = async () => {
  if (Capacitor.isNativePlatform()) {
    try {
      await StatusBar.setOverlaysWebView({ overlay: false });
      await StatusBar.setBackgroundColor({ color: '#26A69A' });
      
      // Get status bar info and set CSS variable
      const info = await StatusBar.getInfo();
      if (info && typeof info.height === 'number') {
        document.documentElement.style.setProperty('--safe-area-top', `${info.height}px`);
      } else {
        // Fallback for Android - typical status bar height is 24-32dp
        document.documentElement.style.setProperty('--safe-area-top', '28px');
      }
    } catch (error) {
      console.error('Error configuring status bar:', error);
      // Fallback
      document.documentElement.style.setProperty('--safe-area-top', '28px');
    }
  }
};
```

### Étape 4 : Modifier ResponsiveDashboardLayout.tsx

Mettre à jour les classes CSS pour utiliser la variable safe area :

**Header** :
```tsx
<header className="... fixed top-[var(--safe-area-top,0px)] left-0 right-0 z-50">
```

**Container principal** :
```tsx
<div className="min-h-screen ... pt-[calc(64px+var(--safe-area-top,0px))]">
```

**Sidebar Desktop** :
```tsx
<aside className="... fixed left-0 top-[calc(64px+var(--safe-area-top,0px))] h-[calc(100vh-64px-var(--safe-area-top,0px))]">
```

### Étape 5 : Modifier Auth.tsx et Index.tsx

Ajouter les safe areas aux pages d'authentification et d'accueil.

---

## Fichiers à modifier

| Fichier | Action |
|---------|--------|
| `src/index.css` | Ajouter variables CSS safe-area avec fallback |
| `src/App.tsx` | Configurer la variable CSS depuis Capacitor |
| `src/components/Layout/ResponsiveDashboardLayout.tsx` | Utiliser les variables safe-area |
| `src/pages/Auth.tsx` | Utiliser les variables safe-area |
| `src/pages/Index.tsx` | Utiliser les variables safe-area |

---

## Détails techniques

### Variables CSS

```css
:root {
  --safe-area-top: 0px;
  --safe-area-bottom: 0px;
}
```

Ces variables seront :
1. Définies à `0px` par défaut (navigateur web)
2. Mises à jour dynamiquement par JavaScript sur Android
3. Ou utiliseront `env(safe-area-inset-top)` sur iOS via `@supports`

### Layout responsive avec safe areas

```text
┌─────────────────────────────────┐
│      Status Bar (système)       │ ← Zone protégée (--safe-area-top)
├─────────────────────────────────┤
│         Header (64px)           │ ← Commence APRÈS la safe area
├─────────────────────────────────┤
│                                 │
│         Contenu                 │ ← pt-[calc(64px+var(--safe-area-top))]
│                                 │
├─────────────────────────────────┤
│   Boutons Navigation (système)  │ ← Zone protégée (--safe-area-bottom)
└─────────────────────────────────┘
```

---

## Étapes après les modifications

1. **Récupérer les modifications** : `git pull`

2. **Reconstruire le projet** :
   ```bash
   npm run build
   ```

3. **Synchroniser avec Android** :
   ```bash
   npx cap sync android
   ```

4. **Générer un nouvel APK** via Android Studio

5. **Tester** sur votre téléphone Android pour vérifier :
   - Le header ne passe plus sous la barre d'état
   - Le contenu est décalé correctement
   - Les boutons de navigation du bas ne cachent pas le contenu

