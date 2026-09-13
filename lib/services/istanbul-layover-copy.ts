import { type Locale } from "@/lib/i18n/config";

export type IstanbulLayoverCopy = {
  metaTitle: string;
  metaDescription: string;
  heroAlt: string;
  kicker: string;
  h1: string;
  heroLead: string;
  bookCta: string;
  howTitle: string;
  howLead: string;
  how: { title: string; text: string }[];
  placesTitle: string;
  placesLead: string;
  places: { title: string; text: string }[];
  placesNote: string;
  boatTitle: string;
  boat: string[];
  guideTitle: string;
  guide: { title: string; text: string }[];
  durationTitle: string;
  duration: string[];
  whoTitle: string;
  who: { title: string; text: string }[];
  scopeTitle: string;
  scope: { title: string; text: string }[];
  scopeNote: string;
  finalTitle: string;
  finalLead: string;
};

export const istanbulLayoverCopy: Record<Locale, IstanbulLayoverCopy> = {
  tr: {
    metaTitle: "İstanbul Aktarma Turu | İstanbul Havalimanı (IST) | Tripetica",
    metaDescription:
      "İstanbul Havalimanı’nda uzun aktarma için özel tur: havalimanından alım, kullanılabilir süreye göre planlanan İstanbul programı ve sonraki uçuş için dönüş transferi.",
    heroAlt: "İstanbul aktarma turu ve özel havalimanı transferi",
    kicker: "İstanbul Aktarma Turu",
    h1: "İstanbul Aktarma Turu – Bekleme Sürenizi İstanbul Deneyimine Dönüştürün",
    heroLead:
      "Uzun aktarma süresini İstanbul Havalimanı’nda bekleyerek geçirmek yerine kenti keşfedebilirsiniz. Program, iki uçuşunuz arasındaki kullanılabilir süreye göre planlanır. Hizmetin temelinde İstanbul Havalimanı’ndan alınmanız ve sonraki uçuşunuz için havalimanına geri dönüş transferi vardır.",
    bookCta: "Rezervasyon Yap",
    howTitle: "İstanbul Aktarma Turu Nasıl Çalışır?",
    howLead:
      "Her yolcuya aynı güzergâh uygulanmaz. Program, sonraki uçuş saatiniz ve kullanılabilir süreniz dikkate alınarak hazırlanır; kesin süre veya “mutlaka yetişirsiniz” vaadi verilmez.",
    how: [
      {
        title: "İstanbul Havalimanı’ndan alınma",
        text: "Karşılama İstanbul Havalimanı’nda (IST) planlanır.",
      },
      {
        title: "Kullanılabilir sürenin değerlendirilmesi",
        text: "İki uçuşunuz arasındaki gerçekten kullanılabilecek süre esas alınır.",
      },
      {
        title: "Programa göre planlama",
        text: "Süre, trafik ve tercihlerinize göre İstanbul güzergâhı şekillenir.",
      },
      {
        title: "Uygun noktaların ziyareti",
        text: "Tarihi, kültürel ve popüler duraklar zamana uygun seçilir.",
      },
      {
        title: "Rehber veya serbest keşif",
        text: "Talep ederseniz rehber ayarlanabilir; dilerseniz program içinde kenti kendi başınıza deneyimleyebilirsiniz.",
      },
      {
        title: "Son noktadan alınma",
        text: "Belirlenen saatte, üzerinde anlaşılan noktadan alınırsınız.",
      },
      {
        title: "Havalimanına dönüş",
        text: "Sonraki uçuşunuz için İstanbul Havalimanı’na transfer planlanır.",
      },
    ],
    placesTitle: "Aktarma Sürenize Göre İstanbul’u Keşfedin",
    placesLead:
      "Ziyaret edilebilecek noktalar iki uçuş arasındaki kullanılabilir süreye, trafik koşullarına ve tercihlerinize göre belirlenir. Aşağıdakiler olası durak örnekleridir; hepsinin aynı turda gezileceği anlamına gelmez.",
    places: [
      {
        title: "Sultanahmet Meydanı",
        text: "Tarihi Yarımada’nın merkezinde kısa bir durak için sık tercih edilir.",
      },
      {
        title: "Ayasofya çevresi",
        text: "Süre elverdiğinde meydan çevresinde kısa bir yürüyüş planlanabilir.",
      },
      {
        title: "Sultanahmet Camii çevresi",
        text: "Aynı bölgede, zamana bağlı olarak dışarıdan görülebilir.",
      },
      {
        title: "Tarihi Yarımada",
        text: "Kullanılabilir süreye göre birkaç durak bir arada düşünülebilir.",
      },
      {
        title: "Galata ve Karaköy",
        text: "Boğaz’a yakın, yürünebilir bir güzergâh için uygun olabilir.",
      },
      {
        title: "Eminönü",
        text: "Haliç ve çarşı çevresi, süre uygunsa programa eklenebilir.",
      },
      {
        title: "Boğaz kıyıları ve Ortaköy",
        text: "Trafik ve kalan zamana bağlı olarak kıyı güzergâhı tercih edilebilir.",
      },
    ],
    placesNote:
      "Daha uzun kullanılabilir sürede başka popüler İstanbul noktaları da değerlendirilebilir. Hangi durakların seçileceği uçuş saatlerinize ve o günkü koşullara bağlıdır.",
    boatTitle: "Boğaz deneyimi",
    boat: [
      "Aktarma süreniz yeterliyse ve operasyonel olarak uygunsa, talep ve müsaitliğe bağlı olarak özel tekneyle Boğaz deneyimi programa eklenebilir. Bu seçenek standart pakete otomatik dahil değildir ve her aktarmada gerçekleşeceği garanti edilmez.",
      "Ortaköy ve Boğaz kıyıları da süreye göre kara programına dahil edilebilir.",
    ],
    guideTitle: "İstanbul’u Rehberle veya Kendi Programınızla Keşfedin",
    guide: [
      {
        title: "Profesyonel rehber",
        text: "Talep üzerine turist rehberi ayarlanabilir. Rehber, standart pakete otomatik dahil değildir.",
      },
      {
        title: "Kendi keşfiniz",
        text: "Ulaşım ve zaman planı sağlanarak İstanbul’u kendi tercihlerinizle deneyimleyebilirsiniz.",
      },
    ],
    durationTitle: "Hangi Aktarma Süreleri İçin Uygun?",
    duration: [
      "Uygunluk, yalnızca “kaç saat aktarma var” sorusuna bağlı değildir. Uçuş saatleri, pasaport ve giriş işlemleri, İstanbul Havalimanı ile kent arasındaki yol, trafik ve görmek istediğiniz bölgeler kullanılabilir süreyi belirler.",
      "Aktarma süresi uzadıkça daha kapsamlı bir program düşünülebilir. Belirli bir saatte belirli bir durağın kesin gezileceği şeklinde bir tablo sunulmaz; plan her yolcu için o güne göre kurulur.",
    ],
    whoTitle: "Kimler İçin Uygun?",
    who: [
      {
        title: "Uzun aktarma",
        text: "İstanbul Havalimanı’nda iki uçuş arasında bekleyecek yolcular.",
      },
      {
        title: "Terminalde kalmak istemeyenler",
        text: "Bekleme süresini kentte değerlendirmek isteyen yolcular.",
      },
      {
        title: "İlk ziyaret",
        text: "Sınırlı sürede İstanbul’dan bir izlenim edinmek isteyenler.",
      },
      {
        title: "Zaman kontrollü program",
        text: "Sonraki uçuşa göre planlanmış, kişiselleştirilmiş bir güzergâh arayanlar.",
      },
    ],
    scopeTitle: "Hizmetin Kapsamı",
    scope: [
      {
        title: "Havalimanından alınma",
        text: "İstanbul Havalimanı’ndan (IST) karşılama.",
      },
      {
        title: "Kente ulaşım",
        text: "Kullanılabilir süreye uygun şekilde şehir yönüne gidiş.",
      },
      {
        title: "Kişiselleştirilmiş program",
        text: "İki uçuş arasındaki zamana göre planlanan güzergâh.",
      },
      {
        title: "Araçla ulaşım",
        text: "Program içindeki gerekli özel araç transferleri.",
      },
      {
        title: "Son noktadan alınma",
        text: "Anlaşılan saatte belirlenen noktadan alınma.",
      },
      {
        title: "Havalimanına dönüş",
        text: "Sonraki uçuş için İstanbul Havalimanı’na transfer.",
      },
    ],
    scopeNote:
      "Profesyonel rehber organizasyonu ve özel Boğaz teknesi talep, süre ve müsaitliğe bağlı seçeneklerdir. Müze girişleri, yemekler ve benzeri ekstra kalemler için bu sayfada fiyat veya “dahil” bilgisi verilmez.",
    finalTitle: "Uzun Aktarmanızı İstanbul Deneyimine Dönüştürün",
    finalLead:
      "Aktarma sürenize ve sonraki uçuş saatine göre kişiselleştirilmiş bir program planlanabilir. Rezervasyonda tarih ve saatinizi siz seçersiniz.",
  },
  en: {
    metaTitle: "Istanbul Layover Tour | Istanbul Airport (IST) | Tripetica",
    metaDescription:
      "Private Istanbul layover tour from Istanbul Airport: pickup, a programme timed to your usable connection, and a return transfer for your onward flight.",
    heroAlt: "Istanbul layover tour and private airport transfer",
    kicker: "Istanbul Layover Tour",
    h1: "Istanbul Layover Tour – Turn Waiting Time into an Istanbul Experience",
    heroLead:
      "Instead of spending a long airport layover in the terminal, you can see the city. The itinerary is planned around the usable time between your two flights. Pickup at Istanbul Airport and a return transfer for your onward departure are the core of the service.",
    bookCta: "Book Now",
    howTitle: "How the Istanbul Layover Tour Works",
    howLead:
      "This is not a fixed sightseeing circuit for every guest. The programme is built around your onward flight time and the hours you can actually use. We do not promise that you will always make a visit within a set number of minutes.",
    how: [
      {
        title: "Pickup at Istanbul Airport",
        text: "Meet-and-greet is arranged at Istanbul Airport (IST).",
      },
      {
        title: "Usable connection time",
        text: "Planning starts from the time you can realistically spend outside the airport.",
      },
      {
        title: "A programme shaped to that day",
        text: "Traffic, remaining hours and your preferences decide the route.",
      },
      {
        title: "Places that fit the window",
        text: "Historic and popular stops are chosen only if the schedule allows.",
      },
      {
        title: "Guide or independent exploring",
        text: "A professional guide can be arranged on request, or you can experience Istanbul on your own within the timed plan.",
      },
      {
        title: "Pickup from the last stop",
        text: "You are collected at the agreed time from the agreed place.",
      },
      {
        title: "Return to the airport",
        text: "Transfer back to Istanbul Airport is planned for your next flight.",
      },
    ],
    placesTitle: "Discover Istanbul Within Your Layover",
    placesLead:
      "Which places you can visit depends on the usable time between flights, traffic and your preferences. The areas below are examples, not a list of stops included on every Istanbul airport layover.",
    places: [
      {
        title: "Sultanahmet Square",
        text: "A common short stop in the Historic Peninsula when time is limited.",
      },
      {
        title: "Around Hagia Sophia",
        text: "A brief walk in the square area may be possible if the window allows.",
      },
      {
        title: "Around the Blue Mosque",
        text: "Often seen from the same district, depending on remaining time.",
      },
      {
        title: "Historic Peninsula",
        text: "Several nearby stops can be combined when the connection is longer.",
      },
      {
        title: "Galata and Karakoy",
        text: "A walkable area near the water, if traffic and hours allow.",
      },
      {
        title: "Eminonu",
        text: "The Golden Horn waterfront can be added when the schedule fits.",
      },
      {
        title: "Bosphorus shores and Ortakoy",
        text: "A coastal stretch may be included depending on traffic and time left.",
      },
    ],
    placesNote:
      "With a longer usable layover, other well-known parts of Istanbul may also be considered. Nothing is guaranteed as a fixed circuit.",
    boatTitle: "Bosphorus experience",
    boat: [
      "If your usable layover is long enough and operations allow, a private boat experience on the Bosphorus can be added on request and subject to availability. It is not included automatically and is not promised on every tour.",
      "Ortakoy and the Bosphorus shoreline can also form part of a land itinerary when time permits.",
    ],
    guideTitle: "Explore Istanbul with a Guide or on Your Own",
    guide: [
      {
        title: "Professional guide",
        text: "A tourist guide can be arranged on request. It is not included in the standard package by default.",
      },
      {
        title: "Your own pace",
        text: "Transport and timing can be provided while you experience the city in your own way.",
      },
    ],
    durationTitle: "Which Layovers Is This For?",
    duration: [
      "It is not only a matter of “how many hours you have”. Flight times, passport and entry procedures, the journey between Istanbul Airport and the city, traffic and the areas you hope to see all shape the usable window.",
      "A longer layover can allow a broader programme. We do not publish a chart that says a given stop is always possible in a given number of hours; each private layover tour is planned for that day.",
    ],
    whoTitle: "Who It Suits",
    who: [
      {
        title: "Long connections",
        text: "Travellers with a substantial wait at Istanbul Airport.",
      },
      {
        title: "Leaving the terminal",
        text: "Guests who prefer not to spend the whole layover airside.",
      },
      {
        title: "First visit",
        text: "Visitors who want a first impression of Istanbul in limited time.",
      },
      {
        title: "Timed programmes",
        text: "Anyone who wants a personalised plan built around the next flight.",
      },
    ],
    scopeTitle: "What the Service Covers",
    scope: [
      {
        title: "Airport pickup",
        text: "Collection at Istanbul Airport (IST).",
      },
      {
        title: "Into the city",
        text: "Travel towards town within the usable time.",
      },
      {
        title: "A timed itinerary",
        text: "A programme shaped to the gap between your flights.",
      },
      {
        title: "Private vehicle",
        text: "The car needed for the planned stops.",
      },
      {
        title: "Collection at the last stop",
        text: "Pickup at the agreed time and place.",
      },
      {
        title: "Return transfer",
        text: "Back to Istanbul Airport for your onward flight.",
      },
    ],
    scopeNote:
      "A professional guide and a private Bosphorus boat are optional, subject to request, time and availability. This page does not list prices or claim that museum tickets, meals or extras are included.",
    finalTitle: "Turn a Long Connection into Time in Istanbul",
    finalLead:
      "A programme can be shaped to your layover and onward flight. You choose the date and time when you book.",
  },
  ru: {
    metaTitle:
      "Тур при пересадке в Стамбуле | аэропорт IST | Tripetica",
    metaDescription:
      "Частный тур при пересадке в аэропорту Стамбула: встреча, программа по доступному времени между рейсами и трансфер обратно к следующему вылету.",
    heroAlt: "Тур при пересадке в Стамбуле и частный трансфер из аэропорта",
    kicker: "Тур при пересадке в Стамбуле",
    h1: "Тур при пересадке в Стамбуле — превратите ожидание в знакомство с городом",
    heroLead:
      "Вместо долгого ожидания в терминале аэропорта Стамбула можно увидеть город. Программа строится по времени, которое реально остаётся между двумя рейсами. Основа услуги — встреча в аэропорту и возвращение к следующему вылету.",
    bookCta: "Забронировать",
    howTitle: "Как проходит тур при пересадке в Стамбуле",
    howLead:
      "Это не один и тот же маршрут для всех. План учитывает время следующего рейса и доступные часы. Мы не обещаем, что за фиксированное число минут вы успеете в конкретную точку.",
    how: [
      {
        title: "Встреча в аэропорту Стамбула",
        text: "Подача планируется в аэропорту Стамбула (IST).",
      },
      {
        title: "Доступное время стыковки",
        text: "В расчёт берётся время, которое вы реально можете провести вне аэропорта.",
      },
      {
        title: "Программа на этот день",
        text: "Маршрут зависит от трафика, оставшихся часов и ваших пожеланий.",
      },
      {
        title: "Места, которые успеваете",
        text: "Исторические и популярные точки выбирают только если позволяет график.",
      },
      {
        title: "Гид или самостоятельный осмотр",
        text: "По запросу можно организовать гида либо осмотреть город самостоятельно в рамках тайминга.",
      },
      {
        title: "Подача в конечной точке",
        text: "Вас забирают в согласованное время в согласованном месте.",
      },
      {
        title: "Возвращение в аэропорт",
        text: "Трансфер в аэропорт Стамбула планируется к следующему рейсу.",
      },
    ],
    placesTitle: "Стамбул в рамках вашей пересадки",
    placesLead:
      "Какие места удастся увидеть, зависит от доступного времени между рейсами, трафика и ваших предпочтений. Ниже — примеры, а не обязательный список остановок каждой поездки.",
    places: [
      {
        title: "Площадь Султанахмет",
        text: "Частая короткая остановка в историческом центре, если времени немного.",
      },
      {
        title: "Окрестности Айя-Софии",
        text: "Короткая прогулка у площади возможна, если окно позволяет.",
      },
      {
        title: "Окрестности Голубой мечети",
        text: "Обычно в том же районе, в зависимости от оставшегося времени.",
      },
      {
        title: "Исторический полуостров",
        text: "При более длинной стыковке можно совместить несколько близких точек.",
      },
      {
        title: "Галата и Каракёй",
        text: "Пешеходный район у воды — если позволяют часы и дорога.",
      },
      {
        title: "Эминюню",
        text: "Набережная Золотого Рога может войти в план при подходящем графике.",
      },
      {
        title: "Берег Босфора и Ортакёй",
        text: "Прибрежный участок возможен в зависимости от трафика и остатка времени.",
      },
    ],
    placesNote:
      "При более длинной доступной пересадке можно рассмотреть и другие известные районы. Фиксированного обязательного маршрута нет.",
    boatTitle: "Босфор",
    boat: [
      "Если доступного времени достаточно и это операционно возможно, по запросу и при наличии мест в программу можно добавить прогулку на частном катере по Босфору. Это не входит в стандарт автоматически и не обещается в каждом туре.",
      "Ортакёй и набережная Босфора также могут стать частью наземного маршрута, если позволяет время.",
    ],
    guideTitle: "С гидом или самостоятельно",
    guide: [
      {
        title: "Профессиональный гид",
        text: "Гида можно организовать по запросу. В стандартный пакет он не входит по умолчанию.",
      },
      {
        title: "Свой темп",
        text: "Транспорт и тайминг обеспечиваются, а город вы смотрите так, как вам удобно.",
      },
    ],
    durationTitle: "Для каких стыковок это подходит?",
    duration: [
      "Дело не только в «количестве часов пересадки». Время рейсов, паспортный контроль, дорога из аэропорта Стамбула в город, трафик и желаемые районы определяют, сколько времени реально остаётся.",
      "Чем длиннее стыковка, тем шире может быть программа. Мы не публикуем таблицу «за N часов всегда вот эти места»: каждый тур при пересадке планируется на конкретный день.",
    ],
    whoTitle: "Кому это подходит",
    who: [
      {
        title: "Длинная стыковка",
        text: "Пассажиры, которые ждут следующий рейс в аэропорту Стамбула.",
      },
      {
        title: "Не оставаться в терминале",
        text: "Те, кто не хочет провести всю пересадку в зоне вылета.",
      },
      {
        title: "Первый визит",
        text: "Кто хочет за короткое время составить впечатление о Стамбуле.",
      },
      {
        title: "Контроль времени",
        text: "Кто ищет персональный маршрут с привязкой к следующему вылету.",
      },
    ],
    scopeTitle: "Что входит в услугу",
    scope: [
      {
        title: "Встреча в аэропорту",
        text: "Подача в аэропорту Стамбула (IST).",
      },
      {
        title: "Поездка в город",
        text: "Выезд в сторону центра в рамках доступного времени.",
      },
      {
        title: "Персональный план",
        text: "Маршрут под интервал между рейсами.",
      },
      {
        title: "Автомобиль",
        text: "Частный транспорт по запланированным остановкам.",
      },
      {
        title: "Подача в конце программы",
        text: "Встреча в согласованное время и месте.",
      },
      {
        title: "Обратный трансфер",
        text: "Возвращение в аэропорт Стамбула к следующему рейсу.",
      },
    ],
    scopeNote:
      "Гид и частный катер по Босфору — опции по запросу, времени и наличию. Цены и заявления о включённых билетах в музеи или питании на этой странице не приводятся.",
    finalTitle: "Превратите длинную стыковку в время в Стамбуле",
    finalLead:
      "Программу можно выстроить под длительность пересадки и время следующего рейса. Дату и час вы выбираете при бронировании.",
  },
  ar: {
    metaTitle: "جولة أثناء التوقف في إسطنبول | مطار إسطنبول (IST) | Tripetica",
    metaDescription:
      "جولة خاصة أثناء التوقف من مطار إسطنبول: استقبال، وبرنامج يُضبط وفق الوقت المتاح بين الرحلتين، ثم نقل للعودة إلى رحلتكم التالية.",
    heroAlt: "جولة أثناء التوقف في إسطنبول ونقل خاص من المطار",
    kicker: "جولة أثناء التوقف في إسطنبول",
    h1: "جولة أثناء التوقف في إسطنبول – حوّلوا وقت الانتظار إلى تجربة في المدينة",
    heroLead:
      "بدل قضاء توقف طويل في صالة المطار، يمكنكم رؤية المدينة. يُخطَّط البرنامج حول الوقت الذي يمكن استخدامه فعلاً بين رحلتَيكم. استقبالكم في مطار إسطنبول ونقل العودة قبل المغادرة التالية هما أساس الخدمة.",
    bookCta: "احجز الآن",
    howTitle: "كيف تعمل جولة أثناء التوقف في إسطنبول؟",
    howLead:
      "هذه ليست دائرة مشاهدة معالم ثابتة لكل ضيف. يُبنى البرنامج حول موعد رحلتكم التالية والساعات التي يمكنكم استخدامها فعلاً. لا نعد بأنكم ستدركون زيارة معيّنة خلال عدد ثابت من الدقائق.",
    how: [
      {
        title: "الاستقبال في مطار إسطنبول",
        text: "يُرتَّب الاستقبال في مطار إسطنبول (IST).",
      },
      {
        title: "الوقت المتاح بين الرحلتين",
        text: "يبدأ التخطيط من الوقت الذي يمكنكم قضاؤه واقعياً خارج المطار.",
      },
      {
        title: "برنامج يتشكّل وفق ذلك اليوم",
        text: "حركة المرور والساعات المتبقية وتفضيلاتكم هي ما يحدّد المسار.",
      },
      {
        title: "أماكن تناسب النافذة الزمنية",
        text: "تُختار التوقفات التاريخية والشائعة فقط إذا سمح الجدول.",
      },
      {
        title: "مرشد أو استكشاف مستقل",
        text: "يمكن ترتيب مرشد محترف عند الطلب، أو تجربة إسطنبول بأنفسكم ضمن الخطة الموقوتة.",
      },
      {
        title: "الاستلام من آخر توقف",
        text: "يُستقبَل بكم في الوقت والمكان المتفق عليهما.",
      },
      {
        title: "العودة إلى المطار",
        text: "يُخطَّط النقل إلى مطار إسطنبول لرحلتكم التالية.",
      },
    ],
    placesTitle: "اكتشفوا إسطنبول خلال توقفكم",
    placesLead:
      "تعتمد الأماكن التي يمكن زياراتها على الوقت المتاح بين الرحلتين وحركة المرور وتفضيلاتكم. المناطق أدناه أمثلة، وليست قائمة توقفات مشمولة في كل جولة أثناء التوقف من المطار.",
    places: [
      {
        title: "ساحة السلطان أحمد",
        text: "توقف قصير شائع في شبه الجزيرة التاريخية عندما يكون الوقت محدوداً.",
      },
      {
        title: "حول آيا صوفيا",
        text: "قد تكون نزهة قصيرة في منطقة الساحة ممكنة إذا سمحت النافذة الزمنية.",
      },
      {
        title: "حول الجامع الأزرق",
        text: "يُرى غالباً من الحي نفسه، وفق الوقت المتبقي.",
      },
      {
        title: "شبه الجزيرة التاريخية",
        text: "يمكن الجمع بين عدة توقفات قريبة عندما يكون التوقف أطول.",
      },
      {
        title: "غلطة وقراكوي",
        text: "منطقة قابلة للمشي قرب الماء، إذا سمحت حركة المرور والساعات.",
      },
      {
        title: "أمينونو",
        text: "يمكن إضافة كورنيش القرن الذهبي عندما يناسب الجدول.",
      },
      {
        title: "شواطئ البوسفور وأورتاكوي",
        text: "قد يُدرج مقطع ساحلي وفق حركة المرور والوقت المتبقي.",
      },
    ],
    placesNote:
      "مع توقف أطول يمكن النظر في أجزاء أخرى معروفة من إسطنبول. لا يُضمن مسار ثابت.",
    boatTitle: "تجربة البوسفور",
    boat: [
      "إذا كان توقفكم المتاح طويلاً بما يكفي وسمحت العمليات، يمكن إضافة تجربة قارب خاص في البوسفور عند الطلب وحسب التوفّر. ليست مشمولة تلقائياً ولا تُوعَد في كل جولة.",
      "يمكن أيضاً أن تشكّل أورتاكوي وشاطئ البوسفور جزءاً من برنامج بري عندما يسمح الوقت.",
    ],
    guideTitle: "استكشفوا إسطنبول مع مرشد أو بأنفسكم",
    guide: [
      {
        title: "مرشد محترف",
        text: "يمكن ترتيب مرشد سياحي عند الطلب. وهو غير مشمول في الحزمة القياسية افتراضياً.",
      },
      {
        title: "وتيرتكم الخاصة",
        text: "يمكن توفير النقل والتوقيت بينما تختبرون المدينة على طريقتكم.",
      },
    ],
    durationTitle: "لأي توقف تناسب هذه الجولة؟",
    duration: [
      "الأمر ليس مجرد «كم ساعة لديكم». مواعيد الرحلات وإجراءات الجوازات والدخول، والطريق بين مطار إسطنبول والمدينة، وحركة المرور والمناطق التي تأملون رؤيتها، كلها تشكّل النافذة المتاحة.",
      "التوقف الأطول قد يسمح ببرنامج أوسع. لا ننشر جدولاً يقول إن توقفاً معيّناً ممكن دائماً خلال عدد معيّن من الساعات؛ تُخطَّط كل جولة أثناء التوقف لذلك اليوم.",
    ],
    whoTitle: "لمن تناسب هذه الجولة؟",
    who: [
      {
        title: "توقفات طويلة",
        text: "مسافرون لديهم انتظار طويل في مطار إسطنبول.",
      },
      {
        title: "مغادرة الصالة",
        text: "ضيوف يفضّلون ألا يقضوا كامل التوقف داخل المطار.",
      },
      {
        title: "الزيارة الأولى",
        text: "زوّار يريدون انطباعاً أول عن إسطنبول في وقت محدود.",
      },
      {
        title: "برامج موقوتة",
        text: "من يريد خطة مخصّصة مبنية حول الرحلة التالية.",
      },
    ],
    scopeTitle: "ما الذي تغطيه الخدمة؟",
    scope: [
      {
        title: "الاستقبال من المطار",
        text: "الاستلام في مطار إسطنبول (IST).",
      },
      {
        title: "التوجّه إلى المدينة",
        text: "السفر نحو المدينة ضمن الوقت المتاح.",
      },
      {
        title: "برنامج موقوت",
        text: "خطة تتشكّل وفق الفجوة بين رحلتَيكم.",
      },
      {
        title: "سيارة خاصة",
        text: "السيارة اللازمة للتوقفات المخطَّطة.",
      },
      {
        title: "الاستلام من آخر توقف",
        text: "الاستقبال في الوقت والمكان المتفق عليهما.",
      },
      {
        title: "نقل العودة",
        text: "العودة إلى مطار إسطنبول لرحلتكم التالية.",
      },
    ],
    scopeNote:
      "المرشد المحترف وقارب البوسفور الخاص خياران اختياريان، وفق الطلب والوقت والتوفّر. لا تسرد هذه الصفحة أسعاراً ولا تدّعي شمول تذاكر المتاحف أو الوجبات أو الإضافات.",
    finalTitle: "حوّلوا التوقف الطويل إلى وقت في إسطنبول",
    finalLead:
      "يمكن تشكيل برنامج وفق توقفكم ورحلتكم التالية. أنتم تختارون التاريخ والوقت عند الحجز.",
  },
};
