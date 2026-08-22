import { loadPlaceDetails } from "@/lib/booking/places-server";
import { isLocale } from "@/lib/i18n/config";

type DetailsBody = {
  placeId?: string;
  locale?: string;
  sessionToken?: string;
};

export async function POST(request: Request) {
  const body = (await request.json()) as DetailsBody;
  const placeId = body.placeId?.trim();
  if (!placeId) {
    return Response.json(null, { status: 400 });
  }

  const locale = body.locale && isLocale(body.locale) ? body.locale : "en";
  const sessionToken = body.sessionToken?.trim() || crypto.randomUUID();
  const details = await loadPlaceDetails({ placeId, locale, sessionToken });
  return Response.json(details);
}
