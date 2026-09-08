import { type OpsCopy } from "@/lib/ops/copy";
import { type PartnerPriorityLevel, type PartnerStatus } from "@/lib/partner/constants";

export function partnerStatusLabel(status: PartnerStatus, copy: OpsCopy) {
  if (status === "pending") {
    return copy.pending;
  }
  if (status === "active") {
    return copy.active;
  }
  return copy.inactive;
}

export function partnerStatusBadgeClass(status: PartnerStatus) {
  if (status === "pending") {
    return "is-pending";
  }
  if (status === "active") {
    return "is-active";
  }
  return "is-inactive";
}

export function partnerPriorityLabel(
  level: PartnerPriorityLevel | null,
  copy: OpsCopy,
) {
  if (level === 1) {
    return copy.partnerPriority1;
  }
  if (level === 2) {
    return copy.partnerPriority2;
  }
  if (level === 3) {
    return copy.partnerPriority3;
  }
  return copy.partnerPriorityUnset;
}

export function partnerLevelLabel(
  item: {
    isPrimaryPartner: boolean;
    priorityLevel: PartnerPriorityLevel | null;
  },
  copy: OpsCopy,
) {
  if (item.isPrimaryPartner) {
    return copy.primaryPartner;
  }
  if (item.priorityLevel === 1) {
    return copy.partnerPriority1;
  }
  if (item.priorityLevel === 2) {
    return copy.partnerPriority2;
  }
  if (item.priorityLevel === 3) {
    return copy.partnerPriority3;
  }
  return "—";
}

export function partnerBusinessTypeLabel(
  value: string | null,
  copy: OpsCopy,
) {
  if (value === "individual") {
    return copy.partnerIndividual;
  }
  if (value === "company") {
    return copy.partnerCompany;
  }
  return "—";
}
