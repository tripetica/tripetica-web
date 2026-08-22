"use client";

import {
  useEffect,
  useId,
  useRef,
  useState,
  type CSSProperties,
  type ReactNode,
} from "react";
import { contactLauncherCopy } from "@/lib/contact/copy";
import { contactLinks } from "@/lib/contact/links";
import { type Locale } from "@/lib/i18n/config";

type ContactLauncherProps = {
  locale: Locale;
};

type ContactAction = {
  id: "phone" | "whatsapp" | "telegram" | "viber";
  href: string;
  label: string;
  tooltip: string;
  external: boolean;
  icon: ReactNode;
};

function bindPressFeedback(element: HTMLElement, pressed: boolean) {
  if (pressed) {
    element.setAttribute("data-pressed", "true");
  } else {
    element.removeAttribute("data-pressed");
  }
}

export function ContactLauncher({ locale }: ContactLauncherProps) {
  const copy = contactLauncherCopy[locale];
  const [open, setOpen] = useState(false);
  const [actionsLive, setActionsLive] = useState(false);
  const rootRef = useRef<HTMLDivElement>(null);
  const liveTimerRef = useRef(0);
  const menuId = useId();

  const actions: ContactAction[] = [
    {
      id: "phone",
      href: contactLinks.phone,
      label: copy.phone,
      tooltip: copy.phoneTooltip,
      external: false,
      icon: <PhoneIcon />,
    },
    {
      id: "viber",
      href: contactLinks.viber,
      label: copy.viber,
      tooltip: copy.viber,
      external: false,
      icon: <ViberIcon />,
    },
    {
      id: "telegram",
      href: contactLinks.telegram,
      label: copy.telegram,
      tooltip: copy.telegram,
      external: true,
      icon: <TelegramIcon />,
    },
    {
      id: "whatsapp",
      href: contactLinks.whatsapp,
      label: copy.whatsapp,
      tooltip: copy.whatsapp,
      external: true,
      icon: <WhatsAppIcon />,
    },
  ];

  useEffect(() => {
    return () => window.clearTimeout(liveTimerRef.current);
  }, []);

  useEffect(() => {
    if (!open) {
      return;
    }

    function onKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape") {
        closeLauncher();
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
      closeLauncher();
    }

    document.addEventListener("keydown", onKeyDown);

    const outsideTimer = window.setTimeout(() => {
      document.addEventListener("click", onOutside);
    }, 0);

    return () => {
      window.clearTimeout(outsideTimer);
      document.removeEventListener("keydown", onKeyDown);
      document.removeEventListener("click", onOutside);
    };
  }, [open]);

  function closeLauncher() {
    window.clearTimeout(liveTimerRef.current);
    setOpen(false);
    setActionsLive(false);
  }

  function openLauncher() {
    window.clearTimeout(liveTimerRef.current);
    setOpen(true);
    liveTimerRef.current = window.setTimeout(() => {
      setActionsLive(true);
    }, 180);
  }

  function toggleOpen() {
    if (open) {
      closeLauncher();
      return;
    }
    openLauncher();
  }

  return (
    <div
      ref={rootRef}
      className={`contact-launcher ${open ? "is-open" : ""}`}
    >
      <div className="contact-launcher-cluster">
        <button
          type="button"
          className="contact-launcher-main liquid-lens glass-surface"
          aria-label={copy.launcher}
          aria-expanded={open}
          aria-controls={menuId}
          aria-haspopup="true"
          onPointerDown={(event) => bindPressFeedback(event.currentTarget, true)}
          onPointerUp={(event) => bindPressFeedback(event.currentTarget, false)}
          onPointerCancel={(event) =>
            bindPressFeedback(event.currentTarget, false)
          }
          onPointerLeave={(event) =>
            bindPressFeedback(event.currentTarget, false)
          }
          onClick={() => toggleOpen()}
        >
          <ChatIcon />
        </button>
        <ul
          id={menuId}
          className={`contact-launcher-list ${open ? "is-open" : ""} ${
            actionsLive ? "is-live" : ""
          }`}
          aria-hidden={!open}
          inert={!open}
        >
          {actions.map((action, index) => (
            <li
              key={action.id}
              className="contact-launcher-item"
              style={{ "--contact-i": index } as CSSProperties}
            >
              <a
                className="contact-launcher-action liquid-lens glass-surface"
                href={action.href}
                aria-label={action.label}
                {...(action.external
                  ? { target: "_blank", rel: "noopener noreferrer" }
                  : {})}
                onPointerDown={(event) =>
                  bindPressFeedback(event.currentTarget, true)
                }
                onPointerUp={(event) =>
                  bindPressFeedback(event.currentTarget, false)
                }
                onPointerCancel={(event) =>
                  bindPressFeedback(event.currentTarget, false)
                }
                onPointerLeave={(event) =>
                  bindPressFeedback(event.currentTarget, false)
                }
                onClick={() => closeLauncher()}
              >
                {action.icon}
                <span className="contact-launcher-tip">{action.tooltip}</span>
              </a>
            </li>
          ))}
        </ul>
      </div>
    </div>
  );
}

function ChatIcon() {
  return (
    <svg
      aria-hidden="true"
      viewBox="0 0 24 24"
      className="contact-launcher-glyph"
      fill="currentColor"
    >
      <path d="M5.2 4.2h13.6c1.2 0 2.2 1 2.2 2.2v8.4c0 1.2-1 2.2-2.2 2.2H9.1L4 20.8V6.4c0-1.2 1-2.2 2.2-2.2Zm2.4 4.3v1.7h8.8V8.5H7.6Zm0 3.3v1.7h6.2v-1.7H7.6Z" />
    </svg>
  );
}

function PhoneIcon() {
  return (
    <svg
      aria-hidden="true"
      viewBox="0 0 24 24"
      className="contact-launcher-glyph contact-launcher-phone"
      fill="currentColor"
    >
      <path d="M6.7 10.9c1.5 2.9 3.9 5.3 6.8 6.8l2.2-2.2c.3-.3.8-.4 1.2-.2 1.1.4 2.3.6 3.5.6.6 0 1 .4 1 1V21c0 .6-.4 1-1 1C10.7 22 2 13.3 2 2.6 2 2 2.4 1.6 3 1.6h3.6c.6 0 1 .4 1 1 0 1.2.2 2.4.6 3.5.1.4 0 .8-.3 1.1l-2.2 2.2Z" />
    </svg>
  );
}

function WhatsAppIcon() {
  return (
    <svg
      aria-hidden="true"
      viewBox="0 0 24 24"
      className="contact-launcher-glyph contact-launcher-whatsapp"
      fill="currentColor"
    >
      <path d="M17.47 14.38c-.3-.15-1.76-.87-2.03-.97-.27-.1-.47-.15-.67.15-.2.3-.77.97-.94 1.17-.17.2-.35.22-.64.07-.3-.15-1.26-.46-2.4-1.47-.88-.79-1.48-1.76-1.65-2.06-.17-.3-.02-.46.13-.6.13-.14.3-.35.45-.52.14-.18.2-.3.3-.5.1-.2.05-.37-.02-.52-.08-.15-.67-1.61-.92-2.21-.24-.58-.49-.5-.67-.51h-.57c-.2 0-.52.07-.79.37-.27.3-1.04 1.02-1.04 2.48s1.06 2.88 1.21 3.08c.15.2 2.1 3.2 5.08 4.48.71.31 1.26.49 1.69.63.71.23 1.36.2 1.87.12.57-.08 1.76-.72 2.01-1.41.25-.7.25-1.29.17-1.41-.07-.13-.27-.2-.57-.35Zm-5.42 7.4h-.01a9.87 9.87 0 0 1-5.03-1.38l-.36-.21-3.74.98 1-3.65-.24-.37A9.86 9.86 0 0 1 2.16 11.9C2.16 6.45 6.6 2.01 12.05 2.01c2.64 0 5.12 1.03 6.99 2.9a9.82 9.82 0 0 1 2.89 6.99c0 5.45-4.43 9.88-9.88 9.88Zm8.41-18.3A11.81 11.81 0 0 0 12.05 0C5.5 0 .16 5.33.16 11.89c0 2.1.55 4.14 1.59 5.95L0 24l6.3-1.65a11.88 11.88 0 0 0 5.69 1.45h.01c6.55 0 11.89-5.34 11.89-11.9 0-3.18-1.24-6.17-3.48-8.41Z" />
    </svg>
  );
}

function TelegramIcon() {
  return (
    <svg
      aria-hidden="true"
      viewBox="0 0 24 24"
      className="contact-launcher-glyph contact-launcher-telegram"
      fill="currentColor"
    >
      <path d="M11.94 0A12 12 0 0 0 0 12a12 12 0 0 0 12 12 12 12 0 0 0 12-12A12 12 0 0 0 12 0h-.06Zm4.97 7.22c.1 0 .32.03.46.14.14.1.2.25.17.33.02.09.04.3.02.47-.18 1.9-.96 6.5-1.36 8.63-.17.9-.5 1.2-.82 1.23-.7.06-1.23-.46-1.9-.9-1.06-.7-1.65-1.13-2.68-1.8-1.18-.78-.41-1.21.26-1.91.18-.18 3.25-2.98 3.31-3.23 0-.03.01-.15-.06-.21-.07-.07-.17-.04-.25-.03-.1.03-1.79 1.14-5.06 3.35-.48.33-.91.49-1.3.48-.43 0-1.25-.24-1.87-.44-.75-.24-1.35-.37-1.29-.79.02-.21.32-.43.89-.66 3.5-1.52 5.83-2.53 7-3.01 3.33-1.39 4.02-1.63 4.47-1.64Z" />
    </svg>
  );
}

function ViberIcon() {
  return (
    <svg
      aria-hidden="true"
      viewBox="0 0 24 24"
      className="contact-launcher-glyph"
    >
      <path
        fill="#7360f2"
        d="M7.05 2.4h9.9c2.45 0 4.45 2 4.45 4.45v7.55c0 2.45-2 4.45-4.45 4.45h-2.05L12 21.7l-2.9-2.85H7.05c-2.45 0-4.45-2-4.45-4.45V6.85c0-2.45 2-4.45 4.45-4.45Z"
      />
      <path
        fill="#f5f1ea"
        d="M8.85 8.35c.28-.28.74-.28 1.02 0l.92.92c.28.28.28.74 0 1.02l-.38.38c.72 1.02 1.68 1.86 2.8 2.42l.38-.38c.28-.28.74-.28 1.02 0l.92.92c.28.28.28.74 0 1.02-.72.72-1.78 1-2.78.62-1.5-.58-2.76-1.76-3.4-3.22-.4-1.02-.18-2.14.56-2.88ZM13.55 7.2c.18-.34.6-.46.94-.28.86.44 1.54 1.12 1.98 1.98.18.34.06.76-.28.94-.34.18-.76.06-.94-.28-.28-.54-.7-.96-1.24-1.24-.34-.18-.46-.6-.28-.94Zm.92-1.55c.2-.36.64-.48 1-.28 1.22.64 2.18 1.6 2.82 2.82.2.36.08.8-.28 1-.36.2-.8.08-1-.28-.5-.96-1.28-1.74-2.24-2.24-.36-.2-.48-.64-.28-1Z"
      />
    </svg>
  );
}
