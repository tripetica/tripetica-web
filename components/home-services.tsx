import Image from "next/image";
import Link from "next/link";
import { BookTransferLink } from "@/components/booking/book-transfer-link";
import { QuoteRequestPanel } from "@/components/quote-request-panel";
import { localizedPath } from "@/lib/i18n/path";
import { type Locale } from "@/lib/i18n/config";
import { type AirportCode, type ServiceType, type TourId } from "@/lib/booking/types";
import { serviceIds, servicePath, type ServiceId } from "@/lib/services/catalog";
import { homeServicesCopy } from "@/lib/services/copy";

const CARD_IMAGES: Partial<Record<ServiceId, string>> = {
  "airport-transfer": "/1 airport-private-transfer-taxi.jpg",
  "hourly-chauffeur": "/2 hourly-chauffeur-service.jpg",
  "istanbul-layover-tour": "/3 Layover(transit) Tour.png",
  "istanbul-city-tour": "/istanbul-city-tour-private-car.jpg",
  "istanbul-bosphorus-dinner-cruise": "/istanbul-bosphorus-dinner-cruise.png",
  "sapanca-tour": "/sapanca-tour-postcard-collage.jpg",
  "bursa-tour": "/bursa-tour-postcard-collage.jpg",
  "private-turkey-tours": "/private-turkey-tours-collage.png",
};

const CARD_BOOKING: Partial<
  Record<
    ServiceId,
    {
      service: ServiceType;
      tourId?: TourId;
      pickupAirport?: AirportCode;
    }
  >
> = {
  "airport-transfer": { service: "transfer" },
  "hourly-chauffeur": { service: "hourly" },
  "istanbul-layover-tour": {
    service: "tour",
    tourId: "istanbul-layover",
    pickupAirport: "IST",
  },
  "istanbul-city-tour": { service: "tour" },
  "istanbul-bosphorus-dinner-cruise": {
    service: "tour",
    tourId: "bosphorus-dinner",
  },
  "sapanca-tour": {
    service: "tour",
    tourId: "sapanca",
  },
  "bursa-tour": {
    service: "tour",
    tourId: "bursa",
  },
};

const FALLBACK_CARD_IMAGE = "/ana tema desktop.png";

function cardImage(id: ServiceId) {
  return CARD_IMAGES[id] ?? FALLBACK_CARD_IMAGE;
}

type HomeServicesProps = {
  locale: Locale;
};

export function HomeServices({ locale }: HomeServicesProps) {
  const copy = homeServicesCopy[locale];

  return (
    <section
      id="services"
      className="home-services"
      aria-labelledby="home-services-heading"
    >
      <div className="home-services-inner">
        <header className="home-services-intro">
          <p className="home-services-label">{copy.label}</p>
          <h2 id="home-services-heading" className="home-services-heading">
            {copy.heading}
          </h2>
          <p className="home-services-lead">{copy.intro}</p>
        </header>
        <ul className="home-services-grid">
          {serviceIds.map((id) => {
            const card = copy.cards[id];
            const detailsLabel = card.viewDetails ?? copy.viewDetails;
            const booking = CARD_BOOKING[id];
            return (
              <li key={id} className="home-service-card">
                <article>
                  <div className="home-service-media">
                    <Image
                      src={cardImage(id)}
                      alt={card.imageAlt ?? ""}
                      fill
                      sizes="(min-width: 900px) 33vw, 100vw"
                      className="home-service-image"
                    />
                  </div>
                  <div className="home-service-body">
                    <h3 className="home-service-title">{card.title}</h3>
                    <p className="home-service-copy">{card.description}</p>
                    {card.quoteCta ? (
                      <div className="home-service-actions">
                        <QuoteRequestPanel
                          locale={locale}
                          label={card.quoteCta}
                          className="home-service-cta"
                        />
                        <Link
                          href={localizedPath(locale, servicePath(id))}
                          className="home-service-cta"
                        >
                          {detailsLabel}
                        </Link>
                      </div>
                    ) : booking && card.bookCta ? (
                      <div className="home-service-actions">
                        <BookTransferLink
                          locale={locale}
                          service={booking.service}
                          tourId={booking.tourId}
                          pickupAirport={booking.pickupAirport}
                          className="home-service-cta"
                        >
                          {card.bookCta}
                        </BookTransferLink>
                        <Link
                          href={localizedPath(locale, servicePath(id))}
                          className="home-service-cta"
                        >
                          {detailsLabel}
                        </Link>
                      </div>
                    ) : (
                      <Link
                        href={localizedPath(locale, servicePath(id))}
                        className="home-service-cta"
                      >
                        {detailsLabel}
                      </Link>
                    )}
                  </div>
                </article>
              </li>
            );
          })}
        </ul>
      </div>
    </section>
  );
}
