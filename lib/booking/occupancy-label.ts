import { type Locale } from "@/lib/i18n/config";

export type OccupancyKind = "passenger" | "luggage" | "babySeat";

const TR_NOUN: Record<OccupancyKind, string> = {
  passenger: "Yolcu",
  luggage: "Valiz",
  babySeat: "Bebek Koltuğu",
};

const EN_NOUN: Record<OccupancyKind, { one: string; other: string }> = {
  passenger: { one: "Passenger", other: "Passengers" },
  luggage: { one: "Bag", other: "Bags" },
  babySeat: { one: "Baby seat", other: "Baby seats" },
};

const RU_NOUN: Record<OccupancyKind, { one: string; few: string; many: string }> = {
  passenger: {
    one: "пассажир",
    few: "пассажира",
    many: "пассажиров",
  },
  luggage: {
    one: "чемодан",
    few: "чемодана",
    many: "чемоданов",
  },
  babySeat: {
    one: "детское кресло",
    few: "детских кресла",
    many: "детских кресел",
  },
};

function russianPluralForm(count: number) {
  const mod10 = count % 10;
  const mod100 = count % 100;
  if (mod10 === 1 && mod100 !== 11) {
    return "one" as const;
  }
  if (mod10 >= 2 && mod10 <= 4 && (mod100 < 12 || mod100 > 14)) {
    return "few" as const;
  }
  return "many" as const;
}

export function occupancyOptionLabel(
  kind: OccupancyKind,
  count: number,
  locale: Locale,
) {
  if (locale === "tr") {
    return `${count} ${TR_NOUN[kind]}`;
  }
  if (locale === "en") {
    const noun = count === 1 ? EN_NOUN[kind].one : EN_NOUN[kind].other;
    return `${count} ${noun}`;
  }
  return `${count} ${RU_NOUN[kind][russianPluralForm(count)]}`;
}
