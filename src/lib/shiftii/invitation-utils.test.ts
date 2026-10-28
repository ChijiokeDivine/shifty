import test from "node:test";
import assert from "node:assert/strict";
import {
  normalizeInviteEmail, assertInvitableRole, hashInviteToken,
  newInviteToken, validInviteToken, INVITATION_EXPIRY_MS,
} from "./invitation-utils.ts";

test("invite tokens have enough entropy and only SHA-256 hashes are stored", () => {
  const a = newInviteToken();
  const b = newInviteToken();
  assert.equal(a.length, 64);
  assert.equal(validInviteToken(a), true);
  assert.notEqual(a, b);
  assert.notEqual(hashInviteToken(a), a);
  assert.equal(hashInviteToken(a), hashInviteToken(a));
  assert.equal(hashInviteToken(a).length, 64);
});

test("malformed invite tokens are rejected", () => {
  for (const invalid of ["", "abc", "0".repeat(63), "0".repeat(65), "Z".repeat(64), "../".repeat(20)]) {
    assert.equal(validInviteToken(invalid), false);
    assert.throws(() => hashInviteToken(invalid));
  }
});

test("invitation links have seven-day expiry", () => {
  assert.equal(INVITATION_EXPIRY_MS, 604800000);
});

test("email comparison is normalized and malformed emails fail validation", () => {
  assert.equal(normalizeInviteEmail("  Person@Example.COM  "), "person@example.com");
  for (const invalid of ["", "hello", "a@@example.com", "a b@example.com", "a@example", "a@example.com ".repeat(20)]) {
    assert.throws(() => normalizeInviteEmail(invalid));
  }
});

test("only authorized invitation roles may be assigned", () => {
  assert.doesNotThrow(() => assertInvitableRole("ADMIN", "OWNER"));
  assert.doesNotThrow(() => assertInvitableRole("MANAGER", "ADMIN"));
  assert.doesNotThrow(() => assertInvitableRole("EMPLOYEE", "MANAGER"));
  assert.throws(() => assertInvitableRole("OWNER", "OWNER"));
  assert.throws(() => assertInvitableRole("MANAGER", "MANAGER"));
  assert.throws(() => assertInvitableRole("ADMIN", "ADMIN"));
  assert.throws(() => assertInvitableRole("EMPLOYEE", "EMPLOYEE"));
});
