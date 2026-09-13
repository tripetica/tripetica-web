import { type Locale } from "@/lib/i18n/config";

export type AirportTransferFaq = {
  question: string;
  answer: string;
};

export type AirportTransferCopy = {
  metaTitle: string;
  metaDescription: string;
  heroAlt: string;
  kicker: string;
  h1: string;
  heroLead: string;
  bookCta: string;
  overviewTitle: string;
  overview: string[];
  scopes: { title: string; text: string }[];
  airportsTitle: string;
  airportsLead: string;
  airports: { code: "IST" | "SAW" | "AYT"; name: string; text: string }[];
  airportsNote: string;
  routesTitle: string;
  routeGroups: { heading: string; routes: string[] }[];
  cityTitle: string;
  city: string[];
  intercityTitle: string;
  intercity: string[];
  whyTitle: string;
  why: { title: string; text: string }[];
  howTitle: string;
  how: string[];
  faqTitle: string;
  faqs: AirportTransferFaq[];
  finalTitle: string;
  finalLead: string;
};

export const airportTransferCopy: Record<Locale, AirportTransferCopy> = {
  tr: {
    metaTitle:
      "Özel Havalimanı Transferi | İstanbul, Antalya ve Türkiye | Tripetica",
    metaDescription:
      "İstanbul Havalimanı, Sabiha Gökçen ve Antalya Havalimanı başta olmak üzere Türkiye genelinde özel havalimanı, şehir içi ve şehirler arası transfer hizmetleri. Sabit fiyat ve 7/24 destek.",
    heroAlt:
      "Havalimanı terminali önünde özel transfer için bekleyen şoförlü araç",
    kicker: "Havalimanı Transferi",
    h1: "Özel Havalimanı Transferi – İstanbul, Antalya ve Türkiye Geneli",
    heroLead:
      "İstanbul Havalimanı (IST), Sabiha Gökçen Havalimanı (SAW), Antalya Havalimanı (AYT) ve Türkiye genelindeki havalimanlarından otelinize, şehir merkezine veya farklı bir şehre profesyonel şoförlü özel transfer hizmeti.",
    bookCta: "Rezervasyon Yap",
    overviewTitle: "Özel havalimanı transferi nasıl çalışır?",
    overview: [
      "Tripetica; İstanbul, Antalya ve Türkiye genelinde özel havalimanı transferi sunar. İstanbul Havalimanı (IST), Sabiha Gökçen Havalimanı (SAW), Antalya Havalimanı (AYT) ve diğer havalimanlarından otelinize, evinize, şehir merkezine veya başka bir şehirdeki varış noktanıza ulaşımı önceden planlayabilirsiniz.",
      "Hizmet yalnızca havalimanı ile otel arasında sınırlı değildir. Aynı rezervasyon akışıyla havalimanı transferleri, şehir içi özel transfer ve şehirler arası özel transfer için güzergâhınızı seçip uygun araç seçeneklerini görüntüleyebilirsiniz.",
    ],
    scopes: [
      {
        title: "Havalimanı transferleri",
        text: "Havalimanından otele transfer ve otelden havalimanına transfer dahil olmak üzere, uçuşunuza göre planlanan özel havalimanı transferi.",
      },
      {
        title: "Şehir içi transfer",
        text: "Otel, restoran, toplantı, tarihi bölge veya başka bir adres arasında şehir içi özel transfer.",
      },
      {
        title: "Şehirler arası transfer",
        text: "İstanbul, Antalya ve Türkiye genelinde uygun güzergâhlarda profesyonel şoförlü şehirler arası özel transfer.",
      },
    ],
    airportsTitle: "Türkiye’de Havalimanı Transfer Hizmetleri",
    airportsLead:
      "En sık talep edilen noktalar İstanbul ve Antalya havalimanlarıdır; rezervasyon Türkiye genelindeki diğer havalimanları için de açılabilir.",
    airports: [
      {
        code: "IST",
        name: "İstanbul Havalimanı (IST)",
        text: "İstanbul Havalimanı transferi ile Avrupa yakasındaki otellere, Taksim ve Sultanahmet çevresine veya şehir merkezine özel transfer planlayabilirsiniz. İstanbul Havalimanı’ndan otele ulaşım, uçuş saatinize göre ayarlanır.",
      },
      {
        code: "SAW",
        name: "Sabiha Gökçen Havalimanı (SAW)",
        text: "Sabiha Gökçen Havalimanı transferi Anadolu yakası ve Avrupa yakası varış noktalarını kapsar. Sabiha Gökçen’den şehir merkezine transfer, Kadıköy veya Taksim gibi sık kullanılan güzergâhlarda talep edilebilir.",
      },
      {
        code: "AYT",
        name: "Antalya Havalimanı (AYT)",
        text: "Antalya Havalimanı transferi şehir merkezi, Lara ve sahil bölgelerine özel ulaşım için kullanılır. Antalya Havalimanı’ndan Belek’e transfer veya Side’ye ulaşım gibi güzergâhlar aynı hizmet kapsamında rezerve edilebilir.",
      },
    ],
    airportsNote:
      "Tripetica yalnızca bu üç havalimanıyla sınırlı değildir. Türkiye genelindeki diğer havalimanlarından da özel transfer rezervasyonu yapılabilir; güzergâhınızı rezervasyon formunda kendiniz seçersiniz.",
    routesTitle: "Popüler Transfer Güzergâhları",
    routeGroups: [
      {
        heading: "İstanbul Havalimanı (IST)",
        routes: [
          "İstanbul Havalimanı → Taksim",
          "İstanbul Havalimanı → Sultanahmet",
          "İstanbul Havalimanı → Beşiktaş",
          "İstanbul Havalimanı → Şişli",
          "İstanbul Havalimanı → Kadıköy",
          "İstanbul Havalimanı → İstanbul şehir merkezi",
        ],
      },
      {
        heading: "Sabiha Gökçen Havalimanı (SAW)",
        routes: [
          "Sabiha Gökçen Havalimanı → Kadıköy",
          "Sabiha Gökçen Havalimanı → Taksim",
          "Sabiha Gökçen Havalimanı → Sultanahmet",
          "Sabiha Gökçen Havalimanı → İstanbul şehir merkezi",
        ],
      },
      {
        heading: "Antalya Havalimanı (AYT)",
        routes: [
          "Antalya Havalimanı → Antalya şehir merkezi",
          "Antalya Havalimanı → Lara",
          "Antalya Havalimanı → Belek",
          "Antalya Havalimanı → Kemer",
          "Antalya Havalimanı → Side",
          "Antalya Havalimanı → Alanya",
        ],
      },
    ],
    cityTitle: "Şehir İçi Özel Transfer",
    city: [
      "Havalimanı dışında, aynı şehir içindeki iki nokta arasında da özel transfer rezervasyonu yapabilirsiniz. Otelden restorana, toplantıya, turistik bir bölgeye veya başka bir otele gidiş gibi kısa şehir içi transferler bu kapsamdadır.",
      "Adresten adrese şehir içi özel transfer, günün belirli saatlerinde tek yön ihtiyaçlarınız için havalimanı transferiyle aynı rezervasyon formundan planlanır. Alış ve varış noktalarını siz seçersiniz.",
    ],
    intercityTitle: "Şehirler Arası Özel Transfer",
    intercity: [
      "Daha uzun mesafelerde Tripetica, profesyonel şoförlü şehirler arası özel transfer sunar. Sık sorulan örnekler arasında İstanbul – Bursa, İstanbul – Sapanca, İstanbul – İzmit ile Antalya – Alanya, Antalya – Belek, Antalya – Kemer ve Antalya – Side yer alır.",
      "Bu liste şirketin yalnızca bu güzergâhlarda çalıştığı anlamına gelmez. Türkiye genelinde uygun güzergâhlarda şehirler arası transfer sağlanabilir; rezervasyonda kendi varış noktanızı belirtmeniz yeterlidir.",
    ],
    whyTitle: "Neden Tripetica?",
    why: [
      {
        title: "Sabit fiyat",
        text: "Görüntülediğiniz fiyat üzerinden ilerlersiniz; rezervasyon sonrası sürpriz zam uygulanmaz.",
      },
      {
        title: "Gizli ücret yok",
        text: "Hizmet bedeli önceden nettir. Gizli ücret eklenmez.",
      },
      {
        title: "Nakit ödeme",
        text: "Transfer ücretini nakit ödeme seçeneğiyle karşılayabilirsiniz.",
      },
      {
        title: "Ücretsiz iptal",
        text: "Planınız değişirse ücretsiz iptal koşullarımız geçerlidir.",
      },
      {
        title: "7/24 destek",
        text: "Uçuş saati fark etmeksizin destek hattımız günün her saati ulaşılabilir.",
      },
      {
        title: "Profesyonel şoförler",
        text: "Karşılama ve yolculuk, yerel güzergâhı bilen profesyonel şoförlerle yapılır.",
      },
      {
        title: "Özel araç",
        text: "Paylaşımlı servis yerine size özel araçla seyahat edersiniz.",
      },
      {
        title: "Uçuş takibi",
        text: "Havalimanı transferlerinde uçuş bilgisine göre planlama yapılır.",
      },
    ],
    howTitle: "Nasıl çalışır?",
    how: [
      "Güzergâhınızı seçin",
      "Tarih ve saatinizi belirleyin",
      "Uygun araç seçeneklerini görüntüleyin",
      "Rezervasyonunuzu tamamlayın",
      "Transfer bilgilerinizi alın",
    ],
    faqTitle: "Sıkça sorulan sorular",
    faqs: [
      {
        question: "Havalimanı transferi nasıl rezervasyon yapılır?",
        answer:
          "Ana sayfadaki rezervasyon formunda özel transfer hizmetini seçin, alış ve varış noktalarınızı girin, tarih ve saati belirleyin ve uygun araç seçeneklerini görüntüleyin.",
      },
      {
        question: "Transfer fiyatı rezervasyondan sonra değişir mi?",
        answer:
          "Hayır. Tripetica sabit fiyat sunar; gizli ücret uygulanmaz. Rezervasyonda gördüğünüz fiyat üzerinden ilerlersiniz.",
      },
      {
        question: "Uçağım gecikirse ne olur?",
        answer:
          "Havalimanı transferlerinde uçuş takibi yapılır. Gecikme durumunda planlama uçuş bilgisine göre güncellenir; 7/24 destek hattımız da yardımcı olur.",
      },
      {
        question:
          "İstanbul Havalimanı’ndan şehir merkezine transfer rezervasyonu yapabilir miyim?",
        answer:
          "Evet. İstanbul Havalimanı özel transferi ile şehir merkezine, otele veya sizin belirlediğiniz başka bir adrese ulaşım rezerve edilebilir.",
      },
      {
        question: "Sabiha Gökçen Havalimanı’ndan transfer hizmeti var mı?",
        answer:
          "Evet. Sabiha Gökçen Havalimanı transferi ile Kadıköy, Taksim, Sultanahmet, şehir merkezi ve diğer varış noktalarına özel transfer planlayabilirsiniz.",
      },
      {
        question:
          "Antalya Havalimanı’ndan Belek, Side, Kemer ve Alanya’ya transfer var mı?",
        answer:
          "Evet. Antalya Havalimanı’ndan Belek, Side, Kemer, Alanya, Lara ve şehir merkezine özel transfer rezervasyonu yapılabilir.",
      },
      {
        question: "Şehirler arası transfer rezervasyonu yapabilir miyim?",
        answer:
          "Evet. İstanbul – Bursa veya Antalya – Alanya gibi örneklerin yanı sıra Türkiye genelinde uygun güzergâhlarda şehirler arası özel transfer açılabilir.",
      },
      {
        question: "Transfer ücretini nasıl ödeyebilirim?",
        answer:
          "Nakit ödeme seçeneği sunuyoruz. Ödeme detayları rezervasyon sırasında netleştirilir.",
      },
    ],
    finalTitle: "Yolculuğunuzu Planlayın",
    finalLead:
      "Havalimanı, şehir içi veya şehirler arası özel transferiniz için güzergâhınızı seçin ve uygun araç seçeneklerini görüntüleyin.",
  },
  en: {
    metaTitle:
      "Airport Transfer & Airport Taxi | Istanbul, Antalya & Turkey | Tripetica",
    metaDescription:
      "Private airport transfer and airport taxi from Istanbul Airport, Sabiha Gokcen and Antalya Airport, plus city and intercity transfers across Turkey. Fixed prices and 24/7 support.",
    heroAlt:
      "Chauffeur-driven private car waiting for an airport transfer outside the terminal",
    kicker: "Airport Transfer",
    h1: "Private Airport Transfer & Taxi – Istanbul, Antalya and Across Turkey",
    heroLead:
      "Professional chauffeur-driven private airport transfer and airport taxi from Istanbul Airport (IST), Sabiha Gokcen Airport (SAW), Antalya Airport (AYT) and airports across Turkey to your hotel, the city centre or another city.",
    bookCta: "Book Now",
    overviewTitle: "Private airport transfer with Tripetica",
    overview: [
      "Tripetica provides private airport transfer in Istanbul, Antalya and across Turkey. From Istanbul Airport (IST), Sabiha Gokcen Airport (SAW), Antalya Airport (AYT) and other airports you can plan a ride to your hotel, home, the city centre or a destination in another city.",
      "The service is not limited to airport-to-hotel journeys. With the same booking flow you can arrange airport transfers, city transfers and intercity transfers — including an airport taxi when you need a direct private car from the terminal.",
    ],
    scopes: [
      {
        title: "Airport transfers",
        text: "Airport-to-hotel and hotel-to-airport journeys with a private vehicle, timed around your flight.",
      },
      {
        title: "City transfer",
        text: "Point-to-point private transfer between hotels, restaurants, meetings and neighbourhoods in the same city.",
      },
      {
        title: "Intercity transfer",
        text: "Chauffeur-driven transfer between cities and resort areas on suitable routes across Turkey.",
      },
    ],
    airportsTitle: "Airport transfer services in Turkey",
    airportsLead:
      "Istanbul and Antalya airports are the most requested starting points, but you can also book a private transfer from other airports across Turkey.",
    airports: [
      {
        code: "IST",
        name: "Istanbul Airport (IST)",
        text: "An Istanbul Airport transfer covers hotels on the European side, Taksim, Sultanahmet and the wider city centre. An Istanbul Airport taxi with a private chauffeur is booked in the same form — you choose pickup and drop-off yourself.",
      },
      {
        code: "SAW",
        name: "Sabiha Gokcen Airport (SAW)",
        text: "A Sabiha Gokcen Airport transfer serves both the Asian and European sides. Kadıköy, Taksim and the city centre are common Sabiha Gokcen Airport taxi requests, alongside any other address you enter.",
      },
      {
        code: "AYT",
        name: "Antalya Airport (AYT)",
        text: "An Antalya Airport transfer is used for the city centre, Lara and the coastal resorts. An Antalya Airport taxi to Belek, Side, Kemer or Alanya is booked as a private transfer on the same service.",
      },
    ],
    airportsNote:
      "Tripetica is not limited to these three airports. Private airport transfer can be booked from other airports across Turkey; select your own route in the booking form.",
    routesTitle: "Popular Transfer Routes",
    routeGroups: [
      {
        heading: "Istanbul Airport (IST)",
        routes: [
          "Istanbul Airport → Taksim",
          "Istanbul Airport → Sultanahmet",
          "Istanbul Airport → Besiktas",
          "Istanbul Airport → Sisli",
          "Istanbul Airport → Kadikoy",
          "Istanbul Airport → Istanbul city centre",
        ],
      },
      {
        heading: "Sabiha Gokcen Airport (SAW)",
        routes: [
          "Sabiha Gokcen Airport → Kadikoy",
          "Sabiha Gokcen Airport → Taksim",
          "Sabiha Gokcen Airport → Sultanahmet",
          "Sabiha Gokcen Airport → Istanbul city centre",
        ],
      },
      {
        heading: "Antalya Airport (AYT)",
        routes: [
          "Antalya Airport → Antalya city centre",
          "Antalya Airport → Lara",
          "Antalya Airport → Belek",
          "Antalya Airport → Kemer",
          "Antalya Airport → Side",
          "Antalya Airport → Alanya",
        ],
      },
    ],
    cityTitle: "Private city transfer",
    city: [
      "You can also book a private transfer between two points in the same city — not only from the airport. Typical city transfer requests include hotel to restaurant, hotel to a meeting, hotel to a historic district or hotel to another hotel.",
      "Address-to-address city transfer uses the same booking form as an airport transfer. You choose pickup and drop-off; nothing is filled in automatically.",
    ],
    intercityTitle: "Private intercity transfer",
    intercity: [
      "For longer journeys, Tripetica offers chauffeur-driven intercity transfer. Frequently requested examples include Istanbul–Bursa, Istanbul–Sapanca, Istanbul–Izmit, and Antalya–Alanya, Antalya–Belek, Antalya–Kemer and Antalya–Side.",
      "These examples are not a closed list. Intercity transfer can be arranged on suitable routes across Turkey; enter the destination you actually need when you book.",
    ],
    whyTitle: "Why Tripetica?",
    why: [
      {
        title: "Fixed price",
        text: "You continue with the price you see. It does not change after booking.",
      },
      {
        title: "No hidden fees",
        text: "The fare is clear in advance. No surprise extras are added.",
      },
      {
        title: "Cash payment",
        text: "You can pay for the transfer in cash.",
      },
      {
        title: "Free cancellation",
        text: "If your plans change, free cancellation terms apply.",
      },
      {
        title: "24/7 support",
        text: "Support is available around the clock, including late-night arrivals.",
      },
      {
        title: "Professional drivers",
        text: "Your journey is handled by professional chauffeurs who know the route.",
      },
      {
        title: "Private vehicle",
        text: "You travel in a private car, not a shared shuttle.",
      },
      {
        title: "Flight tracking",
        text: "Airport transfers are planned with your flight details in mind.",
      },
    ],
    howTitle: "How it works",
    how: [
      "Choose your route",
      "Set the date and time",
      "View available vehicle options",
      "Complete your reservation",
      "Receive your transfer details",
    ],
    faqTitle: "Frequently asked questions",
    faqs: [
      {
        question: "How do I book an airport transfer?",
        answer:
          "Open the booking form on the homepage, select private transfer, enter pickup and drop-off, choose date and time, then view vehicle options.",
      },
      {
        question: "Does the transfer price change after booking?",
        answer:
          "No. Prices are fixed and there are no hidden fees. You proceed with the fare shown at booking.",
      },
      {
        question: "What if my flight is delayed?",
        answer:
          "Airport transfers include flight tracking, so timing can be adjusted to your flight. 24/7 support is also available.",
      },
      {
        question: "Can I book an Istanbul Airport taxi to the city centre?",
        answer:
          "Yes. A private Istanbul Airport transfer — booked as an airport taxi with a chauffeur — can take you to the city centre, your hotel or another address you choose.",
      },
      {
        question: "Is there an airport transfer from Sabiha Gokcen?",
        answer:
          "Yes. You can book a Sabiha Gokcen Airport transfer to Kadikoy, Taksim, Sultanahmet, the city centre or another drop-off.",
      },
      {
        question:
          "Can I book an Antalya Airport transfer to Belek, Side, Kemer or Alanya?",
        answer:
          "Yes. Antalya Airport transfer to Belek, Side, Kemer, Alanya, Lara and the city centre can all be reserved as a private transfer.",
      },
      {
        question: "Can I book an intercity transfer?",
        answer:
          "Yes. Alongside examples such as Istanbul–Bursa or Antalya–Alanya, intercity transfer can be arranged on suitable routes across Turkey.",
      },
      {
        question: "How can I pay for the transfer?",
        answer:
          "Cash payment is available. Payment details are confirmed when you book.",
      },
    ],
    finalTitle: "Plan your journey",
    finalLead:
      "Choose your route for airport, city or intercity private transfer and view the vehicle options available.",
  },
  ru: {
    metaTitle:
      "Трансфер из аэропорта в Стамбуле, Анталье и по Турции | Tripetica",
    metaDescription:
      "Частный трансфер и такси из аэропорта Стамбула, Сабиха Гёкчен и Антальи, а также городские и междугородние поездки по Турции. Фиксированная цена и поддержка 24/7.",
    heroAlt:
      "Автомобиль с водителем у терминала аэропорта для частного трансфера",
    kicker: "Трансфер из аэропорта",
    h1: "Трансфер и такси из аэропорта — Стамбул, Анталья и вся Турция",
    heroLead:
      "Частный трансфер с профессиональным водителем из аэропорта Стамбула (IST), аэропорта Сабиха Гёкчен (SAW), аэропорта Антальи (AYT) и других аэропортов Турции — в отель, в центр города или в другой город.",
    bookCta: "Забронировать",
    overviewTitle: "Частный трансфер с Tripetica",
    overview: [
      "Tripetica организует частный трансфер в Стамбуле, Анталье и по всей Турции. Из аэропорта Стамбула (IST), аэропорта Сабиха Гёкчен (SAW), аэропорта Антальи (AYT) и других аэропортов можно заранее спланировать поездку в отель, домой, в центр города или в другой населённый пункт.",
      "Это не только маршрут «аэропорт — отель». В той же форме бронирования доступны трансфер из аэропорта, поездки по городу и междугородний трансфер — включая такси из аэропорта, если нужен отдельный автомобиль с водителем.",
    ],
    scopes: [
      {
        title: "Трансфер из аэропорта",
        text: "Поездки из аэропорта в отель и из отеля в аэропорт на частном автомобиле с учётом времени рейса.",
      },
      {
        title: "Трансфер по городу",
        text: "Частная поездка между двумя адресами в одном городе: отель, ресторан, встреча, исторический район.",
      },
      {
        title: "Междугородний трансфер",
        text: "Поездки с водителем между городами и курортными зонами по подходящим маршрутам Турции.",
      },
    ],
    airportsTitle: "Трансфер из аэропортов Турции",
    airportsLead:
      "Чаще всего заказывают трансфер из аэропортов Стамбула и Антальи, но частный трансфер можно оформить и из других аэропортов страны.",
    airports: [
      {
        code: "IST",
        name: "Аэропорт Стамбула (IST)",
        text: "Трансфер из аэропорта Стамбула удобен для отелей европейской части, Таксима, Султанахмета и центра. Такси из аэропорта Стамбула с личным водителем бронируется в той же форме — пункты посадки и высадки вы выбираете сами.",
      },
      {
        code: "SAW",
        name: "Аэропорт Сабиха Гёкчен (SAW)",
        text: "Трансфер из аэропорта Сабиха Гёкчен покрывает азиатскую и европейскую стороны. Кадыкёй, Таксим и центр города — частые запросы, наряду с любым другим адресом.",
      },
      {
        code: "AYT",
        name: "Аэропорт Антальи (AYT)",
        text: "Трансфер из аэропорта Антальи заказывают в центр, Лару и на побережье. Такси из аэропорта Антальи в Белек, Сиде, Кемер или Аланью оформляется как частный трансфер.",
      },
    ],
    airportsNote:
      "Tripetica не ограничивается этими тремя аэропортами. Частный трансфер можно заказать и из других аэропортов Турции — маршрут вы указываете в форме бронирования.",
    routesTitle: "Популярные маршруты трансфера",
    routeGroups: [
      {
        heading: "Аэропорт Стамбула (IST)",
        routes: [
          "Аэропорт Стамбула → Таксим",
          "Аэропорт Стамбула → Султанахмет",
          "Аэропорт Стамбула → Бешикташ",
          "Аэропорт Стамбула → Шишли",
          "Аэропорт Стамбула → Кадыкёй",
          "Аэропорт Стамбула → центр Стамбула",
        ],
      },
      {
        heading: "Аэропорт Сабиха Гёкчен (SAW)",
        routes: [
          "Аэропорт Сабиха Гёкчен → Кадыкёй",
          "Аэропорт Сабиха Гёкчен → Таксим",
          "Аэропорт Сабиха Гёкчен → Султанахмет",
          "Аэропорт Сабиха Гёкчен → центр Стамбула",
        ],
      },
      {
        heading: "Аэропорт Антальи (AYT)",
        routes: [
          "Аэропорт Антальи → центр Антальи",
          "Аэропорт Антальи → Лара",
          "Аэропорт Антальи → Белек",
          "Аэропорт Антальи → Кемер",
          "Аэропорт Антальи → Сиде",
          "Аэропорт Антальи → Аланья",
        ],
      },
    ],
    cityTitle: "Частный трансфер по городу",
    city: [
      "Поездку можно заказать не только из аэропорта, но и между двумя точками в одном городе. Типичные сценарии: отель → ресторан, отель → встреча, отель → туристический район или отель → другой отель.",
      "Трансфер от адреса к адресу оформляется в той же форме, что и трансфер из аэропорта. Пункты посадки и высадки вы выбираете самостоятельно.",
    ],
    intercityTitle: "Междугородний частный трансфер",
    intercity: [
      "На более длинных расстояниях Tripetica предлагает междугородний трансфер с профессиональным водителем. Часто спрашивают маршруты Стамбул — Бурса, Стамбул — Сапанджа, Стамбул — Измит, а также Анталья — Аланья, Анталья — Белек, Анталья — Кемер и Анталья — Сиде.",
      "Это примеры, а не закрытый список. Междугородний трансфер возможен по подходящим направлениям по всей Турции — укажите нужный вам пункт назначения при бронировании.",
    ],
    whyTitle: "Почему Tripetica?",
    why: [
      {
        title: "Фиксированная цена",
        text: "Вы ориентируетесь на цену, которую видите. После бронирования она не меняется.",
      },
      {
        title: "Без скрытых платежей",
        text: "Стоимость ясна заранее. Скрытые доплаты не добавляются.",
      },
      {
        title: "Оплата наличными",
        text: "За трансфер можно рассчитаться наличными.",
      },
      {
        title: "Бесплатная отмена",
        text: "Если планы изменятся, действуют условия бесплатной отмены.",
      },
      {
        title: "Поддержка 24/7",
        text: "Связаться с нами можно в любое время суток, включая ночные прилёты.",
      },
      {
        title: "Профессиональные водители",
        text: "Встречу и поездку проводят водители, которые знают маршрут.",
      },
      {
        title: "Частный автомобиль",
        text: "Вы едете на отдельном автомобиле, а не в общем шаттле.",
      },
      {
        title: "Отслеживание рейса",
        text: "Трансфер из аэропорта планируется с учётом данных вашего рейса.",
      },
    ],
    howTitle: "Как это работает",
    how: [
      "Выберите маршрут",
      "Укажите дату и время",
      "Посмотрите доступные варианты автомобилей",
      "Завершите бронирование",
      "Получите информацию о трансфере",
    ],
    faqTitle: "Частые вопросы",
    faqs: [
      {
        question: "Как забронировать трансфер из аэропорта?",
        answer:
          "На главной странице откройте форму, выберите частный трансфер, укажите точки посадки и высадки, дату и время, затем посмотрите варианты автомобилей.",
      },
      {
        question: "Меняется ли цена трансфера после бронирования?",
        answer:
          "Нет. Цена фиксированная, скрытых платежей нет. Вы бронируете по стоимости, которую видите в форме.",
      },
      {
        question: "Что будет, если рейс задержится?",
        answer:
          "Для трансфера из аэропорта предусмотрено отслеживание рейса, поэтому время можно скорректировать. Также доступна поддержка 24/7.",
      },
      {
        question: "Можно ли заказать такси из аэропорта Стамбула в центр?",
        answer:
          "Да. Частный трансфер из аэропорта Стамбула — по сути такси из аэропорта с водителем — доставит вас в центр, в отель или по другому адресу, который вы укажете.",
      },
      {
        question: "Есть ли трансфер из аэропорта Сабиха Гёкчен?",
        answer:
          "Да. Можно заказать трансфер из аэропорта Сабиха Гёкчен в Кадыкёй, Таксим, Султанахмет, центр города или в другую точку.",
      },
      {
        question:
          "Есть ли трансфер из аэропорта Антальи в Белек, Сиде, Кемер и Аланью?",
        answer:
          "Да. Трансфер из аэропорта Антальи в Белек, Сиде, Кемер, Аланью, Лару и центр города бронируется как частный трансфер.",
      },
      {
        question: "Можно ли заказать междугородний трансфер?",
        answer:
          "Да. Помимо примеров вроде Стамбул — Бурса или Анталья — Аланья, междугородний трансфер доступен по подходящим маршрутам по всей Турции.",
      },
      {
        question: "Как можно оплатить трансфер?",
        answer:
          "Доступна оплата наличными. Детали подтверждаются при бронировании.",
      },
    ],
    finalTitle: "Спланируйте поездку",
    finalLead:
      "Выберите маршрут для трансфера из аэропорта, по городу или между городами и посмотрите доступные варианты автомобилей.",
  },
  ar: {
    metaTitle:
      "النقل من المطار والتاكسي | إسطنبول وأنطاليا وتركيا | Tripetica",
    metaDescription:
      "النقل الخاص من المطار والتاكسي من مطار إسطنبول ومطار صبيحة كوكجن ومطار أنطاليا، إضافة إلى النقل داخل المدينة وبين المدن في أنحاء تركيا. أسعار ثابتة ودعم على مدار الساعة.",
    heroAlt:
      "سيارة بسائق خاص تنتظر النقل من المطار أمام صالة الوصول",
    kicker: "النقل من المطار",
    h1: "النقل الخاص من المطار والتاكسي – إسطنبول وأنطاليا وتركيا",
    heroLead:
      "نقل خاص من المطار بسيارة وسائق خاص محترف، وتاكسي من مطار إسطنبول (IST) ومطار صبيحة كوكجن (SAW) ومطار أنطاليا (AYT) والمطارات في أنحاء تركيا إلى فندقكم أو وسط المدينة أو مدينة أخرى.",
    bookCta: "احجز الآن",
    overviewTitle: "النقل الخاص من المطار مع Tripetica",
    overview: [
      "تقدّم Tripetica خدمة النقل الخاص من المطار في إسطنبول وأنطاليا وفي أنحاء تركيا. من مطار إسطنبول (IST) ومطار صبيحة كوكجن (SAW) ومطار أنطاليا (AYT) والمطارات الأخرى يمكنكم التخطيط لرحلة إلى الفندق أو المنزل أو وسط المدينة أو وجهة في مدينة أخرى.",
      "الخدمة ليست مقتصرة على رحلات المطار إلى الفندق. عبر مسار الحجز نفسه يمكنكم ترتيب النقل من المطار، والنقل داخل المدينة، والنقل بين المدن — بما في ذلك تاكسي من المطار عندما تحتاجون سيارة خاصة مباشرة من الصالة.",
    ],
    scopes: [
      {
        title: "النقل من المطار",
        text: "رحلات من المطار إلى الفندق ومن الفندق إلى المطار بسيارة خاصة، تُضبط وفق موعد رحلتكم.",
      },
      {
        title: "النقل داخل المدينة",
        text: "نقل خاص من نقطة إلى نقطة بين الفنادق والمطاعم والاجتماعات والأحياء في المدينة نفسها.",
      },
      {
        title: "النقل بين المدن",
        text: "نقل بسائق خاص بين المدن والمناطق السياحية على المسارات المناسبة في أنحاء تركيا.",
      },
    ],
    airportsTitle: "خدمات النقل من المطار في تركيا",
    airportsLead:
      "مطارات إسطنبول وأنطاليا هي نقاط الانطلاق الأكثر طلباً، ويمكنكم أيضاً حجز نقل خاص من مطارات أخرى في أنحاء تركيا.",
    airports: [
      {
        code: "IST",
        name: "مطار إسطنبول (IST)",
        text: "يشمل النقل من مطار إسطنبول الفنادق في الجانب الأوروبي وتقسيم والسلطان أحمد ووسط المدينة الأوسع. يُحجز تاكسي مطار إسطنبول مع سائق خاص في النموذج نفسه — أنتم تختارون نقطة الانطلاق والوصول.",
      },
      {
        code: "SAW",
        name: "مطار صبيحة كوكجن (SAW)",
        text: "يخدم النقل من مطار صبيحة كوكجن الجانبين الآسيوي والأوروبي. قاديكوي وتقسيم ووسط المدينة من الطلبات الشائعة لتاكسي مطار صبيحة كوكجن، إلى جانب أي عنوان آخر تدخلونه.",
      },
      {
        code: "AYT",
        name: "مطار أنطاليا (AYT)",
        text: "يُستخدم النقل من مطار أنطاليا لوسط المدينة ولارا والمنتجعات الساحلية. يُحجز تاكسي مطار أنطاليا إلى بيلك أو سيده أو كمر أو ألانيا كنقل خاص ضمن الخدمة نفسها.",
      },
    ],
    airportsNote:
      "لا تقتصر Tripetica على هذه المطارات الثلاثة. يمكن حجز النقل الخاص من المطار من مطارات أخرى في أنحاء تركيا؛ اختاروا مساركم في نموذج الحجز.",
    routesTitle: "مسارات النقل الأكثر طلباً",
    routeGroups: [
      {
        heading: "مطار إسطنبول (IST)",
        routes: [
          "مطار إسطنبول → تقسيم",
          "مطار إسطنبول → السلطان أحمد",
          "مطار إسطنبول → بشكتاش",
          "مطار إسطنبول → شيشلي",
          "مطار إسطنبول → قاديكوي",
          "مطار إسطنبول → وسط إسطنبول",
        ],
      },
      {
        heading: "مطار صبيحة كوكجن (SAW)",
        routes: [
          "مطار صبيحة كوكجن → قاديكوي",
          "مطار صبيحة كوكجن → تقسيم",
          "مطار صبيحة كوكجن → السلطان أحمد",
          "مطار صبيحة كوكجن → وسط إسطنبول",
        ],
      },
      {
        heading: "مطار أنطاليا (AYT)",
        routes: [
          "مطار أنطاليا → وسط أنطاليا",
          "مطار أنطاليا → لارا",
          "مطار أنطاليا → بيلك",
          "مطار أنطاليا → كمر",
          "مطار أنطاليا → سيده",
          "مطار أنطاليا → ألانيا",
        ],
      },
    ],
    cityTitle: "النقل الخاص داخل المدينة",
    city: [
      "يمكنكم أيضاً حجز نقل خاص بين نقطتين في المدينة نفسها — وليس من المطار فقط. من الطلبات الشائعة: من الفندق إلى مطعم، أو إلى اجتماع، أو إلى حي تاريخي، أو إلى فندق آخر.",
      "يستخدم النقل من عنوان إلى عنوان النموذج نفسه المستخدم للنقل من المطار. أنتم تختارون نقطة الانطلاق والوصول؛ لا يُملأ شيء تلقائياً.",
    ],
    intercityTitle: "النقل الخاص بين المدن",
    intercity: [
      "للمسافات الأطول تقدّم Tripetica نقلاً بين المدن بسائق خاص. من الأمثلة المتكررة: إسطنبول–بورصة، إسطنبول–سابانجا، إسطنبول–إزميت، وأنطاليا–ألانيا، وأنطاليا–بيلك، وأنطاليا–كمر، وأنطاليا–سيده.",
      "هذه أمثلة وليست قائمة مغلقة. يمكن ترتيب النقل بين المدن على المسارات المناسبة في أنحاء تركيا؛ أدخلوا الوجهة التي تحتاجونها فعلاً عند الحجز.",
    ],
    whyTitle: "لماذا Tripetica؟",
    why: [
      {
        title: "سعر ثابت",
        text: "تتابعون بالسعر الذي ترونه. لا يتغيّر بعد الحجز.",
      },
      {
        title: "بلا رسوم خفية",
        text: "الأجرة واضحة مسبقاً. لا تُضاف مفاجآت لاحقاً.",
      },
      {
        title: "الدفع نقداً",
        text: "يمكنكم دفع أجرة النقل نقداً.",
      },
      {
        title: "إلغاء مجاني",
        text: "إذا تغيّرت خططكم، تسري شروط الإلغاء المجاني.",
      },
      {
        title: "دعم على مدار الساعة",
        text: "الدعم متاح في أي وقت، بما في ذلك الوصول ليلاً.",
      },
      {
        title: "سائقون محترفون",
        text: "تتولى رحلتكم سائقون خاصون محترفون يعرفون المسار.",
      },
      {
        title: "سيارة خاصة",
        text: "تسافرون في سيارة خاصة، لا في حافلة مشتركة.",
      },
      {
        title: "تتبّع الرحلة",
        text: "يُخطَّط النقل من المطار مع مراعاة بيانات رحلتكم.",
      },
    ],
    howTitle: "كيف يعمل الحجز؟",
    how: [
      "اختاروا مساركم",
      "حدّدوا التاريخ والوقت",
      "اطّلعوا على خيارات السيارات المتاحة",
      "أكملوا الحجز",
      "استلموا تفاصيل النقل",
    ],
    faqTitle: "أسئلة شائعة",
    faqs: [
      {
        question: "كيف أحجز النقل من المطار؟",
        answer:
          "افتحوا نموذج الحجز في الصفحة الرئيسية، اختاروا النقل الخاص، أدخلوا نقطتي الانطلاق والوصول، حدّدوا التاريخ والوقت، ثم اطّلعوا على خيارات السيارات.",
      },
      {
        question: "هل يتغيّر سعر النقل بعد الحجز؟",
        answer:
          "لا. الأسعار ثابتة ولا توجد رسوم خفية. تتابعون بالأجرة المعروضة عند الحجز.",
      },
      {
        question: "ماذا لو تأخرت رحلتي؟",
        answer:
          "يشمل النقل من المطار تتبّع الرحلة، فيمكن ضبط التوقيت وفق رحلتكم. والدعم متاح على مدار الساعة أيضاً.",
      },
      {
        question: "هل يمكنني حجز تاكسي من مطار إسطنبول إلى وسط المدينة؟",
        answer:
          "نعم. يمكن للنقل الخاص من مطار إسطنبول — يُحجز كتاكسي من المطار مع سائق خاص — أن يوصلكم إلى وسط المدينة أو فندقكم أو أي عنوان تختارونه.",
      },
      {
        question: "هل يتوفر نقل من مطار صبيحة كوكجن؟",
        answer:
          "نعم. يمكنكم حجز النقل من مطار صبيحة كوكجن إلى قاديكوي أو تقسيم أو السلطان أحمد أو وسط المدينة أو أي نقطة وصول أخرى.",
      },
      {
        question:
          "هل يمكنني حجز النقل من مطار أنطاليا إلى بيلك أو سيده أو كمر أو ألانيا؟",
        answer:
          "نعم. يمكن حجز النقل من مطار أنطاليا إلى بيلك وسيده وكمر وألانيا ولارا ووسط المدينة كنقل خاص.",
      },
      {
        question: "هل يمكنني حجز نقل بين المدن؟",
        answer:
          "نعم. إلى جانب أمثلة مثل إسطنبول–بورصة أو أنطاليا–ألانيا، يمكن ترتيب النقل بين المدن على المسارات المناسبة في أنحاء تركيا.",
      },
      {
        question: "كيف يمكنني دفع أجرة النقل؟",
        answer:
          "الدفع نقداً متاح. تُؤكَّد تفاصيل الدفع عند الحجز.",
      },
    ],
    finalTitle: "خطّطوا لرحلتكم",
    finalLead:
      "اختاروا مساركم للنقل الخاص من المطار أو داخل المدينة أو بين المدن، واطّلعوا على خيارات السيارات المتاحة.",
  },
};
