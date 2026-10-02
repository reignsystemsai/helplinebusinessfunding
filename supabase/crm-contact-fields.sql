-- Preserve existing full_name consumers while storing separate CRM names.
alter table public.funding_leads
  add column if not exists first_name text,
  add column if not exists last_name text;
