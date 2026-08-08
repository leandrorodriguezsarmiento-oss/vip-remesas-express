# Mejoras de registro, roles y notificaciones

## 1. Panel admin: copiar en efectivo
En las remesas en efectivo el bloque de copiar incluirá también el teléfono del destinatario:
- Efectivo: Nombre, Teléfono, Dirección, Monto a entregar
- Transferencia: Teléfono, Tarjeta, Monto a enviar

## 2. Icono viejo y "puntico blanco" en notificaciones
- Regenerar el set de iconos (corona dorada sobre azul marino, "VIP REMESAS") en tamaños 192, 512, maskable 512, favicon y apple-touch, con nombres nuevos (`-v8`) para romper la caché del teléfono.
- Añadir un icono monocromo dedicado para el badge de notificación (silueta de corona, blanco sobre transparente). El punto blanco aparece porque Android usa el `badge` y no encuentra una imagen monocroma válida.
- Actualizar manifiesto, `sw-push.js` (icon + badge) y las etiquetas del head; forzar actualización del service worker.

## 3. Registro de cuenta
- Nuevo campo **Correo electrónico** (obligatorio, validado) que se guarda en el perfil como dato de contacto; el inicio de sesión sigue funcionando con usuario / teléfono / CPF.
- **Unicidad garantizada**: usuario, teléfono, CPF y correo se comprueban antes de crear la cuenta y quedan protegidos con índices únicos en la base de datos (no solo por comprobación previa), de modo que dos personas no puedan registrar el mismo dato.
- **Máscaras de entrada**:
  - Teléfono: solo dígitos; si el país es Brasil el campo arranca con `+55 ` y el usuario escribe el resto.
  - CPF: solo dígitos con puntos y guion automáticos mientras escribe → `111.222.333-44`.
  - Nombre completo: solo letras, espacios y acentos.
- Mensajes de error claros en español para cada caso de duplicado.

## 4. Rol "Organizador"
- Nuevo rol `organizador` además de `admin` y `user`.
- Desde el panel admin: lista de usuarios registrados con un botón para **activar/desactivar organizador**.
- Los organizadores acceden a una vista reducida (solo lectura + procesar):
  - Remesas y recargas pendientes con los datos necesarios para procesarlas y el bloque de copiar.
  - Cambiar estado (pendiente → procesando → completado / rechazado).
  - Sin acceso a tasas, cuentas de pago, banners, pagos de Mercado Pago, eliminar usuarios ni gestión de roles.

## 5. Seguridad
- Reglas de acceso: solo el admin dueño puede gestionar roles; el organizador solo puede leer remesas/recargas y actualizar su estado, nunca borrar ni ver datos de otros usuarios (perfiles, pagos).
- Correo y CPF siguen siendo privados: nadie puede consultarlos salvo su dueño y el admin.
- Ejecutar el escaneo de seguridad al final y corregir lo que aparezca relacionado con estos cambios.

## Detalles técnicos
- Migración: valor `organizador` en el enum `app_role`; índices únicos (minúsculas) en `login_aliases.alias` y en `profiles.username`/`cpf`/correo; nuevas políticas RLS para `transactions` y `recargas_requests` usando `has_role(auth.uid(),'organizador')`; ajuste del trigger `enforce_single_admin` para no bloquear el rol organizador.
- `src/lib/account.functions.ts`: alias de tipo `email`, validación conjunta y mapeo de errores.
- `src/routes/auth.index.tsx`: campo correo + máscaras (`formatCpf`, prefijo por país).
- `src/routes/_authenticated/admin.tsx`: se extrae la vista de procesado a un componente reutilizable para admin y organizador; nueva sección de usuarios/roles.
- `src/routes/_authenticated/route.tsx` y la navegación: acceso al panel para `admin` u `organizador`, con secciones filtradas por rol.
