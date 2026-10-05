# Fuente única de producción

`portable-export/` es la única aplicación de VIP Remesas que se compila y publica en Cloudflare.

## Regla

- Todo cambio funcional destinado a `vipremesas.com` debe hacerse en `portable-export/`.
- `.github/workflows/main.yml` compila exclusivamente `portable-export/` y no tiene fallback al código raíz.
- `.github/workflows/android-apk.yml` también usa exclusivamente `portable-export/`.
- El código histórico que permanezca fuera de `portable-export/` no es fuente de producción y no debe recibir correcciones de la app.

## Recuperación

Antes de esta consolidación se guardó la rama `stable/pre-single-source-20261005`, que conserva exactamente el estado de producción previo a este cambio.
