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
    paymentRequired: string;
    captchaRequired: string;
    legalRequired: string;
    legalAcceptStart: string;
    legalAcceptJoin: string;
    legalAcceptLastJoin: string;
    legalAcceptEnd: string;
    completeReservation: string;
    proceedToPayment: string;
    completingReservation: string;
    proceedingToPayment: string;
    reservationCreated: string;
    completeError: string;
    completeServerError: string;
    reservationCodeLabel: string;
    sbpGbpUnsupportedTitle: string;
    sbpGbpUnsupportedBody: string;
    sbpRecommended: string;
    paymentRedirectTitle: string;
    paymentRedirectBody: string;
    paymentRedirectError: string;
    verifyingPayment: string;
    verifyingPaymentBody: string;
    pickupPrepTitle: string;
    pickupPrepBody: string;
    pickupPrepBack: string;
    pickupPrepConfirm: string;
    pickupPrepConfirming: string;
    bosphorusCutoffTitle: string;
    bosphorusCutoffBody: string;
    bosphorusCutoffConfirm: string;
    bosphorusCutoffConfirming: string;
    bosphorusCutoffChooseDate: string;
    successTitle: string;
    successCodeLabel: string;
    successTourGuideInfo: string;
    successContactUs: string;
    downloadVoucherPdf: string;
    downloadingVoucherPdf: string;
    backToHome: string;
    voucherPdfError: string;
    voucherPdfTitle: string;
    voucherPdfFooter: string;
    voucherMainPassenger: string;
    editReviewTitle: string;
    editReviewOriginalTotal: string;
    editReviewNewTotal: string;
    editReviewDifference: string;
    editReviewPendingBody: string;
    editReviewRefundBody: string;
    editReviewConfirmDisabled: string;
    editReviewNetCollected: string;
    editReviewAmountDue: string;
    editReviewAmountRefund: string;
    editReviewCashPayable: string;
    editReviewNoDifference: string;
  editCtaUpdateReservation: string;
  editCtaPayDifference: string;
  editCtaRequestRefund: string;
  editCtaCashConfirm: string;
  editFinalizeError: string;
  successUpdatedTitle: string;
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
    payCash: "Nakit",
    paySbp: "QR / SBP",
    legalTitle: "Yasal onay",
    legalRequired: "Yasal onay zorunludur.",
    paymentRequired: "Lütfen bir ödeme yöntemi seçin.",
    captchaRequired: "Lütfen güvenlik doğrulamasını tamamlayın.",
    legalAcceptStart: "",
    legalAcceptJoin: ", ",
    legalAcceptLastJoin: " ve ",
    legalAcceptEnd: " belgelerini okudum ve kabul ediyorum.",
    completeReservation: "Rezervasyonu tamamla",
    proceedToPayment: "Ödemeye Geç",
    completingReservation: "Rezervasyon oluşturuluyor…",
    proceedingToPayment: "Ödeme sayfasına yönlendiriliyorsunuz…",
    reservationCreated: "Rezervasyonunuz oluşturuldu.",
    completeError: "Rezervasyon tamamlanamadı. Lütfen bilgilerinizi kontrol edip tekrar deneyin.",
    completeServerError:
      "Rezervasyon şu anda oluşturulamadı. Lütfen tekrar deneyin veya destek ekibimizle iletişime geçin.",
    reservationCodeLabel: "Rezervasyon kodu",
    sbpGbpUnsupportedTitle: "SBP ile GBP ödeme desteklenmiyor.",
    sbpGbpUnsupportedBody:
      "Lütfen ödeme para biriminizi değiştirin. Kur dönüşüm maliyetini azaltmak için RUB kullanmanızı öneririz.",
    sbpRecommended: "Önerilen",
    paymentRedirectTitle: "Ödeme sayfasına yönlendiriliyorsunuz",
    paymentRedirectBody: "Lütfen bekleyin, işlem birkaç saniye sürebilir.",
    paymentRedirectError: "Ödeme sayfası açılamadı. Lütfen tekrar deneyin.",
    verifyingPayment: "Ödemeniz doğrulanıyor…",
    verifyingPaymentBody: "Ödeme onayı birkaç saniye sürebilir. Lütfen bu sayfada bekleyin.",
    pickupPrepTitle: "Transfer saati için hazırlık süresi yetersiz kaldı",
    pickupPrepBody:
      "Rezervasyonunuzu sorunsuz şekilde organize edebilmemiz için transfer saatinden önce yeterli hazırlık süresine ihtiyacımız var. Şu anda onaylayabileceğimiz en yakın transfer saati {time}.",
    pickupPrepBack: "Geri Dön",
    pickupPrepConfirm: "{time} için rezervasyonu tamamla",
    pickupPrepConfirming: "{time} için rezervasyon oluşturuluyor…",
    bosphorusCutoffTitle: "Bugünkü tur için rezervasyon süresi sona erdi",
    bosphorusCutoffBody:
      "Boğaz'da Yemekli Gemi Turu için aynı gün rezervasyonlar saat 17:30'a kadar alınmaktadır. Lütfen bir sonraki uygun tarihi seçin.",
    bosphorusCutoffConfirm: "{date} tarihini seç",
    bosphorusCutoffConfirming: "{date} tarihi güncelleniyor…",
    bosphorusCutoffChooseDate: "Başka tarih seç",
    successTitle: "Rezervasyonunuz oluşturuldu",
    successUpdatedTitle: "Rezervasyonunuz güncellendi",
    successCodeLabel: "Rezervasyon Kodunuz",
    successTourGuideInfo:
      "Turunuza profesyonel bir rehberin eşlik etmesini isterseniz bizimle iletişime geçebilirsiniz. Rehberlik hizmeti rezervasyon ücretine dahil değildir; talep edilen dil ve müsaitliğe göre ayrıca fiyatlandırılır.",
    successContactUs: "Bizimle İletişime Geç",
    downloadVoucherPdf: "Voucher belgesini PDF olarak indir",
    downloadingVoucherPdf: "PDF hazırlanıyor…",
    backToHome: "Ana sayfaya dön",
    voucherPdfError: "PDF oluşturulamadı. Lütfen tekrar deneyin.",
    voucherPdfTitle: "Rezervasyon Voucher",
    voucherPdfFooter: "Tripetica transfer rezervasyon belgesi",
    voucherMainPassenger: "Ana yolcu",
    editReviewTitle: "Değişiklik özeti",
    editReviewOriginalTotal: "Mevcut rezervasyon toplamı",
    editReviewNewTotal: "Yeni rezervasyon toplamı",
    editReviewDifference: "Fiyat farkı",
    editReviewPendingBody:
      "Onayladığınızda değişiklikler güvenli şekilde işlenecektir. Ek ödeme gerekiyorsa rezervasyon ancak ödeme tamamlandıktan sonra güncellenir.",
    editReviewRefundBody:
      "Değişiklikleri onayladığınızda rezervasyonunuz güncellenecek ve {amount} ödeme yönteminize iade edilecektir.",
    editReviewConfirmDisabled: "Değişiklikleri kesinleştir (yakında)",
    editReviewNetCollected: "Daha önce ödenen",
    editReviewAmountDue: "Şimdi ödenecek",
    editReviewAmountRefund: "İade edilecek tutar",
    editReviewCashPayable: "Yeni ödenecek nakit tutar",
    editReviewNoDifference: "Yok",
    editCtaUpdateReservation: "Rezervasyonu Güncelle",
    editCtaPayDifference: "Ödemeye Geç",
    editCtaRequestRefund: "Değişiklikleri ve İadeyi Onayla",
    editCtaCashConfirm: "Rezervasyonu Güncelle",
    editFinalizeError: "Değişiklik tamamlanamadı. Lütfen tekrar deneyin.",
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
    payCash: "Cash",
    paySbp: "QR / SBP",
    legalTitle: "Legal consent",
    legalRequired: "Legal consent is required.",
    paymentRequired: "Please select a payment method.",
    captchaRequired: "Please complete the security verification.",
    legalAcceptStart: "I have read and accept the ",
    legalAcceptJoin: ", ",
    legalAcceptLastJoin: ", and ",
    legalAcceptEnd: ".",
    completeReservation: "Complete reservation",
    proceedToPayment: "Proceed to payment",
    completingReservation: "Creating your reservation…",
    proceedingToPayment: "Redirecting to payment…",
    reservationCreated: "Your reservation has been created.",
    completeError: "Could not complete the reservation. Please check your details and try again.",
    completeServerError:
      "We could not create your reservation right now. Please try again or contact our support team.",
    reservationCodeLabel: "Reservation code",
    sbpGbpUnsupportedTitle: "GBP is not supported for SBP payments.",
    sbpGbpUnsupportedBody:
      "Please change your payment currency. To reduce FX conversion costs, we recommend RUB.",
    sbpRecommended: "Recommended",
    paymentRedirectTitle: "Redirecting you to the payment page",
    paymentRedirectBody: "Please wait — this usually takes a few seconds.",
    paymentRedirectError: "Could not open the payment page. Please try again.",
    verifyingPayment: "Verifying your payment…",
    verifyingPaymentBody: "Payment confirmation may take a few seconds. Please stay on this page.",
    pickupPrepTitle: "Not enough preparation time before your transfer",
    pickupPrepBody:
      "We need enough preparation time before your transfer to organise your booking smoothly. The earliest transfer time we can confirm right now is {time}.",
    pickupPrepBack: "Go back",
    pickupPrepConfirm: "Complete reservation for {time}",
    pickupPrepConfirming: "Creating reservation for {time}…",
    bosphorusCutoffTitle: "Same-day booking for today’s cruise has closed",
    bosphorusCutoffBody:
      "Same-day bookings for the Bosphorus Dinner Cruise & Turkish Night are accepted until 17:30. Please choose the next available date.",
    bosphorusCutoffConfirm: "Select {date}",
    bosphorusCutoffConfirming: "Updating date to {date}…",
    bosphorusCutoffChooseDate: "Choose another date",
    successTitle: "Your reservation has been created",
    successUpdatedTitle: "Your reservation has been updated",
    successCodeLabel: "Your reservation code",
    successTourGuideInfo:
      "If you would like a professional guide to accompany your tour, please contact us. Guide service is not included in the reservation fee and is priced separately based on the requested language and availability.",
    successContactUs: "Contact Us",
    downloadVoucherPdf: "Download voucher as PDF",
    downloadingVoucherPdf: "Preparing PDF…",
    backToHome: "Back to home",
    voucherPdfError: "Could not generate the PDF. Please try again.",
    voucherPdfTitle: "Reservation voucher",
    voucherPdfFooter: "Tripetica transfer reservation document",
    voucherMainPassenger: "Main passenger",
    editReviewTitle: "Change summary",
    editReviewOriginalTotal: "Current reservation total",
    editReviewNewTotal: "New reservation total",
    editReviewDifference: "Price difference",
    editReviewPendingBody:
      "When you confirm, changes are processed securely. If an extra payment is required, the reservation updates only after payment succeeds.",
    editReviewRefundBody:
      "When you confirm the changes, your reservation will be updated and {amount} will be refunded to your payment method.",
    editReviewConfirmDisabled: "Confirm changes (coming soon)",
    editReviewNetCollected: "Previously paid",
    editReviewAmountDue: "Amount due now",
    editReviewAmountRefund: "Amount to refund",
    editReviewCashPayable: "New cash amount to pay",
    editReviewNoDifference: "None",
    editCtaUpdateReservation: "Update reservation",
    editCtaPayDifference: "Proceed to payment",
    editCtaRequestRefund: "Confirm changes and refund",
    editCtaCashConfirm: "Update reservation",
    editFinalizeError: "Could not complete the change. Please try again.",
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
    payCash: "Наличные",
    paySbp: "QR / СБП",
    legalTitle: "Правовое согласие",
    legalRequired: "Требуется правовое согласие.",
    paymentRequired: "Выберите способ оплаты.",
    captchaRequired: "Пройдите проверку безопасности.",
    legalAcceptStart: "Я прочитал(а) и принимаю ",
    legalAcceptJoin: ", ",
    legalAcceptLastJoin: " и ",
    legalAcceptEnd: ".",
    completeReservation: "Завершить бронирование",
    proceedToPayment: "Перейти к оплате",
    completingReservation: "Создаём бронирование…",
    proceedingToPayment: "Перенаправляем на оплату…",
    reservationCreated: "Бронирование создано.",
    completeError: "Не удалось завершить бронирование. Проверьте данные и попробуйте снова.",
    completeServerError:
      "Сейчас не удалось создать бронирование. Попробуйте снова или свяжитесь с нашей службой поддержки.",
    reservationCodeLabel: "Код бронирования",
    sbpGbpUnsupportedTitle: "Оплата в GBP через СБП не поддерживается.",
    sbpGbpUnsupportedBody:
      "Пожалуйста, измените валюту оплаты. Чтобы снизить расходы на конвертацию, рекомендуем RUB.",
    sbpRecommended: "Рекомендуется",
    paymentRedirectTitle: "Перенаправляем на страницу оплаты",
    paymentRedirectBody: "Пожалуйста, подождите — обычно это занимает несколько секунд.",
    paymentRedirectError: "Не удалось открыть страницу оплаты. Попробуйте ещё раз.",
    verifyingPayment: "Проверяем оплату…",
    verifyingPaymentBody: "Подтверждение оплаты может занять несколько секунд. Оставайтесь на этой странице.",
    pickupPrepTitle: "Недостаточно времени на подготовку к трансферу",
    pickupPrepBody:
      "Чтобы организовать ваше бронирование без проблем, нам нужно достаточно времени до трансфера. Ближайшее время трансфера, которое мы можем подтвердить сейчас, — {time}.",
    pickupPrepBack: "Назад",
    pickupPrepConfirm: "Завершить бронирование на {time}",
    pickupPrepConfirming: "Создаём бронирование на {time}…",
    bosphorusCutoffTitle: "Бронирование на сегодняшний круиз закрыто",
    bosphorusCutoffBody:
      "Бронирования на круиз «Ужин на Босфоре и турецкая ночь» в тот же день принимаются до 17:30. Пожалуйста, выберите ближайшую доступную дату.",
    bosphorusCutoffConfirm: "Выбрать {date}",
    bosphorusCutoffConfirming: "Обновляем дату на {date}…",
    bosphorusCutoffChooseDate: "Выбрать другую дату",
    successTitle: "Ваше бронирование создано",
    successUpdatedTitle: "Ваше бронирование обновлено",
    successCodeLabel: "Код бронирования",
    successTourGuideInfo:
      "Если вы хотите, чтобы ваш тур сопровождал профессиональный гид, свяжитесь с нами. Услуги гида не включены в стоимость бронирования и оплачиваются отдельно в зависимости от языка и доступности.",
    successContactUs: "Связаться с нами",
    downloadVoucherPdf: "Скачать ваучер в PDF",
    downloadingVoucherPdf: "Подготовка PDF…",
    backToHome: "На главную",
    voucherPdfError: "Не удалось создать PDF. Попробуйте ещё раз.",
    voucherPdfTitle: "Ваучер бронирования",
    voucherPdfFooter: "Документ бронирования трансфера Tripetica",
    voucherMainPassenger: "Основной пассажир",
    editReviewTitle: "Сводка изменений",
    editReviewOriginalTotal: "Текущая сумма бронирования",
    editReviewNewTotal: "Новая сумма бронирования",
    editReviewDifference: "Разница в цене",
    editReviewPendingBody:
      "После подтверждения изменения обрабатываются безопасно. Если нужна доплата, бронирование обновится только после успешной оплаты.",
    editReviewRefundBody:
      "После подтверждения изменений бронирование будет обновлено, а {amount} будет возвращено на ваш способ оплаты.",
    editReviewConfirmDisabled: "Подтвердить изменения (скоро)",
    editReviewNetCollected: "Ранее оплачено",
    editReviewAmountDue: "К оплате сейчас",
    editReviewAmountRefund: "Сумма к возврату",
    editReviewCashPayable: "Новая сумма к оплате наличными",
    editReviewNoDifference: "Нет",
    editCtaUpdateReservation: "Обновить бронирование",
    editCtaPayDifference: "Перейти к оплате",
    editCtaRequestRefund: "Подтвердить изменения и возврат",
    editCtaCashConfirm: "Обновить бронирование",
    editFinalizeError: "Не удалось завершить изменение. Попробуйте ещё раз.",
  },
  ar: {
    backToVehicles: "‹ العودة إلى اختيار المركبة",
    summaryTitle: "ملخص الحجز",
    serviceType: "نوع الخدمة",
    vehicle: "المركبة",
    dateTime: "التاريخ والوقت",
    pickup: "نقطة الانطلاق",
    dropoff: "نقطة الوصول",
    distance: "المسافة",
    distanceUnit: "كم",
    passengers: "الركاب",
    luggage: "أمتعة",
    babySeats: "مقعد أطفال",
    meetAndGreet: "الاستقبال والترحيب",
    flight: "رقم الرحلة",
    currency: "العملة",
    total: "الإجمالي",
    yes: "نعم",
    no: "لا",
    notSet: "غير محدّد",
    contactTitle: "بيانات التواصل",
    emailLabel: "البريد الإلكتروني",
    emailPlaceholder: "عنوان بريدك الإلكتروني",
    emailInvalid: "أدخل عنوان بريد إلكتروني صالحًا.",
    phoneInvalid: "أدخل رقم هاتف صالحًا.",
    phoneLabel: "الهاتف",
    nationalityLabel: "الجنسية",
    nationalityPlaceholder: "اختر الدولة",
    nationalitySearch: "البحث عن دولة",
    countryNoResults: "لا توجد نتائج",
    identityLabel: "جواز السفر / رقم الهوية",
    identityPlaceholder: "اختياري",
    firstNameLabel: "الاسم الأول",
    firstNamePlaceholder: "الاسم الأول",
    lastNameLabel: "اسم العائلة",
    lastNamePlaceholder: "اسم العائلة",
    genderLabel: "الجنس",
    female: "أنثى",
    male: "ذكر",
    mainPassengerTitle: "الراكب 1 — بيانات الراكب الرئيسي",
    otherPassengersTitle: "الركاب الآخرون",
    otherPassengersBlurb:
      "بيانات الراكب الرئيسي كافية لحجزكم. يمكنكم إدخال بيانات الركاب الآخرين الآن أو تزويدنا بها لاحقًا.",
    enterNow: "الإدخال الآن",
    provideLater: "التزويد لاحقًا",
    whyPassengerInfo: "لماذا نحتاج إلى هذه المعلومات؟",
    whyPassengerInfoBody:
      "بموجب القانون التركي، يجب على شركتنا تقديم بيانات الركاب المسافرين في خدمة النقل الخاص إلى نظام إبلاغ الركاب (U-ETDS) التابع لوزارة النقل والبنية التحتية في جمهورية تركيا. تُستخدم هذه المعلومات للوفاء بهذا الالتزام القانوني، وكذلك لكي يشمل التأمين ضد الحوادث الشخصية الساري أثناء النقل جميع الركاب. لا تُشارك بيانات الركاب مع أي شخص أو جهة أخرى إلا حيث يقتضي القانون ذلك، ولا تُستخدم لأغراض تجارية.",
    extraPassengerTitle: "بيانات الراكب {n}",
    completed: "اكتمل",
    notesTitle: "ملاحظات",
    notesPlaceholder: "أضيفوا ملاحظة للسائق إن لزم الأمر",
    nextSteps: "ستُضاف خطوة الدفع في المرحلة التالية",
    closeSelector: "إغلاق",
    required: "هذا الحقل مطلوب.",
    persistError: "تعذّر الحفظ. يُرجى المحاولة مرة أخرى.",
    paymentMethodTitle: "وسيلة الدفع",
    payCash: "نقدًا",
    paySbp: "QR / SBP",
    legalTitle: "الموافقة القانونية",
    legalRequired: "الموافقة القانونية مطلوبة.",
    paymentRequired: "يُرجى اختيار وسيلة الدفع.",
    captchaRequired: "يُرجى إكمال التحقق الأمني.",
    legalAcceptStart: "لقد قرأت وأوافق على ",
    legalAcceptJoin: " و",
    legalAcceptLastJoin: " و",
    legalAcceptEnd: ".",
    completeReservation: "إتمام الحجز",
    proceedToPayment: "الانتقال إلى الدفع",
    completingReservation: "جارٍ إنشاء حجزكم…",
    proceedingToPayment: "جارٍ التوجيه إلى الدفع…",
    reservationCreated: "تم إنشاء حجزكم.",
    completeError: "تعذّر إتمام الحجز. يُرجى التحقق من بياناتكم والمحاولة مرة أخرى.",
    completeServerError:
      "تعذّر إنشاء حجزكم حاليًا. يُرجى المحاولة مرة أخرى أو التواصل مع فريق الدعم.",
    reservationCodeLabel: "رمز الحجز",
    sbpGbpUnsupportedTitle: "لا يدعم الدفع عبر SBP عملة الجنيه الإسترليني (GBP).",
    sbpGbpUnsupportedBody:
      "يُرجى تغيير عملة الدفع. لتقليل تكاليف تحويل العملة، نوصي باستخدام الروبل الروسي (RUB).",
    sbpRecommended: "موصى به",
    paymentRedirectTitle: "جارٍ توجيهكم إلى صفحة الدفع",
    paymentRedirectBody: "يُرجى الانتظار — عادةً ما يستغرق ذلك بضع ثوانٍ.",
    paymentRedirectError: "تعذّر فتح صفحة الدفع. يُرجى المحاولة مرة أخرى.",
    verifyingPayment: "جارٍ التحقق من الدفع…",
    verifyingPaymentBody: "قد يستغرق تأكيد الدفع بضع ثوانٍ. يُرجى البقاء في هذه الصفحة.",
    pickupPrepTitle: "وقت التحضير قبل النقل الخاص غير كافٍ",
    pickupPrepBody:
      "نحتاج إلى وقت كافٍ للتحضير قبل موعد النقل الخاص لتنظيم حجزكم بسلاسة. أقرب وقت للنقل يمكننا تأكيده الآن هو {time}.",
    pickupPrepBack: "رجوع",
    pickupPrepConfirm: "إتمام الحجز لوقت {time}",
    pickupPrepConfirming: "جارٍ إنشاء الحجز لوقت {time}…",
    bosphorusCutoffTitle: "انتهى وقت الحجز لرحلة اليوم نفسها",
    bosphorusCutoffBody:
      "تُقبل حجوزات اليوم نفسه لرحلة العشاء البحرية في البوسفور والليلة التركية حتى الساعة 17:30. يُرجى اختيار أقرب تاريخ متاح.",
    bosphorusCutoffConfirm: "اختيار {date}",
    bosphorusCutoffConfirming: "جارٍ تحديث التاريخ إلى {date}…",
    bosphorusCutoffChooseDate: "اختيار تاريخ آخر",
    successTitle: "تم إنشاء حجزكم",
    successUpdatedTitle: "تم تحديث حجزكم",
    successCodeLabel: "رمز حجزكم",
    successTourGuideInfo:
      "إذا رغبتم في مرافقة دليل محترف لجولتكم، يُرجى التواصل معنا. خدمة الإرشاد غير مشمولة في رسوم الحجز، وتُسعَّر بشكل منفصل حسب اللغة المطلوبة والتوافر.",
    successContactUs: "تواصلوا معنا",
    downloadVoucherPdf: "تنزيل قسيمة الحجز بصيغة PDF",
    downloadingVoucherPdf: "جارٍ تجهيز ملف PDF…",
    backToHome: "العودة إلى الصفحة الرئيسية",
    voucherPdfError: "تعذّر إنشاء ملف PDF. يُرجى المحاولة مرة أخرى.",
    voucherPdfTitle: "قسيمة الحجز",
    voucherPdfFooter: "وثيقة حجز النقل الخاص من Tripetica",
    voucherMainPassenger: "الراكب الرئيسي",
    editReviewTitle: "ملخص التغييرات",
    editReviewOriginalTotal: "إجمالي الحجز الحالي",
    editReviewNewTotal: "إجمالي الحجز الجديد",
    editReviewDifference: "فرق السعر",
    editReviewPendingBody:
      "عند التأكيد، تُعالَج التغييرات بأمان. إذا تطلّب الأمر دفعة إضافية، يُحدَّث الحجز فقط بعد نجاح الدفع.",
    editReviewRefundBody:
      "عند تأكيد التغييرات، سيُحدَّث حجزكم ويُعاد مبلغ {amount} إلى وسيلة الدفع.",
    editReviewConfirmDisabled: "تأكيد التغييرات (قريبًا)",
    editReviewNetCollected: "المدفوع سابقًا",
    editReviewAmountDue: "المبلغ المستحق الآن",
    editReviewAmountRefund: "المبلغ المراد إرجاعه",
    editReviewCashPayable: "المبلغ النقدي الجديد المستحق",
    editReviewNoDifference: "لا يوجد",
    editCtaUpdateReservation: "تحديث الحجز",
    editCtaPayDifference: "الانتقال إلى الدفع",
    editCtaRequestRefund: "تأكيد التغييرات والاسترداد",
    editCtaCashConfirm: "تحديث الحجز",
    editFinalizeError: "تعذّر إكمال التغيير. يُرجى المحاولة مرة أخرى.",
  },
};

export function extraPassengerTitle(locale: Locale, sequence: number) {
  return checkoutCopy[locale].extraPassengerTitle.replaceAll("{n}", String(sequence));
}

export function phoneCopyFor(locale: Locale) {
  return phoneFieldCopy[locale];
}
