import { getIstanbulClock } from "@/lib/booking/istanbul-time";

export const dynamic = "force-dynamic";

export function GET() {
  return Response.json(getIstanbulClock());
}
