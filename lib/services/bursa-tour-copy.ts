import { type Locale } from "@/lib/i18n/config";

export type BursaTourCopy = {
  metaTitle: string;
  metaDescription: string;
  heroAlt: string;
  kicker: string;
  h1: string;
  heroLead: string;
  bookCta: string;
  introTitle: string;
  introAlt: string;
  intro: string[];
  mosqueTitle: string;
  mosqueAlt: string;
  mosque: string[];
  tophaneTitle: string;
  tophaneAlt: string;
  tophane: string[];
  mountainTitle: string;
  mountainLead: string[];
  cableAlt: string;
  snowAlt: string;
  mountain: string[];
  stayTitle: string;
  stay: string[];
  planTitle: string;
  plan: { title: string; text: string }[];
  midCtaLead: string;
  faqTitle: string;
  faqs: { question: string; answer: string }[];
  finalTitle: string;
  finalLead: string;
};

export const bursaTourCopy: Record<Locale, BursaTourCopy> = {
  tr: {
    metaTitle: "İstanbul’dan Bursa Turu | Özel Araç ve Şoför | Tripetica",
    metaDescription:
      "İstanbul’dan özel araç ve şoförle Bursa turu. Ulu Cami, Tophane ve Uludağ; günübirlik veya isteğe bağlı konaklamalı özel program.",
    heroAlt:
      "İstanbul çıkışlı özel Bursa turunda Ulu Cami, Uludağ ve Bursa manzaraları",
    kicker: "Bursa Turu",
    h1: "İstanbul'dan Özel Bursa Turu",
    heroLead:
      "İstanbul çıkışlı özel Bursa turu; özel araç ve şoförle tarihî kent dokusunu, Ulu Cami çevresini ve Uludağ’ın doğasını keşfetmek isteyen misafirler için planlanır. Tur çoğu zaman günübirlik kurulabilir; istenirse konaklamalı ve kişiye özel bir program da hazırlanır.",
    bookCta: "Rezervasyon Yap",
    introTitle: "İstanbul’dan Bursa’yı keşfedin",
    introAlt: "Bursa şehir merkezi ve doğal şehir manzarası",
    intro: [
      "Bursa, erken Osmanlı döneminin başkentlerinden biri olarak anılır; camileri, hanları ve yamaçlara yaslanmış mahalleleriyle İstanbul’dan gelen ziyaretçiye farklı bir tarih katmanı sunar. Kent, Uludağ’ın eteklerinde durur; tarihî merkez ile dağ aynı günde yan yana düşünülebilir.",
      "İstanbul’a görece yakınlığı, özel araçla Bursa turunu günübirlik bir gezi olarak da mümkün kılar. Amaç yalnızca duraklarda fotoğraf çekmek değil; caminin avlusunda, Tophane sırtında veya dağ yolunda kendi temponuzda zaman geçirmektir.",
    ],
    mosqueTitle: "Tarihî Bursa ve Ulu Cami",
    mosqueAlt: "Bursa Ulu Cami ve tarihî şehir merkezi",
    mosque: [
      "Ulu Cami, Bursa’nın tarihî merkezinde öne çıkan yapılardan biridir. Erken Osmanlı mimarisinin izini süren ziyaretçiler için kentin kalbinde durur; çevresindeki çarşı ve sokaklar, caminin tek başına bir durak olmadığını gösterir.",
      "Tarihî şehir dokusu, süreye göre kısa bir yürüyüş veya daha sakin bir gezinmeyle ele alınabilir. Hangi avlunun, hangi sokağın programa gireceği rezervasyondaki talebe ve güne ayırdığınız zamana bağlıdır; her nokta her turda ziyaret edilmez.",
    ],
    tophaneTitle: "Tophane ve kentin sırtı",
    tophaneAlt: "Bursa Tophane ve tarihî şehir dokusu",
    tophane: [
      "Tophane, Bursa’nın tarihî kimliğini ve Osmanlı mirasını şehir manzarasıyla birlikte okumak isteyenler için sık tercih edilen bir sırtır. Aşağıda çarşı ve camiler, yukarıda ise kente bakan bir bakış vardır.",
      "Tarihî merkezde ne kadar kalınacağı programa göre değişir. Özel Bursa turu, büyük grup otobüslerinin sabit durak sırasına bağlı kalmadan bu süreyi sizin tercihlerinize göre ayırabilir.",
    ],
    mountainTitle: "Uludağ: Bursa’nın dört mevsim doğası",
    mountainLead: [
      "Uludağ, Bursa’nın hemen üzerinde duran bir dağdır. Yalnızca kışa indirgenmez; diğer mevsimlerde de orman, manzara ve temiz hava için ziyaret edilir.",
    ],
    cableAlt: "Bursa Uludağ teleferik ve dağ manzarası",
    snowAlt: "Kış mevsiminde karla kaplı Uludağ",
    mountain: [
      "Kış aylarında karla kaplanan Uludağ, kentten belirgin biçimde farklı bir atmosfere bürünür. Uygun hava, kar örtüsü ve işletme koşullarında kar manzarası, kış atmosferi ve kayak gibi kış aktiviteleri gündeme gelebilir.",
      "Kar, teleferik, kayak veya belirli bir tesis her rezervasyonda garanti edilmez. Sezon, hava, müsaitlik ve işletmelerin açık olup olmadığı programı etkiler. Uludağ’ın kışın en karakteristik dönemlerinden biri olduğu söylenebilir; her gün aynı koşullar beklenmez.",
    ],
    stayTitle: "Günübirlik veya konaklamalı Bursa turu",
    stay: [
      "Standart yaklaşım, İstanbul’dan özel araçla günübirlik Bursa gezisidir. Sabah hareket edilir, planlanan noktalar ziyaret edilir, program sonunda İstanbul’a dönülür. Bu bir örnek akıştır; sabit saatli bir paket tablosu değildir.",
      "Program günübirlik olmak zorunda değildir. Bursa’da bir gece veya iki gece konaklama, başka bir günde İstanbul’a dönüş, daha sakin bir tempo veya aileye göre düzenlenmiş bir gezi talep edilebilir. Tripetica ulaşımı ve gün planını talebe göre kurabilir.",
      "Otel, giriş ücretleri, yemekler, teleferik veya kayak otomatik olarak tur ücretine dahil değildir. Kapsam, rezervasyon talebinizde ayrıca netleştirilir.",
    ],
    planTitle: "Bursa programınızı size göre planlayın",
    plan: [
      {
        title: "Kendi grubunuz",
        text: "Yalnızca rezervasyonu yapan kişi veya grupla seyahat edersiniz.",
      },
      {
        title: "Sizin alış noktanız",
        text: "İstanbul’daki uygun alış noktasını rezervasyonda siz belirtirsiniz.",
      },
      {
        title: "Özel araç ve şoför",
        text: "Gün, özel araç ve şoförle sizin temponuza göre ilerler.",
      },
      {
        title: "Esnek duraklar",
        text: "Süre ve tercihlere göre tarihî merkez, Tophane veya Uludağ öne çıkarılabilir.",
      },
      {
        title: "Günübirlik veya konaklama",
        text: "Aynı gün dönüş veya daha uzun bir akış talep edilebilir.",
      },
      {
        title: "Dönüş planı",
        text: "İstanbul’a dönüş, seyahat takviminize göre düzenlenebilir.",
      },
    ],
    midCtaLead:
      "Tarih, alış noktası ve konaklama talebinizi rezervasyon formunda siz yazın.",
    faqTitle: "Sık sorulan sorular",
    faqs: [
      {
        question: "Bursa turu İstanbul’dan mı başlıyor?",
        answer:
          "Evet. Tur İstanbul çıkışlı planlanır. Alış noktası otel, ev, havalimanı veya uygun başka bir adres olabilir; bunu formda siz belirtirsiniz.",
      },
      {
        question: "Bursa turu günübirlik mi?",
        answer:
          "Çoğu rezervasyon günübirlik düşünülür: aynı gün Bursa ve dönüş. Saatler sabit bir paket tablosundan değil, talebinizden çıkar.",
      },
      {
        question: "Bursa’da bir veya iki gece kalabilir miyiz?",
        answer:
          "Evet, daha uzun bir program talep edilebilir. Konaklama ücreti tur fiyatına otomatik dahil değildir.",
      },
      {
        question: "Bursa tur programı kişiye göre değiştirilebilir mi?",
        answer:
          "Evet. Tarihî merkez, Tophane, Uludağ veya daha sakin bir tempo rezervasyonda konuşulur. Herkese aynı güzergâh uygulanmaz.",
      },
      {
        question: "Uludağ tur programına dahil edilebilir mi?",
        answer:
          "Talebe, süreye ve günün koşullarına göre Uludağ programa alınabilir. Her turda dağa çıkılacağı anlamına gelmez.",
      },
      {
        question: "Uludağ’da kar her zaman var mı?",
        answer:
          "Hayır. Kar kışa ve o günkü hava koşullarına bağlıdır. Yaz ve geçiş mevsimlerinde dağ farklı bir doğa deneyimi sunar.",
      },
      {
        question: "Kayak veya diğer Uludağ aktiviteleri tur fiyatına dahil mi?",
        answer:
          "Hayır. Kayak, teleferik ve benzeri aktiviteler işletme, sezon ve müsaitliğe bağlıdır; ayrıca netleştirilir.",
      },
      {
        question: "Otel konaklaması tur ücretine dahil mi?",
        answer:
          "Hayır. Konaklama talep edilebilir fakat otomatik dahil değildir.",
      },
      {
        question: "Bursa turunda hangi noktalar ziyaret edilebilir?",
        answer:
          "Sık konuşulan duraklar arasında Ulu Cami çevresi, tarihî merkez, Tophane ve Uludağ vardır. Hangilerinin seçileceği süre ve tercihe bağlıdır.",
      },
      {
        question: "Aile veya özel grup olarak rezervasyon yapılabilir mi?",
        answer:
          "Evet. Tur yalnızca sizin grubunuz için planlanır; büyük karma grup otobüsüne binmezsiniz.",
      },
    ],
    finalTitle: "Bursa gününüzü planlayın",
    finalLead:
      "İstanbul’dan özel araç ve şoförle tarihî Bursa, Ulu Cami çevresi ve Uludağ’ı kendi temponuzda keşfedin.",
  },
  en: {
    metaTitle: "Bursa Tour from Istanbul | Private Car and Chauffeur | Tripetica",
    metaDescription:
      "A private Bursa tour from Istanbul with your own chauffeur. Historic Bursa, the Grand Mosque and Uludağ — as a day trip or an overnight custom itinerary.",
    heroAlt:
      "Private Bursa tour from Istanbul: Grand Mosque, Uludağ and city views",
    kicker: "Bursa Tour",
    h1: "Private Bursa Tour from Istanbul",
    heroLead:
      "A private Bursa tour from Istanbul with your own vehicle and chauffeur, for guests who want the historic city, the Grand Mosque (Ulu Cami) and the mountain above it. Most days are planned as a day trip; an overnight or slower custom itinerary can be arranged if you ask.",
    bookCta: "Book Now",
    introTitle: "Why visitors leave Istanbul for Bursa",
    introAlt: "Bursa city centre and the landscape around the town",
    intro: [
      "Bursa is remembered as an early Ottoman capital: mosques, hans and hillside neighbourhoods give a different layer of history from Istanbul. The city sits at the foot of Uludağ, so the old centre and the mountain can belong to the same outing.",
      "It is close enough for a private day trip from Istanbul. The point is not only to stop for photographs, but to spend time in a courtyard, on the Tophane ridge or on the mountain road at your own pace.",
    ],
    mosqueTitle: "Historic Bursa and the Grand Mosque",
    mosqueAlt: "Bursa Grand Mosque (Ulu Cami) and the historic centre",
    mosque: [
      "The Grand Mosque (Ulu Cami) stands in the historic core and is one of the buildings visitors come to see. Early Ottoman architecture sits among bazaars and streets; the mosque is not an isolated stop.",
      "How much of the old centre you walk depends on time. Which courtyards and lanes join the day follows what you ask for when you book. Not every landmark is visited on every tour.",
    ],
    tophaneTitle: "Tophane and the historic ridge",
    tophaneAlt: "Tophane in Bursa and the historic city fabric",
    tophane: [
      "Tophane is a ridge where the Ottoman city and a view over the roofs sit together. Below are mosques and markets; above is a look back at the town.",
      "How long you stay in the historic centre is part of the plan. A private driver Bursa itinerary is not locked to a coach stop list.",
    ],
    mountainTitle: "Uludağ through the year",
    mountainLead: [
      "Uludağ rises directly above Bursa. It is not only a winter story; in other seasons people come for forest, air and views.",
    ],
    cableAlt: "Uludağ cable car and mountain scenery above Bursa",
    snowAlt: "Uludağ under snow in winter",
    mountain: [
      "In winter the mountain often wears a different character, with snow if conditions allow. Snow views, a winter atmosphere and skiing or other snow activities can be discussed when weather, snow cover and operators make them possible.",
      "Snow, the cable car, skiing or a particular venue are not promised on every booking. Season, weather and whether facilities are running all matter. Winter is one of Uludağ’s most distinctive periods; it is not the same every day.",
    ],
    stayTitle: "Day trip or overnight in Bursa",
    stay: [
      "The usual shape is a Bursa day trip from Istanbul: leave in the morning, see the places you planned, return the same evening. That is a typical outline, not a locked timetable.",
      "You are not required to return the same day. One night or two in Bursa, a later return to Istanbul, a slower pace or a family-shaped day can be requested. Transport and the outline of the days are planned around that request.",
      "Hotels, tickets, meals, the cable car and ski facilities are not automatically in the chauffeur rate. What is included is confirmed when you book.",
    ],
    planTitle: "A custom Bursa itinerary",
    plan: [
      {
        title: "Your group only",
        text: "You travel with the people on your booking, not a mixed coach.",
      },
      {
        title: "Your pickup",
        text: "You name a suitable pickup point in Istanbul.",
      },
      {
        title: "Private car and chauffeur",
        text: "The day moves at the pace you agreed.",
      },
      {
        title: "Flexible stops",
        text: "The old centre, Tophane or Uludağ can take more or less of the day.",
      },
      {
        title: "Day trip or overnight",
        text: "Same-day return or a longer stay can both be planned.",
      },
      {
        title: "Return that fits",
        text: "The way back to Istanbul can follow your dates.",
      },
    ],
    midCtaLead: "Add your date, pickup and any overnight request on the form.",
    faqTitle: "Questions guests ask",
    faqs: [
      {
        question: "Does the Bursa tour start from Istanbul?",
        answer:
          "Yes. Pickup can be a hotel, home, airport or another suitable address — you enter it on the form.",
      },
      {
        question: "Is it a day trip?",
        answer:
          "Most bookings are thought of as a day trip. Hours come from your request, not from a printed package clock.",
      },
      {
        question: "Can we stay one or two nights?",
        answer:
          "Yes. A longer plan can be requested. Lodging is not included in the tour rate automatically.",
      },
      {
        question: "Can the itinerary be changed?",
        answer:
          "Yes. Historic centre, Tophane, Uludağ or a quieter pace are discussed when you book.",
      },
      {
        question: "Can Uludağ be part of the day?",
        answer:
          "It can, depending on time and conditions. It is not automatic on every tour.",
      },
      {
        question: "Is there always snow on Uludağ?",
        answer:
          "No. Snow depends on winter and the weather that week. Other seasons offer a different mountain day.",
      },
      {
        question: "Are skiing or other Uludağ activities included?",
        answer:
          "No. Skiing, the cable car and similar activities depend on operators and the season, and are confirmed separately.",
      },
      {
        question: "Is the hotel included?",
        answer:
          "No. Overnight stays can be planned; they are not included by default.",
      },
      {
        question: "Which places can we visit?",
        answer:
          "Guests often ask for the Grand Mosque area, the historic centre, Tophane and Uludağ. What you actually see depends on time and preference.",
      },
      {
        question: "Can families or a private group book?",
        answer:
          "Yes. The tour is planned only for your party.",
      },
    ],
    finalTitle: "Plan your day in Bursa",
    finalLead:
      "See historic Bursa, the Grand Mosque area and Uludağ at your own pace, with a private car and chauffeur from Istanbul.",
  },
  ru: {
    metaTitle: "Тур в Бурсу из Стамбула | Автомобиль с водителем | Tripetica",
    metaDescription:
      "Индивидуальный тур в Бурсу из Стамбула: исторический центр, мечеть Улу-джами и Улудаг — на один день или с ночёвкой по запросу.",
    heroAlt:
      "Индивидуальный тур в Бурсу из Стамбула: Улу-джами, Улудаг и виды города",
    kicker: "Тур в Бурсу",
    h1: "Индивидуальный тур в Бурсу из Стамбула",
    heroLead:
      "Выезд из Стамбула на автомобиле с водителем: историческая Бурса, район мечети Улу-джами и природа Улудага. Чаще всего это поездка на один день; по запросу можно собрать программу с ночёвкой и более спокойным темпом.",
    bookCta: "Забронировать",
    introTitle: "Зачем ехать из Стамбула в Бурсу",
    introAlt: "Центр Бурсы и природный вид на город",
    intro: [
      "Бурсу помнят как одну из ранних столиц Османского государства: мечети, ханы и кварталы на склонах дают другой слой истории, чем Стамбул. Город стоит у подножия Улудага, поэтому старый центр и гору можно увидеть в одной поездке.",
      "Расстояние позволяет индивидуальный выезд на день. Речь не только о фото на остановках, а о времени во дворе мечети, на хребте Топхане или на горной дороге — в своём ритме.",
    ],
    mosqueTitle: "Историческая Бурса и мечеть Улу-джами",
    mosqueAlt: "Мечеть Улу-джами и исторический центр Бурсы",
    mosque: [
      "Улу-джами стоит в историческом ядре и остаётся одной из главных построек, ради которых приезжают. Ранняя османская архитектура окружена рынками и улицами; мечеть — не изолированная точка.",
      "Сколько времени уделить старому центру, зависит от дня. Какие дворы и улицы войдут в маршрут, следует из заявки. Не все места посещают в каждом туре.",
    ],
    tophaneTitle: "Топхане и исторический склон",
    tophaneAlt: "Топхане в Бурсе и ткань старого города",
    tophane: [
      "С Топхане удобно читать османский город и вид на крыши вместе. Внизу мечети и рынки, сверху — взгляд на Бурсу.",
      "Сколько оставаться в историческом центре, часть плана. Индивидуальный маршрут не привязан к списку остановок большого автобуса.",
    ],
    mountainTitle: "Улудаг в разные сезоны",
    mountainLead: [
      "Улудаг поднимается прямо над Бурсой. Это не только зимняя история: в другие месяцы едут за лесом, воздухом и видами.",
    ],
    cableAlt: "Канатная дорога на Улудаге и горный пейзаж",
    snowAlt: "Улудаг под снегом зимой",
    mountain: [
      "Зимой гора часто меняет характер, если лежит снег. Виды, зимняя атмосфера, лыжи и другие занятия на снегу можно обсуждать, когда позволяют погода, снежный покров и работа площадок.",
      "Снег, канатная дорога, лыжи или конкретный объект не обещаются в каждой заявке. Сезон, погода и открыты ли сервисы — всё влияет. Зима — один из самых характерных периодов Улудага, но не каждый день одинаков.",
    ],
    stayTitle: "Один день или ночёвка в Бурсе",
    stay: [
      "Обычная схема — выезд из Стамбула на день: утром отъезд, запланированные точки, вечером возвращение. Это типичный контур, а не жёсткое расписание.",
      "Возвращаться в тот же день не обязательно. Можно запросить одну или две ночи в Бурсе, более поздний возврат, спокойный темп или семейный сценарий. Транспорт и канва дней собираются под этот запрос.",
      "Отели, билеты, еда, канатная дорога и лыжные сервисы в тариф автомобиля автоматически не входят. Состав услуги уточняется при бронировании.",
    ],
    planTitle: "Программа под вас",
    plan: [
      {
        title: "Только ваша компания",
        text: "Едете с теми, кто в заявке, без смешанного автобуса.",
      },
      {
        title: "Ваша подача",
        text: "Удобную точку в Стамбуле указываете вы.",
      },
      {
        title: "Автомобиль с водителем",
        text: "День идёт в согласованном темпе.",
      },
      {
        title: "Гибкие остановки",
        text: "Старый центр, Топхане или Улудаг могут занять больше или меньше времени.",
      },
      {
        title: "День или ночёвка",
        text: "Можно вернуться вечером или остаться дольше.",
      },
      {
        title: "Возвращение под даты",
        text: "Обратный путь в Стамбул можно вписать в ваш график.",
      },
    ],
    midCtaLead:
      "Дату, адрес подачи и пожелание о ночёвке укажите в форме бронирования.",
    faqTitle: "Частые вопросы",
    faqs: [
      {
        question: "Тур в Бурсу начинается из Стамбула?",
        answer:
          "Да. Подача — отель, дом, аэропорт или другой удобный адрес, который вы укажете в форме.",
      },
      {
        question: "Это поездка на один день?",
        answer:
          "Чаще всего да. Часы следуют из заявки, а не из готового пакетного расписания.",
      },
      {
        question: "Можно остаться на одну или две ночи?",
        answer:
          "Да. Более длинный план можно запросить. Проживание в стоимость тура автоматически не входит.",
      },
      {
        question: "Можно ли менять программу?",
        answer:
          "Да. Исторический центр, Топхане, Улудаг или более спокойный темп обсуждаются при бронировании.",
      },
      {
        question: "Улудаг можно включить в день?",
        answer:
          "Можно, если позволяют время и условия. Это не происходит автоматически в каждом туре.",
      },
      {
        question: "На Улудаге всегда есть снег?",
        answer:
          "Нет. Снег зависит от зимы и погоды. В другие сезоны гора даёт другой природный день.",
      },
      {
        question: "Лыжи и другие занятия на Улудаге входят в цену?",
        answer:
          "Нет. Лыжи, канатная дорога и похожие услуги зависят от сезона и операторов и уточняются отдельно.",
      },
      {
        question: "Отель входит в стоимость?",
        answer:
          "Нет. Ночёвку можно спланировать, по умолчанию она не включена.",
      },
      {
        question: "Какие места можно посетить?",
        answer:
          "Часто говорят о районе Улу-джами, историческом центре, Топхане и Улудаге. Что войдёт в день, зависит от времени и предпочтений.",
      },
      {
        question: "Можно бронировать семьёй или своей группой?",
        answer:
          "Да. Тур планируется только для вашей компании.",
      },
    ],
    finalTitle: "Соберите день в Бурсе",
    finalLead:
      "Историческая Бурса, район Улу-джами и Улудаг в своём темпе — на автомобиле с водителем из Стамбула.",
  },
  ar: {
    metaTitle: "جولة بورصة من إسطنبول | سيارة خاصة وسائق خاص | Tripetica",
    metaDescription:
      "جولة بورصة خاصة من إسطنبول مع سائقكم الخاص. بورصة التاريخية والجامع الكبير وأولوداغ — كرحلة ليوم واحد أو برنامج مخصّص مع مبيت.",
    heroAlt:
      "جولة بورصة الخاصة من إسطنبول: الجامع الكبير وأولوداغ وإطلالات المدينة",
    kicker: "جولة بورصة",
    h1: "جولة بورصة الخاصة من إسطنبول",
    heroLead:
      "جولة بورصة خاصة من إسطنبول بسيارتكم وسائقكم الخاص، للضيوف الذين يريدون المدينة التاريخية والجامع الكبير (أولو جامع) والجبل فوقها. تُخطَّط معظم الأيام كرحلة ليوم واحد؛ ويمكن ترتيب برنامج مع مبيت أو وتيرة أهدأ إذا طلبتم.",
    bookCta: "احجز الآن",
    introTitle: "لماذا يغادر الزوار إسطنبول إلى بورصة",
    introAlt: "وسط مدينة بورصة والمشهد الطبيعي حول البلدة",
    intro: [
      "تُذكر بورصة كعاصمة عثمانية مبكرة: المساجد والخان والأحياء على المنحدرات تقدّم طبقة تاريخ مختلفة عن إسطنبول. تقع المدينة عند سفح أولوداغ، لذا يمكن أن ينتمي المركز القديم والجبل إلى النزهة نفسها.",
      "هي قريبة بما يكفي لرحلة خاصة ليوم واحد من إسطنبول. الهدف ليس التوقف للصور فقط، بل قضاء وقت في فناء أو على مرتفع توبخانة أو على طريق الجبل وفق وتيرتكم.",
    ],
    mosqueTitle: "بورصة التاريخية والجامع الكبير",
    mosqueAlt: "الجامع الكبير في بورصة (أولو جامع) والمركز التاريخي",
    mosque: [
      "يقف الجامع الكبير (أولو جامع) في النواة التاريخية وهو من المباني التي يأتي الزوار لرؤيتها. تجلس العمارة العثمانية المبكرة بين الأسواق والشوارع؛ فالجامع ليس توقفاً معزولاً.",
      "كم تمشون في المركز القديم يعتمد على الوقت. أي الأفنية والأزقة تنضم إلى اليوم يتبع ما تطلبونه عند الحجز. لا تُزار كل المعالم في كل جولة.",
    ],
    tophaneTitle: "توبخانة والمرتفع التاريخي",
    tophaneAlt: "توبخانة في بورصة والنسيج التاريخي للمدينة",
    tophane: [
      "توبخانة مرتفع تلتقي فيه المدينة العثمانية بإطلالة على السطوح. في الأسفل مساجد وأسواق؛ وفي الأعلى نظرة إلى البلدة.",
      "مدة بقائكم في المركز التاريخي جزء من الخطة. برنامج بورصة بسائق خاص غير مقيّد بقائمة توقفات حافلة جماعية.",
    ],
    mountainTitle: "أولوداغ على مدار السنة",
    mountainLead: [
      "يرتفع أولوداغ مباشرة فوق بورصة. ليست القصة شتوية فقط؛ ففي المواسم الأخرى يأتي الناس من أجل الغابة والهواء والإطلالات.",
    ],
    cableAlt: "التلفريك في أولوداغ ومشهد الجبل فوق بورصة",
    snowAlt: "أولوداغ تحت الثلج في الشتاء",
    mountain: [
      "في الشتاء كثيراً ما يكتسي الجبل طابعاً مختلفاً، مع ثلج إذا سمحت الظروف. يمكن مناقشة إطلالات الثلج وأجواء الشتاء والتزلج أو أنشطة ثلجية أخرى عندما يجعلها الطقس والغطاء الثلجي والمشغّلون ممكنة.",
      "لا يُوعَد بالثلج أو التلفريك أو التزلج أو منشأة معيّنة في كل حجز. الموسم والطقس وما إذا كانت المرافق تعمل كلها مهمة. الشتاء من أكثر فترات أولوداغ تميّزاً؛ وهو ليس واحداً كل يوم.",
    ],
    stayTitle: "رحلة ليوم واحد أو مبيت في بورصة",
    stay: [
      "الشكل المعتاد هو رحلة بورصة ليوم واحد من إسطنبول: المغادرة صباحاً، رؤية الأماكن التي خطّطتم لها، والعودة في المساء نفسه. هذا مخطط نموذجي، لا جدول مواعيد مقفل.",
      "لستم ملزمين بالعودة في اليوم نفسه. يمكن طلب ليلة أو ليلتين في بورصة، أو عودة لاحقة إلى إسطنبول، أو وتيرة أهدأ، أو يوم موجَّه للعائلة. يُخطَّط النقل ومخطط الأيام حول ذلك الطلب.",
      "الفنادق والتذاكر والوجبات والتلفريك ومرافق التزلج ليست تلقائياً ضمن تعرفة السائق الخاص. يُؤكَّد ما هو مشمول عند الحجز.",
    ],
    planTitle: "برنامج بورصة مخصّص لكم",
    plan: [
      {
        title: "مجموعتكم فقط",
        text: "تسافرون مع من في حجزكم، لا في حافلة مختلطة.",
      },
      {
        title: "نقطة استلامكم",
        text: "تحدّدون نقطة استلام مناسبة في إسطنبول.",
      },
      {
        title: "سيارة خاصة وسائق خاص",
        text: "يسير اليوم بالوتيرة التي اتفقتم عليها.",
      },
      {
        title: "توقفات مرنة",
        text: "يمكن أن يأخذ المركز القديم أو توبخانة أو أولوداغ حصة أكبر أو أصغر من اليوم.",
      },
      {
        title: "يوم واحد أو مبيت",
        text: "يمكن تخطيط العودة في اليوم نفسه أو إقامة أطول.",
      },
      {
        title: "عودة تناسب تواريخكم",
        text: "يمكن أن تتبع طريق العودة إلى إسطنبول تواريخكم.",
      },
    ],
    midCtaLead: "أضيفوا التاريخ ونقطة الاستلام وأي طلب مبيت في النموذج.",
    faqTitle: "أسئلة يطرحها الضيوف",
    faqs: [
      {
        question: "هل تبدأ جولة بورصة من إسطنبول؟",
        answer:
          "نعم. يمكن أن تكون نقطة الاستلام فندقاً أو منزلاً أو مطاراً أو عنواناً مناسباً آخر — تدخلونه في النموذج.",
      },
      {
        question: "هل هي رحلة ليوم واحد؟",
        answer:
          "تُفكَّر معظم الحجوزات كرحلة ليوم واحد. تأتي الساعات من طلبكم، لا من ساعة باقة مطبوعة.",
      },
      {
        question: "هل يمكننا المبيت ليلة أو ليلتين؟",
        answer:
          "نعم. يمكن طلب خطة أطول. الإقامة غير مشمولة تلقائياً في تعرفة الجولة.",
      },
      {
        question: "هل يمكن تغيير البرنامج؟",
        answer:
          "نعم. يُناقش المركز التاريخي وتوبخانة وأولوداغ أو وتيرة أهدأ عند الحجز.",
      },
      {
        question: "هل يمكن أن يكون أولوداغ جزءاً من اليوم؟",
        answer:
          "يمكن ذلك، وفق الوقت والظروف. وهو ليس تلقائياً في كل جولة.",
      },
      {
        question: "هل يوجد ثلج دائماً على أولوداغ؟",
        answer:
          "لا. يعتمد الثلج على الشتاء وطقس ذلك الأسبوع. تقدّم المواسم الأخرى يوماً جبلياً مختلفاً.",
      },
      {
        question: "هل التزلج أو أنشطة أولوداغ الأخرى مشمولة؟",
        answer:
          "لا. يعتمد التزلج والتلفريك والأنشطة المشابهة على المشغّلين والموسم، وتُؤكَّد بشكل منفصل.",
      },
      {
        question: "هل الفندق مشمول؟",
        answer:
          "لا. يمكن تخطيط المبيت؛ وهو غير مشمول افتراضياً.",
      },
      {
        question: "ما الأماكن التي يمكن زياراتها؟",
        answer:
          "كثيراً ما يطلب الضيوف منطقة الجامع الكبير والمركز التاريخي وتوبخانة وأولوداغ. ما ترونه فعلاً يعتمد على الوقت والتفضيل.",
      },
      {
        question: "هل يمكن للعائلات أو مجموعة خاصة الحجز؟",
        answer:
          "نعم. تُخطَّط الجولة لرفقتكم فقط.",
      },
    ],
    finalTitle: "خطّطوا يومكم في بورصة",
    finalLead:
      "شاهدوا بورصة التاريخية ومنطقة الجامع الكبير وأولوداغ وفق وتيرتكم، بسيارة خاصة وسائق خاص من إسطنبول.",
  },
};
