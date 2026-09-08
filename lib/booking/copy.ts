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
  dateLabel: string;
  datePlaceholder: string;
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
  datetimeStaleTitle: string;
  datetimeStaleBody: string;
  datetimeStaleNearestLabel: string;
  datetimeStaleUseNearest: string;
  datetimeStalePickOther: string;
  persistError: string;
  swapLocations: string;
  hourlyDropoffFeeNote: string;
  transferSameLocationError: string;
  istanbulLocationRequired: string;
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
    dateLabel: "Дата",
    datePlaceholder: "Выберите дату",
    durationLabel: "Продолжительность",
    durationPlaceholder: "Выберите продолжительность",
    hoursSuffix: "часов",
    tourLabel: "Выберите тур",
    tourPlaceholder: "Выберите тур",
    tours: {
      "istanbul-layover": "Тур при пересадке в Стамбуле",
      "istanbul-half-day": "Полудневный тур по Стамбулу",
      "istanbul-full-day": "Полный день в Стамбуле",
      sapanca: "Тур в Сапанджу",
      bursa: "Тур в Бурсу",
      "bosphorus-dinner": "Круиз по Босфору с ужином и турецким шоу",
      "private-turkey-tours":
        "Каппадокия, Памуккале, Эфес, Гёбеклитепе и индивидуальные маршруты",
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
    datetimeStaleTitle: "Выбранные дата и время больше недоступны",
    datetimeStaleBody:
      "Из‑за операционного времени подготовки бронирование возможно минимум на 1 час позже текущего времени.",
    datetimeStaleNearestLabel: "Ближайшие доступные дата и время:",
    datetimeStaleUseNearest: "Использовать ближайшее время",
    datetimeStalePickOther: "Выбрать другую дату и время",
    persistError: "Не удалось сохранить выбор. Попробуйте ещё раз.",
    swapLocations: "Поменять места подачи и назначения",
    hourlyDropoffFeeNote:
      "При выборе другого места окончания поездки может взиматься дополнительная плата в зависимости от местоположения и расстояния.",
    transferSameLocationError:
      "Место посадки и место назначения не могут совпадать. Пожалуйста, измените одно из мест.",
    istanbulLocationRequired:
      "Пожалуйста, выберите адрес в пределах Стамбула.",
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
    dateLabel: "Date",
    datePlaceholder: "Select date",
    durationLabel: "Duration",
    durationPlaceholder: "Select duration",
    hoursSuffix: "hours",
    tourLabel: "Select tour",
    tourPlaceholder: "Select tour",
    tours: {
      "istanbul-layover": "Istanbul Layover Tour",
      "istanbul-half-day": "Istanbul Half-Day Tour",
      "istanbul-full-day": "Istanbul Full-Day Tour",
      sapanca: "Sapanca Tour",
      bursa: "Bursa Tour",
      "bosphorus-dinner": "Bosphorus Dinner Cruise & Turkish Night Show",
      "private-turkey-tours":
        "Cappadocia, Pamukkale, Ephesus, Göbeklitepe and Custom Routes",
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
    datetimeStaleTitle: "Your selected date and time is no longer available",
    datetimeStaleBody:
      "Due to operational preparation time, bookings can only be made at least 1 hour from now.",
    datetimeStaleNearestLabel: "Earliest available date and time:",
    datetimeStaleUseNearest: "Use nearest time",
    datetimeStalePickOther: "Choose a different date and time",
    persistError: "Could not save your selection. Please try again.",
    swapLocations: "Swap pickup and drop-off",
    hourlyDropoffFeeNote:
      "If a different drop-off location is selected, an additional charge may apply depending on the location and distance.",
    transferSameLocationError:
      "Pickup and drop-off locations cannot be the same. Please change one of the locations.",
    istanbulLocationRequired: "Please choose an address within Istanbul.",
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
    dateLabel: "Tarih",
    datePlaceholder: "Tarih seçin",
    durationLabel: "Süre",
    durationPlaceholder: "Süre seçin",
    hoursSuffix: "saat",
    tourLabel: "Tur seçin",
    tourPlaceholder: "Tur seçin",
    tours: {
      "istanbul-layover": "İstanbul Aktarma Turu",
      "istanbul-half-day": "İstanbul Yarım Gün Turu",
      "istanbul-full-day": "İstanbul Tam Gün Tur",
      sapanca: "Sapanca Turu",
      bursa: "Bursa Turu",
      "bosphorus-dinner": "Boğaz’da Yemekli Gemi Turu & Türk Gecesi",
      "private-turkey-tours":
        "Kapadokya, Pamukkale, Efes, Göbeklitepe ve Özel Rotalar",
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
    datetimeStaleTitle: "Seçtiğiniz tarih ve saat artık kullanılamıyor",
    datetimeStaleBody:
      "Operasyonel hazırlık süresi nedeniyle rezervasyonlar en az 1 saat sonrasına oluşturulabilir.",
    datetimeStaleNearestLabel: "Seçilebilecek en yakın tarih ve saat:",
    datetimeStaleUseNearest: "En yakın saati kullan",
    datetimeStalePickOther: "Farklı tarih ve saat seç",
    persistError: "Seçiminiz kaydedilemedi. Lütfen tekrar deneyin.",
    swapLocations: "Alış ve varış noktalarını değiştir",
    hourlyDropoffFeeNote:
      "Farklı bir bırakma noktası seçilmesi halinde, konum ve mesafeye bağlı olarak ek ücret uygulanabilir.",
    transferSameLocationError:
      "Alış ve bırakma noktaları aynı olamaz. Lütfen konumlardan birini değiştirin.",
    istanbulLocationRequired: "Lütfen İstanbul içinde bir adres seçin.",
  },
};
