export const MIN_PASSWORD_LENGTH = 8;

export function isPasswordLengthValid(password: string) {
  return password.length >= MIN_PASSWORD_LENGTH;
}

export function passwordsMatch(password: string, confirmation: string) {
  return password.length > 0 && password === confirmation;
}
