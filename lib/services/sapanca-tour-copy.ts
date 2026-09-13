import { type Locale } from "@/lib/i18n/config";

export type SapancaTourCopy = {
  metaTitle: string;
  metaDescription: string;
  heroAlt: string;
  kicker: string;
  h1: string;
  heroLead: string;
  bookCta: string;
  highlights: { title: string; text: string }[];
  lakeTitle: string;
  lake: string[];
  natureTitle: string;
  natureAlt: string;
  nature: string[];
  activityTitle: string;
  activityAlt: string;
  activity: string[];
  quietTitle: string;
  quietAlt: string;
  quiet: string[];
  howTitle: string;
  how: { title: string; text: string }[];
  dayTitle: string;
  day: string[];
  customTitle: string;
  custom: string[];
  whyTitle: string;
  why: { title: string; text: string }[];
  relatedBefore: string;
  relatedHourly: string;
  relatedMid: string;
  relatedCity: string;
  relatedAfter: string;
  midCtaLead: string;
  faqTitle: string;
  faqs: { question: string; answer: string }[];
  finalTitle: string;
  finalLead: string;
};

export const sapancaTourCopy: Record<Locale, SapancaTourCopy> = {
  tr: {
    metaTitle: "İstanbul’dan Sapanca Turu | Özel Günübirlik Tur | Tripetica",
    metaDescription:
      "İstanbul’dan özel araç ve şoförle Sapanca turu. Sapanca Gölü, Maşukiye ve çevresini keşfedin; günübirlik veya size özel programınızı planlayın.",
    heroAlt: "İstanbul’dan Sapanca turu, Sapanca Gölü ve doğa rotaları",
    kicker: "Sapanca Turu",
    h1: "İstanbul’dan Sapanca Turu – Özel Araçla Günübirlik Gezi",
    heroLead:
      "İstanbul’dan özel araç ve şoförle Sapanca, Maşukiye ve çevresinin doğal güzelliklerini keşfetmek isteyen misafirler için kişiye özel tur planlaması sunuyoruz. Tur genellikle sabah İstanbul’dan çıkışlı ve aynı gün dönüşlü günübirlik program olarak planlanabilir; rota, süre ve dönüş saati seyahat planınıza göre düzenlenir.",
    bookCta: "Rezervasyon Yap",
    highlights: [
      { title: "Çıkış", text: "İstanbul" },
      { title: "Tur tipi", text: "Özel tur" },
      { title: "Standart plan", text: "Günübirlik" },
      { title: "Ulaşım", text: "Özel araç ve şoför" },
      { title: "Program", text: "Tercihinize göre planlanır" },
      { title: "Bölgeler", text: "Sapanca Gölü, Maşukiye ve çevresi" },
    ],
    lakeTitle: "Sapanca Gölü’nde sakin bir gün",
    lake: [
      "Sapanca, İstanbul’dan günübirlik ulaşılabilecek bir göl ve doğa beldesidir. Kent temposundan kısa süre uzaklaşmak isteyenler için Sapanca Gölü çevresi, su, yeşil alan ve açık hava duraklarıyla özel bir geziye uygundur.",
      "Özel Sapanca turu, büyük grup otobüslerinin sabit durak listesine bağlı kalmadan ilerler. Çiftler, aileler ve küçük gruplar kendi tempolarında göl kenarında zaman geçirebilir; duraklar, ilgi ve mevcut zamana göre seçilir.",
      "İstanbul’dan Sapanca turu, özel araç ve şoförle kapıdan alınmayı ve günün akışını sizin belirlemenizi mümkün kılar. Kesin bir güzergâh sözü verilmez; program rezervasyondaki taleplerinize göre kurulur.",
    ],
    natureTitle: "Maşukiye ve çevresindeki doğa",
    natureAlt: "Sapanca ve Maşukiye çevresinde doğa turu",
    nature: [
      "Maşukiye, Sapanca günübirlik turunda sık sorulan duraklardan biridir. Yeşil yamaçlar, yürünebilir patikalar ve köy atmosferi, gölün yanında farklı bir doğa katmanı sunar.",
      "Sapanca turu tek bir noktaya gidip dönmek zorunda değildir. İlginize ve güne ayırdığınız süreye göre Sapanca ve çevresindeki duraklar programa eklenebilir. Özel araçla seyahat, standart büyük grup turlarına göre daha esnek bir Maşukiye turu planı kurulmasına olanak verir.",
      "Belirli bir restoran, tesis veya aktivite işletmesi pakete otomatik dahil değildir. Nerede duracağınız, rezervasyon sırasında netleştirilir.",
    ],
    activityTitle: "ATV ve isteğe bağlı aktiviteler",
    activityAlt: "Sapanca turunda isteğe bağlı ATV safari aktivitesi",
    activity: [
      "Bölgede ATV safari gibi açık hava aktiviteleri bulunur. Dilerseniz bunları programa eklemeyi değerlendirebilirsiniz.",
      "Aktivite seçenekleri müsaitlik, sezon ve hava koşullarına göre değişebilir ve tur ücretinden ayrı olabilir. ATV veya benzeri deneyimler Tripetica’nın özel ulaşım ücretine otomatik dahil değildir; ilgili işletmenin şartları geçerlidir.",
    ],
    quietTitle: "Sakin doğa ve dinlenme molaları",
    quietAlt: "Sapanca çevresindeki doğal gezi ve dinlenme alanları",
    quiet: [
      "Sapanca özel gezisi yalnızca hareketli duraklardan oluşmak zorunda değildir. Göl kenarı, yeşil alanlar ve sakin bir mola, günün temposunu sizin belirlemenizi sağlar.",
      "Görsellerdeki belirli bir tesisin hizmete dahil olduğu anlamına gelmez. Program, dinlenmek, kısa yürüyüş veya manzara durakları gibi tercihlerinize göre şekillenir.",
    ],
    howTitle: "Sapanca turu nasıl planlanır?",
    how: [
      {
        title: "Tarih ve alış noktası",
        text: "Rezervasyonda tarihi ve İstanbul’daki alış noktanızı siz belirtirsiniz.",
      },
      {
        title: "Program tercihi",
        text: "Göl, Maşukiye, doğa molaları veya isteğe bağlı aktiviteler konuşulur.",
      },
      {
        title: "Özel araçla hareket",
        text: "Belirlenen saatte özel araç ve şoför sizi alır.",
      },
      {
        title: "Gün boyunca gezi",
        text: "Sapanca ve çevresi, ayırdığınız süreye göre gezilir.",
      },
      {
        title: "Dönüş",
        text: "Aynı gün İstanbul’a dönüş veya talep ettiğiniz farklı bir bitiş planlanır.",
      },
    ],
    dayTitle: "Günübirlik özel Sapanca turu",
    day: [
      "Temel ürün, İstanbul çıkışlı günübirlik özel Sapanca turudur. Tipik senaryo sabah İstanbul’dan hareket, gün boyunca Sapanca ve çevresinde gezi, akşam İstanbul’a dönüş şeklindedir.",
      "Bu, zorunlu bir saat tablosu değildir. Kesin hareket veya dönüş saati uydurulmaz. Tarih, alış noktası ve talepleriniz rezervasyonda netleştikten sonra gün planlanır.",
    ],
    customTitle: "Konaklamalı veya farklı dönüşlü program",
    custom: [
      "Standart plan günübirlik olsa da seyahatiniz farklıysa size özel rota ve süre oluşturulabilir. Örneğin bir gün Sapanca’ya gidip bölgede konaklamak, ertesi gün gezmeye devam edip daha sonra İstanbul’a dönmek mümkün olabilir.",
      "Bu yalnızca bir örnektir; sabit bir paket değildir. Konaklama ücreti hizmete otomatik dahil değildir. Tripetica’nın sunduğu temel değer özel ulaşım, esnek rota ve kişiye özel programlamadır.",
    ],
    whyTitle: "Neden özel araçla Sapanca?",
    why: [
      {
        title: "Kendi grubunuz",
        text: "Yalnızca sizin grubunuzla seyahat edersiniz.",
      },
      {
        title: "Belirlediğiniz alış",
        text: "İstanbul’daki alış noktası rezervasyonda sizin tercihinizdir.",
      },
      {
        title: "Özel şoför",
        text: "Gün boyunca özel araç ve şoför sizin programınıza göre hareket eder.",
      },
      {
        title: "Sabit grup rotası yok",
        text: "Büyük grup turunun zorunlu durak sırasına bağlı kalmazsınız.",
      },
      {
        title: "Aile ve çiftler",
        text: "Aileler, çiftler ve küçük gruplar için tempo sizde kalır.",
      },
      {
        title: "Esnek dönüş",
        text: "Dönüş, seyahat planınıza göre düzenlenebilir.",
      },
    ],
    relatedBefore: "İstanbul içinde başka bir gün için ",
    relatedHourly: "saatlik şoförlü araç",
    relatedMid: " veya ",
    relatedCity: "İstanbul şehir turu",
    relatedAfter: " da ayrı olarak planlanabilir.",
    midCtaLead: "Tarihinizi ve alış noktanızı rezervasyon formunda siz seçin.",
    faqTitle: "Sık sorulan sorular",
    faqs: [
      {
        question: "Sapanca turu İstanbul’dan mı başlıyor?",
        answer:
          "Evet. Tur İstanbul çıkışlı planlanır. Alış noktası otel, ev, havalimanı veya uygun başka bir adres olabilir; bunu rezervasyon sırasında siz belirtirsiniz.",
      },
      {
        question: "Sapanca turu günübirlik mi?",
        answer:
          "Standart plan günübirliktir: aynı gün Sapanca ve çevresi gezilir, İstanbul’a dönüş düşünülür. Saatler rezervasyondaki talebe göre ayarlanır.",
      },
      {
        question: "Sapanca turunun programı değiştirilebilir mi?",
        answer:
          "Evet. Göl, Maşukiye ve diğer duraklar ilginize ve süreye göre şekillenir. Sabit, herkese aynı güzergâh uygulanmaz.",
      },
      {
        question: "Sapanca’da bir gece kalıp ertesi gün İstanbul’a dönebilir miyiz?",
        answer:
          "Farklı dönüş günü veya konaklamalı bir akış talep edilebilir. Konaklama otomatik dahil değildir; ulaşım ve gün planı size göre kurulur.",
      },
      {
        question: "ATV gibi aktiviteler tur ücretine dahil mi?",
        answer:
          "Hayır, otomatik dahil değildir. ATV safari gibi seçenekler müsaitlik, sezon ve işletme şartlarına bağlıdır ve ayrıca değerlendirilir.",
      },
      {
        question: "Bizi İstanbul’da nereden alıyorsunuz?",
        answer:
          "Alış noktası rezervasyonda sizin belirttiğiniz adrestir. Formda bu alanı boş bırakır, kendi seçiminizi yazarsınız.",
      },
    ],
    finalTitle: "Sapanca gününüzü planlayın",
    finalLead:
      "İstanbul’dan özel araç ve şoförle Sapanca Gölü ve Maşukiye çevresini kendi temponuzda keşfedin.",
  },
  en: {
    metaTitle: "Sapanca Tour from Istanbul | Private Day Trip | Tripetica",
    metaDescription:
      "Discover Sapanca Lake and Masukiye on a private tour from Istanbul with your own vehicle and chauffeur. Plan a day trip or a flexible custom itinerary.",
    heroAlt: "Sapanca tour from Istanbul with Sapanca Lake and countryside routes",
    kicker: "Sapanca Tour",
    h1: "Sapanca Tour from Istanbul – Private Day Trip",
    heroLead:
      "A private Sapanca tour from Istanbul with your own vehicle and chauffeur, planned around Sapanca Lake, Masukiye and the countryside nearby. Most guests travel as a day trip — morning departure from Istanbul and return the same day — but the route, pace and return can follow your own schedule.",
    bookCta: "Book Now",
    highlights: [
      { title: "Departure", text: "Istanbul" },
      { title: "Tour type", text: "Private tour" },
      { title: "Typical plan", text: "Day trip" },
      { title: "Transport", text: "Private car and chauffeur" },
      { title: "Itinerary", text: "Planned around your preferences" },
      { title: "Areas", text: "Sapanca Lake, Masukiye and surroundings" },
    ],
    lakeTitle: "A quieter day by Sapanca Lake",
    lake: [
      "Sapanca sits close enough to Istanbul for a private day trip, with the lake and green surroundings offering a clear change of pace from the city. A Sapanca Lake tour suits guests who want water, open air and unhurried stops rather than a packed sightseeing circuit.",
      "Because you travel only with your own group, you are not tied to a coach timetable. Couples, families and small groups can linger by the lake or move on when they are ready.",
      "A private Sapanca tour from Istanbul starts at the pickup point you give when you book. There is no promised fixed circuit; the day is built from what you ask for.",
    ],
    natureTitle: "Masukiye and the hills around Sapanca",
    natureAlt: "Nature around Sapanca and Masukiye",
    nature: [
      "Masukiye is one of the places guests often want on a Sapanca day trip from Istanbul. Green slopes, village lanes and walking paths add a different layer next to the lake.",
      "The tour does not have to be a single stop and a return. Other places around Sapanca can join the day if time and interest allow. A private car makes a Masukiye tour more flexible than a large-group outing.",
      "No specific restaurant, venue or activity operator is included by default. Stops are agreed when you book.",
    ],
    activityTitle: "ATV and optional activities",
    activityAlt: "Optional ATV safari during a Sapanca tour",
    activity: [
      "Outdoor activities such as ATV safari operate in the area. You can ask to add them to the day if that is how you want to spend part of the time.",
      "Availability depends on season, weather and the operator. These activities are not automatically included in the private car rate and are arranged separately under the operator’s terms.",
    ],
    quietTitle: "Green space and unhurried breaks",
    quietAlt: "Countryside stops and rest areas around Sapanca",
    quiet: [
      "A private day trip from Istanbul to Sapanca can include quiet time, not only active stops. Lakeside pauses and green surroundings let you set the tempo.",
      "A photograph of a particular venue does not mean that venue is included. The programme can favour rest, a short walk or a view, according to what you want.",
    ],
    howTitle: "How the Sapanca tour is planned",
    how: [
      {
        title: "Date and pickup",
        text: "You choose the date and the pickup point in Istanbul when you book.",
      },
      {
        title: "What you want to see",
        text: "Lake, Masukiye, quiet countryside or optional activities can be discussed.",
      },
      {
        title: "Private departure",
        text: "A chauffeur collects you at the agreed time.",
      },
      {
        title: "The day in Sapanca",
        text: "You spend the hours you have around the lake and nearby countryside.",
      },
      {
        title: "Return",
        text: "Most days end with a return to Istanbul; another finish can be planned if you ask.",
      },
    ],
    dayTitle: "The usual product: a private day trip",
    day: [
      "The core offer is a private Sapanca day trip from Istanbul: leave in the morning, spend the day around Sapanca and return in the evening.",
      "That is a typical shape, not a locked timetable. Departure and return times are not invented here. They follow the date, pickup and notes you give at booking.",
    ],
    customTitle: "Overnight or a different return",
    custom: [
      "If a same-day return does not fit, a custom route and duration can be planned. One example is travelling to Sapanca, staying overnight, continuing the next day and returning to Istanbul later.",
      "That is an example, not a packaged stay. Accommodation is not included in the chauffeur service. What Tripetica provides is private transport, a flexible route and planning around your dates.",
    ],
    whyTitle: "Why go with a private car",
    why: [
      {
        title: "Your group only",
        text: "You travel with your own party, not a mixed coach.",
      },
      {
        title: "Your pickup",
        text: "You name the Istanbul pickup when you book.",
      },
      {
        title: "Chauffeur for the day",
        text: "The car and driver follow the programme you agreed.",
      },
      {
        title: "No coach circuit",
        text: "You are not bound to a large-group stop list.",
      },
      {
        title: "Families and couples",
        text: "The pace stays with you.",
      },
      {
        title: "Return that fits",
        text: "The way back can follow your wider travel plan.",
      },
    ],
    relatedBefore: "For another day in the city you can also look at ",
    relatedHourly: "hourly chauffeur service",
    relatedMid: " or an ",
    relatedCity: "Istanbul city tour",
    relatedAfter: ".",
    midCtaLead: "Choose your date and pickup on the booking form.",
    faqTitle: "Questions guests ask",
    faqs: [
      {
        question: "Does the Sapanca tour start from Istanbul?",
        answer:
          "Yes. The tour is planned from Istanbul. Pickup can be a hotel, home, airport or another suitable address — you enter it when you book.",
      },
      {
        question: "Is it a day trip?",
        answer:
          "The usual plan is a day trip: Sapanca and the area around it, then back to Istanbul the same day. Hours are set from what you request at booking.",
      },
      {
        question: "Can the itinerary change?",
        answer:
          "Yes. Lake, Masukiye and other stops follow your interests and the time you have. There is no single circuit for every guest.",
      },
      {
        question: "Can we stay overnight and return the next day?",
        answer:
          "A later return or an overnight shape can be planned. Lodging is not included automatically; transport and the day’s outline are built around your request.",
      },
      {
        question: "Are ATV rides included?",
        answer:
          "No. Optional activities such as ATV safari depend on availability, season and the operator, and are arranged separately.",
      },
      {
        question: "Where do you pick us up in Istanbul?",
        answer:
          "At the address you give when you book. The pickup field is left empty for you to complete.",
      },
    ],
    finalTitle: "Plan your day in Sapanca",
    finalLead:
      "See Sapanca Lake and Masukiye at your own pace, with a private car and chauffeur from Istanbul.",
  },
  ru: {
    metaTitle: "Тур в Сапанджу из Стамбула | Индивидуальная поездка | Tripetica",
    metaDescription:
      "Индивидуальный тур в Сапанджу из Стамбула на автомобиле с водителем: озеро Сапанджа, Машукие и гибкий маршрут — на день или под ваш график.",
    heroAlt: "Тур в Сапанджу из Стамбула: озеро и природные маршруты",
    kicker: "Тур в Сапанджу",
    h1: "Тур в Сапанджу из Стамбула — индивидуальная поездка на день",
    heroLead:
      "Индивидуальный выезд из Стамбула на автомобиле с водителем к озеру Сапанджа, в Машукие и к природе рядом. Чаще всего это поездка туда и обратно за один день: утром из Стамбула, вечером возвращение. Маршрут, темп и время возвращения можно согласовать под ваш график.",
    bookCta: "Забронировать",
    highlights: [
      { title: "Выезд", text: "Стамбул" },
      { title: "Формат", text: "Индивидуальный тур" },
      { title: "Обычный план", text: "Один день" },
      { title: "Транспорт", text: "Автомобиль с водителем" },
      { title: "Программа", text: "По вашим предпочтениям" },
      { title: "Районы", text: "Озеро Сапанджа, Машукие и окрестности" },
    ],
    lakeTitle: "День у озера Сапанджа",
    lake: [
      "Сапанджа достаточно близко к Стамбулу, чтобы съездить на день: озеро и зелень вокруг дают другую атмосферу, чем город. Тур к озеру Сапанджа подходит тем, кто хочет воду, воздух и неспешные остановки, а не плотный экскурсионный конвейер.",
      "Вы едете только своей компанией, без расписания большого автобуса. Пары, семьи и небольшие группы могут задержаться у воды или ехать дальше, когда будут готовы.",
      "Индивидуальный тур в Сапанджу начинается от точки подачи, которую вы укажете при бронировании. Фиксированный кольцевой маршрут не обещается; день собирается из ваших пожеланий.",
    ],
    natureTitle: "Машукие и холмы вокруг Сапанджи",
    natureAlt: "Природа вокруг Сапанджи и Машукие",
    nature: [
      "Машукие часто просят включить в однодневную поездку из Стамбула. Склоны, деревенские улицы и тропы добавляют к озеру другой природный слой.",
      "Не обязательно ехать в одну точку и сразу возвращаться. Другие места вокруг Сапанджи можно добавить, если позволяют время и интерес. Своя машина делает программу по Машукие гибче, чем у большой группы.",
      "Конкретный ресторан, объект или оператор активностей в стоимость автоматически не входят. Остановки согласовываются при бронировании.",
    ],
    activityTitle: "Квадроциклы и занятия по желанию",
    activityAlt: "Квадроцикл как дополнительная активность в туре в Сапанджу",
    activity: [
      "В районе бывают занятия на свежем воздухе, в том числе сафари на квадроциклах. Их можно обсудить как часть дня, если вам это интересно.",
      "Доступность зависит от сезона, погоды и оператора. Такие активности не входят автоматически в тариф автомобиля с водителем и оформляются отдельно по условиям площадки.",
    ],
    quietTitle: "Тихие зелёные паузы",
    quietAlt: "Природные места отдыха в окрестностях Сапанджи",
    quiet: [
      "Индивидуальная поездка из Стамбула в Сапанджу может включать спокойное время, а не только активные точки. Берег озера и зелень позволяют задать свой ритм.",
      "Снимок конкретного заведения не означает, что оно входит в услугу. В программу можно заложить отдых, короткую прогулку или вид — как вам удобно.",
    ],
    howTitle: "Как планируется тур в Сапанджу",
    how: [
      {
        title: "Дата и подача",
        text: "Дату и адрес подачи в Стамбуле вы указываете при бронировании.",
      },
      {
        title: "Что хотите увидеть",
        text: "Озеро, Машукие, тихие природные остановки или занятия по желанию.",
      },
      {
        title: "Выезд",
        text: "Водитель забирает вас в согласованное время.",
      },
      {
        title: "День в Сапандже",
        text: "Вы проводите отведённые часы у озера и в окрестностях.",
      },
      {
        title: "Возвращение",
        text: "Чаще всего — обратно в Стамбул в тот же день; иной финиш можно согласовать заранее.",
      },
    ],
    dayTitle: "Основной формат: поездка на один день",
    day: [
      "Базовое предложение — индивидуальный выезд в Сапанджу из Стамбула на день: утром отъезд, день у озера и в окрестностях, вечером возвращение.",
      "Это типичная схема, а не жёсткое расписание. Точное время выезда и возвращения здесь не придумывается: оно следует из даты, адреса подачи и пожеланий в заявке.",
    ],
    customTitle: "Ночёвка или другой день возвращения",
    custom: [
      "Если возвращение в тот же день не подходит, можно собрать другой маршрут и срок. Например, приехать в Сапанджу, остаться на ночь, продолжить на следующий день и вернуться в Стамбул позже.",
      "Это пример, а не готовый пакет с проживанием. Ночлег в услугу автоматически не входит. Tripetica даёт транспорт, гибкий маршрут и планирование под ваши даты.",
    ],
    whyTitle: "Зачем ехать на своём автомобиле с водителем",
    why: [
      {
        title: "Только ваша компания",
        text: "Без смешанной автобусной группы.",
      },
      {
        title: "Ваша точка подачи",
        text: "Адрес в Стамбуле указываете вы.",
      },
      {
        title: "Водитель на день",
        text: "Машина следует согласованной программе.",
      },
      {
        title: "Без чужого расписания",
        text: "Вас не ведут по обязательному списку остановок большой группы.",
      },
      {
        title: "Семьям и парам",
        text: "Темп остаётся за вами.",
      },
      {
        title: "Возвращение под план",
        text: "Обратный путь можно вписать в остальные поездки.",
      },
    ],
    relatedBefore: "На другой день в городе можно отдельно посмотреть ",
    relatedHourly: "почасовой автомобиль с водителем",
    relatedMid: " или ",
    relatedCity: "обзорную экскурсию по Стамбулу",
    relatedAfter: ".",
    midCtaLead: "Дату и место подачи вы выбираете в форме бронирования.",
    faqTitle: "Частые вопросы",
    faqs: [
      {
        question: "Тур в Сапанджу начинается из Стамбула?",
        answer:
          "Да. Поездка планируется из Стамбула. Подача — отель, дом, аэропорт или другой удобный адрес, который вы укажете при бронировании.",
      },
      {
        question: "Это поездка на один день?",
        answer:
          "Обычный план — один день: Сапанджа и окрестности, затем возвращение в Стамбул. Часы согласуются по заявке.",
      },
      {
        question: "Можно ли менять программу?",
        answer:
          "Да. Озеро, Машукие и другие остановки зависят от ваших интересов и времени. Одинакового маршрута для всех нет.",
      },
      {
        question: "Можно остаться на ночь и вернуться на следующий день?",
        answer:
          "Поздний возврат или схему с ночёвкой можно обсудить. Проживание автоматически не включено; транспорт и канва дня собираются под запрос.",
      },
      {
        question: "Квадроциклы входят в стоимость?",
        answer:
          "Нет. Занятия вроде сафари на квадроциклах зависят от наличия, сезона и оператора и оформляются отдельно.",
      },
      {
        question: "Откуда забирают в Стамбуле?",
        answer:
          "С адреса, который вы укажете при бронировании. Поле подачи специально оставляется пустым, чтобы вы заполнили его сами.",
      },
    ],
    finalTitle: "Соберите день в Сапандже",
    finalLead:
      "Озеро Сапанджа и Машукие в своём темпе — на автомобиле с водителем из Стамбула.",
  },
  ar: {
    metaTitle: "جولة سابانجا من إسطنبول | رحلة خاصة ليوم واحد | Tripetica",
    metaDescription:
      "اكتشفوا بحيرة سابانجا وماشوكية في جولة خاصة من إسطنبول بسيارتكم وسائقكم الخاص. خطّطوا رحلة ليوم واحد أو برنامجاً مرناً مخصّصاً.",
    heroAlt: "جولة سابانجا من إسطنبول مع بحيرة سابانجا ومسارات الريف",
    kicker: "جولة سابانجا",
    h1: "جولة سابانجا من إسطنبول – رحلة خاصة ليوم واحد",
    heroLead:
      "جولة سابانجا خاصة من إسطنبول بسيارتكم وسائقكم الخاص، تُخطَّط حول بحيرة سابانجا وماشوكية والريف القريب. يسافر معظم الضيوف في رحلة ليوم واحد — انطلاق صباحاً من إسطنبول والعودة في اليوم نفسه — لكن المسار والوتيرة والعودة يمكن أن تتبع جدولكم.",
    bookCta: "احجز الآن",
    highlights: [
      { title: "الانطلاق", text: "إسطنبول" },
      { title: "نوع الجولة", text: "جولة خاصة" },
      { title: "الخطة المعتادة", text: "رحلة ليوم واحد" },
      { title: "التنقّل", text: "سيارة خاصة وسائق خاص" },
      { title: "البرنامج", text: "يُخطَّط وفق تفضيلاتكم" },
      { title: "المناطق", text: "بحيرة سابانجا وماشوكية والمناطق المحيطة" },
    ],
    lakeTitle: "يوم أكثر هدوءاً على بحيرة سابانجا",
    lake: [
      "تقع سابانجا على مسافة تسمح برحلة خاصة ليوم واحد من إسطنبول، وتقدّم البحيرة والمحيط الأخضر تغييراً واضحاً في الإيقاع عن المدينة. تناسب جولة بحيرة سابانجا من يريد الماء والهواء الطلق وتوقفات غير متعجّلة، لا دائرة مشاهدة معالم مكتظة.",
      "لأنكم تسافرون مع مجموعتكم فقط، فلستم مقيّدين بجدول حافلة. يمكن للأزواج والعائلات والمجموعات الصغيرة أن يمكثوا عند البحيرة أو يواصلوا عندما يكونون جاهزين.",
      "تبدأ جولة سابانجا الخاصة من إسطنبول من نقطة الاستلام التي تذكرونها عند الحجز. لا يُوعَد بمسار ثابت؛ يُبنى اليوم مما تطلبونه.",
    ],
    natureTitle: "ماشوكية والتلال حول سابانجا",
    natureAlt: "الطبيعة حول سابانجا وماشوكية",
    nature: [
      "ماشوكية من الأماكن التي يطلبها الضيوف كثيراً في رحلة سابانجا ليوم واحد من إسطنبول. تضيف المنحدرات الخضراء وأزقة القرية وممرات المشي طبقة مختلفة إلى جانب البحيرة.",
      "لا يجب أن تكون الجولة توقفاً واحداً ثم عودة. يمكن أن تنضم أماكن أخرى حول سابانجا إلى اليوم إذا سمح الوقت والاهتمام. تجعل السيارة الخاصة جولة ماشوكية أكثر مرونة من نزهة مجموعة كبيرة.",
      "لا يُشمَل مطعم أو منشأة أو مشغّل نشاط معيّن افتراضياً. تُتَّفق التوقفات عند الحجز.",
    ],
    activityTitle: "الدراجات الرباعية والأنشطة الاختيارية",
    activityAlt: "سفاري دراجات رباعية اختياري خلال جولة سابانجا",
    activity: [
      "تعمل في المنطقة أنشطة في الهواء الطلق مثل سفاري الدراجات الرباعية. يمكنكم طلب إضافتها إلى اليوم إذا رغبتم بقضاء جزء من الوقت بهذه الطريقة.",
      "يعتمد التوفّر على الموسم والطقس والمشغّل. هذه الأنشطة غير مشمولة تلقائياً في تعرفة السيارة الخاصة وتُرتَّب بشكل منفصل وفق شروط المشغّل.",
    ],
    quietTitle: "مساحات خضراء واستراحات هادئة",
    quietAlt: "توقفات ريفية وأماكن استراحة حول سابانجا",
    quiet: [
      "يمكن أن تشمل الرحلة الخاصة من إسطنبول إلى سابانجا وقتاً هادئاً، لا توقفات نشطة فقط. تتيح الاستراحات على ضفة البحيرة والمحيط الأخضر تحديد الوتيرة بأنفسكم.",
      "صورة منشأة معيّنة لا تعني أن تلك المنشأة مشمولة. يمكن أن يميل البرنامج إلى الراحة أو نزهة قصيرة أو إطلالة، وفق ما تريدون.",
    ],
    howTitle: "كيف تُخطَّط جولة سابانجا؟",
    how: [
      {
        title: "التاريخ ونقطة الاستلام",
        text: "تختارون التاريخ ونقطة الاستلام في إسطنبول عند الحجز.",
      },
      {
        title: "ما تريدون رؤيته",
        text: "يمكن مناقشة البحيرة وماشوكية والريف الهادئ أو الأنشطة الاختيارية.",
      },
      {
        title: "انطلاق خاص",
        text: "يستقبلكم سائق خاص في الوقت المتفق عليه.",
      },
      {
        title: "اليوم في سابانجا",
        text: "تقضون الساعات المتاحة حول البحيرة والريف القريب.",
      },
      {
        title: "العودة",
        text: "تنتهي معظم الأيام بالعودة إلى إسطنبول؛ ويمكن التخطيط لنهاية مختلفة إذا طلبتم.",
      },
    ],
    dayTitle: "المنتج المعتاد: رحلة خاصة ليوم واحد",
    day: [
      "العرض الأساسي هو رحلة سابانجا الخاصة ليوم واحد من إسطنبول: المغادرة صباحاً، قضاء اليوم حول سابانجا، والعودة مساءً.",
      "هذا شكل نموذجي، لا جدول مواعيد مقفل. لا تُختلق هنا ساعات الانطلاق والعودة. إنها تتبع التاريخ ونقطة الاستلام والملاحظات التي تقدّمونها عند الحجز.",
    ],
    customTitle: "مبيت أو عودة في يوم مختلف",
    custom: [
      "إذا لم تناسبكم العودة في اليوم نفسه، يمكن تخطيط مسار ومدة مخصّصين. من الأمثلة السفر إلى سابانجا والمبيت ليلة، ثم مواصلة اليوم التالي والعودة إلى إسطنبول لاحقاً.",
      "هذا مثال، لا إقامة مغلفة في باقة. الإقامة غير مشمولة في خدمة السائق الخاص. ما تقدّمه Tripetica هو النقل الخاص ومسار مرن وتخطيط حول تواريخكم.",
    ],
    whyTitle: "لماذا تذهبون بسيارة خاصة؟",
    why: [
      {
        title: "مجموعتكم فقط",
        text: "تسافرون مع رفقتكم، لا في حافلة مختلطة.",
      },
      {
        title: "نقطة استلامكم",
        text: "تحدّدون نقطة الاستلام في إسطنبول عند الحجز.",
      },
      {
        title: "سائق خاص لليوم",
        text: "تتبع السيارة والسائق البرنامج الذي اتفقتم عليه.",
      },
      {
        title: "لا مسار حافلة جماعية",
        text: "لستم مقيّدين بقائمة توقفات مجموعة كبيرة.",
      },
      {
        title: "العائلات والأزواج",
        text: "تبقى الوتيرة لديكم.",
      },
      {
        title: "عودة تناسب خطتكم",
        text: "يمكن أن تتبع طريق العودة خطتكم الأوسع للسفر.",
      },
    ],
    relatedBefore: "ليوم آخر في المدينة يمكنكم أيضاً الاطّلاع على ",
    relatedHourly: "خدمة السائق الخاص بالساعة",
    relatedMid: " أو ",
    relatedCity: "جولة إسطنبول",
    relatedAfter: ".",
    midCtaLead: "اختاروا التاريخ ونقطة الاستلام في نموذج الحجز.",
    faqTitle: "أسئلة يطرحها الضيوف",
    faqs: [
      {
        question: "هل تبدأ جولة سابانجا من إسطنبول؟",
        answer:
          "نعم. تُخطَّط الجولة من إسطنبول. يمكن أن تكون نقطة الاستلام فندقاً أو منزلاً أو مطاراً أو عنواناً مناسباً آخر — تدخلونه عند الحجز.",
      },
      {
        question: "هل هي رحلة ليوم واحد؟",
        answer:
          "الخطة المعتادة رحلة ليوم واحد: سابانجا والمنطقة حولها، ثم العودة إلى إسطنبول في اليوم نفسه. تُضبط الساعات وفق ما تطلبونه عند الحجز.",
      },
      {
        question: "هل يمكن تغيير البرنامج؟",
        answer:
          "نعم. تتبع البحيرة وماشوكية والتوقفات الأخرى اهتماماتكم والوقت المتاح. لا يوجد مسار واحد لكل ضيف.",
      },
      {
        question: "هل يمكننا المبيت والعودة في اليوم التالي؟",
        answer:
          "يمكن تخطيط عودة لاحقة أو شكل مع مبيت. الإقامة غير مشمولة تلقائياً؛ يُبنى النقل ومخطط اليوم حول طلبكم.",
      },
      {
        question: "هل جولات الدراجات الرباعية مشمولة؟",
        answer:
          "لا. تعتمد الأنشطة الاختيارية مثل سفاري الدراجات الرباعية على التوفّر والموسم والمشغّل، وتُرتَّب بشكل منفصل.",
      },
      {
        question: "من أين تستلموننا في إسطنبول؟",
        answer:
          "من العنوان الذي تذكرونه عند الحجز. يُترك حقل الاستلام فارغاً لتكميله بأنفسكم.",
      },
    ],
    finalTitle: "خطّطوا يومكم في سابانجا",
    finalLead:
      "شاهدوا بحيرة سابانجا وماشوكية وفق وتيرتكم، بسيارة خاصة وسائق خاص من إسطنبول.",
  },
};
