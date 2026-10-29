import test from "node:test";
import assert from "node:assert/strict";
import { addCalendarDays, startOfCalendarWeek, localClockToIso, shiftWindowFromClock, moveShiftWindow } from "./calendar.ts";

test("calendar week honors an organization's configured starting day", () => {
  assert.equal(startOfCalendarWeek("2026-10-28", 1), "2026-10-26");
  assert.equal(startOfCalendarWeek("2026-10-28", 0), "2026-10-25");
  assert.equal(addCalendarDays("2026-12-31", 1), "2027-01-01");
  assert.throws(() => addCalendarDays("2026-02-30", 1));
});

test("convert Winnipeg local clocks in summer and winter", () => {
  assert.equal(localClockToIso("2026-07-01", "09:00", "America/Winnipeg"), "2026-07-01T14:00:00.000Z");
  assert.equal(localClockToIso("2026-01-01", "09:00", "America/Winnipeg"), "2026-01-01T15:00:00.000Z");
});

test("reject nonexistent DST time and choose earliest ambiguous fall time", () => {
  assert.throws(() => localClockToIso("2026-03-08", "02:30", "America/Winnipeg"), /does not exist/);
  assert.equal(localClockToIso("2026-11-01", "01:30", "America/Winnipeg"), "2026-11-01T06:30:00.000Z");
});

test("overnight shifts and drag movement retain local clock times", () => {
  const original = shiftWindowFromClock("2026-10-28", "19:00", "07:00", "America/Winnipeg");
  assert.equal(original.startAt, "2026-10-29T00:00:00.000Z");
  assert.equal(original.endAt, "2026-10-29T12:00:00.000Z");
  const moved = moveShiftWindow(original.startAt, original.endAt, "2026-10-29", "America/Winnipeg");
  assert.equal(moved.startAt, "2026-10-30T00:00:00.000Z");
  assert.equal(moved.endAt, "2026-10-30T12:00:00.000Z");
});
