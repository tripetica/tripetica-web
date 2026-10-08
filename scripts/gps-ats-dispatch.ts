import { assertAtsWorkerWithheld } from "../lib/gps/ats-worker-guard";

assertAtsWorkerWithheld(process.env);

console.log("ATS dispatch withheld: ministry HTTP is disabled and the official send interval is unverified");
