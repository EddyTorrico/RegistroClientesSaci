-- ============================================================================
-- SACIPETROL S.R.L. — Script único para Supabase SQL Editor
-- Pega TODO este archivo de una sola vez en: Supabase -> SQL Editor -> New query
-- ============================================================================

-- 1. Roles y perfiles ---------------------------------------------------------
create type user_role as enum ('admin', 'gerente', 'vendedor');

create table public.profiles (
  id uuid references auth.users(id) on delete cascade primary key,
  full_name text not null,
  role user_role not null default 'vendedor',
  phone text,
  active boolean not null default true,
  created_at timestamptz default now()
);
alter table public.profiles enable row level security;

-- Función auxiliar (evita recursión infinita en las políticas)
create or replace function public.is_admin_or_gerente()
returns boolean as $$
begin
  return exists (
    select 1 from public.profiles
    where id = auth.uid() and role in ('admin', 'gerente')
  );
end;
$$ language plpgsql security definer;

create or replace function public.is_admin()
returns boolean as $$
begin
  return exists (select 1 from public.profiles where id = auth.uid() and role = 'admin');
end;
$$ language plpgsql security definer;

create policy "Ver propio perfil o admin/gerente ven todos"
  on public.profiles for select
  using (auth.uid() = id or public.is_admin_or_gerente());

create policy "Admin modifica cualquier perfil"
  on public.profiles for update
  using (public.is_admin());

create policy "Cada usuario edita datos básicos de su perfil"
  on public.profiles for update
  using (auth.uid() = id)
  with check (role = (select role from public.profiles where id = auth.uid()));

-- Crea automáticamente el perfil cuando se registra un usuario nuevo
create or replace function public.handle_new_user()
returns trigger as $$
begin
  insert into public.profiles (id, full_name, role)
  values (
    new.id,
    coalesce(new.raw_user_meta_data->>'full_name', 'Usuario'),
    coalesce((new.raw_user_meta_data->>'role')::user_role, 'vendedor')
  );
  return new;
end;
$$ language plpgsql security definer;

create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

-- 2. Clientes y contactos -----------------------------------------------------
create table public.customers (
  id uuid default gen_random_uuid() primary key,
  name text not null,
  business_types text[],
  zone text,
  city text,
  created_by uuid references public.profiles(id),
  created_at timestamptz default now()
);
alter table public.customers enable row level security;

create policy "Clientes visibles por todos los usuarios autenticados"
  on public.customers for select
  using (auth.uid() is not null);

create policy "Cualquier usuario autenticado crea clientes"
  on public.customers for insert
  with check (auth.uid() is not null);

create policy "Creador o admin/gerente edita cliente"
  on public.customers for update
  using (created_by = auth.uid() or public.is_admin_or_gerente());

create policy "Solo admin elimina cliente"
  on public.customers for delete
  using (public.is_admin());

create table public.customer_contacts (
  id uuid default gen_random_uuid() primary key,
  customer_id uuid references public.customers(id) on delete cascade,
  name text not null,
  position text,
  phone text,
  whatsapp text,
  email text,
  is_decision_maker text check (is_decision_maker in ('sí', 'no', 'parcialmente')),
  created_at timestamptz default now()
);
alter table public.customer_contacts enable row level security;

create policy "Contactos visibles por todos los usuarios autenticados"
  on public.customer_contacts for select
  using (auth.uid() is not null);

create policy "Cualquier usuario autenticado gestiona contactos"
  on public.customer_contacts for all
  using (auth.uid() is not null);

-- Productos que consume cada cliente (persistente, no por visita)
create table public.customer_products (
  id uuid default gen_random_uuid() primary key,
  customer_id uuid references public.customers(id) on delete cascade,
  description text not null,
  frequency text,
  approx_quantity numeric,
  usual_brand text,
  observations text,
  created_at timestamptz default now()
);
alter table public.customer_products enable row level security;

create policy "Productos del cliente visibles por todos"
  on public.customer_products for select
  using (auth.uid() is not null);

create policy "Cualquier usuario autenticado gestiona productos del cliente"
  on public.customer_products for all
  using (auth.uid() is not null);

-- 3. Catálogo (Categorías, Productos, Precios) --------------------------------
create table public.categories (
  id uuid default gen_random_uuid() primary key,
  name text not null,
  created_at timestamptz default now()
);
alter table public.categories enable row level security;

create policy "Categorías visibles por todos" on public.categories for select using (auth.uid() is not null);
create policy "Solo admin/gerente gestiona categorías" on public.categories for all using (public.is_admin_or_gerente());

create table public.products (
  id uuid default gen_random_uuid() primary key,
  category_id uuid references public.categories(id),
  sku text not null,
  name text not null,
  unit text,
  active boolean default true,
  created_at timestamptz default now()
);
alter table public.products enable row level security;

create policy "Productos visibles por todos" on public.products for select using (auth.uid() is not null);
create policy "Solo admin/gerente gestiona productos" on public.products for all using (public.is_admin_or_gerente());

create table public.product_prices (
  id uuid default gen_random_uuid() primary key,
  product_id uuid references public.products(id) on delete cascade,
  price_type text check (price_type in ('minorista', 'mayorista', 'distribuidor', 'especial')) not null,
  price numeric not null,
  currency text default 'BOB',
  active boolean default true,
  created_at timestamptz default now()
);
alter table public.product_prices enable row level security;

create policy "Precios visibles por todos" on public.product_prices for select using (auth.uid() is not null);
create policy "Solo admin/gerente gestiona precios" on public.product_prices for all using (public.is_admin_or_gerente());

-- 4. Visitas -------------------------------------------------------------------
create table public.visits (
  id uuid default gen_random_uuid() primary key,
  customer_id uuid references public.customers(id) on delete cascade,
  user_id uuid references public.profiles(id),
  visit_date timestamptz default now(),
  latitude double precision,
  longitude double precision,
  address text,
  zone text,
  photo_url text,
  provider_name text,
  provider_reasons text[],
  need_description text,
  estimated_amount numeric,
  interest_level text check (interest_level in ('Bajo', 'Medio', 'Alto')),
  result text,
  next_action_type text,
  next_action_date date,
  next_action_note text
);
alter table public.visits enable row level security;

create policy "Visitas visibles por dueño o admin/gerente"
  on public.visits for select
  using (user_id = auth.uid() or public.is_admin_or_gerente());

create policy "Usuario crea sus visitas"
  on public.visits for insert
  with check (user_id = auth.uid());

create policy "Dueño o admin/gerente edita visita"
  on public.visits for update
  using (user_id = auth.uid() or public.is_admin_or_gerente());

create policy "Solo admin elimina visita"
  on public.visits for delete
  using (public.is_admin());

-- 5. Oportunidades ---------------------------------------------------------
create table public.opportunities (
  id uuid default gen_random_uuid() primary key,
  customer_id uuid references public.customers(id) on delete cascade,
  user_id uuid references public.profiles(id),
  title text not null,
  valor_estimado numeric default 0,
  probabilidad int default 0,
  estado text check (estado in ('detectada', 'en_negociacion', 'ganada', 'perdida')) default 'detectada',
  created_at timestamptz default now()
);
alter table public.opportunities enable row level security;

create policy "Oportunidades visibles por dueño o admin/gerente"
  on public.opportunities for select
  using (user_id = auth.uid() or public.is_admin_or_gerente());

create policy "Usuario crea sus oportunidades"
  on public.opportunities for insert
  with check (user_id = auth.uid());

create policy "Dueño o admin/gerente edita oportunidad"
  on public.opportunities for update
  using (user_id = auth.uid() or public.is_admin_or_gerente());

-- 6. Seguimientos ------------------------------------------------------------
create table public.follow_ups (
  id uuid default gen_random_uuid() primary key,
  customer_id uuid references public.customers(id) on delete cascade,
  user_id uuid references public.profiles(id),
  type text not null,
  scheduled_date date not null,
  completed boolean default false,
  notes text,
  created_at timestamptz default now()
);
alter table public.follow_ups enable row level security;

create policy "Seguimientos visibles por dueño o admin/gerente"
  on public.follow_ups for select
  using (user_id = auth.uid() or public.is_admin_or_gerente());

create policy "Usuario crea sus seguimientos"
  on public.follow_ups for insert
  with check (user_id = auth.uid());

create policy "Dueño o admin/gerente actualiza seguimiento"
  on public.follow_ups for update
  using (user_id = auth.uid() or public.is_admin_or_gerente());

-- ============================================================================
-- Fin del script. Después de ejecutarlo, sigue los pasos de configuración
-- inicial (crear tu usuario admin y el bucket de fotos) que están en el README.
-- ============================================================================
