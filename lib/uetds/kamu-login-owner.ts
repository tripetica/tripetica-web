export type KamuLoginOwnerActors = {
  partner: { partnerId: string; userId: string; uetds: boolean } | null;
  ops: { id: string; uetdsManage: boolean } | null;
  driver: { partnerId: string; driverId: string; uetdsList: boolean } | null;
};

export function kamuLoginOwnerFromActors(actors: KamuLoginOwnerActors) {
  if (actors.partner?.uetds) return `partner:${actors.partner.partnerId}:${actors.partner.userId}`;
  if (actors.ops?.uetdsManage) return `ops:${actors.ops.id}`;
  if (actors.driver?.uetdsList) return `driver:${actors.driver.partnerId}:${actors.driver.driverId}`;
  return null;
}
