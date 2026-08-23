import Image from "next/image";
import { BookTransferLink } from "@/components/booking/book-transfer-link";
import { SiteHeader } from "@/components/site-header";
import { type Locale } from "@/lib/i18n/config";
import { servicePath } from "@/lib/services/catalog";
import { istanbulLayoverCopy } from "@/lib/services/istanbul-layover-copy";

const HERO_IMAGE = "/3 Layover(transit) Tour.png";

type IstanbulLayoverPageProps = {
  locale: Locale;
};

export function IstanbulLayoverPage({ locale }: IstanbulLayoverPageProps) {
  const copy = istanbulLayoverCopy[locale];
  const bookLink = (className: string, label: string) => (
    <BookTransferLink
      locale={locale}
      service="tour"
      tourId="istanbul-layover"
      pickupAirport="IST"
      className={className}
    >
      {label}
    </BookTransferLink>
  );

  return (
    <main className="service-page">
      <section className="service-hero">
        <Image
          src={HERO_IMAGE}
          alt={copy.heroAlt}
          fill
          priority
          sizes="100vw"
          className="service-hero-image service-hero-image--layover"
        />
        <div className="service-hero-shade" aria-hidden="true" />
        <SiteHeader
          locale={locale}
          pathWithoutLocale={servicePath("istanbul-layover-tour")}
          variant="service"
        />
        <div className="service-hero-copy">
          <p className="service-kicker">{copy.kicker}</p>
          <h1 className="service-h1">{copy.h1}</h1>
          <p className="service-hero-lead">{copy.heroLead}</p>
          {bookLink("service-cta", copy.bookCta)}
        </div>
      </section>

      <div className="service-body">
        <section className="service-block" aria-labelledby="layover-how-heading">
          <h2 id="layover-how-heading" className="service-h2">
            {copy.howTitle}
          </h2>
          <p className="service-prose">{copy.howLead}</p>
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

        <section className="service-block" aria-labelledby="layover-places-heading">
          <h2 id="layover-places-heading" className="service-h2">
            {copy.placesTitle}
          </h2>
          <p className="service-prose">{copy.placesLead}</p>
          <ul className="service-why-grid">
            {copy.places.map((item) => (
              <li key={item.title} className="service-card">
                <h3 className="service-h3">{item.title}</h3>
                <p className="service-prose">{item.text}</p>
              </li>
            ))}
          </ul>
          <p className="service-prose">{copy.placesNote}</p>
        </section>

        <section className="service-block" aria-labelledby="layover-boat-heading">
          <h2 id="layover-boat-heading" className="service-h2">
            {copy.boatTitle}
          </h2>
          {copy.boat.map((paragraph) => (
            <p key={paragraph.slice(0, 40)} className="service-prose">
              {paragraph}
            </p>
          ))}
        </section>

        <section className="service-block" aria-labelledby="layover-guide-heading">
          <h2 id="layover-guide-heading" className="service-h2">
            {copy.guideTitle}
          </h2>
          <ul className="service-scope-grid">
            {copy.guide.map((item) => (
              <li key={item.title} className="service-card">
                <h3 className="service-h3">{item.title}</h3>
                <p className="service-prose">{item.text}</p>
              </li>
            ))}
          </ul>
        </section>

        <section className="service-block" aria-labelledby="layover-duration-heading">
          <h2 id="layover-duration-heading" className="service-h2">
            {copy.durationTitle}
          </h2>
          {copy.duration.map((paragraph) => (
            <p key={paragraph.slice(0, 40)} className="service-prose">
              {paragraph}
            </p>
          ))}
        </section>

        <section className="service-block" aria-labelledby="layover-who-heading">
          <h2 id="layover-who-heading" className="service-h2">
            {copy.whoTitle}
          </h2>
          <ul className="service-why-grid">
            {copy.who.map((item) => (
              <li key={item.title} className="service-card">
                <h3 className="service-h3">{item.title}</h3>
                <p className="service-prose">{item.text}</p>
              </li>
            ))}
          </ul>
        </section>

        <section className="service-block" aria-labelledby="layover-scope-heading">
          <h2 id="layover-scope-heading" className="service-h2">
            {copy.scopeTitle}
          </h2>
          <ul className="service-why-grid">
            {copy.scope.map((item) => (
              <li key={item.title} className="service-card">
                <h3 className="service-h3">{item.title}</h3>
                <p className="service-prose">{item.text}</p>
              </li>
            ))}
          </ul>
          <p className="service-prose">{copy.scopeNote}</p>
        </section>

        <section className="service-final" aria-labelledby="layover-final-heading">
          <h2 id="layover-final-heading" className="service-h2">
            {copy.finalTitle}
          </h2>
          <p className="service-prose">{copy.finalLead}</p>
          {bookLink("service-cta", copy.bookCta)}
        </section>
      </div>
    </main>
  );
}
