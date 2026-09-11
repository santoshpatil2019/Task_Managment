begin;
create table if not exists public.activity_events (
  id bigint generated always as identity primary key,
  entity_type text not null check (entity_type in ('task','profile')),
  entity_id text not null,
  entity_label text not null,
  actor_id uuid,
  actor_name text not null,
  action text not null,
  changes jsonb not null,
  created_at timestamptz not null default now()
);
create index if not exists activity_events_entity on public.activity_events(entity_type, entity_id, id desc);
alter table public.activity_events enable row level security;
revoke all on public.activity_events from anon, authenticated;
grant select on public.activity_events to authenticated;
drop policy if exists activity_read on public.activity_events;
create policy activity_read on public.activity_events for select to authenticated using (
  public.current_role() is not null and (
    (entity_type = 'profile' and public.current_role() = 'Admin') or
    (entity_type = 'task' and public.can_read_task(entity_id))
  )
);
create or replace function public.record_activity()
returns trigger language plpgsql security definer set search_path = public as $$
declare
  before_row jsonb := case when TG_OP = 'UPDATE' then to_jsonb(OLD) else '{}'::jsonb end;
  after_row jsonb := to_jsonb(NEW);
  fields text[];
  field text;
  delta jsonb := '{}'::jsonb;
  actor uuid := auth.uid();
  actor_label text;
begin
  fields := case when TG_TABLE_NAME = 'tasks' then array['title','description','assignee_id','project_id','parent_id','priority','start_date','due_date','status','progress','archived_at','review_state','review_note'] else array['name','role','active'] end;
  foreach field in array fields loop
    if before_row->field is distinct from after_row->field then
      if field in ('description','review_note') then
        delta := delta || jsonb_build_object(field, jsonb_build_object('before',null,'after','Updated'));
      elsif field = 'assignee_id' then
        delta := delta || jsonb_build_object(field, jsonb_build_object('before',(select name from public.profiles where id::text = before_row->>field),'after',(select name from public.profiles where id::text = after_row->>field)));
      else
        delta := delta || jsonb_build_object(field, jsonb_build_object('before',before_row->field,'after',after_row->field));
      end if;
    end if;
  end loop;
  if delta = '{}'::jsonb then return NEW; end if;
  select name into actor_label from public.profiles where id = actor;
  insert into public.activity_events(entity_type,entity_id,entity_label,actor_id,actor_name,action,changes)
  values(case when TG_TABLE_NAME = 'tasks' then 'task' else 'profile' end,after_row->>'id',coalesce(after_row->>'title',after_row->>'name'),actor,coalesce(actor_label,'System / service'),lower(TG_OP),delta);
  return NEW;
end $$;
revoke all on function public.record_activity() from public, anon, authenticated;
drop trigger if exists record_task_activity on public.tasks;
create trigger record_task_activity after insert or update on public.tasks for each row execute function public.record_activity();
drop trigger if exists record_profile_activity on public.profiles;
create trigger record_profile_activity after insert or update on public.profiles for each row execute function public.record_activity();
commit;
