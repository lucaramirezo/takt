-- takt manual migration 0001: takt_api role, grants, and Row-Level Security.
-- Apply AFTER `drizzle-kit migrate`. Bare enum names only (no _enum suffix).
-- The app bridges tenant context via withOrgCtx() in @takt/db (SET LOCAL role + app.* GUCs).

-- 1. Non-superuser app role (no BYPASS RLS).
do $$ begin
  if not exists (select from pg_roles where rolname = 'takt_api') then
    create role takt_api nologin;
  end if;
end $$;

grant usage on schema public to takt_api;
grant select, insert, update on all tables in schema public to takt_api;
grant usage, select on all sequences in schema public to takt_api;

-- Future tables/sequences auto-grant so new migrations need no GRANT boilerplate.
alter default privileges in schema public grant select, insert, update on tables to takt_api;
alter default privileges in schema public grant usage, select on sequences to takt_api;

-- 2. GUC helpers.
create or replace function app_current_org() returns text language sql stable as $$
  select current_setting('app.org_id', true)
$$;

create or replace function app_is_privileged() returns boolean language sql stable as $$
  select coalesce(current_setting('app.member_role', true) in ('owner', 'manager', 'people_manager'), false)
$$;

-- 3. Enable RLS + tenant policy on each org-scoped table.
--    Policy: a row is visible/writable only when its org_id matches the request's app.org_id GUC.
do $$
declare t text;
begin
  foreach t in array array['employee_profile','site','geofence','assignment','time_entry','audit_log']
  loop
    execute format('alter table %I enable row level security', t);
    execute format('drop policy if exists %I on %I', t || '_tenant', t);
    execute format(
      'create policy %I on %I using (org_id = app_current_org()) with check (org_id = app_current_org())',
      t || '_tenant', t
    );
  end loop;
end $$;

-- 4. Enforce append-only on the immutable tables at the grant layer.
revoke update, delete on time_entry from takt_api;
revoke update, delete on audit_log from takt_api;
