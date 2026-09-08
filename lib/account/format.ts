export function formatAccountHeaderName(firstName: string, lastName: string) {
  const first = firstName.trim();
  const lastInitial = lastName.trim().charAt(0);
  if (!first) {
    return lastInitial ? `${lastInitial.toLocaleUpperCase("tr-TR")}.` : "";
  }
  if (!lastInitial) {
    return first;
  }
  return `${first} ${lastInitial.toLocaleUpperCase("tr-TR")}.`;
}

/** Mobile authenticated control: first-name initial only. */
export function formatAccountHeaderInitial(firstName: string, lastName = "") {
  const first = firstName.trim();
  const source = first || lastName.trim();
  if (!source) {
    return "";
  }
  return source.charAt(0).toLocaleUpperCase("tr-TR");
}
