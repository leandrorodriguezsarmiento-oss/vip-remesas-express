-- Complete rollback compatibility for every database trigger that dispatches
-- push notifications. Stable pre-hardening workers accept the public apikey;
-- hardened workers additionally require the private x-dispatch-token.
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
      and pg_get_functiondef(p.oid) ilike '%x-dispatch-token%'
      and pg_get_functiondef(p.oid) not ilike '%sb_publishable_rxqHb79-KneH3UZGHj2fDA_5ofGaUds%'
  loop
    ddl := pg_get_functiondef(r.oid);
    ddl := replace(
      ddl,
      '''x-dispatch-token'', v_anon_key',
      '''apikey'', ''sb_publishable_rxqHb79-KneH3UZGHj2fDA_5ofGaUds'', ''x-dispatch-token'', v_anon_key'
    );
    execute ddl;
  end loop;
end
$$;
