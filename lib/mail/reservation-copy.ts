import { type Locale } from "@/lib/i18n/config";

export type ReservationMailCopy = {
  confirmationSubject: (code: string) => string;
  greeting: (name: string) => string;
  confirmationThanks: string;
  confirmationIntro: string;
  reservationCode: string;
  transferDateTime: string;
  serviceType: string;
  duration: string;
  vehicleClass: string;
  pickup: string;
  dropoff: string;
  total: string;
  paymentMethod: string;
  paymentStatus: string;
  meetingSectionTitle: string;
  meetingPointLabel: string;
  meetingPointValue: string;
  meetingInstructions: string;
  meetingPhotoAlt: string;
  meetingVideoIntro: string;
  meetingVideoCta: string;
  meetingImportantTitle: string;
  meetingImportantParagraphs: [string, string];
  sawMeetingPointValue: string;
  sawMeetingInstructions: [string, string];
  sawMeetingPhotoAlt: string;
  sawMeetingVideoIntro: string;
  sawNoMeetPointValue: string;
  sawNoMeetInstructions: string;
  sawNoMeetPhotoAlt: string;
  aytMeetingPointValue: string;
  aytMeetingInstructions: [string, string];
  aytMeetingPhotoAlt: string;
  aytInternetClosing: string;
  aytDomesticNoteTitle: string;
  aytDomesticNoteParagraphs: [string, string];
  noMeetPointValue: string;
  noMeetInstructions: string;
  noMeetContactTitle: string;
  noMeetContactParagraphs: [string, string, string];
  noMeetSteps: [
    { title: string; body: string; imageAlt: string },
    { title: string; body: string; imageAlt: string },
    { title: string; body: string; imageAlt: string },
    { title: string; body: string; imageAlt: string },
  ];
  contactIntro: string;
  contactPhoneLabel: string;
  contactWhatsappLabel: string;
  contactTelegramLabel: string;
  contactViberLabel: string;
  contactTelegramHandle: string;
  internetSectionTitle: string;
  internetIntro: string;
  internetParagraphs: [string, string, string, string, string, string];
  closing: string;
  paymentConfirmationSubject: (code: string) => string;
  paymentConfirmationTitle: string;
  paymentConfirmationBody: (code: string) => string;
  amountPaid: string;
  paymentConfirmationClosing: string;
};

export const reservationMailCopy: Record<Locale, ReservationMailCopy> = {
  tr: {
    confirmationSubject: (code) => `Rezervasyon onayınız — ${code}`,
    greeting: (name) => (name ? `Merhaba ${name},` : "Merhaba,"),
    confirmationThanks: "Tripetica’yı tercih ettiğiniz için teşekkür ederiz.",
    confirmationIntro:
      "Rezervasyonunuz başarıyla oluşturulmuştur. Rezervasyon belgenizi (Voucher PDF) bu e-postanın ekinde bulabilirsiniz.",
    reservationCode: "Rezervasyon kodu",
    transferDateTime: "Tarih ve saat",
    serviceType: "Servis türü",
    duration: "Süre",
    vehicleClass: "Araç sınıfı",
    pickup: "Alış noktası",
    dropoff: "Bırakış noktası",
    total: "Toplam tutar",
    paymentMethod: "Ödeme yöntemi",
    paymentStatus: "Ödeme durumu",
    meetingSectionTitle: "Buluşma noktası",
    meetingPointLabel: "Buluşma noktası",
    meetingPointValue:
      "13 numaralı çıkış kapısının hemen sol tarafında bulunan BYRIDES işaretinin olduğu alan",
    meetingInstructions:
      "İstanbul Havalimanı’nda 13 numaralı çıkış kapısından çıktıktan sonra hemen sol taraftaki BYRIDES işaretini takip ederek buluşma alanına geliniz. Karşılama görevlimiz sizi bu noktada karşılayacaktır.",
    meetingPhotoAlt: "İstanbul Havalimanı buluşma noktası",
    meetingVideoIntro:
      "Buluşma alanını daha kolay bulmak için kısa videoyu izleyebilirsiniz.",
    meetingVideoCta: "Buluşma videosunu izle",
    meetingImportantTitle: "Önemli bilgilendirme",
    meetingImportantParagraphs: [
      "Karşılama görevlimizle buluştuktan sonra görevlimiz şoförünüz ile iletişime geçecektir. Şoförünüz aracıyla otopark alanına gelecek ve karşılama görevlimiz sizi aracınıza kadar yönlendirecektir.",
      "Bu süreç, havalimanı ve otopark yoğunluğuna bağlı olarak ortalama 10–15 dakika sürebilmektedir. Lütfen bu süre boyunca karşılama görevlimizin yönlendirmelerini takip edin.",
    ],
    sawMeetingPointValue:
      "Sabiha Gökçen Havalimanı’ndaki buluşma noktamız TÜRSAB buluşma binasıdır.",
    sawMeetingInstructions: [
      "Terminal binasından çıktıktan sonra yolun karşısına geçin ve sol tarafa dönün. Kısa bir mesafe ilerlediğinizde TÜRSAB buluşma binasını karşınızda göreceksiniz.",
      "Karşılama görevlimiz sizi bu noktada bekliyor olacaktır.",
    ],
    sawMeetingPhotoAlt: "Sabiha Gökçen Havalimanı TÜRSAB buluşma binası",
    sawMeetingVideoIntro:
      "Buluşma noktasına nasıl ulaşacağınızı adım adım gösteren kısa videoyu aşağıdaki bağlantıdan izleyebilirsiniz:",
    sawNoMeetPointValue:
      "Sabiha Gökçen Havalimanı’ndaki buluşma noktamız Simit Sarayı Café’nin önüdür.",
    sawNoMeetInstructions:
      "Terminalden çıktıktan sonra Simit Sarayı Café’yi hemen karşınızda göreceksiniz. Lütfen kafenin önüne gelin. Şoförünüz sizi bu noktadan alacaktır.",
    sawNoMeetPhotoAlt:
      "Sabiha Gökçen Havalimanı Simit Sarayı Café buluşma noktası",
    aytMeetingPointValue:
      "Antalya Havalimanı’ndaki buluşma noktamız Dış Hatlar Terminali çıkışındaki D kolonunda bulunan SS1 karşılama noktasıdır.",
    aytMeetingInstructions: [
      "Terminal binasından çıktıktan sonra hemen sola dönün ve kısa bir mesafe ilerleyin. Sol tarafınızda harflerle işaretlenmiş kolonları göreceksiniz. D harfi bulunan kolona ilerleyin. SS1 karşılama işaretimiz D kolonunda bulunmaktadır.",
      "Karşılama görevlimiz sizi bu noktada bekliyor olacaktır.",
    ],
    aytMeetingPhotoAlt:
      "Antalya Havalimanı D kolonu SS1 karşılama noktası",
    aytInternetClosing: "Sizi Antalya’da karşılamaktan memnuniyet duyarız.",
    aytDomesticNoteTitle: "Önemli not – İç Hatlar yolcuları için",
    aytDomesticNoteParagraphs: [
      "Uçuşunuz İç Hatlar Terminali’ne geliyorsa yukarıdaki D kolonu / SS1 buluşma noktası tarifini dikkate almayın.",
      "Bagajınız varsa bagajınızı teslim aldıktan sonra bizimle iletişime geçin. Şoförünüz sizi İç Hatlar Terminali çıkışından doğrudan alacaktır. Buluşma sırasında sizinle iletişim halinde olacağız.",
    ],
    noMeetPointValue: "-2 (eksi 2) ulaşım katındaki mor renkli B06 R kolonu.",
    noMeetInstructions:
      "İstanbul Havalimanı oldukça büyük bir alandır. Buluşma noktasına kolayca ulaşabilmeniz için lütfen aşağıdaki adımları dikkatlice takip edin.",
    noMeetContactTitle: "Buluşma noktasına gitmeden önce bizimle iletişime geçin",
    noMeetContactParagraphs: [
      "Buluşma noktası otopark alanı içinde yer almaktadır ve ücretsiz bekleme süresi sınırlıdır. Herhangi bir aksaklık yaşamamak için lütfen buluşma noktasına gitmeden önce bizimle iletişime geçin.",
      "Bagajınız varsa, lütfen bagajınızı teslim aldıktan hemen sonra bizimle iletişime geçin.",
      "Bagajınız yoksa, lütfen pasaport kontrolünden çıktıktan hemen sonra bizimle iletişime geçin.",
    ],
    noMeetSteps: [
      {
        title: "1. Adım",
        body: "9 numaralı kapıdan çıkın.",
        imageAlt: "9 numaralı çıkış kapısı",
      },
      {
        title: "2. Adım",
        body: "Asansörle -2 (eksi 2) ulaşım katına inin.",
        imageAlt: "-2 ulaşım katına inen asansör",
      },
      {
        title: "3. Adım",
        body: "Yolu geçerek otopark alanına girin.",
        imageAlt: "Otopark alanına giden yol",
      },
      {
        title: "4. Adım",
        body: "Mor renkli B06 R kolonu bulun.",
        imageAlt: "Mor renkli B06 R kolonu",
      },
    ],
    contactIntro: "Bize aşağıdaki kanallardan ulaşabilirsiniz:",
    contactPhoneLabel: "Telefon",
    contactWhatsappLabel: "WhatsApp",
    contactTelegramLabel: "Telegram",
    contactViberLabel: "Viber",
    contactTelegramHandle: "@Tripetica",
    internetSectionTitle: "İnternete nasıl bağlanabilirsiniz?",
    internetIntro:
      "Bizimle kolayca iletişime geçebilmek için aşağıdaki seçeneklerden birini kullanabilirsiniz:",
    internetParagraphs: [
      "Seyahatinizden önce eSIM satın alarak Türkiye’ye vardığınız anda internet erişimi sağlayabilirsiniz.",
      "Havalimanından yerel SIM kart satın alabilirsiniz.",
      "Havalimanı içerisindeki ücretsiz Wi-Fi hizmetini kullanabilirsiniz.",
      "Wi-Fi’ye bağlanamazsanız, havalimanındaki herhangi bir görevliye telefon numaramızı göstererek bizi aramasını rica edebilirsiniz.",
      "Herhangi bir sorunuz olursa bizimle dilediğiniz zaman iletişime geçebilirsiniz.",
      "Sizi İstanbul’da karşılamaktan memnuniyet duyarız.",
    ],
    closing: "İyi yolculuklar dileriz.",
    paymentConfirmationSubject: (code) => `Ödeme alındı — ${code}`,
    paymentConfirmationTitle: "Ödemeniz başarıyla alındı",
    paymentConfirmationBody: (code) =>
      `${code} numaralı rezervasyonunuza ait ödemeniz başarıyla alınmıştır.`,
    amountPaid: "Ödenen tutar",
    paymentConfirmationClosing:
      "Rezervasyonunuz için ayrıca bir işlem yapmanız gerekmemektedir.",
  },
  en: {
    confirmationSubject: (code) => `Reservation confirmation — ${code}`,
    greeting: (name) => (name ? `Hello ${name},` : "Hello,"),
    confirmationThanks: "Thank you for choosing Tripetica.",
    confirmationIntro:
      "Your reservation has been created successfully. Your reservation document (voucher PDF) is attached to this email.",
    reservationCode: "Reservation code",
    transferDateTime: "Date and time",
    serviceType: "Service type",
    duration: "Duration",
    vehicleClass: "Vehicle class",
    pickup: "Pickup",
    dropoff: "Drop-off",
    total: "Total",
    paymentMethod: "Payment method",
    paymentStatus: "Payment status",
    meetingSectionTitle: "Meeting point",
    meetingPointLabel: "Meeting point",
    meetingPointValue:
      "The area with the BYRIDES sign immediately to the left of Exit Gate 13",
    meetingInstructions:
      "After exiting through Gate 13 at Istanbul Airport, follow the BYRIDES sign on your immediate left to the meeting area. Our meet-and-greet representative will meet you there.",
    meetingPhotoAlt: "Istanbul Airport meeting point",
    meetingVideoIntro:
      "You can watch the short video to find the meeting area more easily.",
    meetingVideoCta: "Watch meeting video",
    meetingImportantTitle: "Important information",
    meetingImportantParagraphs: [
      "After you meet our meet-and-greet representative, they will contact your driver. Your driver will bring the vehicle to the parking area, and our representative will guide you to the vehicle.",
      "Depending on airport and parking congestion, this process typically takes about 10–15 minutes on average. Please follow your meet-and-greet representative's directions during this time.",
    ],
    sawMeetingPointValue:
      "Our meeting point at Sabiha Gökçen Airport is the TÜRSAB meeting building.",
    sawMeetingInstructions: [
      "After exiting the terminal building, cross the road and turn left. Continue for a short distance, and you will see the TÜRSAB meeting building ahead of you.",
      "Our meet-and-greet representative will be waiting for you there.",
    ],
    sawMeetingPhotoAlt: "TÜRSAB meeting building at Sabiha Gökçen Airport",
    sawMeetingVideoIntro:
      "You can watch the short video below for step-by-step directions to the meeting point:",
    sawNoMeetPointValue:
      "Our meeting point at Sabiha Gökçen Airport is in front of Simit Sarayı Café.",
    sawNoMeetInstructions:
      "After exiting the terminal, you will see Simit Sarayı Café directly ahead of you. Please make your way to the front of the café. Your driver will pick you up from this point.",
    sawNoMeetPhotoAlt:
      "Simit Sarayı Café meeting point at Sabiha Gökçen Airport",
    aytMeetingPointValue:
      "Our meeting point at Antalya Airport is the SS1 welcome point at column D outside the International Terminal.",
    aytMeetingInstructions: [
      "After exiting the terminal building, turn immediately left and continue for a short distance. You will see lettered columns on your left. Proceed to column D, where you will find our SS1 welcome sign.",
      "Our meet-and-greet representative will be waiting for you at this point.",
    ],
    aytMeetingPhotoAlt:
      "SS1 welcome point at column D at Antalya Airport",
    aytInternetClosing: "We look forward to welcoming you in Antalya.",
    aytDomesticNoteTitle: "Important note for Domestic Terminal passengers",
    aytDomesticNoteParagraphs: [
      "If your flight arrives at the Domestic Terminal, please disregard the directions above to the column D / SS1 meeting point.",
      "If you have luggage, contact us after collecting it. Your driver will pick you up directly from the Domestic Terminal exit, and we will remain in contact with you during the meeting process.",
    ],
    noMeetPointValue:
      "The purple B06 R column on transportation level -2 (minus 2).",
    noMeetInstructions:
      "Istanbul Airport covers a very large area. Please follow the steps below carefully so you can reach the meeting point easily.",
    noMeetContactTitle: "Contact us before going to the meeting point",
    noMeetContactParagraphs: [
      "The meeting point is located inside the parking area, and the free waiting time is limited. To avoid any issues, please contact us before going to the meeting point.",
      "If you have luggage, please contact us immediately after collecting it.",
      "If you do not have luggage, please contact us immediately after leaving passport control.",
    ],
    noMeetSteps: [
      {
        title: "Step 1",
        body: "Exit through Gate 9.",
        imageAlt: "Exit Gate 9",
      },
      {
        title: "Step 2",
        body: "Take the elevator down to transportation level -2 (minus 2).",
        imageAlt: "Elevator to transportation level -2",
      },
      {
        title: "Step 3",
        body: "Cross the road and enter the parking area.",
        imageAlt: "Route into the parking area",
      },
      {
        title: "Step 4",
        body: "Find the purple B06 R column.",
        imageAlt: "Purple B06 R column",
      },
    ],
    contactIntro: "You can reach us through the following channels:",
    contactPhoneLabel: "Phone",
    contactWhatsappLabel: "WhatsApp",
    contactTelegramLabel: "Telegram",
    contactViberLabel: "Viber",
    contactTelegramHandle: "@Tripetica",
    internetSectionTitle: "How can you connect to the internet?",
    internetIntro:
      "To contact us easily, you can use one of the following options:",
    internetParagraphs: [
      "Purchase an eSIM before your trip so you have internet access as soon as you arrive in Türkiye.",
      "Buy a local SIM card at the airport.",
      "Use the free Wi-Fi service inside the airport.",
      "If you cannot connect to Wi-Fi, you may ask any airport staff member to call us after showing them our phone number.",
      "If you have any questions, feel free to contact us at any time.",
      "We look forward to welcoming you in Istanbul.",
    ],
    closing: "Have a pleasant journey.",
    paymentConfirmationSubject: (code) => `Payment received — ${code}`,
    paymentConfirmationTitle: "Your payment was received successfully",
    paymentConfirmationBody: (code) =>
      `The payment for reservation ${code} has been received successfully.`,
    amountPaid: "Amount paid",
    paymentConfirmationClosing: "No further action is required for your reservation.",
  },
  ru: {
    confirmationSubject: (code) => `Подтверждение бронирования — ${code}`,
    greeting: (name) => (name ? `Здравствуйте, ${name}!` : "Здравствуйте!"),
    confirmationThanks: "Благодарим вас за выбор Tripetica.",
    confirmationIntro:
      "Ваше бронирование успешно создано. Документ бронирования (voucher PDF) находится во вложении к этому письму.",
    reservationCode: "Код бронирования",
    transferDateTime: "Дата и время",
    serviceType: "Тип услуги",
    duration: "Продолжительность",
    vehicleClass: "Класс автомобиля",
    pickup: "Место подачи",
    dropoff: "Место высадки",
    total: "Итого",
    paymentMethod: "Способ оплаты",
    paymentStatus: "Статус оплаты",
    meetingSectionTitle: "Место встречи",
    meetingPointLabel: "Место встречи",
    meetingPointValue:
      "Зона с указателем BYRIDES сразу слева от выхода №13",
    meetingInstructions:
      "После выхода через выход №13 в аэропорту Стамбула пройдите сразу налево к указателю BYRIDES. Вас встретит наш представитель службы встречи.",
    meetingPhotoAlt: "Место встречи в аэропорту Стамбула",
    meetingVideoIntro:
      "Короткое видео поможет быстрее найти место встречи.",
    meetingVideoCta: "Смотреть видео о встрече",
    meetingImportantTitle: "Важная информация",
    meetingImportantParagraphs: [
      "После встречи с нашим представителем службы встречи он свяжется с вашим водителем. Водитель подъедет на автомобиле к парковке, а представитель проводит вас к машине.",
      "В зависимости от загруженности аэропорта и парковки этот процесс обычно занимает в среднем 10–15 минут. Пожалуйста, следуйте указаниям представителя службы встречи в течение этого времени.",
    ],
    sawMeetingPointValue:
      "Наше место встречи в аэропорту Сабиха Гёкчен находится у здания встречи TÜRSAB.",
    sawMeetingInstructions: [
      "Выйдя из здания терминала, перейдите дорогу и поверните налево. Пройдите немного вперёд, и перед собой вы увидите здание встречи TÜRSAB.",
      "Наш представитель службы встречи будет ждать вас в этой точке.",
    ],
    sawMeetingPhotoAlt:
      "Здание встречи TÜRSAB в аэропорту Сабиха Гёкчен",
    sawMeetingVideoIntro:
      "По ссылке ниже вы можете посмотреть короткое видео с пошаговым маршрутом до места встречи:",
    sawNoMeetPointValue:
      "Наше место встречи в аэропорту Сабиха Гёкчен находится перед кафе Simit Sarayı.",
    sawNoMeetInstructions:
      "Выйдя из терминала, вы сразу увидите перед собой кафе Simit Sarayı. Подойдите, пожалуйста, ко входу в кафе. Водитель заберёт вас в этой точке.",
    sawNoMeetPhotoAlt:
      "Место встречи у кафе Simit Sarayı в аэропорту Сабиха Гёкчен",
    aytMeetingPointValue:
      "Наше место встречи в аэропорту Антальи — пункт встречи SS1 у колонны D на выходе из Международного терминала.",
    aytMeetingInstructions: [
      "Выйдя из здания терминала, сразу поверните налево и пройдите небольшое расстояние. Слева вы увидите колонны, обозначенные буквами. Направляйтесь к колонне D — там находится наш указатель SS1.",
      "Наш представитель службы встречи будет ждать вас в этой точке.",
    ],
    aytMeetingPhotoAlt:
      "Пункт встречи SS1 у колонны D в аэропорту Антальи",
    aytInternetClosing: "Будем рады встретить вас в Анталье.",
    aytDomesticNoteTitle:
      "Важное примечание для пассажиров внутренних рейсов",
    aytDomesticNoteParagraphs: [
      "Если ваш рейс прибывает во Внутренний терминал, не следуйте приведённым выше указаниям к колонне D / пункту SS1.",
      "Если у вас есть багаж, свяжитесь с нами после его получения. Водитель встретит вас непосредственно у выхода из Внутреннего терминала, а во время встречи мы будем оставаться с вами на связи.",
    ],
    noMeetPointValue:
      "Фиолетовая колонна B06 R на транспортном уровне -2 (минус 2).",
    noMeetInstructions:
      "Аэропорт Стамбула занимает очень большую территорию. Чтобы легко добраться до места встречи, внимательно следуйте приведённым ниже инструкциям.",
    noMeetContactTitle: "Свяжитесь с нами перед тем, как идти к месту встречи",
    noMeetContactParagraphs: [
      "Место встречи находится внутри парковки, а бесплатное время ожидания ограничено. Чтобы избежать затруднений, свяжитесь с нами перед тем, как идти к месту встречи.",
      "Если у вас есть багаж, свяжитесь с нами сразу после его получения.",
      "Если у вас нет багажа, свяжитесь с нами сразу после прохождения паспортного контроля.",
    ],
    noMeetSteps: [
      {
        title: "Шаг 1",
        body: "Выйдите через выход №9.",
        imageAlt: "Выход №9",
      },
      {
        title: "Шаг 2",
        body: "Спуститесь на лифте на транспортный уровень -2 (минус 2).",
        imageAlt: "Лифт на транспортный уровень -2",
      },
      {
        title: "Шаг 3",
        body: "Перейдите дорогу и войдите на парковку.",
        imageAlt: "Путь на парковку",
      },
      {
        title: "Шаг 4",
        body: "Найдите фиолетовую колонну B06 R.",
        imageAlt: "Фиолетовая колонна B06 R",
      },
    ],
    contactIntro: "Вы можете связаться с нами по следующим каналам:",
    contactPhoneLabel: "Телефон",
    contactWhatsappLabel: "WhatsApp",
    contactTelegramLabel: "Telegram",
    contactViberLabel: "Viber",
    contactTelegramHandle: "@Tripetica",
    internetSectionTitle: "Как подключиться к интернету?",
    internetIntro:
      "Чтобы легко связаться с нами, вы можете воспользоваться одним из следующих вариантов:",
    internetParagraphs: [
      "Купите eSIM до поездки, чтобы получить доступ в интернет сразу по прибытии в Турцию.",
      "Приобретите местную SIM-карту в аэропорту.",
      "Воспользуйтесь бесплатным Wi-Fi в аэропорту.",
      "Если не удаётся подключиться к Wi-Fi, попросите любого сотрудника аэропорта позвонить нам, показав наш номер телефона.",
      "Если у вас возникнут вопросы, свяжитесь с нами в любое время.",
      "Мы будем рады встретить вас в Стамбуле.",
    ],
    closing: "Желаем приятной поездки.",
    paymentConfirmationSubject: (code) => `Оплата получена — ${code}`,
    paymentConfirmationTitle: "Ваша оплата успешно получена",
    paymentConfirmationBody: (code) =>
      `Оплата по бронированию ${code} успешно получена.`,
    amountPaid: "Сумма оплаты",
    paymentConfirmationClosing:
      "Дополнительных действий по вашему бронированию не требуется.",
  },
};
