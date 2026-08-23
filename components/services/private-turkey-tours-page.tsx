import Image from "next/image";
import { QuoteRequestPanel } from "@/components/quote-request-panel";
import { SiteHeader } from "@/components/site-header";
import { type Locale } from "@/lib/i18n/config";
import { servicePath } from "@/lib/services/catalog";
import { privateTurkeyToursCopy } from "@/lib/services/private-turkey-tours-copy";

const HERO_IMAGE = "/private-turkey-tours-collage.png";

type PrivateTurkeyToursPageProps = {
  locale: Locale;
};

export function PrivateTurkeyToursPage({ locale }: PrivateTurkeyToursPageProps) {
  const copy = privateTurkeyToursCopy[locale];

  const quoteCta = (
    <QuoteRequestPanel
      locale={locale}
      label={copy.quoteCta}
      className="service-cta"
      placement="popover"
    />
  );

  return (
    <main className="service-page">
      <section className="service-hero service-hero--turkey">
        <div className="service-hero-visual">
          <Image
            src={HERO_IMAGE}
            alt={copy.heroAlt}
            width={1536}
            height={1024}
            priority
            sizes="100vw"
            className="service-hero-image service-hero-image--turkey"
          />
          <div className="service-hero-shade" aria-hidden="true" />
          <SiteHeader
            locale={locale}
            pathWithoutLocale={servicePath("private-turkey-tours")}
            variant="service"
          />
        </div>
        <div className="service-hero-copy">
          <p className="service-kicker">{copy.kicker}</p>
          <h1 className="service-h1">{copy.h1}</h1>
          {copy.heroLead.map((paragraph) => (
            <p key={paragraph.slice(0, 48)} className="service-hero-lead">
              {paragraph}
            </p>
          ))}
        </div>
      </section>

      <div className="service-body">
        <ul className="service-highlights">
          {copy.highlights.map((item) => (
            <li key={item.title} className="service-card">
              <p className="service-h3">{item.title}</p>
              <p className="service-prose">{item.text}</p>
            </li>
          ))}
        </ul>

        {copy.destinations.map((destination) => (
          <section
            key={destination.id}
            className="service-block"
            aria-labelledby={`turkey-${destination.id}-heading`}
          >
            <h2
              id={`turkey-${destination.id}-heading`}
              className="service-h2"
            >
              {destination.title}
            </h2>
            {destination.paragraphs.map((paragraph) => (
              <p key={paragraph.slice(0, 48)} className="service-prose">
                {paragraph}
              </p>
            ))}
          </section>
        ))}

        <section className="service-block" aria-labelledby="turkey-more-heading">
          <h2 id="turkey-more-heading" className="service-h2">
            {copy.moreTitle}
          </h2>
          {copy.more.map((paragraph) => (
            <p key={paragraph.slice(0, 48)} className="service-prose">
              {paragraph}
            </p>
          ))}
        </section>

        <section className="service-block" aria-labelledby="turkey-plan-heading">
          <h2 id="turkey-plan-heading" className="service-h2">
            {copy.planTitle}
          </h2>
          {copy.plan.map((paragraph) => (
            <p key={paragraph.slice(0, 48)} className="service-prose">
              {paragraph}
            </p>
          ))}
        </section>

        <section className="service-block" aria-labelledby="turkey-why-heading">
          <h2 id="turkey-why-heading" className="service-h2">
            {copy.whyTitle}
          </h2>
          <ul className="service-how-list">
            {copy.why.map((item) => (
              <li key={item.title} className="service-card">
                <h3 className="service-h3">{item.title}</h3>
                <p className="service-prose">{item.text}</p>
              </li>
            ))}
          </ul>
        </section>

        <section className="service-block" aria-labelledby="turkey-faq-heading">
          <h2 id="turkey-faq-heading" className="service-h2">
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

        <section className="service-final" aria-labelledby="turkey-final-heading">
          <h2 id="turkey-final-heading" className="service-h2">
            {copy.finalTitle}
          </h2>
          <p className="service-prose">{copy.finalLead}</p>
          {quoteCta}
        </section>
      </div>
    </main>
  );
}
