-- SACIPETROL S.R.L. — Fase 2
-- Edición de productos + mejoras de cotizaciones
-- Seguro para una base existente. No elimina datos.

begin;

-- Observaciones visibles en la cotización impresa.
alter table public.quotations
  add column if not exists observations text;

-- Un vendedor puede crear cotizaciones a su propio nombre.
-- Admin/Gerente pueden crear una cotización y asignarla a cualquier usuario activo.
drop policy if exists "Usuario crea sus cotizaciones" on public.quotations;
create policy "Usuario crea sus cotizaciones"
on public.quotations for insert
with check (
  user_id = auth.uid()
  or public.is_admin_or_gerente()
);

commit;

-- Verificación
select column_name, data_type
from information_schema.columns
where table_schema='public'
  and table_name='quotations'
  and column_name='observations';
