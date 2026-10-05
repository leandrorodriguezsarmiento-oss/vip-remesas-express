-- VIP Remesas hardening: push delivery, RPC permissions, duplicate notifications,
-- and low-risk database performance fixes.

do $$
declare
  v_token text;
begin
  select decrypted_secret
    into v_token
  from vault.decrypted_secrets
  where name = 'push_dispatch_token'
  order by created_at desc
  limit 1;

  if v_token is null then
    v_token := encode(gen_random_bytes(32), 'hex');
    perform vault.create_secret(
      v_token,
      'push_dispatch_token',
      'Internal token used only by Postgres triggers to call vipremesas.com push dispatcher'
    );
  end if;

  insert into public.bot_publish_tokens (name, token_hash, active)
  values ('push-dispatch', encode(digest(v_token, 'sha256'), 'hex'), true)
  on conflict (name) do update
    set token_hash = excluded.token_hash,
        active = true,
        updated_at = now();
end
$$;

do $$
declare
  r record;
  ddl text;
begin
  for r in
    select p.oid
    from pg_proc p
    join pg_namespace n on n.oid = p.pronamespace
    where n.nspname = 'public'
      and p.prokind = 'f'
      and (
        pg_get_functiondef(p.oid) ilike '%tudominio.com/api/public/push/dispatch%'
        or pg_get_functiondef(p.oid) ilike '%uoglxwtritcsrglwimej%'
      )
  loop
    ddl := pg_get_functiondef(r.oid);
    ddl := replace(
      ddl,
      'https://tudominio.com/api/public/push/dispatch',
      'https://vipremesas.com/api/public/push/dispatch'
    );
    ddl := regexp_replace(
      ddl,
      'v_anon_key text := ''[^'']+'';',
      'v_anon_key text := (select decrypted_secret from vault.decrypted_secrets where name = ''push_dispatch_token'' order by created_at desc limit 1);',
      'g'
    );
    ddl := replace(
      ddl,
      '''apikey'', v_anon_key',
      '''x-dispatch-token'', v_anon_key'
    );
    execute ddl;
  end loop;
end
$$;

drop trigger if exists trg_notify_admin_recarga_activity on public.recargas_requests;
drop trigger if exists trg_notify_admin_store_activity on public.store_orders;

create or replace function public.has_organizer_permission(_user_id uuid, _permission text)
returns boolean
language sql
stable
security definer
set search_path to 'public'
as $function$
  select
    (auth.uid() is null or _user_id = auth.uid())
    and (
      exists (
        select 1
        from public.user_roles
        where user_id = _user_id
          and role = 'admin'
      )
      or exists (
        select 1
        from public.user_roles ur
        join public.organizer_permissions op
          on op.user_id = ur.user_id
        where ur.user_id = _user_id
          and ur.role = 'organizador'
          and op.permission = _permission
      )
    );
$function$;

revoke execute on function public.has_organizer_permission(uuid, text) from public, anon;
grant execute on function public.has_organizer_permission(uuid, text) to authenticated, service_role;

revoke execute on function public.has_role(uuid, public.app_role) from public, anon;
grant execute on function public.has_role(uuid, public.app_role) to authenticated, service_role;

revoke execute on function public.notify_admins_for_user_action(uuid, text, text, uuid) from public, anon, authenticated;
grant execute on function public.notify_admins_for_user_action(uuid, text, text, uuid) to service_role;

do $$
declare
  fn text;
begin
  foreach fn in array array[
    'notify_admin_new_profile',
    'notify_admin_recarga_activity',
    'notify_admin_store_activity',
    'notify_admin_completion',
    'notify_admin_new_recarga',
    'notify_admin_new_store_order',
    'notify_admin_new_tx',
    'notify_admin_tx_paid',
    'notify_food_order_status_change',
    'notify_mp_payment_status_change',
    'notify_organizers_processing',
    'notify_owner_new_food_order',
    'notify_recarga_created',
    'notify_recarga_status_change',
    'notify_store_order_status_change',
    'notify_tx_status_change',
    'notify_users_new_offer'
  ]
  loop
    if to_regprocedure(format('public.%I()', fn)) is not null then
      execute format('revoke execute on function public.%I() from public, anon, authenticated', fn);
    end if;
  end loop;
end
$$;

do $$
declare
  p record;
  stmt text;
  new_qual text;
  new_check text;
begin
  for p in
    select schemaname, tablename, policyname, qual, with_check
    from pg_policies
    where schemaname = 'public'
      and (
        (qual like '%auth.uid()%' and qual not like '%select auth.uid()%')
        or
        (with_check like '%auth.uid()%' and with_check not like '%select auth.uid()%')
      )
  loop
    new_qual := case when p.qual is null then null else replace(p.qual, 'auth.uid()', '(select auth.uid())') end;
    new_check := case when p.with_check is null then null else replace(p.with_check, 'auth.uid()', '(select auth.uid())') end;

    stmt := format('alter policy %I on %I.%I', p.policyname, p.schemaname, p.tablename);
    if new_qual is not null then
      stmt := stmt || format(' using (%s)', new_qual);
    end if;
    if new_check is not null then
      stmt := stmt || format(' with check (%s)', new_check);
    end if;
    execute stmt;
  end loop;
end
$$;

create index if not exists food_items_restaurant_id_idx on public.food_items (restaurant_id);
create index if not exists food_orders_restaurant_id_idx on public.food_orders (restaurant_id);
create index if not exists food_orders_user_id_idx on public.food_orders (user_id);
create index if not exists login_aliases_user_id_idx on public.login_aliases (user_id);
create index if not exists mercadopago_payments_transaction_id_idx on public.mercadopago_payments (transaction_id);
create index if not exists notifications_tx_id_idx on public.notifications (tx_id);
create index if not exists notifications_user_id_idx on public.notifications (user_id);
create index if not exists push_subscriptions_user_id_idx on public.push_subscriptions (user_id);
create index if not exists recargas_requests_assigned_to_idx on public.recargas_requests (assigned_to);
create index if not exists recargas_requests_promo_id_idx on public.recargas_requests (promo_id);
create index if not exists recargas_requests_user_id_idx on public.recargas_requests (user_id);
create index if not exists restaurants_owner_id_idx on public.restaurants (owner_id);
create index if not exists store_orders_assigned_to_idx on public.store_orders (assigned_to);
create index if not exists store_orders_user_id_idx on public.store_orders (user_id);
create index if not exists transactions_assigned_to_idx on public.transactions (assigned_to);
create index if not exists transactions_user_id_idx on public.transactions (user_id);
create index if not exists verification_codes_user_id_idx on public.verification_codes (user_id);

drop index if exists public.login_aliases_alias_lower_key;
