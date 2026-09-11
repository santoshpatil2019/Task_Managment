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
