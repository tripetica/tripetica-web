import { type Locale } from "@/lib/i18n/config";

export type BosphorusCruiseCopy = {
  metaTitle: string;
  metaDescription: string;
  heroAlt: string;
  kicker: string;
  h1: string;
  heroLead: string;
  bookCta: string;
  highlights: { title: string; text: string }[];
  nightTitle: string;
  nightAlt: string;
  night: string[];
  diningTitle: string;
  diningAlt: string;
  dining: string[];
  showTitle: string;
  showAlt: string;
  show: string[];
  cultureTitle: string;
  cultureAlt: string;
  culture: string[];
  expectTitle: string;
  expect: { title: string; text: string }[];
  viewsTitle: string;
  viewsLead: string;
  views: { title: string; text: string }[];
  viewsNote: string;
  packagesTitle: string;
  packages: string[];
  transferTitle: string;
  transfer: string;
  whoTitle: string;
  who: { title: string; text: string }[];
  finalTitle: string;
  finalLead: string;
};

export const bosphorusCruiseCopy: Record<Locale, BosphorusCruiseCopy> = {
  tr: {
    metaTitle: "Boğaz’da Akşam Yemeği Tekne Turu & Türk Gecesi | Tripetica",
    metaDescription:
      "İstanbul Boğazı’nda akşam yemeği, gece manzarası, canlı müzik ve geleneksel Türk gecesi gösterileriyle yemekli tekne turu deneyimi.",
    heroAlt: "İstanbul Boğazı’nda akşam yemeği tekne turu ve Türk gecesi",
    kicker: "Boğaz Akşam Turu",
    h1: "Boğaz’da Akşam Yemeği Tekne Turu & Türk Gecesi",
    heroLead:
      "İstanbul Boğazı’nın gece manzarasını akşam yemeği, canlı müzik ve geleneksel Türk gecesi gösterileriyle bir araya getiren özel bir tekne turu deneyimi. İstanbul’u denizden keşfederken Boğaz’ın ışıkları eşliğinde yemeğinizin ve gece boyunca devam eden eğlence programının keyfini çıkarın.",
    bookCta: "Rezervasyon Yap",
    highlights: [
      {
        title: "Boğaz’da tekne turu",
        text: "İstanbul Boğazı üzerinde gece seyri.",
      },
      {
        title: "Akşam yemeği",
        text: "Teknede yemekli bir akşam programı.",
      },
      {
        title: "Canlı müzik",
        text: "Yemeğe eşlik eden canlı eğlence.",
      },
      {
        title: "Türk gösterileri",
        text: "Geleneksel sahne performansları.",
      },
      {
        title: "Gece manzarası",
        text: "İstanbul’un ışıklı silueti denizden.",
      },
    ],
    nightTitle: "İstanbul Boğazı’nı Gece Keşfedin",
    nightAlt: "İstanbul Boğazı’nda gece yemekli tekne turu",
    night: [
      "İstanbul’un en etkileyici manzaralarından biri güneş battıktan sonra ortaya çıkar. Boğaz’da akşam yemeği tekne turu boyunca İstanbul’un Avrupa ve Anadolu yakalarını denizden izleyebilir, ışıklandırılmış köprüleri, kıyıdaki tarihi yapıları ve şehrin gece siluetini farklı bir açıdan keşfedebilirsiniz.",
      "Bu deneyim yalnızca bir akşam yemeği değildir. İstanbul’un iki yakası arasında Boğaz üzerinde ilerleyen tekne, şehrin gece atmosferini yemek ve eğlence programıyla bir araya getirir.",
    ],
    diningTitle: "Boğaz Manzarası Eşliğinde Akşam Yemeği",
    diningAlt: "Boğaz manzaralı teknede akşam yemeği",
    dining: [
      "Yemekli Boğaz turunun merkezinde, seyir sırasında sunulan akşam yemeği vardır. Masa, Boğaz’ın gece ışıklarıyla aynı anda kurulur; yemek, manzaranın yanında ayrı bir program gibi durmaz.",
      "Menü ve içecek seçenekleri seçilen pakete göre değişebilir. Rezervasyon sırasında ilgili pakete dahil olan yemek ve içecek seçenekleri açık şekilde gösterilmelidir.",
      "Rezervasyon sırasında sunulan paket seçeneklerine göre alkollü ve alkolsüz alternatifler bulunabilir.",
    ],
    showTitle: "Canlı Türk Gecesi ve Dans Gösterileri",
    showAlt: "İstanbul Boğaz turunda Türk gecesi dans gösterisi",
    show: [
      "Akşam yemeği ve Boğaz manzarasına sahne programı eşlik eder. Bu, sıradan bir yemekli tekne turundan daha fazlasını arayan misafirler için İstanbul’da farklı bir gece deneyimidir.",
      "Programda geleneksel dans gösterileri, Türk gecesi performansları, canlı eğlence, müzik ve dans gibi unsurlar yer alabilir. Gösteri akışı organizasyon gününe göre değişebilir; her gece aynı sahne sırası garanti edilmez.",
    ],
    cultureTitle: "Geleneksel Gösterilerle İstanbul Gecesi",
    cultureAlt: "Yemekli Boğaz turunda semazen gösterisi",
    culture: [
      "Türk gecesi yalnızca modern sahne eğlencesinden ibaret değildir. Program, Türkiye’nin geleneksel sahne kültüründen örnekler de sunabilir.",
      "Semazen gösterisi, yemekli Boğaz turunun eğlence akışı içinde bir sahne performansı olarak yer alabilir. Bu, uzun bir tarih dersi değil; gece programının kültürel bir durağınıdır.",
    ],
    expectTitle: "Bu Turda Sizi Ne Bekliyor?",
    expect: [
      {
        title: "Tekneye katılım",
        text: "Boğaz turunun yapılacağı tekneye katılım.",
      },
      {
        title: "İstanbul Boğazı’nda gece seyri",
        text: "Avrupa ve Anadolu yakaları arasında İstanbul’un gece manzarası.",
      },
      {
        title: "Akşam yemeği",
        text: "Seçilen pakete göre sunulan akşam yemeği deneyimi.",
      },
      {
        title: "Canlı gösteriler",
        text: "Türk gecesi, dans ve farklı sahne performansları.",
      },
      {
        title: "Müzik ve eğlence",
        text: "Gece boyunca eğlence atmosferi.",
      },
      {
        title: "Turun tamamlanması",
        text: "Program sonunda teknenin turun bitiş noktasına dönüşü.",
      },
    ],
    viewsTitle: "Boğaz Turunda İstanbul’u Denizden Görün",
    viewsLead:
      "İstanbul Boğaz turu, kenti karadan değil su üzerinden izleme fırsatı verir. Gece ışıkları kıyı hattını, köprüleri ve silueti farklı bir ölçekte gösterir.",
    views: [
      {
        title: "İki yaka",
        text: "Avrupa Yakası ile Anadolu Yakası, tekne üzerinden yan yana okunur.",
      },
      {
        title: "Köprüler ve sahil",
        text: "Boğaz köprüleri ve kıyı hattı, gece aydınlatmasıyla öne çıkar.",
      },
      {
        title: "Saraylar ve yalılar",
        text: "Sahildeki saraylar, yalılar ve tarihi yapılar rotaya göre görülebilir.",
      },
      {
        title: "Gece silueti",
        text: "İstanbul’un ışıklı silueti, yemekli tekne turunun arka planını oluşturur.",
      },
    ],
    viewsNote:
      "Görülebilecek noktalar teknenin rotasına, hava ve deniz koşullarına göre değişebilir.",
    packagesTitle: "Paket Seçenekleri",
    packages: [
      "Rezervasyon sırasında farklı paket alternatifleri gösterilir. Hangi yemek ve içeceklerin dahil olduğu, seçtiğiniz pakete bağlıdır.",
      "Alkollü ve alkolsüz seçenekler bulunabilir. Kesin menü ve fiyat, rezervasyon adımında ilgili paketin detayında yer alır.",
    ],
    transferTitle: "Buluşma ve transfer",
    transfer:
      "Buluşma ve transfer seçenekleri rezervasyon detaylarında ayrıca gösterilir.",
    whoTitle: "Bu Deneyim Kimler İçin Uygun?",
    who: [
      {
        title: "Çiftler",
        text: "İstanbul’da farklı bir akşam arayan çiftler için yemek ve manzara aynı programdadır.",
      },
      {
        title: "Aileler",
        text: "Aileler, Boğaz’ı denizden görerek ortak bir gece geçirebilir.",
      },
      {
        title: "Arkadaş grupları",
        text: "Arkadaş grupları için yemek, müzik ve gösteri tek bir akışta birleşir.",
      },
      {
        title: "Kısa ziyaret",
        text: "Şehri kısa sürede başka bir açıdan görmek isteyen ziyaretçiler için uygundur.",
      },
      {
        title: "Yemek ve eğlence",
        text: "Akşam yemeği ile canlı programı aynı gecede isteyen misafirlere hitap eder.",
      },
    ],
    finalTitle: "Boğaz’da İstanbul Gecesini Yaşayın",
    finalLead:
      "Akşam yemeği, Boğaz manzarası ve canlı Türk gecesi gösterilerini tek bir deneyimde bir araya getirin.",
  },
  en: {
    metaTitle: "Bosphorus Dinner Cruise & Turkish Night Show | Tripetica",
    metaDescription:
      "Experience an Istanbul Bosphorus dinner cruise with dinner, night views, live music and traditional Turkish entertainment.",
    heroAlt: "Bosphorus dinner cruise and Turkish night show in Istanbul",
    kicker: "Bosphorus evening cruise",
    h1: "Bosphorus Dinner Cruise & Turkish Night Show",
    heroLead:
      "A private evening on the water that brings together an Istanbul dinner cruise, live music and a Turkish night show. Watch the city lights from the Bosphorus while you dine and the entertainment continues through the night.",
    bookCta: "Book Now",
    highlights: [
      {
        title: "Bosphorus cruise",
        text: "A night sailing on the strait.",
      },
      {
        title: "Dinner on board",
        text: "An evening meal as part of the cruise.",
      },
      {
        title: "Live music",
        text: "Entertainment alongside dinner.",
      },
      {
        title: "Turkish shows",
        text: "Traditional stage performances.",
      },
      {
        title: "Night skyline",
        text: "Istanbul’s lights seen from the water.",
      },
    ],
    nightTitle: "See the Bosphorus After Dark",
    nightAlt: "Night-time Bosphorus dinner cruise in Istanbul",
    night: [
      "Some of Istanbul’s strongest views appear after sunset. On a Bosphorus dinner cruise you watch the European and Asian shores from the water, with lit bridges, waterfront landmarks and the night skyline from a different angle.",
      "This is more than a meal on a boat. The vessel moves between the two sides of the city, and the night atmosphere sits together with dinner and the entertainment programme.",
    ],
    diningTitle: "Dinner with a Bosphorus View",
    diningAlt: "Dinner on a Bosphorus cruise boat",
    dining: [
      "Dinner is a natural part of the cruise, served while the shoreline lights pass outside. The meal belongs to the same evening as the views, not a separate outing.",
      "Menus and drinks depend on the package you choose. What is included should be shown clearly when you book.",
      "Packages offered at booking may include options with or without alcohol.",
    ],
    showTitle: "Live Turkish Night and Dance Performances",
    showAlt: "Turkish night dance show on a Bosphorus cruise",
    show: [
      "Stage performances run alongside dinner and the night views. For many guests this is what sets a Bosphorus night cruise apart from a simple dinner on the water.",
      "The programme may include traditional dance, Turkish night performances, live entertainment, music and dance. The running order can change from one evening to another; a fixed list of acts is not promised every night.",
    ],
    cultureTitle: "A Night with Traditional Stage Culture",
    cultureAlt: "Whirling dervish performance on a Bosphorus dinner cruise",
    culture: [
      "A Turkish night show is not only contemporary entertainment. The evening can also include pieces from Turkey’s traditional stage culture.",
      "A whirling dervish performance may appear as one act within the cruise entertainment. It is a staged moment in the night programme, not a long historical lecture.",
    ],
    expectTitle: "What to Expect on This Cruise",
    expect: [
      {
        title: "Boarding",
        text: "You join the boat used for the Bosphorus cruise.",
      },
      {
        title: "Night sailing",
        text: "Istanbul’s night views between the European and Asian shores.",
      },
      {
        title: "Dinner",
        text: "An evening meal according to the package you select.",
      },
      {
        title: "Live shows",
        text: "Turkish night, dance and other stage performances.",
      },
      {
        title: "Music and atmosphere",
        text: "Entertainment through the evening.",
      },
      {
        title: "Return",
        text: "The boat returns to the cruise finishing point at the end of the programme.",
      },
    ],
    viewsTitle: "See Istanbul from the Water",
    viewsLead:
      "A Bosphorus cruise lets you read the city from the strait rather than from the street. After dark, lights pick out the shoreline, the bridges and the skyline.",
    views: [
      {
        title: "Both shores",
        text: "Europe and Asia sit side by side from the deck.",
      },
      {
        title: "Bridges and waterfront",
        text: "Bosphorus bridges and the coastal line stand out in the evening light.",
      },
      {
        title: "Palaces and yalıs",
        text: "Palaces, waterfront houses and historic buildings may appear along the route.",
      },
      {
        title: "Night skyline",
        text: "Istanbul’s illuminated outline is the backdrop to the dinner cruise.",
      },
    ],
    viewsNote:
      "What you see can change with the boat’s route and with weather and sea conditions.",
    packagesTitle: "Package options",
    packages: [
      "When you book you will see different package alternatives. Food and drinks included depend on the package you choose.",
      "Options with and without alcohol may be available. The exact menu and price appear in the details of the package at booking.",
    ],
    transferTitle: "Meeting point and transfers",
    transfer:
      "Meeting point and transfer options are shown separately in the booking details.",
    whoTitle: "Who This Evening Suits",
    who: [
      {
        title: "Couples",
        text: "Couples looking for a different night in Istanbul, with dinner and views in one programme.",
      },
      {
        title: "Families",
        text: "Families can share an evening seeing the city from the water.",
      },
      {
        title: "Groups of friends",
        text: "Dinner, music and shows sit in a single flow for groups.",
      },
      {
        title: "Short stays",
        text: "A useful way to see Istanbul from another angle when time is limited.",
      },
      {
        title: "Dinner and entertainment",
        text: "Guests who want a meal and a live programme on the same night.",
      },
    ],
    finalTitle: "Spend the Evening on the Bosphorus",
    finalLead:
      "Bring dinner, Bosphorus views and a live Turkish night show together in a single experience.",
  },
  ru: {
    metaTitle: "Круиз по Босфору с ужином и турецким шоу | Tripetica",
    metaDescription:
      "Вечерний круиз по Босфору в Стамбуле: ужин на борту, ночные виды, живая музыка и традиционное турецкое шоу.",
    heroAlt: "Круиз по Босфору с ужином и турецким шоу в Стамбуле",
    kicker: "Вечерний круиз по Босфору",
    h1: "Круиз по Босфору с ужином и турецким шоу",
    heroLead:
      "Вечер на воде, где круиз по Босфору сочетается с ужином, живой музыкой и турецким шоу. Смотрите огни Стамбула с палубы, пока идёт ужин и продолжается развлекательная программа.",
    bookCta: "Забронировать",
    highlights: [
      {
        title: "Прогулка по Босфору",
        text: "Ночной круиз по проливу.",
      },
      {
        title: "Ужин на борту",
        text: "Вечерняя трапеза в программе круиза.",
      },
      {
        title: "Живая музыка",
        text: "Развлечение рядом с ужином.",
      },
      {
        title: "Турецкое шоу",
        text: "Традиционные сценические номера.",
      },
      {
        title: "Ночной Стамбул",
        text: "Огни города с воды.",
      },
    ],
    nightTitle: "Босфор после заката",
    nightAlt: "Ночной круиз по Босфору с ужином",
    night: [
      "Одни из самых сильных видов Стамбула открываются после захода солнца. Во время круиза по Босфору с ужином европейский и азиатский берега видны с воды: подсвеченные мосты, набережная и ночной силуэт города с другого ракурса.",
      "Это не только ужин на корабле. Судно идёт между двумя берегами, а ночная атмосфера города соединяется с едой и развлекательной программой.",
    ],
    diningTitle: "Ужин с видом на Босфор",
    diningAlt: "Ужин на корабле во время круиза по Босфору",
    dining: [
      "Ужин — естественная часть круиза и подаётся, пока за окном проходят огни берега. Трапеза принадлежит тому же вечеру, что и виды, а не отдельной программе.",
      "Меню и напитки зависят от выбранного пакета. Что входит в стоимость, должно быть ясно указано при бронировании.",
      "Среди пакетов, которые предлагаются при бронировании, могут быть варианты с алкоголем и без него.",
    ],
    showTitle: "Живое турецкое шоу и танцы",
    showAlt: "Танцевальное турецкое шоу на круизе по Босфору",
    show: [
      "Сценические номера идут вместе с ужином и ночными видами. Для многих гостей именно это отличает вечерний круиз по Босфору от простой прогулки с едой.",
      "В программе могут быть традиционные танцы, номера турецкой ночи, живое сопровождение, музыка и танец. Порядок выступлений может меняться от вечера к вечеру; фиксированный список номеров на каждую ночь не обещается.",
    ],
    cultureTitle: "Вечер с традиционной сценой",
    cultureAlt: "Выступление дервишей на круизе по Босфору с ужином",
    culture: [
      "Турецкое шоу — это не только современная эстрада. В вечер могут входить и фрагменты традиционной сценической культуры Турции.",
      "Выступление дервишей может появиться как один из номеров развлекательной программы круиза. Это сценический момент вечера, а не длинная историческая лекция.",
    ],
    expectTitle: "Что вас ждёт на круизе",
    expect: [
      {
        title: "Посадка",
        text: "Вы поднимаетесь на судно, на котором проходит круиз по Босфору.",
      },
      {
        title: "Ночной ход",
        text: "Виды Стамбула между европейским и азиатским берегами.",
      },
      {
        title: "Ужин",
        text: "Вечерняя трапеза в соответствии с выбранным пакетом.",
      },
      {
        title: "Живые номера",
        text: "Турецкое шоу, танцы и другие сценические выступления.",
      },
      {
        title: "Музыка и атмосфера",
        text: "Развлекательный фон на протяжении вечера.",
      },
      {
        title: "Завершение",
        text: "В конце программы судно возвращается к точке окончания круиза.",
      },
    ],
    viewsTitle: "Стамбул с воды",
    viewsLead:
      "Круиз по Босфору даёт увидеть город не с улицы, а с пролива. После заката свет выхватывает набережную, мосты и силуэт.",
    views: [
      {
        title: "Два берега",
        text: "Европа и Азия читаются с палубы рядом.",
      },
      {
        title: "Мосты и берег",
        text: "Мосты Босфора и береговая линия особенно заметны вечером.",
      },
      {
        title: "Дворцы и ялы",
        text: "Дворцы, ялы и исторические здания могут попасть в кадр в зависимости от маршрута.",
      },
      {
        title: "Ночной силуэт",
        text: "Огни Стамбула становятся фоном круиза с ужином.",
      },
    ],
    viewsNote:
      "Какие точки будут видны, зависит от маршрута судна, погоды и состояния моря.",
    packagesTitle: "Варианты пакетов",
    packages: [
      "При бронировании вы увидите разные пакеты. Состав еды и напитков зависит от выбранного варианта.",
      "Могут быть предложения с алкоголем и без него. Точное меню и цена указаны в деталях пакета на шаге бронирования.",
    ],
    transferTitle: "Место встречи и трансфер",
    transfer:
      "Варианты встречи и трансфера отдельно указаны в деталях бронирования.",
    whoTitle: "Кому подойдёт этот вечер",
    who: [
      {
        title: "Парам",
        text: "Для пар, которые ищут другой вечер в Стамбуле: ужин и виды в одной программе.",
      },
      {
        title: "Семьям",
        text: "Семья может провести вечер, глядя на город с воды.",
      },
      {
        title: "Компаниям друзей",
        text: "Ужин, музыка и шоу идут одним потоком.",
      },
      {
        title: "Короткой поездке",
        text: "Удобный способ увидеть Стамбул с другого ракурса, если времени мало.",
      },
      {
        title: "Ужин и развлечение",
        text: "Для тех, кто хочет трапезу и живую программу в один вечер.",
      },
    ],
    finalTitle: "Проведите вечер на Босфоре",
    finalLead:
      "Соберите ужин, виды Босфора и живое турецкое шоу в одном впечатлении.",
  },
};
