import assert from "node:assert/strict";
import test from "node:test";
import {
  evaluateOpsUserCreate,
  evaluateOpsUserUpdate,
} from "@/lib/ops/user-mutation-policy";

const owner = {
  id: "owner-a",
  role: "owner" as const,
  canManageUsers: true,
};
const employee = {
  id: "employee-a",
  role: "employee" as const,
  canManageUsers: true,
};

test("employee with users.manage cannot create an owner", () => {
  assert.deepEqual(evaluateOpsUserCreate(employee, "owner"), {
    allowed: false,
    reason: "forbidden",
  });
});

test("employee cannot promote itself to owner", () => {
  assert.deepEqual(
    evaluateOpsUserUpdate({
      actor: employee,
      target: { ...employee, isActive: true },
      nextRole: "owner",
      nextIsActive: true,
      activeOwnersExcludingTarget: 1,
    }),
    { allowed: false, reason: "forbidden" },
  );
});

test("owner can create another owner", () => {
  assert.deepEqual(evaluateOpsUserCreate(owner, "owner"), { allowed: true });
});

test("owner can promote an employee to owner", () => {
  assert.deepEqual(
    evaluateOpsUserUpdate({
      actor: owner,
      target: { ...employee, isActive: true },
      nextRole: "owner",
      nextIsActive: true,
      activeOwnersExcludingTarget: 1,
    }),
    { allowed: true },
  );
});

test("employee cannot modify or deactivate an owner", () => {
  assert.deepEqual(
    evaluateOpsUserUpdate({
      actor: employee,
      target: { ...owner, isActive: true },
      nextRole: "owner",
      nextIsActive: false,
      activeOwnersExcludingTarget: 1,
    }),
    { allowed: false, reason: "forbidden" },
  );
});

test("last active owner protection remains enforced", () => {
  assert.deepEqual(
    evaluateOpsUserUpdate({
      actor: owner,
      target: { ...owner, isActive: true },
      nextRole: "employee",
      nextIsActive: true,
      activeOwnersExcludingTarget: 0,
    }),
    { allowed: false, reason: "last-owner" },
  );
});
