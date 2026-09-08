import { bookingServiceDisplayLabel } from "@/lib/booking/tour-display";
import { type Locale } from "@/lib/i18n/config";

export const TRIPETICA_COMPANY_LEGAL =
  "SEARCH TRAVEL AGENCY TURİZM TAŞIMACILIK TİC. LTD. ŞTİ.";

export const voucherCopy: Record<
  Locale,
  {
    voucherLabel: string;
    reservationCodeLabel: string;
    reservationSection: string;
    reservationCode: string;
    serviceType: string;
    vehicleClass: string;
    dateTimeLabel: string;
    durationLabel: string;
    packageCoverageLabel: string;
    pickupPoint: string;
    dropoffPoint: string;
    distance: string;
    distanceUnit: string;
    flight: string;
    passengers: string;
    luggage: string;
    babySeats: string;
    meetAndGreet: string;
    paymentMethod: string;
    total: string;
    otherCurrencyEquivalents: string;
    passengerSection: string;
    fullName: string;
    phone: string;
    email: string;
    passengerList: string;
    otherPassengers: string;
    policySectionTitle: string;
    policyCancelTitle: string;
    policyCancelBody: string;
    policyWaitingTitle: string;
    policyWaitingBody: string;
    policyNoShowTitle: string;
    policyNoShowBody: string;
    policyHourlyWaitingTitle: string;
    policyHourlyWaitingBody: string;
    policyTourWaitingTitle: string;
    policyTourWaitingBody: string;
    contactSection: string;
    yes: string;
    no: string;
    paymentCash: string;
    paymentSbp: string;
  }
> = {
  tr: {
    voucherLabel: "VOUCHER",
    reservationCodeLabel: "Rezervasyon Kodu",
    reservationSection: "Rezervasyon Bilgileri",
    reservationCode: "Rezervasyon kodu",
    serviceType: "Hizmet türü",
    vehicleClass: "Araç sınıfı",
    dateTimeLabel: "Tarih & Saat",
    durationLabel: "Süre",
    packageCoverageLabel: "Paket kapsamı",
    pickupPoint: "Alış noktası",
    dropoffPoint: "Bırakma noktası",
    distance: "Mesafe",
    distanceUnit: "km",
    flight: "Uçuş kodu",
    passengers: "Yolcu sayısı",
    luggage: "Bagaj",
    babySeats: "Bebek koltuğu",
    meetAndGreet: "Karşılama hizmeti",
    paymentMethod: "Ödeme yöntemi",
    total: "Toplam ücret",
    otherCurrencyEquivalents: "Diğer para birimlerindeki karşılığı",
    passengerSection: "Yolcu Bilgileri",
    fullName: "Ad Soyad",
    phone: "Telefon",
    email: "E-posta",
    passengerList: "Yolcular",
    otherPassengers: "Diğer Yolcular",
    policySectionTitle: "İPTAL, DEĞİŞİKLİK VE BEKLEME KOŞULLARI",
    policyCancelTitle: "İptal ve değişiklik",
    policyCancelBody:
      "Rezervasyon, hizmet başlangıç saatine 6 saatten fazla süre kaldığı sürece iptal edilebilir veya değiştirilebilir. İzin verilen süre içinde yapılan iptallerde, önceden tahsil edilmiş ve henüz iade edilmemiş net tutarın %100’ü iade edilir. Hizmet başlangıcına 6 saat veya daha az kaldığında iptal veya değişiklik yapılamaz. Alış veya bırakış noktası, tarih, saat, araç sınıfı ya da rezervasyon kapsamındaki diğer bilgilerin değiştirilmesi halinde, değişikliğin türüne göre fiyat farkı veya ek ücret uygulanabilir. İptal ve değişiklik talepleri Tripetica hesap alanı veya iletişim kanalları üzerinden iletilmelidir.",
    policyWaitingTitle: "Ücretsiz bekleme süreleri",
    policyWaitingBody:
      "Havalimanı alışlarında 90 dakika, tren istasyonlarında 30 dakika, diğer tüm alış noktalarında 20 dakika ücretsiz bekleme süresi uygulanır.",
    policyNoShowTitle: "No-Show",
    policyNoShowBody:
      "Yolcunun belirtilen alış noktasında ücretsiz bekleme süresi içerisinde hazır bulunmaması durumunda rezervasyon No-Show olarak değerlendirilebilir ve ücret iadesi yapılmaz.",
    policyHourlyWaitingTitle: "Bekleme ve hizmet süresi",
    policyHourlyWaitingBody:
      "Yolcunun ücretsiz bekleme süresi içerisinde hazır bulunmaması halinde şoför beklemeye devam eder ve rezervasyon bu aşamada No-Show olarak değerlendirilmez. Ücretsiz bekleme süresinin sona erdiği andan itibaren beklenen süre, seçilen hizmet süresinden düşülür. Yolcunun seçilen hizmet süresi sona erene kadar hazır bulunmaması halinde rezervasyon No-Show olarak değerlendirilir ve ücret iadesi yapılmaz.",
    policyTourWaitingTitle: "Bekleme ve tur süresi",
    policyTourWaitingBody:
      "Yolcunun ücretsiz bekleme süresi içerisinde hazır bulunmaması halinde şoför beklemeye devam eder ve rezervasyon bu aşamada No-Show olarak değerlendirilmez. Ücretsiz bekleme süresinin sona erdiği andan itibaren beklenen süre, rezervasyona dahil tur/paket süresinden düşülür. Yolcunun tur/paket süresi sona erene kadar hazır bulunmaması halinde rezervasyon No-Show olarak değerlendirilir ve ücret iadesi yapılmaz.",
    contactSection: "Tripetica",
    yes: "Evet",
    no: "Hayır",
    paymentCash: "Nakit",
    paymentSbp: "Online",
  },
  en: {
    voucherLabel: "VOUCHER",
    reservationCodeLabel: "Reservation code",
    reservationSection: "Reservation details",
    reservationCode: "Reservation code",
    serviceType: "Service type",
    vehicleClass: "Vehicle class",
    dateTimeLabel: "Date & Time",
    durationLabel: "Duration",
    packageCoverageLabel: "Package coverage",
    pickupPoint: "Pickup",
    dropoffPoint: "Drop-off",
    distance: "Distance",
    distanceUnit: "km",
    flight: "Flight number",
    passengers: "Number of passengers",
    luggage: "Luggage",
    babySeats: "Baby seats",
    meetAndGreet: "Meet & greet",
    paymentMethod: "Payment method",
    total: "Total amount",
    otherCurrencyEquivalents: "Equivalent in other currencies",
    passengerSection: "Passenger details",
    fullName: "Full Name",
    phone: "Phone",
    email: "Email",
    passengerList: "Passengers",
    otherPassengers: "Other passengers",
    policySectionTitle: "CANCELLATION, CHANGES AND WAITING TIME",
    policyCancelTitle: "Cancellation and changes",
    policyCancelBody:
      "The reservation may be cancelled or changed while more than 6 hours remain before the service start time. Cancellations made within the permitted period receive a 100% refund of the net amount previously collected and not yet refunded. When 6 hours or less remain before the service start time, cancellation or changes are not available. If the pickup or drop-off location, date, time, vehicle class, or other details covered by the reservation are changed, a price difference or additional charge may apply depending on the type of change. Cancellation and change requests must be submitted through the Tripetica account area or contact channels.",
    policyWaitingTitle: "Free waiting time",
    policyWaitingBody:
      "Free waiting time is 90 minutes for airport pickups, 30 minutes for train stations, and 20 minutes for all other pickup locations.",
    policyNoShowTitle: "No-Show",
    policyNoShowBody:
      "If the passenger does not arrive at the specified pickup location within the applicable free waiting period, the reservation may be considered a No-Show and no refund will be issued.",
    policyHourlyWaitingTitle: "Waiting and service duration",
    policyHourlyWaitingBody:
      "If the passenger is not ready within the free waiting period, the chauffeur will continue to wait and the reservation will not be considered a No-Show at that stage. From the moment the free waiting period ends, the time spent waiting will be deducted from the selected service duration. If the passenger is still not ready by the end of the selected service duration, the reservation will be considered a No-Show and no refund will be issued.",
    policyTourWaitingTitle: "Waiting and tour duration",
    policyTourWaitingBody:
      "If the passenger is not ready within the free waiting period, the chauffeur will continue to wait and the reservation will not be considered a No-Show at that stage. From the moment the free waiting period ends, the time spent waiting will be deducted from the tour/package duration included in the reservation. If the passenger is still not ready by the end of the tour/package duration, the reservation will be considered a No-Show and no refund will be issued.",
    contactSection: "Tripetica",
    yes: "Yes",
    no: "No",
    paymentCash: "Cash",
    paymentSbp: "Online",
  },
  ru: {
    voucherLabel: "ВАУЧЕР",
    reservationCodeLabel: "Код бронирования",
    reservationSection: "Детали бронирования",
    reservationCode: "Код бронирования",
    serviceType: "Тип услуги",
    vehicleClass: "Класс авто",
    dateTimeLabel: "Дата и время",
    durationLabel: "Продолжительность",
    packageCoverageLabel: "Пакет включает",
    pickupPoint: "Место подачи",
    dropoffPoint: "Место назначения",
    distance: "Расстояние",
    distanceUnit: "км",
    flight: "Номер рейса",
    passengers: "Количество пассажиров",
    luggage: "Багаж",
    babySeats: "Детские кресла",
    meetAndGreet: "Встреча в аэропорту",
    paymentMethod: "Способ оплаты",
    total: "Итоговая сумма",
    otherCurrencyEquivalents: "Эквивалент в других валютах",
    passengerSection: "Данные пассажира",
    fullName: "Имя и фамилия",
    phone: "Телефон",
    email: "Эл. почта",
    passengerList: "Пассажиры",
    otherPassengers: "Другие пассажиры",
    policySectionTitle: "ОТМЕНА, ИЗМЕНЕНИЯ И ВРЕМЯ ОЖИДАНИЯ",
    policyCancelTitle: "Отмена и изменения",
    policyCancelBody:
      "Бронирование можно отменить или изменить, если до начала услуги остаётся больше 6 часов. При отмене в разрешённый срок возвращается 100% ранее полученной и ещё не возвращённой чистой суммы. Если до начала услуги осталось 6 часов или меньше, отмена и изменение недоступны. При изменении места подачи или назначения, даты, времени, класса автомобиля либо других сведений, входящих в бронирование, в зависимости от характера изменения может применяться разница в цене или дополнительная плата. Запросы на отмену и изменение необходимо направлять через личный кабинет Tripetica или контактные каналы.",
    policyWaitingTitle: "Бесплатное время ожидания",
    policyWaitingBody:
      "Бесплатное время ожидания составляет 90 минут при встрече в аэропорту, 30 минут на железнодорожных вокзалах и 20 минут во всех остальных местах подачи автомобиля.",
    policyNoShowTitle: "No-Show",
    policyNoShowBody:
      "Если пассажир не прибудет в указанное место встречи в течение установленного бесплатного времени ожидания, бронирование может быть признано No-Show, и оплата не возвращается.",
    policyHourlyWaitingTitle: "Ожидание и продолжительность услуги",
    policyHourlyWaitingBody:
      "Если пассажир не будет готов в течение бесплатного времени ожидания, водитель продолжит ожидание, и на этом этапе бронирование не будет считаться No-Show. С момента окончания бесплатного времени ожидания затраченное на ожидание время вычитается из выбранной продолжительности услуги. Если пассажир не будет готов до окончания выбранной продолжительности услуги, бронирование будет считаться No-Show, и оплата не возвращается.",
    policyTourWaitingTitle: "Ожидание и продолжительность тура",
    policyTourWaitingBody:
      "Если пассажир не будет готов в течение бесплатного времени ожидания, водитель продолжит ожидание, и на этом этапе бронирование не будет считаться No-Show. С момента окончания бесплатного времени ожидания затраченное на ожидание время вычитается из продолжительности тура/пакета, включённой в бронирование. Если пассажир не будет готов до окончания продолжительности тура/пакета, бронирование будет считаться No-Show, и оплата не возвращается.",
    contactSection: "Tripetica",
    yes: "Да",
    no: "Нет",
    paymentCash: "Наличные",
    paymentSbp: "Онлайн",
  },
};

export function voucherServiceTypeLabel(
  serviceType: string | null | undefined,
  locale: Locale,
  tourCode?: string | null,
) {
  return bookingServiceDisplayLabel(serviceType, tourCode, locale);
}

export function voucherPaymentLabel(
  locale: Locale,
  paymentMethod: string | null | undefined,
) {
  const copy = voucherCopy[locale];
  if (paymentMethod === "sbp") {
    return copy.paymentSbp;
  }
  if (paymentMethod === "cash") {
    return copy.paymentCash;
  }
  return paymentMethod?.trim() || "—";
}
