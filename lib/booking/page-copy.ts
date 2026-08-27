import { type Locale } from "@/lib/i18n/config";

export const bookingPageCopy: Record<
  Locale,
  {
    metaTitle: string;
    metaDescription: string;
    back: string;
    sidebarLabel: string;
    contentLabel: string;
    applySelections: string;
    applyingSelections: string;
    clearSelections: string;
    clearingSelections: string;
    estimatedDistance: string;
    distanceLoading: string;
    distanceError: string;
    applyError: string;
    editDateTime: string;
    editPickup: string;
    editDropoff: string;
    emptyDraft: string;
    passengerCount: string;
    luggageCount: string;
    babySeatCount: string;
    meetAndGreet: string;
    flightCode: string;
    flightCodePlaceholder: string;
    passengerRequired: string;
    routeTitle: string;
    routeMapError: string;
  }
> = {
  tr: {
    metaTitle: "Rezervasyon | Tripetica",
    metaDescription: "Tripetica rezervasyon.",
    back: "Geri",
    sidebarLabel: "Rezervasyon seçimleri",
    contentLabel: "Rezervasyon içeriği",
    applySelections: "Seçimleri Uygula",
    applyingSelections: "Uygulanıyor…",
    clearSelections: "Seçimleri Temizle",
    clearingSelections: "Temizleniyor…",
    estimatedDistance: "Tahmini mesafe",
    distanceLoading: "Mesafe hesaplanıyor…",
    distanceError: "Mesafe hesaplanamadı. Konumları kontrol edip tekrar deneyin.",
    applyError: "Seçimler uygulanamadı. Lütfen tekrar deneyin.",
    editDateTime: "Tarih ve saati düzenle",
    editPickup: "Alış noktasını düzenle",
    editDropoff: "Bırakma noktasını düzenle",
    emptyDraft: "Aktif bir transfer araması yok. Ana sayfadan seçenekleri görüntüleyin.",
    passengerCount: "Yolcu sayısı",
    luggageCount: "Valiz sayısı",
    babySeatCount: "Bebek koltuğu",
    meetAndGreet: "Karşılama hizmeti",
    flightCode: "Uçuş kodu",
    flightCodePlaceholder: "TK123, PC123",
    passengerRequired: "Lütfen yolcu sayısını seçin.",
    routeTitle: "Güzergâh",
    routeMapError: "Harita yüklenemedi.",
  },
  en: {
    metaTitle: "Booking | Tripetica",
    metaDescription: "Tripetica booking.",
    back: "Back",
    sidebarLabel: "Booking selections",
    contentLabel: "Booking content",
    applySelections: "Apply selections",
    applyingSelections: "Applying…",
    clearSelections: "Clear selections",
    clearingSelections: "Clearing…",
    estimatedDistance: "Estimated distance",
    distanceLoading: "Calculating distance…",
    distanceError: "Could not calculate distance. Check the locations and try again.",
    applyError: "Could not apply selections. Please try again.",
    editDateTime: "Edit date and time",
    editPickup: "Edit pickup location",
    editDropoff: "Edit drop-off location",
    emptyDraft: "No active transfer search. View options from the homepage.",
    passengerCount: "Passenger count",
    luggageCount: "Luggage count",
    babySeatCount: "Baby seat",
    meetAndGreet: "Meet and greet",
    flightCode: "Flight number",
    flightCodePlaceholder: "TK123, PC123",
    passengerRequired: "Please select the number of passengers.",
    routeTitle: "Route",
    routeMapError: "The map could not be loaded.",
  },
  ru: {
    metaTitle: "Бронирование | Tripetica",
    metaDescription: "Бронирование Tripetica.",
    back: "Назад",
    sidebarLabel: "Параметры бронирования",
    contentLabel: "Содержание бронирования",
    applySelections: "Применить выбор",
    applyingSelections: "Применение…",
    clearSelections: "Очистить выбор",
    clearingSelections: "Очистка…",
    estimatedDistance: "Примерное расстояние",
    distanceLoading: "Расчёт расстояния…",
    distanceError: "Не удалось рассчитать расстояние. Проверьте адреса и попробуйте снова.",
    applyError: "Не удалось применить выбор. Попробуйте ещё раз.",
    editDateTime: "Изменить дату и время",
    editPickup: "Изменить место подачи",
    editDropoff: "Изменить место назначения",
    emptyDraft: "Нет активного поиска трансфера. Выберите варианты на главной странице.",
    passengerCount: "Количество пассажиров",
    luggageCount: "Количество багажа",
    babySeatCount: "Детское кресло",
    meetAndGreet: "Встреча в аэропорту",
    flightCode: "Номер рейса",
    flightCodePlaceholder: "TK123, PC123",
    passengerRequired: "Пожалуйста, выберите количество пассажиров.",
    routeTitle: "Маршрут",
    routeMapError: "Не удалось загрузить карту.",
  },
};
