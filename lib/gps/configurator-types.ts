import type { ConfigValues } from "@/lib/teltonika/config-plan";

export type ConfiguratorVersion = {
  id: string;
  version: number;
  status: "draft" | "approved";
  values: ConfigValues;
  note: string;
  createdAt: string;
};

export type ConfiguratorParameterApply = {
  id: string;
  deviceId: string;
  plate: string | null;
  imei: string;
  parameterId: number;
  from: string;
  to: string;
  verified: string;
  phase: string;
  error: string | null;
  createdAt: string;
  finishedAt: string | null;
  actorName: string;
};

export type ConfiguratorJob = {
  id: string;
  deviceId: string;
  plate: string | null;
  imei: string;
  partnerName: string | null;
  model: string | null;
  version: number;
  phase: string;
  error: string | null;
  createdAt: string;
};

export type ConfiguratorSnapshot = {
  database: string;
  writesOpen: boolean;
  restartOpen: boolean;
  saveOpen: boolean;
  transmissionOpen: boolean;
  profileName: string | null;
  latest: ConfiguratorVersion | null;
  approved: ConfiguratorVersion | null;
  versions: ConfiguratorVersion[];
  overrides: { deviceId: string; values: ConfigValues }[];
  jobs: ConfiguratorJob[];
  parameterApplies: ConfiguratorParameterApply[];
  readsOpen: boolean;
  reads: {
    deviceId: string;
    values: ConfigValues;
    readAt: string | null;
    status: "answered" | "pending" | "failed" | "partial" | "none";
    progress: { read: number; total: number; unsupported: number; empty: number; failed: number; unresolved: number; phase: string } | null;
  }[];
  restarts: { deviceId: string; phase: string; error: string | null; createdAt: string }[];
  keywords: { deviceId: string; hasKeyword: boolean; phase: string | null; error: string | null }[];
  firmware: { model: string; firmware: string }[];
};
