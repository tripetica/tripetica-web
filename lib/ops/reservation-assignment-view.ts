import { type AssignJobError } from "@/lib/partner/job-assignment-view";
import {
  type PartnerDriverRecord,
  type PartnerVehicleRecord,
} from "@/lib/partner/fleet-view";

export type OpsAssignmentPartnerOption = {
  id: string;
  name: string;
  partnerCode: string;
};

export type OpsAssignmentFleet = {
  drivers: PartnerDriverRecord[];
  vehicles: PartnerVehicleRecord[];
};

export type OpsAssignmentError =
  | AssignJobError
  | "no-partner"
  | "inactive-partner"
  | "forbidden";
