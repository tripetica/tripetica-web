"use client";

import {
  createContext,
  useContext,
  useEffect,
  useId,
  useRef,
  useState,
  type ReactNode,
  type RefObject,
} from "react";
import { createPortal } from "react-dom";
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

type QuoteChannel = {
  id: string;
  href: string;
  name: string;
  number: string;
  aria: string;
  icon: ReactNode;
  external: boolean;
};

function quoteChannels(locale: Locale): QuoteChannel[] {
  const copy = quotePanelCopy[locale];
  return [
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
}

function QuotePanelFields({
  locale,
  panelId,
  closeRef,
  onClose,
}: {
  locale: Locale;
  panelId: string;
  closeRef: RefObject<HTMLButtonElement | null>;
  onClose: () => void;
}) {
  const copy = quotePanelCopy[locale];
  const channels = quoteChannels(locale);

  return (
    <>
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
          onClick={onClose}
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
    </>
  );
}

type QuoteRequestContextValue = {
  open: boolean;
  setOpen: (open: boolean) => void;
};

const QuoteRequestContext = createContext<QuoteRequestContextValue | null>(null);

export function QuoteRequestScope({
  locale,
  children,
}: {
  locale: Locale;
  children: ReactNode;
}) {
  const [open, setOpen] = useState(false);
  const closeRef = useRef<HTMLButtonElement>(null);
  const panelRef = useRef<HTMLDivElement>(null);
  const lastFocusRef = useRef<HTMLElement | null>(null);
  const panelId = useId();
  const copy = quotePanelCopy[locale];

  useEffect(() => {
    if (!open) {
      return;
    }

    lastFocusRef.current =
      document.activeElement instanceof HTMLElement
        ? document.activeElement
        : null;
    closeRef.current?.focus();
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";

    function focusables() {
      const root = panelRef.current;
      if (!root) {
        return [];
      }
      return Array.from(
        root.querySelectorAll<HTMLElement>(
          'a[href], button:not([disabled]), textarea, input, select, [tabindex]:not([tabindex="-1"])',
        ),
      ).filter((node) => !node.hasAttribute("disabled"));
    }

    function onKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape") {
        event.preventDefault();
        setOpen(false);
        return;
      }
      if (event.key !== "Tab") {
        return;
      }
      const nodes = focusables();
      if (nodes.length === 0) {
        return;
      }
      const first = nodes[0];
      const last = nodes[nodes.length - 1];
      if (event.shiftKey && document.activeElement === first) {
        event.preventDefault();
        last.focus();
      } else if (!event.shiftKey && document.activeElement === last) {
        event.preventDefault();
        first.focus();
      }
    }

    document.addEventListener("keydown", onKeyDown);
    return () => {
      document.removeEventListener("keydown", onKeyDown);
      document.body.style.overflow = previousOverflow;
      lastFocusRef.current?.focus();
    };
  }, [open]);

  const portal =
    open
      ? createPortal(
          <div
            className="quote-modal-overlay"
            onMouseDown={(event) => {
              if (event.target === event.currentTarget) {
                setOpen(false);
              }
            }}
          >
            <div className="light-theme">
              <div
                ref={panelRef}
                id={panelId}
                className="quote-panel quote-panel--modal"
                role="dialog"
                aria-modal="true"
                aria-labelledby={`${panelId}-title`}
                aria-label={copy.title}
              >
                <QuotePanelFields
                  locale={locale}
                  panelId={panelId}
                  closeRef={closeRef}
                  onClose={() => setOpen(false)}
                />
              </div>
            </div>
          </div>,
          document.getElementById("portal-root") ?? document.body,
        )
      : null;

  return (
    <QuoteRequestContext.Provider value={{ open, setOpen }}>
      {children}
      {portal}
    </QuoteRequestContext.Provider>
  );
}

export function QuoteRequestButton({
  label,
  className,
}: {
  label: string;
  className: string;
}) {
  const context = useContext(QuoteRequestContext);
  if (!context) {
    throw new Error("QuoteRequestButton must be used inside QuoteRequestScope");
  }

  return (
    <button
      type="button"
      className={className}
      aria-haspopup="dialog"
      aria-expanded={context.open}
      onClick={() => context.setOpen(true)}
    >
      {label}
    </button>
  );
}

export function QuoteRequestPanel({
  locale,
  label,
  className,
  placement = "overlay",
}: QuoteRequestPanelProps) {
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
          <QuotePanelFields
            locale={locale}
            panelId={panelId}
            closeRef={closeRef}
            onClose={() => setOpen(false)}
          />
        </div>
      ) : null}
    </div>
  );
}
