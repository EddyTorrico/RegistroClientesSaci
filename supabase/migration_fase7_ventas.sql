-- SACIPETROL S.R.L. — Fase 7: Ventas
-- No elimina datos existentes.
-- Flujo: Cotización opcional -> Venta borrador -> Confirmación -> movimiento inventario tipo venta.

BEGIN;

CREATE SEQUENCE IF NOT EXISTS public.sale_number_seq;

CREATE TABLE IF NOT EXISTS public.sales (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  sale_number text NOT NULL UNIQUE DEFAULT (
    'VEN-' || to_char(current_date, 'YYYY') || '-' || lpad(nextval('public.sale_number_seq')::text, 5, '0')
  ),
  customer_id uuid NOT NULL REFERENCES public.customers(id) ON DELETE RESTRICT,
  user_id uuid NOT NULL REFERENCES public.profiles(id),
  quotation_id uuid REFERENCES public.quotations(id) ON DELETE SET NULL,
  sale_date date NOT NULL DEFAULT current_date,
  customer_address text,
  payment_method text NOT NULL DEFAULT 'Contado' CHECK (payment_method IN ('Contado','Crédito')),
  delivery_time text,
  status text NOT NULL DEFAULT 'borrador' CHECK (status IN ('borrador','confirmada','entregada','pagada','anulada')),
  subtotal numeric(12,2) NOT NULL DEFAULT 0 CHECK (subtotal >= 0),
  discount numeric(12,2) NOT NULL DEFAULT 0 CHECK (discount >= 0),
  total numeric(12,2) NOT NULL DEFAULT 0 CHECK (total >= 0),
  amount_paid numeric(12,2) NOT NULL DEFAULT 0 CHECK (amount_paid >= 0),
  balance numeric(12,2) NOT NULL DEFAULT 0 CHECK (balance >= 0),
  due_date date,
  observations text,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE UNIQUE INDEX IF NOT EXISTS sales_quotation_unique
ON public.sales(quotation_id)
WHERE quotation_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS sales_customer_idx ON public.sales(customer_id);
CREATE INDEX IF NOT EXISTS sales_user_idx ON public.sales(user_id);
CREATE INDEX IF NOT EXISTS sales_date_idx ON public.sales(sale_date DESC);
CREATE INDEX IF NOT EXISTS sales_status_idx ON public.sales(status);

CREATE TABLE IF NOT EXISTS public.sale_items (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  sale_id uuid NOT NULL REFERENCES public.sales(id) ON DELETE CASCADE,
  product_id uuid NOT NULL REFERENCES public.products(id) ON DELETE RESTRICT,
  sku text NOT NULL,
  description text NOT NULL,
  brand text,
  unit text,
  quantity numeric(12,2) NOT NULL CHECK (quantity > 0),
  unit_price numeric(12,2) NOT NULL CHECK (unit_price >= 0),
  purchase_cost numeric(12,2) NOT NULL DEFAULT 0 CHECK (purchase_cost >= 0),
  discount numeric(12,2) NOT NULL DEFAULT 0 CHECK (discount >= 0),
  subtotal numeric(12,2) NOT NULL DEFAULT 0 CHECK (subtotal >= 0)
);

CREATE INDEX IF NOT EXISTS sale_items_sale_idx ON public.sale_items(sale_id);
CREATE INDEX IF NOT EXISTS sale_items_product_idx ON public.sale_items(product_id);
CREATE UNIQUE INDEX IF NOT EXISTS sale_items_sale_product_unique ON public.sale_items(sale_id, product_id);

ALTER TABLE public.inventory_movements
ADD COLUMN IF NOT EXISTS sale_id uuid REFERENCES public.sales(id) ON DELETE SET NULL;
CREATE INDEX IF NOT EXISTS inventory_movements_sale_idx ON public.inventory_movements(sale_id);
CREATE UNIQUE INDEX IF NOT EXISTS inventory_sale_product_unique
ON public.inventory_movements(sale_id, product_id)
WHERE sale_id IS NOT NULL AND movement_type = 'venta';

ALTER TABLE public.sales ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.sale_items ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Ventas visibles por dueño o admin gerente" ON public.sales;
CREATE POLICY "Ventas visibles por dueño o admin gerente"
ON public.sales FOR SELECT
USING (user_id = auth.uid() OR public.is_admin_or_gerente());

DROP POLICY IF EXISTS "Usuario crea sus ventas" ON public.sales;
CREATE POLICY "Usuario crea sus ventas"
ON public.sales FOR INSERT
WITH CHECK (user_id = auth.uid() OR public.is_admin_or_gerente());

DROP POLICY IF EXISTS "Dueño o admin gerente edita venta" ON public.sales;
CREATE POLICY "Dueño o admin gerente edita venta"
ON public.sales FOR UPDATE
USING (user_id = auth.uid() OR public.is_admin_or_gerente())
WITH CHECK (user_id = auth.uid() OR public.is_admin_or_gerente());

DROP POLICY IF EXISTS "Solo admin elimina venta" ON public.sales;
CREATE POLICY "Solo admin elimina venta"
ON public.sales FOR DELETE
USING (public.is_admin());

DROP POLICY IF EXISTS "Items venta visibles por propietario" ON public.sale_items;
CREATE POLICY "Items venta visibles por propietario"
ON public.sale_items FOR SELECT
USING (
  EXISTS (
    SELECT 1 FROM public.sales s
    WHERE s.id = sale_id
      AND (s.user_id = auth.uid() OR public.is_admin_or_gerente())
  )
);

DROP POLICY IF EXISTS "Usuario crea items de sus ventas" ON public.sale_items;
CREATE POLICY "Usuario crea items de sus ventas"
ON public.sale_items FOR INSERT
WITH CHECK (
  EXISTS (
    SELECT 1 FROM public.sales s
    WHERE s.id = sale_id
      AND s.status = 'borrador'
      AND (s.user_id = auth.uid() OR public.is_admin_or_gerente())
  )
);

DROP POLICY IF EXISTS "Dueño o admin edita items venta" ON public.sale_items;
CREATE POLICY "Dueño o admin edita items venta"
ON public.sale_items FOR UPDATE
USING (
  EXISTS (
    SELECT 1 FROM public.sales s
    WHERE s.id = sale_id
      AND s.status = 'borrador'
      AND (s.user_id = auth.uid() OR public.is_admin_or_gerente())
  )
)
WITH CHECK (
  EXISTS (
    SELECT 1 FROM public.sales s
    WHERE s.id = sale_id
      AND s.status = 'borrador'
      AND (s.user_id = auth.uid() OR public.is_admin_or_gerente())
  )
);

DROP POLICY IF EXISTS "Dueño o admin elimina items venta" ON public.sale_items;
CREATE POLICY "Dueño o admin elimina items venta"
ON public.sale_items FOR DELETE
USING (
  EXISTS (
    SELECT 1 FROM public.sales s
    WHERE s.id = sale_id
      AND s.status = 'borrador'
      AND (s.user_id = auth.uid() OR public.is_admin_or_gerente())
  )
);


-- Asegurar que la función de stock incluya las ventas (Fase 5 ya actualizó la vista).
CREATE OR REPLACE FUNCTION public.get_product_stock(p_product_id uuid)
RETURNS numeric
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT COALESCE(SUM(
    CASE
      WHEN movement_type IN ('inicial','entrada','ajuste_entrada') THEN quantity
      WHEN movement_type IN ('salida','venta','ajuste_salida') THEN -quantity
      ELSE 0
    END
  ), 0)
  FROM public.inventory_movements
  WHERE product_id = p_product_id;
$$;

-- Confirma una venta de forma consistente: valida stock y genera las salidas.
CREATE OR REPLACE FUNCTION public.confirm_sale_inventory()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  r record;
  v_stock numeric;
  v_items integer;
BEGIN
  IF OLD.status = 'borrador' AND NEW.status = 'confirmada' THEN
    SELECT count(*) INTO v_items FROM public.sale_items WHERE sale_id = NEW.id;
    IF v_items = 0 THEN
      RAISE EXCEPTION 'La venta no contiene productos.';
    END IF;

    FOR r IN
      SELECT si.product_id, si.sku, si.description, si.quantity
      FROM public.sale_items si
      WHERE si.sale_id = NEW.id
      ORDER BY si.id
    LOOP
      SELECT public.get_product_stock(r.product_id) INTO v_stock;
      IF coalesce(v_stock, 0) < r.quantity THEN
        RAISE EXCEPTION 'Stock insuficiente para %. Disponible: %, solicitado: %', r.sku, coalesce(v_stock,0), r.quantity;
      END IF;
    END LOOP;

    INSERT INTO public.inventory_movements(
      product_id, movement_type, quantity, reference, notes, created_by, sale_id
    )
    SELECT
      si.product_id,
      'venta',
      si.quantity,
      NEW.sale_number,
      'Salida automática por venta ' || NEW.sale_number,
      NEW.user_id,
      NEW.id
    FROM public.sale_items si
    WHERE si.sale_id = NEW.id
    ON CONFLICT DO NOTHING;

    IF NEW.quotation_id IS NOT NULL THEN
      UPDATE public.quotations
      SET status = 'aceptada'
      WHERE id = NEW.quotation_id;
    END IF;
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_confirm_sale_inventory ON public.sales;
CREATE TRIGGER trg_confirm_sale_inventory
BEFORE UPDATE OF status ON public.sales
FOR EACH ROW
EXECUTE FUNCTION public.confirm_sale_inventory();

COMMIT;

-- Verificación
SELECT table_name
FROM information_schema.tables
WHERE table_schema='public' AND table_name IN ('sales','sale_items')
ORDER BY table_name;

SELECT column_name, data_type
FROM information_schema.columns
WHERE table_schema='public' AND table_name='inventory_movements' AND column_name='sale_id';
