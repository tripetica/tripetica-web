import Image from "next/image";
import { BookTransferLink } from "@/components/booking/book-transfer-link";
import { SiteHeader } from "@/components/site-header";
import { type Locale } from "@/lib/i18n/config";
import { servicePath } from "@/lib/services/catalog";
import { hourlyChauffeurCopy } from "@/lib/services/hourly-chauffeur-copy";

const HERO_IMAGE = "/2 hourly-chauffeur-service.jpg";

type HourlyChauffeurPageProps = {
  locale: Locale;
};

export function HourlyChauffeurPage({ locale }: HourlyChauffeurPageProps) {
  const copy = hourlyChauffeurCopy[locale];

  return (
    <main className="service-page light-theme-page">
      <SiteHeader
        locale={locale}
        pathWithoutLocale={servicePath("hourly-chauffeur")}
        variant="service"
      />
      <section className="service-hero">
        <Image
          src={HERO_IMAGE}
          alt={copy.heroAlt}
          fill
          priority
          sizes="100vw"
          className="service-hero-image service-hero-image--hourly"
        />
        <div className="service-hero-shade" aria-hidden="true" />
        <div className="service-hero-copy">
          <p className="service-kicker">{copy.kicker}</p>
          <h1 className="service-h1">{copy.h1}</h1>
          <p className="service-hero-lead">{copy.heroLead}</p>
          <BookTransferLink locale={locale} service="hourly" className="service-cta">
            {copy.bookCta}
          </BookTransferLink>
        </div>
      </section>

      <div className="service-body">
        <section className="service-block" aria-labelledby="hourly-what-heading">
          <h2 id="hourly-what-heading" className="service-h2">
            {copy.whatTitle}
          </h2>
          {copy.what.map((paragraph) => (
            <p key={paragraph.slice(0, 48)} className="service-prose">
              {paragraph}
            </p>
          ))}
        </section>

        <section className="service-block" aria-labelledby="hourly-uses-heading">
          <h2 id="hourly-uses-heading" className="service-h2">
            {copy.usesTitle}
          </h2>
          <ul className="service-why-grid">
            {copy.uses.map((item) => (
              <li key={item.title} className="service-card">
                <h3 className="service-h3">{item.title}</h3>
                <p className="service-prose">{item.text}</p>
              </li>
            ))}
          </ul>
        </section>

        <section className="service-block" aria-labelledby="hourly-how-heading">
          <h2 id="hourly-how-heading" className="service-h2">
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

        <section className="service-block" aria-labelledby="hourly-compare-heading">
          <h2 id="hourly-compare-heading" className="service-h2">
            {copy.compareTitle}
          </h2>
          {copy.compare.map((paragraph) => (
            <p key={paragraph.slice(0, 48)} className="service-prose">
              {paragraph}
            </p>
          ))}
        </section>

        <section className="service-block" aria-labelledby="hourly-area-heading">
          <h2 id="hourly-area-heading" className="service-h2">
            {copy.areaTitle}
          </h2>
          {copy.area.map((paragraph) => (
            <p key={paragraph.slice(0, 48)} className="service-prose">
              {paragraph}
            </p>
          ))}
        </section>

        <section className="service-final" aria-labelledby="hourly-final-heading">
          <h2 id="hourly-final-heading" className="service-h2">
            {copy.finalTitle}
          </h2>
          <p className="service-prose">{copy.finalLead}</p>
          <BookTransferLink locale={locale} service="hourly" className="service-cta">
            {copy.bookCta}
          </BookTransferLink>
        </section>
      </div>
    </main>
  );
}
