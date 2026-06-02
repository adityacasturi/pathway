import assert from "node:assert/strict";
import test from "node:test";
import {
  assertSupabaseOk,
  formatSupabaseMutationError,
} from "../../lib/supabase/errors.ts";

test("assertSupabaseOk passes on null error", () => {
  assert.doesNotThrow(() => assertSupabaseOk(null, "load applications"));
});

test("assertSupabaseOk throws with label and code", () => {
  assert.throws(
    () => assertSupabaseOk({ message: "boom", code: "XX000" }, "save"),
    /save failed \(XX000\): boom/,
  );
});

test("formatSupabaseMutationError maps known messages and codes", () => {
  assert.equal(
    formatSupabaseMutationError({ message: "Too many attempts right now" }),
    "Too many attempts. Please wait a moment and try again.",
  );
  assert.equal(
    formatSupabaseMutationError({ message: "Application not found" }),
    "Application not found.",
  );
  assert.equal(
    formatSupabaseMutationError({ message: "duplicate", code: "23505" }),
    "That item already exists.",
  );
  assert.equal(
    formatSupabaseMutationError({ message: "unknown", code: "99999" }),
    "Unable to save changes. Please try again.",
  );
});
