create table public.verification_codes (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references auth.users(id) on delete cascade not null,
  email text not null,
  code text not null,
  type text not null default 'email',
  expires_at timestamptz not null,
  verified boolean not null default false,
  created_at timestamptz not null default now()
);

grant select, insert, update, delete on public.verification_codes to authenticated;
grant all on public.verification_codes to service_role;

alter table public.verification_codes enable row level security;

create policy "Users can read own verification codes"
on public.verification_codes
for select
to authenticated
using (auth.uid() = user_id);

create policy "Users can insert own verification codes"
on public.verification_codes
for insert
to authenticated
with check (auth.uid() = user_id);

create policy "Users can update own verification codes"
on public.verification_codes
for update
to authenticated
using (auth.uid() = user_id)
with check (auth.uid() = user_id);