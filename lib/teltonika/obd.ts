/**
 * FMB920 parameter list, OBD II (Bluetooth).
 * The first group is fully specified. Later groups use that same layout.
 * A dash in the published table means that field does not exist.
 */
const PRIORITY = ["0 – Disabled", "1 – Low", "2 – High", "3 – Panic"];
const OPERAND = [
  "0 - On range exit",
  "1 - On range entrance",
  "2 - On both",
  "3 - Monitoring",
  "4 - Hysteresis",
  "5 - On change",
  "6 - On delta change",
];
const EVENT = ["0 - Disable", "1 - Enable"];

type ObdGroup = {
  name: string;
  priority: number;
  low: number | null;
  high: number | null;
  event: number;
  operand: number;
  sms: number | null;
  text: number | null;
};

const GROUPS: readonly ObdGroup[] = [
  { name: "Number Of DTC", priority: 40100, low: 40103, high: 40102, event: 40104, operand: 40101, sms: 7038, text: 8038 },
  { name: "Engine Load", priority: 40110, low: 40113, high: 40112, event: 40114, operand: 40111, sms: 7039, text: 8039 },
  { name: "Coolant Temperature", priority: 40120, low: 40123, high: 40122, event: 40124, operand: 40121, sms: 7040, text: 8040 },
  { name: "Short Fuel Trim", priority: 40130, low: 40133, high: 40132, event: 40134, operand: 40131, sms: 7041, text: 8041 },
  { name: "Fuel Pressure", priority: 40140, low: 40143, high: 40142, event: 40144, operand: 40141, sms: 7042, text: 8042 },
  { name: "Intake Map", priority: 40150, low: 40153, high: 40152, event: 40154, operand: 40151, sms: 7043, text: 8043 },
  { name: "Engine RPM", priority: 40160, low: 40163, high: 40162, event: 40164, operand: 40161, sms: 7044, text: 8044 },
  { name: "Vehicle speed", priority: 40170, low: 40173, high: 40172, event: 40174, operand: 40171, sms: 7045, text: 8045 },
  { name: "Timing advance", priority: 40180, low: 40183, high: 40182, event: 40184, operand: 40181, sms: 7046, text: 8046 },
  { name: "Intake air temperature", priority: 40190, low: 40193, high: 40192, event: 40194, operand: 40191, sms: 7047, text: 8047 },
  { name: "MAF", priority: 40200, low: 40203, high: 40202, event: 40204, operand: 40201, sms: 7048, text: 8048 },
  { name: "Throttle position", priority: 40210, low: 40213, high: 40212, event: 40214, operand: 40211, sms: 7049, text: 8049 },
  { name: "Run time since engine start", priority: 40220, low: 40223, high: 40222, event: 40224, operand: 40221, sms: 7050, text: 8050 },
  { name: "Distance traveled MIL on", priority: 40230, low: 40233, high: 40232, event: 40234, operand: 40231, sms: 7051, text: 8051 },
  { name: "Relative fuel rail pressure", priority: 40240, low: 40243, high: 40242, event: 40244, operand: 40241, sms: 7052, text: 8052 },
  { name: "Direct fuel rail pressure", priority: 40250, low: 40253, high: 40252, event: 40254, operand: 40251, sms: 7053, text: 8053 },
  { name: "Commanded EGR", priority: 40260, low: 40263, high: 40262, event: 40264, operand: 40261, sms: 7054, text: 8054 },
  { name: "EGR error", priority: 40270, low: 40273, high: 40272, event: 40274, operand: 40271, sms: 7055, text: 8055 },
  { name: "Fuel level", priority: 40280, low: 40283, high: 40282, event: 40284, operand: 40281, sms: 7056, text: 8056 },
  { name: "Distance traveled since codes clear", priority: 40290, low: 40293, high: 40292, event: 40294, operand: 40291, sms: 7057, text: 8057 },
  { name: "Barometric pressure", priority: 40300, low: 40303, high: 40302, event: 40304, operand: 40301, sms: 7058, text: 8058 },
  { name: "Control module voltage", priority: 40310, low: 40313, high: 40312, event: 40314, operand: 40311, sms: 7059, text: 8059 },
  { name: "Absolute load value", priority: 40320, low: 40323, high: 40322, event: 40324, operand: 40321, sms: 7060, text: 8060 },
  { name: "Ambient air temperature", priority: 40330, low: 40333, high: 40332, event: 40334, operand: 40331, sms: 7061, text: 8061 },
  { name: "Time run with MIL on", priority: 40340, low: 40343, high: 40342, event: 40344, operand: 40341, sms: 7062, text: 8062 },
  { name: "Time since trouble codes cleared", priority: 40350, low: 40353, high: 40352, event: 40354, operand: 40351, sms: 7063, text: 8063 },
  { name: "Fuel Type", priority: 40560, low: 40563, high: 40562, event: 40564, operand: 40561, sms: 7633, text: 8633 },
  { name: "Absolute fuel rail pressure", priority: 40360, low: 40363, high: 40362, event: 40364, operand: 40361, sms: 7064, text: 8064 },
  { name: "Hybrid battery pack remaining life", priority: 40370, low: 40373, high: 40372, event: 40374, operand: 40371, sms: 7065, text: 8065 },
  { name: "Engine oil temperature", priority: 40380, low: 40383, high: 40382, event: 40384, operand: 40381, sms: 7066, text: 8066 },
  { name: "Fuel injection timing", priority: 40390, low: 40393, high: 40392, event: 40394, operand: 40391, sms: 7067, text: 8067 },
  { name: "Fuel Rate", priority: 40400, low: 40403, high: 40402, event: 40404, operand: 40401, sms: 7068, text: 8068 },
  { name: "Command Equivalence Ratio", priority: 40460, low: 40463, high: 40462, event: 40464, operand: 40461, sms: 7524, text: 8524 },
  { name: "Intake MAP (2 Bytes)", priority: 40470, low: 40473, high: 40472, event: 40474, operand: 40471, sms: 7525, text: 8525 },
  { name: "Hybrid Vehicle System Voltage", priority: 40480, low: 40483, high: 40482, event: 40484, operand: 40481, sms: 7526, text: 8526 },
  { name: "Hybrid Vehicle System Current", priority: 40490, low: 40493, high: 40492, event: 40494, operand: 40491, sms: 7527, text: 8527 },
  { name: "Fault Codes", priority: 40420, low: null, high: null, event: 40424, operand: 40421, sms: 7264, text: 8264 },
  { name: "VIN", priority: 40410, low: null, high: null, event: 40414, operand: 40411, sms: 7241, text: 8241 },
  { name: "OEM Total Mileage", priority: 40430, low: 40433, high: 40432, event: 40434, operand: 40431, sms: 7522, text: 8522 },
  { name: "OEM Fuel Level", priority: 40440, low: 40443, high: 40442, event: 40444, operand: 40441, sms: 7529, text: 8529 },
  { name: "OEM Remaining Distance", priority: 40520, low: 40523, high: 40522, event: 40524, operand: 40521, sms: 7628, text: 8628 },
  { name: "OEM Distance Until Service", priority: 40510, low: 40513, high: 40512, event: 40514, operand: 40511, sms: null, text: null },
  { name: "OEM Battery Charge State", priority: 40570, low: 40573, high: 40572, event: 40574, operand: 40571, sms: 7634, text: 8634 },
  { name: "OEM Battery Charge Level", priority: 40580, low: 40583, high: 40582, event: 40584, operand: 40581, sms: 7635, text: 8635 },
  { name: "OEM Battery State of Health", priority: 40600, low: 40603, high: 40602, event: 40604, operand: 40601, sms: null, text: null },
];

function field(id: number, name: string, type: string, defaultValue: string, min: string, max: string, options: string[]) {
  return {
    id,
    section: "OBD II (Bluetooth)",
    type,
    defaultValue,
    min,
    max,
    name,
    options,
    level: "operational" as const,
    model: "fmb920" as const,
    remote: true as const,
    evidence: "published-list" as const,
  };
}

export function fmb920ObdParameters() {
  const parameters: ReturnType<typeof field>[] = [];
  for (const group of GROUPS) {
    parameters.push(field(group.priority, `${group.name} — Priority`, "Uint8", "0", "0", "3", PRIORITY));
    if (group.low !== null) parameters.push(field(group.low, `${group.name} — Low level`, "Uint8", "0", "0", "255", ["Low value"]));
    if (group.high !== null) parameters.push(field(group.high, `${group.name} — High level`, "Uint8", "0", "0", "255", ["High value"]));
    parameters.push(field(group.event, `${group.name} — Event only`, "Uint8", "0", "0", "1", EVENT));
    parameters.push(field(group.operand, `${group.name} — Operand`, "Uint8", "3", "0", "6", OPERAND));
    if (group.sms !== null) parameters.push(field(group.sms, `${group.name} — Send SMS to`, "Uint8", "0", "0", "10", ["Phone number"]));
    if (group.text !== null) parameters.push(field(group.text, `${group.name} — SMS text`, "String", `"${group.name}"`, "0", "160", ["Text"]));
  }
  return parameters;
}

export const FMB920_OBD_GROUP_COUNT = GROUPS.length;
