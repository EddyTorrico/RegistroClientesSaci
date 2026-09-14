-- SACIPETROL S.R.L. — Migración incremental CRM + Inventario + Cotizaciones
-- Ejecutar sobre la base existente. NO elimina datos.

-- 1) CLIENTES ---------------------------------------------------------------
alter table public.customers add column if not exists address text;
alter table public.customers add column if not exists phone text;
alter table public.customers add column if not exists latitude double precision;
alter table public.customers add column if not exists longitude double precision;
create index if not exists customers_zone_idx on public.customers (zone);
create index if not exists customers_city_idx on public.customers (city);
create index if not exists customers_location_idx on public.customers (latitude, longitude);

-- 2) PRODUCTOS QUE CONSUME EL CLIENTE ---------------------------------------
alter table public.customer_products add column if not exists supplier text;
alter table public.customer_products add column if not exists unit text;

-- 3) PRODUCTOS / PRECIOS ----------------------------------------------------
alter table public.products add column if not exists description text;
alter table public.products add column if not exists brand text;
alter table public.products add column if not exists purchase_price numeric(12,2) default 0;
alter table public.products add column if not exists sale_price numeric(12,2) default 0;
alter table public.products add column if not exists updated_at timestamptz default now();
create unique index if not exists products_sku_unique on public.products (sku);

-- 4) VISITAS ----------------------------------------------------------------
alter table public.visits add column if not exists opportunity_detected boolean not null default false;
alter table public.visits add column if not exists opportunity_id uuid references public.opportunities(id) on delete set null;
alter table public.visits add column if not exists needs text[];
alter table public.visits add column if not exists purchase_timing text;

-- 5) SEGUIMIENTO AUTOMÁTICO DESDE VISITA -----------------------------------
create or replace function public.create_follow_up_from_visit()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if new.next_action_date is not null and coalesce(trim(new.next_action_type), '') <> '' then
    insert into public.follow_ups (
      customer_id, user_id, type, scheduled_date, completed, notes
    ) values (
      new.customer_id,
      new.user_id,
      new.next_action_type,
      new.next_action_date,
      false,
      new.next_action_note
    );
  end if;
  return new;
end;
$$;

drop trigger if exists trg_visit_follow_up on public.visits;
create trigger trg_visit_follow_up
after insert on public.visits
for each row execute function public.create_follow_up_from_visit();

-- 6) INVENTARIO -------------------------------------------------------------
create table if not exists public.inventory_movements (
  id uuid primary key default gen_random_uuid(),
  product_id uuid not null references public.products(id) on delete cascade,
  movement_type text not null check (
    movement_type in ('inicial','entrada','salida','ajuste_entrada','ajuste_salida')
  ),
  quantity numeric(12,2) not null check (quantity > 0),
  reference text,
  notes text,
  created_by uuid references public.profiles(id),
  created_at timestamptz not null default now()
);

create index if not exists inventory_movements_product_idx
on public.inventory_movements(product_id, created_at desc);

alter table public.inventory_movements enable row level security;

drop policy if exists "Inventario visible por usuarios autenticados" on public.inventory_movements;
create policy "Inventario visible por usuarios autenticados"
on public.inventory_movements for select
using (auth.uid() is not null);

drop policy if exists "Solo admin gerente registra movimientos" on public.inventory_movements;
create policy "Solo admin gerente registra movimientos"
on public.inventory_movements for insert
with check (public.is_admin_or_gerente() and created_by = auth.uid());

drop policy if exists "Solo admin gerente elimina movimientos" on public.inventory_movements;
create policy "Solo admin gerente elimina movimientos"
on public.inventory_movements for delete
using (public.is_admin_or_gerente());

create or replace view public.product_inventory as
select
  p.id as product_id,
  p.sku,
  p.name,
  p.brand,
  p.category_id,
  p.unit,
  p.purchase_price,
  p.sale_price,
  p.active,
  coalesce(sum(
    case
      when im.movement_type in ('inicial','entrada','ajuste_entrada') then im.quantity
      when im.movement_type in ('salida','ajuste_salida') then -im.quantity
      else 0
    end
  ), 0)::numeric(12,2) as stock
from public.products p
left join public.inventory_movements im on im.product_id = p.id
group by p.id, p.sku, p.name, p.brand, p.category_id, p.unit,
         p.purchase_price, p.sale_price, p.active;

-- 7) COTIZACIONES -----------------------------------------------------------
create sequence if not exists public.quotation_number_seq;

create table if not exists public.quotations (
  id uuid primary key default gen_random_uuid(),
  quotation_number text not null unique default (
    'COT-' || to_char(current_date, 'YYYY') || '-' || lpad(nextval('public.quotation_number_seq')::text, 5, '0')
  ),
  customer_id uuid not null references public.customers(id) on delete restrict,
  user_id uuid not null references public.profiles(id),
  quotation_date date not null default current_date,
  valid_until date,
  delivery_time text,
  payment_terms text,
  status text not null default 'borrador' check (
    status in ('borrador','emitida','enviada','aceptada','rechazada','vencida')
  ),
  subtotal numeric(12,2) not null default 0,
  discount numeric(12,2) not null default 0,
  total numeric(12,2) not null default 0,
  created_at timestamptz not null default now()
);

create index if not exists quotations_customer_idx on public.quotations(customer_id);
create index if not exists quotations_user_idx on public.quotations(user_id);
create index if not exists quotations_date_idx on public.quotations(quotation_date desc);

alter table public.quotations enable row level security;

drop policy if exists "Cotizaciones visibles por dueño o admin gerente" on public.quotations;
create policy "Cotizaciones visibles por dueño o admin gerente"
on public.quotations for select
using (user_id = auth.uid() or public.is_admin_or_gerente());

drop policy if exists "Usuario crea sus cotizaciones" on public.quotations;
create policy "Usuario crea sus cotizaciones"
on public.quotations for insert
with check (user_id = auth.uid());

drop policy if exists "Dueño o admin gerente edita cotización" on public.quotations;
create policy "Dueño o admin gerente edita cotización"
on public.quotations for update
using (user_id = auth.uid() or public.is_admin_or_gerente())
with check (user_id = auth.uid() or public.is_admin_or_gerente());

drop policy if exists "Solo admin elimina cotización" on public.quotations;
create policy "Solo admin elimina cotización"
on public.quotations for delete
using (public.is_admin());

create table if not exists public.quotation_items (
  id uuid primary key default gen_random_uuid(),
  quotation_id uuid not null references public.quotations(id) on delete cascade,
  product_id uuid not null references public.products(id) on delete restrict,
  sku text not null,
  description text not null,
  quantity numeric(12,2) not null check (quantity > 0),
  unit_price numeric(12,2) not null check (unit_price >= 0),
  discount numeric(12,2) not null default 0 check (discount >= 0),
  subtotal numeric(12,2) not null default 0 check (subtotal >= 0)
);

create index if not exists quotation_items_quotation_idx on public.quotation_items(quotation_id);
create index if not exists quotation_items_product_idx on public.quotation_items(product_id);

alter table public.quotation_items enable row level security;

drop policy if exists "Items cotización visibles por propietario" on public.quotation_items;
create policy "Items cotización visibles por propietario"
on public.quotation_items for select
using (
  exists (
    select 1 from public.quotations q
    where q.id = quotation_id
      and (q.user_id = auth.uid() or public.is_admin_or_gerente())
  )
);

drop policy if exists "Usuario crea items de sus cotizaciones" on public.quotation_items;
create policy "Usuario crea items de sus cotizaciones"
on public.quotation_items for insert
with check (
  exists (
    select 1 from public.quotations q
    where q.id = quotation_id
      and (q.user_id = auth.uid() or public.is_admin_or_gerente())
  )
);

drop policy if exists "Dueño o admin edita items de cotización" on public.quotation_items;
create policy "Dueño o admin edita items de cotización"
on public.quotation_items for update
using (
  exists (
    select 1 from public.quotations q
    where q.id = quotation_id
      and (q.user_id = auth.uid() or public.is_admin_or_gerente())
  )
)
with check (
  exists (
    select 1 from public.quotations q
    where q.id = quotation_id
      and (q.user_id = auth.uid() or public.is_admin_or_gerente())
  )
);

drop policy if exists "Dueño o admin elimina items de cotización" on public.quotation_items;
create policy "Dueño o admin elimina items de cotización"
on public.quotation_items for delete
using (
  exists (
    select 1 from public.quotations q
    where q.id = quotation_id
      and (q.user_id = auth.uid() or public.is_admin_or_gerente())
  )
);

-- 8) ACTUALIZAR RLS DE PRODUCTS/PRECIOS PARA INSERTS CON WITH CHECK ---------
drop policy if exists "Solo admin/gerente gestiona productos" on public.products;
create policy "Solo admin/gerente gestiona productos"
on public.products for all
using (public.is_admin_or_gerente())
with check (public.is_admin_or_gerente());

drop policy if exists "Solo admin/gerente gestiona precios" on public.product_prices;
create policy "Solo admin/gerente gestiona precios"
on public.product_prices for all
using (public.is_admin_or_gerente())
with check (public.is_admin_or_gerente());

-- 9) FUNCIÓN DE APOYO PARA STOCK -------------------------------------------
create or replace function public.get_product_stock(p_product_id uuid)
returns numeric
language sql
stable
security definer
set search_path = public
as $$
  select coalesce(sum(
    case
      when movement_type in ('inicial','entrada','ajuste_entrada') then quantity
      when movement_type in ('salida','ajuste_salida') then -quantity
      else 0
    end
  ), 0)
  from public.inventory_movements
  where product_id = p_product_id;
$$;

-- 10) ÍNDICES / FECHAS ------------------------------------------------------
create index if not exists visits_customer_date_idx on public.visits(customer_id, visit_date desc);
create index if not exists follow_ups_scheduled_idx on public.follow_ups(scheduled_date, completed);

select 'SACIPETROL: migración CRM + inventario + cotizaciones lista' as resultado;
