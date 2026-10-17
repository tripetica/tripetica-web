import { parsePhoneNumberFromString } from "libphonenumber-js";
import {
  formatMaintenanceDate,
  type MaintenanceLine,
  type MaintenanceLocale,
} from "@/lib/gps/maintenance";

export type MaintenanceMailInput = {
  locale: MaintenanceLocale;
  line: MaintenanceLine;
  thresholdKm: number;
  plate: string;
  brand: string | null;
  model: string | null;
  driverName: string | null;
  driverPhone: string | null;
  estimatedKm: number;
  lastServiceKm: number;
  lastServiceOn: string;
  intervalKm: number;
  nextServiceKm: number;
  remainingKm: number;
};

export type MaintenancePhoneLink = {
  display: string;
  href: string | null;
};

export function maintenancePhoneLink(raw: string | null | undefined): MaintenancePhoneLink | null {
  const value = raw?.trim() ?? "";
  if (!value) return null;
  const parsed = parsePhoneNumberFromString(value) ?? parsePhoneNumberFromString(value, "TR");
  if (!parsed?.isValid()) return { display: value, href: null };
  const href = parsed.getURI();
  if (!/^tel:\+\d{8,15}$/.test(href)) return { display: parsed.formatInternational(), href: null };
  return { display: parsed.formatInternational(), href };
}

function escapeHtml(value: string) {
  return value
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;");
}

function vehicleLabel(brand: string | null, model: string | null) {
  const parts = [brand?.trim(), model?.trim()].filter((part): part is string => Boolean(part));
  return parts.length > 0 ? parts.join(" / ") : null;
}

function km(value: number) {
  return `${value} km`;
}

export type MaintenanceDriverNoticeInput = {
  locale: MaintenanceLocale;
  line: MaintenanceLine;
  plate: string;
  firstName: string | null;
  estimatedKm: number;
  lastServiceKm: number;
  nextServiceKm: number;
  remainingKm: number;
};

function driverKm(value: number) {
  return `${new Intl.NumberFormat("tr-TR").format(value)} km`;
}

function driverGreeting(locale: MaintenanceLocale, firstName: string | null) {
  const name = firstName?.trim() ?? "";
  if (!name) {
    if (locale === "en") return "Hello,";
    if (locale === "ru") return "Здравствуйте,";
    return "Merhaba,";
  }
  if (locale === "en") return `Hello ${name},`;
  if (locale === "ru") return `Здравствуйте, ${name},`;
  return `Merhaba ${name} Bey,`;
}

export function maintenanceDriverNotice(input: MaintenanceDriverNoticeInput) {
  const plate = input.plate.trim() || "—";
  const estimated = driverKm(input.estimatedKm);
  const lastService = driverKm(input.lastServiceKm);
  const nextService = driverKm(input.nextServiceKm);
  const overdueKm = input.remainingKm < 0 ? -input.remainingKm : 0;
  const remaining = driverKm(input.line === "overdue" ? overdueKm : input.remainingKm);
  const greeting = driverGreeting(input.locale, input.firstName);
  if (input.locale === "en") {
    if (input.line === "overdue") {
      const title = "⚠️ Vehicle service is overdue";
      const body = [
        `The scheduled service mileage for ${plate} is ${remaining} overdue.`,
        `Estimated current mileage: ${estimated}`,
        `Planned service: ${nextService}`,
        "If the service is done, report it with Service completed. If it is not, please plan it as soon as possible.",
      ].join("\n");
      const subject = `Vehicle service is overdue – ${plate}`;
      const text = [
        greeting,
        "",
        `The scheduled service mileage for ${plate}, which is assigned to you, has been passed.`,
        "",
        `Plate: ${plate}`,
        `Estimated current mileage: ${estimated}`,
        `Last service mileage: ${lastService}`,
        `Planned service mileage: ${nextService}`,
        `Service overdue: ${remaining}`,
        "",
        "The service has not been reported as completed.",
        "If it has not been done, contact the partner and have it planned.",
        "If it has been done, report it from the Tripetica Driver Panel with Service completed.",
        "",
        "Tripetica Vehicle Service Tracking",
      ].join("\n");
      return { title, body, subject, text, html: driverMailHtml(text) };
    }
    const title = "🔧 Vehicle service reminder";
    const body = [
      input.line === "due"
        ? `The scheduled service mileage for ${plate} has been reached.`
        : `${remaining} remain before the scheduled service for ${plate}.`,
      `Estimated current mileage: ${estimated}`,
      `Next service: ${nextService}`,
      "Please plan your vehicle's service.",
    ].join("\n");
    const subject = `Vehicle service reminder – ${plate}`;
    const text = [
      greeting,
      "",
      input.line === "due"
        ? `The scheduled service mileage for ${plate}, which is assigned to you, has been reached.`
        : `The scheduled service for ${plate}, which is assigned to you, is approaching.`,
      "",
      `Plate: ${plate}`,
      `Estimated current mileage: ${estimated}`,
      `Last service mileage: ${lastService}`,
      `Next service mileage: ${nextService}`,
      `Remaining: ${remaining}`,
      "",
      "Please plan the service on time.",
      "",
      "When the service is complete, report it from the Tripetica Driver Panel with Service completed.",
      "",
      "Tripetica Vehicle Service Tracking",
    ].join("\n");
    return { title, body, subject, text, html: driverMailHtml(text) };
  }
  if (input.locale === "ru") {
    if (input.line === "overdue") {
      const title = "⚠️ Обслуживание автомобиля просрочено";
      const body = [
        `Плановый пробег обслуживания ${plate} превышен на ${remaining}.`,
        `Оценочный текущий пробег: ${estimated}`,
        `Плановое обслуживание: ${nextService}`,
        "Если обслуживание выполнено, сообщите через «Обслуживание выполнено». Если нет, запланируйте его как можно скорее.",
      ].join("\n");
      const subject = `Обслуживание автомобиля просрочено – ${plate}`;
      const text = [
        greeting,
        "",
        `Плановый пробег обслуживания назначенного вам автомобиля ${plate} превышен.`,
        "",
        `Номер: ${plate}`,
        `Оценочный текущий пробег: ${estimated}`,
        `Пробег последнего обслуживания: ${lastService}`,
        `Плановый пробег обслуживания: ${nextService}`,
        `Просрочка: ${remaining}`,
        "",
        "По записям системы обслуживание ещё не отмечено как выполненное.",
        "Если оно не выполнено, свяжитесь с партнёром и запланируйте его.",
        "Если оно выполнено, сообщите через панель водителя Tripetica, «Обслуживание выполнено».",
        "",
        "Tripetica — учёт обслуживания автомобилей",
      ].join("\n");
      return { title, body, subject, text, html: driverMailHtml(text) };
    }
    const title = "🔧 Напоминание об обслуживании";
    const body = [
      input.line === "due"
        ? `Плановый пробег обслуживания ${plate} достигнут.`
        : `До планового обслуживания ${plate} осталось ${remaining}.`,
      `Оценочный текущий пробег: ${estimated}`,
      `Следующее обслуживание: ${nextService}`,
      "Запланируйте обслуживание автомобиля.",
    ].join("\n");
    const subject = `Напоминание об обслуживании – ${plate}`;
    const text = [
      greeting,
      "",
      input.line === "due"
        ? `Плановый пробег обслуживания назначенного вам автомобиля ${plate} достигнут.`
        : `Приближается плановое обслуживание назначенного вам автомобиля ${plate}.`,
      "",
      `Номер: ${plate}`,
      `Оценочный текущий пробег: ${estimated}`,
      `Пробег последнего обслуживания: ${lastService}`,
      `Пробег следующего обслуживания: ${nextService}`,
      `Осталось: ${remaining}`,
      "",
      "Запланируйте обслуживание вовремя.",
      "",
      "Когда обслуживание будет выполнено, сообщите через панель водителя Tripetica, «Обслуживание выполнено».",
      "",
      "Tripetica — учёт обслуживания автомобилей",
    ].join("\n");
    return { title, body, subject, text, html: driverMailHtml(text) };
  }
  if (input.line === "overdue") {
    const title = "⚠️ Araç Bakımı Gecikti";
    const body = [
      `${plate} plakalı aracınızın periyodik bakım kilometresi ${remaining} aşıldı.`,
      `Tahmini güncel kilometre: ${estimated}`,
      `Planlanan bakım: ${nextService}`,
      "Bakım yapıldıysa Bakımı Yaptırdım bölümünden bildirin. Yapılmadıysa lütfen en kısa sürede planlayın.",
    ].join("\n");
    const subject = `Araç Bakımı Gecikti – ${plate}`;
    const text = [
      greeting,
      "",
      `Kullanımınıza atanmış ${plate} plakalı aracın periyodik bakım kilometresi aşılmıştır.`,
      "",
      `Plaka: ${plate}`,
      `Tahmini güncel kilometre: ${estimated}`,
      `Son bakım kilometresi: ${lastService}`,
      `Planlanan bakım kilometresi: ${nextService}`,
      `Bakım gecikmesi: ${remaining}`,
      "",
      "Sistem kayıtlarına göre aracın bakımı henüz tamamlandı olarak bildirilmemiştir.",
      "Bakım yapılmadıysa lütfen partner yetkilisiyle iletişime geçerek bakımın planlanmasını sağlayın.",
      "Bakım yapıldıysa Tripetica Şoför Paneli üzerinden Bakımı Yaptırdım işlemini kullanarak durumu bildirin.",
      "",
      "Tripetica Araç Bakım Takip Sistemi",
    ].join("\n");
    return { title, body, subject, text, html: driverMailHtml(text) };
  }
  const title = "🔧 Araç Bakım Hatırlatması";
  const body = [
    input.line === "due"
      ? `${plate} plakalı aracınızın periyodik bakım kilometresine ulaşıldı.`
      : `${plate} plakalı aracınızın periyodik bakımına ${remaining} kaldı.`,
    `Tahmini güncel kilometre: ${estimated}`,
    `Sıradaki bakım: ${nextService}`,
    "Lütfen aracınızın bakımını planlayın.",
  ].join("\n");
  const subject = `Araç Bakım Hatırlatması – ${plate}`;
  const text = [
    greeting,
    "",
    input.line === "due"
      ? `Kullanımınıza atanmış ${plate} plakalı aracın periyodik bakım kilometresine ulaşıldı.`
      : `Kullanımınıza atanmış ${plate} plakalı aracın periyodik bakım zamanı yaklaşıyor.`,
    "",
    `Plaka: ${plate}`,
    `Tahmini güncel kilometre: ${estimated}`,
    `Son bakım kilometresi: ${lastService}`,
    `Sıradaki bakım kilometresi: ${nextService}`,
    `Bakıma kalan: ${remaining}`,
    "",
    "Lütfen aracınızın bakımını zamanında planlayın.",
    "",
    "Bakım tamamlandığında Tripetica Şoför Paneli üzerinden Bakımı Yaptırdım işlemini kullanarak durumu bildirin.",
    "",
    "Tripetica Araç Bakım Takip Sistemi",
  ].join("\n");
  return { title, body, subject, text, html: driverMailHtml(text) };
}

function driverMailHtml(text: string) {
  return text
    .split("\n\n")
    .map((paragraph) => `<p>${escapeHtml(paragraph).replaceAll("\n", "<br>")}</p>`)
    .join("");
}

export function maintenanceEmail(input: MaintenanceMailInput) {
  const plate = input.plate.trim() || "—";
  const vehicle = vehicleLabel(input.brand, input.model);
  const phone = maintenancePhoneLink(input.driverPhone);
  const driverName = input.driverName?.trim() || null;
  const serviceDate = formatMaintenanceDate(input.lastServiceOn, input.locale);
  const overdueKm = input.remainingKm < 0 ? -input.remainingKm : 0;
  const remainingLabelKm = input.line === "overdue" ? overdueKm : input.remainingKm;
  const copy = mailCopy(input.locale, {
    plate,
    thresholdKm: input.thresholdKm,
    overdueKm,
    line: input.line,
  });
  const rows: Array<{ label: string; value: string; html?: string }> = [
    { label: copy.plate, value: plate },
  ];
  if (vehicle) rows.push({ label: copy.vehicle, value: vehicle });
  if (driverName) rows.push({ label: copy.driver, value: driverName });
  if (phone) {
    rows.push({
      label: copy.driverPhone,
      value: phone.display,
      html: phone.href
        ? `<a href="${escapeHtml(phone.href)}">${escapeHtml(phone.display)}</a>`
        : escapeHtml(phone.display),
    });
  }
  const maintenanceRows: Array<{ label: string; value: string }> = [
    { label: copy.estimated, value: km(input.estimatedKm) },
    { label: copy.lastService, value: km(input.lastServiceKm) },
    { label: copy.lastServiceOn, value: serviceDate },
    { label: copy.interval, value: km(input.intervalKm) },
    { label: copy.nextService, value: km(input.nextServiceKm) },
    {
      label: input.line === "overdue" ? copy.overdue : input.line === "due" ? copy.due : copy.remaining,
      value: km(remainingLabelKm),
    },
  ];
  const text = [
    copy.hello,
    "",
    copy.intro,
    "",
    copy.vehicleHeading,
    "",
    ...rows.map((row) => `${row.label}: ${row.value}`),
    "",
    copy.maintenanceHeading,
    "",
    ...maintenanceRows.map((row) => `${row.label}: ${row.value}`),
    "",
    copy.advice,
    "",
    phone?.href ? copy.call : null,
    copy.disclaimer,
    "",
    "Tripetica",
  ].filter((line): line is string => line !== null).join("\n");
  const html = `<p>${escapeHtml(copy.hello)}</p>
<p>${escapeHtml(copy.intro)}</p>
<p><strong>${escapeHtml(copy.vehicleHeading)}</strong></p>
<p>${rows.map((row) => `${escapeHtml(row.label)}: ${row.html ?? escapeHtml(row.value)}`).join("<br>")}</p>
<p><strong>${escapeHtml(copy.maintenanceHeading)}</strong></p>
<p>${maintenanceRows.map((row) => `${escapeHtml(row.label)}: ${escapeHtml(row.value)}`).join("<br>")}</p>
<p>${escapeHtml(copy.advice)}</p>
${phone?.href ? `<p>${escapeHtml(copy.call)}</p>` : ""}
<p>${escapeHtml(copy.disclaimer)}</p>
<p>Tripetica</p>`;
  return { subject: copy.subject, text, html };
}

function mailCopy(locale: MaintenanceLocale, input: {
  plate: string;
  thresholdKm: number;
  overdueKm: number;
  line: MaintenanceLine;
}) {
  if (locale === "en") {
    const subject = input.line === "overdue"
      ? `Vehicle service overdue — ${input.plate} — ${input.overdueKm} km`
      : input.line === "due"
        ? `Vehicle service reminder — ${input.plate} — Service is due`
        : `Vehicle service reminder — ${input.plate} — ${input.thresholdKm} km left`;
    return {
      subject,
      hello: "Hello,",
      intro: input.line === "overdue"
        ? `The scheduled service mileage for ${input.plate} is estimated to be ${input.overdueKm} km overdue.`
        : input.line === "due"
          ? `The scheduled service mileage for ${input.plate} has been reached.`
          : `About ${input.thresholdKm} km remain before the scheduled service for ${input.plate}.`,
      vehicleHeading: "VEHICLE",
      plate: "Plate",
      vehicle: "Vehicle",
      driver: "Driver",
      driverPhone: "Driver phone",
      maintenanceHeading: "SERVICE",
      estimated: "Estimated current mileage",
      lastService: "Last service mileage",
      lastServiceOn: "Last service date",
      interval: "Service interval",
      nextService: "Next service mileage",
      remaining: "Mileage remaining",
      due: "Service is due",
      overdue: "Service overdue",
      advice: input.line === "overdue"
        ? "Please check the service status and book a workshop visit if it has not been done. When the service is complete, record it in the Partner Portal with “Service completed”."
        : "We recommend planning the workshop visit so the periodic service is done on time.",
      call: "You can call the driver by tapping the phone number above.",
      disclaimer: "Mileage is estimated from GPS data. If the dashboard reading differs, update it in the Tripetica Partner Portal.",
    };
  }
  if (locale === "ru") {
    const subject = input.line === "overdue"
      ? `Обслуживание автомобиля просрочено — ${input.plate} — ${input.overdueKm} км`
      : input.line === "due"
        ? `Напоминание об обслуживании — ${input.plate} — Срок обслуживания наступил`
        : `Напоминание об обслуживании — ${input.plate} — осталось ${input.thresholdKm} км`;
    return {
      subject,
      hello: "Здравствуйте,",
      intro: input.line === "overdue"
        ? `Плановый пробег обслуживания для ${input.plate} превышен примерно на ${input.overdueKm} км.`
        : input.line === "due"
          ? `Плановый пробег обслуживания для ${input.plate} достигнут.`
          : `До планового обслуживания ${input.plate} осталось примерно ${input.thresholdKm} км.`,
      vehicleHeading: "АВТОМОБИЛЬ",
      plate: "Номер",
      vehicle: "Автомобиль",
      driver: "Водитель",
      driverPhone: "Телефон водителя",
      maintenanceHeading: "ОБСЛУЖИВАНИЕ",
      estimated: "Оценочный текущий пробег",
      lastService: "Пробег последнего обслуживания",
      lastServiceOn: "Дата последнего обслуживания",
      interval: "Интервал обслуживания",
      nextService: "Пробег следующего обслуживания",
      remaining: "Осталось до обслуживания",
      due: "Срок обслуживания наступил",
      overdue: "Просрочка обслуживания",
      advice: input.line === "overdue"
        ? "Проверьте состояние обслуживания и запишитесь в сервис, если оно ещё не выполнено. После выполнения отметьте это в портале партнёра кнопкой «Обслуживание выполнено»."
        : "Рекомендуем запланировать визит в сервис, чтобы периодическое обслуживание было выполнено вовремя.",
      call: "Чтобы позвонить водителю, нажмите на номер телефона выше.",
      disclaimer: "Пробег оценивается по данным GPS. Если показание одометра отличается, обновите его в портале партнёра Tripetica.",
    };
  }
  const subject = input.line === "overdue"
    ? `Araç Bakımı Gecikti — ${input.plate} — ${input.overdueKm} km`
    : input.line === "due"
      ? `Araç Bakım Hatırlatması — ${input.plate} — Bakım Zamanı Geldi`
      : `Araç Bakım Hatırlatması — ${input.plate} — ${input.thresholdKm} km Kaldı`;
  return {
    subject,
    hello: "Merhaba,",
    intro: input.line === "overdue"
      ? `${input.plate} plakalı aracınızın periyodik bakım kilometresi tahmini olarak ${input.overdueKm} km aşılmıştır.`
      : input.line === "due"
        ? `${input.plate} plakalı aracınızın periyodik bakım kilometresine ulaşıldı.`
        : `${input.plate} plakalı aracınızın periyodik bakımına tahmini ${input.thresholdKm} km kalmıştır.`,
    vehicleHeading: "ARAÇ BİLGİLERİ",
    plate: "Plaka",
    vehicle: "Araç",
    driver: "Şoför",
    driverPhone: "Şoför Telefonu",
    maintenanceHeading: "BAKIM BİLGİLERİ",
    estimated: "Tahmini Güncel Kilometre",
    lastService: "Son Bakım Kilometresi",
    lastServiceOn: "Son Bakım Tarihi",
    interval: "Bakım Aralığı",
    nextService: "Sıradaki Bakım Kilometresi",
    remaining: "Bakıma Kalan Kilometre",
    due: "Bakım Zamanı Geldi",
    overdue: "Bakım Gecikmesi",
    advice: input.line === "overdue"
      ? "Aracınızın bakım durumunu kontrol etmenizi ve henüz yaptırılmadıysa en kısa sürede servis planlamanızı öneririz. Bakım tamamlandıysa Partner Portal üzerinden \"Bakımı Tamamladım\" işlemini kaydedebilirsiniz."
      : "Aracınızın periyodik bakımını zamanında yaptırabilmek için servis planlamanızı yapmanızı öneririz.",
    call: "Şoförünüzle iletişime geçmek için yukarıdaki telefon numarasına dokunabilirsiniz.",
    disclaimer: "Kilometre bilgisi GPS verilerine göre tahmini hesaplanmaktadır. Aracınızın gerçek gösterge kilometresi farklıysa Tripetica Partner Portal üzerinden güncelleyebilirsiniz.",
  };
}
