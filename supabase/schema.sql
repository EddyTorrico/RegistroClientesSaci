-- SACIPETROL S.R.L. — Esquema inicial completo e idempotente
-- Para una base existente: usar migration_requerimientos_2026.sql después de este esquema.
-- NO elimina datos existentes.

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname='user_role' AND typnamespace='public'::regnamespace) THEN
    CREATE TYPE public.user_role AS ENUM ('admin','gerente','vendedor');
  END IF;
END $$;

create table if not exists public.profiles (
 id uuid primary key references auth.users(id) on delete cascade,
 full_name text not null,
 role public.user_role not null default 'vendedor',
 phone text, active boolean not null default true, created_at timestamptz not null default now()
); alter table public.profiles enable row level security;

create or replace function public.is_admin() returns boolean language plpgsql security definer set search_path=public as $$ begin return exists(select 1 from public.profiles where id=auth.uid() and role='admin'::public.user_role and active=true); end; $$;
create or replace function public.is_admin_or_gerente() returns boolean language plpgsql security definer set search_path=public as $$ begin return exists(select 1 from public.profiles where id=auth.uid() and role in ('admin'::public.user_role,'gerente'::public.user_role) and active=true); end; $$;

drop policy if exists "Ver propio perfil o admin/gerente ven todos" on public.profiles;
create policy "Ver propio perfil o admin/gerente ven todos" on public.profiles for select using(auth.uid()=id or public.is_admin_or_gerente());
drop policy if exists "Admin modifica cualquier perfil" on public.profiles;
create policy "Admin modifica cualquier perfil" on public.profiles for update using(public.is_admin()) with check(public.is_admin());
drop policy if exists "Cada usuario edita datos básicos de su perfil" on public.profiles;
create policy "Cada usuario edita datos básicos de su perfil" on public.profiles for update using(auth.uid()=id) with check(auth.uid()=id);

create or replace function public.handle_new_user() returns trigger language plpgsql security definer set search_path=public as $$ declare v_role public.user_role; begin begin v_role=coalesce((new.raw_user_meta_data->>'role')::public.user_role,'vendedor'::public.user_role); exception when invalid_text_representation then v_role='vendedor'::public.user_role; end; insert into public.profiles(id,full_name,role) values(new.id,coalesce(new.raw_user_meta_data->>'full_name',new.email,'Usuario'),v_role) on conflict(id) do nothing; return new; end; $$;
drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created after insert on auth.users for each row execute function public.handle_new_user();

create table if not exists public.customers (
 id uuid primary key default gen_random_uuid(), name text not null, business_types text[], zone text, city text,
 address text, phone text, latitude double precision, longitude double precision,
 created_by uuid references public.profiles(id), created_at timestamptz not null default now()
); alter table public.customers enable row level security;
drop policy if exists "Clientes visibles por todos los usuarios autenticados" on public.customers;
create policy "Clientes visibles por todos los usuarios autenticados" on public.customers for select using(auth.uid() is not null);
drop policy if exists "Cualquier usuario autenticado crea clientes" on public.customers;
create policy "Cualquier usuario autenticado crea clientes" on public.customers for insert with check(auth.uid() is not null and created_by=auth.uid());
drop policy if exists "Creador o admin/gerente edita cliente" on public.customers;
create policy "Creador o admin/gerente edita cliente" on public.customers for update using(created_by=auth.uid() or public.is_admin_or_gerente()) with check(created_by=auth.uid() or public.is_admin_or_gerente());
drop policy if exists "Solo admin elimina cliente" on public.customers;
create policy "Solo admin elimina cliente" on public.customers for delete using(public.is_admin());

create table if not exists public.customer_contacts (id uuid primary key default gen_random_uuid(),customer_id uuid references public.customers(id) on delete cascade,name text not null,position text,phone text,whatsapp text,email text,is_decision_maker text check(is_decision_maker in('sí','no','parcialmente')),created_at timestamptz not null default now()); alter table public.customer_contacts enable row level security;
drop policy if exists "Contactos visibles por todos los usuarios autenticados" on public.customer_contacts; create policy "Contactos visibles por todos los usuarios autenticados" on public.customer_contacts for select using(auth.uid() is not null);
drop policy if exists "Cualquier usuario autenticado gestiona contactos" on public.customer_contacts; create policy "Cualquier usuario autenticado gestiona contactos" on public.customer_contacts for all using(auth.uid() is not null) with check(auth.uid() is not null);

create table if not exists public.customer_products (id uuid primary key default gen_random_uuid(),customer_id uuid references public.customers(id) on delete cascade,description text not null,frequency text,approx_quantity numeric,unit text,usual_brand text,supplier text,observations text,created_at timestamptz not null default now()); alter table public.customer_products enable row level security;
drop policy if exists "Productos del cliente visibles por todos" on public.customer_products; create policy "Productos del cliente visibles por todos" on public.customer_products for select using(auth.uid() is not null);
drop policy if exists "Cualquier usuario autenticado gestiona productos del cliente" on public.customer_products; create policy "Cualquier usuario autenticado gestiona productos del cliente" on public.customer_products for all using(auth.uid() is not null) with check(auth.uid() is not null);

create table if not exists public.categories(id uuid primary key default gen_random_uuid(),name text not null,created_at timestamptz not null default now()); alter table public.categories enable row level security; create unique index if not exists categories_name_unique on public.categories(lower(name));
drop policy if exists "Categorías visibles por todos" on public.categories; create policy "Categorías visibles por todos" on public.categories for select using(auth.uid() is not null);
drop policy if exists "Solo admin/gerente gestiona categorías" on public.categories; create policy "Solo admin/gerente gestiona categorías" on public.categories for all using(public.is_admin_or_gerente()) with check(public.is_admin_or_gerente());

create table if not exists public.products(id uuid primary key default gen_random_uuid(),category_id uuid references public.categories(id) on delete set null,sku text not null,name text not null,description text,image_url text,brand text,unit text default 'unidad',purchase_price numeric(12,2) default 0,sale_price numeric(12,2) default 0,active boolean not null default true,created_at timestamptz not null default now(),updated_at timestamptz not null default now()); alter table public.products enable row level security; create unique index if not exists products_sku_unique on public.products(sku); create index if not exists products_category_idx on public.products(category_id); create index if not exists products_active_idx on public.products(active);
drop policy if exists "Productos visibles por todos" on public.products; create policy "Productos visibles por todos" on public.products for select using(auth.uid() is not null);
drop policy if exists "Solo admin/gerente gestiona productos" on public.products; create policy "Solo admin/gerente gestiona productos" on public.products for all using(public.is_admin_or_gerente()) with check(public.is_admin_or_gerente());

create table if not exists public.product_prices(id uuid primary key default gen_random_uuid(),product_id uuid references public.products(id) on delete cascade,price_type text not null check(price_type in('minorista','mayorista','distribuidor','especial')),price numeric(12,2) not null check(price>=0),currency text not null default 'BOB',active boolean not null default true,created_at timestamptz not null default now()); alter table public.product_prices enable row level security; create index if not exists product_prices_product_idx on public.product_prices(product_id);
drop policy if exists "Precios visibles por todos" on public.product_prices; create policy "Precios visibles por todos" on public.product_prices for select using(auth.uid() is not null);
drop policy if exists "Solo admin/gerente gestiona precios" on public.product_prices; create policy "Solo admin/gerente gestiona precios" on public.product_prices for all using(public.is_admin_or_gerente()) with check(public.is_admin_or_gerente());

create table if not exists public.visits(id uuid primary key default gen_random_uuid(),customer_id uuid references public.customers(id) on delete cascade,user_id uuid references public.profiles(id),visit_date timestamptz not null default now(),latitude double precision,longitude double precision,address text,zone text,photo_url text,provider_name text,provider_reasons text[],needs text[],need_description text,purchase_timing text,estimated_amount numeric(12,2),interest_level text check(interest_level in('Bajo','Medio','Alto')),result text,opportunity_detected boolean not null default false,opportunity_id uuid,next_action_type text,next_action_date date,next_action_note text); alter table public.visits enable row level security;
create table if not exists public.opportunities(id uuid primary key default gen_random_uuid(),customer_id uuid references public.customers(id) on delete cascade,user_id uuid references public.profiles(id),title text not null,valor_estimado numeric(12,2) not null default 0,probabilidad integer not null default 0 check(probabilidad between 0 and 100),estado text not null default 'detectada' check(estado in('detectada','en_negociacion','ganada','perdida')),next_action_date date,created_at timestamptz not null default now()); alter table public.opportunities enable row level security;
alter table public.visits add constraint visits_opportunity_fk foreign key(opportunity_id) references public.opportunities(id) on delete set null;

drop policy if exists "Visitas visibles por dueño o admin/gerente" on public.visits; create policy "Visitas visibles por dueño o admin/gerente" on public.visits for select using(user_id=auth.uid() or public.is_admin_or_gerente());
drop policy if exists "Usuario crea sus visitas" on public.visits; create policy "Usuario crea sus visitas" on public.visits for insert with check(user_id=auth.uid());
drop policy if exists "Dueño o admin/gerente edita visita" on public.visits; create policy "Dueño o admin/gerente edita visita" on public.visits for update using(user_id=auth.uid() or public.is_admin_or_gerente()) with check(user_id=auth.uid() or public.is_admin_or_gerente());
drop policy if exists "Solo admin elimina visita" on public.visits; create policy "Solo admin elimina visita" on public.visits for delete using(public.is_admin());
drop policy if exists "Oportunidades visibles por dueño o admin/gerente" on public.opportunities; create policy "Oportunidades visibles por dueño o admin/gerente" on public.opportunities for select using(user_id=auth.uid() or public.is_admin_or_gerente());
drop policy if exists "Usuario crea sus oportunidades" on public.opportunities; create policy "Usuario crea sus oportunidades" on public.opportunities for insert with check(user_id=auth.uid());
drop policy if exists "Dueño o admin/gerente edita oportunidad" on public.opportunities; create policy "Dueño o admin/gerente edita oportunidad" on public.opportunities for update using(user_id=auth.uid() or public.is_admin_or_gerente()) with check(user_id=auth.uid() or public.is_admin_or_gerente());

create table if not exists public.follow_ups(id uuid primary key default gen_random_uuid(),customer_id uuid references public.customers(id) on delete cascade,user_id uuid references public.profiles(id),type text not null,scheduled_date date not null,completed boolean not null default false,notes text,created_at timestamptz not null default now()); alter table public.follow_ups enable row level security;
drop policy if exists "Seguimientos visibles por dueño o admin/gerente" on public.follow_ups; create policy "Seguimientos visibles por dueño o admin/gerente" on public.follow_ups for select using(user_id=auth.uid() or public.is_admin_or_gerente());
drop policy if exists "Usuario crea sus seguimientos" on public.follow_ups; create policy "Usuario crea sus seguimientos" on public.follow_ups for insert with check(user_id=auth.uid());
drop policy if exists "Dueño o admin/gerente actualiza seguimiento" on public.follow_ups; create policy "Dueño o admin/gerente actualiza seguimiento" on public.follow_ups for update using(user_id=auth.uid() or public.is_admin_or_gerente()) with check(user_id=auth.uid() or public.is_admin_or_gerente());

-- El inventario, cotizaciones y el trigger de seguimiento se agregan en la migración.
select 'SACIPETROL: esquema inicial idempotente listo' as resultado;


-- Fase 2: observaciones en cotizaciones y asignación por admin/gerente
alter table public.quotations add column if not exists observations text;
drop policy if exists "Usuario crea sus cotizaciones" on public.quotations;
create policy "Usuario crea sus cotizaciones" on public.quotations for insert with check(user_id=auth.uid() or public.is_admin_or_gerente());


-- Fase 4: semáforos y dashboard comercial
alter table public.opportunities add column if not exists next_action_date date;
create index if not exists opportunities_next_action_date_idx on public.opportunities(next_action_date);

-- Fase 5: visitas múltiples, seguimiento enlazado e inventario con ventas
alter table public.visits add column if not exists result_options text[] not null default '{}'::text[];
alter table public.follow_ups add column if not exists opportunity_id uuid references public.opportunities(id) on delete set null;
create index if not exists follow_ups_opportunity_idx on public.follow_ups(opportunity_id, scheduled_date);
-- Los estados adicionales y el tipo venta se aplican mediante migration_fase5_flujos_reportes.sql.
