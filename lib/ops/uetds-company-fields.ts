import { resolveUetdsMinistryRuntime } from "@/lib/uetds/ministry-env";

export const UETDS_COMPANY_STATUSES = ["active", "inactive"] as const;
export type UetdsCompanyStatus = (typeof UETDS_COMPANY_STATUSES)[number];

export const UETDS_INTEGRATION_STATUSES = ["incomplete", "ready", "error"] as const;
export type UetdsIntegrationStatus = (typeof UETDS_INTEGRATION_STATUSES)[number];

export const UETDS_AUTHORITY_TYPES = ["D1", "D2"] as const;
export type UetdsAuthorityType = (typeof UETDS_AUTHORITY_TYPES)[number];

export type UetdsCredentialEnv = "test" | "live";

export type UetdsCompanyRef = {
  id: string;
  shortName: string;
};

export const UETDS_NOTIFY_NONE_VALUE = "";

export type UetdsCompanyListItem = {
  id: string;
  shortName: string;
  legalName: string;
  taxNumber: string;
  authorityDocumentType: UetdsAuthorityType;
  authorityDocumentNumber: string;
  status: UetdsCompanyStatus;
  integrationStatus: UetdsIntegrationStatus;
  createdAt: string;
  updatedAt: string;
};

export type UetdsCompanyEditor = {
  id: string;
  shortName: string;
  legalName: string;
  taxNumber: string;
  authorityDocumentType: UetdsAuthorityType;
  authorityDocumentNumber: string;
  status: UetdsCompanyStatus;
  integrationStatus: UetdsIntegrationStatus;
  testUsername: string;
  liveUsername: string;
  hasTestPassword: boolean;
  hasLivePassword: boolean;
};

export type UetdsCompanyInput = {
  shortName: string;
  legalName: string;
  taxNumber: string;
  authorityDocumentType: UetdsAuthorityType;
  authorityDocumentNumber: string;
  status: UetdsCompanyStatus;
  testUsername: string;
  liveUsername: string;
  testPassword: string | null;
  livePassword: string | null;
};

export function isUetdsCompanyStatus(value: string): value is UetdsCompanyStatus {
  return (UETDS_COMPANY_STATUSES as readonly string[]).includes(value);
}

export function isUetdsAuthorityType(value: string): value is UetdsAuthorityType {
  return (UETDS_AUTHORITY_TYPES as readonly string[]).includes(value);
}

export function isUetdsIntegrationStatus(
  value: string,
): value is UetdsIntegrationStatus {
  return (UETDS_INTEGRATION_STATUSES as readonly string[]).includes(value);
}

function clip(value: string, max: number) {
  return value.trim().slice(0, max);
}

export function parseUetdsCompanyInput(input: {
  shortName?: string;
  legalName?: string;
  taxNumber?: string;
  authorityDocumentType?: string;
  authorityDocumentNumber?: string;
  status?: string;
  testUsername?: string;
  liveUsername?: string;
  testPassword?: string;
  livePassword?: string;
}): UetdsCompanyInput | null {
  const shortName = clip(input.shortName ?? "", 120);
  const legalName = clip(input.legalName ?? "", 240);
  const taxNumber = clip(input.taxNumber ?? "", 32);
  const authorityDocumentType = (input.authorityDocumentType ?? "").trim();
  const authorityDocumentNumber = clip(input.authorityDocumentNumber ?? "", 64);
  const status = (input.status ?? "active").trim();
  const testUsername = clip(input.testUsername ?? "", 120);
  const liveUsername = clip(input.liveUsername ?? "", 120);
  const testPassword = (input.testPassword ?? "").trim();
  const livePassword = (input.livePassword ?? "").trim();

  if (
    !shortName ||
    !legalName ||
    !taxNumber ||
    !authorityDocumentNumber ||
    !isUetdsAuthorityType(authorityDocumentType) ||
    !isUetdsCompanyStatus(status)
  ) {
    return null;
  }

  return {
    shortName,
    legalName,
    taxNumber,
    authorityDocumentType,
    authorityDocumentNumber,
    status,
    testUsername,
    liveUsername,
    testPassword: testPassword || null,
    livePassword: livePassword || null,
  };
}

export function computeUetdsIntegrationStatus(
  input: {
    shortName: string;
    legalName: string;
    taxNumber: string;
    authorityDocumentType: string;
    authorityDocumentNumber: string;
    testUsername: string;
    liveUsername: string;
    hasTestPassword: boolean;
    hasLivePassword: boolean;
  },
  env: Record<string, string | undefined> = process.env,
): Exclude<UetdsIntegrationStatus, "error"> {
  const required =
    Boolean(input.shortName.trim()) &&
    Boolean(input.legalName.trim()) &&
    Boolean(input.taxNumber.trim()) &&
    isUetdsAuthorityType(input.authorityDocumentType) &&
    Boolean(input.authorityDocumentNumber.trim());
  const testReady = Boolean(input.testUsername.trim()) && input.hasTestPassword;
  const liveReady = Boolean(input.liveUsername.trim()) && input.hasLivePassword;
  const runtime = resolveUetdsMinistryRuntime(env);
  const credentialsReady =
    runtime === "live" ? liveReady : runtime === "test" ? testReady : false;
  if (required && credentialsReady) {
    return "ready";
  }
  return "incomplete";
}

export function formatUetdsAuthorityDocument(
  type: UetdsAuthorityType,
  number: string,
) {
  return `${type} · ${number}`;
}
