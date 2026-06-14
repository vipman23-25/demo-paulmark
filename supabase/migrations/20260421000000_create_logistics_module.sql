create table public.cargo_companies (
  id uuid not null default gen_random_uuid (),
  name text not null,
  created_at timestamp with time zone not null default now(),
  constraint cargo_companies_pkey primary key (id)
) tablespace pg_default;

create table public.logistics_records (
  id uuid not null default gen_random_uuid (),
  company_name text not null,
  shipment_date date not null,
  content_description text not null,
  tracking_number text not null,
  created_at timestamp with time zone not null default now(),
  constraint logistics_records_pkey primary key (id)
) tablespace pg_default;

-- Disable RLS for ease of access (the project heavily relies on client-side bypasses or full open access based on previous bypass_rls migrations)
alter table public.cargo_companies disable row level security;
alter table public.logistics_records disable row level security;
