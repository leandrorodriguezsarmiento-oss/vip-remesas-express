CREATE OR REPLACE FUNCTION public.transition_transaction_workflow(
  _transaction_id uuid,
  _action text,
  _assigned_to uuid DEFAULT NULL,
  _reason text DEFAULT NULL
)
RETURNS public.tx_status
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  _actor uuid := auth.uid();
  _is_admin boolean;
  _is_organizer boolean;
  _tx public.transactions%ROWTYPE;
  _to_status public.tx_status;
  _now timestamptz := now();
BEGIN
  IF _actor IS NULL THEN
    RAISE EXCEPTION 'No autorizado';
  END IF;

  _is_admin := public.has_role(_actor, 'admin'::public.app_role);
  _is_organizer := public.has_role(_actor, 'organizador'::public.app_role);
  IF NOT _is_admin AND NOT _is_organizer THEN
    RAISE EXCEPTION 'No autorizado';
  END IF;

  SELECT * INTO _tx
  FROM public.transactions
  WHERE id = _transaction_id
  FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Remesa no encontrada';
  END IF;
  IF NOT _is_admin AND _tx.assigned_to IS DISTINCT FROM _actor THEN
    RAISE EXCEPTION 'Esta remesa no está asignada a ti';
  END IF;

  CASE _action
    WHEN 'confirm_payment' THEN
      IF NOT _is_admin THEN RAISE EXCEPTION 'Solo el administrador puede confirmar pagos'; END IF;
      IF _tx.status <> 'payment_reported' OR _tx.payment_reported_at IS NULL THEN
        RAISE EXCEPTION 'El cliente aún no informó este pago';
      END IF;
      _to_status := 'payment_confirmed';
      UPDATE public.transactions
      SET status = _to_status,
          paid_at = _now,
          payment_confirmed_at = _now,
          payment_confirmed_by = _actor
      WHERE id = _tx.id;

    WHEN 'start_processing' THEN
      IF NOT _is_admin THEN RAISE EXCEPTION 'Solo el administrador puede asignar remesas'; END IF;
      IF _tx.status <> 'payment_confirmed' OR _tx.payment_confirmed_at IS NULL THEN
        RAISE EXCEPTION 'Primero confirma el pago recibido';
      END IF;
      IF _assigned_to IS NULL OR NOT public.has_role(_assigned_to, 'organizador'::public.app_role) THEN
        RAISE EXCEPTION 'Elige un organizador válido';
      END IF;
      _to_status := 'processing';
      UPDATE public.transactions
      SET status = _to_status, assigned_to = _assigned_to
      WHERE id = _tx.id;

    WHEN 'complete' THEN
      IF _tx.status <> 'processing' THEN RAISE EXCEPTION 'La remesa debe estar en proceso'; END IF;
      _to_status := 'completed';
      UPDATE public.transactions SET status = _to_status WHERE id = _tx.id;

    WHEN 'reject' THEN
      IF _tx.status NOT IN ('payment_reported', 'payment_confirmed', 'processing') THEN
        RAISE EXCEPTION 'Esta remesa no se puede rechazar';
      END IF;
      IF NOT _is_admin AND _tx.status <> 'processing' THEN
        RAISE EXCEPTION 'El organizador solo puede rechazar una remesa en proceso';
      END IF;
      IF char_length(trim(COALESCE(_reason, ''))) < 3 THEN
        RAISE EXCEPTION 'Indica el motivo del rechazo';
      END IF;
      _to_status := 'rejected';
      UPDATE public.transactions
      SET status = _to_status,
          payment_rejected_at = _now,
          payment_rejection_reason = trim(_reason)
      WHERE id = _tx.id;

    ELSE
      RAISE EXCEPTION 'Acción inválida';
  END CASE;

  INSERT INTO public.transaction_audit_log (
    transaction_id, actor_id, action, from_status, to_status, details
  ) VALUES (
    _tx.id,
    _actor,
    _action,
    _tx.status::text,
    _to_status::text,
    jsonb_build_object('assigned_to', _assigned_to, 'reason', _reason)
  );

  RETURN _to_status;
END;
$$;

REVOKE ALL ON FUNCTION public.transition_transaction_workflow(uuid, text, uuid, text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.transition_transaction_workflow(uuid, text, uuid, text) TO authenticated, service_role;