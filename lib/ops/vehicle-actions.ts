"use server";

import { listOpsVehicles, OPS_VEHICLES_PAGE_SIZE } from "@/lib/ops/vehicles";
import { actorCan, getOpsActor } from "@/lib/ops/session";

export async function searchOpsVehiclesAction(input: {
  query: string;
  page: number;
}) {
  const actor = await getOpsActor();
  if (!actor || !actorCan(actor, "partners.view")) {
    return { items: [], total: 0, page: 1, pageSize: OPS_VEHICLES_PAGE_SIZE, fleetChoices: {} };
  }
  return listOpsVehicles({
    query: input.query,
    page: input.page,
    pageSize: OPS_VEHICLES_PAGE_SIZE,
  });
}
