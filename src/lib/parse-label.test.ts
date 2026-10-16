import { test } from "node:test";
import assert from "node:assert/strict";
import { parseLabel } from "./parse-label.ts";

test("full label", () => {
  const r = parseLabel("לכבוד: ישראל ישראלי\nרחוב הרצל 14 דירה 3\nחדרה 3842101\nRR123456789IL");
  assert.equal(r.street, "הרצל");
  assert.equal(r.houseNumber, "14");
  assert.equal(r.apartment, "3");
  assert.equal(r.city, "חדרה");
  assert.equal(r.zip, "3842101");
  assert.equal(r.trackingNumber, "RR123456789IL");
});

test("street and city on one line, letter suffix", () => {
  const r = parseLabel("שד' רוטשילד 21א, פרדס חנה-כרכור");
  assert.equal(r.street, "רוטשילד");
  assert.equal(r.houseNumber, "21א");
  assert.equal(r.city, "פרדס חנה-כרכור");
});

test("missing fields stay null", () => {
  const r = parseLabel("טלפון 050-1234567");
  assert.equal(r.street, null);
  assert.equal(r.city, null);
  assert.equal(r.zip, null);
});
