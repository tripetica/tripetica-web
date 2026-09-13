/** Passenger-written checkout note stored on reservation_searches.notes / reservations.notes. */
export function passengerNoteText(value: unknown): string | null {
  if (typeof value !== "string") {
    return null;
  }
  const text = value.replace(/\r\n/g, "\n").trim();
  return text || null;
}
