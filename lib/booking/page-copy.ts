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
    pickupDropoffDistance: string;
    applyError: string;
    packageCoverage: string;
    tourLabel: string;
    editDateTime: string;
    editPickup: string;
    editDropoff: string;
    editDuration: string;
    editTour: string;
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
    pickupDropoffDistance: "Alış–bırakma mesafesi",
    applyError: "Seçimler uygulanamadı. Lütfen tekrar deneyin.",
    packageCoverage: "Paket kapsamı",
    tourLabel: "Tur",
    editDateTime: "Tarih ve saati düzenle",
    editPickup: "Alış noktasını düzenle",
    editDropoff: "Bırakma noktasını düzenle",
    editDuration: "Süreyi düzenle",
    editTour: "Turu düzenle",
    emptyDraft: "Aktif bir rezervasyon araması yok. Ana sayfadan seçenekleri görüntüleyin.",
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
    pickupDropoffDistance: "Pickup–drop-off distance",
    applyError: "Could not apply selections. Please try again.",
    packageCoverage: "Package coverage",
    tourLabel: "Tour",
    editDateTime: "Edit date and time",
    editPickup: "Edit pickup location",
    editDropoff: "Edit drop-off location",
    editDuration: "Edit duration",
    editTour: "Edit tour",
    emptyDraft: "No active booking search. View options from the homepage.",
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
    pickupDropoffDistance: "Расстояние от подачи до высадки",
    applyError: "Не удалось применить выбор. Попробуйте ещё раз.",
    packageCoverage: "Пакет включает",
    tourLabel: "Тур",
    editDateTime: "Изменить дату и время",
    editPickup: "Изменить место подачи",
    editDropoff: "Изменить место назначения",
    editDuration: "Изменить продолжительность",
    editTour: "Изменить тур",
    emptyDraft: "Нет активного поиска бронирования. Выберите варианты на главной странице.",
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
  ar: {
    metaTitle: "الحجز | Tripetica",
    metaDescription: "حجز Tripetica.",
    back: "رجوع",
    sidebarLabel: "اختيارات الحجز",
    contentLabel: "محتوى الحجز",
    applySelections: "تطبيق الاختيارات",
    applyingSelections: "جارٍ التطبيق…",
    clearSelections: "مسح الاختيارات",
    clearingSelections: "جارٍ المسح…",
    estimatedDistance: "المسافة التقديرية",
    distanceLoading: "جارٍ حساب المسافة…",
    distanceError: "تعذّر حساب المسافة. يُرجى التحقق من المواقع والمحاولة مرة أخرى.",
    pickupDropoffDistance: "مسافة الانطلاق–الوصول",
    applyError: "تعذّر تطبيق الاختيارات. يُرجى المحاولة مرة أخرى.",
    packageCoverage: "تغطية الباقة",
    tourLabel: "الجولة",
    editDateTime: "تعديل التاريخ والوقت",
    editPickup: "تعديل نقطة الانطلاق",
    editDropoff: "تعديل نقطة الوصول",
    editDuration: "تعديل المدة",
    editTour: "تعديل الجولة",
    emptyDraft: "لا يوجد بحث حجز نشط. يمكنكم عرض الخيارات من الصفحة الرئيسية.",
    passengerCount: "عدد الركاب",
    luggageCount: "عدد الأمتعة",
    babySeatCount: "مقعد أطفال",
    meetAndGreet: "الاستقبال والترحيب",
    flightCode: "رقم الرحلة",
    flightCodePlaceholder: "TK123, PC123",
    passengerRequired: "يُرجى اختيار عدد الركاب.",
    routeTitle: "المسار",
    routeMapError: "تعذّر تحميل الخريطة.",
  },
};
