import Image from "next/image";
import { BookTransferLink } from "@/components/booking/book-transfer-link";
import { SiteHeader } from "@/components/site-header";
import { type Locale } from "@/lib/i18n/config";
import { servicePath } from "@/lib/services/catalog";
import { bursaTourCopy } from "@/lib/services/bursa-tour-copy";

const HERO_IMAGE = "/bursa-tour-postcard-collage.jpg";
const INTRO_IMAGE = encodeURI("/bursa merkezden bir kare.jpg");
const MOSQUE_IMAGE = encodeURI("/bursa ulu cami .jpg");
const TOPHANE_IMAGE = encodeURI("/bursa tophane.jpg");
const CABLE_IMAGE = encodeURI("/uludag teleferik.jpg");
const SNOW_IMAGE = encodeURI("/bursa uludag 2.jpg");

type BursaTourPageProps = {
  locale: Locale;
};

export function BursaTourPage({ locale }: BursaTourPageProps) {
  const copy = bursaTourCopy[locale];

  const bookLink = () => (
    <BookTransferLink
      locale={locale}
      service="tour"
      tourId="bursa"
      className="service-cta"
    >
      {copy.bookCta}
    </BookTransferLink>
  );

  return (
    <main className="service-page light-theme-page">
      <SiteHeader
        locale={locale}
        pathWithoutLocale={servicePath("bursa-tour")}
        variant="service"
      />
      <section className="service-hero service-hero--bursa">
        <Image
          src={HERO_IMAGE}
          alt={copy.heroAlt}
          fill
          priority
          sizes="100vw"
          className="service-hero-image service-hero-image--bursa"
        />
        <div className="service-hero-shade" aria-hidden="true" />
        <div className="service-hero-copy">
          <p className="service-kicker">{copy.kicker}</p>
          <h1 className="service-h1">{copy.h1}</h1>
          <p className="service-hero-lead">{copy.heroLead}</p>
          {bookLink()}
        </div>
      </section>

      <div className="service-body">
        <section
          className="service-split is-portrait-layout"
          aria-labelledby="bursa-intro-heading"
        >
          <div className="service-split-media is-portrait-23">
            <Image
              src={INTRO_IMAGE}
              alt={copy.introAlt}
              fill
              sizes="(min-width: 900px) 38vw, 100vw"
              className="service-split-image"
              style={{ objectPosition: "50% 35%" }}
            />
          </div>
          <div className="service-split-copy">
            <h2 id="bursa-intro-heading" className="service-h2">
              {copy.introTitle}
            </h2>
            {copy.intro.map((paragraph) => (
              <p key={paragraph.slice(0, 48)} className="service-prose">
                {paragraph}
              </p>
            ))}
          </div>
        </section>

        <section
          className="service-split is-reversed"
          aria-labelledby="bursa-mosque-heading"
        >
          <div className="service-split-media is-landscape">
            <Image
              src={MOSQUE_IMAGE}
              alt={copy.mosqueAlt}
              fill
              sizes="(min-width: 900px) 50vw, 100vw"
              className="service-split-image"
              style={{ objectPosition: "50% 48%" }}
            />
          </div>
          <div className="service-split-copy">
            <h2 id="bursa-mosque-heading" className="service-h2">
              {copy.mosqueTitle}
            </h2>
            {copy.mosque.map((paragraph) => (
              <p key={paragraph.slice(0, 48)} className="service-prose">
                {paragraph}
              </p>
            ))}
          </div>
        </section>

        <section
          className="service-split is-portrait-layout"
          aria-labelledby="bursa-tophane-heading"
        >
          <div className="service-split-media is-portrait-23">
            <Image
              src={TOPHANE_IMAGE}
              alt={copy.tophaneAlt}
              fill
              sizes="(min-width: 900px) 38vw, 100vw"
              className="service-split-image"
              style={{ objectPosition: "50% 28%" }}
            />
          </div>
          <div className="service-split-copy">
            <h2 id="bursa-tophane-heading" className="service-h2">
              {copy.tophaneTitle}
            </h2>
            {copy.tophane.map((paragraph) => (
              <p key={paragraph.slice(0, 48)} className="service-prose">
                {paragraph}
              </p>
            ))}
          </div>
        </section>

        <section className="service-block" aria-labelledby="bursa-mountain-heading">
          <h2 id="bursa-mountain-heading" className="service-h2">
            {copy.mountainTitle}
          </h2>
          {copy.mountainLead.map((paragraph) => (
            <p key={paragraph.slice(0, 48)} className="service-prose">
              {paragraph}
            </p>
          ))}
          <ul className="service-photo-pair">
            <li>
              <figure className="is-portrait-34">
                <Image
                  src={CABLE_IMAGE}
                  alt={copy.cableAlt}
                  fill
                  sizes="(min-width: 700px) 45vw, 100vw"
                  className="service-split-image"
                  style={{ objectPosition: "50% 40%" }}
                />
              </figure>
            </li>
            <li>
              <figure className="is-portrait-23">
                <Image
                  src={SNOW_IMAGE}
                  alt={copy.snowAlt}
                  fill
                  sizes="(min-width: 700px) 45vw, 100vw"
                  className="service-split-image"
                  style={{ objectPosition: "50% 45%" }}
                />
              </figure>
            </li>
          </ul>
          {copy.mountain.map((paragraph) => (
            <p key={paragraph.slice(0, 48)} className="service-prose">
              {paragraph}
            </p>
          ))}
        </section>

        <section className="service-block" aria-labelledby="bursa-stay-heading">
          <h2 id="bursa-stay-heading" className="service-h2">
            {copy.stayTitle}
          </h2>
          {copy.stay.map((paragraph) => (
            <p key={paragraph.slice(0, 48)} className="service-prose">
              {paragraph}
            </p>
          ))}
          <p className="service-prose">{copy.midCtaLead}</p>
          {bookLink()}
        </section>

        <section className="service-block" aria-labelledby="bursa-plan-heading">
          <h2 id="bursa-plan-heading" className="service-h2">
            {copy.planTitle}
          </h2>
          <ul className="service-how-list">
            {copy.plan.map((item) => (
              <li key={item.title} className="service-card">
                <h3 className="service-h3">{item.title}</h3>
                <p className="service-prose">{item.text}</p>
              </li>
            ))}
          </ul>
        </section>

        <section className="service-block" aria-labelledby="bursa-faq-heading">
          <h2 id="bursa-faq-heading" className="service-h2">
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

        <section className="service-final" aria-labelledby="bursa-final-heading">
          <h2 id="bursa-final-heading" className="service-h2">
            {copy.finalTitle}
          </h2>
          <p className="service-prose">{copy.finalLead}</p>
          {bookLink()}
        </section>
      </div>
    </main>
  );
}
