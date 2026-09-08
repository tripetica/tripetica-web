export function normalizeAccountEmail(value: string) {
  return value.trim().toLowerCase();
}

export function isValidEmailShape(email: string) {
  if (email.length < 3 || email.length > 254) {
    return false;
  }
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
}
