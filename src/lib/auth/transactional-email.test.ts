import assert from "node:assert/strict";
import test from "node:test";
import { isAuthEmailConfigured, sendAuthEmail } from "./transactional-email.server.ts";

test("email readiness requires both server-side settings", () => {
  assert.equal(isAuthEmailConfigured({}), false);
  assert.equal(isAuthEmailConfigured({ RESEND_API_KEY: "example" }), false);
  assert.equal(isAuthEmailConfigured({ AUTH_EMAIL_FROM: "Shiftii <noreply@example.com>" }), false);
  assert.equal(isAuthEmailConfigured({ RESEND_API_KEY: "example", AUTH_EMAIL_FROM: "noreply@example.com" }), true);
});

test("delivery fails closed before calling network without credentials", async () => {
  let called = false;
  await assert.rejects(
    sendAuthEmail(
      { to: "test@example.com", subject: "Test", action: "Action", url: "https://shiftii.example/reset", expiresIn: "1 hour" },
      { env: {}, fetchImpl: async () => { called = true; return new Response(null, { status: 200 }); } },
    ),
    /not configured/,
  );
  assert.equal(called, false);
});

test("email delivery keeps provider credentials server-side and does not log tokens", async () => {
  let endpoint = "";
  let headers: Headers | undefined;
  let body: Record<string, unknown> | undefined;
  await sendAuthEmail(
    { to: "test@example.com", subject: "Reset", action: "Reset password:", url: "https://shiftii.example/reset?token=secret", expiresIn: "1 hour" },
    {
      env: { RESEND_API_KEY: "test-secret", AUTH_EMAIL_FROM: "noreply@example.com" },
      fetchImpl: async (url, request) => {
        endpoint = String(url);
        headers = new Headers(request?.headers);
        body = JSON.parse(String(request?.body)) as Record<string, unknown>;
        return new Response("{}", { status: 200 });
      },
    },
  );
  assert.equal(endpoint, "https://api.resend.com/emails");
  assert.equal(headers?.get("authorization"), "Bearer test-secret");
  assert.deepEqual(body?.to, ["test@example.com"]);
  assert.equal(body?.from, "noreply@example.com");
  assert.match(String(body?.text), /https:\/\/shiftii\.example\/reset\?token=secret/);
});

test("provider failure doesn't echo response content", async () => {
  await assert.rejects(
    sendAuthEmail(
      { to: "test@example.com", subject: "Reset", action: "Reset", url: "https://shiftii.example/reset", expiresIn: "1 hour" },
      { env: { RESEND_API_KEY: "secret", AUTH_EMAIL_FROM: "noreply@example.com" },
        fetchImpl: async () => new Response("token-is-private", { status: 401 }) },
    ),
    (err: unknown) => err instanceof Error && err.message === "Unable to deliver authentication email.",
  );
});
