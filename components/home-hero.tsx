import { getImageProps } from "next/image";
import { HeroBooking } from "@/components/booking/hero-booking";
import { ReviewLabWidget } from "@/components/review-lab-widget";
import { SiteHeader } from "@/components/site-header";
import { type BookingCopy } from "@/lib/booking/copy";
import { type Locale } from "@/lib/i18n/config";

const DESKTOP_BREAKPOINT = "(min-width: 768px)";

type HomeHeroProps = {
  locale: Locale;
  imageAlt: string;
  booking: BookingCopy;
};

export function HomeHero({ locale, imageAlt, booking }: HomeHeroProps) {
  const common = { alt: imageAlt, sizes: "100vw", quality: 90 };
  const {
    props: { srcSet: desktopSrcSet },
  } = getImageProps({
    ...common,
    width: 1672,
    height: 941,
    src: "/ana tema desktop.png",
  });
  const {
    props: { srcSet: mobileSrcSet, style: mobileStyle, ...mobileProps },
  } = getImageProps({
    ...common,
    width: 937,
    height: 1392,
    src: "/ana tema mobil.png",
  });

  return (
    <>
    <section className="relative h-[100svh] min-h-[28rem] w-full overflow-hidden">
      <picture className="pointer-events-none absolute inset-0">
        <source media={DESKTOP_BREAKPOINT} srcSet={desktopSrcSet} />
        <img
          {...mobileProps}
          alt={imageAlt}
          srcSet={mobileSrcSet}
          fetchPriority="high"
          loading="eager"
          decoding="async"
          className="pointer-events-none absolute inset-0 h-full w-full max-w-full object-cover object-[40%_18%] md:object-[38%_34%] lg:object-[46%_38%] xl:object-center"
          style={{
            ...mobileStyle,
            objectPosition: undefined,
            position: "absolute",
            inset: 0,
            width: "100%",
            height: "100%",
            maxWidth: "100%",
            objectFit: "cover",
          }}
        />
      </picture>
      <div
        aria-hidden="true"
        className="pointer-events-none absolute inset-x-0 top-0 h-[4rem] bg-gradient-to-b from-black/14 via-black/5 to-transparent sm:h-[5rem] md:h-[6rem] md:from-black/12"
      />
      <div
        aria-hidden="true"
        className="pointer-events-none absolute inset-x-0 bottom-0 h-[min(48%,26rem)] bg-gradient-to-t from-black/18 via-black/6 to-transparent"
      />
      <div aria-hidden="true" className="hero-exit-fade" />
      <SiteHeader locale={locale} pathWithoutLocale="/" />
      <HeroBooking locale={locale} copy={booking} />
    </section>
    <ReviewLabWidget locale={locale} />
    </>
  );
}
