-- takt manual migration 0002: kiosk_device RLS + grants.
-- Apply AFTER `drizzle-kit migrate` (table must exist). Bare names only.
-- kiosk_device is NOT append-only: no UPDATE/DELETE revoke (registration toggles `active`).

grant select, insert, update on kiosk_device to takt_api;

alter table kiosk_device enable row level security;
drop policy if exists kiosk_device_tenant on kiosk_device;
create policy kiosk_device_tenant on kiosk_device
  using (org_id = app_current_org()) with check (org_id = app_current_org());
