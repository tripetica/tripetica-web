"use client";

import { useCallback, useState } from "react";
import { ContactChannelsModal } from "@/components/contact-channels-modal";
import { checkoutCopy } from "@/lib/booking/checkout-copy";
import { openContactLauncher } from "@/lib/contact/events";
import { type Locale } from "@/lib/i18n/config";
import {
  BOOKING_DESKTOP_QUERY,
  useMediaQuery,
} from "@/lib/ui/use-media-query";

type CheckoutSuccessTourGuideProps = {
  locale: Locale;
};

export function CheckoutSuccessTourGuide({ locale }: CheckoutSuccessTourGuideProps) {
  const copy = checkoutCopy[locale];
  const desktop = useMediaQuery(BOOKING_DESKTOP_QUERY);
  const [contactModalOpen, setContactModalOpen] = useState(false);

  const closeContactModal = useCallback(() => {
    setContactModalOpen(false);
  }, []);

  function openContact() {
    if (desktop) {
      setContactModalOpen(true);
      return;
    }
    openContactLauncher();
  }

  return (
    <>
      <div className="checkout-success-guide">
        <p className="checkout-success-guide-copy">{copy.successTourGuideInfo}</p>
        <div className="checkout-success-guide-contact">
          <button
            type="button"
            className="booking-cta-secondary checkout-success-guide-cta"
            onClick={openContact}
          >
            {copy.successContactUs}
          </button>
        </div>
      </div>
      <ContactChannelsModal
        locale={locale}
        open={contactModalOpen}
        onClose={closeContactModal}
        ariaLabel={copy.successContactUs}
      />
    </>
  );
}
