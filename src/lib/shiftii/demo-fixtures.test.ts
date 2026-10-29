import assert from "node:assert/strict";
import test from "node:test";
import { DEMO_EMPLOYEES, DEMO_LOCATIONS, DEMO_POSITIONS, demoWeekFixtures, demoFixtureSummary } from "./demo-fixtures.ts";

test("demo employees are unique synthetic identities with valid assignments", () => {
  const keys = new Set(DEMO_EMPLOYEES.map((e) => e.key));
  assert.equal(keys.size, DEMO_EMPLOYEES.length);
  assert.ok(DEMO_EMPLOYEES.length >= 10);
  for (const e of DEMO_EMPLOYEES) {
    assert.ok(DEMO_LOCATIONS.includes(e.location as typeof DEMO_LOCATIONS[number]));
    assert.ok(DEMO_POSITIONS.includes(e.position as typeof DEMO_POSITIONS[number]));
    assert.ok(e.weeklyHours >= 0 && e.weeklyHours <= 168);
  }
});

test("fictional shift fixtures stay inside one week and use known people", () => {
  const employees = new Map(DEMO_EMPLOYEES.map((e) => [e.key, e]));
  const keys = new Set<string>();
  let open = 0;
  for (const s of demoWeekFixtures()) {
    assert.ok(s.offset >= 0 && s.offset <= 6);
    assert.ok(DEMO_LOCATIONS.includes(s.location as typeof DEMO_LOCATIONS[number]));
    assert.ok(DEMO_POSITIONS.includes(s.position as typeof DEMO_POSITIONS[number]));
    if (s.employeeKey) {
      const employee = employees.get(s.employeeKey);
      assert.ok(employee);
      assert.equal(employee.location, s.location);
      assert.equal(employee.position, s.position);
    } else {
      assert.equal(s.openForClaim, true);
      open++;
    }
    assert.match(s.start, /^\d\d:\d\d$/);
    assert.match(s.end, /^\d\d:\d\d$/);
    const key = [s.offset, s.location, s.position, s.employeeKey, s.start, s.end].join(":");
    assert.ok(!keys.has(key), "duplicate shift definition");
    keys.add(key);
  }
  assert.ok(open > 0);
  assert.equal(demoFixtureSummary().shifts, demoWeekFixtures().length * 2);
});
