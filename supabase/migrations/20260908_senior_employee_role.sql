-- Run and commit before the permissions migration.
alter type public.app_role add value if not exists 'Senior Employee';
