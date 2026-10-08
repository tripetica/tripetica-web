export function gpsClock(value: string | null) {
  if (!value) {
    return "—";
  }
  const utcMs = Date.parse(value);
  if (!Number.isFinite(utcMs)) {
    return "—";
  }
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone: "Europe/Istanbul",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
    hourCycle: "h23",
  }).formatToParts(new Date(utcMs));
  const part = (type: Intl.DateTimeFormatPartTypes) => parts.find((item) => item.type === type)?.value ?? "";
  return `${part("year")}-${part("month")}-${part("day")} ${part("hour")}:${part("minute")}:${part("second")}`;
}

export function atsHistoryClock(value: string | null) {
  if (!value) {
    return "—";
  }
  const utcMs = Date.parse(value);
  if (!Number.isFinite(utcMs)) {
    return "—";
  }
  const parts = new Intl.DateTimeFormat("en-GB", {
    timeZone: "Europe/Istanbul",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    hourCycle: "h23",
  }).formatToParts(new Date(utcMs));
  const part = (type: Intl.DateTimeFormatPartTypes) => parts.find((item) => item.type === type)?.value ?? "";
  return `${part("day")}.${part("month")}.${part("year")} ${part("hour")}:${part("minute")}`;
}

export function gpsSpeed(mps: number | null) {
  if (mps === null) {
    return "—";
  }
  return `${(mps * 3.6).toFixed(1)} km/h`;
}

export function gpsPopupClock(value: string | null) {
  if (!value) {
    return null;
  }
  const utcMs = Date.parse(value);
  if (!Number.isFinite(utcMs)) {
    return null;
  }
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone: "Europe/Istanbul",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
    hourCycle: "h23",
  }).formatToParts(new Date(utcMs));
  const part = (type: Intl.DateTimeFormatPartTypes) => parts.find((item) => item.type === type)?.value ?? "";
  const day = part("day");
  const month = part("month");
  const year = part("year");
  const hour = part("hour");
  const minute = part("minute");
  const second = part("second");
  if (!day || !month || !year || !hour || !minute || !second) {
    return null;
  }
  return `${day}.${month}.${year} ${hour}:${minute}:${second}`;
}

export function gpsPlaybackClock(utcMs: number) {
  if (!Number.isFinite(utcMs)) {
    return null;
  }
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone: "Europe/Istanbul",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
    hourCycle: "h23",
  }).formatToParts(new Date(utcMs));
  const part = (type: Intl.DateTimeFormatPartTypes) => parts.find((item) => item.type === type)?.value ?? "";
  const day = part("day");
  const month = part("month");
  const year = part("year");
  const hour = part("hour");
  const minute = part("minute");
  const second = part("second");
  if (!day || !month || !year || !hour || !minute || !second) {
    return null;
  }
  return { date: `${day}.${month}.${year}`, time: `${hour}:${minute}:${second}` };
}

export function gpsPopupSpeed(mps: number | null) {
  if (mps === null || !Number.isFinite(mps)) {
    return null;
  }
  return gpsSpeed(mps);
}

export function googleMapsUrl(latitude: number, longitude: number) {
  if (!gpsMapCoordinate(latitude, longitude)) {
    return null;
  }
  return `https://www.google.com/maps/search/?api=1&query=${latitude},${longitude}`;
}

export function yandexMapsUrl(latitude: number, longitude: number) {
  if (!gpsMapCoordinate(latitude, longitude)) {
    return null;
  }
  return `https://yandex.com/maps/?ll=${longitude},${latitude}&pt=${longitude},${latitude}&z=16&l=map`;
}

function gpsMapCoordinate(latitude: number, longitude: number) {
  return Number.isFinite(latitude)
    && Number.isFinite(longitude)
    && latitude >= -90
    && latitude <= 90
    && longitude >= -180
    && longitude <= 180;
}
