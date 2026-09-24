create table if not exists public.cash_delivery_locations (
  id uuid primary key default gen_random_uuid(),
  municipality text not null unique,
  active boolean not null default true,
  sort_order integer not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.cash_delivery_locations enable row level security;

drop policy if exists "Signed-in reads active cash delivery locations" on public.cash_delivery_locations;
create policy "Signed-in reads active cash delivery locations"
on public.cash_delivery_locations
for select
to authenticated
using (active = true or public.has_role(auth.uid(), 'admin'::public.app_role));

drop policy if exists "Admins manage cash delivery locations" on public.cash_delivery_locations;
create policy "Admins manage cash delivery locations"
on public.cash_delivery_locations
for all
to authenticated
using (public.has_role(auth.uid(), 'admin'::public.app_role))
with check (public.has_role(auth.uid(), 'admin'::public.app_role));

grant select, insert, update, delete on public.cash_delivery_locations to authenticated;
grant all on public.cash_delivery_locations to service_role;

insert into public.cash_delivery_locations (municipality, active, sort_order)
values
  ('La Habana', true, 10),
  ('Matanzas', true, 20),
  ('Las Tunas', true, 30),
  ('Santiago de Cuba', true, 40)
on conflict (municipality) do nothing;

alter table public.transactions
  add column if not exists delivery_location text;

alter table public.recipients
  add column if not exists delivery_location text;

create index if not exists transactions_delivery_location_idx
  on public.transactions (delivery_location)
  where method_category = 'efectivo';
