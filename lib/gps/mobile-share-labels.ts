import { type Locale } from "@/lib/i18n/config";
import {
  SHARE_LABEL_START,
  SHARE_LABEL_STARTING,
  SHARE_LABEL_STOP,
  SHARE_NOTE_DENIED,
  SHARE_NOTE_FAILED,
  SHARE_NOTE_INTERRUPTED,
  SHARE_NOTE_OTHER,
} from "@/lib/gps/mobile-share-phase";

const shareText = {
  tr: {
    [SHARE_LABEL_START]: SHARE_LABEL_START,
    [SHARE_LABEL_STARTING]: SHARE_LABEL_STARTING,
    [SHARE_LABEL_STOP]: SHARE_LABEL_STOP,
    [SHARE_NOTE_INTERRUPTED]: SHARE_NOTE_INTERRUPTED,
    [SHARE_NOTE_DENIED]: SHARE_NOTE_DENIED,
    [SHARE_NOTE_FAILED]: SHARE_NOTE_FAILED,
    [SHARE_NOTE_OTHER]: SHARE_NOTE_OTHER,
    lastFix: "Son konum",
    accuracy: "Doğruluk",
    permissionNote: "Konum izni ayrıca istenir. Buton, sunucunun konumu kabul edip etmediğine göre güncellenir.",
  },
  en: {
    [SHARE_LABEL_START]: "Share location",
    [SHARE_LABEL_STARTING]: "Starting…",
    [SHARE_LABEL_STOP]: "Stop sharing location",
    [SHARE_NOTE_INTERRUPTED]: "Connection lost. Start again with Share location.",
    [SHARE_NOTE_DENIED]: "Location permission was denied.",
    [SHARE_NOTE_FAILED]: "Location sharing could not start.",
    [SHARE_NOTE_OTHER]: "Location sharing is open on another phone.",
    lastFix: "Last location",
    accuracy: "Accuracy",
    permissionNote: "Location permission is requested separately. The button updates when the server accepts the location.",
  },
  ru: {
    [SHARE_LABEL_START]: "Поделиться местоположением",
    [SHARE_LABEL_STARTING]: "Запуск…",
    [SHARE_LABEL_STOP]: "Остановить передачу",
    [SHARE_NOTE_INTERRUPTED]: "Связь прервана. Запустите снова через «Поделиться местоположением».",
    [SHARE_NOTE_DENIED]: "Доступ к геолокации отклонён.",
    [SHARE_NOTE_FAILED]: "Не удалось начать передачу местоположения.",
    [SHARE_NOTE_OTHER]: "Передача местоположения открыта на другом телефоне.",
    lastFix: "Последняя точка",
    accuracy: "Точность",
    permissionNote: "Разрешение на геолокацию запрашивается отдельно. Кнопка обновляется, когда сервер принимает точку.",
  },
  ar: {
    [SHARE_LABEL_START]: "مشاركة الموقع",
    [SHARE_LABEL_STARTING]: "جارٍ البدء…",
    [SHARE_LABEL_STOP]: "إيقاف مشاركة الموقع",
    [SHARE_NOTE_INTERRUPTED]: "انقطع الاتصال. أعد البدء من مشاركة الموقع.",
    [SHARE_NOTE_DENIED]: "تم رفض إذن الموقع.",
    [SHARE_NOTE_FAILED]: "تعذّر بدء مشاركة الموقع.",
    [SHARE_NOTE_OTHER]: "مشاركة الموقع مفتوحة على هاتف آخر.",
    lastFix: "آخر موقع",
    accuracy: "الدقة",
    permissionNote: "يُطلب إذن الموقع بشكل منفصل. يتحدّث الزر عندما يقبل الخادم الموقع.",
  },
} as const;

export function mobileShareLabel(locale: Locale, label: string) {
  const table = shareText[locale] as Record<string, string>;
  return table[label] ?? label;
}

export function mobileShareNote(locale: Locale, note: string | null) {
  if (!note) return null;
  const table = shareText[locale] as Record<string, string>;
  return table[note] ?? note;
}

export function mobileShareStatusCopy(locale: Locale) {
  return {
    lastFix: shareText[locale].lastFix,
    accuracy: shareText[locale].accuracy,
    permissionNote: shareText[locale].permissionNote,
  };
}
