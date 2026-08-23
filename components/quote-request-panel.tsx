"use client";

import { useEffect, useId, useRef, useState } from "react";
import {
  PhoneIcon,
  TelegramIcon,
  ViberIcon,
  WhatsAppIcon,
} from "@/components/contact-channel-icons";
import { quotePanelCopy } from "@/lib/contact/quote-copy";
import {
  contactDisplayNumbers,
  contactLinks,
  whatsappQuoteHref,
} from "@/lib/contact/links";
import { type Locale } from "@/lib/i18n/config";

type QuoteRequestPanelProps = {
  locale: Locale;
  label: string;
  className: string;
  placement?: "overlay" | "popover";
};

export function QuoteRequestPanel({
  locale,
  label,
  className,
  placement = "overlay",
}: QuoteRequestPanelProps) {
  const copy = quotePanelCopy[locale];
  const [open, setOpen] = useState(false);
  const rootRef = useRef<HTMLDivElement>(null);
  const closeRef = useRef<HTMLButtonElement>(null);
  const panelId = useId();

  useEffect(() => {
    if (!open) {
      return;
    }

    closeRef.current?.focus();

    function onKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape") {
        setOpen(false);
      }
    }

    function onOutside(event: Event) {
      const root = rootRef.current;
      if (!root) {
        return;
      }
      if (event.target instanceof Node && root.contains(event.target)) {
        return;
      }
      setOpen(false);
    }

    document.addEventListener("keydown", onKeyDown);
    const timer = window.setTimeout(() => {
      document.addEventListener("click", onOutside);
    }, 0);

    return () => {
      window.clearTimeout(timer);
      document.removeEventListener("keydown", onKeyDown);
      document.removeEventListener("click", onOutside);
    };
  }, [open, placement]);

  const channels = [
    {
      id: "whatsapp",
      href: whatsappQuoteHref(copy.whatsappMessage),
      name: copy.whatsapp,
      number: contactDisplayNumbers.messaging,
      aria: copy.whatsappAria,
      icon: <WhatsAppIcon />,
      external: true,
    },
    {
      id: "telegram",
      href: contactLinks.telegram,
      name: copy.telegram,
      number: contactDisplayNumbers.messaging,
      aria: copy.telegramAria,
      icon: <TelegramIcon />,
      external: true,
    },
    {
      id: "viber",
      href: contactLinks.viber,
      name: copy.viber,
      number: contactDisplayNumbers.messaging,
      aria: copy.viberAria,
      icon: <ViberIcon />,
      external: false,
    },
    {
      id: "phone",
      href: contactLinks.phone,
      name: copy.call,
      number: contactDisplayNumbers.phone,
      aria: copy.callAria,
      icon: <PhoneIcon />,
      external: false,
    },
  ];

  return (
    <div
      ref={rootRef}
      className={`quote-request${placement === "popover" ? " quote-request--popover" : ""}`}
    >
      <button
        type="button"
        className={className}
        aria-expanded={open}
        aria-controls={panelId}
        aria-haspopup="dialog"
        onClick={() => setOpen((value) => !value)}
      >
        {label}
      </button>
      {open ? (
        <div
          id={panelId}
          className="quote-panel"
          role="dialog"
          aria-modal={placement === "overlay"}
          aria-labelledby={`${panelId}-title`}
        >
          <div className="quote-panel-head">
            <div>
              <h4 id={`${panelId}-title`} className="quote-panel-title">
                {copy.title}
              </h4>
              <p className="quote-panel-lead">{copy.lead}</p>
            </div>
            <button
              ref={closeRef}
              type="button"
              className="quote-panel-close"
              aria-label={copy.close}
              onClick={() => setOpen(false)}
            >
              ×
            </button>
          </div>
          <ul className="quote-panel-list">
            {channels.map((channel) => (
              <li key={channel.id}>
                <a
                  className="quote-panel-row"
                  href={channel.href}
                  aria-label={`${channel.aria}: ${channel.number}`}
                  {...(channel.external
                    ? { target: "_blank", rel: "noopener noreferrer" }
                    : {})}
                >
                  <span className="quote-panel-icon">{channel.icon}</span>
                  <span className="quote-panel-copy">
                    <span className="quote-panel-name">{channel.name}</span>
                    <span className="quote-panel-number">{channel.number}</span>
                  </span>
                </a>
              </li>
            ))}
          </ul>
        </div>
      ) : null}
    </div>
  );
}
