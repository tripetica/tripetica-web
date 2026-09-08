import "server-only";

export async function verifyRecaptchaToken(token: string) {
  const secret = process.env.RECAPTCHA_SECRET_KEY?.trim();
  if (!secret) {
    return false;
  }
  const trimmed = token.trim();
  if (!trimmed) {
    return false;
  }
  const response = await fetch("https://www.google.com/recaptcha/api/siteverify", {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({ secret, response: trimmed }),
  });
  if (!response.ok) {
    return false;
  }
  const payload = (await response.json()) as { success?: boolean };
  return payload.success === true;
}
