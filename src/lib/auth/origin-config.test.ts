import assert from "node:assert/strict";
import { test } from "node:test";
import { authOriginConfig } from "./origin-config.ts";

const preview = ["*.grok-sandbox.com"];

test("Next.js local ports are trusted in development, not production", () => {
  const dev=authOriginConfig({NODE_ENV:"development"},preview);
  assert.ok(dev.trustedOrigins.includes("http://localhost:3000"));
  assert.ok(dev.trustedOrigins.includes("http://127.0.0.1:8080"));
  assert.ok(dev.trustedOrigins.includes("https://*.grok-sandbox.com"));
  const prod=authOriginConfig({NODE_ENV:"production",BETTER_AUTH_URL:"https://shiftii.example"},preview);
  assert.deepEqual(prod.trustedOrigins,["https://shiftii.example"]);
});

test("approved Vercel preview host is trusted by exact hostname", () => {
  const config=authOriginConfig({
    NODE_ENV:"production",
    BETTER_AUTH_URL:"https://shiftii.example",
    VERCEL_URL:"shiftii-preview-abc.vercel.app",
    VERCEL_PROJECT_PRODUCTION_URL:"shiftii.vercel.app",
  },preview);
  assert.ok(config.trustedOrigins.includes("https://shiftii-preview-abc.vercel.app"));
  assert.ok(config.trustedOrigins.includes("https://shiftii.example"));
  assert.ok(!config.trustedOrigins.includes("https://*.vercel.app"));
  assert.ok(typeof config.baseURL !== "string");
});

test("production rejects insecure, malformed and credentialed origins", () => {
  for(const value of ["http://shiftii.example","https://evil.example/path","https://x:y@shiftii.example","javascript:alert(1)"]) {
    assert.throws(()=>authOriginConfig({NODE_ENV:"production",AUTH_TRUSTED_ORIGINS:value},preview));
  }
});

test("Vercel branch aliases are trusted alongside deployment and production hosts", () => {
  const branch = "shifty-git-backend-stabilization-shiftii629-5840.vercel.app";
  const config = authOriginConfig({
    NODE_ENV: "production",
    BETTER_AUTH_URL: "https://shifty-pink.vercel.app",
    VERCEL_URL: "shifty-deployment-abc.vercel.app",
    VERCEL_BRANCH_URL: branch,
    VERCEL_PROJECT_PRODUCTION_URL: "shifty-pink.vercel.app",
  }, preview);
  assert.ok(config.trustedOrigins.includes(`https://${branch}`));
  assert.ok(typeof config.baseURL !== "string");
  assert.ok(config.baseURL.allowedHosts.includes(branch));
  assert.ok(!config.baseURL.allowedHosts.includes("*.vercel.app"));
  assert.ok(!config.trustedOrigins.includes("https://unrelated-project.vercel.app"));
});

test("branch origins use the same HTTPS and exact-origin validation", () => {
  for (const branch of ["http://branch.vercel.app", "https://branch.vercel.app/path", "https://user:password@branch.vercel.app"]) {
    assert.throws(() => authOriginConfig({ NODE_ENV: "production", VERCEL_BRANCH_URL: branch }, preview));
  }
});

test("one approved production origin uses fixed base URL", () => {
  const config=authOriginConfig({NODE_ENV:"production",BETTER_AUTH_URL:"https://shiftii.example/"},preview);
  assert.equal(config.baseURL,"https://shiftii.example");
});

test("extra origins must be explicitly configured", () => {
  const config=authOriginConfig({NODE_ENV:"production",AUTH_TRUSTED_ORIGINS:"https://one.example, https://two.example"},preview);
  assert.deepEqual(config.trustedOrigins,["https://one.example","https://two.example"]);
});
