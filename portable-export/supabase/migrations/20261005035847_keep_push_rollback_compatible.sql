-- Keep database push calls compatible with both the stable pre-hardening
-- worker and the hardened worker. The publishable API key is public by design;
-- authorization in the hardened worker still requires x-dispatch-token.
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
  loop
    ddl := pg_get_functiondef(r.oid);
    ddl := replace(
      ddl,
      '''Content-Type'', ''application/json'', ''x-dispatch-token'', v_anon_key',
      '''Content-Type'', ''application/json'', ''apikey'', ''sb_publishable_rxqHb79-KneH3UZGHj2fDA_5ofGaUds'', ''x-dispatch-token'', v_anon_key'
    );
    execute ddl;
  end loop;
end
$$;
