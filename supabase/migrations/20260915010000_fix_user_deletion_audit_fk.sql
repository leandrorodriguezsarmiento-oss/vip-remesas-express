-- Permite eliminar usuarios que tengan remesas con historial de auditoría.
-- El historial pertenece a la transacción y debe desaparecer cuando la transacción
-- se elimina como parte de la eliminación del usuario.

ALTER TABLE public.transaction_audit_log
  DROP CONSTRAINT IF EXISTS transaction_audit_log_transaction_id_fkey;

ALTER TABLE public.transaction_audit_log
  ADD CONSTRAINT transaction_audit_log_transaction_id_fkey
  FOREIGN KEY (transaction_id)
  REFERENCES public.transactions(id)
  ON DELETE CASCADE;
