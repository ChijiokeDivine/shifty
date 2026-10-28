import test from "node:test";
import assert from "node:assert/strict";
import { minutesOfDayInZone } from "./local-time.ts";

test("availability uses Winnipeg local clock, not UTC", () => {
  assert.equal(minutesOfDayInZone("2026-07-01T14:30:00Z", "America/Winnipeg"), 9 * 60 + 30);
  assert.equal(minutesOfDayInZone("2026-01-01T15:30:00Z", "America/Winnipeg"), 9 * 60 + 30);
});

test("availability respects different organization timezones", () => {
  assert.equal(minutesOfDayInZone("2026-07-01T14:30:00Z", "America/Toronto"), 10 * 60 + 30);
  assert.equal(minutesOfDayInZone("2026-07-01T14:30:00Z", "UTC"), 14 * 60 + 30);
});

test("availability supports midnight", () => {
  assert.equal(minutesOfDayInZone("2026-07-01T00:00:00Z", "UTC"), 0);
});
