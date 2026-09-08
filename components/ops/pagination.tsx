import { type Locale } from "@/lib/i18n/config";
import { localizedPath } from "@/lib/i18n/path";
import { type OpsCopy } from "@/lib/ops/copy";
import { pageCount } from "@/lib/ops/format";

type OpsPaginationProps = {
  locale: Locale;
  copy: OpsCopy;
  pathWithoutLocale: string;
  page: number;
  total: number;
  pageSize: number;
  query: Record<string, string>;
};

export function OpsPagination({
  locale,
  copy,
  pathWithoutLocale,
  page,
  total,
  pageSize,
  query,
}: OpsPaginationProps) {
  const pages = pageCount(total, pageSize);
  if (total === 0) {
    return null;
  }

  function href(next: number) {
    const params = new URLSearchParams(
      Object.entries(query).filter(([, value]) => value.length > 0),
    );
    params.set("page", String(next));
    return `${localizedPath(locale, pathWithoutLocale)}?${params.toString()}`;
  }

  return (
    <div className="ops-pagination">
      <span>
        {copy.page} {page} {copy.of} {pages}
      </span>
      {page > 1 ? <a href={href(page - 1)}>{copy.previous}</a> : <span />}
      {page < pages ? <a href={href(page + 1)}>{copy.next}</a> : <span />}
    </div>
  );
}
