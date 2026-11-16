const KEYWORD = /^[A-Za-z0-9]{4,10}$/;

/** Letters and numbers, 4–10. Teltonika setkey / delkey. */
export function keywordTextAllowed(value: string) {
  return KEYWORD.test(value);
}

/** Create uses two spaces after setkey. Change and delete include the current keyword. */
export function keywordCommand(action: "set" | "remove", current: string, next: string) {
  if (action === "remove") {
    return keywordTextAllowed(current) ? `delkey ${current}` : null;
  }
  if (!keywordTextAllowed(next)) return null;
  if (current === "") return `setkey  ${next}`;
  if (!keywordTextAllowed(current) || current === next) return null;
  return `setkey ${current} ${next}`;
}

export function keywordCommandAllowed(text: string) {
  return /^setkey  [A-Za-z0-9]{4,10}$/.test(text)
    || /^setkey [A-Za-z0-9]{4,10} [A-Za-z0-9]{4,10}$/.test(text)
    || /^delkey [A-Za-z0-9]{4,10}$/.test(text);
}

/** Classifies the documented reply. The keyword text is not returned. */
export function classifyKeywordReply(text: string): { phase: "accepted" | "failed" | "unverified"; error: string | null } {
  const reply = text.trim();
  if (/^Keyword saved:/i.test(reply)) return { phase: "accepted", error: null };
  if (/^Keyword removed$/i.test(reply)) return { phase: "accepted", error: null };
  if (/Error:\s*Locked/i.test(reply)) return { phase: "failed", error: "locked" };
  if (/Wrong old keyword/i.test(reply)) return { phase: "failed", error: "wrong_old" };
  if (/Wrong keyword format/i.test(reply)) return { phase: "failed", error: "format" };
  if (/Bad Syntax/i.test(reply)) return { phase: "failed", error: "syntax" };
  if (/Cannot save keyword|Keyword deletion failure/i.test(reply)) return { phase: "failed", error: "rejected" };
  return { phase: "unverified", error: "unexpected" };
}
