
Voy a completar la app en 4 bloques. Cada bloque queda funcional antes de pasar al siguiente.

## 1. Tema claro (verde / azul / blanco)

- Reescribir `src/styles.css`: fondo blanco, superficies muy claras, texto oscuro legible.
- Nueva paleta:
  - Primario (verde): `#10B981` (esmeralda)
  - Acento (azul): `#2563EB` (azul brillante)
  - Fondo: `#FFFFFF`, superficie: `#F8FAFC`, texto: `#0F172A`, muted: `#64748B`
  - Gradientes suaves verde→azul para hero y botones principales
- Eliminar clases `text-gold`, `bg-gradient-vip`, `bg-gradient-gold` — se reemplazan por tokens `bg-primary`, `bg-accent`, `bg-gradient-brand`, `text-primary`.
- Ajustar landing, dashboard, auth, admin, send, history para el nuevo contraste (blanco con bordes claros, sombras suaves).

## 2. Solo Leandro puede ser admin

- Añadir constraint / trigger que impida `INSERT` en `user_roles` con `role = 'admin'` para cualquier usuario cuyo email no sea `leandrorodriguezsarmiento@gmail.com`.
- Eliminar cualquier rol admin existente que no sea de ese email.
- El panel `/admin` sigue redirigiendo a `/dashboard` si el usuario no tiene rol admin (ya implementado).

## 3. Banners desde admin (carrusel al abrir la app)

- **Storage:** bucket público `banners`.
- **Tabla `banners`:** `image_url`, `title`, `link_url`, `active`, `sort_order`.
- **Nueva pestaña "Banners"** en `/admin` para subir imagen, título opcional, link opcional, activar/desactivar y ordenar.
- **En el Dashboard:** carrusel automático (rota cada 4s) mostrando todos los banners activos. Si no hay ninguno, se oculta.

## 4. MercadoPago (Checkout Pro — genera link con el total)

- **Secret necesario:** `MERCADOPAGO_ACCESS_TOKEN` (te lo pediré al terminar el rediseño).
- Server function `createMpPreference` que:
  1. Recibe el ID de la transacción del usuario autenticado.
  2. Crea una `preference` en MercadoPago con `items` = total en BRL, `external_reference` = tx id, `notification_url` = webhook público.
  3. Devuelve `init_point` (URL de pago).
- Cuando el usuario llega al último paso de la remesa, aparece botón **"Pagar con MercadoPago"** que abre el `init_point`.
- Server route público `/api/public/mercadopago/webhook` que:
  1. Recibe el `payment.updated`.
  2. Consulta el pago vía API con el access token.
  3. Marca la transacción como `processing` cuando `status = approved` (no como `completed`, para respetar tu flujo de que tú das el visto final).

## 5. EmailJS (notificaciones)

EmailJS está pensado para envío desde el navegador. Es correcto para avisos al usuario, no para "recibir correos". Confirmaré contigo, pero asumo que quieres:
- Al **crear una remesa nueva** → EmailJS envía email a `leandrorodriguezsarmiento@gmail.com` con los datos del destinatario, monto y tracking.
- Al **marcar como completada** desde admin → EmailJS envía email al usuario con la confirmación (además de la notificación in-app que ya existe).

Necesitaré 3 valores (públicos, van en `.env` como `VITE_*`):
- `VITE_EMAILJS_SERVICE_ID`
- `VITE_EMAILJS_PUBLIC_KEY`
- 2 template IDs: `VITE_EMAILJS_TEMPLATE_ADMIN` (aviso a ti) y `VITE_EMAILJS_TEMPLATE_USER` (confirmación al cliente).

## Detalles técnicos

- Migración SQL única: tabla `banners`, bucket storage `banners`, trigger que bloquea admin no autorizado, limpieza de admins existentes.
- `src/lib/mercadopago.functions.ts` con `createMpPreference` (usa `requireSupabaseAuth`) y `verifyMpPayment` server-only.
- `src/routes/api/public/mercadopago/webhook.ts` para el webhook.
- `src/lib/emailjs.ts` helper cliente con `sendAdminNotification` y `sendUserCompletionEmail`.
- Nueva pestaña Banners en `admin.tsx` (pasa a 6 pestañas con scroll horizontal para caber en móvil).
- Componente `<BannerCarousel />` en el dashboard.

## Orden de ejecución

1. Rediseño de tema + migración de banners + solo-Leandro-admin (todo en un turno).
2. Te pido `MERCADOPAGO_ACCESS_TOKEN`.
3. Implemento MercadoPago (server fn + webhook + botón).
4. Te pido las 3 claves de EmailJS.
5. Implemento notificaciones EmailJS.

¿Confirmas? Si sí, arranco por el bloque 1.
