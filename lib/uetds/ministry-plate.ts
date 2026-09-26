import { resolveUetdsMinistryRuntime } from "@/lib/uetds/ministry-env";
import { UETDS_OFFICIAL_TEST_ARAC_PLAKA } from "@/lib/uetds/ministry-test-fixtures";

export function canonicalMinistryPlate(plate: string) {
  const canonical = plate.replace(/\s+/g, "").toUpperCase();
  const runtime = resolveUetdsMinistryRuntime();
  if (!runtime || !canonical || (runtime === "live" && canonical === UETDS_OFFICIAL_TEST_ARAC_PLAKA)) {
    throw new Error("uetds_live_blocked");
  }
  return canonical;
}
