import { useEffect, useState } from "react";

export const BOOKING_DESKTOP_QUERY = "(min-width: 768px)";
export const BOOKING_WIDE_QUERY = "(min-width: 900px)";
export const DATETIME_DESKTOP_QUERY =
  "(min-width: 768px) and (hover: hover) and (pointer: fine)";

export function useMediaQuery(query: string) {
  const [matches, setMatches] = useState(false);

  useEffect(() => {
    const media = window.matchMedia(query);

    function onChange() {
      setMatches(media.matches);
    }

    onChange();
    media.addEventListener("change", onChange);
    return () => media.removeEventListener("change", onChange);
  }, [query]);

  return matches;
}
