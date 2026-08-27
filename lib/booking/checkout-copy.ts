import { type Locale } from "@/lib/i18n/config";
import { phoneFieldCopy } from "@/lib/geo/copy";

export const checkoutCopy: Record<
  Locale,
  {
    backToVehicles: string;
    summaryTitle: string;
    serviceType: string;
    vehicle: string;
    dateTime: string;
    pickup: string;
    dropoff: string;
    distance: string;
    distanceUnit: string;
    passengers: string;
    luggage: string;
    babySeats: string;
    meetAndGreet: string;
    flight: string;
    currency: string;
    total: string;
    yes: string;
    no: string;
    notSet: string;
    contactTitle: string;
    emailLabel: string;
    emailPlaceholder: string;
    emailInvalid: string;
    phoneInvalid: string;
    phoneLabel: string;
    nationalityLabel: string;
    nationalityPlaceholder: string;
    nationalitySearch: string;
    countryNoResults: string;
    identityLabel: string;
    identityPlaceholder: string;
    firstNameLabel: string;
    firstNamePlaceholder: string;
    lastNameLabel: string;
    lastNamePlaceholder: string;
    genderLabel: string;
    female: string;
    male: string;
    mainPassengerTitle: string;
    otherPassengersTitle: string;
    otherPassengersBlurb: string;
    enterNow: string;
    provideLater: string;
    whyPassengerInfo: string;
    whyPassengerInfoBody: string;
    extraPassengerTitle: string;
    completed: string;
    notesTitle: string;
    notesPlaceholder: string;
    nextSteps: string;
    closeSelector: string;
    required: string;
    persistError: string;
    paymentMethodTitle: string;
    payCash: string;
    paySbp: string;
    legalTitle: string;
    legalRequired: string;
    legalAcceptStart: string;
    legalAcceptJoin: string;
    legalAcceptLastJoin: string;
    legalAcceptEnd: string;
    completeReservation: string;
  }
> = {
  tr: {
    backToVehicles: "‹ Araç seçimine dön",
    summaryTitle: "Rezervasyon özeti",
    serviceType: "Hizmet türü",
    vehicle: "Araç",
    dateTime: "Tarih ve saat",
    pickup: "Alış noktası",
    dropoff: "Bırakma noktası",
    distance: "Mesafe",
    distanceUnit: "km",
    passengers: "Yolcu sayısı",
    luggage: "Bagaj sayısı",
    babySeats: "Bebek koltuğu",
    meetAndGreet: "Karşılama hizmeti",
    flight: "Uçuş numarası",
    currency: "Para birimi",
    total: "Toplam",
    yes: "Var",
    no: "Yok",
    notSet: "Belirtilmedi",
    contactTitle: "İletişim bilgileri",
    emailLabel: "E-posta",
    emailPlaceholder: "E-posta adresiniz",
    emailInvalid: "Geçerli bir e-posta adresi girin.",
    phoneInvalid: "Geçerli bir telefon numarası girin.",
    phoneLabel: "Telefon",
    nationalityLabel: "Uyruk",
    nationalityPlaceholder: "Ülke seçin",
    nationalitySearch: "Ülke ara",
    countryNoResults: "Sonuç bulunamadı",
    identityLabel: "Pasaport / TC No.",
    identityPlaceholder: "Opsiyonel",
    firstNameLabel: "İsim",
    firstNamePlaceholder: "İsim",
    lastNameLabel: "Soyisim",
    lastNamePlaceholder: "Soyisim",
    genderLabel: "Cinsiyet",
    female: "Kadın",
    male: "Erkek",
    mainPassengerTitle: "1. Yolcu — Ana yolcu bilgileri",
    otherPassengersTitle: "Diğer yolcuların bilgileri",
    otherPassengersBlurb:
      "Ana yolcunun bilgileri rezervasyonunuz için yeterlidir. Diğer yolcuların bilgilerini şimdi girebilir veya daha sonra iletebilirsiniz.",
    enterNow: "Şimdi gir",
    provideLater: "Daha sonra ilet",
    whyPassengerInfo: "Bu bilgiler neden gerekli?",
    whyPassengerInfoBody:
      "Türkiye’deki yasal düzenlemeler gereği transfere katılan yolcuların bilgilerinin şirketimiz tarafından T.C. Ulaştırma ve Altyapı Bakanlığı’nın yolcu bildirim sistemine (U-ETDS) iletilmesi gerekmektedir. Bu bilgiler, yasal bildirim yükümlülüğünün yerine getirilmesinin yanı sıra transfer sırasında geçerli olan ferdi kaza sigortasının tüm yolcuları kapsayabilmesi amacıyla kullanılmaktadır. Yolcu bilgileri, yasal zorunluluklar dışında hiçbir kişi veya kuruluşla paylaşılmaz ve ticari amaçlarla kullanılmaz.",
    extraPassengerTitle: "{n}. Yolcu bilgileri",
    completed: "Tamamlandı",
    notesTitle: "Not",
    notesPlaceholder: "Şoför için notunuz varsa yazabilirsiniz",
    nextSteps: "Ödeme adımı bir sonraki aşamada eklenecek",
    closeSelector: "Kapat",
    required: "Bu alan zorunludur.",
    persistError: "Kaydedilemedi. Lütfen tekrar deneyin.",
    paymentMethodTitle: "Ödeme yöntemi",
    payCash: "Nakit ödeme",
    paySbp: "QR / SBP ile ödeme",
    legalTitle: "Yasal onay",
    legalRequired: "Yasal onay gereklidir.",
    legalAcceptStart: "",
    legalAcceptJoin: ", ",
    legalAcceptLastJoin: " ve ",
    legalAcceptEnd: " belgelerini okudum ve kabul ediyorum.",
    completeReservation: "Rezervasyonu tamamla",
  },
  en: {
    backToVehicles: "‹ Back to vehicle selection",
    summaryTitle: "Booking summary",
    serviceType: "Service type",
    vehicle: "Vehicle",
    dateTime: "Date and time",
    pickup: "Pickup",
    dropoff: "Drop-off",
    distance: "Distance",
    distanceUnit: "km",
    passengers: "Passengers",
    luggage: "Luggage",
    babySeats: "Baby seats",
    meetAndGreet: "Meet and greet",
    flight: "Flight number",
    currency: "Currency",
    total: "Total",
    yes: "Yes",
    no: "No",
    notSet: "Not set",
    contactTitle: "Contact details",
    emailLabel: "Email",
    emailPlaceholder: "Your email address",
    emailInvalid: "Enter a valid email address.",
    phoneInvalid: "Enter a valid phone number.",
    phoneLabel: "Phone",
    nationalityLabel: "Nationality",
    nationalityPlaceholder: "Select a country",
    nationalitySearch: "Search country",
    countryNoResults: "No results",
    identityLabel: "Passport / national ID",
    identityPlaceholder: "Optional",
    firstNameLabel: "First name",
    firstNamePlaceholder: "First name",
    lastNameLabel: "Last name",
    lastNamePlaceholder: "Last name",
    genderLabel: "Gender",
    female: "Female",
    male: "Male",
    mainPassengerTitle: "Passenger 1 — Main passenger details",
    otherPassengersTitle: "Other passengers",
    otherPassengersBlurb:
      "The main passenger’s details are enough for your booking. You can enter the other passengers now or provide them later.",
    enterNow: "Enter now",
    provideLater: "Provide later",
    whyPassengerInfo: "Why is this information needed?",
    whyPassengerInfoBody:
      "Under Turkish law, the details of passengers travelling on a transfer must be submitted by our company to the passenger notification system (U-ETDS) of the Republic of Türkiye Ministry of Transport and Infrastructure. This information is used both to meet that legal reporting obligation and so that the personal accident insurance in force during the transfer can cover all passengers. Passenger details are not shared with any other person or organisation except where required by law, and they are not used for commercial purposes.",
    extraPassengerTitle: "Passenger {n} details",
    completed: "Completed",
    notesTitle: "Notes",
    notesPlaceholder: "Add a note for your driver if needed",
    nextSteps: "Payment will be added in the next step",
    closeSelector: "Close",
    required: "This field is required.",
    persistError: "Could not save. Please try again.",
    paymentMethodTitle: "Payment method",
    payCash: "Cash payment",
    paySbp: "Pay with QR / SBP",
    legalTitle: "Legal consent",
    legalRequired: "Legal consent is required.",
    legalAcceptStart: "I have read and accept the ",
    legalAcceptJoin: ", ",
    legalAcceptLastJoin: ", and ",
    legalAcceptEnd: ".",
    completeReservation: "Complete reservation",
  },
  ru: {
    backToVehicles: "‹ Вернуться к выбору автомобиля",
    summaryTitle: "Сводка бронирования",
    serviceType: "Тип услуги",
    vehicle: "Автомобиль",
    dateTime: "Дата и время",
    pickup: "Место подачи",
    dropoff: "Место назначения",
    distance: "Расстояние",
    distanceUnit: "км",
    passengers: "Пассажиры",
    luggage: "Багаж",
    babySeats: "Детские кресла",
    meetAndGreet: "Встреча в аэропорту",
    flight: "Номер рейса",
    currency: "Валюта",
    total: "Итого",
    yes: "Да",
    no: "Нет",
    notSet: "Не указано",
    contactTitle: "Контактные данные",
    emailLabel: "Эл. почта",
    emailPlaceholder: "Адрес электронной почты",
    emailInvalid: "Введите корректный адрес электронной почты.",
    phoneInvalid: "Введите корректный номер телефона.",
    phoneLabel: "Телефон",
    nationalityLabel: "Гражданство",
    nationalityPlaceholder: "Выберите страну",
    nationalitySearch: "Поиск страны",
    countryNoResults: "Ничего не найдено",
    identityLabel: "Паспорт / удостоверение",
    identityPlaceholder: "Необязательно",
    firstNameLabel: "Имя",
    firstNamePlaceholder: "Имя",
    lastNameLabel: "Фамилия",
    lastNamePlaceholder: "Фамилия",
    genderLabel: "Пол",
    female: "Женщина",
    male: "Мужчина",
    mainPassengerTitle: "Пассажир 1 — Данные основного пассажира",
    otherPassengersTitle: "Данные других пассажиров",
    otherPassengersBlurb:
      "Для бронирования достаточно данных основного пассажира. Данные остальных пассажиров можно ввести сейчас или передать позже.",
    enterNow: "Ввести сейчас",
    provideLater: "Предоставить позже",
    whyPassengerInfo: "Зачем нужны эти данные?",
    whyPassengerInfoBody:
      "Согласно законодательству Турции, сведения о пассажирах трансфера должны быть переданы нашей компанией в систему уведомления о пассажирах (U-ETDS) Министерства транспорта и инфраструктуры Турецкой Республики. Эти данные используются как для выполнения этой законной обязанности, так и для того, чтобы действующая во время трансфера индивидуальная страховка от несчастных случаев охватывала всех пассажиров. Сведения о пассажирах не передаются другим лицам или организациям, кроме случаев, предусмотренных законом, и не используются в коммерческих целях.",
    extraPassengerTitle: "Данные пассажира {n}",
    completed: "Готово",
    notesTitle: "Примечание",
    notesPlaceholder: "Если нужно, оставьте примечание для водителя",
    nextSteps: "Оплата будет добавлена на следующем шаге",
    closeSelector: "Закрыть",
    required: "Это поле обязательно.",
    persistError: "Не удалось сохранить. Попробуйте ещё раз.",
    paymentMethodTitle: "Способ оплаты",
    payCash: "Оплата наличными",
    paySbp: "Оплата через QR / СБП",
    legalTitle: "Правовое согласие",
    legalRequired: "Необходимо правовое согласие.",
    legalAcceptStart: "Я прочитал(а) и принимаю ",
    legalAcceptJoin: ", ",
    legalAcceptLastJoin: " и ",
    legalAcceptEnd: ".",
    completeReservation: "Завершить бронирование",
  },
};

export function extraPassengerTitle(locale: Locale, sequence: number) {
  return checkoutCopy[locale].extraPassengerTitle.replaceAll("{n}", String(sequence));
}

export function phoneCopyFor(locale: Locale) {
  return phoneFieldCopy[locale];
}
