import assert from "node:assert/strict";
import { test } from "node:test";
import {
  addDaysIso,
  asIsoDate,
  isLeapJalaaliYear,
  isOverdue,
  isoToJalaali,
  isoToJalaaliStr,
  jalaaliToIso,
  toGregorian,
  toJalaali,
} from "./jalali.ts";

test("round-trip a known Nowruz", () => {
  // 1403/01/01 = 2024-03-20
  assert.deepEqual(toJalaali(2024, 3, 20), [1403, 1, 1]);
  assert.deepEqual(toGregorian(1403, 1, 1), [2024, 3, 20]);
  assert.equal(jalaaliToIso(1403, 1, 1), "2024-03-20");
  assert.equal(isoToJalaaliStr("2024-03-20"), "1403/01/01");
});

test("round-trip mid-year and Esfand", () => {
  const samples: [number, number, number][] = [
    [2024, 8, 22],
    [2025, 3, 21],
    [2026, 3, 21],
    [2026, 8, 24],
  ];
  for (const [gy, gm, gd] of samples) {
    const [jy, jm, jd] = toJalaali(gy, gm, gd);
    assert.deepEqual(toGregorian(jy, jm, jd), [gy, gm, gd]);
  }
});

test("asIsoDate strips timestamps and Date objects", () => {
  assert.equal(asIsoDate("2026-08-26"), "2026-08-26");
  assert.equal(asIsoDate("2026-08-26T00:00:00.000Z"), "2026-08-26");
  assert.equal(asIsoDate(new Date("2026-08-26T00:00:00.000Z")), "2026-08-26");
  assert.equal(asIsoDate(null), null);
  assert.equal(asIsoDate(""), null);
  assert.deepEqual(isoToJalaali("2026-08-26T12:00:00.000Z"), isoToJalaali("2026-08-26"));
});

test("leap Esfand and overdue", () => {
  assert.equal(isLeapJalaaliYear(1403), true);
  assert.equal(isOverdue("1999-01-01", false), true);
  assert.equal(isOverdue("1999-01-01", true), false);
  assert.equal(isOverdue(null, false), false);
  assert.equal(addDaysIso("2026-08-24", 2), "2026-08-26");
});
