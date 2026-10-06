
begin;
alter table public.funding_leads add column if not exists deleted_at timestamptz;
alter table public.funding_leads add column if not exists deleted_by text;
create index if not exists funding_leads_active_created_idx on public.funding_leads(created_at desc) where deleted_at is null;
create table if not exists public.funding_page_visits(
 id uuid primary key,
 visitor_id uuid not null,
 started_at timestamptz not null default now(),
 last_seen_at timestamptz not null default now(),
 active boolean not null default true,
 path text not null check(length(path)<=300),
 is_staging boolean not null default false
);
alter table public.funding_page_visits enable row level security;
revoke all on public.funding_page_visits from public,anon,authenticated;
grant select,insert,update,delete on public.funding_page_visits to service_role;
create index if not exists funding_visits_started_idx on public.funding_page_visits(started_at);
create index if not exists funding_visits_live_seen_idx on public.funding_page_visits(last_seen_at,visitor_id) where active and not is_staging;
create or replace function public.funding_traffic_summary() returns jsonb language sql stable security invoker set search_path=public as $$
 select jsonb_build_object(
 'active',count(distinct visitor_id) filter(where active and last_seen_at>now()-interval '60 seconds'),
 'today',count(*) filter(where started_at >= (date_trunc('day',now() at time zone 'America/New_York') at time zone 'America/New_York')),
 'week',count(*) filter(where started_at>now()-interval '7 days'),
 'total',count(*)
 ) from public.funding_page_visits where not is_staging
$$;
revoke all on function public.funding_traffic_summary() from public,anon,authenticated;
grant execute on function public.funding_traffic_summary() to service_role;
create or replace function public.funding_manager_summary(include_tests boolean default false) returns jsonb language sql stable security invoker set search_path=public as $$
 select jsonb_build_object('total',count(*),'new',count(*) filter(where status='New Lead'),'reviewing',count(*) filter(where status='Reviewing'),'funded',count(*) filter(where status='Funded'))
 from public.funding_leads where deleted_at is null and (include_tests or not is_staging)
$$;
revoke all on function public.funding_manager_summary(boolean) from public,anon,authenticated;
grant execute on function public.funding_manager_summary(boolean) to service_role;
create or replace view public.funding_partner_summary with(security_invoker=true) as
 select p.id,p.name,p.email,p.phone,p.active,p.created_at,p.slug,
 count(l.id) filter(where not l.is_staging and l.deleted_at is null) as lead_count,
 count(l.id) filter(where not l.is_staging and l.deleted_at is null and l.status='Funded') as funded_count
 from public.funding_partners p left join public.funding_leads l on l.partner_id=p.id group by p.id;
revoke all on public.funding_partner_summary from public,anon,authenticated;
grant select on public.funding_partner_summary to service_role;
commit;
