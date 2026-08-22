import { searchPlaces } from "@/lib/booking/places-server";
import { isLocale } from "@/lib/i18n/config";

type AutocompleteBody = {
  query?: string;
  locale?: string;
  sessionToken?: string;
};

export async function POST(request: Request) {
  const body = (await request.json()) as AutocompleteBody;
  const query = body.query?.trim() ?? "";
  if (!query) {
    return Response.json({ suggestions: [], error: null });
  }

  const locale = body.locale && isLocale(body.locale) ? body.locale : "en";
  const sessionToken = body.sessionToken?.trim() || crypto.randomUUID();
  const result = await searchPlaces({ query, locale, sessionToken });
  return Response.json(result);
}
