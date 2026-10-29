# Shiftii × Supabase PostgreSQL setup

Shiftii already uses PostgreSQL through `pg`. Supabase acts as the managed Postgres database; existing Next.js server actions and Better Auth can remain in place. **Do not add Supabase browser keys or switch authentication providers just to use its database.**

## Current state (2026-10-28)

Existing Supabase project: `dfovxoxevxeoibyllcph` (US West) is **ACTIVE_HEALTHY**.

The Next.js Shiftii schema was installed in this Supabase project's `public` schema in a tracked Supabase migration named `create_shiftii_nextjs_schema_private_api`. The app's `_migrations` table records `0001_auth.sql` and `0002_schema.sql` as applied. All 28 application/auth tables and the migration ledger have Row Level Security enabled, with all direct `anon` and `authenticated` table privileges revoked. Next.js should use a **server-only Postgres database role**, not Supabase client-side Data API access.

**Important:** The 19 old Django tables are still present and have unsafe public API grants and disabled RLS. They were deliberately not changed or deleted. Before inviting real users, back up or remove the legacy tables, or restrict them with carefully reviewed RLS and grants. This is a release blocker.

**Not yet complete:** The hosted Next.js application's `DATABASE_URL` secret has not been supplied or verified from the runtime. Demo data has not been inserted into a user workspace. The signed-in company owner can opt into a demo seed through the dashboard once auth and database connectivity work. No live end-to-end test has been completed.

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
