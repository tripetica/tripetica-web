import { type Locale } from "@/lib/i18n/config";
import { type ServiceType, type TourId } from "./types";

export type BookingCopy = {
  slogan: string;
  services: Record<ServiceType, string>;
  servicesGroupLabel: string;
  pickupLabel: string;
  pickupPlaceholder: string;
  dropoffLabel: string;
  dropoffPlaceholder: string;
  datetimeLabel: string;
  datetimePlaceholder: string;
  durationLabel: string;
  durationPlaceholder: string;
  hoursSuffix: string;
  tourLabel: string;
  tourPlaceholder: string;
  tours: Record<TourId, string>;
  ctaContinue: string;
  ctaViewTour: string;
  trust: string[];
  clearLocation: string;
  airportsLabel: string;
  airports: Record<"IST" | "SAW" | "AYT", string>;
  noPlaceResults: string;
  placesError: string;
  suggestionsLabel: string;
  selectPickup: string;
  selectDropoff: string;
  closeSelector: string;
  selectDuration: string;
  datetimeApply: string;
  datetimeHour: string;
  datetimeMinute: string;
  datetimeTooSoon: string;
  swapLocations: string;
};

export const bookingCopy: Record<Locale, BookingCopy> = {
  ru: {
    slogan: "Качественный сервис. Доступная цена.",
    services: {
      transfer: "Частный трансфер & Такси",
      hourly: "Почасовой автомобиль с водителем",
      tour: "Туры & Маршруты",
    },
    servicesGroupLabel: "Тип услуги",
    pickupLabel: "Место подачи",
    pickupPlaceholder: "Введите место подачи",
    dropoffLabel: "Место назначения",
    dropoffPlaceholder: "Введите место назначения",
    datetimeLabel: "Дата и время",
    datetimePlaceholder: "Выберите дату и время",
    durationLabel: "Продолжительность",
    durationPlaceholder: "Выберите продолжительность",
    hoursSuffix: "часов",
    tourLabel: "Выберите тур",
    tourPlaceholder: "Выберите тур",
    tours: {
      "istanbul-layover": "Тур при пересадке в Стамбуле",
      "istanbul-half-day": "Полудневный тур по Стамбулу (6 часов)",
      "istanbul-full-day": "Полный день в Стамбуле (10 часов)",
      sapanca: "Тур в Сапанджу",
      bursa: "Тур в Бурсу",
      "bosphorus-dinner": "Вечерний круиз по Босфору с ужином и развлечениями",
      cappadocia: "Тур в Каппадокию",
      pamukkale: "Тур в Памуккале",
      ephesus: "Тур в Эфес",
      gobeklitepe: "Тур в Гёбеклитепе",
      custom: "Индивидуальный тур и маршрут",
    },
    ctaContinue: "Посмотреть варианты",
    ctaViewTour: "Подробнее о туре",
    trust: [
      "Фиксированная цена",
      "Без скрытых платежей",
      "Оплата наличными",
      "Бесплатная отмена",
      "Поддержка 24/7",
    ],
    clearLocation: "Очистить",
    airportsLabel: "Аэропорты",
    airports: {
      IST: "Аэропорт Стамбул (IST)",
      SAW: "Аэропорт Сабиха Гёкчен (SAW)",
      AYT: "Аэропорт Анталья (AYT)",
    },
    noPlaceResults: "Ничего не найдено",
    placesError: "Поиск мест недоступен. Проверьте настройки Google Places.",
    suggestionsLabel: "Подсказки",
    selectPickup: "Выберите место подачи",
    selectDropoff: "Выберите место назначения",
    closeSelector: "Назад",
    selectDuration: "Выберите продолжительность",
    datetimeApply: "Применить",
    datetimeHour: "Час",
    datetimeMinute: "Минута",
    datetimeTooSoon: "Выберите время не ранее чем через 1 час по Стамбулу",
    swapLocations: "Поменять места подачи и назначения",
  },
  en: {
    slogan: "Quality Service. Fair Price.",
    services: {
      transfer: "Private Transfer & Taxi",
      hourly: "Hourly Chauffeur Service",
      tour: "Tours & Routes",
    },
    servicesGroupLabel: "Service type",
    pickupLabel: "Pickup location",
    pickupPlaceholder: "Enter pickup location",
    dropoffLabel: "Drop-off location",
    dropoffPlaceholder: "Enter drop-off location",
    datetimeLabel: "Date & time",
    datetimePlaceholder: "Select date and time",
    durationLabel: "Duration",
    durationPlaceholder: "Select duration",
    hoursSuffix: "hours",
    tourLabel: "Select tour",
    tourPlaceholder: "Select tour",
    tours: {
      "istanbul-layover": "Istanbul Layover Tour",
      "istanbul-half-day": "Istanbul Half-Day Tour (6 Hours)",
      "istanbul-full-day": "Istanbul Full-Day Tour (10 Hours)",
      sapanca: "Sapanca Tour",
      bursa: "Bursa Tour",
      "bosphorus-dinner": "Bosphorus Dinner & Entertainment Tour",
      cappadocia: "Cappadocia Tour",
      pamukkale: "Pamukkale Tour",
      ephesus: "Ephesus Tour",
      gobeklitepe: "Göbeklitepe Tour",
      custom: "Custom Tour & Route",
    },
    ctaContinue: "View Options",
    ctaViewTour: "View Tour",
    trust: [
      "Fixed price",
      "No hidden fees",
      "Cash payment",
      "Free cancellation",
      "24/7 support",
    ],
    clearLocation: "Clear",
    airportsLabel: "Airports",
    airports: {
      IST: "Istanbul Airport (IST)",
      SAW: "Sabiha Gokcen Airport (SAW)",
      AYT: "Antalya Airport (AYT)",
    },
    noPlaceResults: "No matching places",
    placesError: "Location search is unavailable. Check Google Places configuration.",
    suggestionsLabel: "Suggestions",
    selectPickup: "Select pickup location",
    selectDropoff: "Select drop-off location",
    closeSelector: "Back",
    selectDuration: "Select duration",
    datetimeApply: "Apply",
    datetimeHour: "Hour",
    datetimeMinute: "Minute",
    datetimeTooSoon: "Choose a time at least 1 hour from now in Istanbul",
    swapLocations: "Swap pickup and drop-off",
  },
};
