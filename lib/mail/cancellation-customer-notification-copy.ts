import { type Locale } from "@/lib/i18n/config";
import { assignmentCustomerNotificationCopy } from "@/lib/mail/assignment-customer-notification-copy";

export type CancellationCustomerNotificationCopy = {
  greetingNamed: (name: string) => string;
  intro: string;
  summaryTitle: string;
  help: string;
  subject: (reservationCode: string) => string;
};

export const cancellationCustomerNotificationCopy: Record<
  Locale,
  CancellationCustomerNotificationCopy
> = {
  tr: {
    greetingNamed: (name) => `Sayın ${name},`,
    intro: "Aşağıda bilgileri bulunan rezervasyonunuz iptal edilmiştir.",
    summaryTitle: "Rezervasyon Bilgileri",
    help: "Yeni bir rezervasyon konusunda desteğe ihtiyaç duymanız halinde, aşağıdaki iletişim kanallarımızdan bizimle 7/24 iletişime geçebilirsiniz.",
    subject: (reservationCode) =>
      `Rezervasyonunuz İptal Edildi – ${reservationCode}`,
  },
  en: {
    greetingNamed: (name) => `Dear ${name},`,
    intro: "The reservation summarised below has been cancelled.",
    summaryTitle: "Reservation details",
    help: "If you need assistance with a new reservation, you can reach us 24/7 through the contact channels below.",
    subject: (reservationCode) =>
      `Your reservation has been cancelled – ${reservationCode}`,
  },
  ru: {
    greetingNamed: (name) => `Уважаемый(ая) ${name}!`,
    intro: "Бронирование, сведения о котором приведены ниже, отменено.",
    summaryTitle: "Данные бронирования",
    help: "Если вам нужна помощь с новым бронированием, вы можете связаться с нами круглосуточно по указанным ниже каналам.",
    subject: (reservationCode) =>
      `Ваше бронирование отменено – ${reservationCode}`,
  },
  ar: {
    greetingNamed: (name) => `عزيزنا ${name}،`,
    intro: "تم إلغاء الحجز المبيّنة بياناته أدناه.",
    summaryTitle: "بيانات الحجز",
    help: "إذا احتجتم إلى مساعدة لحجز جديد، يمكنكم التواصل معنا على مدار الساعة عبر قنوات الاتصال أدناه.",
    subject: (reservationCode) => `تم إلغاء حجزكم – ${reservationCode}`,
  },
};

export function cancellationCustomerNotificationGreeting(
  locale: Locale,
  name: string | null | undefined,
) {
  const trimmed = name?.trim() ?? "";
  if (trimmed) {
    return cancellationCustomerNotificationCopy[locale].greetingNamed(trimmed);
  }
  return assignmentCustomerNotificationCopy[locale].greeting;
}
