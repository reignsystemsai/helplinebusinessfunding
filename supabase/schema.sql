-- Applied to Helplinefunding (sjmkvufnmaaqtgjnrpha).
create table public.funding_leads (
 id uuid primary key default gen_random_uuid(),
 request_id uuid not null unique,
 created_at timestamptz not null default now(),
 status text not null default 'New Lead' check (status in ('New Lead','Contacted','Reviewing','Offer Received','Funded','Closed')),
 funding_amount text not null, purpose text not null,
 monthly_revenue text not null, time_in_business text not null,
 business_bank_account boolean not null, existing_financing boolean not null,
 business_name text not null, full_name text not null, email text not null,
 phone text not null, state text not null,
 contact_consent boolean not null check(contact_consent),
 consent_version text not null default 'inquiry-v1',
 campaign jsonb not null default '{}'::jsonb,
 source_path text not null, is_staging boolean not null default true,
 ip_hash text
);
alter table public.funding_leads enable row level security;
revoke all on public.funding_leads from anon, authenticated;
grant select,insert,update,delete on public.funding_leads to service_role;
create index funding_leads_created_at_idx on public.funding_leads(created_at desc);
create index funding_leads_ip_created_idx on public.funding_leads(ip_hash,created_at desc);
-- No public policies: access is intentionally limited to the server-side function.
