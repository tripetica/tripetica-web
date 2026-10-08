import { type GpsPoint } from "@/lib/gps/contract";

export function chooseLivePoint(points: GpsPoint[]) {
  let chosen: GpsPoint | null = null;
  for (const point of points) {
    if (!chosen || isNewerFix(point, chosen)) {
      chosen = point;
    }
  }
  return chosen;
}

function isNewerFix(candidate: GpsPoint, current: GpsPoint) {
  const delta = candidate.gnssTime.getTime() - current.gnssTime.getTime();
  return delta > 0 || (delta === 0 && candidate.seq > current.seq);
}
