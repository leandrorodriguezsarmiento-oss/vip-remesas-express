# Apps Android e iPhone

La app móvil envuelve el sitio publicado con Capacitor. Ventaja: cuando
actualizas la web (push a `main`), **las apps ya instaladas se actualizan solas**.
Solo vuelves a subir la app a las tiendas si cambias el icono, el nombre o los permisos.

## 1. Preparar
```bash
bun install
export PUBLIC_SITE_URL=https://tudominio.com
bun run mobile:add     # crea las carpetas android/ e ios/
bun run mobile:sync
```

## 2. Android (Play Store)
```bash
bun run mobile:android   # abre Android Studio
```
- Build > Generate Signed App Bundle (.aab) con tu keystore (guárdalo fuera de Git).
- Sube el .aab a Play Console. Cada nueva versión: sube `versionCode` en `android/app/build.gradle`.
- Alternativa sin Capacitor: TWA con `@bubblewrap/cli` (ver README-DESPLIEGUE.md).

## 3. iPhone (App Store)
```bash
bun run mobile:ios       # abre Xcode (requiere Mac)
```
- Cuenta de Apple Developer, luego Product > Archive > Distribute App.
- Sube `CFBundleVersion` en cada actualización.

## 4. Notificaciones push en las apps
El sitio ya usa Web Push. En Android funciona dentro del envoltorio; en iOS,
si quieres push nativo, añade `@capacitor/push-notifications` + Firebase/APNs.
