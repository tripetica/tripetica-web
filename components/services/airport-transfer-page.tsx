import Image from "next/image";
import { BookTransferLink } from "@/components/booking/book-transfer-link";
import { SiteHeader } from "@/components/site-header";
import { type Locale } from "@/lib/i18n/config";
import { servicePath } from "@/lib/services/catalog";
import { airportTransferCopy } from "@/lib/services/airport-transfer-copy";

const HERO_IMAGE = "/1 airport-private-transfer-taxi.jpg";

type AirportTransferPageProps = {
  locale: Locale;
};

export function AirportTransferPage({ locale }: AirportTransferPageProps) {
  const copy = airportTransferCopy[locale];

  return (
    <main className="service-page light-theme-page">
      <SiteHeader
        locale={locale}
        pathWithoutLocale={servicePath("airport-transfer")}
        variant="service"
      />
      <section className="service-hero">
        <Image
          src={HERO_IMAGE}
          alt={copy.heroAlt}
          fill
          priority
          sizes="100vw"
          className="service-hero-image"
        />
        <div className="service-hero-shade" aria-hidden="true" />
        <div className="service-hero-copy">
          <p className="service-kicker">{copy.kicker}</p>
          <h1 className="service-h1">{copy.h1}</h1>
          <p className="service-hero-lead">{copy.heroLead}</p>
          <BookTransferLink locale={locale} className="service-cta">
            {copy.bookCta}
          </BookTransferLink>
        </div>
      </section>

      <div className="service-body">
        <section className="service-block" aria-labelledby="service-overview-heading">
          <h2 id="service-overview-heading" className="service-h2">
            {copy.overviewTitle}
          </h2>
          {copy.overview.map((paragraph) => (
            <p key={paragraph.slice(0, 48)} className="service-prose">
              {paragraph}
            </p>
          ))}
          <ul className="service-scope-grid">
            {copy.scopes.map((scope) => (
              <li key={scope.title} className="service-card">
                <h3 className="service-h3">{scope.title}</h3>
                <p className="service-prose">{scope.text}</p>
              </li>
            ))}
          </ul>
        </section>

        <section className="service-block" aria-labelledby="service-airports-heading">
          <h2 id="service-airports-heading" className="service-h2">
            {copy.airportsTitle}
          </h2>
          <p className="service-prose">{copy.airportsLead}</p>
          <ul className="service-airport-grid">
            {copy.airports.map((airport) => (
              <li key={airport.code} className="service-card">
                <p className="service-kicker">{airport.code}</p>
                <h3 className="service-h3">{airport.name}</h3>
                <p className="service-prose">{airport.text}</p>
              </li>
            ))}
          </ul>
          <p className="service-prose">{copy.airportsNote}</p>
        </section>

        <section className="service-block" aria-labelledby="service-routes-heading">
          <h2 id="service-routes-heading" className="service-h2">
            {copy.routesTitle}
          </h2>
          <div className="service-route-groups">
            {copy.routeGroups.map((group) => (
              <section key={group.heading} className="service-card service-route-group">
                <h3 className="service-h3">{group.heading}</h3>
                <ul className="service-route-list">
                  {group.routes.map((route) => (
                    <li key={route}>
                      <BookTransferLink locale={locale} className="service-route-link">
                        {route}
                      </BookTransferLink>
                    </li>
                  ))}
                </ul>
              </section>
            ))}
          </div>
        </section>

        <section className="service-block" aria-labelledby="service-city-heading">
          <h2 id="service-city-heading" className="service-h2">
            {copy.cityTitle}
          </h2>
          {copy.city.map((paragraph) => (
            <p key={paragraph.slice(0, 48)} className="service-prose">
              {paragraph}
            </p>
          ))}
        </section>

        <section className="service-block" aria-labelledby="service-intercity-heading">
          <h2 id="service-intercity-heading" className="service-h2">
            {copy.intercityTitle}
          </h2>
          {copy.intercity.map((paragraph) => (
            <p key={paragraph.slice(0, 48)} className="service-prose">
              {paragraph}
            </p>
          ))}
        </section>

        <section className="service-block" aria-labelledby="service-why-heading">
          <h2 id="service-why-heading" className="service-h2">
            {copy.whyTitle}
          </h2>
          <ul className="service-why-grid">
            {copy.why.map((item) => (
              <li key={item.title} className="service-card">
                <h3 className="service-h3">{item.title}</h3>
                <p className="service-prose">{item.text}</p>
              </li>
            ))}
          </ul>
        </section>

        <section className="service-block" aria-labelledby="service-how-heading">
          <h2 id="service-how-heading" className="service-h2">
            {copy.howTitle}
          </h2>
          <ol className="service-how-list">
            {copy.how.map((step, index) => (
              <li key={step} className="service-card service-how-item">
                <span className="service-how-num" aria-hidden="true">
                  {index + 1}
                </span>
                <p className="service-how-text">{step}</p>
              </li>
            ))}
          </ol>
        </section>

        <section className="service-block" aria-labelledby="service-faq-heading">
          <h2 id="service-faq-heading" className="service-h2">
            {copy.faqTitle}
          </h2>
          <dl className="service-faq">
            {copy.faqs.map((item) => (
              <div key={item.question} className="service-card service-faq-item">
                <dt>
                  <h3 className="service-h3">{item.question}</h3>
                </dt>
                <dd className="service-prose">{item.answer}</dd>
              </div>
            ))}
          </dl>
        </section>

        <section className="service-final" aria-labelledby="service-final-heading">
          <h2 id="service-final-heading" className="service-h2">
            {copy.finalTitle}
          </h2>
          <p className="service-prose">{copy.finalLead}</p>
          <BookTransferLink locale={locale} className="service-cta">
            {copy.bookCta}
          </BookTransferLink>
        </section>
      </div>
    </main>
  );
}
