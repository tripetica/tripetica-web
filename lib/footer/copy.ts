import { type Locale } from "@/lib/i18n/config";

export type FooterCopy = {
  brandLead: string;
  assurance: string;
  contactTitle: string;
  legalTitle: string;
  phone: string;
  whatsapp: string;
  telegram: string;
  viber: string;
  email: string;
  phoneAria: string;
  whatsappAria: string;
  telegramAria: string;
  viberAria: string;
  emailAria: string;
  copyright: string;
  tursab: string;
  d2: string;
};

export const footerCopy: Record<Locale, FooterCopy> = {
  tr: {
    brandLead:
      "İstanbul, Antalya ve Türkiye genelinde havalimanı transferi, özel transfer, şoförlü araç ve kişiye özel tur hizmetleri.",
    assurance: "Search Travel güvencesiyle",
    contactTitle: "İletişim",
    legalTitle: "Yasal Bilgilendirme",
    phone: "Telefon",
    whatsapp: "WhatsApp",
    telegram: "Telegram",
    viber: "Viber",
    email: "E-posta",
    phoneAria: "Tripetica’yı ara",
    whatsappAria: "WhatsApp ile yaz",
    telegramAria: "Telegram’da Tripetica’yı aç",
    viberAria: "Viber ile yaz",
    emailAria: "E-posta gönder",
    copyright: "© 2018–2026 Tripetica. Tüm hakları saklıdır.",
    tursab: "TÜRSAB Belge No: 8977",
    d2: "D2 Yetki Belgesi No: İST.U-NET.D2.34.3694",
  },
  en: {
    brandLead:
      "Airport transfers, private transfers, chauffeur service and personalised private tours in Istanbul, Antalya and across Türkiye.",
    assurance: "Backed by Search Travel",
    contactTitle: "Contact",
    legalTitle: "Legal Information",
    phone: "Phone",
    whatsapp: "WhatsApp",
    telegram: "Telegram",
    viber: "Viber",
    email: "Email",
    phoneAria: "Call Tripetica",
    whatsappAria: "Message on WhatsApp",
    telegramAria: "Open Tripetica on Telegram",
    viberAria: "Message on Viber",
    emailAria: "Send an email",
    copyright: "© 2018–2026 Tripetica. All rights reserved.",
    tursab: "TÜRSAB Licence No: 8977",
    d2: "D2 Authorisation No: İST.U-NET.D2.34.3694",
  },
  ru: {
    brandLead:
      "Трансферы из аэропорта, частные трансферы, автомобиль с водителем и индивидуальные туры в Стамбуле, Анталье и по всей Турции.",
    assurance: "При поддержке Search Travel",
    contactTitle: "Контакты",
    legalTitle: "Правовая информация",
    phone: "Телефон",
    whatsapp: "WhatsApp",
    telegram: "Telegram",
    viber: "Viber",
    email: "Эл. почта",
    phoneAria: "Позвонить в Tripetica",
    whatsappAria: "Написать в WhatsApp",
    telegramAria: "Открыть Tripetica в Telegram",
    viberAria: "Написать в Viber",
    emailAria: "Отправить письмо",
    copyright: "© 2018–2026 Tripetica. Все права защищены.",
    tursab: "Номер свидетельства TÜRSAB: 8977",
    d2: "Номер разрешения D2: İST.U-NET.D2.34.3694",
  },
  ar: {
    brandLead:
      "خدمات نقل المطار، والنقل الخاص، والمركبة مع سائق، والجولات الخاصة في إسطنبول وأنطاليا وفي أنحاء Türkiye.",
    assurance: "بدعم من Search Travel",
    contactTitle: "تواصل معنا",
    legalTitle: "المعلومات القانونية",
    phone: "الهاتف",
    whatsapp: "WhatsApp",
    telegram: "Telegram",
    viber: "Viber",
    email: "البريد الإلكتروني",
    phoneAria: "اتصل بـ Tripetica",
    whatsappAria: "مراسلة عبر WhatsApp",
    telegramAria: "فتح Tripetica على Telegram",
    viberAria: "مراسلة عبر Viber",
    emailAria: "إرسال رسالة بريد إلكتروني",
    copyright: "© 2018–2026 Tripetica. جميع الحقوق محفوظة.",
    tursab: "رقم ترخيص TÜRSAB: 8977",
    d2: "رقم تفويض D2: İST.U-NET.D2.34.3694",
  },
};
