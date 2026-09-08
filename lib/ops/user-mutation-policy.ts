import { type OpsRole } from "@/lib/ops/permissions";

export type OpsUserMutationActor = {
  id: string;
  role: OpsRole;
  canManageUsers: boolean;
};

export type OpsUserMutationTarget = {
  id: string;
  role: OpsRole;
  isActive: boolean;
};

export type OpsUserMutationDecision =
  | { allowed: true }
  | { allowed: false; reason: "forbidden" | "last-owner" };

export function evaluateOpsUserCreate(
  actor: OpsUserMutationActor,
  nextRole: OpsRole,
): OpsUserMutationDecision {
  if (!actor.canManageUsers) {
    return { allowed: false, reason: "forbidden" };
  }
  if (nextRole === "owner" && actor.role !== "owner") {
    return { allowed: false, reason: "forbidden" };
  }
  return { allowed: true };
}

export function evaluateOpsUserUpdate(input: {
  actor: OpsUserMutationActor;
  target: OpsUserMutationTarget;
  nextRole: OpsRole;
  nextIsActive: boolean;
  activeOwnersExcludingTarget: number;
}): OpsUserMutationDecision {
  const { actor, target, nextRole, nextIsActive } = input;

  if (!actor.canManageUsers) {
    return { allowed: false, reason: "forbidden" };
  }
  if (
    actor.role !== "owner" &&
    (target.role === "owner" || nextRole === "owner")
  ) {
    return { allowed: false, reason: "forbidden" };
  }

  const removesActiveOwner =
    target.role === "owner" &&
    target.isActive &&
    (nextRole !== "owner" || !nextIsActive);
  if (removesActiveOwner && input.activeOwnersExcludingTarget < 1) {
    return { allowed: false, reason: "last-owner" };
  }

  return { allowed: true };
}
