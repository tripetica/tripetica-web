import Image from "next/image";
import { BookTransferLink } from "@/components/booking/book-transfer-link";
import { SiteHeader } from "@/components/site-header";
import { type Locale } from "@/lib/i18n/config";
import { type TourId } from "@/lib/booking/types";
import { servicePath } from "@/lib/services/catalog";
import { istanbulCityTourCopy } from "@/lib/services/istanbul-city-tour-copy";

const HERO_IMAGE = "/istanbul-city-tour-private-car.jpg";

type IstanbulCityTourPageProps = {
  locale: Locale;
};

export function IstanbulCityTourPage({ locale }: IstanbulCityTourPageProps) {
  const copy = istanbulCityTourCopy[locale];

  const bookLink = (tourId: TourId, className: string, label: string) => (
    <BookTransferLink
      locale={locale}
      service="tour"
      tourId={tourId}
      className={className}
    >
      {label}
    </BookTransferLink>
  );

  return (
    <main className="service-page light-theme-page">
      <SiteHeader
        locale={locale}
        pathWithoutLocale={servicePath("istanbul-city-tour")}
        variant="service"
      />
      <section className="service-hero">
        <Image
          src={HERO_IMAGE}
          alt={copy.heroAlt}
          fill
          priority
          sizes="100vw"
          className="service-hero-image service-hero-image--city-tour"
        />
        <div className="service-hero-shade" aria-hidden="true" />
        <div className="service-hero-copy">
          <p className="service-kicker">{copy.kicker}</p>
          <h1 className="service-h1">{copy.h1}</h1>
          <p className="service-hero-lead">{copy.heroLead}</p>
          <ul className="service-option-grid">
            <li className="service-card service-option-card">
              <p className="service-h3">{copy.halfDayHeroTitle}</p>
              {bookLink("istanbul-half-day", "service-cta", copy.bookCta)}
            </li>
            <li className="service-card service-option-card">
              <p className="service-h3">{copy.fullDayHeroTitle}</p>
              {bookLink("istanbul-full-day", "service-cta", copy.bookCta)}
            </li>
          </ul>
        </div>
      </section>

      <div className="service-body">
        <section className="service-block" aria-labelledby="city-tour-half-heading">
          <h2 id="city-tour-half-heading" className="service-h2">
            {copy.halfDayTitle}
          </h2>
          {copy.halfDay.map((paragraph) => (
            <p key={paragraph.slice(0, 48)} className="service-prose">
              {paragraph}
            </p>
          ))}
        </section>

        <section className="service-block" aria-labelledby="city-tour-full-heading">
          <h2 id="city-tour-full-heading" className="service-h2">
            {copy.fullDayTitle}
          </h2>
          {copy.fullDay.map((paragraph) => (
            <p key={paragraph.slice(0, 48)} className="service-prose">
              {paragraph}
            </p>
          ))}
        </section>

        <section className="service-block" aria-labelledby="city-tour-guide-heading">
          <h2 id="city-tour-guide-heading" className="service-h2">
            {copy.guideTitle}
          </h2>
          <ul className="service-option-grid">
            <li className="service-card">
              <h3 className="service-h3">{copy.guidedTitle}</h3>
              <p className="service-prose">{copy.guided}</p>
            </li>
            <li className="service-card">
              <h3 className="service-h3">{copy.independentTitle}</h3>
              <p className="service-prose">{copy.independent}</p>
            </li>
          </ul>
        </section>

        <section
          className="service-block"
          aria-labelledby="city-tour-program-heading"
        >
          <h2 id="city-tour-program-heading" className="service-h2">
            {copy.programTitle}
          </h2>
          {copy.program.map((paragraph) => (
            <p key={paragraph.slice(0, 48)} className="service-prose">
              {paragraph}
            </p>
          ))}
        </section>

        <section className="service-block" aria-labelledby="city-tour-places-heading">
          <h2 id="city-tour-places-heading" className="service-h2">
            {copy.placesTitle}
          </h2>
          <ul className="service-why-grid">
            {copy.places.map((item) => (
              <li key={item.title} className="service-card">
                <h3 className="service-h3">{item.title}</h3>
                <p className="service-prose">{item.text}</p>
              </li>
            ))}
          </ul>
        </section>

        <section className="service-block" aria-labelledby="city-tour-dining-heading">
          <h2 id="city-tour-dining-heading" className="service-h2">
            {copy.diningTitle}
          </h2>
          {copy.dining.map((paragraph) => (
            <p key={paragraph.slice(0, 48)} className="service-prose">
              {paragraph}
            </p>
          ))}
        </section>

        <section className="service-block" aria-labelledby="city-tour-extras-heading">
          <h2 id="city-tour-extras-heading" className="service-h2">
            {copy.extrasTitle}
          </h2>
          <p className="service-prose">{copy.extrasLead}</p>
          <ul className="service-why-grid">
            {copy.extras.map((item) => (
              <li key={item.title} className="service-card">
                <h3 className="service-h3">{item.title}</h3>
                <p className="service-prose">{item.text}</p>
              </li>
            ))}
          </ul>
          <p className="service-prose">{copy.extrasNote}</p>
        </section>

        <section className="service-block" aria-labelledby="city-tour-how-heading">
          <h2 id="city-tour-how-heading" className="service-h2">
            {copy.howTitle}
          </h2>
          <ol className="service-how-list">
            {copy.how.map((step, index) => (
              <li key={step.title} className="service-card service-how-item is-detailed">
                <span className="service-how-num" aria-hidden="true">
                  {index + 1}
                </span>
                <div>
                  <h3 className="service-h3">{step.title}</h3>
                  <p className="service-prose">{step.text}</p>
                </div>
              </li>
            ))}
          </ol>
        </section>

        <section className="service-final" aria-labelledby="city-tour-final-heading">
          <h2 id="city-tour-final-heading" className="service-h2">
            {copy.finalTitle}
          </h2>
          <p className="service-prose">{copy.finalLead}</p>
          <div className="service-cta-row">
            {bookLink("istanbul-half-day", "service-cta", copy.bookHalfDayCta)}
            {bookLink("istanbul-full-day", "service-cta", copy.bookFullDayCta)}
          </div>
        </section>
      </div>
    </main>
  );
}
