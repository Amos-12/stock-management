
# Correction définitive des Safe Areas Android

## Diagnostic du problème

L'application s'affiche en mode "edge-to-edge" (bord à bord) sous Android, ce qui signifie que le contenu passe sous la barre d'état et les boutons de navigation. Les modifications CSS avec `env(safe-area-inset-*)` ne fonctionnent pas car :

1. **Le thème utilisé par l'activité** (`AppTheme.NoActionBarLaunch`) ne configure pas les barres système
2. **Android WebView n'expose pas automatiquement** les valeurs `env(safe-area-inset-*)` comme iOS Safari
3. **La configuration Capacitor** ne force pas le mode non-overlay pour les barres système

---

## Solution en plusieurs étapes

### Étape 1 : Modifier le fichier `capacitor.config.ts`

Ajouter une configuration pour forcer Android à ne pas afficher le contenu sous les barres système :

```typescript
const config: CapacitorConfig = {
  appId: 'com.SM.app',
  appName: 'SM - System Management',
  webDir: 'dist',
  android: {
    backgroundColor: '#26A69A'
  },
  plugins: {
    StatusBar: {
      overlaysWebView: false,
      backgroundColor: '#26A69A',
      style: 'LIGHT'
    }
  }
};
```

### Étape 2 : Créer un fichier `styles.xml` pour API 28+

Créer `android/app/src/main/res/values-v28/styles.xml` pour les appareils Android 9+ avec configuration des encoches (notch) :

```xml
<?xml version="1.0" encoding="utf-8"?>
<resources>
    <style name="AppTheme.NoActionBar" parent="Theme.AppCompat.DayNight.NoActionBar">
        <item name="windowActionBar">false</item>
        <item name="windowNoTitle">true</item>
        <item name="android:background">@null</item>
        <item name="android:statusBarColor">@color/colorPrimaryDark</item>
        <item name="android:navigationBarColor">@color/colorPrimaryDark</item>
        <item name="android:windowDrawsSystemBarBackgrounds">true</item>
        <item name="android:windowLayoutInDisplayCutoutMode">never</item>
    </style>

    <style name="AppTheme.NoActionBarLaunch" parent="AppTheme.NoActionBar">
        <item name="android:background">@drawable/splash</item>
    </style>
</resources>
```

### Étape 3 : Modifier le fichier `styles.xml` principal

Mettre à jour `android/app/src/main/res/values/styles.xml` pour que `AppTheme.NoActionBarLaunch` hérite de `AppTheme.NoActionBar` au lieu de `Theme.SplashScreen` :

```xml
<?xml version="1.0" encoding="utf-8"?>
<resources>
    <style name="AppTheme" parent="Theme.AppCompat.Light.DarkActionBar">
        <item name="colorPrimary">@color/colorPrimary</item>
        <item name="colorPrimaryDark">@color/colorPrimaryDark</item>
        <item name="colorAccent">@color/colorAccent</item>
    </style>

    <style name="AppTheme.NoActionBar" parent="Theme.AppCompat.DayNight.NoActionBar">
        <item name="windowActionBar">false</item>
        <item name="windowNoTitle">true</item>
        <item name="android:background">@null</item>
        <item name="android:statusBarColor">@color/colorPrimaryDark</item>
        <item name="android:navigationBarColor">@color/colorPrimaryDark</item>
        <item name="android:windowDrawsSystemBarBackgrounds">true</item>
        <item name="android:fitsSystemWindows">true</item>
    </style>

    <style name="AppTheme.NoActionBarLaunch" parent="AppTheme.NoActionBar">
        <item name="android:background">@drawable/splash</item>
    </style>
</resources>
```

L'ajout de `android:fitsSystemWindows` forcera le système à ajuster le layout pour ne pas passer sous les barres.

### Étape 4 : Modifier le layout Android principal

Modifier `android/app/src/main/res/layout/activity_main.xml` pour ajouter `fitsSystemWindows` :

```xml
<?xml version="1.0" encoding="utf-8"?>
<androidx.coordinatorlayout.widget.CoordinatorLayout 
    xmlns:android="http://schemas.android.com/apk/res/android"
    android:layout_width="match_parent"
    android:layout_height="match_parent"
    android:fitsSystemWindows="true">
    
    <!-- Capacitor WebView content -->
</androidx.coordinatorlayout.widget.CoordinatorLayout>
```

### Étape 5 : Mettre à jour `MainActivity.java`

Ajouter du code Java pour forcer la configuration des barres système au démarrage :

```java
package com.SM.app;

import android.os.Build;
import android.os.Bundle;
import android.view.View;
import android.view.Window;
import android.view.WindowManager;
import androidx.core.view.WindowCompat;
import com.getcapacitor.BridgeActivity;

public class MainActivity extends BridgeActivity {
    @Override
    protected void onCreate(Bundle savedInstanceState) {
        super.onCreate(savedInstanceState);
        
        // Désactiver le mode edge-to-edge
        WindowCompat.setDecorFitsSystemWindows(getWindow(), true);
        
        // Configurer les couleurs des barres système
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.LOLLIPOP) {
            Window window = getWindow();
            window.clearFlags(WindowManager.LayoutParams.FLAG_TRANSLUCENT_STATUS);
            window.addFlags(WindowManager.LayoutParams.FLAG_DRAWS_SYSTEM_BAR_BACKGROUNDS);
            window.setStatusBarColor(getResources().getColor(R.color.colorPrimaryDark));
            window.setNavigationBarColor(getResources().getColor(R.color.colorPrimaryDark));
        }
    }
}
```

### Étape 6 : Simplifier le CSS

Retirer les safe-area insets du CSS car ils ne sont plus nécessaires avec la configuration native correcte :

Dans `ResponsiveDashboardLayout.tsx` :
- Header : `top-0` avec une hauteur fixe de 64px
- Conteneur principal : `pt-16` (64px) au lieu de `pt-[calc(64px+var(--safe-area-inset-top,0px))]`

---

## Fichiers à modifier

| Fichier | Action |
|---------|--------|
| `capacitor.config.ts` | Modifier - Ajouter configuration StatusBar |
| `android/app/src/main/res/values/styles.xml` | Modifier - Ajouter fitsSystemWindows |
| `android/app/src/main/res/values-v28/styles.xml` | Créer - Configuration pour Android 9+ |
| `android/app/src/main/res/layout/activity_main.xml` | Modifier - Ajouter fitsSystemWindows |
| `android/app/src/main/java/com/SM/app/MainActivity.java` | Modifier - Désactiver edge-to-edge |
| `src/components/Layout/ResponsiveDashboardLayout.tsx` | Modifier - Simplifier les paddings |
| `src/pages/Auth.tsx` | Modifier - Simplifier les paddings |
| `src/pages/Index.tsx` | Modifier - Simplifier les paddings |

---

## Étapes après les modifications

1. **Récupérer les modifications** via git pull

2. **Reconstruire le projet** :
   ```bash
   npm run build
   ```

3. **Synchroniser avec Android** :
   ```bash
   npx cap sync android
   ```

4. **Générer un nouvel APK** via Android Studio

5. **Tester** sur un appareil Android pour vérifier que :
   - Le contenu ne passe pas sous la barre d'état
   - Le contenu ne passe pas sous les boutons de navigation
   - Les barres système ont la couleur de l'app (#26A69A / #1E8A7E)
