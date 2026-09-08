import { type Locale } from "@/lib/i18n/config";

export const GOOGLE_REVIEW_URL = "https://g.page/r/CT_m3nlJQVrEEBM/review";
export const YANDEX_REVIEW_URL =
  "https://yandex.com.tr/navi/org/tripetica/180632713670?si=n6tudvzvhnxkpu6krzug7z14y0";

export const REVIEW_LOGO_MOBILE_SRC = "/Tripetica yuvarlak logo.jpeg";
export const REVIEW_LOGO_DESKTOP_SRC = "/tripetica logo yatay.png";

export type ReviewPageCopy = {
  title: string;
  description: string;
  sectionTitle: string;
  googleButton: string;
  googleSupporting: string;
  yandexButton: string;
  yandexSupporting: string;
  footer: string;
};

export const reviewPageCopy: Record<Locale, ReviewPageCopy> = {
  tr: {
    title: "Yolculuğunuz nasıldı?",
    description:
      "Tripetica’yı tercih ettiğiniz için teşekkür ederiz. Deneyiminizi paylaşmanız hem bizim için hem de bizi tercih edecek diğer yolcular için çok değerli.",
    sectionTitle: "Yorumunuzu nerede paylaşmak istersiniz?",
    googleButton: "Google’da yorum yap",
    googleSupporting: "Yorumunuzu Google’da paylaşın",
    yandexButton: "Yandex’te yorum yap",
    yandexSupporting: "Yorumunuzu Yandex’te paylaşın",
    footer:
      "Teşekkür ederiz. Güzel yolculuklarda yeniden görüşmek dileğiyle.",
  },
  en: {
    title: "How was your journey?",
    description:
      "Thank you for choosing Tripetica. Sharing your experience is very valuable to us and to other travelers considering Tripetica.",
    sectionTitle: "Where would you like to share your review?",
    googleButton: "Leave a review on Google",
    googleSupporting: "Share your experience on Google",
    yandexButton: "Leave a review on Yandex",
    yandexSupporting: "Share your experience on Yandex",
    footer:
      "Thank you. We look forward to welcoming you again on your future journeys.",
  },
  ru: {
    title: "Как прошла ваша поездка?",
    description:
      "Спасибо, что выбрали Tripetica. Ваш отзыв очень важен для нас и поможет другим путешественникам при выборе Tripetica.",
    sectionTitle: "Где вы хотели бы оставить отзыв?",
    googleButton: "Оставить отзыв в Google",
    googleSupporting: "Поделитесь впечатлениями в Google",
    yandexButton: "Оставить отзыв на Яндексе",
    yandexSupporting: "Поделитесь впечатлениями на Яндексе",
    footer: "Спасибо! Будем рады снова видеть вас среди наших пассажиров.",
  },
};
