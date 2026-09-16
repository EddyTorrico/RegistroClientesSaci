-- SACIPETROL S.R.L. — Fase 9: Proyectos
-- Registro y cotización de proyectos puntuales (licitaciones, pedidos especiales),
-- compras asociadas (con alta automática de inventario), gastos, documentos de
-- respaldo y planilla de rentabilidad (IVA débito/crédito fiscal, IT, utilidad neta).
-- No elimina datos existentes.

BEGIN;

-- 1) PROYECTOS ---------------------------------------------------------------

CREATE SEQUENCE IF NOT EXISTS public.project_number_seq;

CREATE TABLE IF NOT EXISTS public.projects (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  project_number text NOT NULL UNIQUE DEFAULT (
    'PRY-' || to_char(current_date, 'YYYY') || '-' || lpad(nextval('public.project_number_seq')::text, 5, '0')
  ),
  name text NOT NULL,
  client_reference text,
  customer_id uuid NOT NULL REFERENCES public.customers(id) ON DELETE RESTRICT,
  user_id uuid NOT NULL REFERENCES public.profiles(id),
  status text NOT NULL DEFAULT 'registrado' CHECK (status IN ('registrado','cotizado','ganado','perdido','en_compra','facturado')),
  commission_percent numeric(5,2),
  commission_amount numeric(12,2) NOT NULL DEFAULT 0 CHECK (commission_amount >= 0),
  quotation_id uuid REFERENCES public.quotations(id) ON DELETE SET NULL,
  sale_id uuid REFERENCES public.sales(id) ON DELETE SET NULL,
  observations text,
  created_by uuid REFERENCES public.profiles(id),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS projects_customer_idx ON public.projects(customer_id);
CREATE INDEX IF NOT EXISTS projects_user_idx ON public.projects(user_id);
CREATE INDEX IF NOT EXISTS projects_status_idx ON public.projects(status);
CREATE UNIQUE INDEX IF NOT EXISTS projects_quotation_unique ON public.projects(quotation_id) WHERE quotation_id IS NOT NULL;
CREATE UNIQUE INDEX IF NOT EXISTS projects_sale_unique ON public.projects(sale_id) WHERE sale_id IS NOT NULL;

ALTER TABLE public.projects ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Proyectos visibles por dueño o admin gerente" ON public.projects;
CREATE POLICY "Proyectos visibles por dueño o admin gerente"
ON public.projects FOR SELECT
USING (user_id = auth.uid() OR public.is_admin_or_gerente());

DROP POLICY IF EXISTS "Usuario crea sus proyectos" ON public.projects;
CREATE POLICY "Usuario crea sus proyectos"
ON public.projects FOR INSERT
WITH CHECK (user_id = auth.uid() OR public.is_admin_or_gerente());

DROP POLICY IF EXISTS "Dueño o admin gerente edita proyecto" ON public.projects;
CREATE POLICY "Dueño o admin gerente edita proyecto"
ON public.projects FOR UPDATE
USING (user_id = auth.uid() OR public.is_admin_or_gerente())
WITH CHECK (user_id = auth.uid() OR public.is_admin_or_gerente());

DROP POLICY IF EXISTS "Solo admin elimina proyecto" ON public.projects;
CREATE POLICY "Solo admin elimina proyecto"
ON public.projects FOR DELETE
USING (public.is_admin());

CREATE OR REPLACE FUNCTION public.set_updated_at()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_projects_updated_at ON public.projects;
CREATE TRIGGER trg_projects_updated_at
BEFORE UPDATE ON public.projects
FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- 2) ÍTEMS DEL PROYECTO -------------------------------------------------------

CREATE TABLE IF NOT EXISTS public.project_items (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id uuid NOT NULL REFERENCES public.projects(id) ON DELETE CASCADE,
  product_id uuid REFERENCES public.products(id) ON DELETE SET NULL,
  client_item_code text,
  client_description text NOT NULL,
  internal_description text,
  unit text DEFAULT 'unidad',
  requested_quantity numeric(12,2) NOT NULL CHECK (requested_quantity > 0),
  estimated_unit_cost numeric(12,2) NOT NULL DEFAULT 0 CHECK (estimated_unit_cost >= 0),
  markup_percent numeric(6,2),
  proposed_unit_price numeric(12,2) NOT NULL DEFAULT 0 CHECK (proposed_unit_price >= 0),
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS project_items_project_idx ON public.project_items(project_id);
CREATE INDEX IF NOT EXISTS project_items_product_idx ON public.project_items(product_id);

ALTER TABLE public.project_items ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Items de proyecto visibles por dueño o admin gerente" ON public.project_items;
CREATE POLICY "Items de proyecto visibles por dueño o admin gerente"
ON public.project_items FOR SELECT
USING (EXISTS (SELECT 1 FROM public.projects p WHERE p.id = project_id AND (p.user_id = auth.uid() OR public.is_admin_or_gerente())));

DROP POLICY IF EXISTS "Dueño o admin gerente gestiona items de proyecto" ON public.project_items;
CREATE POLICY "Dueño o admin gerente gestiona items de proyecto"
ON public.project_items FOR ALL
USING (EXISTS (SELECT 1 FROM public.projects p WHERE p.id = project_id AND (p.user_id = auth.uid() OR public.is_admin_or_gerente())))
WITH CHECK (EXISTS (SELECT 1 FROM public.projects p WHERE p.id = project_id AND (p.user_id = auth.uid() OR public.is_admin_or_gerente())));

-- 3) COMPRAS DEL PROYECTO (pueden ser parciales, en distintos momentos) ------

CREATE TABLE IF NOT EXISTS public.project_purchases (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id uuid NOT NULL REFERENCES public.projects(id) ON DELETE CASCADE,
  supplier text NOT NULL,
  purchase_date date NOT NULL DEFAULT current_date,
  has_invoice boolean NOT NULL DEFAULT true,
  invoice_number text,
  invoice_amount numeric(12,2),
  notes text,
  created_by uuid REFERENCES public.profiles(id),
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS project_purchases_project_idx ON public.project_purchases(project_id);

ALTER TABLE public.project_purchases ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Compras de proyecto visibles por dueño o admin gerente" ON public.project_purchases;
CREATE POLICY "Compras de proyecto visibles por dueño o admin gerente"
ON public.project_purchases FOR SELECT
USING (EXISTS (SELECT 1 FROM public.projects p WHERE p.id = project_id AND (p.user_id = auth.uid() OR public.is_admin_or_gerente())));

DROP POLICY IF EXISTS "Dueño o admin gerente registra compras de proyecto" ON public.project_purchases;
CREATE POLICY "Dueño o admin gerente registra compras de proyecto"
ON public.project_purchases FOR INSERT
WITH CHECK (
  created_by = auth.uid()
  AND EXISTS (SELECT 1 FROM public.projects p WHERE p.id = project_id AND (p.user_id = auth.uid() OR public.is_admin_or_gerente()))
);

DROP POLICY IF EXISTS "Admin gerente edita compras de proyecto" ON public.project_purchases;
CREATE POLICY "Admin gerente edita compras de proyecto"
ON public.project_purchases FOR UPDATE
USING (public.is_admin_or_gerente())
WITH CHECK (public.is_admin_or_gerente());

DROP POLICY IF EXISTS "Solo admin elimina compras de proyecto" ON public.project_purchases;
CREATE POLICY "Solo admin elimina compras de proyecto"
ON public.project_purchases FOR DELETE
USING (public.is_admin());

CREATE TABLE IF NOT EXISTS public.project_purchase_items (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  purchase_id uuid NOT NULL REFERENCES public.project_purchases(id) ON DELETE CASCADE,
  project_item_id uuid REFERENCES public.project_items(id) ON DELETE SET NULL,
  product_id uuid NOT NULL REFERENCES public.products(id) ON DELETE RESTRICT,
  quantity numeric(12,2) NOT NULL CHECK (quantity > 0),
  unit_cost numeric(12,2) NOT NULL CHECK (unit_cost >= 0)
);

CREATE INDEX IF NOT EXISTS project_purchase_items_purchase_idx ON public.project_purchase_items(purchase_id);
CREATE INDEX IF NOT EXISTS project_purchase_items_product_idx ON public.project_purchase_items(product_id);

ALTER TABLE public.project_purchase_items ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Items de compra visibles por dueño o admin gerente" ON public.project_purchase_items;
CREATE POLICY "Items de compra visibles por dueño o admin gerente"
ON public.project_purchase_items FOR SELECT
USING (
  EXISTS (
    SELECT 1 FROM public.project_purchases pp
    JOIN public.projects p ON p.id = pp.project_id
    WHERE pp.id = purchase_id AND (p.user_id = auth.uid() OR public.is_admin_or_gerente())
  )
);

DROP POLICY IF EXISTS "Dueño o admin gerente crea items de compra" ON public.project_purchase_items;
CREATE POLICY "Dueño o admin gerente crea items de compra"
ON public.project_purchase_items FOR INSERT
WITH CHECK (
  EXISTS (
    SELECT 1 FROM public.project_purchases pp
    JOIN public.projects p ON p.id = pp.project_id
    WHERE pp.id = purchase_id AND (p.user_id = auth.uid() OR public.is_admin_or_gerente())
  )
);

DROP POLICY IF EXISTS "Admin gerente edita items de compra" ON public.project_purchase_items;
CREATE POLICY "Admin gerente edita items de compra"
ON public.project_purchase_items FOR UPDATE
USING (public.is_admin_or_gerente())
WITH CHECK (public.is_admin_or_gerente());

DROP POLICY IF EXISTS "Solo admin elimina items de compra" ON public.project_purchase_items;
CREATE POLICY "Solo admin elimina items de compra"
ON public.project_purchase_items FOR DELETE
USING (public.is_admin());

-- Alta automática de inventario: cada ítem de compra de proyecto ingresa a
-- almacén igual que una compra normal de mercadería (movimiento tipo 'entrada').
CREATE OR REPLACE FUNCTION public.register_project_purchase_stock()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_purchase public.project_purchases;
  v_project public.projects;
BEGIN
  SELECT * INTO v_purchase FROM public.project_purchases WHERE id = NEW.purchase_id;
  SELECT * INTO v_project FROM public.projects WHERE id = v_purchase.project_id;

  INSERT INTO public.inventory_movements (
    product_id, movement_type, quantity, reference, notes, created_by
  ) VALUES (
    NEW.product_id,
    'entrada',
    NEW.quantity,
    v_project.project_number,
    'Compra de proyecto ' || v_project.project_number || ' — proveedor: ' || v_purchase.supplier,
    coalesce(v_purchase.created_by, v_project.user_id)
  );

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_project_purchase_item_stock ON public.project_purchase_items;
CREATE TRIGGER trg_project_purchase_item_stock
AFTER INSERT ON public.project_purchase_items
FOR EACH ROW EXECUTE FUNCTION public.register_project_purchase_stock();

-- 4) GASTOS DEL PROYECTO (insumos, transporte, comisión variable, otros) -----

CREATE TABLE IF NOT EXISTS public.project_expenses (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id uuid NOT NULL REFERENCES public.projects(id) ON DELETE CASCADE,
  expense_type text NOT NULL CHECK (expense_type IN ('transporte','insumos','comision','otro')),
  description text NOT NULL,
  amount numeric(12,2) NOT NULL CHECK (amount > 0),
  has_invoice boolean NOT NULL DEFAULT false,
  invoice_number text,
  created_by uuid REFERENCES public.profiles(id),
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS project_expenses_project_idx ON public.project_expenses(project_id);

ALTER TABLE public.project_expenses ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Gastos de proyecto visibles por dueño o admin gerente" ON public.project_expenses;
CREATE POLICY "Gastos de proyecto visibles por dueño o admin gerente"
ON public.project_expenses FOR SELECT
USING (EXISTS (SELECT 1 FROM public.projects p WHERE p.id = project_id AND (p.user_id = auth.uid() OR public.is_admin_or_gerente())));

DROP POLICY IF EXISTS "Dueño o admin gerente registra gastos de proyecto" ON public.project_expenses;
CREATE POLICY "Dueño o admin gerente registra gastos de proyecto"
ON public.project_expenses FOR INSERT
WITH CHECK (
  created_by = auth.uid()
  AND EXISTS (SELECT 1 FROM public.projects p WHERE p.id = project_id AND (p.user_id = auth.uid() OR public.is_admin_or_gerente()))
);

DROP POLICY IF EXISTS "Admin gerente edita gastos de proyecto" ON public.project_expenses;
CREATE POLICY "Admin gerente edita gastos de proyecto"
ON public.project_expenses FOR UPDATE
USING (public.is_admin_or_gerente())
WITH CHECK (public.is_admin_or_gerente());

DROP POLICY IF EXISTS "Solo admin elimina gastos de proyecto" ON public.project_expenses;
CREATE POLICY "Solo admin elimina gastos de proyecto"
ON public.project_expenses FOR DELETE
USING (public.is_admin());

-- 5) DOCUMENTOS DE RESPALDO DEL PROYECTO --------------------------------------
-- El vendedor/cotizador puede subir su propia cotización externa de respaldo;
-- el resto de documentos (facturas de compra/venta, otros) quedan a cargo de
-- administración/gerencia.

CREATE TABLE IF NOT EXISTS public.project_documents (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id uuid NOT NULL REFERENCES public.projects(id) ON DELETE CASCADE,
  document_type text NOT NULL CHECK (document_type IN ('cotizacion_externa','factura_compra','factura_venta','otro')),
  file_url text NOT NULL,
  description text,
  uploaded_by uuid REFERENCES public.profiles(id),
  uploaded_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS project_documents_project_idx ON public.project_documents(project_id);

ALTER TABLE public.project_documents ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Documentos de proyecto visibles por dueño o admin gerente" ON public.project_documents;
CREATE POLICY "Documentos de proyecto visibles por dueño o admin gerente"
ON public.project_documents FOR SELECT
USING (EXISTS (SELECT 1 FROM public.projects p WHERE p.id = project_id AND (p.user_id = auth.uid() OR public.is_admin_or_gerente())));

DROP POLICY IF EXISTS "Dueño sube cotización externa o admin gerente sube cualquiera" ON public.project_documents;
CREATE POLICY "Dueño sube cotización externa o admin gerente sube cualquiera"
ON public.project_documents FOR INSERT
WITH CHECK (
  uploaded_by = auth.uid()
  AND (
    public.is_admin_or_gerente()
    OR (
      document_type = 'cotizacion_externa'
      AND EXISTS (SELECT 1 FROM public.projects p WHERE p.id = project_id AND p.user_id = auth.uid())
    )
  )
);

DROP POLICY IF EXISTS "Admin gerente edita documentos de proyecto" ON public.project_documents;
CREATE POLICY "Admin gerente edita documentos de proyecto"
ON public.project_documents FOR UPDATE
USING (public.is_admin_or_gerente())
WITH CHECK (public.is_admin_or_gerente());

DROP POLICY IF EXISTS "Admin gerente elimina documentos de proyecto" ON public.project_documents;
CREATE POLICY "Admin gerente elimina documentos de proyecto"
ON public.project_documents FOR DELETE
USING (public.is_admin_or_gerente());

-- 6) STORAGE: bucket privado para documentos de proyecto ---------------------
-- Convención de ruta: {document_type}/{project_id}/archivo — igual patrón que
-- product-images, pero con bucket privado (los documentos no son públicos).

INSERT INTO storage.buckets (id, name, public)
VALUES ('project-documents', 'project-documents', false)
ON CONFLICT (id) DO UPDATE SET public = false;

DROP POLICY IF EXISTS "Dueño o admin gerente ve documentos de proyecto" ON storage.objects;
CREATE POLICY "Dueño o admin gerente ve documentos de proyecto"
ON storage.objects FOR SELECT
USING (
  bucket_id = 'project-documents'
  AND (
    public.is_admin_or_gerente()
    OR EXISTS (
      SELECT 1 FROM public.projects p
      WHERE p.id::text = (storage.foldername(name))[2]
        AND p.user_id = auth.uid()
    )
  )
);

DROP POLICY IF EXISTS "Dueño sube cotización externa o admin gerente en storage" ON storage.objects;
CREATE POLICY "Dueño sube cotización externa o admin gerente en storage"
ON storage.objects FOR INSERT
WITH CHECK (
  bucket_id = 'project-documents'
  AND (
    public.is_admin_or_gerente()
    OR (
      (storage.foldername(name))[1] = 'cotizacion_externa'
      AND EXISTS (
        SELECT 1 FROM public.projects p
        WHERE p.id::text = (storage.foldername(name))[2]
          AND p.user_id = auth.uid()
      )
    )
  )
);

DROP POLICY IF EXISTS "Admin gerente actualiza documentos de proyecto" ON storage.objects;
CREATE POLICY "Admin gerente actualiza documentos de proyecto"
ON storage.objects FOR UPDATE
USING (bucket_id = 'project-documents' AND public.is_admin_or_gerente())
WITH CHECK (bucket_id = 'project-documents' AND public.is_admin_or_gerente());

DROP POLICY IF EXISTS "Admin gerente elimina documentos de proyecto storage" ON storage.objects;
CREATE POLICY "Admin gerente elimina documentos de proyecto storage"
ON storage.objects FOR DELETE
USING (bucket_id = 'project-documents' AND public.is_admin_or_gerente());

-- 7) RENTABILIDAD DEL PROYECTO -------------------------------------------------
-- Replica la lógica de la planilla de costos: IVA débito (13% de ventas),
-- IVA crédito fiscal (13% de compras con factura), IT (3% de ventas) e
-- impuestos a pagar = max(débito - crédito, 0) + IT.

CREATE OR REPLACE VIEW public.project_profitability AS
WITH purchase_totals AS (
  SELECT
    pp.project_id,
    coalesce(sum(ppi.quantity * ppi.unit_cost) FILTER (WHERE pp.has_invoice), 0)::numeric(12,2) AS compras_con_factura,
    coalesce(sum(ppi.quantity * ppi.unit_cost) FILTER (WHERE NOT pp.has_invoice), 0)::numeric(12,2) AS compras_sin_factura
  FROM public.project_purchases pp
  LEFT JOIN public.project_purchase_items ppi ON ppi.purchase_id = pp.id
  GROUP BY pp.project_id
),
expense_totals AS (
  SELECT project_id, coalesce(sum(amount), 0)::numeric(12,2) AS total_gastos
  FROM public.project_expenses
  GROUP BY project_id
)
SELECT
  p.id AS project_id,
  p.project_number,
  p.name,
  p.status,
  c.name AS customer_name,
  coalesce(s.total, 0)::numeric(12,2) AS total_ventas,
  coalesce(pt.compras_con_factura, 0)::numeric(12,2) AS compras_con_factura,
  coalesce(pt.compras_sin_factura, 0)::numeric(12,2) AS compras_sin_factura,
  coalesce(et.total_gastos, 0)::numeric(12,2) AS total_gastos,
  round(coalesce(pt.compras_con_factura, 0) * 0.13, 2) AS credito_fiscal,
  round(coalesce(s.total, 0) * 0.13, 2) AS debito_fiscal,
  round(coalesce(s.total, 0) * 0.03, 2) AS it,
  coalesce(p.commission_amount, 0)::numeric(12,2) AS commission_amount,
  round(
    greatest(coalesce(s.total, 0) * 0.13 - coalesce(pt.compras_con_factura, 0) * 0.13, 0)
    + coalesce(s.total, 0) * 0.03
  , 2) AS impuestos_a_pagar,
  round(
    coalesce(s.total, 0)
    - coalesce(pt.compras_con_factura, 0)
    - coalesce(pt.compras_sin_factura, 0)
    - coalesce(et.total_gastos, 0)
    - coalesce(p.commission_amount, 0)
  , 2) AS utilidad_bruta,
  round(
    coalesce(s.total, 0)
    - coalesce(pt.compras_con_factura, 0)
    - coalesce(pt.compras_sin_factura, 0)
    - coalesce(et.total_gastos, 0)
    - coalesce(p.commission_amount, 0)
    - (
        greatest(coalesce(s.total, 0) * 0.13 - coalesce(pt.compras_con_factura, 0) * 0.13, 0)
        + coalesce(s.total, 0) * 0.03
      )
  , 2) AS utilidad_neta
FROM public.projects p
LEFT JOIN public.customers c ON c.id = p.customer_id
LEFT JOIN public.sales s ON s.id = p.sale_id
LEFT JOIN purchase_totals pt ON pt.project_id = p.id
LEFT JOIN expense_totals et ON et.project_id = p.id;

COMMIT;

-- Verificación
SELECT table_name
FROM information_schema.tables
WHERE table_schema = 'public'
  AND table_name IN ('projects','project_items','project_purchases','project_purchase_items','project_expenses','project_documents')
ORDER BY table_name;

SELECT viewname FROM pg_views WHERE schemaname = 'public' AND viewname = 'project_profitability';
