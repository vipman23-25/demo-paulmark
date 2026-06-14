create table
  public.cargo_shipments (
    id uuid not null default gen_random_uuid (),
    created_at timestamp with time zone not null default now(),
    arrival_date date not null,
    total_boxes integer not null,
    counted_boxes integer not null default 0,
    status text null default 'Bekliyor'::text,
    notes text null,
    constraint cargo_shipments_pkey primary key (id)
  ) tablespace pg_default;

-- Disable RLS for ease of access (the project heavily relies on client-side bypasses or full open access based on previous bypass_rls migrations)
alter table public.cargo_shipments disable row level security;
