begin;
do $$
declare u record; t record; expected boolean; roles_seen text[] := '{}';
begin
 for u in select id,role,active from public.profiles loop
  perform set_config('request.jwt.claim.sub',u.id::text,true);
  roles_seen:=array_append(roles_seen,u.role::text);
  for t in select * from public.tasks loop
   expected:=u.active and (u.role in ('Admin','Manager') or t.assignee_id=u.id or (u.role='Senior Employee' and t.created_by_id=u.id));
   if public.can_read_task(t.id) is distinct from expected then raise exception 'Task access mismatch for role %',u.role; end if;
   if public.can_attach_task(t.id) is distinct from (expected and t.archived_at is null) then raise exception 'Attachment access mismatch for role %',u.role; end if;
  end loop;
  execute 'set local role authenticated';
  if u.role<>'Admin' and exists(select 1 from public.activity_events where entity_type='profile') then raise exception 'Profile audit leak'; end if;
  execute 'reset role';
 end loop;
 if not (array['Admin','Manager','Senior Employee','Employee'] <@ roles_seen) then raise exception 'All four role fixtures required'; end if;
 perform set_config('request.jwt.claim.sub','',true);
 if public.can_read_task((select id from public.tasks limit 1)) then raise exception 'Unauthenticated task access'; end if;
 if (select public from storage.buckets where id='task-attachments') then raise exception 'Attachment bucket must be private'; end if;
 if has_table_privilege('authenticated','public.activity_events','INSERT') or has_table_privilege('authenticated','public.activity_events','UPDATE') or has_table_privilege('authenticated','public.activity_events','DELETE') then raise exception 'Audit records are mutable'; end if;
end $$;
rollback;
select 'PASS: four-role task/attachment access, profile audit isolation, anonymous denial, private storage and immutable audit' as result;
