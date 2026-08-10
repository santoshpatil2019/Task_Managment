-- Add the current status label to an existing production database.
-- Legacy Complete and Blocked values remain readable through the API, but the
-- application only creates and displays Not started, In progress, Completed.
alter type public.task_status add value if not exists 'Completed';
