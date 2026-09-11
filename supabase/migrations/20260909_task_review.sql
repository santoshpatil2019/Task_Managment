alter table public.tasks add column if not exists review_state text not null default 'none' check (review_state in ('none','pending','changes_requested','approved'));
alter table public.tasks add column if not exists review_note text not null default '';
alter table public.tasks add column if not exists reviewed_by uuid references public.profiles(id);
alter table public.tasks add column if not exists reviewed_at timestamptz;

-- Direct API writes cannot bypass the review transition function.
create or replace function public.protect_review_fields()
returns trigger language plpgsql set search_path = public as $$
begin
  if current_user = 'authenticated' then
    if tg_op = 'INSERT' then
      if new.review_state <> 'none' or new.status::text in ('Complete','Completed') then raise exception 'Use the review workflow'; end if;
    elsif new.review_state is distinct from old.review_state or new.review_note is distinct from old.review_note
      or new.reviewed_by is distinct from old.reviewed_by or new.reviewed_at is distinct from old.reviewed_at
      or (new.status is distinct from old.status and new.status::text in ('Complete','Completed')) then
      raise exception 'Use the review workflow';
    end if;
  end if;
  return new;
end; $$;
create trigger protect_review_before_write before insert or update on public.tasks for each row execute function public.protect_review_fields();

create or replace function public.review_task(target_task_id text, decision text, feedback text default '')
returns void language plpgsql security definer set search_path = public as $$
declare
  target public.tasks%rowtype;
  actor_role public.app_role;
  completion_value public.task_status;
begin
  actor_role := public.current_role();
  if auth.uid() is null or actor_role is null then raise exception 'Authentication required' using errcode='42501'; end if;
  select * into target from public.tasks where id=target_task_id for update;
  if not found or target.archived_at is not null or not public.can_read_task(target_task_id) then raise exception 'Active task not found' using errcode='42501'; end if;
  if decision='submit' then
    if target.assignee_id <> auth.uid() or actor_role not in ('Employee','Senior Employee') then raise exception 'Only the assignee can submit work' using errcode='42501'; end if;
    if target.review_state='pending' or target.status::text in ('Complete','Completed') then raise exception 'Task already submitted or completed'; end if;
    update public.tasks set review_state='pending',review_note='',reviewed_by=null,reviewed_at=null,status='In progress' where id=target_task_id;
  elsif decision in ('approve','request_changes') then
    if target.review_state <> 'pending' then raise exception 'Task is not awaiting review'; end if;
    if not (actor_role in ('Admin','Manager') or (actor_role='Senior Employee' and target.created_by_id=auth.uid() and target.assignee_id<>auth.uid())) then raise exception 'You cannot review this task' using errcode='42501'; end if;
    if decision='request_changes' and length(trim(feedback))=0 then raise exception 'Explain the changes required'; end if;
    if length(feedback)>5000 then raise exception 'Feedback is too long'; end if;
    if decision='approve' then
      if exists (
        with recursive descendants as (
          select id,status from public.tasks where parent_id=target_task_id
          union all select t.id,t.status from public.tasks t join descendants d on t.parent_id=d.id
        ) select 1 from descendants where status::text not in ('Complete','Completed')
      ) then raise exception 'Complete all subtasks before approving the parent task'; end if;
      select enumlabel::public.task_status into completion_value from pg_enum where enumtypid='public.task_status'::regtype and enumlabel in ('Completed','Complete') order by (enumlabel='Completed') desc limit 1;
      update public.tasks set review_state='approved', review_note=trim(feedback),reviewed_by=auth.uid(),reviewed_at=now(),status=completion_value,progress=100,completed_at=now() where id=target_task_id;
    else
      update public.tasks set review_state='changes_requested',review_note=trim(feedback),reviewed_by=auth.uid(),reviewed_at=now(),status='In progress',completed_at=null where id=target_task_id;
    end if;
  else raise exception 'Invalid review decision'; end if;
end; $$;
revoke all on function public.review_task(text,text,text) from public;
grant execute on function public.review_task(text,text,text) to authenticated;
