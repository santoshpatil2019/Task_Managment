# Operations and recovery

## Release
Production is https://mellivo-task-manager.vercel.app, from `master` in sanketshahane05/Task_Managment. Build before pushing. Database migrations are versioned separately and must be applied once in filename order. Do not rerun the old employee-promotion migration on existing new Employee accounts.

## Authentication email
Set Vercel `APP_URL=https://mellivo-task-manager.vercel.app` and the server-only `SUPABASE_SERVICE_ROLE_KEY`. Public keys do not authorize invitations.
In Supabase Auth URL Configuration, allow the exact production `/auth/callback` and `/auth/set-password` URLs. Optional local callback: http://localhost:3000/auth/callback.
For cross-device links, email templates can link to `{{ .SiteURL }}/auth/confirm?token_hash={{ .TokenHash }}&type=recovery` (reset) or `type=invite` (invitation). The deployed handler fixes the destination to the password form; it does not accept arbitrary redirect destinations. Default provider confirmation links also work when redirects are configured. PKCE recovery links require the browser that requested the link.
Configure custom SMTP for real users. Supabase default email service may restrict recipients and rate limits. Do not send test invitations or recovery emails to real users without their instruction.

## Notifications
In-app alerts refresh while signed in. Email/push deadline and chat delivery is not enabled: it needs an agreed delivery provider, sender and scheduling credentials. No promise of background reminders is made by the UI.

## Backups
A recoverable backup needs the database (including Auth identities), private Storage file bytes, bucket/policy configuration, and a separately secured inventory of service settings. Never commit backups, passwords, tokens or SMTP credentials. A CSV report is not a database backup.
`tools/backup-database.ps1 -OutputDirectory <encrypted-backup-folder>` uses PostgreSQL client tools and PGHOST/PGUSER/PGPASSWORD/PGDATABASE/PGPORT environment variables, with SSL. It produces a custom-format database archive and SHA-256 manifest. Database credentials and client tools are required. The database dump does not include Storage file bytes; export these separately with the Storage API or a supported storage backup service.
Keep daily offsite encrypted backups with retention suited to the organization. Verify a restore in an isolated database using `tools/verify-restore.ps1`, never production. Target must be a dedicated empty restore-test database compatible with Supabase's roles/extensions. Validate row counts, relationships, Auth login, roles, storage objects and permissions. Keep restore logs and a recovery-time measurement.
No scheduled backup or disaster-recovery restore is claimed until an actual archive and isolated destination have been verified. This workspace does not currently have database connection credentials or PostgreSQL client tools.

## Verification
- `node --experimental-strip-types --test tests/*.test.mjs`
- `npx tsc --noEmit`
- `npm run build`
- `tests/sql/permissions.sql` in Supabase SQL Editor: transaction-scoped checks for all four existing roles and private storage.
- Activity trigger no-op/changed-field checks were executed in a rolled-back transaction.
- Files use a private bucket with 10 MB server-side size and MIME restrictions, unique names, and 60-second signed download URLs. Task access controls reads. No public bucket or overwrite permission is granted.
