import Link from "next/link";
import {
  MailIcon,
  PhoneIcon,
  TelegramIcon,
  ViberIcon,
  WhatsAppIcon,
} from "@/components/contact-channel-icons";
import {
  contactDisplayNumbers,
  contactLinks,
  contactSectionId,
  tripeticaEmail,
  tripeticaTelegramUsername,
} from "@/lib/contact/links";
import { footerCopy } from "@/lib/footer/copy";
import { type Locale } from "@/lib/i18n/config";
import { localizedPath } from "@/lib/i18n/path";
import { legalNavLabels, legalPath, legalSlugs } from "@/lib/legal/catalog";

type SiteFooterProps = {
  locale: Locale;
};

export function SiteFooter({ locale }: SiteFooterProps) {
  const copy = footerCopy[locale];
  const legalLabels = legalNavLabels[locale];

  const channels = [
    {
      id: "phone",
      href: contactLinks.phone,
      name: copy.phone,
      value: contactDisplayNumbers.phone,
      aria: copy.phoneAria,
      icon: <PhoneIcon />,
      external: false,
    },
    {
      id: "whatsapp",
      href: contactLinks.whatsapp,
      name: copy.whatsapp,
      value: contactDisplayNumbers.messaging,
      aria: copy.whatsappAria,
      icon: <WhatsAppIcon />,
      external: true,
    },
    {
      id: "telegram",
      href: contactLinks.telegram,
      name: copy.telegram,
      value: `@${tripeticaTelegramUsername}`,
      aria: copy.telegramAria,
      icon: <TelegramIcon />,
      external: true,
    },
    {
      id: "viber",
      href: contactLinks.viber,
      name: copy.viber,
      value: contactDisplayNumbers.messaging,
      aria: copy.viberAria,
      icon: <ViberIcon />,
      external: false,
    },
    {
      id: "email",
      href: contactLinks.email,
      name: copy.email,
      value: tripeticaEmail,
      aria: copy.emailAria,
      icon: <MailIcon />,
      external: false,
    },
  ];

  return (
    <footer className="site-footer">
      <div className="site-footer-inner">
        <div className="site-footer-grid">
          <div className="site-footer-brand-col">
            <section className="site-footer-brand" aria-labelledby="site-footer-brand-heading">
              <h2 id="site-footer-brand-heading" className="site-footer-heading">
                Tripetica
              </h2>
              <p className="site-footer-lead">{copy.brandLead}</p>
              <p className="site-footer-assurance">{copy.assurance}</p>
            </section>

            <div className="site-footer-meta">
              <p>{copy.tursab}</p>
              <p>{copy.d2}</p>
            </div>
          </div>

          <section
            id={contactSectionId}
            className="site-footer-contact"
            aria-labelledby="site-footer-contact-heading"
          >
            <h2 id="site-footer-contact-heading" className="site-footer-heading">
              {copy.contactTitle}
            </h2>
            <ul className="site-footer-channels">
              {channels.map((channel) => (
                <li key={channel.id}>
                  <a
                    className="site-footer-channel"
                    href={channel.href}
                    aria-label={`${channel.aria}: ${channel.value}`}
                    {...(channel.external
                      ? { target: "_blank", rel: "noopener noreferrer" }
                      : {})}
                  >
                    <span className="site-footer-icon">{channel.icon}</span>
                    <span className="site-footer-channel-copy">
                      <span className="site-footer-channel-name">{channel.name}</span>
                      <span className="site-footer-channel-value">{channel.value}</span>
                    </span>
                  </a>
                </li>
              ))}
            </ul>
          </section>

          <nav
            className="site-footer-legal"
            aria-labelledby="site-footer-legal-heading"
          >
            <h2 id="site-footer-legal-heading" className="site-footer-heading">
              {copy.legalTitle}
            </h2>
            <ul className="site-footer-legal-list">
              {legalSlugs.map((slug) => (
                <li key={slug}>
                  <Link
                    href={localizedPath(locale, legalPath(slug))}
                    className="site-footer-legal-link"
                  >
                    {legalLabels[slug]}
                  </Link>
                </li>
              ))}
            </ul>
          </nav>
        </div>

        <p className="site-footer-copyright">{copy.copyright}</p>
      </div>
    </footer>
  );
}
