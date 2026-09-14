-- SACIPETROL - Fase 5
-- Flujo de visitas, seguimientos encadenados, estados sincronizados e inventario

begin;

-- 1) Visitas: resultados múltiples sin romper el campo result histórico
alter table public.visits
  add column if not exists result_options text[] not null default '{}'::text[];

update public.visits
set result_options = array[result]
where coalesce(trim(result), '') <> ''
  and cardinality(result_options) = 0;

-- 2) Seguimientos enlazados a oportunidades
alter table public.follow_ups
  add column if not exists opportunity_id uuid references public.opportunities(id) on delete set null;

create index if not exists follow_ups_opportunity_idx
  on public.follow_ups(opportunity_id, scheduled_date);

-- Backfill razonable para seguimientos creados automáticamente desde visitas
update public.follow_ups f
set opportunity_id = v.opportunity_id
from public.visits v
where f.opportunity_id is null
  and v.opportunity_id is not null
  and f.customer_id = v.customer_id
  and f.user_id = v.user_id
  and f.scheduled_date = v.next_action_date
  and coalesce(trim(f.type), '') = coalesce(trim(v.next_action_type), '');

-- Reemplazar trigger para que nuevos seguimientos conserven opportunity_id
create or replace function public.create_follow_up_from_visit()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if new.next_action_date is not null and coalesce(trim(new.next_action_type), '') <> '' then
    insert into public.follow_ups (
      customer_id, user_id, opportunity_id, type, scheduled_date, completed, notes
    ) values (
      new.customer_id,
      new.user_id,
      new.opportunity_id,
      new.next_action_type,
      new.next_action_date,
      false,
      new.next_action_note
    );
  end if;
  return new;
end;
$$;


-- Admin/Gerente también puede encadenar seguimiento de vendedores
drop policy if exists "Usuario crea sus seguimientos" on public.follow_ups;
create policy "Usuario crea sus seguimientos"
on public.follow_ups for insert
with check (user_id = auth.uid() or public.is_admin_or_gerente());

-- Sincronización automática Seguimientos -> Oportunidades
create or replace function public.sync_opportunity_from_follow_up()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if new.opportunity_id is null then
    return new;
  end if;

  if tg_op = 'INSERT' and not new.completed then
    update public.opportunities
    set next_action_date = new.scheduled_date,
        estado = case when estado in ('ganada','perdida') then estado else 'en_negociacion' end
    where id = new.opportunity_id;
  elsif tg_op = 'UPDATE' and new.completed = true and old.completed = false then
    update public.opportunities
    set next_action_date = null,
        estado = case when estado in ('ganada','perdida','cerrada') then estado else 'atendida' end
    where id = new.opportunity_id;
  end if;
  return new;
end;
$$;

drop trigger if exists trg_follow_up_sync_opportunity on public.follow_ups;
create trigger trg_follow_up_sync_opportunity
after insert or update of completed, scheduled_date on public.follow_ups
for each row execute function public.sync_opportunity_from_follow_up();

-- 3) Estados adicionales para reflejar seguimiento atendido/cerrado
alter table public.opportunities
  drop constraint if exists opportunities_estado_check;

alter table public.opportunities
  add constraint opportunities_estado_check
  check (estado in ('detectada','en_negociacion','atendida','cerrada','ganada','perdida'));

-- 4) Inventario: tipo Venta diferenciado para reportes
alter table public.inventory_movements
  drop constraint if exists inventory_movements_movement_type_check;

alter table public.inventory_movements
  add constraint inventory_movements_movement_type_check
  check (movement_type in ('inicial','entrada','salida','venta','ajuste_entrada','ajuste_salida'));

-- Recrear vista para descontar ventas del stock
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
  p.image_url,
  p.active,
  coalesce(sum(
    case
      when im.movement_type in ('inicial','entrada','ajuste_entrada') then im.quantity
      when im.movement_type in ('salida','venta','ajuste_salida') then -im.quantity
      else 0
    end
  ), 0)::numeric(12,2) as stock
from public.products p
left join public.inventory_movements im on im.product_id = p.id
group by p.id, p.sku, p.name, p.brand, p.category_id, p.unit,
         p.purchase_price, p.sale_price, p.image_url, p.active;

commit;

select 'visits.result_options' as cambio, data_type
from information_schema.columns
where table_schema='public' and table_name='visits' and column_name='result_options'
union all
select 'follow_ups.opportunity_id', data_type
from information_schema.columns
where table_schema='public' and table_name='follow_ups' and column_name='opportunity_id';
