import Image from "next/image";
import { type Locale } from "@/lib/i18n/config";
import {
  GOOGLE_REVIEW_URL,
  REVIEW_LOGO_DESKTOP_SRC,
  REVIEW_LOGO_MOBILE_SRC,
  YANDEX_REVIEW_URL,
  reviewPageCopy,
} from "@/lib/view/copy";

type ReviewRedirectPageProps = {
  locale: Locale;
};

function ReviewChoice({
  href,
  platform,
  button,
  supporting,
  mark,
  markClassName,
}: {
  href: string;
  platform: string;
  button: string;
  supporting: string;
  mark: string;
  markClassName: string;
}) {
  return (
    <a
      className="review-page-choice"
      href={href}
      target="_blank"
      rel="noopener noreferrer"
    >
      <span className={`review-page-choice-mark ${markClassName}`} aria-hidden="true">
        {mark}
      </span>
      <span className="review-page-choice-platform">{platform}</span>
      <span className="review-page-choice-cta">{button}</span>
      <span className="review-page-choice-hint">{supporting}</span>
    </a>
  );
}

export function ReviewRedirectPage({ locale }: ReviewRedirectPageProps) {
  const copy = reviewPageCopy[locale];

  return (
    <main className="review-page light-theme-page">
      <div className="review-page-inner">
        <div className="review-page-brand">
          <div className="review-page-logo-mobile-wrap">
            <Image
              className="review-page-logo-mobile"
              src={REVIEW_LOGO_MOBILE_SRC}
              alt="Tripetica"
              width={1254}
              height={1254}
              sizes="104px"
              priority
              unoptimized
            />
          </div>
          <div className="review-page-logo-desktop-wrap">
            <Image
              className="review-page-logo-desktop"
              src={REVIEW_LOGO_DESKTOP_SRC}
              alt="Tripetica"
              width={1059}
              height={345}
              sizes="260px"
              priority
              unoptimized
            />
          </div>
        </div>

        <h1 className="review-page-title">{copy.title}</h1>
        <p className="review-page-lead">{copy.description}</p>
        <h2 className="review-page-section">{copy.sectionTitle}</h2>

        <div className="review-page-choices">
          <ReviewChoice
            href={GOOGLE_REVIEW_URL}
            platform="Google"
            button={copy.googleButton}
            supporting={copy.googleSupporting}
            mark="G"
            markClassName="review-page-choice-mark-google"
          />
          <ReviewChoice
            href={YANDEX_REVIEW_URL}
            platform="Yandex"
            button={copy.yandexButton}
            supporting={copy.yandexSupporting}
            mark="Я"
            markClassName="review-page-choice-mark-yandex"
          />
        </div>

        <p className="review-page-thanks">{copy.footer}</p>
      </div>
    </main>
  );
}
