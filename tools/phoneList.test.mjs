import assert from "node:assert/strict";
import { test } from "node:test";

import { parsePhoneList } from "../src/lib/format.ts";

test("טלפונים: כל מפריד סביר מתקבל", () => {
  const { phones, invalid } = parsePhoneList("0501234567, 052-999-8877\n0549998877");
  assert.deepEqual(phones, ["0501234567", "0529998877", "0549998877"]);
  assert.deepEqual(invalid, []);
});

test("טלפונים: +972 מתורגם, וכפילות נכנסת פעם אחת", () => {
  const { phones } = parsePhoneList("+972501234567, 0501234567");
  assert.deepEqual(phones, ["0501234567"]);
});

test("טלפונים: מה שנפסל מוחזר כדי שאפשר יהיה להגיד מה לתקן", () => {
  const { phones, invalid } = parsePhoneList("0501234567, 12345, abc");
  assert.deepEqual(phones, ["0501234567"]);
  assert.deepEqual(invalid, ["12345", "abc"]);
});

test("טלפונים: שדה ריק אינו שגיאה", () => {
  assert.deepEqual(parsePhoneList("   "), { phones: [], invalid: [] });
});
