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
import { CONTACT_LAUNCHER_OPEN_EVENT } from "@/lib/contact/events";
import { contactLinks } from "@/lib/contact/links";
import { type Locale } from "@/lib/i18n/config";
import {
  PhoneIcon,
  TelegramIcon,
  ViberIcon,
  WhatsAppIcon,
} from "@/components/contact-channel-icons";

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

  useEffect(() => {
    function onOpenRequest() {
      openLauncher();
    }
    window.addEventListener(CONTACT_LAUNCHER_OPEN_EVENT, onOpenRequest);
    return () => {
      window.removeEventListener(CONTACT_LAUNCHER_OPEN_EVENT, onOpenRequest);
    };
  }, []);

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

