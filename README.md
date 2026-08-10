# Mellivo Task Management

Production-ready Next.js task management workspace with Supabase Auth, Postgres persistence, role-based access, projects, tasks, subtasks, messages, daily progress logs, and reports.

## Local development

1. Install Node.js 22 or later.
2. Install dependencies:

   ```bash
   npm install
   ```

3. Copy `.env.example` to `.env.local` and fill in the Supabase values.
4. Apply `supabase/schema.sql` in the Supabase SQL Editor.
5. Create the first user in Supabase Authentication, then promote that profile to Admin:

   ```sql
   update public.profiles
   set role = 'Admin'
   where id = '<auth-user-uuid>';
   ```

6. Start the app:

   ```bash
   npm run dev
   ```

## Supabase configuration

Required variables:

- `NEXT_PUBLIC_SUPABASE_URL` — public project URL.
- `NEXT_PUBLIC_SUPABASE_ANON_KEY` — public anon/publishable key.
- `SUPABASE_SERVICE_ROLE_KEY` — server-only key used by the protected admin user-creation route. Never expose it with `NEXT_PUBLIC_` or commit it.

The database schema enables Row Level Security. Authorization is enforced again in the API route; UI visibility is not treated as a security boundary.

## Vercel deployment

Add all three variables in the Vercel project’s Production environment, then create a new production deployment. Environment variable changes apply only to new deployments.

Configure Supabase Auth URL settings:

- Site URL: `https://mellivo-app.vercel.app`
- Redirect URLs: the production URL and the local development URL if required

## Backup copy

The previous browser-local demo is preserved in the local Git branch `backup/local-demo`. The production migration is being developed on `production-supabase`.

## Verification

```bash
npx tsc --noEmit
npx next build --webpack
```
