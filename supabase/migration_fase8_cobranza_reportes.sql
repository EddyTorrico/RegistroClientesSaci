-- SACIPETROL S.R.L. — Fase 8
-- Cobranza, pagos parciales, vencimientos, anulación con reversión de inventario y reportes gerenciales.
-- Idempotente y sin eliminar datos existentes.

BEGIN;

CREATE TABLE IF NOT EXISTS public.sale_payments (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  sale_id uuid NOT NULL REFERENCES public.sales(id) ON DELETE RESTRICT,
  payment_date date NOT NULL DEFAULT current_date,
  amount numeric(12,2) NOT NULL CHECK (amount > 0),
  payment_method text NOT NULL DEFAULT 'Contado' CHECK (payment_method IN ('Contado','Transferencia','QR','Cheque','Otro')),
  reference text,
  notes text,
  created_by uuid NOT NULL REFERENCES public.profiles(id),
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS sale_payments_sale_idx ON public.sale_payments(sale_id);
CREATE INDEX IF NOT EXISTS sale_payments_date_idx ON public.sale_payments(payment_date DESC);

-- Deja trazabilidad de pagos iniciales creados antes de Fase 8 sin alterar saldos.
INSERT INTO public.sale_payments(sale_id,payment_date,amount,payment_method,reference,notes,created_by)
SELECT s.id,s.sale_date,s.amount_paid,
       CASE WHEN s.payment_method='Contado' THEN 'Contado' ELSE 'Otro' END,
       'MIGRACION-F8','Pago inicial registrado antes del módulo de cobranza',s.user_id
FROM public.sales s
WHERE s.amount_paid > 0
  AND NOT EXISTS (SELECT 1 FROM public.sale_payments p WHERE p.sale_id=s.id AND p.reference='MIGRACION-F8');

ALTER TABLE public.sale_payments ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Usuario ve pagos de sus ventas" ON public.sale_payments;
CREATE POLICY "Usuario ve pagos de sus ventas"
ON public.sale_payments FOR SELECT
USING (
  EXISTS (
    SELECT 1 FROM public.sales s
    WHERE s.id = sale_id
      AND (s.user_id = auth.uid() OR public.is_admin_or_gerente())
  )
);

-- Los pagos se registran mediante RPC para validar saldo y permisos de forma atómica.
REVOKE INSERT, UPDATE, DELETE ON public.sale_payments FROM authenticated;
GRANT SELECT ON public.sale_payments TO authenticated;

CREATE OR REPLACE FUNCTION public.register_sale_payment(
  p_sale_id uuid,
  p_amount numeric,
  p_payment_date date DEFAULT current_date,
  p_payment_method text DEFAULT 'Contado',
  p_reference text DEFAULT NULL,
  p_notes text DEFAULT NULL
)
RETURNS public.sales
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_sale public.sales;
  v_new_paid numeric(12,2);
  v_new_balance numeric(12,2);
BEGIN
  SELECT * INTO v_sale FROM public.sales WHERE id = p_sale_id FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'Venta no encontrada.'; END IF;
  IF NOT (v_sale.user_id = auth.uid() OR public.is_admin_or_gerente()) THEN
    RAISE EXCEPTION 'No tiene permiso para registrar pagos en esta venta.';
  END IF;
  IF v_sale.status IN ('borrador','anulada') THEN
    RAISE EXCEPTION 'No se pueden registrar pagos en una venta %.', v_sale.status;
  END IF;
  IF p_amount IS NULL OR p_amount <= 0 THEN RAISE EXCEPTION 'El pago debe ser mayor a cero.'; END IF;
  IF p_amount > v_sale.balance THEN
    RAISE EXCEPTION 'El pago supera el saldo pendiente de Bs %.', v_sale.balance;
  END IF;
  IF p_payment_method NOT IN ('Contado','Transferencia','QR','Cheque','Otro') THEN
    RAISE EXCEPTION 'Forma de pago no válida.';
  END IF;

  INSERT INTO public.sale_payments(sale_id,payment_date,amount,payment_method,reference,notes,created_by)
  VALUES(p_sale_id,coalesce(p_payment_date,current_date),p_amount,p_payment_method,nullif(trim(p_reference),''),nullif(trim(p_notes),''),auth.uid());

  v_new_paid := v_sale.amount_paid + p_amount;
  v_new_balance := greatest(v_sale.total - v_new_paid, 0);

  UPDATE public.sales
  SET amount_paid = v_new_paid,
      balance = v_new_balance,
      status = CASE WHEN v_new_balance = 0 THEN 'pagada' ELSE status END
  WHERE id = p_sale_id
  RETURNING * INTO v_sale;
  RETURN v_sale;
END;
$$;

GRANT EXECUTE ON FUNCTION public.register_sale_payment(uuid,numeric,date,text,text,text) TO authenticated;

-- Anulación controlada: devuelve al inventario exactamente lo descontado por la venta.
CREATE OR REPLACE FUNCTION public.cancel_sale(p_sale_id uuid, p_reason text DEFAULT NULL)
RETURNS public.sales
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_sale public.sales;
BEGIN
  SELECT * INTO v_sale FROM public.sales WHERE id = p_sale_id FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'Venta no encontrada.'; END IF;
  IF NOT (v_sale.user_id = auth.uid() OR public.is_admin_or_gerente()) THEN
    RAISE EXCEPTION 'No tiene permiso para anular esta venta.';
  END IF;
  IF v_sale.status = 'anulada' THEN RAISE EXCEPTION 'La venta ya está anulada.'; END IF;
  IF v_sale.status = 'borrador' THEN RAISE EXCEPTION 'Una venta borrador no requiere reversión de inventario.'; END IF;
  IF v_sale.amount_paid > 0 THEN
    RAISE EXCEPTION 'La venta tiene pagos registrados. Regularice la cobranza antes de anular.';
  END IF;

  INSERT INTO public.inventory_movements(product_id,movement_type,quantity,reference,notes,created_by,sale_id)
  SELECT si.product_id,'ajuste_entrada',si.quantity,
         'ANUL-' || v_sale.sale_number,
         'Reversión automática por anulación de ' || v_sale.sale_number || CASE WHEN nullif(trim(p_reason),'') IS NOT NULL THEN ': ' || trim(p_reason) ELSE '' END,
         auth.uid(),v_sale.id
  FROM public.sale_items si
  WHERE si.sale_id = v_sale.id
    AND NOT EXISTS (
      SELECT 1 FROM public.inventory_movements im
      WHERE im.sale_id=v_sale.id AND im.product_id=si.product_id
        AND im.movement_type='ajuste_entrada' AND im.reference='ANUL-' || v_sale.sale_number
    );

  UPDATE public.sales
  SET status='anulada', balance=0,
      observations=concat_ws(E'\n',observations,'ANULADA: ' || coalesce(nullif(trim(p_reason),''),'Sin motivo registrado'))
  WHERE id=p_sale_id
  RETURNING * INTO v_sale;
  RETURN v_sale;
END;
$$;

GRANT EXECUTE ON FUNCTION public.cancel_sale(uuid,text) TO authenticated;

-- Vista simple de cartera/cobranza para reportes.
CREATE OR REPLACE VIEW public.sales_receivables AS
SELECT s.id,s.sale_number,s.customer_id,s.user_id,s.sale_date,s.due_date,s.total,s.amount_paid,s.balance,s.status,
  CASE
    WHEN s.balance <= 0 THEN 'pagada'
    WHEN s.due_date IS NOT NULL AND s.due_date < current_date THEN 'vencida'
    WHEN s.due_date IS NOT NULL AND s.due_date <= current_date + 3 THEN 'proxima'
    ELSE 'pendiente'
  END AS collection_status
FROM public.sales s
WHERE s.status <> 'anulada';

COMMIT;

SELECT table_name FROM information_schema.tables
WHERE table_schema='public' AND table_name IN ('sale_payments','sales_receivables')
ORDER BY table_name;
