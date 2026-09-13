import { type Locale } from "@/lib/i18n/config";

export type DestinationSection = {
  id: string;
  title: string;
  paragraphs: string[];
};

export type PrivateTurkeyToursCopy = {
  metaTitle: string;
  metaDescription: string;
  heroAlt: string;
  kicker: string;
  h1: string;
  heroLead: string[];
  quoteCta: string;
  highlights: { title: string; text: string }[];
  destinations: DestinationSection[];
  moreTitle: string;
  more: string[];
  planTitle: string;
  plan: string[];
  whyTitle: string;
  why: { title: string; text: string }[];
  faqTitle: string;
  faqs: { question: string; answer: string }[];
  finalTitle: string;
  finalLead: string;
};

export const privateTurkeyToursCopy: Record<Locale, PrivateTurkeyToursCopy> = {
  tr: {
    metaTitle:
      "Türkiye Özel Turları | Kapadokya, Pamukkale ve Özel Rotalar | Tripetica",
    metaDescription:
      "Kapadokya, Pamukkale, Göbeklitepe, Efes, Mardin ve Türkiye'nin farklı bölgeleri için size özel tur ve ulaşım planı oluşturun. Seyahatinizi kendi programınıza göre planlayın.",
    heroAlt:
      "Türkiye özel turları, Kapadokya, Pamukkale, Göbeklitepe, Efes ve farklı destinasyonlar",
    kicker: "Türkiye Özel Turları",
    h1: "Türkiye Özel Turları – Size Özel Rota ve Seyahat Planlaması",
    heroLead: [
      "Türkiye'nin tarihi şehirlerini, doğal güzelliklerini, sahil bölgelerini ve kültürel mirasını kendi programınıza göre keşfedebilirsiniz. Tripetica; çiftler, aileler, arkadaş grupları ve özel gruplar için araç ve şoförlü, kişiye özel seyahat programları planlayabilir.",
      "Seyahatiniz günübirlik bir gezi, birkaç günlük bir rota, konaklamalı bir program veya birden fazla şehri kapsayan daha geniş bir plan olabilir. Başlangıç ve bitiş noktaları da takviminize göre düzenlenebilir. Hazır bir paket tur satın almak zorunda değilsiniz; rotayı seyahat planınıza göre şekillendiririz.",
    ],
    quoteCta: "Teklif Al",
    highlights: [
      { title: "Tur tipi", text: "Kişiye özel program" },
      { title: "Kapsam", text: "Türkiye genelinde planlama" },
      { title: "Ulaşım", text: "Özel araç ve şoför" },
      { title: "Süre", text: "Günübirlik veya konaklamalı" },
      { title: "Rota", text: "Tek destinasyon veya birden fazla şehir" },
      { title: "Başlangıç", text: "Sizin belirlediğiniz noktalar" },
    ],
    destinations: [
      {
        id: "cappadocia",
        title: "Kapadokya Özel Turu",
        paragraphs: [
          "Kapadokya, Türkiye'nin en çok merak edilen turizm bölgelerinden biridir. Göreme çevresindeki peri bacaları, vadiler, kaya oluşumları ve yer altı şehirleri; hem doğal yapı hem de tarihî yerleşim katmanlarıyla birlikte okunur. Bölge, kısa bir bakış için de birkaç günlük daha sakin bir keşif için de planlanabilir.",
          "Bazı misafirler Kapadokya'yı tek günlük, yoğun bir ziyaret olarak ele alır; bazıları vadilerde daha fazla zaman geçirmek, yerleşimleri yavaş gezmek veya çevredeki durakları eklemek ister. Programın temposu, görmek istediğiniz yerler ve ayırdığınız süreye göre kurulur.",
          "Sıcak hava balonu, Kapadokya'da sık sorulan deneyimlerden biridir. Balon uçuşu üçüncü taraf bir aktivitedir; müsaitlik, hava koşulları ve işletmenin şartlarına bağlıdır. Tur ve ulaşım teklifine otomatik dahil olduğu varsayılmamalıdır. İsterseniz talebinizi paylaşın, uygunluğu birlikte netleştirelim.",
        ],
      },
      {
        id: "pamukkale",
        title: "Pamukkale ve Hierapolis",
        paragraphs: [
          "Pamukkale, beyaz travertenleriyle tanınır; hemen yakınındaki Hierapolis Antik Kenti ise bölgeye tarihî bir katman ekler. Doğal oluşum ile antik kentin yan yana durması, birçok ziyaretçinin rotasında Pamukkale'yi öne çıkarır.",
          "Özel turda duraklar, fotoğraf için ayırdığınız süre ve Hierapolis'i ne kadar ayrıntılı gezmek istediğiniz gibi tercihlere göre düzenlenebilir. Çevre duraklar da aynı güne veya daha geniş bir Ege–İç Anadolu bağlantısına eklenebilir; kesin saatli hazır bir itinerary sunulmaz.",
          "Pamukkale bazen tek başına bir günlük çıkış olarak, bazen Kapadokya veya Ege hattındaki birkaç günlük bir seyahatin parçası olarak planlanır. Hangisinin size uygun olduğu, tarihler ve ulaşım mesafesiyle birlikte değerlendirilir.",
        ],
      },
      {
        id: "gobeklitepe",
        title: "Göbeklitepe ve Şanlıurfa",
        paragraphs: [
          "Göbeklitepe, Güneydoğu Anadolu'da arkeolojiyle ilgilenen ziyaretçilerin sık yöneldiği duraklardan biridir. Anıtsal taş düzenlemeleri ve kazı alanının sunduğu tarihî bağlam, bölgeyi sıradan bir şehir gezisinden ayırır. Tarihlendirme ve yorumlar akademik çalışmalara açıktır; burada kesin ve tartışmalı iddialara yer vermiyoruz.",
          "Şanlıurfa ve çevresi, Göbeklitepe ziyaretini daha geniş bir Güneydoğu Anadolu seyahatine bağlamak isteyenler için doğal bir çerçeve sunar. Eski kent dokusu, mutfak ve yakın duraklar, sürenize göre aynı programa eklenebilir veya ayrı bir güne bırakılabilir.",
          "Bu hat, genellikle acele bir günübirlik bakıştan çok, en az bir tam gün veya birkaç günlük bir planla daha rahat okunur. Mesafe, konaklama tercihi ve görmek istediğiniz diğer noktalar teklif aşamasında netleştirilir.",
        ],
      },
      {
        id: "ephesus",
        title: "Efes ve Ege Bölgesi",
        paragraphs: [
          "Efes Antik Kenti, Ege'de klasik döneme ilgi duyan ziyaretçiler için öne çıkan duraklardan biridir. Caddeler, anıtsal kalıntılar ve kentin ölçeği, kısa bir bakışla tüketilmek yerine tempoya göre gezildiğinde daha iyi anlaşılır.",
          "Aynı seyahatte Selçuk, Şirince ve İzmir çevresi de zamanınıza göre değerlendirilebilir. Bazı misafirler yalnızca Efes'e odaklanır; bazıları Ege sahili veya iç kesim duraklarını aynı plana bağlamak ister. Tercih sizin programınıza aittir.",
          "Efes, İzmir çıkışlı bir günlük gezi olarak da, daha geniş bir Ege rotasının parçası olarak da kurulabilir. Ulaşım, ziyaret süresi ve varsa konaklama ihtiyacı teklifte ayrı ayrı konuşulur.",
        ],
      },
      {
        id: "mardin",
        title: "Mardin ve Mezopotamya'nın Kültürel Mirası",
        paragraphs: [
          "Mardin, taş mimarisi, yamaçlara yaslanmış eski kent dokusu ve kültürel çeşitliliğiyle Güneydoğu Anadolu'da kendine özgü bir duraktır. Dar sokaklar, teraslı evler ve eski şehir atmosferi, acele bir geçişten çok yürüyerek ve durarak gezilmeye daha yakındır.",
          "Mardin'i tek başına bir destinasyon olarak planlamak da mümkündür; Göbeklitepe, Şanlıurfa veya bölgedeki diğer duraklarla birlikte daha geniş bir Güneydoğu seyahatinin örneği olarak da ele alınabilir.",
          "Süre, konaklama ve görmek istediğiniz mahalle veya çevre noktalar sizin listenize göre şekillenir. Sabit bir paket saat dilimi yoktur; program talebinize göre kurulur.",
        ],
      },
    ],
    moreTitle: "Türkiye'de Keşfedilecek Daha Çok Yer Var",
    more: [
      "Kapadokya, Pamukkale, Göbeklitepe, Efes ve Mardin bu sayfada örnek olarak anlatılıyor. Türkiye özel tur hizmeti bu beş destinasyonla sınırlı değildir.",
      "Akdeniz ve Ege kıyılarında Antalya, Fethiye, Bodrum veya Çeşme gibi duraklar; İç Anadolu'da Konya; Karadeniz'de Trabzon ve bölgenin yayla hatları da seyahat sürenize göre aynı yaklaşımla ele alınabilir. Güneydoğu Anadolu veya başka bir bölge için de, uygunluk ve mesafe dikkate alınarak özel bir rota üzerinde çalışılabilir.",
      "Gitmek istediğiniz yeri bize söyleyin; seyahat sürenize, kişi sayınıza ve beklentilerinize göre size özel bir rota üzerinde çalışalım. Listede adı geçmeyen bir destinasyon da, operasyonel olarak uygunsa planlamaya dahil edilebilir.",
    ],
    planTitle: "Seyahatiniz Size Göre Planlansın",
    plan: [
      "Tarih, kişi sayısı, başlangıç ve bitiş noktası, görmek istediğiniz şehirler ve bölgeler, seyahat süresi ve günübirlik mi konaklamalı mı olacağı sizin kararınızdır. Program tek bir şehre odaklanabilir veya birden fazla destinasyonu birbirine bağlayabilir. İstanbul'a dönüş de, başka bir şehirde bitiş de mümkündür.",
      "Örneğin bir misafir İstanbul'dan başlayıp Kapadokya'da birkaç gün kalmak, ardından Pamukkale veya Ege Bölgesi'ne devam etmek isteyebilir. Başka bir misafir yalnızca belirli bir destinasyon için özel araç ve şoför talep edebilir. Bunlar örneklerdir; hazır paket olarak sunulmaz.",
      "Paylaştığınız plan üzerinden ulaşım çerçevesini ve günlerin genel akışını konuşuruz. Otel, müze girişi, yemek veya üçüncü taraf aktiviteler otomatik dahil değildir; kapsam teklifte netleştirilir.",
    ],
    whyTitle: "Neden Özel Tur?",
    why: [
      {
        title: "Size özel rota",
        text: "Duraklar ve tempo, sizin listenize ve ayırdığınız zamana göre kurulur; kalabalık grup turunun sabit sırasına bağlı kalmazsınız.",
      },
      {
        title: "Kendi grubunuzla seyahat",
        text: "Çift, aile veya arkadaş grubu olarak yalnızca kendi misafirlerinizle ilerlersiniz.",
      },
      {
        title: "Özel araç ve şoför",
        text: "Kapıdan alınma ve gün içi ulaşım, özel araç ve şoförle planlanır.",
      },
      {
        title: "Esnek seyahat süresi",
        text: "Kısa bir çıkış da, birkaç günlük bir program da aynı hizmet yaklaşımıyla ele alınabilir.",
      },
      {
        title: "Birden fazla destinasyon",
        text: "Uygun mesafeler ve süre varsa şehirler aynı seyahatte birbirine bağlanabilir.",
      },
      {
        title: "Günübirlik veya konaklamalı",
        text: "Aynı gün dönüş veya şehirler arasında konaklamalı bir hat, ihtiyacınıza göre konuşulur.",
      },
    ],
    faqTitle: "Sık sorulan sorular",
    faqs: [
      {
        question: "Türkiye özel turu nasıl planlanır?",
        answer:
          "Gitmek istediğiniz yerleri, yaklaşık tarihleri, kişi sayısını ve seyahatin günübirlik mi konaklamalı mı olacağını paylaşmanız yeterlidir. Bu bilgilere göre özel tur ve ulaşım çerçevesinde bir teklif hazırlarız. Program, onayınızdan sonra netleşir.",
      },
      {
        question: "Tur programı sabit mi?",
        answer:
          "Hayır. Bu hizmet hazır bir paket tur satışı değildir. Duraklar, süre ve güzergâh sizin planınıza göre şekillenir. Kesin saatli standart bir itinerary vaat edilmez.",
      },
      {
        question: "Birden fazla şehir aynı seyahate eklenebilir mi?",
        answer:
          "Evet, süre ve mesafeler uygunsa birden fazla destinasyon aynı programa bağlanabilir. Hangi şehirlerin aynı hatta toplanacağı, takviminiz ve tercihlerinizle birlikte değerlendirilir.",
      },
      {
        question: "Tur günübirlik olmak zorunda mı?",
        answer:
          "Hayır. Günübirlik çıkışlar da, birkaç günlük programlar da planlanabilir. Süre sizin seyahat takviminize bağlıdır.",
      },
      {
        question: "Konaklamalı program hazırlanabilir mi?",
        answer:
          "Evet, şehirler arasında veya bir destinasyonda birkaç gece kalarak ilerleyen programlar konuşulabilir. Konaklama otomatik olarak fiyata dahil değildir; otel seçimi ve kapsamı talebinize göre netleştirilir.",
      },
      {
        question: "Tur İstanbul'dan başlamak zorunda mı?",
        answer:
          "Hayır. İstanbul sık kullanılan bir başlangıç noktasıdır ancak zorunlu değildir. Başka bir şehirden başlamak veya başka bir şehirde bitirmek de, uygunluk durumuna göre planlanabilir.",
      },
      {
        question: "Kapadokya, Pamukkale veya başka bir destinasyon için özel rota hazırlanabilir mi?",
        answer:
          "Evet. Bu sayfadaki destinasyonlar örnektir. Belirli bir bölgeye odaklanan bir gezi de, birkaç durakı birleştiren daha geniş bir hat da talep edilebilir.",
      },
      {
        question: "Fiyata neler dahil?",
        answer:
          "Teklif, paylaştığınız plana göre hazırlanır. Kapsam genellikle özel araç ve şoförlü ulaşım çerçevesinde netleştirilir. Nelerin dahil olduğu, yazışma sırasında madde madde belirtilir; varsayılan geniş bir paket fiyatı yoktur.",
      },
      {
        question: "Aktivite ve giriş ücretleri otomatik olarak dahil mi?",
        answer:
          "Hayır. Müze ve ören yeri girişleri, yemekler, balon, ATV ve benzeri üçüncü taraf hizmetler tur ücretine otomatik dahil değildir. Bunları eklemek isterseniz müsaitlik ve ilgili işletmenin şartları ayrıca değerlendirilir.",
      },
    ],
    finalTitle: "Aklınızdaki Seyahati Bize Anlatın",
    finalLead:
      "Gitmek istediğiniz yerleri, seyahat tarihlerinizi, kişi sayısını ve planınızı bizimle paylaşın. Size özel tur ve ulaşım planınız için teklif hazırlayalım.",
  },
  en: {
    metaTitle:
      "Private Tours in Türkiye | Cappadocia, Pamukkale & Custom Routes | Tripetica",
    metaDescription:
      "Plan a private tour and chauffeur-driven itinerary across Türkiye — Cappadocia, Pamukkale, Göbeklitepe, Ephesus, Mardin and beyond — shaped around your dates, group and pace.",
    heroAlt:
      "Private tours across Türkiye including Cappadocia, Pamukkale, Göbeklitepe, Ephesus and other destinations",
    kicker: "Private Tours in Türkiye",
    h1: "Private Tours in Türkiye – Custom Routes and Travel Planning",
    heroLead: [
      "You can explore Türkiye’s historic cities, landscapes, coast and cultural heritage on a schedule that belongs to you. Tripetica plans chauffeur-driven, private itineraries for couples, families, friends and small groups.",
      "A trip can be a single day, several days, overnight stays, a route that links more than one city, or a journey with different start and end points. You do not have to buy a fixed package. We shape the route around how you actually want to travel.",
    ],
    quoteCta: "Get a Quote",
    highlights: [
      { title: "Type", text: "Tailored private itinerary" },
      { title: "Coverage", text: "Planning across Türkiye" },
      { title: "Transport", text: "Private vehicle and chauffeur" },
      { title: "Duration", text: "Day trip or overnight" },
      { title: "Route", text: "One destination or several cities" },
      { title: "Start & finish", text: "Points you choose" },
    ],
    destinations: [
      {
        id: "cappadocia",
        title: "Private Cappadocia Tour",
        paragraphs: [
          "Cappadocia is one of Türkiye’s best-known travel regions. Around Göreme, fairy chimneys, valleys, rock formations and underground cities sit together as both landscape and historic settlement. The area works as a focused visit or as a slower stay of several days.",
          "Some guests treat Cappadocia as an intensive single day; others want more time in the valleys, in the villages, or with nearby stops. Pace and inclusions follow the time you have and what you most want to see.",
          "Hot-air ballooning is a frequently asked experience here. Flights are run by third parties and depend on availability, weather and the operator’s conditions. They should not be assumed as part of a Tripetica tour price. Tell us if you hope to include one, and we can look at what is realistic.",
        ],
      },
      {
        id: "pamukkale",
        title: "Pamukkale and Hierapolis",
        paragraphs: [
          "Pamukkale is known for its white travertine terraces; Hierapolis, next to them, adds an archaeological layer. That pairing of geology and an ancient city is why many travellers put the area on a Türkiye itinerary.",
          "On a private visit, time at the terraces and how thoroughly you walk Hierapolis can be adjusted. Nearby stops can sit on the same day or on a wider Aegean–inland connection. We do not publish a fixed, clock-timed package timetable.",
          "Pamukkale can be a standalone day, or a stage in a longer journey that also includes Cappadocia or the Aegean. Which shape fits depends on your dates and the distances involved.",
        ],
      },
      {
        id: "gobeklitepe",
        title: "Göbeklitepe and Şanlıurfa",
        paragraphs: [
          "Göbeklitepe is a key stop for travellers interested in archaeology in southeastern Anatolia. The monumental stone settings and the site’s historical context set it apart from a typical city stroll. Dating and interpretation remain a matter of ongoing research; we do not lean on contested claims.",
          "Şanlıurfa and its surroundings give a natural frame if you want Göbeklitepe as part of a broader southeastern journey. The old city, local food and nearby places can share the same programme or sit on a separate day, depending on time.",
          "This route is usually more comfortable as a full day or a multi-day plan than as a rushed glance. Distances, overnight stays and other stops are clarified when we prepare a quote.",
        ],
      },
      {
        id: "ephesus",
        title: "Ephesus and the Aegean",
        paragraphs: [
          "The ancient city of Ephesus is a landmark for travellers drawn to the classical Aegean. Streets and monumental remains repay a visit that is paced rather than hurried.",
          "Selçuk, Şirince and the wider İzmir area can sit in the same itinerary if you have the time. Some guests focus only on Ephesus; others want coastal or inland Aegean stops on the same trip. That choice is yours.",
          "Ephesus can be planned as a day from İzmir or as part of a longer Aegean route. Driving time, how long you want on site and any overnight stays are discussed in the quote.",
        ],
      },
      {
        id: "mardin",
        title: "Mardin and Mesopotamia’s Cultural Heritage",
        paragraphs: [
          "Mardin stands out in southeastern Anatolia for its stone architecture, hillside old town and cultural mix. Narrow streets, terraced houses and the historic centre are better walked than rushed through.",
          "You can visit Mardin as a destination in its own right, or as one example within a wider southeastern itinerary that also includes Göbeklitepe, Şanlıurfa or other regional stops.",
          "How long you stay and which neighbourhoods or nearby places you include follows your list. There is no fixed package timetable; the programme is built from your request.",
        ],
      },
    ],
    moreTitle: "There Is More of Türkiye to Explore",
    more: [
      "Cappadocia, Pamukkale, Göbeklitepe, Ephesus and Mardin appear on this page as examples. Private tours in Türkiye are not limited to these five places.",
      "Mediterranean and Aegean stops such as Antalya, Fethiye, Bodrum or Çeşme; Konya in Central Anatolia; Trabzon and the Black Sea hinterland can be approached in the same way, depending on how many days you have. Southeastern Anatolia and other regions can also be discussed where distances and operations allow.",
      "Tell us where you want to go. We will work on a route that fits your travel time, group size and expectations. A place that is not named here can still be included if it is feasible to operate.",
    ],
    planTitle: "Let the Journey Follow Your Plan",
    plan: [
      "You set the dates, group size, start and finish points, the cities or regions you care about, how long you will travel, and whether the trip is a day outing or includes overnight stays. The programme can stay with one city or connect several. Finishing back in Istanbul is possible; so is ending in another city.",
      "One guest might start in Istanbul, spend a few days in Cappadocia, then continue to Pamukkale or the Aegean. Another might only need a private vehicle and chauffeur for a single destination. These are illustrations, not packaged products.",
      "From the plan you share, we discuss the transport frame and the general flow of the days. Hotels, museum tickets, meals and third-party activities are not included by default; the scope is spelled out in the quote.",
    ],
    whyTitle: "Why a Private Tour?",
    why: [
      {
        title: "A route that is yours",
        text: "Stops and pace follow your list and your time, not a large-group coach timetable.",
      },
      {
        title: "Travel with your own group",
        text: "Couples, families and friends travel together — only your guests in the vehicle.",
      },
      {
        title: "Private vehicle and chauffeur",
        text: "Pick-up and daytime transfers are planned with a dedicated car and driver.",
      },
      {
        title: "Flexible length",
        text: "A short outing and a multi-day itinerary use the same planning approach.",
      },
      {
        title: "More than one destination",
        text: "Where time and distances allow, cities can be linked in one journey.",
      },
      {
        title: "Day trip or overnight",
        text: "Same-day return or stays between cities can be discussed around your needs.",
      },
    ],
    faqTitle: "Frequently asked questions",
    faqs: [
      {
        question: "How is a private tour in Türkiye planned?",
        answer:
          "Share the places you have in mind, rough dates, group size and whether you want a day trip or overnight stays. We prepare a quote around private touring and transport. The programme is confirmed after you approve the outline.",
      },
      {
        question: "Is the itinerary fixed?",
        answer:
          "No. This is not a ready-made package tour. Stops, timing and routing follow your plan. We do not promise a standard, clock-timed itinerary.",
      },
      {
        question: "Can several cities be combined in one trip?",
        answer:
          "Yes, if time and distances allow. Which cities sit on the same route is decided with your calendar and preferences.",
      },
      {
        question: "Does the tour have to be a day trip?",
        answer:
          "No. Single-day outings and multi-day programmes are both possible. Length follows your travel calendar.",
      },
      {
        question: "Can you plan a trip with overnight stays?",
        answer:
          "Yes. Itineraries that stay several nights in one place or move between cities can be discussed. Accommodation is not automatically included in the price; hotels and what is covered are clarified on request.",
      },
      {
        question: "Does the tour have to start in Istanbul?",
        answer:
          "No. Istanbul is a common starting point, not a requirement. Starting or finishing in another city can be planned where it is operationally possible.",
      },
      {
        question: "Can you prepare a custom route for Cappadocia, Pamukkale or another destination?",
        answer:
          "Yes. The destinations on this page are examples. You can ask for a focused visit to one region or a longer route that links several stops.",
      },
      {
        question: "What is included in the price?",
        answer:
          "The quote is built around the plan you share. Scope is usually clarified around a private vehicle and chauffeur. What is included is listed in the offer; there is no default all-in package price.",
      },
      {
        question: "Are activities and entrance fees included automatically?",
        answer:
          "No. Museum and site tickets, meals, balloon flights, ATV rides and similar third-party services are not included by default. If you want them added, availability and the operator’s conditions are reviewed separately.",
      },
    ],
    finalTitle: "Tell Us About the Trip You Have in Mind",
    finalLead:
      "Share the places you want to visit, your travel dates, group size and outline. We will prepare a quote for a private tour and transport plan around it.",
  },
  ru: {
    metaTitle:
      "Индивидуальные туры по Турции | Каппадокия, Памуккале | Tripetica",
    metaDescription:
      "Индивидуальный тур и трансферы по Турции: Каппадокия, Памуккале, Гёбеклитепе, Эфес, Мардин и другие регионы. Маршрут под ваши даты, компанию и темп поездки.",
    heroAlt:
      "Индивидуальные туры по Турции: Каппадокия, Памуккале, Гёбеклитепе, Эфес и другие направления",
    kicker: "Индивидуальные туры по Турции",
    h1: "Индивидуальные туры по Турции — маршрут и программа под вас",
    heroLead: [
      "Исторические города, природа, побережье и культурное наследие Турции можно открывать в своём ритме. Tripetica планирует поездки на автомобиле с водителем для пар, семей, друзей и небольших групп.",
      "Это может быть один день, несколько дней, программа с ночёвками, маршрут через несколько городов или поездка с разными точками старта и финиша. Покупать готовый пакет не обязательно: маршрут выстраивается вокруг вашего плана.",
    ],
    quoteCta: "Получить предложение",
    highlights: [
      { title: "Формат", text: "Индивидуальная программа" },
      { title: "География", text: "Планирование по Турции" },
      { title: "Транспорт", text: "Автомобиль с водителем" },
      { title: "Длительность", text: "Один день или с ночёвками" },
      { title: "Маршрут", text: "Один город или несколько" },
      { title: "Старт и финиш", text: "Точки, которые выберете вы" },
    ],
    destinations: [
      {
        id: "cappadocia",
        title: "Индивидуальный тур в Каппадокию",
        paragraphs: [
          "Каппадокия — один из самых известных туристических регионов Турции. Вокруг Гёреме каменные столбы, долины, скальные формы и подземные города читаются и как ландшафт, и как историческая среда. Сюда едут и на короткий осмотр, и на спокойные несколько дней.",
          "Кто-то планирует насыщенный однодневный визит, кто-то хочет больше времени в долинах, в посёлках или с соседними остановками. Темп зависит от того, сколько дней у вас есть и что важно увидеть.",
          "Полёт на воздушном шаре — частый запрос. Это услуга стороннего оператора: доступность, погода и правила компании могут меняться. Не стоит считать шар автоматически включённым в стоимость тура Tripetica. Если хотите добавить полёт, напишите — вместе посмотрим, что реально.",
        ],
      },
      {
        id: "pamukkale",
        title: "Памуккале и Иераполис",
        paragraphs: [
          "Памуккале известен белыми травертинами; рядом Иераполис добавляет античный слой. Соседство природного ландшафта и древнего города — причина, по которой регион часто входит в маршрут по Турции.",
          "В индивидуальном формате можно регулировать время у террас и насколько подробно вы хотите пройти Иераполис. Соседние точки можно вписать в тот же день или в более широкую связку Эгейского побережья и внутренней Анатолии. Готового почасового пакета мы не публикуем.",
          "Памуккале бывает отдельным днём и этапом более длинной поездки — например, с Каппадокией или Эгейским регионом. Что уместно, зависит от дат и расстояний.",
        ],
      },
      {
        id: "gobeklitepe",
        title: "Гёбеклитепе и Шанлыурфа",
        paragraphs: [
          "Гёбеклитепе — важная точка для тех, кого интересует археология на юго-востоке Анатолии. Монументальные каменные композиции и исторический контекст раскопок отличают визит от обычной городской прогулки. Датировки и интерпретации остаются предметом исследований; спорные утверждения мы здесь не повторяем.",
          "Шанлыурфа и окрестности дают естественную рамку, если Гёбеклитепе входит в более широкую поездку по юго-востоку. Старый город, кухня и соседние места можно совместить в одной программе или разнести по дням — по времени.",
          "Этот маршрут обычно комфортнее как полный день или несколько дней, чем как беглый заезд. Расстояния, ночёвки и другие остановки уточняем на этапе предложения.",
        ],
      },
      {
        id: "ephesus",
        title: "Эфес и Эгейский регион",
        paragraphs: [
          "Античный Эфес — одна из главных точек для тех, кого привлекает классическое наследие Эгейского побережья. Улицы и монументальные остатки лучше смотрятся в спокойном темпе, без спешки.",
          "В ту же поездку при наличии времени можно включить Сельчук, Ширинче и окрестности Измира. Кто-то едет только в Эфес, кто-то связывает побережье или внутренние остановки Эгейского региона. Выбор за вашей программой.",
          "Эфес можно спланировать как день из Измира или как часть более длинного эгейского маршрута. Дорога, время на объекте и возможные ночёвки обсуждаются в предложении.",
        ],
      },
      {
        id: "mardin",
        title: "Мардин и культурное наследие Месопотамии",
        paragraphs: [
          "Мардин выделяется на юго-востоке каменной архитектурой, старым городом на склоне и культурным многообразием. Узкие улицы, террасные дома и атмосфера исторического центра лучше открываются пешком, без спешки.",
          "Мардин можно планировать как самостоятельную цель или как пример более широкой юго-восточной поездки — вместе с Гёбеклитепе, Шанлыурфой или другими точками региона.",
          "Длительность и набор кварталов или соседних мест следуют вашему списку. Фиксированного пакетного расписания нет: программа собирается по запросу.",
        ],
      },
    ],
    moreTitle: "Турция этими местами не ограничивается",
    more: [
      "Каппадокия, Памуккале, Гёбеклитепе, Эфес и Мардин описаны здесь как примеры. Индивидуальные туры по Турции не сводятся к этим пяти направлениям.",
      "На Средиземном и Эгейском побережье это могут быть Анталья, Фетхие, Бодрум или Чешме; во внутренней Анатолии — Конья; на севере — Трабзон и черноморские маршруты. Юго-восток и другие регионы тоже можно обсуждать, если позволяют расстояния и логистика.",
      "Напишите, куда хотите поехать: подберём маршрут под длительность поездки, состав группы и ваши ожидания. Место, которого нет в этом списке, тоже можно включить, если поездку реально организовать.",
    ],
    planTitle: "Пусть поездка строится под вас",
    plan: [
      "Даты, число человек, точки старта и финиша, города и регионы, длительность, один день или ночёвки — это ваши решения. Программа может держаться одного города или связать несколько. Возврат в Стамбул возможен, как и окончание в другом городе.",
      "Один гость может начать в Стамбуле, провести несколько дней в Каппадокии и продолжить в Памуккале или по Эгейскому региону. Другому нужен только автомобиль с водителем к конкретной точке. Это примеры, а не готовые пакеты.",
      "По вашему плану обсуждаем транспортную рамку и общий ход дней. Отели, входные билеты, питание и сторонние активности по умолчанию не входят: состав предложения уточняется отдельно.",
    ],
    whyTitle: "Почему индивидуальный тур?",
    why: [
      {
        title: "Маршрут под вас",
        text: "Остановки и темп следуют вашему списку и времени, а не расписанию большой группы.",
      },
      {
        title: "Только своя компания",
        text: "Пара, семья или друзья едут вместе — в машине только ваши гости.",
      },
      {
        title: "Автомобиль с водителем",
        text: "Встреча и дневные переезды планируются на выделенном авто.",
      },
      {
        title: "Гибкая длительность",
        text: "И короткий выезд, и программа на несколько дней планируются одинаково внимательно.",
      },
      {
        title: "Несколько направлений",
        text: "Если хватает времени и расстояния позволяют, города можно связать в одну поездку.",
      },
      {
        title: "День или с ночёвками",
        text: "Возврат в тот же день или ночёвки между городами обсуждаются под ваш запрос.",
      },
    ],
    faqTitle: "Частые вопросы",
    faqs: [
      {
        question: "Как планируется индивидуальный тур по Турции?",
        answer:
          "Достаточно написать желаемые места, ориентировочные даты, число человек и нужен ли вам один день или ночёвки. По этим данным готовим предложение по туру и трансферу. Программа уточняется после вашего согласия с контуром.",
      },
      {
        question: "Программа фиксированная?",
        answer:
          "Нет. Это не продажа готового пакетного тура. Остановки, длительность и маршрут следуют вашему плану. Стандартного почасового itinerary мы не обещаем.",
      },
      {
        question: "Можно ли объединить несколько городов в одну поездку?",
        answer:
          "Да, если позволяют время и расстояния. Какие города войдут в одну нитку, решаем вместе с вашим календарём и предпочтениями.",
      },
      {
        question: "Тур обязательно однодневный?",
        answer:
          "Нет. Возможны и однодневные выезды, и программы на несколько дней. Длительность зависит от вашего графика.",
      },
      {
        question: "Можно ли подготовить программу с ночёвками?",
        answer:
          "Да. Можно обсудить несколько ночей в одном месте или переезды между городами. Проживание не входит в цену автоматически; отели и состав услуг уточняются по запросу.",
      },
      {
        question: "Тур обязательно начинается в Стамбуле?",
        answer:
          "Нет. Стамбул — частая, но не обязательная точка старта. Начало или окончание в другом городе можно спланировать, если это операционно возможно.",
      },
      {
        question: "Можно ли подготовить маршрут для Каппадокии, Памуккале или другого направления?",
        answer:
          "Да. Направления на этой странице — примеры. Можно запросить и поездку в один регион, и более длинную связку нескольких точек.",
      },
      {
        question: "Что входит в стоимость?",
        answer:
          "Предложение строится вокруг вашего плана. Обычно уточняем рамку индивидуального автомобиля с водителем. Что именно включено, перечисляется в оффере; универсальной пакетной цены нет.",
      },
      {
        question: "Входы и активности входят автоматически?",
        answer:
          "Нет. Билеты в музеи и на объекты, питание, полёты на шаре, ATV и похожие сторонние услуги по умолчанию не включены. Если хотите добавить их, отдельно смотрим доступность и условия оператора.",
      },
    ],
    finalTitle: "Расскажите, какую поездку вы задумали",
    finalLead:
      "Напишите направления, даты, число человек и общий план. Подготовим предложение по индивидуальному туру и трансферу.",
  },
  ar: {
    metaTitle:
      "جولات خاصة في تركيا | كبادوكيا وباموكالي ومسارات مخصّصة | Tripetica",
    metaDescription:
      "خطّطوا جولة خاصة وبرنامجاً بسائق خاص عبر تركيا — كبادوكيا وباموكالي وغوبيكلي تبه وأفسس وماردين وما بعدها — وفق تواريخكم ومجموعتكم ووتيرتكم.",
    heroAlt:
      "جولات خاصة في تركيا تشمل كبادوكيا وباموكالي وغوبيكلي تبه وأفسس ووجهات أخرى",
    kicker: "جولات خاصة في تركيا",
    h1: "جولات خاصة في تركيا – مسارات مخصّصة وتخطيط للسفر",
    heroLead: [
      "يمكنكم استكشاف مدن تركيا التاريخية ومناظرها الطبيعية وساحلها وتراثها الثقافي وفق جدول يخصّكم. تخطّط Tripetica برامج خاصة بسائق خاص للأزواج والعائلات والأصدقاء والمجموعات الصغيرة.",
      "يمكن أن تكون الرحلة يوماً واحداً، أو عدة أيام، أو إقامة مع مبيت، أو مساراً يربط أكثر من مدينة، أو سفرة بنقطتي بداية ونهاية مختلفتين. لستم مضطرين لشراء باقة ثابتة. نشكل المسار حول الطريقة التي تريدون السفر بها فعلاً.",
    ],
    quoteCta: "اطلب عرض سعر",
    highlights: [
      { title: "النوع", text: "برنامج خاص مصمّم لكم" },
      { title: "التغطية", text: "تخطيط في أنحاء تركيا" },
      { title: "التنقّل", text: "سيارة خاصة وسائق خاص" },
      { title: "المدة", text: "رحلة ليوم واحد أو مع مبيت" },
      { title: "المسار", text: "وجهة واحدة أو عدة مدن" },
      { title: "البداية والنهاية", text: "نقاط تختارونها أنتم" },
    ],
    destinations: [
      {
        id: "cappadocia",
        title: "جولة كبادوكيا الخاصة",
        paragraphs: [
          "كبادوكيا من أشهر مناطق السفر في تركيا. حول غوريمة تجلس المداخن الجنية والوديان والتكوينات الصخرية والمدن تحت الأرض معاً كمنظر طبيعي واستيطان تاريخي. تناسب المنطقة زيارة مركّزة أو إقامة أهدأ لعدة أيام.",
          "يعامل بعض الضيوف كبادوكيا كيوم واحد مكثّف؛ ويريد آخرون وقتاً أطول في الوديان أو القرى أو مع توقفات قريبة. تتبع الوتيرة وما يُدرج الوقت المتاح وما تريدون رؤيته أكثر.",
          "ركوب المنطاد تجربة يُسأل عنها كثيراً هنا. تشغّلها أطراف ثالثة وتعتمد على التوفّر والطقس وشروط المشغّل. لا ينبغي افتراض شمولها في سعر جولة Tripetica. أخبرونا إذا رغبتم بإدراجها، وسننظر في ما هو واقعي.",
        ],
      },
      {
        id: "pamukkale",
        title: "باموكالي وهييرابوليس",
        paragraphs: [
          "تُعرف باموكالي بمدرجاتها الترافرتينية البيضاء؛ وتضيف هييرابوليس المجاورة طبقة أثرية. هذا الاقتران بين الجيولوجيا ومدينة قديمة هو سبب إدراج كثير من المسافرين المنطقة في برنامج تركيا.",
          "في زيارة خاصة يمكن ضبط الوقت عند المدرجات ومدى تفصيلكم في مشي هييرابوليس. يمكن أن تجلس توقفات قريبة في اليوم نفسه أو ضمن ربط أوسع بين إيجة والداخل. لا ننشر جدولاً ثابتاً بتوقيت ساعة لباقة جاهزة.",
          "يمكن أن تكون باموكالي يوماً مستقلاً، أو مرحلة في رحلة أطول تشمل أيضاً كبادوكيا أو منطقة إيجة. الشكل المناسب يعتمد على تواريخكم والمسافات.",
        ],
      },
      {
        id: "gobeklitepe",
        title: "غوبيكلي تبه وشانلي أورفا",
        paragraphs: [
          "غوبيكلي تبه محطة أساسية للمسافرين المهتمين بعلم الآثار في جنوب شرق الأناضول. الترتيبات الحجرية الضخمة والسياق التاريخي للموقع يميّزانه عن نزهة مدينة اعتيادية. يبقى التأريخ والتفسير موضوع بحث مستمر؛ ولا نعتمد على مزاعم خلافية.",
          "تقدّم شانلي أورفا ومحيطها إطاراً طبيعياً إذا أردتم غوبيكلي تبه ضمن رحلة أوسع في الجنوب الشرقي. يمكن أن يشارك المدينة القديمة والطعام المحلي والأماكن القريبة البرنامج نفسه أو يوماً منفصلاً، وفق الوقت.",
          "هذا المسار عادة أكثر راحة كيوم كامل أو خطة لعدة أيام منه كنظرة متعجّلة. تُوضَّح المسافات والمبيت والتوقفات الأخرى عند إعداد عرض السعر.",
        ],
      },
      {
        id: "ephesus",
        title: "أفسس ومنطقة إيجة",
        paragraphs: [
          "مدينة أفسس القديمة معلم للمسافرين المنجدبين إلى إيجة الكلاسيكية. تكافئ الشوارع والبقايا الأثرية الضخمة زيارة بوتيرة هادئة لا متعجّلة.",
          "يمكن أن تجلس سلجوق وشيرينجه ومنطقة إزمير الأوسع في البرنامج نفسه إذا توفر الوقت. يركّز بعض الضيوف على أفسس فقط؛ ويريد آخرون توقفات ساحلية أو داخلية في إيجة في الرحلة نفسها. هذا الاختيار لكم.",
          "يمكن تخطيط أفسس كيوم من إزمير أو كجزء من مسار إيجي أطول. تُناقش مدة الطريق ووقت الموقع وأي مبيت في عرض السعر.",
        ],
      },
      {
        id: "mardin",
        title: "ماردين والتراث الثقافي لبلاد الرافدين",
        paragraphs: [
          "تبرز ماردين في جنوب شرق الأناضول بعمارتها الحجرية ومدينتها القديمة على المنحدر ومزيجها الثقافي. الأزقة الضيقة والبيوت المدرّجة والمركز التاريخي أفضل سيراً منها عبورًا متعجّلاً.",
          "يمكنكم زيارة ماردين كوجهة قائمة بذاتها، أو كمثال ضمن برنامج أوسع في الجنوب الشرقي يشمل أيضاً غوبيكلي تبه أو شانلي أورفا أو توقفات إقليمية أخرى.",
          "مدة الإقامة والأحياء أو الأماكن القريبة التي تدرجونها تتبع قائمتكم. لا يوجد جدول باقة ثابت؛ يُبنى البرنامج من طلبكم.",
        ],
      },
    ],
    moreTitle: "هناك المزيد من تركيا لاستكشافه",
    more: [
      "تظهر كبادوكيا وباموكالي وغوبيكلي تبه وأفسس وماردين في هذه الصفحة كأمثلة. الجولات الخاصة في تركيا ليست مقتصرة على هذه الأماكن الخمسة.",
      "يمكن تناول توقفات المتوسط وإيجة مثل أنطاليا وفتحية وبودروم أو تشيشمه؛ وقونية في وسط الأناضول؛ وطرابزون وداخل البحر الأسود بالطريقة نفسها، وفق عدد الأيام المتاحة. ويمكن مناقشة جنوب شرق الأناضول ومناطق أخرى حيث تسمح المسافات والعمليات.",
      "أخبرونا إلى أين تريدون الذهاب. سنعمل على مسار يناسب مدة سفركم وحجم مجموعتكم وتوقعاتكم. يمكن إدراج مكان غير مذكور هنا إذا كان تشغيله ممكناً.",
    ],
    planTitle: "دعوا الرحلة تتبع خطتكم",
    plan: [
      "أنتم تحدّدون التواريخ وحجم المجموعة ونقطتي البداية والنهاية والمدن أو المناطق التي تهمّكم ومدة السفر وما إذا كانت الرحلة نزهة ليوم واحد أو تشمل مبيتاً. يمكن أن يبقى البرنامج مع مدينة واحدة أو يربط عدة مدن. العودة إلى إسطنبول ممكنة؛ وكذلك الإنهاء في مدينة أخرى.",
      "قد يبدأ ضيف في إسطنبول ويقضي أياماً في كبادوكيا ثم يواصل إلى باموكالي أو إيجة. وقد يحتاج آخر سيارة خاصة وسائقاً خاصاً لوجهة واحدة فقط. هذه إيضاحات، لا منتجات مغلفة.",
      "من الخطة التي تشاركونها نناقش إطار النقل والتدفّق العام للأيام. الفنادق وتذاكر المتاحف والوجبات وأنشطة الأطراف الثالثة غير مشمولة افتراضياً؛ يُفصَّل النطاق في عرض السعر.",
    ],
    whyTitle: "لماذا جولة خاصة؟",
    why: [
      {
        title: "مسار يخصّكم",
        text: "تتبع التوقفات والوتيرة قائمتكم ووقتكم، لا جدول حافلة مجموعة كبيرة.",
      },
      {
        title: "السفر مع مجموعتكم",
        text: "يسافر الأزواج والعائلات والأصدقاء معاً — ضيوفكم فقط في السيارة.",
      },
      {
        title: "سيارة خاصة وسائق خاص",
        text: "يُخطَّط الاستلام والتنقّل خلال اليوم بسيارة مخصّصة وسائق.",
      },
      {
        title: "مدة مرنة",
        text: "تستخدم النزهة القصيرة وبرنامج الأيام المتعددة نهج التخطيط نفسه.",
      },
      {
        title: "أكثر من وجهة",
        text: "حيث يسمح الوقت والمسافات، يمكن ربط المدن في رحلة واحدة.",
      },
      {
        title: "يوم واحد أو مبيت",
        text: "يمكن مناقشة العودة في اليوم نفسه أو الإقامات بين المدن وفق احتياجاتكم.",
      },
    ],
    faqTitle: "أسئلة شائعة",
    faqs: [
      {
        question: "كيف تُخطَّط جولة خاصة في تركيا؟",
        answer:
          "شاركوا الأماكن التي تفكّرون فيها والتواريخ التقريبية وحجم المجموعة وما إذا كنتم تريدون رحلة ليوم واحد أو مبيتاً. نُعدّ عرض سعر حول الجولة الخاصة والنقل. يُؤكَّد البرنامج بعد موافقتكم على المخطط.",
      },
      {
        question: "هل البرنامج ثابت؟",
        answer:
          "لا. هذه ليست جولة باقة جاهزة. تتبع التوقفات والتوقيت والمسار خطتكم. لا نعد ببرنامج قياسي بتوقيت ساعة.",
      },
      {
        question: "هل يمكن جمع عدة مدن في رحلة واحدة؟",
        answer:
          "نعم، إذا سمح الوقت والمسافات. تُقرَّر المدن التي تجلس على المسار نفسه مع تقويمكم وتفضيلاتكم.",
      },
      {
        question: "هل يجب أن تكون الجولة رحلة ليوم واحد؟",
        answer:
          "لا. نزهات اليوم الواحد وبرامج الأيام المتعددة ممكنة معاً. تتبع المدة تقويم سفركم.",
      },
      {
        question: "هل يمكنكم تخطيط رحلة مع مبيت؟",
        answer:
          "نعم. يمكن مناقشة برامج تقيم عدة ليال في مكان واحد أو تنتقل بين المدن. الإقامة غير مشمولة تلقائياً في السعر؛ تُوضَّح الفنادق وما يُغطّى عند الطلب.",
      },
      {
        question: "هل يجب أن تبدأ الجولة من إسطنبول؟",
        answer:
          "لا. إسطنبول نقطة انطلاق شائعة، لا شرط. يمكن تخطيط البداية أو النهاية في مدينة أخرى حيث يكون ذلك ممكناً تشغيلياً.",
      },
      {
        question: "هل يمكنكم إعداد مسار مخصّص لكبادوكيا أو باموكالي أو وجهة أخرى؟",
        answer:
          "نعم. الوجهات في هذه الصفحة أمثلة. يمكنكم طلب زيارة مركّزة لمنطقة واحدة أو مساراً أطول يربط عدة توقفات.",
      },
      {
        question: "ماذا يشمل السعر؟",
        answer:
          "يُبنى عرض السعر حول الخطة التي تشاركونها. يُوضَّح النطاق عادة حول سيارة خاصة وسائق خاص. يُدرج ما هو مشمول في العرض؛ ولا توجد تعرفة باقة شاملة افتراضية.",
      },
      {
        question: "هل الأنشطة ورسوم الدخول مشمولة تلقائياً؟",
        answer:
          "لا. تذاكر المتاحف والمواقع والوجبات ورحلات المنطاد وجولات الدراجات الرباعية والخدمات المشابهة من أطراف ثالثة غير مشمولة افتراضياً. إذا رغبتم بإضافتها، يُراجع التوفّر وشروط المشغّل بشكل منفصل.",
      },
    ],
    finalTitle: "أخبرونا عن الرحلة التي تفكّرون فيها",
    finalLead:
      "شاركوا الأماكن التي تريدون زيارتها وتواريخ سفركم وحجم المجموعة والمخطط العام. سنُعدّ عرض سعر لجولة خاصة وخطة نقل حولها.",
  },
};
