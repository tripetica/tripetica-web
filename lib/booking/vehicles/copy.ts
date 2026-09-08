import {
  BUSINESS_MINIVAN_CODE,
  BUS_CODE,
  FIRST_CLASS_MINIVAN_CODE,
  FIRST_CLASS_SEDAN_CODE,
  MIDIBUS_CODE,
  MINIBUS_CODE,
  STANDARD_MINIVAN_CODE,
} from "@/lib/booking/pricing/vehicle-quote";
import { type DisplayCurrency } from "@/lib/booking/pricing/format-eur";
import { type Locale } from "@/lib/i18n/config";

export type VehicleGalleryKey = "exterior" | "interior" | "luggage";

export const VEHICLE_GALLERY_ORDER: VehicleGalleryKey[] = [
  "exterior",
  "interior",
  "luggage",
];

export type VehicleCardCopy = {
  title: string;
  example: string;
  standardCapacityLabel: string;
  standardCapacity: string;
  maxCapacityLabel: string;
  maxCapacity: string;
  baseFee: string;
  bursaBridgeRoute: string;
  bursaUludagAscent: string;
  extraPassenger: string;
  extraLuggage: string;
  babySeat: string;
  meetAndGreet: string;
  total: string;
  currencyGroup: string;
  rateUnavailable: string;
  currencyNames: Record<DisplayCurrency, string>;
  select: string;
  selected: string;
  dropoffDistanceFee: string;
  selectBlockedDesktop: string;
  selectUnappliedDesktop: string;
  gallery: Record<VehicleGalleryKey, string>;
  alt: Record<VehicleGalleryKey, string>;
  closeGallery: string;
  previousImage: string;
  nextImage: string;
  includedServices?: string;
};

export const vehicleCardCopy: Record<Locale, VehicleCardCopy> = {
  tr: {
    title: "Premium Ekonomi Sedan",
    example: "Renault Clio veya benzeri",
    standardCapacityLabel: "Standart kapasite",
    standardCapacity: "2 yolcu + 2 valiz",
    maxCapacityLabel: "Maksimum kapasite",
    maxCapacity: "3 yolcu + 3 valiz",
    baseFee: "Temel hizmet ücreti",
    bursaBridgeRoute: "Köprü + otoyol tercihi",
    bursaUludagAscent: "Uludağ'a araçla çıkış",
    extraPassenger: "Ek yolcu ücreti",
    extraLuggage: "Ek bagaj ücreti",
    babySeat: "Bebek koltuğu ücreti",
    meetAndGreet: "Karşılama hizmeti ücreti",
    total: "Toplam ücret",
    currencyGroup: "Para birimi",
    rateUnavailable: "Kur geçici olarak kullanılamıyor",
    currencyNames: {
      USD: "ABD doları",
      EUR: "Euro",
      TRY: "Türk lirası",
      RUB: "Rus rublesi",
      GBP: "İngiliz sterlini",
    },
    select: "Seç ve Devam Et",
    selected: "Seçildi",
    dropoffDistanceFee: "Bırakma noktası ek ücreti",
    selectBlockedDesktop: "Lütfen sol taraftaki panelden seçimlerinizi yapınız.",
    selectUnappliedDesktop: "Lütfen sol taraftaki panelde yaptığınız değişiklikleri uygulayın.",
    gallery: {
      exterior: "Dış",
      interior: "İç",
      luggage: "Bagaj",
    },
    alt: {
      exterior: "Premium Ekonomi Sedan dış görünümü",
      interior: "Premium Ekonomi Sedan iç mekânı",
      luggage: "Premium Ekonomi Sedan bagaj alanı",
    },
    closeGallery: "Görseli kapat",
    previousImage: "Önceki görsel",
    nextImage: "Sonraki görsel",
  },
  en: {
    title: "Premium Economy Sedan",
    example: "Renault Clio or similar",
    standardCapacityLabel: "Standard capacity",
    standardCapacity: "2 passengers + 2 bags",
    maxCapacityLabel: "Maximum capacity",
    maxCapacity: "3 passengers + 3 bags",
    baseFee: "Base service fee",
    bursaBridgeRoute: "Bridge + motorway option",
    bursaUludagAscent: "Uludağ ascent by vehicle",
    extraPassenger: "Extra passenger fee",
    extraLuggage: "Extra luggage fee",
    babySeat: "Baby seat fee",
    meetAndGreet: "Meet and greet fee",
    total: "Total fare",
    currencyGroup: "Currency",
    rateUnavailable: "Rate temporarily unavailable",
    currencyNames: {
      USD: "US dollar",
      EUR: "Euro",
      TRY: "Turkish lira",
      RUB: "Russian ruble",
      GBP: "British pound",
    },
    select: "Select and Continue",
    selected: "Selected",
    dropoffDistanceFee: "Drop-off location surcharge",
    selectBlockedDesktop: "Please make your selections from the panel on the left.",
    selectUnappliedDesktop: "Please apply the changes in the panel on the left.",
    gallery: {
      exterior: "Exterior",
      interior: "Interior",
      luggage: "Luggage",
    },
    alt: {
      exterior: "Premium Economy Sedan exterior",
      interior: "Premium Economy Sedan interior",
      luggage: "Premium Economy Sedan luggage space",
    },
    closeGallery: "Close image",
    previousImage: "Previous image",
    nextImage: "Next image",
  },
  ru: {
    title: "Премиум эконом седан",
    example: "Renault Clio или аналог",
    standardCapacityLabel: "Стандартная вместимость",
    standardCapacity: "2 пассажира + 2 чемодана",
    maxCapacityLabel: "Максимальная вместимость",
    maxCapacity: "3 пассажира + 3 чемодана",
    baseFee: "Базовая стоимость услуги",
    bursaBridgeRoute: "Вариант с мостом и автомагистралью",
    bursaUludagAscent: "Подъём на Улудаг на автомобиле",
    extraPassenger: "Доплата за пассажира",
    extraLuggage: "Доплата за багаж",
    babySeat: "Доплата за детское кресло",
    meetAndGreet: "Доплата за встречу",
    total: "Итоговая стоимость",
    currencyGroup: "Валюта",
    rateUnavailable: "Курс временно недоступен",
    currencyNames: {
      USD: "Доллар США",
      EUR: "Евро",
      TRY: "Турецкая лира",
      RUB: "Российский рубль",
      GBP: "Фунт стерлингов",
    },
    select: "Выбрать и продолжить",
    selected: "Выбрано",
    dropoffDistanceFee: "Доплата за место высадки",
    selectBlockedDesktop: "Пожалуйста, сделайте выбор в панели слева.",
    selectUnappliedDesktop: "Пожалуйста, примените изменения в панели слева.",
    gallery: {
      exterior: "Снаружи",
      interior: "Салон",
      luggage: "Багаж",
    },
    alt: {
      exterior: "Внешний вид премиум эконом седана",
      interior: "Салон премиум эконом седана",
      luggage: "Багажное отделение премиум эконом седана",
    },
    closeGallery: "Закрыть изображение",
    previousImage: "Предыдущее изображение",
    nextImage: "Следующее изображение",
  },
};

export type VehicleIdentityCopy = Pick<
  VehicleCardCopy,
  "title" | "example" | "standardCapacity" | "maxCapacity" | "alt"
> & {
  gallery?: Partial<Record<VehicleGalleryKey, string>>;
  includedServices?: string;
};

const standardMinivanIdentity: Record<Locale, VehicleIdentityCopy> = {
  tr: {
    title: "Standart Minivan",
    example: "Volkswagen Caravelle veya benzeri",
    standardCapacity: "5 yolcu + 5 valiz",
    maxCapacity: "7 yolcu + 8 valiz",
    alt: {
      exterior: "Standart Minivan dış görünümü",
      interior: "Standart Minivan iç mekânı",
      luggage: "Standart Minivan bagaj alanı",
    },
  },
  en: {
    title: "Standard Minivan",
    example: "Volkswagen Caravelle or similar",
    standardCapacity: "5 passengers + 5 bags",
    maxCapacity: "7 passengers + 8 bags",
    alt: {
      exterior: "Standard Minivan exterior",
      interior: "Standard Minivan interior",
      luggage: "Standard Minivan luggage space",
    },
  },
  ru: {
    title: "Стандартный минивэн",
    example: "Volkswagen Caravelle или аналог",
    standardCapacity: "5 пассажиров + 5 чемоданов",
    maxCapacity: "7 пассажиров + 8 чемоданов",
    alt: {
      exterior: "Внешний вид стандартного минивэна",
      interior: "Салон стандартного минивэна",
      luggage: "Багажное отделение стандартного минивэна",
    },
  },
};

const businessMinivanIdentity: Record<Locale, VehicleIdentityCopy> = {
  tr: {
    title: "Business Minivan",
    example: "Mercedes-Benz Vito",
    standardCapacity: "4 yolcu + 4 valiz",
    maxCapacity: "6 yolcu + 6 valiz",
    alt: {
      exterior: "Business Minivan dış görünümü",
      interior: "Business Minivan iç mekânı",
      luggage: "Business Minivan bagaj alanı",
    },
  },
  en: {
    title: "Business Minivan",
    example: "Mercedes-Benz Vito",
    standardCapacity: "4 passengers + 4 bags",
    maxCapacity: "6 passengers + 6 bags",
    alt: {
      exterior: "Business Minivan exterior",
      interior: "Business Minivan interior",
      luggage: "Business Minivan luggage space",
    },
  },
  ru: {
    title: "Бизнес минивэн",
    example: "Mercedes-Benz Vito",
    standardCapacity: "4 пассажира + 4 чемодана",
    maxCapacity: "6 пассажиров + 6 чемоданов",
    alt: {
      exterior: "Внешний вид бизнес минивэна",
      interior: "Салон бизнес минивэна",
      luggage: "Багажное отделение бизнес минивэна",
    },
  },
};

const firstClassMinivanIdentity: Record<Locale, VehicleIdentityCopy> = {
  tr: {
    title: "First Class Minivan",
    example: "Ultra lüks VIP tasarımlı Mercedes Benz Vito",
    standardCapacity: "3 yolcu + 3 valiz",
    maxCapacity: "5 yolcu + 5 valiz",
    gallery: {
      luggage: "Salon",
    },
    includedServices: "Karşılama ve otopark hizmetleri dahildir.",
    alt: {
      exterior: "First Class Minivan dış görünümü",
      interior: "First Class Minivan iç mekânı",
      luggage: "First Class Minivan salon detayı",
    },
  },
  en: {
    title: "First Class Minivan",
    example: "Ultra-luxury VIP Mercedes-Benz Vito",
    standardCapacity: "3 passengers + 3 bags",
    maxCapacity: "5 passengers + 5 bags",
    gallery: {
      luggage: "Cabin",
    },
    includedServices: "Meet and greet and parking are included.",
    alt: {
      exterior: "First Class Minivan exterior",
      interior: "First Class Minivan interior",
      luggage: "First Class Minivan cabin",
    },
  },
  ru: {
    title: "First Class минивэн",
    example: "Mercedes-Benz Vito ультра-люкс VIP-дизайна",
    standardCapacity: "3 пассажира + 3 чемодана",
    maxCapacity: "5 пассажиров + 5 чемоданов",
    gallery: {
      luggage: "Салон",
    },
    includedServices: "Встреча и парковка включены.",
    alt: {
      exterior: "Внешний вид First Class минивэна",
      interior: "Салон First Class минивэна",
      luggage: "Детали салона First Class минивэна",
    },
  },
};

const firstClassSedanIdentity: Record<Locale, VehicleIdentityCopy> = {
  tr: {
    title: "First Class Sedan",
    example: "Mercedes-Benz S-Class veya benzeri",
    standardCapacity: "2 yolcu + 2 valiz",
    maxCapacity: "3 yolcu + 3 valiz",
    includedServices: "Karşılama ve otopark hizmetleri dahildir.",
    alt: {
      exterior: "First Class Sedan dış görünümü",
      interior: "First Class Sedan iç mekânı",
      luggage: "First Class Sedan bagaj alanı",
    },
  },
  en: {
    title: "First Class Sedan",
    example: "Mercedes-Benz S-Class or similar",
    standardCapacity: "2 passengers + 2 bags",
    maxCapacity: "3 passengers + 3 bags",
    includedServices: "Meet and greet and parking are included.",
    alt: {
      exterior: "First Class Sedan exterior",
      interior: "First Class Sedan interior",
      luggage: "First Class Sedan luggage space",
    },
  },
  ru: {
    title: "First Class седан",
    example: "Mercedes-Benz S-Class или аналог",
    standardCapacity: "2 пассажира + 2 чемодана",
    maxCapacity: "3 пассажира + 3 чемодана",
    includedServices: "Встреча и парковка включены.",
    alt: {
      exterior: "Внешний вид First Class седана",
      interior: "Салон First Class седана",
      luggage: "Багажное отделение First Class седана",
    },
  },
};

const minibusIdentity: Record<Locale, VehicleIdentityCopy> = {
  tr: {
    title: "Minibüs",
    example: "Mercedes-Benz Sprinter veya benzeri",
    standardCapacity: "9 yolcu + 9 valiz",
    maxCapacity: "18 yolcu + 19 valiz",
    alt: {
      exterior: "Minibüs dış görünümü",
      interior: "Minibüs iç mekânı",
      luggage: "Minibüs bagaj alanı",
    },
  },
  en: {
    title: "Minibus",
    example: "Mercedes-Benz Sprinter or similar",
    standardCapacity: "9 passengers + 9 bags",
    maxCapacity: "18 passengers + 19 bags",
    alt: {
      exterior: "Minibus exterior",
      interior: "Minibus interior",
      luggage: "Minibus luggage space",
    },
  },
  ru: {
    title: "Минибус",
    example: "Mercedes-Benz Sprinter или аналог",
    standardCapacity: "9 пассажиров + 9 чемоданов",
    maxCapacity: "18 пассажиров + 19 чемоданов",
    alt: {
      exterior: "Внешний вид минибуса",
      interior: "Салон минибуса",
      luggage: "Багажное отделение минибуса",
    },
  },
};

const midibusIdentity: Record<Locale, VehicleIdentityCopy> = {
  tr: {
    title: "Midibüs",
    example: "Isuzu Turkuaz veya benzeri",
    standardCapacity: "20 yolcu + 20 valiz",
    maxCapacity: "25 yolcu + 27 valiz",
    alt: {
      exterior: "Midibüs dış görünümü",
      interior: "Midibüs iç mekânı",
      luggage: "Midibüs bagaj alanı",
    },
  },
  en: {
    title: "Midibus",
    example: "Isuzu Turkuaz or similar",
    standardCapacity: "20 passengers + 20 bags",
    maxCapacity: "25 passengers + 27 bags",
    alt: {
      exterior: "Midibus exterior",
      interior: "Midibus interior",
      luggage: "Midibus luggage space",
    },
  },
  ru: {
    title: "Мидибус",
    example: "Isuzu Turkuaz или аналог",
    standardCapacity: "20 пассажиров + 20 чемоданов",
    maxCapacity: "25 пассажиров + 27 чемоданов",
    alt: {
      exterior: "Внешний вид мидибуса",
      interior: "Салон мидибуса",
      luggage: "Багажное отделение мидибуса",
    },
  },
};

const busIdentity: Record<Locale, VehicleIdentityCopy> = {
  tr: {
    title: "Otobüs",
    example: "Mercedes-Benz Tourismo veya benzeri",
    standardCapacity: "35 yolcu + 35 valiz",
    maxCapacity: "45 yolcu + 45 valiz",
    alt: {
      exterior: "Otobüs dış görünümü",
      interior: "Otobüs iç mekânı",
      luggage: "Otobüs bagaj alanı",
    },
  },
  en: {
    title: "Bus",
    example: "Mercedes-Benz Tourismo or similar",
    standardCapacity: "35 passengers + 35 bags",
    maxCapacity: "45 passengers + 45 bags",
    alt: {
      exterior: "Bus exterior",
      interior: "Bus interior",
      luggage: "Bus luggage space",
    },
  },
  ru: {
    title: "Автобус",
    example: "Mercedes-Benz Tourismo или аналог",
    standardCapacity: "35 пассажиров + 35 чемоданов",
    maxCapacity: "45 пассажиров + 45 чемоданов",
    alt: {
      exterior: "Внешний вид автобуса",
      interior: "Салон автобуса",
      luggage: "Багажное отделение автобуса",
    },
  },
};

export function vehicleCardCopyFor(
  vehicleCode: string,
  locale: Locale,
): VehicleCardCopy {
  const shared = vehicleCardCopy[locale];
  if (vehicleCode === BUS_CODE) {
    return { ...shared, ...busIdentity[locale], gallery: shared.gallery };
  }
  if (vehicleCode === MIDIBUS_CODE) {
    return { ...shared, ...midibusIdentity[locale], gallery: shared.gallery };
  }
  if (vehicleCode === MINIBUS_CODE) {
    return { ...shared, ...minibusIdentity[locale], gallery: shared.gallery };
  }
  if (vehicleCode === FIRST_CLASS_SEDAN_CODE) {
    return { ...shared, ...firstClassSedanIdentity[locale], gallery: shared.gallery };
  }
  if (vehicleCode === FIRST_CLASS_MINIVAN_CODE) {
    const identity = firstClassMinivanIdentity[locale];
    return {
      ...shared,
      ...identity,
      gallery: {
        exterior: shared.gallery.exterior,
        interior: shared.gallery.interior,
        luggage: identity.gallery?.luggage ?? shared.gallery.luggage,
      },
    };
  }
  if (vehicleCode === BUSINESS_MINIVAN_CODE) {
    return { ...shared, ...businessMinivanIdentity[locale], gallery: shared.gallery };
  }
  if (vehicleCode === STANDARD_MINIVAN_CODE) {
    return { ...shared, ...standardMinivanIdentity[locale], gallery: shared.gallery };
  }
  return shared;
}
