# Email verification and password recovery

Shiftii uses **Better Auth** for accounts and **Resend** for delivery of verification and password-reset emails. The email sender is server-only and does not expose credentials through the browser or app API.

## Configuration

1. Verify a sending domain with Resend.
2. Set these **server-side** environment variables in the hosting environment (never commit real values):
   - `RESEND_API_KEY` = your Resend API key
   - `AUTH_EMAIL_FROM` = `Shiftii <accounts@your-verified-domain.com>`
   - `BETTER_AUTH_URL` = your exact deployed HTTPS application origin
   - `BETTER_AUTH_SECRET` = cryptographically random production secret
   - `DATABASE_URL` = server-only Postgres URI
   - `NEXT_PUBLIC_AUTH_ENABLED` = `true`
3. Use `pnpm build:dev` to compile without automatically running database migrations.
4. Check email delivery with a test account after Better Auth tables have been migrated safely; ensure signup verification, resend verification and password recovery work as expected.

## Behavior

- Email/password account signup is disabled by Better Auth until both Resend variables are set.
- Once configured, email/password signup requires a verified email before the first session.
- Verification emails are sent at signup and resent when an unverified user tries to sign in.
- Reset links expire after one hour; resetting a password revokes existing sessions.
- Staff invitations require the signed-in user's **verified** email to equal the invitee address and do not bypass company membership checks.
- The UI does not claim an invitation has been emailed: invitation links are currently copied manually by managers. Automated invitation delivery requires a separate implementation.

## Security

Do not store verification or reset links in logs. Do not expose `RESEND_API_KEY` as a `NEXT_PUBLIC_*` variable. Always use a domain-verified sender. Better Auth's `user`, `account`, `session`, and `verification` tables need strict database access boundaries before going live with Supabase. The old Django tables currently exposed in `public` require an RLS/grant security review before production use.

The system has not been tested against a production Resend account or a live Supabase-backed deployment. CI verifies typecheck, lint, unit tests and build only.
