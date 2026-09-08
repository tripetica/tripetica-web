"use client";

import {
  useEffect,
  useId,
  useRef,
  type ReactNode,
} from "react";
import { createPortal } from "react-dom";
import {
  PhoneIcon,
  TelegramIcon,
  ViberIcon,
  WhatsAppIcon,
} from "@/components/contact-channel-icons";
import {
  contactChannelsForLocale,
  type ContactChannelId,
} from "@/lib/contact/channels";
import { quotePanelCopy } from "@/lib/contact/quote-copy";
import { type Locale } from "@/lib/i18n/config";

type ContactChannelsModalProps = {
  locale: Locale;
  open: boolean;
  onClose: () => void;
  ariaLabel: string;
};

const channelIcons: Record<ContactChannelId, ReactNode> = {
  whatsapp: <WhatsAppIcon />,
  telegram: <TelegramIcon />,
  viber: <ViberIcon />,
  phone: <PhoneIcon />,
};

export function ContactChannelsModal({
  locale,
  open,
  onClose,
  ariaLabel,
}: ContactChannelsModalProps) {
  const closeRef = useRef<HTMLButtonElement>(null);
  const panelRef = useRef<HTMLDivElement>(null);
  const lastFocusRef = useRef<HTMLElement | null>(null);
  const onCloseRef = useRef(onClose);
  const panelId = useId();
  const copy = quotePanelCopy[locale];
  const channels = contactChannelsForLocale(locale);

  useEffect(() => {
    onCloseRef.current = onClose;
  }, [onClose]);

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
        onCloseRef.current();
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

  if (!open || typeof document === "undefined") {
    return null;
  }

  return createPortal(
    <div
      className="quote-modal-overlay"
      onMouseDown={(event) => {
        if (event.target === event.currentTarget) {
          onClose();
        }
      }}
    >
      <div className="light-theme">
        <div
          ref={panelRef}
          id={panelId}
          className="quote-panel quote-panel--modal quote-panel--channels-only"
          role="dialog"
          aria-modal="true"
          aria-label={ariaLabel}
        >
          <div className="quote-panel-head quote-panel-head--channels-only">
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
                  <span className="quote-panel-icon">{channelIcons[channel.id]}</span>
                  <span className="quote-panel-copy">
                    <span className="quote-panel-name">{channel.name}</span>
                    <span className="quote-panel-number">{channel.number}</span>
                  </span>
                </a>
              </li>
            ))}
          </ul>
        </div>
      </div>
    </div>,
    document.getElementById("portal-root") ?? document.body,
  );
}
