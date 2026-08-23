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
      "bosphorus-dinner": "Круиз по Босфору с ужином и турецким шоу",
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
      "bosphorus-dinner": "Bosphorus Dinner Cruise & Turkish Night Show",
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
  tr: {
    slogan: "Kaliteli hizmet. Adil fiyat.",
    services: {
      transfer: "Özel Transfer & Taksi",
      hourly: "Saatlik Şoförlü Araç",
      tour: "Turlar & Rotalar",
    },
    servicesGroupLabel: "Hizmet türü",
    pickupLabel: "Alış noktası",
    pickupPlaceholder: "Alış noktasını girin",
    dropoffLabel: "Varış noktası",
    dropoffPlaceholder: "Varış noktasını girin",
    datetimeLabel: "Tarih ve saat",
    datetimePlaceholder: "Tarih ve saat seçin",
    durationLabel: "Süre",
    durationPlaceholder: "Süre seçin",
    hoursSuffix: "saat",
    tourLabel: "Tur seçin",
    tourPlaceholder: "Tur seçin",
    tours: {
      "istanbul-layover": "İstanbul Aktarma Turu",
      "istanbul-half-day": "İstanbul Yarım Gün Turu (6 saat)",
      "istanbul-full-day": "İstanbul Tam Gün Turu (10 saat)",
      sapanca: "Sapanca Turu",
      bursa: "Bursa Turu",
      "bosphorus-dinner": "Boğaz’da Yemekli Gemi Turu & Türk Gecesi",
      cappadocia: "Kapadokya Turu",
      pamukkale: "Pamukkale Turu",
      ephesus: "Efes Turu",
      gobeklitepe: "Göbeklitepe Turu",
      custom: "Özel Tur ve Rota",
    },
    ctaContinue: "Seçenekleri Gör",
    ctaViewTour: "Turu İncele",
    trust: [
      "Sabit fiyat",
      "Gizli ücret yok",
      "Nakit ödeme",
      "Ücretsiz iptal",
      "7/24 destek",
    ],
    clearLocation: "Temizle",
    airportsLabel: "Havalimanları",
    airports: {
      IST: "İstanbul Havalimanı (IST)",
      SAW: "Sabiha Gökçen Havalimanı (SAW)",
      AYT: "Antalya Havalimanı (AYT)",
    },
    noPlaceResults: "Eşleşen konum bulunamadı",
    placesError:
      "Konum araması şu anda kullanılamıyor. Google Places ayarlarını kontrol edin.",
    suggestionsLabel: "Öneriler",
    selectPickup: "Alış noktasını seçin",
    selectDropoff: "Varış noktasını seçin",
    closeSelector: "Geri",
    selectDuration: "Süre seçin",
    datetimeApply: "Uygula",
    datetimeHour: "Saat",
    datetimeMinute: "Dakika",
    datetimeTooSoon: "Lütfen İstanbul saatine göre en az 1 saat sonrası için bir zaman seçin",
    swapLocations: "Alış ve varış noktalarını değiştir",
  },
};
