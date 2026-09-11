begin;
insert into storage.buckets(id,name,public,file_size_limit,allowed_mime_types)
values('task-attachments','task-attachments',false,10485760,array['image/png','image/jpeg','image/webp','application/pdf','text/plain','text/csv','application/vnd.openxmlformats-officedocument.wordprocessingml.document','application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'])
on conflict(id) do nothing;
create or replace function public.can_attach_task(target text)
returns boolean language sql stable security definer set search_path=public as $$
 select public.current_role() is not null and exists(select 1 from public.tasks t where t.id=target and t.archived_at is null and (public.current_role() in ('Admin','Manager') or t.assignee_id=auth.uid() or (public.current_role()='Senior Employee' and t.created_by_id=auth.uid())));
$$;
revoke all on function public.can_attach_task(text) from public;
grant execute on function public.can_attach_task(text) to authenticated;
drop policy if exists task_attachments_read on storage.objects;
create policy task_attachments_read on storage.objects for select to authenticated using(bucket_id='task-attachments' and public.can_read_task((storage.foldername(name))[1]));
drop policy if exists task_attachments_insert on storage.objects;
create policy task_attachments_insert on storage.objects for insert to authenticated with check(bucket_id='task-attachments' and public.can_attach_task((storage.foldername(name))[1]) and array_length(storage.foldername(name),1)=1);
commit;
