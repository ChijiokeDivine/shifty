# Shiftii × Supabase PostgreSQL setup

Shiftii already uses PostgreSQL through `pg`. Supabase acts as the managed Postgres database; existing Next.js server actions and Better Auth can remain in place. **Do not add Supabase browser keys or switch authentication providers just to use its database.**

## Current state

Existing Supabase project: `dfovxoxevxeoibyllcph` (US West). It was inactive and a restore was requested on 2026-10-27. Do not migrate until its status is ACTIVE/HEALTHY and its schema has been inventoried.

## Connect server-side (after restore)

1. Open [Supabase dashboard project](https://supabase.com/dashboard/project/dfovxoxevxeoibyllcph) and use **Connect** to obtain a PostgreSQL connection URI. For a serverless Next.js deployment, Supabase recommends the **transaction pooler**; for a persistent backend use the appropriate session/direct endpoint. Check current provider instructions.
2. Set `DATABASE_URL` as a **server-side environment secret** in the hosting provider. If running locally, place it in an ignored local env file such as `.env.local`. Never put the connection string in `NEXT_PUBLIC_*`, source code, a PR, or a GitHub Actions log.
3. Confirm `BETTER_AUTH_SECRET`, `BETTER_AUTH_URL` and intended authentication settings are correctly configured before enabling sign-ins.
4. Run `pnpm db:check` against the selected environment. This checks connectivity and existence of six core Shiftii tables **without modifying data**.
5. Inventory the current database schema and migration history. Review `migrations/0001_auth.sql` and `migrations/0002_schema.sql`, table name collisions, default grants, RLS, backups and data retention **before** running `pnpm db:migrate`.
6. Do not run the project's `pnpm build` command against a live `DATABASE_URL` during initial integration: that script also calls `db:migrate`. Use `pnpm build:dev` for safe compilation.

## Security boundaries

- Application queries must be server-only, authenticated, and constrained by `organization_id`.
- Supabase's `public` schema can be exposed through the Data API. Audit default grants and enforce RLS on any exposed tables before enabling API access. Alternatively keep private backend tables in an unexposed schema with explicit grants and search paths. Be especially careful about Better Auth's `user`, `session`, and token/account tables.
- Never expose database passwords, service-role credentials, or raw database connections to the browser.
- Run the Supabase security and performance advisors after schema changes.
- Do not point development/test traffic at production data. Prefer a dedicated isolated database or a reviewed Supabase branch.

## Release gate

The connection is not considered complete until (1) Supabase is healthy, (2) old schema is inventoried, (3) migrations are reviewed and safely applied, (4) `pnpm db:check` passes, and (5) organization isolation and shift transaction integration tests pass.
