alter table public.tasks add column if not exists start_date date;
alter table public.tasks alter column start_date set default current_date;
