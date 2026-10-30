import assert from "node:assert/strict";
import { spawn } from "node:child_process";
import { once } from "node:events";
import { randomUUID } from "node:crypto";
import { readFileSync } from "node:fs";
import { createServer } from "node:net";
import { setTimeout as delay } from "node:timers/promises";
import test from "node:test";
import { authEmailsEnabled } from "../src/lib/auth/email-password.ts";

// Exercise the built application's real auth routes with an isolated in-memory
// database. Never inherit database or email-provider credentials from the host.
test("signup and password sessions work while email delivery is paused", {
  skip: authEmailsEnabled,
  timeout: 120_000,
}, async (t) => {
  const listener = createServer();
  listener.listen(0, "127.0.0.1");
  await once(listener, "listening");
  const { port } = listener.address();
  await new Promise((resolve, reject) => listener.close((error) => error ? reject(error) : resolve()));
  const origin = `http://127.0.0.1:${port}`;
  // Simulate a Vercel branch alias over loopback while keeping production HTTPS
  // origin checks enabled. The canonical and individual build URLs differ.
  const branchHost = "shiftii-git-backend-stabilization-example.vercel.app";
  const authOrigin = `https://${branchHost}`;
  const deploymentHeaders = { Host: branchHost, "X-Forwarded-Host": branchHost, "X-Forwarded-Proto": "https" };
  const server = spawn(process.execPath, [
    "node_modules/next/dist/bin/next", "start", "--hostname", "127.0.0.1", "--port", String(port),
  ], {
    env: {
      ...process.env,
      NODE_ENV: "production",
      DATABASE_URL: "",
      RESEND_API_KEY: "",
      AUTH_EMAIL_FROM: "",
      BETTER_AUTH_URL: "https://shiftii.example",
      VERCEL_URL: "shiftii-individual-build.vercel.app",
      VERCEL_BRANCH_URL: branchHost,
      VERCEL_PROJECT_PRODUCTION_URL: "shiftii.example",
      AUTH_TRUSTED_ORIGINS: "",
      BETTER_AUTH_SECRET: randomUUID() + randomUUID(),
      NEXT_PUBLIC_AUTH_ENABLED: "true",
    },
    stdio: ["ignore", "pipe", "pipe"],
  });
  let startupLog = "";
  const captureStartup = (chunk) => { startupLog = (startupLog + chunk.toString()).slice(-4_000); };
  server.stdout.on("data", captureStartup);
  server.stderr.on("data", captureStartup);
  t.after(async () => {
    if (server.exitCode !== null) return;
    const exited = once(server, "exit");
    server.kill();
    await exited;
  });

  let ready = false;
  for (let attempt = 0; attempt < 60; attempt++) {
    assert.equal(server.exitCode, null, `The isolated application server stopped unexpectedly.\n${startupLog}`);
    try {
      const response = await fetch(`${origin}/api/auth/get-session`, {
        headers: deploymentHeaders,
        signal: AbortSignal.timeout(1_000),
      });
      if (response.ok) { ready = true; break; }
    } catch { /* Next.js and PGLite are still starting. */ }
    await delay(500);
  }
  assert.equal(ready, true, `The isolated application server did not become ready.\n${startupLog}`);

  const email = `signup-${randomUUID()}@example.invalid`;
  const password = `Test-only-${randomUUID()}`;
  async function post(path, body, cookie = "") {
    return fetch(`${origin}/api/auth/${path}`, {
      method: "POST",
      headers: { ...deploymentHeaders, "Content-Type": "application/json", Origin: authOrigin, Cookie: cookie },
      body: JSON.stringify(body),
      signal: AbortSignal.timeout(20_000),
    });
  }
  function sessionCookie(response) {
    const cookie = response.headers.getSetCookie()
      .find((value) => value.startsWith("__Host-grok-auth.session_token="));
    assert.ok(cookie, "Authentication must set a session cookie.");
    assert.match(cookie, /HttpOnly/i);
    assert.match(cookie, /Secure/i);
    return cookie.split(";")[0];
  }
  async function session(cookie) {
    const response = await fetch(`${origin}/api/auth/get-session`, {
      headers: { ...deploymentHeaders, Cookie: cookie },
    });
    assert.equal(response.status, 200);
    return response.json();
  }
  async function onboardingAction(name, args, cookie = "") {
    const manifest = JSON.parse(readFileSync(".next/server/server-reference-manifest.json", "utf8"));
    const entry = Object.entries(manifest.node).find(([, value]) =>
      value.exportedName === name && Object.hasOwn(value.workers, "app/onboarding/page"));
    assert.ok(entry, `The built app must export the ${name} server action.`);
    const response = await fetch(`${origin}/onboarding`, {
      method: "POST",
      headers: {
        ...deploymentHeaders, Cookie: cookie, Origin: authOrigin,
        "Next-Action": entry[0], Accept: "text/x-component",
        "Content-Type": "text/plain;charset=UTF-8", "Sec-Fetch-Site": "same-origin",
      },
      body: JSON.stringify(args),
    });
    assert.equal(response.status, 200);
    const records = (await response.text()).split("\n").flatMap((line) => {
      const match = /^[0-9a-f]+:(\{.*\})$/.exec(line);
      if (!match) return [];
      try { return [JSON.parse(match[1])]; } catch { return []; }
    });
    const result = records.find((value) => typeof value.ok === "boolean");
    assert.ok(result, "The server action must return an application result.");
    return result;
  }

  const untrusted = await fetch(`${origin}/api/auth/sign-up/email`, {
    method: "POST",
    headers: { ...deploymentHeaders, "Content-Type": "application/json", Origin: "https://unrelated-project.vercel.app" },
    body: JSON.stringify({ name: "Test owner", email, password }),
  });
  assert.equal(untrusted.status, 403, "Unrelated Vercel projects must remain untrusted.");

  const weak = await post("sign-up/email", { name: "Test owner", email, password: "short" });
  assert.equal(weak.status, 400, "Password validation must remain enforced.");

  const created = await post("sign-up/email", { name: "Test owner", email, password });
  assert.equal(created.status, 200, "Signup must succeed without Resend settings.");
  const createdBody = await created.json();
  assert.equal(createdBody.user.email, email);
  assert.equal(createdBody.user.emailVerified, false, "Skipping email delivery must not verify an address.");
  assert.ok(createdBody.token, "Signup must immediately establish a session.");
  const cookie = sessionCookie(created);
  assert.equal((await session(cookie)).user.id, createdBody.user.id);

  const onboarding = await fetch(`${origin}/onboarding`, { headers: { ...deploymentHeaders, Cookie: cookie } });
  assert.equal(onboarding.status, 200);
  assert.equal(new URL(onboarding.url).pathname, "/onboarding");

  const unauthenticated = await onboardingAction("getOnboardingStatus", []);
  assert.equal(unauthenticated.status, 401, "Company setup must require a real session.");
  const beforeRegistration = await onboardingAction("getOnboardingStatus", [], cookie);
  assert.equal(beforeRegistration.ok, true);
  assert.equal(beforeRegistration.data.hasCompany, false);
  const company = await onboardingAction("registerCompany", [{
    companyName: "Integration test company", ownerName: "Test owner", timezone: "America/Winnipeg",
    contactEmail: email, firstLocation: "Test location", firstPosition: "Test role",
    companyCode: `TEST-${randomUUID().slice(0, 8).toUpperCase()}`,
  }], cookie);
  assert.equal(company.ok, true, company.error ?? "The signed-in owner must be able to create a company.");
  const afterRegistration = await onboardingAction("getOnboardingStatus", [], cookie);
  assert.equal(afterRegistration.ok, true);
  assert.equal(afterRegistration.data.hasCompany, true);
  assert.equal(afterRegistration.data.organizationName, "Integration test company");

  const signedOut = await post("sign-out", {}, cookie);
  assert.equal(signedOut.status, 200);
  assert.equal(await session(cookie), null, "Signing out must invalidate the server session.");

  const wrongPassword = await post("sign-in/email", { email, password: `${password}-wrong` });
  assert.equal(wrongPassword.status, 401);
  const signedIn = await post("sign-in/email", { email, password });
  assert.equal(signedIn.status, 200, "Unverified accounts must be able to use their correct password during the pause.");
  assert.equal((await session(sessionCookie(signedIn))).user.emailVerified, false);

  const otp = await post("email-otp/send-verification-otp", { email, type: "email-verification" });
  assert.equal(otp.status, 404, "The email OTP plugin must not be registered while paused.");
  const reset = await post("request-password-reset", { email });
  assert.equal(reset.ok, false, "Password reset must be disabled without a delivery callback.");

  const signupPage = await fetch(`${origin}/signup`, { headers: deploymentHeaders });
  assert.doesNotMatch(await signupPage.text(), /Registration is awaiting our email verification configuration/);
  const loginPage = await fetch(`${origin}/login`, { headers: deploymentHeaders });
  assert.doesNotMatch(await loginPage.text(), /Forgot password\?/);
});
