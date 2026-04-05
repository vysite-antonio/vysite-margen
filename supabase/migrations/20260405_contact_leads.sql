-- contact_leads: leads generados desde la landing page de Vysite Margen
create table if not exists public.contact_leads (
  id          uuid primary key default gen_random_uuid(),
  nombre      text not null,
  empresa     text,
  email       text not null,
  telefono    text,
  mensaje     text,
  created_at  timestamptz not null default now()
);

-- Solo accesible desde service_role (route handlers con client de servidor)
alter table public.contact_leads enable row level security;

-- Política: sin acceso desde el cliente anónimo
create policy "No acceso anónimo" on public.contact_leads
  for all using (false);
