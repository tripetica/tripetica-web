import catalog from "@/lib/teltonika/data/fmb920-parameters.json";
import { fmb920ObdParameters } from "@/lib/teltonika/obd";

export type ParameterLevel = "standard" | "operational" | "critical";

export type FmbParameter = {
  id: number;
  section: string;
  type: string;
  defaultValue: string;
  min: string;
  max: string;
  name: string;
  options: string[];
  level: ParameterLevel;
  model: "fmb920";
  remote: true;
  evidence: "published-list" | "device-readback";
};

const published = (catalog.parameters as Omit<FmbParameter, "evidence">[])
  .filter((parameter) => parameter.section !== "OBD II (Bluetooth)")
  .map((parameter) => ({
    ...parameter,
    evidence: "published-list" as const,
  }));

/** These three IDs are absent from the fetched parameter list. The fleet returned them on getparam and accepted the approved write. */
const deviceReadback: FmbParameter[] = [
  { id: 11011, section: "Green driving parameters", type: "Uint8", defaultValue: "0", min: "0", max: "1", name: "Eco average", options: ["0 – Disable", "1 – Enable"], level: "standard", model: "fmb920", remote: true, evidence: "device-readback" },
  { id: 11015, section: "Green driving parameters", type: "Uint8", defaultValue: "0", min: "0", max: "1", name: "Eco maximum", options: ["0 – Disable", "1 – Enable"], level: "standard", model: "fmb920", remote: true, evidence: "device-readback" },
  { id: 11019, section: "Green driving parameters", type: "Uint8", defaultValue: "0", min: "0", max: "1", name: "Advanced eco driving", options: ["0 – Disable", "1 – Enable"], level: "standard", model: "fmb920", remote: true, evidence: "device-readback" },
];

const parameters = [...published, ...fmb920ObdParameters(), ...deviceReadback.filter((parameter) => !published.some((item) => item.id === parameter.id))];
const byId = new Map(parameters.map((parameter) => [parameter.id, parameter]));

export const FMB920_CATALOG_SOURCE = catalog.source;

/**
 * These sections are published on the shared FMB920 list and stay in the catalog.
 * FMB920 has no RS232/RS485 port and no LV-CAN or ALL-CAN accessory, so a device read does not request them.
 */
const READ_EXCLUDED_SECTIONS = new Set(["RS232/RS485", "LVCAN"]);

export function fmb920Parameters() {
  return parameters;
}

export function fmb920ReadParameterIds() {
  return parameters.filter((parameter) => !READ_EXCLUDED_SECTIONS.has(parameter.section)).map((parameter) => parameter.id);
}

export function parameterById(id: number) {
  return byId.get(id) ?? null;
}

export function parameterCounts() {
  const counts = new Map<string, number>();
  for (const parameter of parameters) counts.set(parameter.section, (counts.get(parameter.section) ?? 0) + 1);
  return {
    total: parameters.length,
    critical: parameters.filter((parameter) => parameter.level === "critical").length,
    standard: parameters.filter((parameter) => parameter.level === "standard").length,
    sections: [...counts.entries()].map(([section, count]) => ({ section, count })),
  };
}

/** Configurator headings whose parameter IDs are not in the published FMB920 list. */
export const unsupportedConfiguratorSections = [
  {
    id: "sms-events",
    reason: "SMS event numbers and texts are not a separate remote ID table. Scenario SMS fields that do exist stay critical and out of automatic distribution.",
  },
  {
    id: "obd-native",
    reason: "FMB920 has no built-in OBD II. Only the published Bluetooth OBD parameter IDs are listed.",
  },
] as const;

export const configuratorSectionGroups = [
  { id: "security", sections: [] },
  { id: "system", sections: ["System parameters"] },
  { id: "gprs", sections: ["GPRS parameters"] },
  { id: "acquisition", sections: [
    "Home Network GSM operator code \"Vehicle on STOP\" parameters",
    "Home Network GSM operator code \"Vehicle MOVING\" parameters",
    "Roaming Network GSM operator code \"Vehicle on STOP\" parameters",
    "Roaming Network GSM operator code \"Vehicle MOVING\" parameters",
    "Unknown Network GSM operator code \"Vehicle on STOP\" parameters",
    "Unknown Network GSM operator code \"Vehicle MOVING\" parameters",
    "Tracking on Demand",
  ] },
  { id: "sms", sections: ["SMS/Call settings"] },
  { id: "operators", sections: ["GSM operators"] },
  { id: "features", sections: [
    "Green driving parameters",
    "Overspeeding scenario parameters",
    "Jamming scenario parameters",
    "Immobilizer scenario parameters",
    "DOUT control via call scenario parameters",
    "DOUT 1 Output type",
    "iButton read notification",
  ] },
  { id: "accelerometer", sections: [
    "Unplug Detection",
    "Towing Detection",
    "Crash Detection",
    "Excessive Idling",
    "Motorcycle Fall Detection",
  ] },
  { id: "autogeofence", sections: ["AutoGeofencing scenario parameters"] },
  { id: "geofence", sections: ["Manual Geofence"] },
  { id: "trip", sections: [
    "Trip scenario parameters",
    "Advanced trip scenario parameters",
    "Odometer parameters",
    "Private/Business mode scenario parameters",
    "Weekly Schedule parameters",
    "Daylight saving scenario parameters",
    "Weekly schedule scenario parameters",
  ] },
  { id: "bluetooth", sections: ["Bluetooth"] },
  { id: "bluetooth4", sections: [
    "Common Settings",
    "BLE functionalities Connection #1",
    "BLE functionalities Connection #2",
    "BLE functionalities Connection #3",
    "BLE functionalities Connection #4",
  ] },
  { id: "beacons", sections: ["Beacon List Parameters"] },
  { id: "io", sections: ["I/O parameters"] },
  { id: "obd", sections: ["OBD II (Bluetooth)"] },
] as const;

/**
 * Values read back from the devices on 15 Nov 2026 after the approved write.
 * Advanced eco driving is 0. Output 11003 is recorded and stays critical.
 */
export const VERIFIED_GREEN_DRIVING = {
  "11000": "1",
  "11003": "0",
  "11004": "2.31",
  "11005": "2.52",
  "11006": "2.94",
  "11007": "1",
  "11008": "1",
  "11011": "0",
  "11015": "0",
  "11019": "0",
} as const;
