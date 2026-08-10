create type public.app_role as enum ('Admin', 'Manager', 'Employee');
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
  completed_at timestamptz
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
