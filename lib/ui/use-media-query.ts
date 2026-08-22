import { useSyncExternalStore } from "react";

export const BOOKING_DESKTOP_QUERY = "(min-width: 768px)";
export const DATETIME_DESKTOP_QUERY =
  "(min-width: 768px) and (hover: hover) and (pointer: fine)";

export function useMediaQuery(query: string) {
  return useSyncExternalStore(
    (onChange) => {
      const media = window.matchMedia(query);
      media.addEventListener("change", onChange);
      return () => media.removeEventListener("change", onChange);
    },
    () => window.matchMedia(query).matches,
    () => false,
  );
}
