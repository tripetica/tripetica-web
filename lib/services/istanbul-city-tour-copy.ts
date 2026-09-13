import { type Locale } from "@/lib/i18n/config";

export type IstanbulCityTourCopy = {
  metaTitle: string;
  metaDescription: string;
  heroAlt: string;
  kicker: string;
  h1: string;
  heroLead: string;
  bookCta: string;
  halfDayHeroTitle: string;
  fullDayHeroTitle: string;
  halfDayTitle: string;
  halfDay: string[];
  fullDayTitle: string;
  fullDay: string[];
  guideTitle: string;
  guidedTitle: string;
  guided: string;
  independentTitle: string;
  independent: string;
  programTitle: string;
  program: string[];
  placesTitle: string;
  places: { title: string; text: string }[];
  diningTitle: string;
  dining: string[];
  extrasTitle: string;
  extrasLead: string;
  extras: { title: string; text: string }[];
  extrasNote: string;
  howTitle: string;
  how: { title: string; text: string }[];
  finalTitle: string;
  finalLead: string;
  bookHalfDayCta: string;
  bookFullDayCta: string;
};

export const istanbulCityTourCopy: Record<Locale, IstanbulCityTourCopy> = {
  tr: {
    metaTitle: "İstanbul Şehir Turu | Özel Araç ve Şoför | Tripetica",
    metaDescription:
      "6 veya 10 saatlik özel İstanbul şehir turuyla rotanızı kendiniz belirleyin. Özel araç ve profesyonel şoför hizmeti, isteğe bağlı turist rehberi.",
    heroAlt: "Özel araç ve şoförle İstanbul şehir turu",
    kicker: "İstanbul Şehir Turu",
    h1: "İstanbul Şehir Turu – Özel Araç ve Şoförle İstanbul’u Keşfedin",
    heroLead:
      "İstanbul’u kendi programınıza göre keşfedin. 6 saatlik yarım gün veya 10 saatlik tam gün özel İstanbul şehir turunda rotanızı kendiniz belirleyebilir ya da ilgi alanlarınıza ve ayırdığınız süreye göre size uygun bir program hazırlanmasını isteyebilirsiniz. Özel araç ve profesyonel şoför hizmetinin yanında, dilerseniz profesyonel kokartlı turist rehberi organize edilebilir, dilerseniz turunuzu rehbersiz gerçekleştirebilirsiniz.",
    bookCta: "Rezervasyon Yap",
    halfDayHeroTitle: "6 Saatlik Yarım Gün Turu",
    fullDayHeroTitle: "10 Saatlik Tam Gün Turu",
    halfDayTitle: "İstanbul Yarım Gün Turu – 6 Saat",
    halfDay: [
      "6 saatlik özel araç ve şoför hizmeti, İstanbul’da sınırlı zamanı olan veya belirli bir bölgeye yoğunlaşmak isteyen misafirler için uygundur. Yarım gün İstanbul turu, kenti aceleyle “bitirmeye” değil, seçtiğiniz süre içinde anlamlı bir güzergâh izlemeye yöneliktir.",
      "Programa, örneğin Sultanahmet, Ayasofya çevresi, Sultanahmet Camii, Hipodrom, Süleymaniye Camii, Tarihi Yarımada, Galata, Karaköy veya o güne uygun başka noktalar eklenebilir. Bunların tümünün 6 saatte ziyaret edileceği anlamına gelmez.",
      "Rota; alınış noktası, trafik koşulları, ziyaret süreleri, misafirin öncelikleri ve mevcut zamana göre planlanır.",
    ],
    fullDayTitle: "İstanbul Tam Gün Turu – 10 Saat",
    fullDay: [
      "10 saatlik tam gün İstanbul turu, daha kapsamlı ve esnek bir program isteyen misafirler içindir. Özel araçla İstanbul turunda süre uzadıkça farklı semtleri bir arada düşünmek kolaylaşır; yine de gün, sizin temponuza göre kurulur.",
      "Tarihi Yarımada, Sultanahmet, Ayasofya, Süleymaniye, Galata, Karaköy, Ortaköy, İstanbul Boğazı kıyıları ve uygun diğer bölgeler programa dahil edilebilir. Yemek molası, alışveriş veya serbest zaman da günün akışına eklenebilir.",
      "Kesin bir güzergâh sözü verilmez. Program, tercihlerinize, trafiğe ve ziyaret sürelerine göre planlanır.",
    ],
    guideTitle: "İstanbul’u Rehberle veya Kendi Programınızla Keşfedin",
    guidedTitle: "Profesyonel Rehberli Tur",
    guided:
      "İstanbul’un tarihini, kültürünü ve önemli yapılarını daha detaylı öğrenmek isteyen misafirler için müsaitliğe bağlı olarak profesyonel kokartlı turist rehberi organize edilebilir. Rehberlik dili talep ve müsaitliğe göre planlanır. Profesyonel turist rehberi ücreti temel araç ve şoför hizmetine dahil değildir.",
    independentTitle: "Rehbersiz Özel Tur",
    independent:
      "İstanbul’u kendi temposunda gezmek isteyen misafirler, özel araç ve profesyonel şoförle rehbersiz tur yapabilir. Kendi hazır programınızı iletebilir, görmek istediğiniz noktaları belirtebilir veya Tripetica’dan program ve rota önerisi isteyebilirsiniz.",
    programTitle: "Programınızı Kendiniz Belirleyin veya Rota Önerisi İsteyin",
    program: [
      "Bu hizmetin hazır ve zorunlu bir tur güzergâhı yoktur. Şoförlü İstanbul turunda kendi listeniz varsa şoför o programa göre hareket eder.",
      "Hazır bir listeniz yoksa tarih, kültür, Boğaz, alışveriş, fotoğraf noktaları, restoran veya farklı ilgi alanlarınıza göre operasyonel bir program önerisi hazırlanabilir.",
      "Bu ücretsiz rota önerisi, profesyonel turist rehberliği değildir. Rehberlik ayrı bir seçenektir; şoförünüz ulaşım ve günün akışını sizin tercihinize göre yürütür.",
    ],
    placesTitle: "İstanbul Şehir Turunda Görülebilecek Yerler",
    places: [
      {
        title: "Sultanahmet ve Tarihi Yarımada",
        text: "Ayasofya, Sultanahmet Camii, Hipodrom ve çevresindeki tarihi doku, özel İstanbul turlarında sık tercih edilen bir başlangıçtır. Süreye göre meydan çevresinde duraklar bir arada planlanabilir.",
      },
      {
        title: "Süleymaniye",
        text: "Süleymaniye Camii, Tarihi Yarımada siluetinde belirgin bir duraktır. Haliç’e bakan konumuyla kısa bir ziyaret veya dışarıdan bir bakış için programa eklenebilir.",
      },
      {
        title: "Galata ve Karaköy",
        text: "Galata ve Karaköy, tarihi doku ile çağdaş kent hayatının yan yana geldiği bir bölgedir. Yürünebilir sokaklar, kule çevresi ve kıyı, süre uygunsa güzergâha alınabilir.",
      },
      {
        title: "Ortaköy ve İstanbul Boğazı",
        text: "Boğaz kıyısı, Ortaköy ve sahil güzergâhı manzara ve kısa duraklar için tercih edilebilir. Trafik ve kalan zamana göre kıyı programı şekillenir.",
      },
      {
        title: "Diğer noktalar",
        text: "Zamanınıza ve tercihlerinize göre başka İstanbul bölgeleri de eklenebilir. Amaç, listenin tamamını zorlamak değil, ayırdığınız süreye uygun bir akış kurmaktır.",
      },
    ],
    diningTitle: "Yemek ve Restoran Tercihi Size Ait",
    dining: [
      "Tur sırasında yemek molası isterseniz seçiminiz size aittir. Belirli bir restoranınız varsa şoför sizi oraya götürebilir.",
      "Öneri isterseniz Türk mutfağı, balık restoranı, Boğaz manzaralı mekan, ekonomik, orta segment veya daha lüks seçenekler gibi tercihlerinize göre birkaç uygun alternatif paylaşılabilir. Seçimi siz yaparsınız; belirli bir restorana yönlendirilmezsiniz.",
      "Restoran ve yemek ücretleri tur ücretine dahil değildir ve misafir tarafından doğrudan ödenir.",
    ],
    extrasTitle: "İsteğe Bağlı Ek Hizmetler",
    extrasLead:
      "Temel ürün, seçilen süre boyunca özel araç, profesyonel şoför ve programınıza göre ulaşım hizmetidir. Aşağıdakiler talep üzerine organize edilebilir; araç ve şoför ücretine otomatik dahil değildir.",
    extras: [
      {
        title: "Profesyonel turist rehberi",
        text: "Müsaitliğe bağlı olarak kokartlı rehber ayarlanabilir. Ücret ayrıdır.",
      },
      {
        title: "Müze ve ören yeri girişleri",
        text: "Biletler misafir tarafından alınır veya ayrıca organize edilir.",
      },
      {
        title: "Restoran ve yemek",
        text: "Mola ve mekan seçimi size aittir; hesap doğrudan restorana ödenir.",
      },
      {
        title: "Boğaz’da tekne veya yat",
        text: "Özel tekne, yat veya benzeri deneyimler talep ve müsaitliğe bağlıdır.",
      },
    ],
    extrasNote:
      "Diğer üçüncü taraf hizmetleri de aynı şekilde ayrıca planlanır. Rezervasyonda neyin dahil olduğunu netleştirmek için tercihlerinizi yazmanız yeterlidir.",
    howTitle: "İstanbul Şehir Turu Nasıl Çalışır?",
    how: [
      {
        title: "Tur sürenizi seçin",
        text: "6 saatlik yarım gün veya 10 saatlik tam gün seçeneklerinden birini belirleyin.",
      },
      {
        title: "Alış noktanızı belirleyin",
        text: "Otel, konaklama adresi, havalimanı veya uygun başka bir nokta kullanılabilir.",
      },
      {
        title: "Programınızı belirleyin",
        text: "Kendi rotanızı iletin veya ilgi alanlarınıza göre öneri isteyin.",
      },
      {
        title: "Rehber tercihinizi yapın",
        text: "İsterseniz profesyonel turist rehberi talep edin; isterseniz rehbersiz devam edin.",
      },
      {
        title: "İstanbul’u keşfedin",
        text: "Özel araç ve şoför, seçilen süre boyunca programınıza göre hizmet verir.",
      },
      {
        title: "Bırakılacağınız noktayı belirleyin",
        text: "Tur sonunda otel veya uygun başka bir varış noktası seçebilirsiniz.",
      },
    ],
    finalTitle: "İstanbul Turunuzu Kendi Programınıza Göre Planlayın",
    finalLead:
      "6 saatlik yarım gün veya 10 saatlik tam gün turunuzu seçin; İstanbul’u özel araç ve profesyonel şoförle kendi temponuzda keşfedin.",
    bookHalfDayCta: "6 Saatlik Turu Rezerve Et",
    bookFullDayCta: "10 Saatlik Turu Rezerve Et",
  },
  en: {
    metaTitle: "Istanbul City Tour | Private Car and Chauffeur | Tripetica",
    metaDescription:
      "Plan a private Istanbul city tour for 6 or 10 hours. Travel by private car with a professional chauffeur, follow your own route, and add a licensed guide if you wish.",
    heroAlt: "Istanbul city tour with private car and chauffeur",
    kicker: "Istanbul City Tour",
    h1: "Istanbul City Tour with Private Car and Chauffeur",
    heroLead:
      "Discover Istanbul at your own pace with a private car and professional chauffeur. Choose a 6-hour half-day or 10-hour full-day tour, follow your own itinerary or request a route based on your interests and available time. A licensed professional tour guide can be arranged on request, or you can enjoy the city independently without a guide.",
    bookCta: "Book Now",
    halfDayHeroTitle: "6-Hour Half-Day Tour",
    fullDayHeroTitle: "10-Hour Full-Day Tour",
    halfDayTitle: "Istanbul Half-Day Tour – 6 Hours",
    halfDay: [
      "A 6-hour private car and chauffeur is a practical choice if your time in Istanbul is limited or you want to stay in one part of the city. A half-day Istanbul tour is about using those hours well, not rushing through a fixed circuit.",
      "The day might include Sultanahmet, the area around Hagia Sophia, the Blue Mosque, the Hippodrome, Süleymaniye Mosque, the Historic Peninsula, Galata, Karaköy or other stops that fit the day. That does not mean every place on this list will be visited in six hours.",
      "The route is planned around your pickup point, traffic, how long you spend at each stop, your priorities and the time you have.",
    ],
    fullDayTitle: "Istanbul Full-Day Tour – 10 Hours",
    fullDay: [
      "A 10-hour full-day tour suits guests who want a broader, more flexible private Istanbul tour. Extra hours make it easier to connect different neighbourhoods, still at your own pace.",
      "The Historic Peninsula, Sultanahmet, Hagia Sophia, Süleymaniye, Galata, Karaköy, Ortaköy, the Bosphorus waterfront and other fitting areas can be part of the day. A meal break, shopping or free time can be built in as well.",
      "There is no promised set itinerary. The programme is planned around your preferences, traffic and the time you spend at each place.",
    ],
    guideTitle: "Explore Istanbul with a Guide or on Your Own Itinerary",
    guidedTitle: "Guided private tour",
    guided:
      "If you want more context on Istanbul’s history, culture and landmarks, a licensed professional tour guide can be arranged subject to availability. The guiding language is planned according to your request and who is available. The guide fee is not included in the private car and chauffeur rate.",
    independentTitle: "Independent private tour",
    independent:
      "If you prefer to see Istanbul at your own pace, you can travel with a private car and chauffeur and without a guide. Send your own itinerary, list the places you want to see, or ask Tripetica for a suggested route.",
    programTitle: "Set Your Own Programme or Ask for a Suggested Route",
    program: [
      "This is not a locked sightseeing package. If you already have a plan, the chauffeur follows it.",
      "If you do not, we can suggest an operational route around history, culture, the Bosphorus, shopping, photo stops, restaurants or other interests.",
      "That planning help is not the same as a licensed tour guide. Guiding is a separate option; your chauffeur handles transport and the flow of the day according to your choices.",
    ],
    placesTitle: "Places You Can See on an Istanbul City Tour",
    places: [
      {
        title: "Sultanahmet and the Historic Peninsula",
        text: "Hagia Sophia, the Blue Mosque, the Hippodrome and the historic fabric around them are a frequent starting point for a private city tour. Stops around the square can be grouped when time allows.",
      },
      {
        title: "Süleymaniye",
        text: "Süleymaniye Mosque is a clear landmark on the Historic Peninsula skyline. Its setting above the Golden Horn can work as a short visit or a view from outside.",
      },
      {
        title: "Galata and Karaköy",
        text: "Galata and Karaköy sit where older streets meet a more contemporary waterfront. Walkable lanes, the tower area and the shore can join the route when the schedule fits.",
      },
      {
        title: "Ortaköy and the Bosphorus",
        text: "The Bosphorus shoreline, Ortaköy and nearby coastal stretches suit views and brief stops. Traffic and remaining time shape how much of the waterfront you use.",
      },
      {
        title: "Other areas",
        text: "Other parts of Istanbul can be added according to your time and interests. The aim is a route that fits the hours you booked, not a list you have to finish.",
      },
    ],
    diningTitle: "Meals and Restaurants Are Your Choice",
    dining: [
      "If you want a meal break during the tour, the choice is yours. If you already have a restaurant in mind, the chauffeur can take you there.",
      "If you would like suggestions, we can share a few suitable options based on what you prefer: Turkish cuisine, a fish restaurant, a Bosphorus view, a simpler meal, a mid-range table or something more formal. You choose; you are not steered to a required venue.",
      "Restaurant and meal costs are not included in the tour rate and are paid directly by the guest.",
    ],
    extrasTitle: "Optional extras",
    extrasLead:
      "What you book is private car, professional chauffeur and transport for your programme during the hours you choose. The following can be organised on request and are not automatically included in that rate.",
    extras: [
      {
        title: "Licensed tour guide",
        text: "A professional guide can be arranged when available. The fee is separate.",
      },
      {
        title: "Museum and site tickets",
        text: "Admission is paid by the guest or arranged separately.",
      },
      {
        title: "Restaurants and meals",
        text: "You choose the stop; the bill is paid at the restaurant.",
      },
      {
        title: "Private boat or yacht on the Bosphorus",
        text: "Boat or yacht experiences depend on request and availability.",
      },
    ],
    extrasNote:
      "Other third-party services are planned the same way. Share what you want when you book so the day is clear.",
    howTitle: "How the Istanbul City Tour Works",
    how: [
      {
        title: "Choose your tour length",
        text: "Select a 6-hour half-day or a 10-hour full-day booking.",
      },
      {
        title: "Set your pickup point",
        text: "A hotel, another stay address, an airport or another suitable point can be used.",
      },
      {
        title: "Decide the programme",
        text: "Send your own route or ask for a suggestion based on your interests.",
      },
      {
        title: "Choose guiding",
        text: "Request a licensed professional tour guide, or continue without one.",
      },
      {
        title: "Explore Istanbul",
        text: "The private car and chauffeur follow your programme for the booked hours.",
      },
      {
        title: "Choose where you are dropped off",
        text: "At the end of the tour you can return to your hotel or another suitable point.",
      },
    ],
    finalTitle: "Plan Your Istanbul Tour Around Your Own Programme",
    finalLead:
      "Choose a 6-hour half-day or 10-hour full-day tour and see Istanbul at your own pace in a private car with a professional chauffeur.",
    bookHalfDayCta: "Book the 6-Hour Tour",
    bookFullDayCta: "Book the 10-Hour Tour",
  },
  ru: {
    metaTitle:
      "Обзорная экскурсия по Стамбулу | Автомобиль с водителем | Tripetica",
    metaDescription:
      "Частная обзорная экскурсия по Стамбулу на 6 или 10 часов: свой маршрут, автомобиль с профессиональным водителем и лицензированный гид по желанию.",
    heroAlt: "Обзорная экскурсия по Стамбулу на частном автомобиле с водителем",
    kicker: "Обзорная экскурсия по Стамбулу",
    h1: "Обзорная экскурсия по Стамбулу на частном автомобиле с водителем",
    heroLead:
      "Откройте Стамбул в своём ритме: частный автомобиль и профессиональный водитель на 6 часов (полдня) или на 10 часов (полный день). Маршрут можно составить самостоятельно или попросить программу под ваши интересы и доступное время. По желанию организуется лицензированный гид; можно путешествовать и без гида.",
    bookCta: "Забронировать",
    halfDayHeroTitle: "Полудневная программа — 6 часов",
    fullDayHeroTitle: "Полнодневная программа — 10 часов",
    halfDayTitle: "Полудневная экскурсия по Стамбулу — 6 часов",
    halfDay: [
      "Шесть часов с частным автомобилем и водителем удобны, если время в городе ограничено или хочется сосредоточиться на одном районе. Полудневная программа нужна не для того, чтобы «успеть всё», а чтобы осмысленно провести выбранные часы.",
      "В маршрут могут войти Султанахмет, район Айя-Софии, Голубая мечеть, Ипподром, мечеть Сулеймание, Исторический полуостров, Галата, Каракёй или другие подходящие точки. Это не обещание посетить все перечисленные места за шесть часов.",
      "Маршрут планируется с учётом точки подачи, пробок, времени на остановки, ваших приоритетов и реально доступных часов.",
    ],
    fullDayTitle: "Полнодневная экскурсия по Стамбулу — 10 часов",
    fullDay: [
      "Десять часов подходят тем, кто хочет более широкую и гибкую программу по Стамбулу. Дополнительное время позволяет связать разные районы, сохраняя ваш темп.",
      "В день могут войти Исторический полуостров, Султанахмет, Айя-София, Сулеймание, Галата, Каракёй, Ортакёй, набережная Босфора и другие уместные районы. Можно заложить обед, покупки или свободное время.",
      "Фиксированный маршрут не обещается. Программа строится под ваши предпочтения, дорожную ситуацию и продолжительность остановок.",
    ],
    guideTitle: "С гидом или по собственной программе",
    guidedTitle: "С профессиональным гидом",
    guided:
      "Если хотите глубже понять историю, культуру и ключевые памятники Стамбула, при наличии свободных гидов можно организовать лицензированного профессионального гида. Язык сопровождения согласуется по запросу и доступности. Стоимость гида не входит в тариф на автомобиль и водителя.",
    independentTitle: "Без гида",
    independent:
      "Если предпочитаете смотреть город самостоятельно, поездка проходит с частным автомобилем и водителем, без гида. Можно прислать готовый план, перечислить места, которые хотите увидеть, или попросить у Tripetica предложение по маршруту.",
    programTitle: "Свой маршрут или рекомендация по программе",
    program: [
      "Это не пакет с обязательным списком достопримечательностей. Если у вас уже есть план, водитель следует ему.",
      "Если плана нет, можно подготовить операционное предложение: история, культура, Босфор, покупки, фототочки, рестораны или другие интересы.",
      "Такая помощь с маршрутом не заменяет лицензированного гида. Гид — отдельная опция; водитель обеспечивает транспорт и ритм дня по вашему выбору.",
    ],
    placesTitle: "Что можно увидеть на обзорной экскурсии по Стамбулу",
    places: [
      {
        title: "Султанахмет и Исторический полуостров",
        text: "Айя-София, Голубая мечеть, Ипподром и историческая ткань вокруг площади — частая отправная точка частной программы. При достаточном времени остановки в этом районе можно сгруппировать.",
      },
      {
        title: "Сулеймание",
        text: "Мечеть Сулеймание хорошо читается в силуэте Исторического полуострова. Расположение над Золотым Рогом подходит для короткого визита или вида снаружи.",
      },
      {
        title: "Галата и Каракёй",
        text: "Галата и Каракёй — место, где старые улицы соседствуют с современной набережной. Пешеходные кварталы, район башни и берег можно включить, если позволяет график.",
      },
      {
        title: "Ортакёй и Босфор",
        text: "Берег Босфора, Ортакёй и прибрежные участки удобны для видов и коротких остановок. Объём программы по набережной зависит от пробок и оставшегося времени.",
      },
      {
        title: "Другие районы",
        text: "По времени и интересам можно добавить и другие части Стамбула. Задача — маршрут под забронированные часы, а не обязательный список «на все точки».",
      },
    ],
    diningTitle: "Еда и ресторан — на ваш выбор",
    dining: [
      "Если во время поездки нужна пауза на обед, выбор за вами. Если ресторан уже выбран, водитель довезёт вас туда.",
      "Если нужны идеи, можно предложить несколько подходящих вариантов: турецкая кухня, рыбный ресторан, вид на Босфор, более доступный чек, средний сегмент или более торжественный стол. Решение принимаете вы; к конкретному заведению вас не обязывают.",
      "Счёт за ресторан и еду в стоимость тура не входит и оплачивается гостем напрямую.",
    ],
    extrasTitle: "Дополнительные услуги по запросу",
    extrasLead:
      "В основе услуги — частный автомобиль, профессиональный водитель и транспорт по вашей программе на выбранное время. Ниже перечислено то, что можно организовать отдельно; в тариф автомобиля и водителя это автоматически не входит.",
    extras: [
      {
        title: "Профессиональный гид",
        text: "Лицензированный гид при наличии. Оплата отдельно.",
      },
      {
        title: "Билеты в музеи и на объекты",
        text: "Вход оплачивает гость или оформляется отдельно.",
      },
      {
        title: "Рестораны и питание",
        text: "Место выбираете вы; счёт оплачивается в заведении.",
      },
      {
        title: "Катер или яхта на Босфоре",
        text: "Прогулка на воде — по запросу и при наличии.",
      },
    ],
    extrasNote:
      "Прочие услуги третьих сторон планируются так же. Напишите пожелания при бронировании, чтобы день был понятен заранее.",
    howTitle: "Как проходит обзорная экскурсия по Стамбулу",
    how: [
      {
        title: "Выберите продолжительность",
        text: "Полдня — 6 часов или полный день — 10 часов.",
      },
      {
        title: "Укажите место подачи",
        text: "Отель, другой адрес проживания, аэропорт или иная удобная точка.",
      },
      {
        title: "Согласуйте программу",
        text: "Пришлите свой маршрут или попросите предложение под ваши интересы.",
      },
      {
        title: "Решите вопрос с гидом",
        text: "Можно запросить лицензированного гида или ехать без сопровождения.",
      },
      {
        title: "Смотрите Стамбул",
        text: "Автомобиль и водитель работают по вашей программе в течение оплаченных часов.",
      },
      {
        title: "Выберите место высадки",
        text: "В конце дня — отель или другая подходящая точка.",
      },
    ],
    finalTitle: "Соберите поездку по Стамбулу под свой сценарий",
    finalLead:
      "Выберите 6-часовую программу на полдня или 10-часовую на весь день и смотрите Стамбул в своём темпе на частном автомобиле с профессиональным водителем.",
    bookHalfDayCta: "Забронировать 6 часов",
    bookFullDayCta: "Забронировать 10 часов",
  },
  ar: {
    metaTitle: "جولة إسطنبول | سيارة خاصة وسائق خاص | Tripetica",
    metaDescription:
      "خطّطوا جولة إسطنبول خاصة لمدة 6 أو 10 ساعات. سافروا بسيارة خاصة مع سائق خاص محترف، اتبعوا مساركم، وأضيفوا مرشداً سياحياً مرخّصاً إن رغبتم.",
    heroAlt: "جولة إسطنبول بسيارة خاصة وسائق خاص",
    kicker: "جولة إسطنبول",
    h1: "جولة إسطنبول بسيارة خاصة وسائق خاص",
    heroLead:
      "اكتشفوا إسطنبول وفق وتيرتكم بسيارة خاصة وسائق خاص محترف. اختاروا جولة نصف يوم لمدة 6 ساعات أو جولة يوم كامل لمدة 10 ساعات، واتبعوا برنامجكم أو اطلبوا مساراً وفق اهتماماتكم والوقت المتاح. يمكن ترتيب مرشد سياحي مرخّص محترف عند الطلب، أو الاستمتاع بالمدينة باستقلال من دون مرشد.",
    bookCta: "احجز الآن",
    halfDayHeroTitle: "جولة نصف يوم لمدة 6 ساعات",
    fullDayHeroTitle: "جولة يوم كامل لمدة 10 ساعات",
    halfDayTitle: "جولة إسطنبول نصف يوم – 6 ساعات",
    halfDay: [
      "ست ساعات بسيارة خاصة وسائق خاص خيار عملي إذا كان وقتكم في إسطنبول محدوداً أو إذا رغبتم بالبقاء في جزء واحد من المدينة. جولة إسطنبول نصف يوم تعني استثمار تلك الساعات جيداً، لا الإسراع في مسار ثابت.",
      "قد يشمل اليوم السلطان أحمد، ومنطقة آيا صوفيا، والجامع الأزرق، وميدان السباق، وجامع السليمانية، وشبه الجزيرة التاريخية، وغلطة، وقراكوي أو توقفات أخرى تناسب اليوم. هذا لا يعني زيارة كل الأماكن المذكورة في ست ساعات.",
      "يُخطَّط المسار حول نقطة استلامكم، وحركة المرور، ومدة التوقّف في كل موقع، وأولوياتكم والوقت المتاح.",
    ],
    fullDayTitle: "جولة إسطنبول يوم كامل – 10 ساعات",
    fullDay: [
      "تناسب جولة اليوم الكامل لمدة 10 ساعات الضيوف الذين يريدون جولة إسطنبول خاصة أوسع وأكثر مرونة. الساعات الإضافية تسهّل الربط بين أحياء مختلفة، مع الإبقاء على وتيرتكم.",
      "يمكن أن يشمل اليوم شبه الجزيرة التاريخية والسلطان أحمد وآيا صوفيا والسليمانية وغلطة وقراكوي وأورتاكوي وكورنيش البوسفور ومناطق أخرى مناسبة. يمكن أيضاً إدراج استراحة طعام أو تسوّق أو وقت حر.",
      "لا يُوعَد ببرنامج ثابت. تُخطَّط الرحلة وفق تفضيلاتكم وحركة المرور والوقت الذي تقضونه في كل مكان.",
    ],
    guideTitle: "استكشفوا إسطنبول مع مرشد أو وفق برنامجكم",
    guidedTitle: "جولة خاصة بصحبة مرشد",
    guided:
      "إذا رغبتم بسياق أعمق عن تاريخ إسطنبول وثقافتها ومعالمها، يمكن ترتيب مرشد سياحي مرخّص محترف حسب التوفّر. تُخطَّط لغة الإرشاد وفق طلبكم ومن هو متاح. أجرة المرشد غير مشمولة في تعرفة السيارة والسائق الخاص.",
    independentTitle: "جولة خاصة من دون مرشد",
    independent:
      "إذا فضّلتم رؤية إسطنبول وفق وتيرتكم، يمكنكم السفر بسيارة خاصة وسائق خاص من دون مرشد. أرسلوا برنامجكم، أو اذكروا الأماكن التي تريدون رؤيتها، أو اطلبوا من Tripetica اقتراح مسار.",
    programTitle: "حدّدوا برنامجكم أو اطلبوا مسارًا مقترحًا",
    program: [
      "هذه ليست حزمة مشاهدة معالم مغلقة. إذا كان لديكم خطة جاهزة، يتبعها السائق الخاص.",
      "وإذا لم تكن لديكم خطة، يمكننا اقتراح مسار تشغيلي حول التاريخ والثقافة والبوسفور والتسوّق ونقاط التصوير والمطاعم أو اهتمامات أخرى.",
      "هذه المساعدة في التخطيط ليست بديلاً عن مرشد سياحي مرخّص. الإرشاد خيار منفصل؛ يتولى سائقكم النقل وتدفّق اليوم وفق اختياراتكم.",
    ],
    placesTitle: "أماكن يمكن رؤيتها في جولة إسطنبول",
    places: [
      {
        title: "السلطان أحمد وشبه الجزيرة التاريخية",
        text: "آيا صوفيا والجامع الأزرق وميدان السباق والنسيج التاريخي حولها نقطة انطلاق شائعة لجولة المدينة الخاصة. يمكن تجميع التوقفات حول الساحة عندما يسمح الوقت.",
      },
      {
        title: "السليمانية",
        text: "جامع السليمانية معلم واضح في أفق شبه الجزيرة التاريخية. موقعه فوق القرن الذهبي يناسب زيارة قصيرة أو إطلالة من الخارج.",
      },
      {
        title: "غلطة وقراكوي",
        text: "تلتقي في غلطة وقراكوي الشوارع الأقدم بواجهة بحرية أكثر معاصرة. يمكن أن تنضم الأزقة القابلة للمشي ومنطقة البرج والشاطئ إلى المسار عندما يناسب الجدول.",
      },
      {
        title: "أورتاكوي والبوسفور",
        text: "شاطئ البوسفور وأورتاكوي والمقاطع الساحلية القريبة تناسب الإطلالات والتوقفات القصيرة. تشكّل حركة المرور والوقت المتبقي حجم برنامج الكورنيش.",
      },
      {
        title: "مناطق أخرى",
        text: "يمكن إضافة أجزاء أخرى من إسطنبول وفق وقتكم واهتماماتكم. الهدف مسار يناسب الساعات المحجوزة، لا قائمة يجب إنهاؤها.",
      },
    ],
    diningTitle: "الوجبات والمطاعم اختياركم",
    dining: [
      "إذا رغبتم باستراحة طعام خلال الجولة، فالاختيار لكم. وإذا كان لديكم مطعم محدد، يمكن للسائق الخاص أن يوصلكم إليه.",
      "إذا رغبتم باقتراحات، يمكننا مشاركة بضعة خيارات مناسبة وفق ما تفضّلون: مطبخ تركي، أو مطعم أسماك، أو إطلالة على البوسفور، أو وجبة أبسط، أو طاولة متوسطة، أو مكان أكثر رسمية. أنتم تختارون؛ ولا تُوجَّهون إلى مطعم إلزامي.",
      "تكاليف المطعم والوجبات غير مشمولة في تعرفة الجولة ويدفعها الضيف مباشرة.",
    ],
    extrasTitle: "إضافات اختيارية",
    extrasLead:
      "ما تحجزونه هو سيارة خاصة وسائق خاص محترف والنقل وفق برنامجكم خلال الساعات التي تختارونها. يمكن تنظيم ما يلي عند الطلب وهو غير مشمول تلقائياً في تلك التعرفة.",
    extras: [
      {
        title: "مرشد سياحي مرخّص",
        text: "يمكن ترتيب مرشد محترف عند التوفّر. الأجرة منفصلة.",
      },
      {
        title: "تذاكر المتاحف والمواقع",
        text: "يدفع الضيف رسوم الدخول أو تُرتَّب بشكل منفصل.",
      },
      {
        title: "المطاعم والوجبات",
        text: "أنتم تختارون التوقف؛ ويُسدَّد الحساب في المطعم.",
      },
      {
        title: "قارب خاص أو يخت في البوسفور",
        text: "تجارب القارب أو اليخت تعتمد على الطلب والتوفّر.",
      },
    ],
    extrasNote:
      "تُخطَّط خدمات الأطراف الثالثة الأخرى بالطريقة نفسها. اذكروا ما تريدونه عند الحجز حتى يكون اليوم واضحاً.",
    howTitle: "كيف تعمل جولة إسطنبول؟",
    how: [
      {
        title: "اختاروا مدة الجولة",
        text: "اختاروا حجز نصف يوم لمدة 6 ساعات أو يوم كامل لمدة 10 ساعات.",
      },
      {
        title: "حدّدوا نقطة الاستلام",
        text: "يمكن استخدام فندق أو عنوان إقامة آخر أو مطار أو نقطة مناسبة أخرى.",
      },
      {
        title: "اتفقوا على البرنامج",
        text: "أرسلوا مساركم أو اطلبوا اقتراحاً وفق اهتماماتكم.",
      },
      {
        title: "اختاروا خيار الإرشاد",
        text: "اطلبوا مرشداً سياحياً مرخّصاً محترفاً، أو تابعوا من دونه.",
      },
      {
        title: "استكشفوا إسطنبول",
        text: "تتبع السيارة الخاصة والسائق برنامجكم خلال الساعات المحجوزة.",
      },
      {
        title: "اختاروا نقطة الإنزال",
        text: "في نهاية الجولة يمكنكم العودة إلى الفندق أو إلى نقطة مناسبة أخرى.",
      },
    ],
    finalTitle: "خطّطوا جولة إسطنبول وفق برنامجكم",
    finalLead:
      "اختاروا جولة نصف يوم لمدة 6 ساعات أو جولة يوم كامل لمدة 10 ساعات، واكتشفوا إسطنبول وفق وتيرتكم بسيارة خاصة وسائق خاص محترف.",
    bookHalfDayCta: "احجزوا جولة الـ 6 ساعات",
    bookFullDayCta: "احجزوا جولة الـ 10 ساعات",
  },
};
