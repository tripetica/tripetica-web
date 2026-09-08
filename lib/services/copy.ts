import { type Locale } from "@/lib/i18n/config";
import { type ServiceId } from "@/lib/services/catalog";

export type ServiceCardCopy = {
  title: string;
  description: string;
  bookCta?: string;
  quoteCta?: string;
  viewDetails?: string;
  imageAlt?: string;
};

export type HomeServicesCopy = {
  label: string;
  heading: string;
  intro: string;
  viewDetails: string;
  cards: Record<ServiceId, ServiceCardCopy>;
};

export const homeServicesCopy: Record<Locale, HomeServicesCopy> = {
  ru: {
    label: "НАШИ УСЛУГИ",
    heading:
      "Трансфер и такси из аэропорта, услуги с водителем и частные туры",
    intro:
      "Предлагаем частный трансфер и такси из аэропорта Стамбула (IST), аэропорта Сабиха Гёкчен (SAW), аэропорта Антальи (AYT) и других аэропортов по всей Турции, а также почасовые услуги автомобиля с водителем, междугородние трансферы, экскурсии по Стамбулу и индивидуальные туры.",
    viewDetails: "Подробнее",
    cards: {
      "airport-transfer": {
        title: "Трансфер и такси из аэропорта",
        description:
          "Частный трансфер и такси из аэропорта Стамбула (IST), аэропорта Сабиха Гёкчен (SAW), аэропорта Антальи (AYT) и других аэропортов по всей Турции. Профессиональные водители, фиксированная цена, отслеживание рейса и поддержка 24/7 для трансферов в отель, по городу и между городами.",
        bookCta: "Забронировать трансфер",
        viewDetails: "Подробнее",
        imageAlt: "Частный трансфер из аэропорта на автомобиле Tripetica",
      },
      "hourly-chauffeur": {
        title: "Почасовой автомобиль с водителем",
        description:
          "Профессиональный почасовой автомобиль с водителем в Стамбуле, Анталье и по всей Турции — для деловых встреч, шопинга и поездок по гибкому графику.",
        bookCta: "Забронировать",
        viewDetails: "Подробнее",
        imageAlt: "Почасовой автомобиль с водителем Tripetica",
      },
      "istanbul-city-tour": {
        title: "Обзорная экскурсия по Стамбулу",
        description:
          "Откройте для себя исторические и знаковые места Стамбула на частном автомобиле с водителем. Выберите 6-часовую программу на полдня или 10-часовую программу на целый день; маршрут может включать Султанахмет, Айя-Софию, мечеть Сулеймание и Босфор. По желанию поездка может быть организована с профессиональным лицензированным гидом или без гида.",
        bookCta: "Забронировать",
        viewDetails: "Подробнее",
        imageAlt: "Обзорная экскурсия по Стамбулу на частном автомобиле с водителем",
      },
      "istanbul-layover-tour": {
        title: "Тур при пересадке в Стамбуле",
        description:
          "Для пассажиров с длинной стыковкой: трансфер из аэропорта, экскурсия по Стамбулу с учётом времени рейса и возвращение в аэропорт перед следующим вылетом.",
        bookCta: "Забронировать",
        viewDetails: "Подробнее",
        imageAlt: "Тур при пересадке в Стамбуле и частный трансфер из аэропорта",
      },
      "istanbul-bosphorus-dinner-cruise": {
        title: "Круиз по Босфору с ужином и турецким шоу",
        description:
          "Вечерний круиз по Босфору: ужин на борту, живая музыка и традиционное турецкое шоу на фоне ночных огней Стамбула.",
        bookCta: "Забронировать",
        viewDetails: "Подробнее",
        imageAlt: "Круиз по Босфору с ужином и турецким шоу в Стамбуле",
      },
      "sapanca-tour": {
        title: "Тур в Сапанджу",
        description:
          "Откройте для себя природу Сапанджи во время индивидуальной поездки из Стамбула на автомобиле с водителем. Озеро Сапанджа, Машукие и природные достопримечательности региона — маршрут можно спланировать с учетом ваших пожеланий.",
        bookCta: "Забронировать",
        viewDetails: "Подробнее",
        imageAlt: "Озеро Сапанджа, Машукие и индивидуальный тур в Сапанджу",
      },
      "bursa-tour": {
        title: "Тур в Бурсу",
        description:
          "Индивидуальный тур в Бурсу из Стамбула на автомобиле с водителем: исторический центр, мечеть Улу-джами и Улудаг. Поездка на один день или программа с ночёвкой — по вашему запросу.",
        bookCta: "Забронировать",
        viewDetails: "Подробнее",
        imageAlt: "Индивидуальный тур в Бурсу из Стамбула: Улу-джами и Улудаг",
      },
      "private-turkey-tours": {
        title: "Индивидуальные туры по Турции",
        description:
          "Каппадокия, Памуккале, Гёбеклитепе и другие направления — индивидуальные маршруты по Турции, в том числе по нескольким городам. Расскажите свой план поездки, и мы подготовим персональное предложение.",
        quoteCta: "Получить предложение",
        viewDetails: "Подробнее",
        imageAlt:
          "Индивидуальные туры по Турции: Каппадокия, Памуккале, Гёбеклитепе, Эфес и другие направления",
      },
    },
  },
  en: {
    label: "OUR SERVICES",
    heading:
      "Airport Transfer & Taxi, Chauffeur Services and Private Tours",
    intro:
      "Private airport transfer and taxi services from Istanbul Airport (IST), Sabiha Gokcen Airport (SAW), Antalya Airport (AYT) and airports across Turkey, together with hourly chauffeur service, intercity transfers, Istanbul city tours and personalized private tours.",
    viewDetails: "View Details",
    cards: {
      "airport-transfer": {
        title: "Airport Transfer & Taxi",
        description:
          "Private airport transfer and taxi services from Istanbul Airport (IST), Sabiha Gokcen Airport (SAW), Antalya Airport (AYT) and airports across Turkey. Professional drivers, fixed prices, flight tracking and 24/7 support for airport-to-hotel, city and intercity transfers.",
        bookCta: "Book Transfer",
        viewDetails: "View Details",
        imageAlt: "Tripetica private airport transfer vehicle",
      },
      "hourly-chauffeur": {
        title: "Hourly Chauffeur Service",
        description:
          "Professional hourly chauffeur service in Istanbul, Antalya and across Turkey for business, meetings, shopping or flexible travel schedules.",
        bookCta: "Book Now",
        viewDetails: "View Details",
        imageAlt: "Tripetica hourly chauffeur-driven vehicle",
      },
      "istanbul-city-tour": {
        title: "Istanbul City Tour",
        description:
          "Discover Istanbul’s historic and iconic landmarks with a private car and chauffeur. Choose a 6-hour half-day or 10-hour full-day tour, with an itinerary that can include Sultanahmet, Hagia Sophia, Süleymaniye Mosque and the Bosphorus. Travel independently or add a licensed professional tour guide for a guided experience.",
        bookCta: "Book Now",
        viewDetails: "View Details",
        imageAlt: "Istanbul city tour with private car and chauffeur",
      },
      "istanbul-layover-tour": {
        title: "Istanbul Layover Tour",
        description:
          "A private tour for travellers with a long connection: airport pickup, an Istanbul itinerary timed to your flights, and a return transfer before your onward departure.",
        bookCta: "Book Now",
        viewDetails: "View Details",
        imageAlt: "Istanbul layover tour and private airport transfer",
      },
      "istanbul-bosphorus-dinner-cruise": {
        title: "Bosphorus Dinner Cruise & Turkish Night Show",
        description:
          "Enjoy an unforgettable evening in Istanbul with a Bosphorus dinner cruise, dinner, live music and traditional Turkish performances against the city’s illuminated night skyline.",
        bookCta: "Book Now",
        viewDetails: "View Details",
        imageAlt: "Bosphorus dinner cruise and Turkish night show in Istanbul",
      },
      "sapanca-tour": {
        title: "Sapanca Tour",
        description:
          "Discover the natural beauty of Sapanca on a private day tour from Istanbul with your own vehicle and chauffeur. Explore Sapanca Lake, Masukiye and the surrounding countryside with a flexible itinerary planned around you.",
        bookCta: "Book Now",
        viewDetails: "View Details",
        imageAlt: "Sapanca Lake, Masukiye and private Sapanca day tour",
      },
      "bursa-tour": {
        title: "Bursa Tour",
        description:
          "A private Bursa tour from Istanbul with your own vehicle and chauffeur. See historic Bursa, the Grand Mosque (Ulu Cami) and Uludağ as a day trip, or ask for an overnight custom itinerary.",
        bookCta: "Book Now",
        viewDetails: "View Details",
        imageAlt: "Private Bursa tour from Istanbul with the Grand Mosque and Uludağ",
      },
      "private-turkey-tours": {
        title: "Private Tours Across Türkiye",
        description:
          "Private tours across Türkiye — Cappadocia, Pamukkale, Göbeklitepe and beyond — with a custom itinerary that can cover more than one destination. Share your travel plan and we will prepare a tailored offer.",
        quoteCta: "Get a Quote",
        viewDetails: "View Details",
        imageAlt:
          "Private tours across Türkiye including Cappadocia, Pamukkale, Göbeklitepe, Ephesus and other destinations",
      },
    },
  },
  tr: {
    label: "HİZMETLERİMİZ",
    heading:
      "Havalimanı Transferi, Şoförlü Araç ve Özel Tur Hizmetleri",
    intro:
      "İstanbul Havalimanı (IST), Sabiha Gökçen Havalimanı (SAW), Antalya Havalimanı (AYT) ve Türkiye genelinde özel havalimanı transferi, saatlik şoförlü araç, şehirler arası transfer, İstanbul şehir turu ve kişiye özel tur hizmetleri sunuyoruz.",
    viewDetails: "Detayları Gör",
    cards: {
      "airport-transfer": {
        title: "Havalimanı Özel Transferi",
        description:
          "İstanbul Havalimanı (IST), Sabiha Gökçen Havalimanı (SAW), Antalya Havalimanı (AYT) ve Türkiye genelindeki havalimanlarından özel transfer hizmeti. Havalimanı-otel, şehir içi ve şehirler arası transferlerde profesyonel şoförler, sabit fiyat, uçuş takibi ve 7/24 destek ile güvenli ve konforlu ulaşım.",
        bookCta: "Rezervasyon Yap",
        viewDetails: "Detayları Gör",
        imageAlt: "Tripetica özel havalimanı transfer aracı",
      },
      "hourly-chauffeur": {
        title: "Saatlik Şoförlü Araç",
        description:
          "İstanbul, Antalya ve Türkiye genelinde; iş, toplantı, alışveriş veya esnek programlarınız için profesyonel saatlik şoförlü özel araç hizmeti.",
        bookCta: "Rezervasyon Yap",
        viewDetails: "Detayları Gör",
        imageAlt: "Tripetica saatlik şoförlü özel araç hizmeti",
      },
      "istanbul-city-tour": {
        title: "İstanbul Şehir Turu",
        description:
          "İstanbul’un tarihi ve simgesel noktalarını özel araç ve şoförle keşfedin. 6 saatlik yarım gün veya 10 saatlik tam gün tur seçenekleriyle; Sultanahmet, Ayasofya, Süleymaniye Camii ve Boğaz gibi rotalar programınıza göre planlanabilir. Dilerseniz profesyonel kokartlı turist rehberi eşliğinde, dilerseniz rehbersiz seyahat edin.",
        bookCta: "Rezervasyon Yap",
        viewDetails: "Detayları Gör",
        imageAlt: "İstanbul şehir turu özel araç ve şoförlü gezi",
      },
      "istanbul-layover-tour": {
        title: "İstanbul Aktarma Turu",
        description:
          "Uzun aktarma süresini İstanbul’u keşfederek değerlendirmek isteyen yolcular için; havalimanından alım, uçuş saatine göre planlanan İstanbul turu ve sonraki uçuş öncesi havalimanına dönüş transferini kapsayan özel tur hizmeti.",
        bookCta: "Rezervasyon Yap",
        viewDetails: "Detayları Gör",
        imageAlt: "İstanbul aktarma turu ve özel havalimanı transferi",
      },
      "istanbul-bosphorus-dinner-cruise": {
        title: "Boğaz’da Akşam Yemeği Tekne Turu",
        description:
          "Boğaz’ın eşsiz gece manzarası eşliğinde tekne turu, akşam yemeği, canlı müzik ve geleneksel gösterilerle İstanbul’da unutulmaz bir gece deneyimi.",
        bookCta: "Rezervasyon Yap",
        viewDetails: "Detayları Gör",
        imageAlt: "Boğaz’da akşam yemeği tekne turu ve Türk gecesi",
      },
      "sapanca-tour": {
        title: "Sapanca Turu",
        description:
          "İstanbul’dan özel araç ve şoförle Sapanca’nın doğasını keşfedin. Sapanca Gölü, Maşukiye ve bölgenin doğal güzelliklerini kapsayan günübirlik turunuzu size özel planlayın.",
        bookCta: "Rezervasyon Yap",
        viewDetails: "Detayları Gör",
        imageAlt: "Sapanca Gölü, Maşukiye ve Sapanca doğa turu",
      },
      "bursa-tour": {
        title: "Bursa Turu",
        description:
          "İstanbul’dan özel araç ve şoförle Bursa’yı keşfedin. Tarihî Bursa, Ulu Cami, Uludağ ve şehrin öne çıkan noktalarını kapsayan turunuzu günübirlik veya isteğinize göre konaklamalı özel program olarak planlayın.",
        bookCta: "Rezervasyon Yap",
        viewDetails: "Detayları Gör",
        imageAlt: "İstanbul çıkışlı özel Bursa turu, Ulu Cami ve Uludağ",
      },
      "private-turkey-tours": {
        title: "Türkiye Özel Turları",
        description:
          "Kapadokya, Pamukkale, Göbeklitepe ve Türkiye'nin daha birçok özel destinasyonunu size özel planlanan rotalarla keşfedin. Gitmek istediğiniz yerleri ve seyahat planınızı bize anlatın, size özel tur ve ulaşım teklifi hazırlayalım.",
        quoteCta: "Teklif Al",
        viewDetails: "Detayları Gör",
        imageAlt:
          "Türkiye özel turları, Kapadokya, Pamukkale, Göbeklitepe, Efes ve farklı destinasyonlar",
      },
    },
  },
};
