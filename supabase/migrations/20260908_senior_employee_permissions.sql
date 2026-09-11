-- Existing Employees become Senior Employees; new users retain the Employee default.
update public.profiles set role = 'Senior Employee' where role = 'Employee';

create or replace function public.can_delegate_task(parent_task_id text, target_project_id text, target_assignee_id uuid)
returns boolean language sql stable security definer set search_path = public
as $$
  select public.current_role() = 'Senior Employee'
    and exists (select 1 from public.tasks where id = parent_task_id and assignee_id = auth.uid() and project_id = target_project_id and archived_at is null)
    and exists (select 1 from public.profiles where id = target_assignee_id and role = 'Employee' and active);
$$;
revoke all on function public.can_delegate_task(text, text, uuid) from public;
grant execute on function public.can_delegate_task(text, text, uuid) to authenticated;

create or replace function public.can_read_task(target_id text)
returns boolean language sql stable security definer set search_path = public
as $$
  select public.current_role() is not null and exists (
    select 1 from public.tasks t where t.id = target_id and (
      public.current_role() in ('Admin', 'Manager') or t.assignee_id = auth.uid()
      or (public.current_role() = 'Senior Employee' and t.created_by_id = auth.uid())
    )
  );
$$;
revoke all on function public.can_read_task(text) from public;
grant execute on function public.can_read_task(text) to authenticated;

alter policy tasks_read on public.tasks using (public.can_read_task(id));
alter policy tasks_insert on public.tasks with check (
  created_by_id = auth.uid() and (public.current_role() = 'Manager'
    or public.can_delegate_task(parent_id, project_id, assignee_id))
);
alter policy notes_read on public.notes using (public.can_read_task(task_id));
alter policy notes_insert on public.notes with check (
  author_id = auth.uid() and public.can_read_task(task_id) and (
    public.current_role() = 'Manager' or exists (
      select 1 from public.tasks t where t.id = task_id and (t.assignee_id = auth.uid()
        or (public.current_role() = 'Senior Employee' and t.created_by_id = auth.uid()))
    )
  )
);
alter policy progress_read on public.progress_logs using (public.can_read_task(task_id));
alter policy progress_insert on public.progress_logs with check (
  employee_id = auth.uid() and public.current_role() in ('Senior Employee', 'Employee')
  and exists (select 1 from public.tasks t where t.id = task_id and t.assignee_id = auth.uid())
);

create or replace function public.protect_employee_task_fields()
returns trigger
language plpgsql security definer set search_path = public
as $$
begin
  if auth.uid() = old.assignee_id and public.current_role() in ('Senior Employee', 'Employee') then
    new.description := old.description;
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
    new.start_date := old.start_date;
    new.archived_at := old.archived_at;
  end if;
  return new;
end;
$$;

