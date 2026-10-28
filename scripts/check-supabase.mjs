#!/usr/bin/env node
/**
 * Read-only Shiftii PostgreSQL connectivity and schema check.
 * Set DATABASE_URL to the server-side Supabase Postgres connection string.
 * Never put the URL in NEXT_PUBLIC_* or commit it to source control.
 */
import pg from "pg";

const databaseUrl = process.env.DATABASE_URL?.trim();
if (!databaseUrl) {
  console.error("[db:check] DATABASE_URL is not configured.");
  process.exitCode = 1;
} else {
  const pool = new pg.Pool({ connectionString: databaseUrl, max: 1, connectionTimeoutMillis: 10_000 });
  try {
    const client = await pool.connect();
    try {
      const availability = await client.query("select current_database() as database_name, current_user as role_name");
      const tables = await client.query(
        `select table_name from information_schema.tables
          where table_schema = 'public' and table_name = any($1::text[])
          order by table_name`,
        [["organizations", "memberships", "rosters", "shifts", "shift_claims", "shift_swap_requests"]],
      );
      const found = new Set(tables.rows.map((r) => r.table_name));
      const required = ["organizations", "memberships", "rosters", "shifts", "shift_claims", "shift_swap_requests"];
      const missing = required.filter((name) => !found.has(name));
      console.log("[db:check] PostgreSQL connection successful.");
      console.log(`[db:check] Database: ${availability.rows[0]?.database_name}`);
      console.log(`[db:check] Shiftii core tables: ${required.length - missing.length}/${required.length}`);
      if (missing.length) {
        console.error(`[db:check] Missing tables: ${missing.join(", ")}. Review migrations before enabling production traffic.`);
        process.exitCode = 1;
      }
    } finally {
      client.release();
    }
  } catch (err) {
    // pg errors may contain secrets in connection metadata; don't print raw error objects.
    console.error("[db:check] Connection or schema check failed:", err instanceof Error ? err.message : "unknown failure");
    process.exitCode = 1;
  } finally {
    await pool.end();
  }
}
