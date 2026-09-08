function collapseSpaces(value: string) {
  return value.trim().replace(/\s+/g, " ");
}

export function joinPartnerContactName(
  firstName: string | null | undefined,
  lastName: string | null | undefined,
) {
  return [firstName, lastName]
    .map((part) => part?.trim())
    .filter(Boolean)
    .join(" ");
}

export function splitPartnerContactName(value: string) {
  const parts = collapseSpaces(value).split(" ").filter(Boolean);
  if (parts.length < 2) {
    return null;
  }
  return {
    contactFirstName: parts.slice(0, -1).join(" "),
    contactLastName: parts[parts.length - 1] ?? "",
  };
}

export function partnerContactNamesFromForm(formData: FormData) {
  const submitted = collapseSpaces(String(formData.get("contactName") ?? ""));
  const existingFirst = String(formData.get("contactFirstName") ?? "").trim();
  const existingLast = String(formData.get("contactLastName") ?? "").trim();
  const existingJoined = joinPartnerContactName(existingFirst, existingLast);

  if (submitted && existingJoined && submitted === existingJoined) {
    return {
      contactFirstName: existingFirst,
      contactLastName: existingLast,
    };
  }

  const split = splitPartnerContactName(submitted);
  if (split) {
    return split;
  }

  if (submitted) {
    return {
      contactFirstName: submitted,
      contactLastName: "",
    };
  }

  return {
    contactFirstName: existingFirst,
    contactLastName: existingLast,
  };
}
