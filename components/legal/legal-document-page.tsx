import Link from "next/link";
import { SiteHeader } from "@/components/site-header";
import { type Locale } from "@/lib/i18n/config";
import { localizedPath } from "@/lib/i18n/path";
import { legalNavLabels, legalPath, type LegalSlug } from "@/lib/legal/catalog";
import {
  legalDocuments,
  type LegalTextPart,
} from "@/lib/legal/copy";

type LegalDocumentPageProps = {
  locale: Locale;
  slug: LegalSlug;
};

function LegalParagraph({
  locale,
  content,
}: {
  locale: Locale;
  content: string | LegalTextPart[];
}) {
  if (typeof content === "string") {
    return <p className="service-prose">{content}</p>;
  }

  return (
    <p className="service-prose">
      {content.map((part, index) =>
        typeof part === "string" ? (
          <span key={index}>{part}</span>
        ) : (
          <Link
            key={index}
            href={localizedPath(locale, legalPath(part.slug))}
            className="service-inline-link"
          >
            {part.label}
          </Link>
        ),
      )}
    </p>
  );
}

export function LegalDocumentPage({ locale, slug }: LegalDocumentPageProps) {
  const copy = legalDocuments[locale][slug];
  const title = legalNavLabels[locale][slug];

  return (
    <main className="legal-page light-theme-page">
      <SiteHeader
        locale={locale}
        pathWithoutLocale={legalPath(slug)}
        variant="service"
      />
      <article className="legal-body">
        <p className="service-kicker">{title}</p>
        <h1 className="service-h1">{copy.h1}</h1>
        {copy.updated ? <p className="legal-updated">{copy.updated}</p> : null}
        {copy.sections.map((section, sectionIndex) => (
          <section
            key={section.title ?? `legal-section-${sectionIndex}`}
            className="legal-section"
          >
            {section.title ? (
              <h2 className="service-h2">{section.title}</h2>
            ) : null}
            {section.paragraphs.map((paragraph, paragraphIndex) => (
              <LegalParagraph
                key={paragraphIndex}
                locale={locale}
                content={paragraph}
              />
            ))}
            {section.bullets ? (
              <ul className="legal-list">
                {section.bullets.map((item) => (
                  <li key={item}>{item}</li>
                ))}
              </ul>
            ) : null}
            {section.afterBullets?.map((paragraph, paragraphIndex) => (
              <LegalParagraph
                key={`after-${paragraphIndex}`}
                locale={locale}
                content={paragraph}
              />
            ))}
          </section>
        ))}
      </article>
    </main>
  );
}
