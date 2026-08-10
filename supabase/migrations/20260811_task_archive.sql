-- Add archive timestamps to existing task records.
alter table public.tasks add column if not exists archived_at timestamptz;
create index if not exists tasks_archived_at_idx on public.tasks (archived_at);

-- Keep employees from archiving or restoring tasks through direct table updates.
create or replace function public.protect_employee_task_fields()
returns trigger
language plpgsql security definer set search_path = public
as $$
begin
  if auth.uid() = old.assignee_id and public.current_role() = 'Employee' then
    new.title := old.title;
    new.project_id := old.project_id;
    new.due := old.due;
    new.priority := old.priority;
    new.assignee_id := old.assignee_id;
    new.created_by_id := old.created_by_id;
    new.parent_id := old.parent_id;
    new.created_at := old.created_at;
    new.assigned_at := old.assigned_at;
    new.due_date := old.due_date;
    new.archived_at := old.archived_at;
  end if;
  return new;
end;
$$;
