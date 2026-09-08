export const PARTNER_JOB_TIME_ZONE = "Europe/Istanbul";

export const TARGET_LEVEL_1_BEFORE_START_MS = 2 * 60 * 60 * 1000;
export const TARGET_LEVEL_2_BEFORE_START_MS = 90 * 60 * 1000;
export const TARGET_LEVEL_3_BEFORE_START_MS = 60 * 60 * 1000;
export const MIN_LEVEL_GAP_MS = 10 * 60 * 1000;

/** 0 = Ana Partner, 1–3 = dış partner seviyeleri. */
export type PartnerJobRank = 0 | 1 | 2 | 3;

export type JobReleaseTimes = {
  primary: Date;
  level1: Date;
  level2: Date;
  level3: Date;
};

export function partnerJobRank(input: {
  isPrimaryPartner: boolean;
  priorityLevel: number | null | undefined;
}): PartnerJobRank | null {
  if (input.isPrimaryPartner) {
    return 0;
  }
  if (input.priorityLevel === 1 || input.priorityLevel === 2 || input.priorityLevel === 3) {
    return input.priorityLevel;
  }
  return null;
}

export function computeJobReleaseTimes(createdAt: Date, serviceStartAt: Date): JobReleaseTimes {
  const primary = createdAt;
  const level1 = laterOf(
    serviceStartAt.getTime() - TARGET_LEVEL_1_BEFORE_START_MS,
    primary.getTime() + MIN_LEVEL_GAP_MS,
  );
  const level2 = laterOf(
    serviceStartAt.getTime() - TARGET_LEVEL_2_BEFORE_START_MS,
    level1.getTime() + MIN_LEVEL_GAP_MS,
  );
  const level3 = laterOf(
    serviceStartAt.getTime() - TARGET_LEVEL_3_BEFORE_START_MS,
    level2.getTime() + MIN_LEVEL_GAP_MS,
  );
  return { primary, level1, level2, level3 };
}

export function effectiveVisibleMaxRank(input: {
  now: Date;
  pickupAt: Date;
  createdAt: Date;
}): PartnerJobRank {
  const releases = computeJobReleaseTimes(input.createdAt, input.pickupAt);
  const now = input.now.getTime();
  if (now >= releases.level3.getTime()) {
    return 3;
  }
  if (now >= releases.level2.getTime()) {
    return 2;
  }
  if (now >= releases.level1.getTime()) {
    return 1;
  }
  return 0;
}

export function partnerCanSeeOpenJob(
  rank: PartnerJobRank | null,
  maxRank: PartnerJobRank,
) {
  return rank !== null && rank <= maxRank;
}

export function partnerCanSeePassengerContact(rank: PartnerJobRank | null) {
  return rank === 0 || rank === 1;
}

function laterOf(left: number, right: number) {
  return new Date(Math.max(left, right));
}
