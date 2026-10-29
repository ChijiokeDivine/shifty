import assert from "node:assert/strict";
import test from "node:test";
import { isAuthEmailConfigured, sendAuthEmail, sendRegistrationOtp } from "./transactional-email.server.ts";

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

test("registration OTP email accepts only six digits and includes expiry", async () => {
  let body: { text?: string; subject?: string; to?: string[] } = {};
  await sendRegistrationOtp({to:"new@example.com",otp:"012345"},{
    env:{RESEND_API_KEY:"secret",AUTH_EMAIL_FROM:"verify@example.com"},
    fetchImpl: async (_url, options) => {
      body=JSON.parse(String(options?.body)) as typeof body;
      return new Response("{}",{status:200});
    },
  });
  assert.deepEqual(body.to,["new@example.com"]);
  assert.equal(body.subject,"Your Shiftii verification code");
  assert.match(body.text??"",/012345/);
  assert.match(body.text??"",/10 minutes/);
  for(const otp of ["12345","1234567","abc123","0000 0",""]) {
    await assert.rejects(sendRegistrationOtp({to:"new@example.com",otp},{
      env:{RESEND_API_KEY:"secret",AUTH_EMAIL_FROM:"verify@example.com"},
      fetchImpl: async () => {throw new Error("must not send invalid OTP");},
    }),/Invalid email verification code/);
  }
});

test("registration OTP provider failure does not leak a code",async()=>{
  await assert.rejects(sendRegistrationOtp({to:"new@example.com",otp:"123456"},{
    env:{RESEND_API_KEY:"secret",AUTH_EMAIL_FROM:"verify@example.com"},
    fetchImpl:async()=>new Response("secret:123456",{status:429}),
  }),err=>err instanceof Error && err.message==="Unable to deliver authentication email.");
});
