import { atsAutomaticFaultReportEnabled } from "@/lib/uetds/ats-soap";
import { decideAtsSubmission, type AtsRuntime } from "@/lib/gps/ats-policy";
import { resolveAtsDistrict, type AtsDistrictBoundary } from "@/lib/gps/ats-district";

export type AtsDispatchCandidate = {
  runtime: AtsRuntime;
  enabled: boolean;
  sourceDeviceId: string | null;
  device: { id: string; vehicleId: string | null; status: string };
  vehicle: { id: string; plate: string; companyId: string | null; deleted: boolean } | null;
  company: { id: string; status: string; integrationStatus: string } | null;
  position: {
    id: string;
    deviceId: string;
    vehicleId: string;
    recordedAt: string;
    receivedAt: string;
    latitude: number;
    longitude: number;
  };
  alreadySubmitted: boolean;
};

export type AtsDispatchCall = {
  positionId: string;
  plate: string;
  gnssTime: string;
  ilKodu: number;
  ilceMernisKodu: number;
};

export type AtsMockResult = { sonucKodu: number | null; sonucMesaji: string } | { withheld: true };

export async function dispatchAtsCandidates(input: {
  candidates: readonly AtsDispatchCandidate[];
  boundaries?: readonly AtsDistrictBoundary[];
  liveDispatchApproved?: boolean;
  transport: (call: AtsDispatchCall) => Promise<AtsMockResult>;
}) {
  if (atsAutomaticFaultReportEnabled()) {
    throw new Error("ats_fault_report_blocked");
  }
  const sent: AtsDispatchCall[] = [];
  const withheld: string[] = [];
  const blocked: Array<{ positionId: string; reason: string }> = [];
  for (const candidate of input.candidates) {
    const district = resolveAtsDistrict(
      candidate.position.latitude,
      candidate.position.longitude,
      input.boundaries,
    );
    const decision = decideAtsSubmission({
      ...candidate,
      liveDispatchApproved: input.liveDispatchApproved === true,
      district,
    });
    if (!decision.ok) {
      blocked.push({ positionId: candidate.position.id, reason: decision.reason });
      continue;
    }
    const call: AtsDispatchCall = {
      positionId: candidate.position.id,
      plate: decision.plate,
      gnssTime: decision.gnssTime,
      ilKodu: decision.ilKodu,
      ilceMernisKodu: decision.ilceMernisKodu,
    };
    const result = await input.transport(call);
    if ("withheld" in result) {
      withheld.push(candidate.position.id);
      continue;
    }
    sent.push(call);
  }
  return { sent, withheld, blocked, faultReports: 0 };
}
