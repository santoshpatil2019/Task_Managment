create type public.app_role as enum ('Admin', 'Manager', 'Senior Employee', 'Employee');
create type public.task_status as enum ('Not started', 'In progress', 'Completed');
create type public.task_priority as enum ('High', 'Medium', 'Low');

create table public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  name text not null,
  role public.app_role not null default 'Employee',
  active boolean not null default true,
  created_at timestamptz not null default now()
);

create table public.projects (
  id text primary key,
  name text not null,
  description text not null default '',
  created_at timestamptz not null default now()
);

create table public.tasks (
  id text primary key,
  title text not null,
  project_id text not null references public.projects(id) on delete cascade,
  description text not null default '',
  due text not null default '',
  priority public.task_priority not null default 'Medium',
  status public.task_status not null default 'Not started',
  progress integer not null default 0 check (progress between 0 and 100),
  assignee_id uuid not null references public.profiles(id),
  created_by_id uuid not null references public.profiles(id),
  parent_id text references public.tasks(id) on delete set null,
  created_at timestamptz not null default now(),
  assigned_at timestamptz not null default now(),
  due_date date,
  start_date date default current_date,
  completed_at timestamptz,
  archived_at timestamptz
);

create table public.notes (
  id text primary key,
  task_id text not null references public.tasks(id) on delete cascade,
  text text not null,
  author_id uuid not null references public.profiles(id),
  created_at timestamptz not null default now(),
  read_by uuid[] not null default '{}'
);

create table public.progress_logs (
  id text primary key,
  task_id text not null references public.tasks(id) on delete cascade,
  employee_id uuid not null references public.profiles(id),
  description text not null,
  status public.task_status not null,
  progress integer not null check (progress between 0 and 100),
  created_at timestamptz not null default now()
);

create or replace function public.current_role()
returns public.app_role
language sql stable security definer set search_path = public
as $$ select role from public.profiles where id = auth.uid() and active = true $$;

create or replace function public.handle_new_user()
returns trigger
language plpgsql security definer set search_path = public
as $$
begin
  insert into public.profiles (id, name)
  values (
    new.id,
    coalesce(nullif(new.raw_user_meta_data ->> 'name', ''), split_part(coalesce(new.email, 'user'), '@', 1))
  );
  return new;
end;
$$;

create trigger on_auth_user_created
  after insert on auth.users
  for each row execute procedure public.handle_new_user();

create or replace function public.protect_profile_fields()
returns trigger
language plpgsql security definer set search_path = public
as $$
begin
  if auth.uid() = old.id and public.current_role() <> 'Admin' then
    new.role := old.role;
    new.active := old.active;
  end if;
  return new;
end;
$$;

create trigger protect_profile_fields_before_update
  before update on public.profiles
  for each row execute procedure public.protect_profile_fields();

alter table public.profiles enable row level security;
alter table public.projects enable row level security;
alter table public.tasks enable row level security;
alter table public.notes enable row level security;
alter table public.progress_logs enable row level security;

create policy profiles_read on public.profiles for select to authenticated
  using (active = true or id = auth.uid() or public.current_role() = 'Admin');
create policy profiles_update on public.profiles for update to authenticated
  using (id = auth.uid() or public.current_role() = 'Admin')
  with check (id = auth.uid() or public.current_role() = 'Admin');

create policy projects_read on public.projects for select to authenticated using (true);
create policy projects_insert on public.projects for insert to authenticated
  with check (public.current_role() = 'Admin');
create policy projects_update on public.projects for update to authenticated
  using (public.current_role() = 'Admin') with check (public.current_role() = 'Admin');
create policy projects_delete on public.projects for delete to authenticated
  using (public.current_role() = 'Admin');

create policy tasks_read on public.tasks for select to authenticated
  using (public.current_role() in ('Admin', 'Manager') or assignee_id = auth.uid());
create policy tasks_insert on public.tasks for insert to authenticated
  with check (public.current_role() = 'Manager' and created_by_id = auth.uid());
create policy tasks_update on public.tasks for update to authenticated
  using (public.current_role() in ('Admin', 'Manager') or assignee_id = auth.uid())
  with check (public.current_role() in ('Admin', 'Manager') or assignee_id = auth.uid());

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

create trigger protect_employee_task_fields_before_update
  before update on public.tasks
  for each row execute procedure public.protect_employee_task_fields();

create policy notes_read on public.notes for select to authenticated
  using (
    public.current_role() in ('Admin', 'Manager')
    or exists (select 1 from public.tasks where tasks.id = notes.task_id and tasks.assignee_id = auth.uid())
  );
create policy notes_insert on public.notes for insert to authenticated
  with check (
    author_id = auth.uid()
    and (public.current_role() = 'Manager' or exists (select 1 from public.tasks where tasks.id = task_id and tasks.assignee_id = auth.uid()))
  );

create policy progress_read on public.progress_logs for select to authenticated
  using (public.current_role() in ('Admin', 'Manager') or employee_id = auth.uid());
create policy progress_insert on public.progress_logs for insert to authenticated
  with check (
    employee_id = auth.uid()
    and public.current_role() = 'Employee'
    and exists (select 1 from public.tasks where tasks.id = task_id and tasks.assignee_id = auth.uid())
  );

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

-- Mark only the caller's own read receipt, and only on tasks they may read.
create or replace function public.mark_task_messages_read(target_task_id text)
returns void language plpgsql security definer set search_path = public
as $$
begin
  if auth.uid() is null or not public.can_read_task(target_task_id) then
    raise exception 'Task not found or access denied' using errcode = '42501';
  end if;
  update public.notes
  set read_by = array_append(coalesce(read_by, '{}'::uuid[]), auth.uid())
  where task_id = target_task_id and not (auth.uid() = any(coalesce(read_by, '{}'::uuid[])));
end;
$$;
revoke all on function public.mark_task_messages_read(text) from public;
grant execute on function public.mark_task_messages_read(text) to authenticated;

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
