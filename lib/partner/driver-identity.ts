export function normalizeDriverNationalId(value: string) {
  return value.replace(/\D/g, "");
}

export function isDriverNationalIdValid(value: string) {
  return /^\d{11}$/.test(normalizeDriverNationalId(value));
}
