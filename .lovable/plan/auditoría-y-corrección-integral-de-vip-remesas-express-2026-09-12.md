# Auditoría y corrección integral de VIP Remesas Express

## Objetivo
Conservar la aplicación y su diseño actuales, corregir los riesgos de seguridad y dinero detectados, y dejar el código principal preparado para producción. La versión canónica será la aplicación de la raíz (`src/` y `supabase/migrations/`); `portable-export/` y `nextjs-export/` quedarán identificados como copias de exportación, no como fuentes de producción.

## Correcciones principales

### 1. Flujo manual y seguro de remesas PIX
- Incorporar los estados `pending_payment`, `payment_reported`, `payment_confirmed`, `processing`, `completed` y `rejected` sin perder operaciones existentes.
- Cambiar “Ya pagué” para que registre solamente el aviso del cliente y su hora; nunca establecerá `paid_at` ni iniciará el procesamiento.
- Mostrar al cliente “Pago pendiente de verificación” hasta que el administrador confirme el ingreso en su banco.
- Añadir al panel administrativo acciones separadas y ordenadas: **Confirmar pago recibido**, **Procesar remesa**, **Completar** y **Rechazar**.
- Impedir saltos de estado, dobles confirmaciones y reintentos que ejecuten una acción dos veces.

### 2. Protección de operaciones y auditoría
- Mover los cambios de estado, asignaciones y edición de tasas a funciones protegidas del servidor con validación estricta.
- Restringir a organizadores para que solo vean operaciones asignadas y solo ejecuten transiciones operativas permitidas; no podrán alterar montos, tasas, destinatarios ni confirmaciones financieras.
- Crear un historial de auditoría inmutable para confirmaciones, rechazos, procesamiento, finalización, asignación y cambios de tasas.
- Endurecer las reglas de acceso de transacciones, recargas, pagos, perfiles, roles, destinatarios y notificaciones con mínimo privilegio.

### 3. MFA administrativo fail-closed
- Eliminar los desbloqueos automáticos por demora, error de red o excepción.
- Mantener bloqueado el panel si no puede comprobarse la seguridad, mostrar un error claro y permitir reintentar.
- Exigir AAL2/TOTP real al administrador y organizadores; no usar almacenamiento del navegador como prueba de MFA.

### 4. Mercado Pago y recargas
- Hacer obligatoria la firma del webhook de Mercado Pago; si falta el secreto, responder como servicio no configurado.
- Validar en servidor referencia, propietario, moneda y monto del pago antes de actualizar datos.
- Añadir idempotencia por ID de pago y reutilización de preferencias existentes.
- Mantener Mercado Pago separado del flujo PIX manual.
- Eliminar toda finalización simulada de recargas: sin proveedor real configurado, la operación seguirá pendiente y mostrará que falta conectar el proveedor.

### 5. Configuración y notificaciones
- Mover la llave PIX y la URL pública a configuración protegida y editable/consultable según el mínimo permiso necesario.
- Sustituir URLs antiguas incrustadas en código y nuevas migraciones por configuración de producción.
- Actualizar avisos en tiempo real, push, contadores y correos para los nuevos estados: pago reportado, confirmado, procesando, completado o rechazado.
- Mantener los fallos de notificación aislados para que nunca reviertan ni dupliquen una operación financiera.

### 6. Limpieza y consistencia
- Retirar `checkPixPayment`, respuestas ficticias, referencias `mock-*` y cualquier simulación ejecutable en producción.
- Corregir textos de historial, detalle y panel para no afirmar que un pago fue confirmado automáticamente.
- Añadir metadatos propios a las páginas de contenido que aún no los tengan.
- Documentar las variables necesarias en `.env.example` sin incluir secretos.

## Cambios técnicos previstos
- Nueva migración para columnas de reporte/confirmación, estados, restricciones, auditoría, funciones transaccionales y políticas de acceso.
- Funciones de servidor autenticadas para reportar pago y acciones administrativas; el navegador dejará de escribir estados financieros directamente.
- Ajustes focalizados en `orders.functions.ts`, `admin.functions.ts`, `payments.functions.ts`, webhook de Mercado Pago, `MfaGate`, panel admin, envío, historial, detalle y notificaciones.
- No se eliminarán datos ni funcionalidades existentes. Los registros con estados antiguos se migrarán de forma compatible.

## Validación final
- Ejecutar el analizador de seguridad de la base de datos y corregir hallazgos relacionados.
- Ejecutar lint, comprobación de tipos, pruebas disponibles y compilación de producción.
- Probar con navegador los flujos cliente/admin, estados, errores, recargas no configuradas y vistas móvil/tablet/laptop.
- Entregar el informe solicitado: corregido, cambiado, eliminado, seguridad, pagos, base de datos, variables, resultados reales y preparación de producción; cualquier bloqueo externo quedará explícito.
