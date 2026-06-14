create table public.cargo_shipment_logs (
    id uuid not null default gen_random_uuid (),
    shipment_id uuid not null references public.cargo_shipments (id) on delete cascade,
    personnel_name text not null,
    added_count integer not null,
    created_at timestamp with time zone not null default now(),
    constraint cargo_shipment_logs_pkey primary key (id)
) tablespace pg_default;

alter table public.cargo_shipment_logs disable row level security;
