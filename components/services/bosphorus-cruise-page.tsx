import Image from "next/image";
import { BookTransferLink } from "@/components/booking/book-transfer-link";
import { SiteHeader } from "@/components/site-header";
import { type Locale } from "@/lib/i18n/config";
import { servicePath } from "@/lib/services/catalog";
import { bosphorusCruiseCopy } from "@/lib/services/bosphorus-cruise-copy";

const HERO_IMAGE = "/istanbul-bosphorus-dinner-cruise.png";

const SPLIT_IMAGES = [
  {
    src: "/istanbul-bosphorus-dinner-cruise-night.jpg",
    objectPosition: "46% 52%",
    titleKey: "nightTitle",
    altKey: "nightAlt",
    textKey: "night",
    reversed: false,
  },
  {
    src: "/bosphorus-dinner-cruise-dining.jpg",
    objectPosition: "50% 58%",
    titleKey: "diningTitle",
    altKey: "diningAlt",
    textKey: "dining",
    reversed: true,
  },
  {
    src: "/turkish-night-live-dance-show.jpg",
    objectPosition: "50% 38%",
    titleKey: "showTitle",
    altKey: "showAlt",
    textKey: "show",
    reversed: false,
  },
  {
    src: "/whirling-dervish-show-istanbul.jpg",
    objectPosition: "48% 32%",
    titleKey: "cultureTitle",
    altKey: "cultureAlt",
    textKey: "culture",
    reversed: true,
  },
] as const;

type BosphorusCruisePageProps = {
  locale: Locale;
};

export function BosphorusCruisePage({ locale }: BosphorusCruisePageProps) {
  const copy = bosphorusCruiseCopy[locale];

  const bookLink = (label: string) => (
    <BookTransferLink
      locale={locale}
      service="tour"
      tourId="bosphorus-dinner"
      className="service-cta"
    >
      {label}
    </BookTransferLink>
  );

  return (
    <main className="service-page light-theme-page">
      <SiteHeader
        locale={locale}
        pathWithoutLocale={servicePath("istanbul-bosphorus-dinner-cruise")}
        variant="service"
      />
      <section className="service-hero service-hero--cruise">
        <Image
          src={HERO_IMAGE}
          alt={copy.heroAlt}
          fill
          priority
          sizes="100vw"
          className="service-hero-image service-hero-image--cruise"
        />
        <div className="service-hero-shade" aria-hidden="true" />
        <div className="service-hero-copy">
          <p className="service-kicker">{copy.kicker}</p>
          <h1 className="service-h1">{copy.h1}</h1>
          <p className="service-hero-lead">{copy.heroLead}</p>
          {bookLink(copy.bookCta)}
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

        {SPLIT_IMAGES.map((block) => {
          const title = copy[block.titleKey];
          const alt = copy[block.altKey];
          const paragraphs = copy[block.textKey];
          const headingId = `cruise-${block.titleKey}`;

          return (
            <section
              key={block.src}
              className={`service-split${block.reversed ? " is-reversed" : ""}`}
              aria-labelledby={headingId}
            >
              <div className="service-split-media">
                <Image
                  src={block.src}
                  alt={alt}
                  fill
                  sizes="(min-width: 900px) 50vw, 100vw"
                  className="service-split-image"
                  style={{ objectPosition: block.objectPosition }}
                />
              </div>
              <div className="service-split-copy">
                <h2 id={headingId} className="service-h2">
                  {title}
                </h2>
                {paragraphs.map((paragraph) => (
                  <p key={paragraph.slice(0, 48)} className="service-prose">
                    {paragraph}
                  </p>
                ))}
              </div>
            </section>
          );
        })}

        <section className="service-block" aria-labelledby="cruise-expect-heading">
          <h2 id="cruise-expect-heading" className="service-h2">
            {copy.expectTitle}
          </h2>
          <ol className="service-how-list">
            {copy.expect.map((step, index) => (
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

        <section className="service-block" aria-labelledby="cruise-views-heading">
          <h2 id="cruise-views-heading" className="service-h2">
            {copy.viewsTitle}
          </h2>
          <p className="service-prose">{copy.viewsLead}</p>
          <ul className="service-why-grid">
            {copy.views.map((item) => (
              <li key={item.title} className="service-card">
                <h3 className="service-h3">{item.title}</h3>
                <p className="service-prose">{item.text}</p>
              </li>
            ))}
          </ul>
          <p className="service-prose">{copy.viewsNote}</p>
        </section>

        <section className="service-block" aria-labelledby="cruise-packages-heading">
          <h2 id="cruise-packages-heading" className="service-h2">
            {copy.packagesTitle}
          </h2>
          {copy.packages.map((paragraph) => (
            <p key={paragraph.slice(0, 48)} className="service-prose">
              {paragraph}
            </p>
          ))}
        </section>

        <section className="service-block" aria-labelledby="cruise-transfer-heading">
          <h2 id="cruise-transfer-heading" className="service-h2">
            {copy.transferTitle}
          </h2>
          <p className="service-prose">{copy.transfer}</p>
        </section>

        <section className="service-block" aria-labelledby="cruise-who-heading">
          <h2 id="cruise-who-heading" className="service-h2">
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

        <section className="service-final" aria-labelledby="cruise-final-heading">
          <h2 id="cruise-final-heading" className="service-h2">
            {copy.finalTitle}
          </h2>
          <p className="service-prose">{copy.finalLead}</p>
          {bookLink(copy.bookCta)}
        </section>
      </div>
    </main>
  );
}
