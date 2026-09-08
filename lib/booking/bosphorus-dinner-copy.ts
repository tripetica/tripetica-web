import { type Locale } from "@/lib/i18n/config";
import {
  BOSPHORUS_SERVICE_PICKUP_WINDOW,
  type BosphorusPaxCategory,
} from "@/lib/booking/pricing/bosphorus-dinner-pricing";

export type BosphorusDinnerCopy = {
  heroDateHint: string;
  dropoffLabel: string;
  servicePickupLabel: string;
  servicePickupValue: string;
  servicePickupNote: string;
  packageTitle: string;
  selectContinue: string;
  backToSelection: string;
  includedTitle: string;
  included: string[];
  opsNotice: string;
  opsNotifyAround18: string;
  durationNotice: string;
  asiaSideNotice: string;
  serviceInfoTitle: string;
  serviceInfoParagraphs: [string, string];
  serviceInfoGroups: Array<{
    title: string;
    body: string;
  }>;
  voucherPickupInfoBody: string;
  outsideServiceAreaTitle: string;
  outsideServiceAreaBody: string;
  outsideServiceAreaDismiss: string;
  freeLabel: string;
  totalLabel: string;
  paxSectionLabel: string;
  applyTrip: string;
  clearSelections: string;
  needsParticipants: string;
  lockedTimeLabel: string;
  voucherServiceWindowLabel: string;
  voucherPaxHeading: string;
  voucherIncludedSectionTitle: string;
  voucherServiceInfoSectionTitle: string;
  voucherServiceInfoItems: string[];
  voucherCancelSectionTitle: string;
  voucherCancelBody: string;
  voucherOpsNotice: string;
  voucherAsiaNotice: string;
  voucherDurationNotice: string;
  categoryShort: Record<BosphorusPaxCategory, string>;
};

export const bosphorusDinnerCopy: Record<Locale, BosphorusDinnerCopy> = {
  tr: {
    heroDateHint:
      "Servis alış saati, konumunuza göre 19:00–20:00 arasında belirlenir.",
    dropoffLabel: "Bırakma noktası",
    servicePickupLabel: "Servis alış saati",
    servicePickupValue: BOSPHORUS_SERVICE_PICKUP_WINDOW,
    servicePickupNote:
      "Kesin alış saati konumunuza ve servis güzergâhına göre belirlenir. Yaklaşık 18:00 civarında kesin servis saati tarafınıza bildirilir.",
    packageTitle: "Boğaz'da Yemekli Gemi Turu & Türk Gecesi",
    selectContinue: "Devam Et",
    backToSelection: "‹ Geri",
    includedTitle: "Pakete dahil",
    included: [
      "Otelden/adresten gemiye servis",
      "Akşam yemeği",
      "Boğaz turu",
      "Türk gecesi",
      "Canlı müzik, dans ve gösteriler",
      "Tur sonunda otele/adrese dönüş servisi",
    ],
    opsNotice:
      "Servis alış saati konumunuza göre 19:00–20:00 arasında belirlenir.",
    opsNotifyAround18:
      "Kesin servis saati yaklaşık 18:00 civarında tarafınıza bildirilir.",
    durationNotice: "Boğaz turu ve gece programı yaklaşık 2,5 saat sürer.",
    asiaSideNotice:
      "Avrupa Yakası şehir merkezi ve şehir merkezine yakın bölgelerde gidiş-dönüş servis hizmeti tur ücretine dahildir. Avrupa Yakası’nda şehir merkezine uzak bölgeler ile Anadolu Yakası’ndaki alış ve/veya bırakma noktalarında ek transfer ücreti uygulanabilir.\n\nAlış ve/veya bırakma noktasının İstanbul Havalimanı (IST) veya Sabiha Gökçen Havalimanı (SAW) olması durumunda havalimanı transferi tur ücretine dahil değildir ve ayrıca ücretlendirilir. Transfer ücreti rezervasyonunuzun ardından operasyon ekibimiz tarafından tarafınıza bildirilecektir.",
    serviceInfoTitle: "Servis Bilgilendirmesi",
    serviceInfoParagraphs: [
      "Avrupa Yakası şehir merkezi ve şehir merkezine yakın bölgelerde gidiş-dönüş servis hizmeti tur ücretine dahildir. Avrupa Yakası’nda şehir merkezine uzak bölgeler ile Anadolu Yakası’ndaki alış ve/veya bırakma noktalarında ek transfer ücreti uygulanabilir.",
      "Alış ve/veya bırakma noktasının İstanbul Havalimanı (IST) veya Sabiha Gökçen Havalimanı (SAW) olması durumunda havalimanı transferi tur ücretine dahil değildir ve ayrıca ücretlendirilir. Transfer ücreti rezervasyonunuzun ardından operasyon ekibimiz tarafından tarafınıza bildirilecektir.",
    ],
    serviceInfoGroups: [
      {
        title: "Alış saati",
        body: "Gemi Kabataş’tan saat 20:30’da hareket eder. Kabataş’a varışınız 19:30–20:00 arasında olacak şekilde alış saatiniz konumunuza ve servis güzergâhına göre planlanır. Kesin alış saatiniz rezervasyon sonrasında bildirilir. Lütfen bildirilen saatte hazır olun.",
      },
      {
        title: "Servis kapsamı",
        body: "Avrupa Yakası şehir merkezi ve yakın bölgelerde gidiş-dönüş servis tur ücretine dahildir. Avrupa Yakası uzak bölgeler ve Anadolu Yakası için mesafeye göre ek transfer ücreti uygulanabilir.",
      },
      {
        title: "Havalimanı transferi",
        body: "Alış ve/veya bırakma noktası İstanbul Havalimanı (IST) veya Sabiha Gökçen Havalimanı (SAW) ise havalimanı transferi tur ücretine dahil değildir ve ayrıca ücretlendirilir. Yalnız bir yön havalimanı ise bir transfer, iki yön de havalimanı ise iki ayrı transfer ücreti uygulanır.",
      },
    ],
    voucherPickupInfoBody:
      "Gemi Kabataş’tan saat 20:30’da hareket eder. Yolcuların 19:30–20:00 arasında Kabataş’taki hareket noktasında bulunması gerekmektedir.\n\nAlış saatiniz, bulunduğunuz konum ve servis güzergâhına göre belirlenir. Kesin alış saatiniz rezervasyon sonrasında tarafınıza bildirilecektir. Lütfen bildirilen alış saatinde hazır olun; servis planlaması, sizi 19:30–20:00 arasında Kabataş’taki hareket noktasına ulaştıracak şekilde yapılır.",
    outsideServiceAreaTitle: "Hizmet bölgesi dışında",
    outsideServiceAreaBody:
      "Boğaz’da Yemekli Gemi Turu & Türk Gecesi hizmetimizde alış ve bırakma noktalarının İstanbul ili sınırları içerisinde olması gerekmektedir.\n\nİstanbul dışına ulaşım ihtiyacınız varsa, bu tur için İstanbul sınırları içerisinde uygun bir alış ve/veya bırakma noktası seçerek rezervasyonunuzu tamamlayabilirsiniz. İstanbul dışındaki yolculuğunuz için ayrıca Özel Transfer & Taksi hizmetimizden rezervasyon oluşturabilirsiniz.",
    outsideServiceAreaDismiss: "Tamam",
    freeLabel: "Ücretsiz",
    totalLabel: "Toplam",
    paxSectionLabel: "Katılımcılar",
    applyTrip: "Seçimleri Uygula",
    clearSelections: "Seçimleri Temizle",
    needsParticipants: "Devam etmek için en az bir katılımcı seçin.",
    lockedTimeLabel: "Saat",
    voucherServiceWindowLabel: "Servis alış aralığı",
    voucherPaxHeading: "Katılımcılar",
    voucherIncludedSectionTitle: "Pakete Dahil",
    voucherServiceInfoSectionTitle: "Servis Bilgilendirmesi",
    voucherServiceInfoItems: [
      "Avrupa Yakası şehir merkezi ve şehir merkezine yakın bölgelerde gidiş-dönüş servis hizmeti tur ücretine dahildir. Avrupa Yakası’nda şehir merkezine uzak bölgeler ile Anadolu Yakası’ndaki alış ve/veya bırakma noktalarında ek transfer ücreti uygulanabilir.",
      "Alış ve/veya bırakma noktasının İstanbul Havalimanı (IST) veya Sabiha Gökçen Havalimanı (SAW) olması durumunda havalimanı transferi tur ücretine dahil değildir ve ayrıca ücretlendirilir. Transfer ücreti rezervasyonunuzun ardından operasyon ekibimiz tarafından tarafınıza bildirilecektir.",
    ],
    voucherCancelSectionTitle: "İPTAL KOŞULLARI",
    voucherCancelBody:
      "Rezervasyon, hizmet başlangıç saatine 6 saatten fazla süre kaldığı sürece iptal edilebilir veya değiştirilebilir. İzin verilen süre içinde yapılan iptallerde ödenen ve henüz iade edilmemiş net tutarın %100’ü iade edilir.\n\nHizmet başlangıç saatine 6 saat veya daha az kaldığında iptal veya değişiklik kabul edilmez ve ücret iadesi yapılmaz.",
    voucherOpsNotice:
      "Kesin alış saati konumunuza ve servis güzergâhına göre belirlenir. Yaklaşık 18:00 civarında kesin servis saati ve araç/şoför bilgileri tarafınıza bildirilir.",
    voucherAsiaNotice:
      "Avrupa Yakası şehir merkezi ve şehir merkezine yakın bölgelerde gidiş-dönüş servis hizmeti tur ücretine dahildir. Avrupa Yakası’nda şehir merkezine uzak bölgeler ile Anadolu Yakası’ndaki alış ve/veya bırakma noktalarında ek transfer ücreti uygulanabilir. Alış ve/veya bırakma noktasının İstanbul Havalimanı (IST) veya Sabiha Gökçen Havalimanı (SAW) olması durumunda havalimanı transferi tur ücretine dahil değildir ve ayrıca ücretlendirilir.",
    voucherDurationNotice:
      "Boğaz turu ve gece programı yaklaşık 2,5 saat sürer.",
    categoryShort: {
      adultSoft: "Alkolsüz yetişkin (10+)",
      adultAlcohol: "Alkollü yetişkin (18+)",
      child5to9: "Çocuk (5–9)",
      child0to4: "Çocuk (0–4)",
    },
  },
  en: {
    heroDateHint:
      "Service pickup time is set between 19:00–20:00 based on your location.",
    dropoffLabel: "Drop-off location",
    servicePickupLabel: "Service pickup time",
    servicePickupValue: BOSPHORUS_SERVICE_PICKUP_WINDOW,
    servicePickupNote:
      "The exact pickup time is set according to your location and the service route. The confirmed pickup time is shared with you around 18:00.",
    packageTitle: "Bosphorus Dinner Cruise & Turkish Night Show",
    selectContinue: "Continue",
    backToSelection: "‹ Back",
    includedTitle: "Included",
    included: [
      "Hotel/address to ship transfer",
      "Dinner",
      "Bosphorus cruise",
      "Turkish night show",
      "Live music, dance and performances",
      "Return transfer to hotel/address after the tour",
    ],
    opsNotice:
      "Service pickup time is set between 19:00–20:00 based on your location.",
    opsNotifyAround18:
      "The confirmed pickup time is shared with you around 18:00.",
    durationNotice:
      "The Bosphorus cruise and evening programme last about 2.5 hours.",
    asiaSideNotice:
      "Round-trip service to and from central and near-central areas on the European Side is included in the tour price. Additional transfer fees may apply for pick-up and/or drop-off points in more distant European Side areas and on the Asian Side.\n\nIf the pick-up and/or drop-off point is Istanbul Airport (IST) or Sabiha Gökçen Airport (SAW), airport transfer is not included in the tour price and is charged separately. The transfer fee will be confirmed by our operations team after your reservation.",
    serviceInfoTitle: "Service information",
    serviceInfoParagraphs: [
      "Round-trip service to and from central and near-central areas on the European Side is included in the tour price. Additional transfer fees may apply for pick-up and/or drop-off points in more distant European Side areas and on the Asian Side.",
      "If the pick-up and/or drop-off point is Istanbul Airport (IST) or Sabiha Gökçen Airport (SAW), airport transfer is not included in the tour price and is charged separately. The transfer fee will be confirmed by our operations team after your reservation.",
    ],
    serviceInfoGroups: [
      {
        title: "Pickup time",
        body: "The boat departs from Kabataş at 20:30. Your pickup will be planned according to your location and the service route so that you arrive in Kabataş between 19:30 and 20:00. Your confirmed pickup time will be shared after your reservation. Please be ready at the time provided.",
      },
      {
        title: "Service coverage",
        body: "Round-trip service in central and nearby areas on the European Side is included in the tour price. An additional transfer fee based on distance may apply for distant European Side areas and the Asian Side.",
      },
      {
        title: "Airport transfer",
        body: "If the pickup and/or drop-off point is Istanbul Airport (IST) or Sabiha Gökçen Airport (SAW), airport transfer is not included in the tour price and is charged separately. One airport leg incurs one transfer fee; if both legs involve an airport, two separate transfer fees apply.",
      },
    ],
    voucherPickupInfoBody:
      "The boat departs from Kabataş at 20:30. Passengers must be at the departure point in Kabataş between 19:30 and 20:00.\n\nYour pickup time is determined according to your location and the service route. Your confirmed pickup time will be shared with you after your reservation. Please be ready at the stated pickup time; the service will be planned to bring you to the departure point in Kabataş between 19:30 and 20:00.",
    outsideServiceAreaTitle: "Outside the service area",
    outsideServiceAreaBody:
      "For the Bosphorus Dinner Cruise & Turkish Night Show, both pick-up and drop-off points must be within the provincial boundaries of Istanbul.\n\nIf you need transport outside Istanbul, please complete this tour reservation with suitable pick-up and/or drop-off points inside Istanbul. For travel outside Istanbul, you can make a separate reservation with our Private Transfer & Taxi service.",
    outsideServiceAreaDismiss: "OK",
    freeLabel: "Free",
    totalLabel: "Total",
    paxSectionLabel: "Participants",
    applyTrip: "Apply selections",
    clearSelections: "Clear selections",
    needsParticipants: "Select at least one participant to continue.",
    lockedTimeLabel: "Time",
    voucherServiceWindowLabel: "Service pickup window",
    voucherPaxHeading: "Participants",
    voucherIncludedSectionTitle: "Included in the package",
    voucherServiceInfoSectionTitle: "Service information",
    voucherServiceInfoItems: [
      "Round-trip service to and from central and near-central areas on the European Side is included in the tour price. Additional transfer fees may apply for pick-up and/or drop-off points in more distant European Side areas and on the Asian Side.",
      "If the pick-up and/or drop-off point is Istanbul Airport (IST) or Sabiha Gökçen Airport (SAW), airport transfer is not included in the tour price and is charged separately. The transfer fee will be confirmed by our operations team after your reservation.",
    ],
    voucherCancelSectionTitle: "CANCELLATION POLICY",
    voucherCancelBody:
      "The reservation may be cancelled or changed while more than 6 hours remain before the service start time. Cancellations made within this period receive a 100% refund of the net amount paid and not yet refunded.\n\nWhen 6 hours or less remain before the service start time, cancellation or changes are not accepted and no refund will be issued.",
    voucherOpsNotice:
      "The exact pickup time is set according to your location and the service route. Around 18:00 you will receive the confirmed pickup time and vehicle/driver details.",
    voucherAsiaNotice:
      "Round-trip service to and from central and near-central areas on the European Side is included in the tour price. Additional transfer fees may apply for pick-up and/or drop-off points in more distant European Side areas and on the Asian Side. If the pick-up and/or drop-off point is Istanbul Airport (IST) or Sabiha Gökçen Airport (SAW), airport transfer is not included in the tour price and is charged separately.",
    voucherDurationNotice:
      "The Bosphorus cruise and evening programme last about 2.5 hours.",
    categoryShort: {
      adultSoft: "Adult soft drink (10+)",
      adultAlcohol: "Adult alcoholic (18+)",
      child5to9: "Child (5–9)",
      child0to4: "Child (0–4)",
    },
  },
  ru: {
    heroDateHint:
      "Время подачи сервиса назначается между 19:00–20:00 в зависимости от вашего адреса.",
    dropoffLabel: "Место назначения",
    servicePickupLabel: "Время подачи сервиса",
    servicePickupValue: BOSPHORUS_SERVICE_PICKUP_WINDOW,
    servicePickupNote:
      "Точное время подачи определяется по вашему адресу и маршруту сервиса. Около 18:00 вам сообщат точное время подачи.",
    packageTitle: "Ужин-круиз по Босфору и турецкое шоу",
    selectContinue: "Продолжить",
    backToSelection: "‹ Назад",
    includedTitle: "Включено",
    included: [
      "Трансфер от отеля/адреса к кораблю",
      "Ужин",
      "Круиз по Босфору",
      "Турецкое вечернее шоу",
      "Живая музыка, танцы и представления",
      "Обратный трансфер в отель/адрес после тура",
    ],
    opsNotice:
      "Время подачи сервиса назначается между 19:00 и 20:00 в зависимости от адреса.",
    opsNotifyAround18:
      "Точное время подачи сообщается вам около 18:00.",
    durationNotice:
      "Круиз по Босфору и вечерняя программа длятся около 2,5 часов.",
    asiaSideNotice:
      "Трансфер туда-обратно из центральных и прилегающих к центру районов европейской стороны включён в стоимость тура. За точки посадки и/или высадки в более отдалённых районах европейской стороны, а также на азиатской стороне может взиматься дополнительная плата за трансфер.\n\nЕсли точка посадки и/или высадки — аэропорт Стамбула (IST) или аэропорт Сабиха Гёкчен (SAW), трансфер из/в аэропорт не включён в стоимость тура и оплачивается отдельно. Стоимость трансфера будет сообщена вам операционной командой после бронирования.",
    serviceInfoTitle: "Информация о сервисе",
    serviceInfoParagraphs: [
      "Трансфер туда-обратно из центральных и прилегающих к центру районов европейской стороны включён в стоимость тура. За точки посадки и/или высадки в более отдалённых районах европейской стороны, а также на азиатской стороне может взиматься дополнительная плата за трансфер.",
      "Если точка посадки и/или высадки — аэропорт Стамбула (IST) или аэропорт Сабиха Гёкчен (SAW), трансфер из/в аэропорт не включён в стоимость тура и оплачивается отдельно. Стоимость трансфера будет сообщена вам операционной командой после бронирования.",
    ],
    serviceInfoGroups: [
      {
        title: "Время подачи",
        body: "Судно отправляется из Кабаташа в 20:30. Время подачи будет запланировано с учётом вашего местонахождения и маршрута трансфера, чтобы вы прибыли в Кабаташ между 19:30 и 20:00. Точное время подачи будет сообщено после бронирования. Пожалуйста, будьте готовы к назначенному времени.",
      },
      {
        title: "Зона сервиса",
        body: "Трансфер туда и обратно в центральных и близлежащих районах европейской стороны включён в стоимость тура. Для удалённых районов европейской стороны и азиатской стороны может применяться дополнительная плата за трансфер в зависимости от расстояния.",
      },
      {
        title: "Трансфер из аэропорта",
        body: "Если место посадки и/или высадки — аэропорт Стамбула (IST) или Сабиха Гёкчен (SAW), трансфер из аэропорта не включён в стоимость тура и оплачивается отдельно. Если аэропорт указан только в одном направлении, взимается плата за один трансфер; если в обоих направлениях — за два отдельных трансфера.",
      },
    ],
    voucherPickupInfoBody:
      "Судно отправляется из Кабаташа в 20:30. Пассажиры должны находиться в точке отправления в Кабаташе между 19:30 и 20:00.\n\nВремя подачи определяется с учётом вашего местонахождения и маршрута трансфера. Точное время подачи будет сообщено вам после бронирования. Пожалуйста, будьте готовы к указанному времени; трансфер будет спланирован так, чтобы доставить вас к точке отправления в Кабаташе между 19:30 и 20:00.",
    outsideServiceAreaTitle: "Вне зоны обслуживания",
    outsideServiceAreaBody:
      "Для услуги «Ужин-круиз по Босфору и турецкое шоу» точки посадки и высадки должны находиться в пределах административных границ провинции Стамбул.\n\nЕсли вам нужен трансфер за пределы Стамбула, завершите бронирование этого тура с подходящими точками посадки и/или высадки внутри Стамбула. Для поездки за пределы Стамбула вы можете отдельно оформить бронирование услуги «Частный трансфер и такси».",
    outsideServiceAreaDismiss: "Понятно",
    freeLabel: "Бесплатно",
    totalLabel: "Итого",
    paxSectionLabel: "Участники",
    applyTrip: "Применить выбор",
    clearSelections: "Очистить выбор",
    needsParticipants: "Выберите хотя бы одного участника, чтобы продолжить.",
    lockedTimeLabel: "Время",
    voucherServiceWindowLabel: "Окно подачи сервиса",
    voucherPaxHeading: "Участники",
    voucherIncludedSectionTitle: "Включено в пакет",
    voucherServiceInfoSectionTitle: "Информация о сервисе",
    voucherServiceInfoItems: [
      "Трансфер туда-обратно из центральных и прилегающих к центру районов европейской стороны включён в стоимость тура. За точки посадки и/или высадки в более отдалённых районах европейской стороны, а также на азиатской стороне может взиматься дополнительная плата за трансфер.",
      "Если точка посадки и/или высадки — аэропорт Стамбула (IST) или аэропорт Сабиха Гёкчен (SAW), трансфер из/в аэропорт не включён в стоимость тура и оплачивается отдельно. Стоимость трансфера будет сообщена вам операционной командой после бронирования.",
    ],
    voucherCancelSectionTitle: "УСЛОВИЯ ОТМЕНЫ",
    voucherCancelBody:
      "Бронирование можно отменить или изменить, если до начала услуги остаётся больше 6 часов. При отмене в этот срок возвращается 100% оплаченной и ещё не возвращённой чистой суммы.\n\nЕсли до начала услуги осталось 6 часов или меньше, отмена и изменение не принимаются, и оплата не возвращается.",
    voucherOpsNotice:
      "Точное время подачи определяется по вашему адресу и маршруту сервиса. Около 18:00 вам сообщат точное время подачи и данные автомобиля/водителя.",
    voucherAsiaNotice:
      "Трансфер туда-обратно из центральных и прилегающих к центру районов европейской стороны включён в стоимость тура. За точки посадки и/или высадки в более отдалённых районах европейской стороны, а также на азиатской стороне может взиматься дополнительная плата за трансфер. Если точка посадки и/или высадки — аэропорт Стамбула (IST) или аэропорт Сабиха Гёкчен (SAW), трансфер из/в аэропорт не включён в стоимость тура и оплачивается отдельно.",
    voucherDurationNotice:
      "Круиз по Босфору и вечерняя программа длятся около 2,5 часов.",
    categoryShort: {
      adultSoft: "Взрослый безалкогольный (10+)",
      adultAlcohol: "Взрослый алкогольный (18+)",
      child5to9: "Ребёнок (5–9)",
      child0to4: "Ребёнок (0–4)",
    },
  },
};
