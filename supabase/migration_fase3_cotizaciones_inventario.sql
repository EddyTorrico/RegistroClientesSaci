-- SACIPETROL S.R.L. — Fase 3
-- Cotizaciones con dirección/marca histórica + mejoras de inventario en interfaz.
-- Seguro para una base existente. No elimina datos.

begin;

-- Conserva la dirección que tenía el cliente al momento de emitir la cotización.
alter table public.quotations
  add column if not exists customer_address text;

-- Conserva marca y unidad del producto tal como estaban al emitir la cotización.
alter table public.quotation_items
  add column if not exists brand text;

alter table public.quotation_items
  add column if not exists unit text;

commit;

-- Verificación
select table_name, column_name, data_type
from information_schema.columns
where table_schema = 'public'
  and (
    (table_name = 'quotations' and column_name = 'customer_address')
    or
    (table_name = 'quotation_items' and column_name in ('brand','unit'))
  )
order by table_name, column_name;
