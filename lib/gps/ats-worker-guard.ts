export function assertAtsWorkerWithheld(env: Record<string, string | undefined>) {
  if (env.NODE_ENV === "production" || env.EXPECTED_DATABASE !== "tripetica_dev") {
    throw new Error("ats_worker_blocked");
  }
  if (env.ATS_MINISTRY_DISPATCH === "allow-test") {
    throw new Error("ats_ministry_dispatch_disabled");
  }
}
