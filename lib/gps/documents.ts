export const VEHICLE_DOCUMENT_TYPES = [
  "ibb_route_permit",
  "inspection",
  "traffic_insurance",
  "casco",
  "seat_accident",
] as const;

export type VehicleDocumentType = (typeof VEHICLE_DOCUMENT_TYPES)[number];
export type DocumentWriteMode = "create" | "renew" | "edit";
export type DocumentStatus = "empty" | "valid" | "approaching" | "expired";
export type DocumentReminderClock = "10:00" | "14:00";
export type DocumentLocale = "tr" | "en" | "ru" | "ar";

const TYPE_SET = new Set<string>(VEHICLE_DOCUMENT_TYPES);
const DATE_RE = /^(\d{4})-(\d{2})-(\d{2})$/;

export type DocumentRecordState = {
  expiresOn: string;
  policyNumber: string | null;
  filePath: string | null;
  fileMime: string | null;
  fileName: string | null;
};

export type DocumentUploadState = {
  path: string;
  mime: string;
  name: string;
};

export function isVehicleDocumentType(value: string): value is VehicleDocumentType {
  return TYPE_SET.has(value);
}

export function istanbulDocumentDate(now = new Date()) {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: "Europe/Istanbul",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(now);
}

export function istanbulDocumentClock(now = new Date()) {
  const parts = new Intl.DateTimeFormat("en-GB", {
    timeZone: "Europe/Istanbul",
    hour: "2-digit",
    minute: "2-digit",
    hourCycle: "h23",
  }).formatToParts(now);
  const hour = Number(parts.find((part) => part.type === "hour")?.value);
  const minute = Number(parts.find((part) => part.type === "minute")?.value);
  return {
    hour: Number.isInteger(hour) ? hour : -1,
    minute: Number.isInteger(minute) ? minute : -1,
  };
}

export function parseDocumentDate(value: string) {
  const match = DATE_RE.exec(value.trim());
  if (!match) return null;
  const year = Number(match[1]);
  const month = Number(match[2]);
  const day = Number(match[3]);
  if (year < 2000 || year > 2100 || month < 1 || month > 12 || day < 1 || day > 31) return null;
  const utc = new Date(Date.UTC(year, month - 1, day));
  if (utc.getUTCFullYear() !== year || utc.getUTCMonth() !== month - 1 || utc.getUTCDate() !== day) return null;
  return `${match[1]}-${match[2]}-${match[3]}`;
}

export function documentDaysLeft(expiresOn: string, today: string) {
  const expiry = Date.parse(`${expiresOn}T00:00:00Z`);
  const current = Date.parse(`${today}T00:00:00Z`);
  return Math.round((expiry - current) / 86_400_000);
}

export function documentStatus(expiresOn: string | null, today: string): DocumentStatus {
  if (!expiresOn) return "empty";
  const days = documentDaysLeft(expiresOn, today);
  if (days < 0) return "expired";
  if (days <= 20) return "approaching";
  return "valid";
}

export function formatDocumentDate(iso: string) {
  const match = DATE_RE.exec(iso);
  if (!match) return iso;
  return `${match[3]}.${match[2]}.${match[1]}`;
}

export function cleanPolicyNumber(value: string) {
  const cleaned = value.replace(/[\u0000-\u001f\u007f]/g, " ").replace(/\s+/g, " ").trim();
  if (!cleaned) return null;
  return cleaned.slice(0, 80);
}

export function documentReminderClock(now: Date): DocumentReminderClock | null {
  const { hour, minute } = istanbulDocumentClock(now);
  if (minute < 0 || minute > 20) return null;
  if (hour === 10) return "10:00";
  if (hour === 14) return "14:00";
  return null;
}

export function documentReminderDue(daysLeft: number, clock: DocumentReminderClock) {
  if (daysLeft > 20) return false;
  if (daysLeft >= 8) return clock === "10:00";
  return clock === "10:00" || clock === "14:00";
}

export function documentReminderClaimKey(input: {
  documentId: string;
  expiresOn: string;
  notifyOn: string;
  clock: DocumentReminderClock;
  channel: "email" | "push";
  userId: string;
}) {
  return `${input.documentId}|${input.expiresOn}|${input.notifyOn}|${input.clock}|${input.channel}|${input.userId}`;
}

export function documentReminderAudience(rows: readonly { userId: string; email: string }[]) {
  const emails = new Set<string>();
  const userIds = new Set<string>();
  const emailTargets: { userId: string; email: string }[] = [];
  for (const row of rows) {
    const email = row.email.trim().toLowerCase();
    if (!row.userId || !email) continue;
    userIds.add(row.userId);
    if (emails.has(email)) continue;
    emails.add(email);
    emailTargets.push({ userId: row.userId, email });
  }
  return { emailTargets, userIds: [...userIds] };
}

export function nextDocumentRecord(input: {
  mode: DocumentWriteMode;
  existing: DocumentRecordState | null;
  expiresOn: string;
  policyNumber: string | null;
  upload: DocumentUploadState | null;
  removeFile: boolean;
}):
  | { ok: false; error: "exists" | "missing" }
  | {
    ok: true;
    expiresOn: string;
    policyNumber: string | null;
    filePath: string | null;
    fileMime: string | null;
    fileName: string | null;
    previousPath: string | null;
  } {
  if (input.mode === "create") {
    if (input.existing) return { ok: false, error: "exists" };
    return {
      ok: true,
      expiresOn: input.expiresOn,
      policyNumber: input.policyNumber,
      filePath: input.upload?.path ?? null,
      fileMime: input.upload?.mime ?? null,
      fileName: input.upload?.name ?? null,
      previousPath: null,
    };
  }
  if (!input.existing) return { ok: false, error: "missing" };
  const file = input.mode === "renew"
    ? input.upload
    : input.upload
      ? input.upload
      : input.removeFile
        ? null
        : input.existing.filePath
          ? { path: input.existing.filePath, mime: input.existing.fileMime ?? "", name: input.existing.fileName ?? "" }
          : null;
  const filePath = file?.path ?? null;
  return {
    ok: true,
    expiresOn: input.expiresOn,
    policyNumber: input.policyNumber,
    filePath,
    fileMime: file?.mime || null,
    fileName: file?.name || null,
    previousPath: input.existing.filePath && input.existing.filePath !== filePath ? input.existing.filePath : null,
  };
}

export function fileToDeleteAfterCommit(input: {
  previousPath: string | null;
  referencedByOther: boolean;
}) {
  if (!input.previousPath || input.referencedByOther) return null;
  return input.previousPath;
}

const NAMES: Record<DocumentLocale, Record<VehicleDocumentType, string>> = {
  tr: {
    ibb_route_permit: "İBB Yol Güzergâh İzin Belgesi",
    inspection: "Araç Muayenesi",
    traffic_insurance: "Zorunlu Trafik Sigortası",
    casco: "Kasko Sigortası",
    seat_accident: "Koltuk Ferdi Kaza Sigortası",
  },
  en: {
    ibb_route_permit: "IMM route permit",
    inspection: "Vehicle inspection",
    traffic_insurance: "Compulsory traffic insurance",
    casco: "Comprehensive insurance",
    seat_accident: "Passenger personal accident insurance",
  },
  ru: {
    ibb_route_permit: "Разрешение на маршрут IMM",
    inspection: "Техосмотр",
    traffic_insurance: "Обязательное страхование",
    casco: "Каско",
    seat_accident: "Страхование пассажиров от несчастного случая",
  },
  ar: {
    ibb_route_permit: "تصريح مسار بلدية إسطنبول",
    inspection: "فحص المركبة",
    traffic_insurance: "التأمين الإلزامي",
    casco: "التأمين الشامل",
    seat_accident: "تأمين الحوادث الشخصية للركاب",
  },
};

export function documentTypeName(type: VehicleDocumentType, locale: DocumentLocale) {
  return NAMES[locale][type];
}

export const documentCopy = {
  tr: {
    title: "Belge Takibi",
    pick: "Belge takibini görüntülemek için lütfen yukarıdaki canlı konum haritasından bir araç seçin.",
    add: "Belge Ekle",
    open: "Belgeyi Aç",
    renew: "Belgeyi Yenile",
    edit: "Düzenle",
    delete: "Sil",
    deleteAsk: "Bu belge silinsin mi? Kayıt ve dosya kaldırılır.",
    deleteFailed: "Belge silinemedi. Kayıt duruyor.",
    save: "Kaydet",
    saveRenew: "Yenilemeyi Kaydet",
    cancel: "Vazgeç",
    type: "Belge Türü",
    expires: "Son Geçerlilik Tarihi",
    previousExpires: "Mevcut son geçerlilik tarihi",
    policy: "Belge / Poliçe Numarası",
    file: "Belge Dosyası",
    filePick: "📎 Görsel / PDF Ekle",
    removeFile: "Mevcut dosyayı kaldır",
    days: "Kalan gün",
    empty: "Bilgi Girilmedi",
    valid: "Geçerli",
    approaching: "Süresi Yaklaşıyor",
    expired: "Süresi Dolmuş",
    fileHint: "PDF, JPG, PNG veya HEIC. İsteğe bağlı.",
    renewHint: "Yeni belge kaydedilince önceki dosya silinir. Dosya seçilmezse önceki dosya da kaldırılır.",
    loading: "Yükleniyor",
    forbidden: "Bu işlem için yetki yok.",
    invalid: "Bilgiler kaydedilemedi. Tarih ve belge türünü kontrol edin.",
    fileError: "Dosya kabul edilmedi. PDF, JPG, PNG veya HEIC yükleyin. En fazla 10 MB.",
    failed: "Kayıt kaydedilemedi. Mevcut belge duruyor.",
    exists: "Bu belge zaten kayıtlı.",
    missing: "Belge kaydı bulunamadı.",
    close: "Kapat",
    openTab: "Yeni sekmede aç",
  },
  en: {
    title: "Document tracking",
    pick: "Select a vehicle on the live map above to view its documents.",
    add: "Add document",
    open: "Open document",
    renew: "Renew document",
    edit: "Edit",
    delete: "Delete",
    deleteAsk: "Delete this document? The record and file will be removed.",
    deleteFailed: "The document could not be deleted. The record is unchanged.",
    save: "Save",
    saveRenew: "Save renewal",
    cancel: "Cancel",
    type: "Document type",
    expires: "Expiry date",
    previousExpires: "Current expiry date",
    policy: "Document / policy number",
    file: "Document file",
    filePick: "📎 Add image / PDF",
    removeFile: "Remove the current file",
    days: "Days left",
    empty: "Not entered",
    valid: "Valid",
    approaching: "Expiring soon",
    expired: "Expired",
    fileHint: "PDF, JPG, PNG, or HEIC. Optional.",
    renewHint: "Saving the renewal deletes the previous file. If no file is chosen, the previous file is removed.",
    loading: "Loading",
    forbidden: "You do not have permission for this action.",
    invalid: "The document could not be saved. Check the date and type.",
    fileError: "The file was rejected. Use PDF, JPG, PNG, or HEIC up to 10 MB.",
    failed: "The document was not saved. The current record is unchanged.",
    exists: "This document is already recorded.",
    missing: "The document record was not found.",
    close: "Close",
    openTab: "Open in a new tab",
  },
  ru: {
    title: "Документы",
    pick: "Выберите автомобиль на карте, чтобы посмотреть документы.",
    add: "Добавить документ",
    open: "Открыть документ",
    renew: "Обновить документ",
    edit: "Изменить",
    delete: "Удалить",
    deleteAsk: "Удалить этот документ? Запись и файл будут удалены.",
    deleteFailed: "Документ не удалён. Запись сохранена.",
    save: "Сохранить",
    saveRenew: "Сохранить обновление",
    cancel: "Отмена",
    type: "Вид документа",
    expires: "Дата окончания",
    previousExpires: "Текущая дата окончания",
    policy: "Номер документа / полиса",
    file: "Файл документа",
    filePick: "📎 Добавить изображение / PDF",
    removeFile: "Удалить текущий файл",
    days: "Осталось дней",
    empty: "Не заполнено",
    valid: "Действителен",
    approaching: "Срок истекает",
    expired: "Срок истёк",
    fileHint: "PDF, JPG, PNG или HEIC. Необязательно.",
    renewHint: "При обновлении прежний файл удаляется. Если новый файл не выбран, прежний файл тоже удаляется.",
    loading: "Загрузка",
    forbidden: "Недостаточно прав для этого действия.",
    invalid: "Документ не сохранён. Проверьте дату и вид.",
    fileError: "Файл отклонён. Допустимы PDF, JPG, PNG или HEIC до 10 МБ.",
    failed: "Документ не сохранён. Текущая запись не изменена.",
    exists: "Этот документ уже записан.",
    missing: "Запись документа не найдена.",
    close: "Закрыть",
    openTab: "Открыть в новой вкладке",
  },
  ar: {
    title: "تتبّع المستندات",
    pick: "اختر مركبة على الخريطة لعرض مستنداتها.",
    add: "إضافة مستند",
    open: "فتح المستند",
    renew: "تجديد المستند",
    edit: "تعديل",
    delete: "حذف",
    deleteAsk: "هل تريد حذف هذا المستند؟ ستُزال السجل والملف.",
    deleteFailed: "تعذر حذف المستند. السجل لم يتغير.",
    save: "حفظ",
    saveRenew: "حفظ التجديد",
    cancel: "إلغاء",
    type: "نوع المستند",
    expires: "تاريخ الانتهاء",
    previousExpires: "تاريخ الانتهاء الحالي",
    policy: "رقم المستند / الوثيقة",
    file: "ملف المستند",
    filePick: "📎 إضافة صورة / PDF",
    removeFile: "إزالة الملف الحالي",
    days: "الأيام المتبقية",
    empty: "لم تُدخل البيانات",
    valid: "ساري",
    approaching: "يقترب الانتهاء",
    expired: "منتهي",
    fileHint: "PDF أو JPG أو PNG أو HEIC. اختياري.",
    renewHint: "حفظ التجديد يحذف الملف السابق. إذا لم يُختر ملف، يُزال الملف السابق أيضًا.",
    loading: "جار التحميل",
    forbidden: "لا تملك صلاحية هذا الإجراء.",
    invalid: "تعذر حفظ المستند. تحقق من التاريخ والنوع.",
    fileError: "رُفض الملف. استخدم PDF أو JPG أو PNG أو HEIC حتى 10 ميغابايت.",
    failed: "لم يُحفظ المستند. السجل الحالي لم يتغير.",
    exists: "هذا المستند مسجل بالفعل.",
    missing: "سجل المستند غير موجود.",
    close: "إغلاق",
    openTab: "فتح في علامة جديدة",
  },
} as const;

export type DocumentCopy = {
  [K in keyof (typeof documentCopy)["tr"]]: string;
};

export function documentCopyFor(locale: string): DocumentCopy {
  if (locale === "en" || locale === "ru" || locale === "ar") return documentCopy[locale];
  return documentCopy.tr;
}

export function documentLocale(locale: string): DocumentLocale {
  if (locale === "en" || locale === "ru" || locale === "ar") return locale;
  return "tr";
}

export function documentStatusLabel(copy: DocumentCopy, status: DocumentStatus) {
  if (status === "valid") return copy.valid;
  if (status === "approaching") return copy.approaching;
  if (status === "expired") return copy.expired;
  return copy.empty;
}

export function documentReminderMessage(input: {
  plate: string;
  name: string;
  expiresOn: string;
  daysLeft: number;
  locale?: DocumentLocale;
}) {
  const plate = input.plate.trim() || "—";
  const date = formatDocumentDate(input.expiresOn);
  const locale = input.locale ?? "tr";
  if (locale === "en") {
    return {
      subject: `Document reminder: ${plate} · ${input.name}`,
      text: `${plate} · ${input.name}. Expiry ${date}. Days left: ${input.daysLeft}.`,
    };
  }
  if (locale === "ru") {
    return {
      subject: `Напоминание о документе: ${plate} · ${input.name}`,
      text: `${plate} · ${input.name}. Окончание ${date}. Осталось дней: ${input.daysLeft}.`,
    };
  }
  if (locale === "ar") {
    return {
      subject: `تذكير بالمستند: ${plate} · ${input.name}`,
      text: `${plate} · ${input.name}. تاريخ الانتهاء ${date}. الأيام المتبقية: ${input.daysLeft}.`,
    };
  }
  const state = input.daysLeft < 0 ? "Süresi Dolmuş" : "Süresi Yaklaşıyor";
  return {
    subject: `Belge hatırlatması: ${plate} · ${input.name}`,
    text: `${plate} plakalı aracın ${input.name} belgesi. Son geçerlilik ${date}. Kalan gün: ${input.daysLeft}. ${state}.`,
  };
}

export function escapeDocumentHtml(value: string) {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}
