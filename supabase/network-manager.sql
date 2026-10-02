-- Owner access is granted explicitly by the project administrator.
create table if not exists public.funding_manager_owners (
  email text primary key check (email=lower(email)),
  created_at timestamptz not null default now()
);
create table if not exists public.funding_partners (
  id bigint generated always as identity primary key,
  name text not null check (length(trim(name)) between 1 and 120),
  email text,
  phone text,
  active boolean not null default true,
  created_at timestamptz not null default now(),
  slug text generated always as (
    coalesce(nullif(trim(both '-' from regexp_replace(lower(name),'[^a-z0-9]+','-','g')),''),'partner')
    || '-' || lpad(id::text,greatest(3,length(id::text)),'0')
  ) stored unique
);
alter table public.funding_leads add column if not exists partner_id bigint references public.funding_partners(id),
  add column if not exists notes text not null default '',
  add column if not exists updated_at timestamptz not null default now();
create index if not exists funding_leads_partner_id_idx on public.funding_leads(partner_id);
create index if not exists funding_leads_live_created_idx on public.funding_leads(is_staging,created_at desc);
alter table public.funding_manager_owners enable row level security;
alter table public.funding_partners enable row level security;
revoke all on public.funding_manager_owners,public.funding_partners from anon,authenticated;
grant all on public.funding_manager_owners,public.funding_partners to service_role;
grant usage,select on sequence public.funding_partners_id_seq to service_role;
create or replace function public.funding_manager_summary(include_tests boolean default false)
returns jsonb language sql stable security invoker set search_path=public as $$
 select jsonb_build_object(
   'total',count(*),'new',count(*) filter(where status='New Lead'),
   'reviewing',count(*) filter(where status='Reviewing'),
   'funded',count(*) filter(where status='Funded')
 ) from public.funding_leads where include_tests or not is_staging
$$;
revoke all on function public.funding_manager_summary(boolean) from public,anon,authenticated;
grant execute on function public.funding_manager_summary(boolean) to service_role;
create or replace view public.funding_partner_summary with (security_invoker=true) as
 select p.*,count(l.id) filter(where not l.is_staging) as lead_count,
 count(l.id) filter(where not l.is_staging and l.status='Funded') as funded_count
 from public.funding_partners p left join public.funding_leads l on l.partner_id=p.id
 group by p.id;
revoke all on public.funding_partner_summary from anon,authenticated;
grant select on public.funding_partner_summary to service_role;
