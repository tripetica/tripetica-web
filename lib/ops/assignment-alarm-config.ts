export const PRODUCTION_ASSIGNMENT_ALARM_EMAIL_TO = "operation@tripetica.com";

export function isProductionAssignmentAlarmEnvironment(
  nodeEnv: string | undefined = process.env.NODE_ENV,
  expectedDatabase: string | undefined = process.env.EXPECTED_DATABASE,
) {
  return nodeEnv === "production" && expectedDatabase === "tripetica";
}

export function assignmentAlarmEmailRecipient(
  env: Record<string, string | undefined> = process.env,
) {
  const override = env.ASSIGNMENT_ALARM_EMAIL_TO?.trim();
  if (override) {
    return override;
  }
  if (isProductionAssignmentAlarmEnvironment(env.NODE_ENV, env.EXPECTED_DATABASE)) {
    return PRODUCTION_ASSIGNMENT_ALARM_EMAIL_TO;
  }
  return null;
}

export function assignmentAlarmVoiceEnabled(
  env: Record<string, string | undefined> = process.env,
) {
  return env.ASSIGNMENT_ALARM_VOICE_ENABLED === "true";
}
