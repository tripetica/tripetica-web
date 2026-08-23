import Image from "next/image";
import Link from "next/link";
import { BookTransferLink } from "@/components/booking/book-transfer-link";
import { SiteHeader } from "@/components/site-header";
import { type Locale } from "@/lib/i18n/config";
import { localizedPath } from "@/lib/i18n/path";
import { servicePath } from "@/lib/services/catalog";
import { sapancaTourCopy } from "@/lib/services/sapanca-tour-copy";

const HERO_IMAGE = "/sapanca-tour-postcard-collage.jpg";

type SapancaTourPageProps = {
  locale: Locale;
};

export function SapancaTourPage({ locale }: SapancaTourPageProps) {
  const copy = sapancaTourCopy[locale];

  const bookLink = () => (
    <BookTransferLink
      locale={locale}
      service="tour"
      tourId="sapanca"
      className="service-cta"
    >
      {copy.bookCta}
    </BookTransferLink>
  );

  return (
    <main className="service-page">
      <section className="service-hero service-hero--sapanca">
        <Image
          src={HERO_IMAGE}
          alt={copy.heroAlt}
          fill
          priority
          sizes="100vw"
          className="service-hero-image service-hero-image--sapanca"
        />
        <div className="service-hero-shade" aria-hidden="true" />
        <SiteHeader
          locale={locale}
          pathWithoutLocale={servicePath("sapanca-tour")}
          variant="service"
        />
        <div className="service-hero-copy">
          <p className="service-kicker">{copy.kicker}</p>
          <h1 className="service-h1">{copy.h1}</h1>
          <p className="service-hero-lead">{copy.heroLead}</p>
          {bookLink()}
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

        <section className="service-block" aria-labelledby="sapanca-lake-heading">
          <h2 id="sapanca-lake-heading" className="service-h2">
            {copy.lakeTitle}
          </h2>
          {copy.lake.map((paragraph) => (
            <p key={paragraph.slice(0, 48)} className="service-prose">
              {paragraph}
            </p>
          ))}
        </section>

        <section
          className="service-split"
          aria-labelledby="sapanca-nature-heading"
        >
          <div className="service-split-media">
            <Image
              src="/sapanca naturkoy.webp"
              alt={copy.natureAlt}
              fill
              sizes="(min-width: 900px) 50vw, 100vw"
              className="service-split-image"
              style={{ objectPosition: "48% 45%" }}
            />
          </div>
          <div className="service-split-copy">
            <h2 id="sapanca-nature-heading" className="service-h2">
              {copy.natureTitle}
            </h2>
            {copy.nature.map((paragraph) => (
              <p key={paragraph.slice(0, 48)} className="service-prose">
                {paragraph}
              </p>
            ))}
          </div>
        </section>

        <section
          className="service-split is-reversed"
          aria-labelledby="sapanca-activity-heading"
        >
          <div className="service-split-media">
            <Image
              src="/sapanca atv safari.jpg"
              alt={copy.activityAlt}
              fill
              sizes="(min-width: 900px) 50vw, 100vw"
              className="service-split-image"
              style={{ objectPosition: "50% 40%" }}
            />
          </div>
          <div className="service-split-copy">
            <h2 id="sapanca-activity-heading" className="service-h2">
              {copy.activityTitle}
            </h2>
            {copy.activity.map((paragraph) => (
              <p key={paragraph.slice(0, 48)} className="service-prose">
                {paragraph}
              </p>
            ))}
          </div>
        </section>

        <section
          className="service-split"
          aria-labelledby="sapanca-quiet-heading"
        >
          <div className="service-split-media">
            <Image
              src="/sapanca sopeli.jpg"
              alt={copy.quietAlt}
              fill
              sizes="(min-width: 900px) 50vw, 100vw"
              className="service-split-image"
              style={{ objectPosition: "46% 48%" }}
            />
          </div>
          <div className="service-split-copy">
            <h2 id="sapanca-quiet-heading" className="service-h2">
              {copy.quietTitle}
            </h2>
            {copy.quiet.map((paragraph) => (
              <p key={paragraph.slice(0, 48)} className="service-prose">
                {paragraph}
              </p>
            ))}
          </div>
        </section>

        <section className="service-block" aria-labelledby="sapanca-how-heading">
          <h2 id="sapanca-how-heading" className="service-h2">
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

        <section className="service-block" aria-labelledby="sapanca-day-heading">
          <h2 id="sapanca-day-heading" className="service-h2">
            {copy.dayTitle}
          </h2>
          {copy.day.map((paragraph) => (
            <p key={paragraph.slice(0, 48)} className="service-prose">
              {paragraph}
            </p>
          ))}
        </section>

        <section className="service-block" aria-labelledby="sapanca-custom-heading">
          <h2 id="sapanca-custom-heading" className="service-h2">
            {copy.customTitle}
          </h2>
          {copy.custom.map((paragraph) => (
            <p key={paragraph.slice(0, 48)} className="service-prose">
              {paragraph}
            </p>
          ))}
          <p className="service-prose">{copy.midCtaLead}</p>
          {bookLink()}
        </section>

        <section className="service-block" aria-labelledby="sapanca-why-heading">
          <h2 id="sapanca-why-heading" className="service-h2">
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
          <p className="service-prose">
            {copy.relatedBefore}
            <Link
              href={localizedPath(locale, servicePath("hourly-chauffeur"))}
              className="service-inline-link"
            >
              {copy.relatedHourly}
            </Link>
            {copy.relatedMid}
            <Link
              href={localizedPath(locale, servicePath("istanbul-city-tour"))}
              className="service-inline-link"
            >
              {copy.relatedCity}
            </Link>
            {copy.relatedAfter}
          </p>
        </section>

        <section className="service-block" aria-labelledby="sapanca-faq-heading">
          <h2 id="sapanca-faq-heading" className="service-h2">
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

        <section className="service-final" aria-labelledby="sapanca-final-heading">
          <h2 id="sapanca-final-heading" className="service-h2">
            {copy.finalTitle}
          </h2>
          <p className="service-prose">{copy.finalLead}</p>
          {bookLink()}
        </section>
      </div>
    </main>
  );
}
