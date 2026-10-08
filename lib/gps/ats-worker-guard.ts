export function assertAtsWorkerWithheld(env: Record<string, string | undefined>) {
  if (env.NODE_ENV === "production" || env.EXPECTED_DATABASE !== "tripetica_dev") {
    throw new Error("ats_worker_blocked");
  }
}

/** Production worker may run. The test ministry socket stays closed. Live send needs a separate flag. */
export function assertProdAtsDispatchWithheld(env: Record<string, string | undefined>) {
  if (env.NODE_ENV !== "production" || env.EXPECTED_DATABASE !== "tripetica") {
    throw new Error("ats_worker_blocked");
  }
  if (env.ATS_MINISTRY_DISPATCH === "allow-test") {
    throw new Error("ats_live_dispatch_blocked");
  }
}
