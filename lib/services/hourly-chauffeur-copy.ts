import { type Locale } from "@/lib/i18n/config";

export type HourlyChauffeurCopy = {
  metaTitle: string;
  metaDescription: string;
  heroAlt: string;
  kicker: string;
  h1: string;
  heroLead: string;
  bookCta: string;
  whatTitle: string;
  what: string[];
  usesTitle: string;
  uses: { title: string; text: string }[];
  howTitle: string;
  how: { title: string; text: string }[];
  compareTitle: string;
  compare: string[];
  areaTitle: string;
  area: string[];
  finalTitle: string;
  finalLead: string;
};

export const hourlyChauffeurCopy: Record<Locale, HourlyChauffeurCopy> = {
  tr: {
    metaTitle:
      "Saatlik Şoförlü Araç | İstanbul, Antalya ve Türkiye | Tripetica",
    metaDescription:
      "İstanbul, Antalya ve Türkiye genelinde saatlik şoförlü özel araç. Toplantı, alışveriş ve esnek programlar için profesyonel şoför, seçtiğiniz süre boyunca sizinle.",
    heroAlt:
      "Saatlik kullanım için bekleyen şoförlü özel araç",
    kicker: "Saatlik Şoförlü Araç",
    h1: "İstanbul, Antalya ve Türkiye Genelinde Saatlik Şoförlü Araç",
    heroLead:
      "İş toplantıları, alışveriş, özel programlar veya gün içinde birden fazla noktaya yapacağınız yolculuklar için profesyonel şoförlü özel araç hizmeti. Aracınız ve şoförünüz seçtiğiniz süre boyunca programınıza göre sizinle birlikte olur.",
    bookCta: "Rezervasyon Yap",
    whatTitle: "Saatlik Şoförlü Araç Hizmeti Nedir?",
    what: [
      "Saatlik şoförlü araç hizmeti, yalnızca A noktasından B noktasına yapılan klasik bir transferden farklıdır. Araç ve profesyonel şoför, rezervasyon sırasında belirlediğiniz süre boyunca kullanımınıza tahsis edilir.",
      "Programınız içerisinde birden fazla toplantıya katılabilir, alışveriş yapabilir, restoran veya otel ziyaretleri gerçekleştirebilir ya da şehir içinde farklı noktalara gidebilirsiniz. Her yolculuk için yeniden araç çağırmak yerine aynı araç ve şoför programınız boyunca sizinle birlikte kalır.",
    ],
    usesTitle: "Saatlik Şoförlü Araç Hangi Durumlarda Tercih Edilir?",
    uses: [
      {
        title: "İş ve Toplantılar",
        text: "Gün içerisinde birden fazla toplantıya veya iş adresine ulaşmanız gerektiğinde aracınız program boyunca hazır bekler.",
      },
      {
        title: "Alışveriş ve Özel Programlar",
        text: "Alışveriş merkezleri, restoranlar veya farklı adreslerden oluşan kişisel programlarınız için esnek ulaşım sağlar.",
      },
      {
        title: "Birden Fazla Durak",
        text: "Tek bir başlangıç ve varış noktasıyla sınırlı kalmadan, ihtiyaç duyduğunuz farklı noktalara aynı araçla ulaşabilirsiniz.",
      },
      {
        title: "Misafir ve Yönetici Ulaşımı",
        text: "Şirket misafirleri, yöneticiler veya özel konuklar için planlı ve profesyonel şoförlü ulaşım sağlar.",
      },
    ],
    howTitle: "Saatlik Şoförlü Araç Rezervasyonu Nasıl Çalışır?",
    how: [
      {
        title: "Alış noktanızı seçin.",
        text: "Otel, ev, ofis, havalimanı veya başka bir adres belirleyebilirsiniz.",
      },
      {
        title: "Tarih, saat ve kullanım süresini seçin.",
        text: "Araca kaç saat ihtiyacınız olduğunu rezervasyon sırasında belirtin.",
      },
      {
        title: "Aracınızı seçin ve rezervasyonu tamamlayın.",
        text: "Programınıza uygun araç sınıfını seçerek rezervasyonunuzu oluşturun.",
      },
      {
        title: "Şoförünüz belirlenen saatte hazır olur.",
        text: "Rezervasyon süresi boyunca programınıza göre seyahat edebilirsiniz.",
      },
    ],
    compareTitle: "Neden Tek Yön Transfer Yerine Saatlik Şoförlü Araç?",
    compare: [
      "Tek yön transfer, belirli bir alış ve bırakış noktası arasındaki yolculuklar için uygundur. Ancak programınızda birden fazla durak, bekleme süresi veya değişken bir rota varsa saatlik şoförlü araç daha esnek bir çözümdür.",
      "Aynı araç ve şoför rezervasyon süresi boyunca sizinle kalacağı için her durak sonrasında yeniden transfer veya taksi aramanız gerekmez.",
    ],
    areaTitle: "İstanbul, Antalya ve Türkiye Genelinde Şoförlü Araç Hizmeti",
    area: [
      "Tripetica saatlik şoförlü araç hizmeti İstanbul, Antalya ve Türkiye genelinde sunulmaktadır. Hizmet bölgesi, araç müsaitliği ve rezervasyon detaylarına göre planlama yapılır.",
      "İstanbul'da iş programları, şehir içi ulaşım ve özel organizasyonların yanı sıra Antalya ve Türkiye'nin farklı şehirlerinde de şoförlü araç rezervasyonu yapılabilir.",
    ],
    finalTitle: "Programınıza Uygun Şoförlü Araç Rezervasyonu Yapın",
    finalLead:
      "Kullanım sürenizi ve başlangıç noktanızı belirleyerek rezervasyonunuzu birkaç adımda oluşturabilirsiniz.",
  },
  en: {
    metaTitle: "Hourly Chauffeur Service in Turkey | Tripetica",
    metaDescription:
      "Hourly chauffeur service in Istanbul, Antalya and across Turkey. A private car and professional driver for meetings, shopping and flexible schedules.",
    heroAlt: "Private chauffeur-driven car available for hourly hire",
    kicker: "Hourly Chauffeur Service",
    h1: "Hourly Chauffeur Service in Istanbul, Antalya and Across Turkey",
    heroLead:
      "A professional chauffeur-driven private car for business meetings, shopping, private appointments or flexible journeys with multiple stops. Your vehicle and chauffeur remain available for the duration you book.",
    bookCta: "Book Now",
    whatTitle: "What Is an Hourly Chauffeur Service?",
    what: [
      "An hourly chauffeur service is different from a standard point-to-point transfer. The vehicle and professional chauffeur are reserved for your use for the period you select when booking.",
      "You can attend multiple meetings, go shopping, visit restaurants or hotels, and travel between different locations without arranging a new vehicle for every journey. Your chauffeur remains available throughout your booked time.",
    ],
    usesTitle: "When Is an Hourly Chauffeur Service Useful?",
    uses: [
      {
        title: "Business & Meetings",
        text: "Ideal when you need to travel between several meetings or business locations during the day.",
      },
      {
        title: "Shopping & Private Schedules",
        text: "Flexible transportation for shopping centres, restaurants, hotels and personal appointments.",
      },
      {
        title: "Multiple Stops",
        text: "Travel to several destinations using the same vehicle instead of booking a separate transfer each time.",
      },
      {
        title: "Guests & Executive Travel",
        text: "Professional chauffeur-driven transportation for company guests, executives and private visitors.",
      },
    ],
    howTitle: "How Hourly Chauffeur Booking Works",
    how: [
      {
        title: "Choose your pickup point.",
        text: "You can start from a hotel, home, office, airport or another address.",
      },
      {
        title: "Select the date, time and duration.",
        text: "Tell us how many hours you need when you make the reservation.",
      },
      {
        title: "Choose a vehicle and complete the booking.",
        text: "Select the vehicle class that fits your plans and confirm the reservation.",
      },
      {
        title: "Your chauffeur is ready at the agreed time.",
        text: "Travel according to your schedule throughout the reserved period.",
      },
    ],
    compareTitle: "Why Book an Hourly Chauffeur Instead of a One-Way Transfer?",
    compare: [
      "A one-way transfer suits a journey between a set pickup and drop-off. When your day includes several stops, waiting time or a changing route, an hourly chauffeur is the more flexible option.",
      "The same vehicle and chauffeur stay with you for the booked period, so you do not need to arrange another transfer or taxi after each stop.",
    ],
    areaTitle: "Chauffeur Service in Istanbul, Antalya and Across Turkey",
    area: [
      "Tripetica provides hourly chauffeur service in Istanbul, Antalya and across Turkey. Service availability is planned according to location, vehicle availability and booking requirements.",
      "The service can be used for business schedules, private travel and flexible transportation in Istanbul, Antalya and other destinations throughout Turkey.",
    ],
    finalTitle: "Book a Chauffeur for Your Schedule",
    finalLead:
      "Choose your pickup point and required duration to arrange your chauffeur-driven vehicle.",
  },
  ru: {
    metaTitle:
      "Почасовой автомобиль с водителем в Стамбуле, Анталье и по Турции | Tripetica",
    metaDescription:
      "Почасовой автомобиль с водителем в Стамбуле, Анталье и по всей Турции. Частный транспорт для встреч, шопинга и гибкого графика на выбранное время.",
    heroAlt: "Частный автомобиль с водителем для почасовой аренды",
    kicker: "Почасовый автомобиль с водителем",
    h1: "Почасовой автомобиль с водителем в Стамбуле, Анталье и по всей Турции",
    heroLead:
      "Профессиональный автомобиль с водителем для деловых встреч, шопинга, частных поездок и гибких маршрутов с несколькими остановками. Автомобиль и водитель остаются в вашем распоряжении на выбранное время.",
    bookCta: "Забронировать",
    whatTitle: "Что такое почасовой автомобиль с водителем?",
    what: [
      "Почасовая услуга с водителем отличается от обычного трансфера из одной точки в другую. Автомобиль и профессиональный водитель предоставляются в ваше распоряжение на выбранное при бронировании время.",
      "В течение этого времени вы можете посетить несколько встреч, магазины, рестораны, отели или другие места, не заказывая новый автомобиль для каждой поездки.",
    ],
    usesTitle: "Когда удобно пользоваться почасовой услугой с водителем?",
    uses: [
      {
        title: "Деловые встречи",
        text: "Подходит для поездок между несколькими встречами и деловыми адресами в течение дня.",
      },
      {
        title: "Шопинг и личная программа",
        text: "Удобный вариант для поездок по магазинам, ресторанам, отелям и другим адресам.",
      },
      {
        title: "Несколько остановок",
        text: "Возможность посетить несколько мест на одном автомобиле без отдельного заказа для каждой поездки.",
      },
      {
        title: "Гости и деловые поездки",
        text: "Профессиональный транспорт с водителем для гостей компании, руководителей и частных клиентов.",
      },
    ],
    howTitle: "Как бронируется почасовой автомобиль с водителем",
    how: [
      {
        title: "Выберите место подачи.",
        text: "Можно указать отель, дом, офис, аэропорт или другой адрес.",
      },
      {
        title: "Укажите дату, время и продолжительность.",
        text: "При бронировании выберите, на сколько часов вам нужен автомобиль.",
      },
      {
        title: "Выберите автомобиль и завершите бронирование.",
        text: "Подберите класс автомобиля под вашу программу и подтвердите заказ.",
      },
      {
        title: "Водитель будет готов к назначенному времени.",
        text: "В течение забронированного периода вы едете по своему графику.",
      },
    ],
    compareTitle: "Почему почасовой автомобиль, а не разовый трансфер?",
    compare: [
      "Разовый трансфер удобен, когда нужно доехать из одной точки в другую. Если в программе несколько остановок, ожидание или меняющийся маршрут, почасовой автомобиль с водителем даёт больше свободы.",
      "Один и тот же автомобиль и водитель остаются с вами на всё забронированное время, поэтому после каждой остановки не нужно заново искать трансфер или такси.",
    ],
    areaTitle: "Автомобиль с водителем в Стамбуле, Анталье и по всей Турции",
    area: [
      "Tripetica предоставляет почасовые автомобили с водителем в Стамбуле, Анталье и других регионах Турции. Доступность услуги зависит от города, наличия автомобиля и деталей бронирования.",
      "Услуга подходит для деловых программ, частных поездок и гибких маршрутов в разных городах Турции.",
    ],
    finalTitle: "Забронируйте автомобиль с водителем",
    finalLead:
      "Выберите место подачи и необходимое время использования автомобиля, чтобы оформить бронирование.",
  },
  ar: {
    metaTitle: "خدمة السائق الخاص بالساعة في تركيا | Tripetica",
    metaDescription:
      "خدمة السائق الخاص بالساعة في إسطنبول وأنطاليا وفي أنحاء تركيا. سيارة خاصة وسائق محترف للاجتماعات والتسوّق والبرامج المرنة.",
    heroAlt: "سيارة خاصة بسائق خاص متاحة للحجز بالساعة",
    kicker: "خدمة السائق الخاص بالساعة",
    h1: "خدمة السائق الخاص بالساعة في إسطنبول وأنطاليا وتركيا",
    heroLead:
      "سيارة خاصة بسائق خاص محترف لاجتماعات العمل والتسوّق والمواعيد الخاصة أو الرحلات المرنة ذات التوقفات المتعددة. تبقى السيارة والسائق في خدمتكم طوال المدة التي تحجزونها.",
    bookCta: "احجز الآن",
    whatTitle: "ما خدمة السائق الخاص بالساعة؟",
    what: [
      "تختلف خدمة السائق الخاص بالساعة عن النقل الاعتيادي من نقطة إلى نقطة. تُخصَّص السيارة والسائق المحترف لاستخدامكم طوال الفترة التي تختارونها عند الحجز.",
      "يمكنكم حضور اجتماعات متعددة، والتسوّق، وزيارة المطاعم أو الفنادق، والتنقّل بين مواقع مختلفة دون ترتيب سيارة جديدة لكل رحلة. يبقى سائقكم متاحاً طوال الوقت المحجوز.",
    ],
    usesTitle: "متى تكون خدمة السائق الخاص بالساعة مفيدة؟",
    uses: [
      {
        title: "الأعمال والاجتماعات",
        text: "مناسبة عندما تحتاجون التنقّل بين عدة اجتماعات أو عناوين عمل خلال اليوم.",
      },
      {
        title: "التسوّق والبرامج الخاصة",
        text: "تنقّل مرن لمراكز التسوّق والمطاعم والفنادق والمواعيد الشخصية.",
      },
      {
        title: "توقفات متعددة",
        text: "سافروا إلى عدة وجهات بالسيارة نفسها بدل حجز نقل منفصل في كل مرة.",
      },
      {
        title: "الضيوف والسفر التنفيذي",
        text: "تنقّل احترافي بسائق خاص لضيوف الشركات والمديرين والزوار الخاصين.",
      },
    ],
    howTitle: "كيف يعمل حجز السائق الخاص بالساعة؟",
    how: [
      {
        title: "اختاروا نقطة الانطلاق.",
        text: "يمكنكم البدء من فندق أو منزل أو مكتب أو مطار أو عنوان آخر.",
      },
      {
        title: "حدّدوا التاريخ والوقت والمدة.",
        text: "أخبرونا بعدد الساعات التي تحتاجونها عند إتمام الحجز.",
      },
      {
        title: "اختاروا السيارة وأكملوا الحجز.",
        text: "اختاروا فئة السيارة التي تناسب خططكم وأكّدوا الحجز.",
      },
      {
        title: "يكون سائقكم جاهزاً في الوقت المتفق عليه.",
        text: "سافروا وفق جدولكم طوال الفترة المحجوزة.",
      },
    ],
    compareTitle: "لماذا تحجزون سائقاً خاصاً بالساعة بدل النقل في اتجاه واحد؟",
    compare: [
      "يناسب النقل في اتجاه واحد الرحلة بين نقطتي انطلاق ووصول محددتين. أما إذا شمل يومكم عدة توقفات أو وقت انتظار أو مساراً متغيّراً، فالسائق الخاص بالساعة هو الخيار الأكثر مرونة.",
      "تبقى السيارة والسائق أنفسهما معكم طوال المدة المحجوزة، فلا تحتاجون ترتيب نقل أو تاكسي جديد بعد كل توقف.",
    ],
    areaTitle: "خدمة السائق الخاص في إسطنبول وأنطاليا وتركيا",
    area: [
      "تقدّم Tripetica خدمة السائق الخاص بالساعة في إسطنبول وأنطاليا وفي أنحاء تركيا. تُخطَّط إتاحة الخدمة وفق الموقع وتوفّر السيارات ومتطلبات الحجز.",
      "يمكن استخدام الخدمة لبرامج العمل والسفر الخاص والتنقّل المرن في إسطنبول وأنطاليا ووجهات أخرى في أنحاء تركيا.",
    ],
    finalTitle: "احجزوا سائقاً خاصاً وفق جدولكم",
    finalLead:
      "اختاروا نقطة الانطلاق والمدة المطلوبة لترتيب سيارتكم بسائق خاص.",
  },
};
