import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { locales } from "@/lib/i18n/config";
import {
  GOOGLE_REVIEW_URL,
  REVIEW_LOGO_DESKTOP_SRC,
  REVIEW_LOGO_MOBILE_SRC,
  YANDEX_REVIEW_URL,
  reviewPageCopy,
} from "@/lib/view/copy";

function source(path: string) {
  return readFileSync(new URL(`../../${path}`, import.meta.url), "utf8");
}

test("review page copy matches the requested locale texts", () => {
  assert.deepEqual(reviewPageCopy.tr, {
    title: "Yolculuğunuz nasıldı?",
    description:
      "Tripetica’yı tercih ettiğiniz için teşekkür ederiz. Deneyiminizi paylaşmanız hem bizim için hem de bizi tercih edecek diğer yolcular için çok değerli.",
    sectionTitle: "Yorumunuzu nerede paylaşmak istersiniz?",
    googleButton: "Google’da yorum yap",
    googleSupporting: "Yorumunuzu Google’da paylaşın",
    yandexButton: "Yandex’te yorum yap",
    yandexSupporting: "Yorumunuzu Yandex’te paylaşın",
    footer: "Teşekkür ederiz. Güzel yolculuklarda yeniden görüşmek dileğiyle.",
  });
  assert.deepEqual(reviewPageCopy.en, {
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
  });
  assert.deepEqual(reviewPageCopy.ru, {
    title: "Как прошла ваша поездка?",
    description:
      "Спасибо, что выбрали Tripetica. Ваш отзыв очень важен для нас и поможет другим путешественникам при выборе Tripetica.",
    sectionTitle: "Где вы хотели бы оставить отзыв?",
    googleButton: "Оставить отзыв в Google",
    googleSupporting: "Поделитесь впечатлениями в Google",
    yandexButton: "Оставить отзыв на Яндексе",
    yandexSupporting: "Поделитесь впечатлениями на Яндексе",
    footer: "Спасибо! Будем рады снова видеть вас среди наших пассажиров.",
  });
  assert.deepEqual(reviewPageCopy.ar, {
    title: "كيف كانت رحلتك؟",
    description:
      "شكرًا لكم على اختيار Tripetica. مشاركة تجربتكم مهمة لنا وللمسافرين الآخرين الذين يفكرون في اختيار Tripetica.",
    sectionTitle: "أين تودّ مشاركة تقييمك؟",
    googleButton: "اترك تقييمًا على Google",
    googleSupporting: "شارك تجربتك على Google",
    yandexButton: "اترك تقييمًا على Yandex",
    yandexSupporting: "شارك تجربتك على Yandex",
    footer: "شكرًا لكم. نتطلع إلى استقبالكم مجددًا في رحلاتكم القادمة.",
  });
  assert.deepEqual(locales.slice().sort(), ["ar", "en", "ru", "tr"]);
});

test("review page opens the requested Google and Yandex destinations", () => {
  assert.equal(GOOGLE_REVIEW_URL, "https://g.page/r/CT_m3nlJQVrEEBM/review");
  assert.equal(
    YANDEX_REVIEW_URL,
    "https://yandex.com.tr/navi/org/tripetica/180632713670?si=n6tudvzvhnxkpu6krzug7z14y0",
  );
  const page = source("components/view/review-redirect-page.tsx");
  assert.match(page, /GOOGLE_REVIEW_URL/);
  assert.match(page, /YANDEX_REVIEW_URL/);
  assert.match(page, /target="_blank"/);
  assert.match(page, /rel="noopener noreferrer"/);
});

test("review page uses the existing public logo files", () => {
  assert.equal(REVIEW_LOGO_MOBILE_SRC, "/Tripetica yuvarlak logo.jpeg");
  assert.equal(REVIEW_LOGO_DESKTOP_SRC, "/tripetica logo yatay.png");
  const page = source("components/view/review-redirect-page.tsx");
  assert.match(page, /REVIEW_LOGO_MOBILE_SRC/);
  assert.match(page, /REVIEW_LOGO_DESKTOP_SRC/);
});
