"use server";

import { listOpsDrivers, OPS_DRIVERS_PAGE_SIZE } from "@/lib/ops/drivers";
import { parseOpsDriverSortDir } from "@/lib/ops/driver-filters";
import { actorCan, getOpsActor } from "@/lib/ops/session";

export async function searchOpsDriversAction(input: {
  query: string;
  dir: string;
  page: number;
}) {
  const actor = await getOpsActor();
  if (!actor || !actorCan(actor, "partners.view")) {
    return { items: [], total: 0, page: 1, pageSize: OPS_DRIVERS_PAGE_SIZE };
  }
  return listOpsDrivers({
    query: input.query,
    dir: parseOpsDriverSortDir(input.dir),
    page: input.page,
    pageSize: OPS_DRIVERS_PAGE_SIZE,
  });
}
