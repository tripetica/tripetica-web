import { type Locale } from "@/lib/i18n/config";
import { type AssignmentNotifyChangeKind } from "@/lib/ops/assignment-customer-notification-view";

export type AssignmentNotifyMailCopy = {
  greeting: string;
  help: string;
  signOff: string;
  brand: string;
  summaryTitle: string;
  passenger: string;
  dateTime: string;
  service: string;
  duration: string;
  vehicleClass: string;
  pickup: string;
  dropoff: string;
  tour: string;
  tourStart: string;
  tourEnd: string;
  assignmentVehicleTitle: string;
  assignmentBothTitle: string;
  vehicle: string;
  plate: string;
  driver: string;
  phone: string;
  firstVehicleSubject: string;
  firstVehicleIntro: string;
  firstBothSubject: string;
  firstBothIntro: string;
  updateVehicleSubject: string;
  updateVehicleIntro: string;
  updateVehicleCurrent: string;
  updateVehiclePlease: string;
  updateDriverSubject: string;
  updateDriverIntro: string;
  updateDriverCurrent: string;
  updateDriverPlease: string;
  updateBothSubject: string;
  updateBothIntro: string;
  updateBothCurrent: string;
  updateBothPlease: string;
};

export const assignmentCustomerNotificationCopy: Record<
  Locale,
  AssignmentNotifyMailCopy
> = {
  tr: {
    greeting: "Sayın Yolcumuz,",
    help: "Transferinizle ilgili herhangi bir konuda yardıma ihtiyacınız olursa bizimle iletişime geçebilirsiniz.",
    signOff: "İyi yolculuklar dileriz.",
    brand: "Tripetica",
    summaryTitle: "Rezervasyon Özeti",
    passenger: "Yolcu",
    dateTime: "Tarih & Saat",
    service: "Hizmet",
    duration: "Süre",
    vehicleClass: "Araç Sınıfı",
    pickup: "Alış Yeri",
    dropoff: "Bırakma Yeri",
    tour: "Tur",
    tourStart: "Başlangıç Yeri",
    tourEnd: "Bitiş Yeri",
    assignmentVehicleTitle: "Araç Bilgileri",
    assignmentBothTitle: "Araç ve Şoför Bilgileri",
    vehicle: "Araç",
    plate: "Plaka",
    driver: "Şoför",
    phone: "Telefon",
    firstVehicleSubject: "Transferiniz için araç bilgileriniz hazır",
    firstVehicleIntro:
      "Aşağıda özeti bulunan rezervasyonunuz için araç ataması tamamlanmıştır.",
    firstBothSubject: "Transferiniz için araç ve şoför bilgileriniz hazır",
    firstBothIntro:
      "Aşağıda özeti bulunan rezervasyonunuz için araç ve şoför ataması tamamlanmıştır.",
    updateVehicleSubject: "Transferinizin araç bilgileri güncellendi",
    updateVehicleIntro:
      "Aşağıda özeti bulunan rezervasyonunuz için daha önce paylaşılan araç bilgilerinde değişiklik yapılmıştır.",
    updateVehicleCurrent: "Güncel araç bilgileriniz:",
    updateVehiclePlease:
      "Lütfen transferiniz için yukarıdaki güncel araç bilgilerini dikkate alınız.",
    updateDriverSubject: "Transferinizin şoför bilgileri güncellendi",
    updateDriverIntro:
      "Aşağıda özeti bulunan rezervasyonunuz için daha önce paylaşılan şoför bilgilerinde değişiklik yapılmıştır.",
    updateDriverCurrent: "Güncel şoför bilgileriniz:",
    updateDriverPlease:
      "Lütfen transferiniz için yukarıdaki güncel şoför bilgilerini dikkate alınız.",
    updateBothSubject: "Transferinizin araç ve şoför bilgileri güncellendi",
    updateBothIntro:
      "Aşağıda özeti bulunan rezervasyonunuz için daha önce paylaşılan araç ve/veya şoför bilgilerinde değişiklik yapılmıştır.",
    updateBothCurrent: "Güncel araç ve şoför bilgileriniz:",
    updateBothPlease:
      "Lütfen transferiniz için yukarıdaki güncel araç ve şoför bilgilerini dikkate alınız.",
  },
  en: {
    greeting: "Dear Guest,",
    help: "If you need any assistance regarding your transfer, please feel free to contact us.",
    signOff: "We wish you a pleasant journey.",
    brand: "Tripetica",
    summaryTitle: "Reservation summary",
    passenger: "Passenger",
    dateTime: "Date & time",
    service: "Service",
    duration: "Duration",
    vehicleClass: "Vehicle class",
    pickup: "Pickup",
    dropoff: "Drop-off",
    tour: "Tour",
    tourStart: "Starting point",
    tourEnd: "End point",
    assignmentVehicleTitle: "Vehicle details",
    assignmentBothTitle: "Vehicle and driver details",
    vehicle: "Vehicle",
    plate: "License Plate",
    driver: "Driver",
    phone: "Phone",
    firstVehicleSubject: "Your vehicle details are ready",
    firstVehicleIntro:
      "A vehicle has been assigned for the reservation summarised below.",
    firstBothSubject: "Your vehicle and driver details are ready",
    firstBothIntro:
      "A vehicle and driver have been assigned for the reservation summarised below.",
    updateVehicleSubject: "Your transfer vehicle details have been updated",
    updateVehicleIntro:
      "The vehicle details previously shared for the reservation summarised below have been updated.",
    updateVehicleCurrent: "Your current vehicle details:",
    updateVehiclePlease: "Please use the updated vehicle details above for your transfer.",
    updateDriverSubject: "Your transfer driver details have been updated",
    updateDriverIntro:
      "The driver details previously shared for the reservation summarised below have been updated.",
    updateDriverCurrent: "Your current driver details:",
    updateDriverPlease: "Please use the updated driver details above for your transfer.",
    updateBothSubject: "Your transfer vehicle and driver details have been updated",
    updateBothIntro:
      "The vehicle and/or driver details previously shared for the reservation summarised below have been updated.",
    updateBothCurrent: "Your current vehicle and driver details:",
    updateBothPlease:
      "Please use the updated vehicle and driver details above for your transfer.",
  },
  ru: {
    greeting: "Уважаемый пассажир!",
    help: "Если вам потребуется помощь по вопросам трансфера, пожалуйста, свяжитесь с нами.",
    signOff: "Желаем вам приятной поездки!",
    brand: "Tripetica",
    summaryTitle: "Сводка бронирования",
    passenger: "Пассажир",
    dateTime: "Дата и время",
    service: "Услуга",
    duration: "Продолжительность",
    vehicleClass: "Класс автомобиля",
    pickup: "Место подачи",
    dropoff: "Место высадки",
    tour: "Тур",
    tourStart: "Место начала",
    tourEnd: "Место окончания",
    assignmentVehicleTitle: "Данные автомобиля",
    assignmentBothTitle: "Данные автомобиля и водителя",
    vehicle: "Автомобиль",
    plate: "Гос. номер",
    driver: "Водитель",
    phone: "Телефон",
    firstVehicleSubject: "Информация об автомобиле для вашего трансфера",
    firstVehicleIntro:
      "Для бронирования, сводка которого приведена ниже, назначен автомобиль.",
    firstBothSubject: "Информация об автомобиле и водителе для вашего трансфера",
    firstBothIntro:
      "Для бронирования, сводка которого приведена ниже, назначены автомобиль и водитель.",
    updateVehicleSubject: "Информация об автомобиле для вашего трансфера обновлена",
    updateVehicleIntro:
      "Ранее предоставленная информация об автомобиле для бронирования, сводка которого приведена ниже, была изменена.",
    updateVehicleCurrent: "Актуальные данные автомобиля:",
    updateVehiclePlease:
      "Пожалуйста, используйте указанные выше актуальные данные автомобиля для вашего трансфера.",
    updateDriverSubject: "Информация о водителе для вашего трансфера обновлена",
    updateDriverIntro:
      "Ранее предоставленная информация о водителе для бронирования, сводка которого приведена ниже, была изменена.",
    updateDriverCurrent: "Актуальные данные водителя:",
    updateDriverPlease:
      "Пожалуйста, используйте указанные выше актуальные данные водителя для вашего трансфера.",
    updateBothSubject:
      "Информация об автомобиле и водителе для вашего трансфера обновлена",
    updateBothIntro:
      "Ранее предоставленная информация об автомобиле и/или водителе для бронирования, сводка которого приведена ниже, была изменена.",
    updateBothCurrent: "Актуальные данные автомобиля и водителя:",
    updateBothPlease:
      "Пожалуйста, используйте указанные выше актуальные данные автомобиля и водителя для вашего трансфера.",
  },
  ar: {
    greeting: "عزيزنا المسافر،",
    help: "إذا احتجتم إلى أي مساعدة بخصوص رحلتكم، يرجى التواصل معنا.",
    signOff: "نتمنى لكم رحلة سعيدة.",
    brand: "Tripetica",
    summaryTitle: "ملخص الحجز",
    passenger: "الراكب",
    dateTime: "التاريخ والوقت",
    service: "الخدمة",
    duration: "المدة",
    vehicleClass: "فئة المركبة",
    pickup: "مكان الانطلاق",
    dropoff: "مكان الوصول",
    tour: "الجولة",
    tourStart: "نقطة البداية",
    tourEnd: "نقطة النهاية",
    assignmentVehicleTitle: "بيانات المركبة",
    assignmentBothTitle: "بيانات المركبة والسائق",
    vehicle: "المركبة",
    plate: "رقم اللوحة",
    driver: "السائق",
    phone: "الهاتف",
    firstVehicleSubject: "تفاصيل المركبة لرحلتكم جاهزة",
    firstVehicleIntro: "تم تعيين المركبة للحجز الموضّح ملخصه أدناه.",
    firstBothSubject: "تفاصيل المركبة والسائق لرحلتكم جاهزة",
    firstBothIntro: "تم تعيين المركبة والسائق للحجز الموضّح ملخصه أدناه.",
    updateVehicleSubject: "تم تحديث معلومات المركبة لرحلتكم",
    updateVehicleIntro:
      "تم تحديث معلومات المركبة التي شاركناها سابقاً للحجز الموضّح ملخصه أدناه.",
    updateVehicleCurrent: "بيانات المركبة الحالية:",
    updateVehiclePlease: "يرجى اعتماد بيانات المركبة المحدّثة أعلاه لرحلتكم.",
    updateDriverSubject: "تم تحديث معلومات السائق لرحلتكم",
    updateDriverIntro:
      "تم تحديث معلومات السائق التي شاركناها سابقاً للحجز الموضّح ملخصه أدناه.",
    updateDriverCurrent: "بيانات السائق الحالية:",
    updateDriverPlease: "يرجى اعتماد بيانات السائق المحدّثة أعلاه لرحلتكم.",
    updateBothSubject: "تم تحديث معلومات المركبة والسائق لرحلتكم",
    updateBothIntro:
      "تم تحديث معلومات المركبة و/أو السائق التي شاركناها سابقاً للحجز الموضّح ملخصه أدناه.",
    updateBothCurrent: "بيانات المركبة والسائق الحالية:",
    updateBothPlease:
      "يرجى اعتماد بيانات المركبة والسائق المحدّثة أعلاه لرحلتكم.",
  },
};

export function assignmentNotifyMailVariant(input: {
  isUpdate: boolean;
  scope: "vehicle_only" | "vehicle_and_driver";
  changeKind: AssignmentNotifyChangeKind | null;
}): "first-vehicle" | "first-both" | "update-vehicle" | "update-driver" | "update-both" {
  if (!input.isUpdate) {
    return input.scope === "vehicle_and_driver" ? "first-both" : "first-vehicle";
  }
  if (input.scope === "vehicle_only") {
    return "update-vehicle";
  }
  if (input.changeKind === "vehicle") {
    return "update-vehicle";
  }
  if (input.changeKind === "driver") {
    return "update-driver";
  }
  return "update-both";
}
