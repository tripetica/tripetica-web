import { type Locale, type PanelLocale, asPanelLocale } from "@/lib/i18n/config";
import { type UetdsEligibilityReason } from "@/lib/uetds/eligibility";

export const uetdsFormCopy = {
  tr: {
    fillFromDocument: "Belgeden Bilgileri Doldur",
    addFile: "Dosya Ekle",
    addImages: "Görsel Ekle",
    pasteText: "Açıklama Ekle",
    removeSource: "Kaynağı kaldır",
    pastePlaceholder: "Rezervasyon bilgilerini yazın veya yapıştırın; dosya/görselde eksik bilgileri ve açık düzeltmeleri ekleyebilirsiniz.",
    extract: "Analiz Et",
    extracting: "Belge analiz ediliyor...",
    extractApplied: "AI ile bilgiler dolduruldu. Lütfen göndermeden önce bilgileri kontrol edin.",
    aiUnavailable: "AI ile bilgi doldurma şu anda kullanılamıyor. Formu manuel doldurabilirsiniz.",
    aiModelUnavailable: "Seçilen AI modeli bu hesapta kullanılamıyor. Lütfen yöneticinize bildirin; formu manuel doldurabilirsiniz.",
    aiTimeout: "AI işlemi zaman aşımına uğradı. Bilgileriniz değiştirilmedi; tekrar deneyebilirsiniz.",
    aiUnsupported: "Bu dosya türü desteklenmiyor. PDF, JPG, PNG veya WebP seçin.",
    aiBusy: "Devam eden AI işleminin tamamlanmasını bekleyin.",
    aiInputTooLarge: "Metin en fazla 30.000 karakter olabilir.",
    extractPartial: "AI ile bulunan bilgiler aktarıldı. Lütfen eksik veya çelişen alanları kontrol edip göndermeden önce tamamlayın.",
    extractFailed: "Belgedeki bilgiler okunamadı. Formu manuel doldurabilirsiniz.",
    extractNone: "Belgeden aktarılacak yeni bilgi bulunamadı.",
    extractImagesHint: "Görseller alındı ancak metin okunamadı. Formu manuel doldurabilirsiniz.",
    extractConflict: "Belge mevcut değerle çakışıyor. Hangisinin doğru olduğuna siz karar verin.",
    fileTooLarge: "Dosya boyutu en fazla 10 MB olabilir.",
    keepCurrent: "Mevcut değeri koru",
    useExtracted: "Belgedeki değeri kullan",
    tripSection: "Yolculuk Bilgileri",
    origin: "Alış Yeri",
    destination: "Bırakma Yeri",
    startDate: "Başlangıç tarihi",
    startTime: "Başlangıç saati",
    endDate: "Bitiş tarihi",
    endTime: "Bitiş saati",
    tripKind: "Taşıma türü",
    tripTransfer: "Transfer",
    tripTour: "Tur",
    tripCharter: "Tahsis",
    tripOther: "Diğer",
    groupName: "Grup adı",
    purpose: "Açıklama / taşıma amacı",
    fare: "Grup / taşıma ücreti",
    verifyLocation: "Bu konum U-ETDS için doğrulanamadı. Lütfen başka bir sonuç seçin.",
    verifyAirport: "Bu konum U-ETDS için doğrulanamadı. Lütfen başka bir sonuç seçin.",
    locationUnresolved: "Bu konum U-ETDS için doğrulanamadı. Lütfen başka bir sonuç seçin.",
    officialConfirmed: "U-ETDS konumu: {label} ✓",
    correctOfficial: "Resmi konumu düzelt",
    startTooSoon: "Başlangıç zamanı artık geçerli değil. En erken seçilebilir zamanı güncelleyin.",
    startAdjusted:
      "Başlangıç saati güncellendi. U-ETDS bildirimi için gerekli süre nedeniyle başlangıç saati {time} olarak ayarlandı.",
    endAdjusted: "Bitiş saati yeni başlangıç saatine göre {time} olarak güncellendi.",
    endBeforeStart: "Bitiş zamanı başlangıçtan sonra olmalıdır.",
    ministryPdfView: "PDF Görüntüle",
    ministryPdfDownload: "PDF İndir",
    ministryPdfUnavailable: "Bakanlık sefer belgesi şu anda alınamadı.",
    ministryPdfTitle: "Bakanlık sefer belgesi",
    passengers: "Yolcular",
    addPassenger: "+ Yolcu Ekle",
    removePassenger: "Yolcuyu sil",
    removePassengerTitle: "Yolcuyu bildirimden silmek istiyor musunuz?",
    removePassengerPrompt: "Bu yolcuyu bildirimden silmek istediğinizden emin misiniz?",
    removePassengerYes: "Evet, Sil",
    notificationDeleted: "Bildirim Tripetica'dan silindi.",
    passengerN: "{n}. Yolcu",
    nationality: "Uyruk",
    identity: "T.C. Kimlik No / Pasaport No",
    identityTc: "T.C. Kimlik",
    identityPassport: "Pasaport",
    identityOther: "Diğer",
    firstName: "Ad",
    lastName: "Soyad",
    firstNamePlaceholder: "Ad giriniz",
    lastNamePlaceholder: "Soyad giriniz",
    identityTcPlaceholder: "T.C. Kimlik No giriniz",
    identityPassportPlaceholder: "Pasaport No giriniz",
    identityOtherPlaceholder: "Kimlik numarası giriniz",
    gender: "Cinsiyet",
    genderMale: "Erkek",
    genderFemale: "Kadın",
    genderEmpty: "Seçilmedi",
    driverVehicle: "Şoför ve Araç",
    driver: "Şoför",
    vehicle: "Araç",
    selectDriver: "Şoför seçin",
    selectVehicle: "Araç seçin",
    noDrivers: "Seçilebilecek şoför yok.",
    noVehicles: "Seçilebilecek araç yok.",
    eligibleVia: "U-ETDS bildirimi {company} üzerinden yapılacak.",
    fromReservation: "Rezervasyondan",
    fromDocument: "Belgeden dolduruldu",
    suggested: "Tahmin — kontrol edin",
    missing: "Eksik bilgi",
    summaryOkTrip: "Yolculuk bilgileri tamam",
    summaryOkFleet: "Şoför ve araç U-ETDS için uygun",
    summaryPassengers: "{n} yolcu",
    summarySuggested: "{n} tahmini bilgi kontrol edilmeli",
    summaryMissing: "{n} zorunlu bilgi eksik",
    summaryOkRequired: "Zorunlu bilgi eksik değil",
    send: "U-ETDS Bildirimini Gönder",
    confirmTitle: "U-ETDS Bildirimini Gönder",
    confirmYes: "Onayla ve Gönder",
    confirmNo: "Vazgeç",
    confirmCompany: "Firma",
    confirmRoute: "Güzergâh",
    confirmWhen: "Tarih/Saat",
    confirmPassengers: "Yolcu",
    confirmLive: "Bildirim U-ETDS gerçek servisine gönderilecektir.",
    confirmTestPlate:
      "U-ETDS TEST ortamı canlı yetki belgesi araç kaydını kullanmaz. Bakanlık V15 resmi örnek plakası gönderilecek: 06TARIFESIZ123",
    saved: "U-ETDS TEST bildirimi başarıyla gönderildi.",
    saveFailed: "Bildirim kaydedilemedi. Lütfen tekrar deneyin.",
    forbidden: "Bu işlem için yetkiniz yok.",
    testPartial: "U-ETDS TEST bildirimi kısmen tamamlandı. Sefer referansını kontrol edin.",
    seferRef: "Sefer referansı",
    locationManual: "Resmi lokasyon seç",
    locationProvince: "İl",
    locationDistrict: "İlçe",
    locationAirport: "Havalimanı",
    locationTypeDistrict: "İl / ilçe",
    locationTypeAirport: "Havalimanı",
    officialLocation: "Resmi lokasyon",
    placesSearch: "Otel, adres veya havalimanı arayın",
    noPlaceResults: "Sonuç bulunamadı.",
    placesError: "Konum araması yapılamadı.",
    fieldErrorsTitle: "Göndermeden önce bunları tamamlayın:",
    missingOrigin: "Alış yeri U-ETDS için doğrulanamadı. Lütfen başka bir sonuç seçin.",
    missingDestination: "Bırakma yeri U-ETDS için doğrulanamadı. Lütfen başka bir sonuç seçin.",
    missingEnd: "Bitiş tarihi ve saati zorunludur.",
    missingStartDate: "Başlangıç tarihi zorunludur.",
    missingStartTime: "Başlangıç saati zorunludur.",
    missingPurpose: "Açıklama / taşıma amacı zorunludur.",
    missingDriver: "Şoför seçimi zorunludur.",
    missingVehicle: "Araç seçimi zorunludur.",
    missingPassengers: "En az bir yolcu zorunludur.",
    missingPassengerName: "Yolcu adı ve soyadı zorunludur.",
    missingPassengerNationality: "Yolcu uyruğu zorunludur.",
    missingPassengerIdentity: "Yolcu kimlik numarası zorunludur.",
    missingGeneric: "Zorunlu bilgi eksik.",
    missingGender: "Yolcu cinsiyeti zorunludur.",
    missingDriverIdentity: "Seçilen şoförün T.C. kimlik numarası eksik.",
    missingTestCredentials: "U-ETDS TEST kullanıcı bilgileri eksik.",
    missingLiveCredentials: "U-ETDS gerçek servis kullanıcı bilgileri eksik.",
    ministryFailed: "U-ETDS TEST servisi bildirimi kabul etmedi.",
    ministryFailedLive: "U-ETDS servisi bildirimi kabul etmedi.",
    savedLive: "U-ETDS bildirimi başarıyla gönderildi.",
    livePartial: "U-ETDS bildirimi kısmen tamamlandı. Sefer referansını kontrol edin.",
    liveBlocked: "Bu ortamda U-ETDS servisine gönderim kapalıdır.",
    notifyAction: "U-ETDS Bildirimi Yap",
    notifyEditAction: "U-ETDS Bildirimini Düzenle",
    duplicateReservation:
      "Bu rezervasyon için aktif bir U-ETDS bildirimi zaten var. Yeni sefer oluşturulmadı.",
    reasonUnassigned: "U-ETDS bildirimi için önce şoför ve araç atayın.",
    reasonUnassignedDriver: "U-ETDS bildirimi için önce şoför atayın.",
    reasonUnassignedVehicle: "U-ETDS bildirimi için önce araç atayın.",
    reasonExternal: "Şoför ve araç için U-ETDS firma ilişkisi eksik.",
    reasonIncomplete: "Şoför veya araç için U-ETDS firma ilişkisi eksik.",
    reasonMismatch: "Şoför ve araç farklı U-ETDS firmalarına kayıtlı. Lütfen kontrol edin.",
    reasonInactive: "Seçilen U-ETDS firması bildirim için kullanılamıyor.",
    reasonNotReady: "Seçilen U-ETDS firması bildirim için kullanılamıyor.",
    recorded: "Kaydedildi",
    backToList: "Kapat",
    listStart: "Başlangıç",
    listEnd: "Bitiş",
    listPlate: "Plaka",
    invalidFare: "Geçerli bir grup / taşıma ücreti girin.",
    listNo: "No",
    filterDate: "Tarih",
    filterStatus: "Durum",
    filterAll: "Tümü",
    filterToday: "Bugün",
    filterTomorrow: "Yarın",
    filterYesterday: "Dün",
    filterPast: "Geçmiş",
    filterFuture: "Gelecek",
    listActive: "Aktif",
    listCompleted: "Tamamlandı",
    listArchive: "Arşiv",
    selectAll: "Tümünü Seç",
    deleteSelected: "Seçilenleri Sil",
    deleteConfirm: "Seçilen iptal kayıtlarını Tripetica’dan tamamen silmek istiyor musunuz?",
    deleteSummary: "{deleted} kayıt silindi. {failed} kayıt U-ETDS sisteminde iptal edildiği doğrulanamadığı için silinmedi.",
    deleteStillValid: "Bildirim U-ETDS sisteminde hâlâ geçerli göründüğü için silinmedi.",
    deleteUnverified: "U-ETDS iptal durumu doğrulanamadı. Kayıt silinmedi.",
    cancelVerifiedTitle: "Bildirim iptal edildi",
    cancelDeletePrompt: "U-ETDS bildiriminiz başarıyla iptal edildi. Bu kaydı Tripetica’dan tamamen silmek ister misiniz?",
    deletePermanently: "Tamamen Sil",
    keepCancelled: "Hayır, Sakla",
    cancelUnverified: "İptal yanıtı alındı ancak Bakanlık iptal durumu henüz doğrulanamadı. Kayıt saklandı.",
    filterApply: "Uygula",
    listDetail: "Detay",
    listSearch: "Plaka, şoför, güzergâh veya U-ETDS no ara",
    listStatus: "Durum",
    verifiedByMinistry: "Bakanlık tarafından doğrulandı",
    finalVerificationFailed: "Bildirim Bakanlığa gönderildi ancak nihai U-ETDS doğrulaması tamamlanamadı. Lütfen bildirimi kontrol edin.",
    retryVerification: "Doğrulamayı yeniden dene",
    verificationPending: "Doğrulama bekleniyor",
    statusSubmitted: "Gönderildi",
    statusPartial: "Kısmi",
    statusFailed: "Hata",
    statusCancelled: "İptal",
    statusUpdated: "Güncellendi",
    statusPartialUpdate: "Kısmi güncelleme",
    statusUpdateError: "Güncelleme hatası",
    lastPassengerNotify: "Son Yolcu Bildirim Tarih/Saat",
    lastPassengerNotifyUnknown: "Bakanlık belgesinden henüz doğrulanmadı",
    edit: "Düzenle",
    editMethodTitle: "Düzenleme yöntemi",
    editMethodFormTitle: "Formdan düzenlemeye devam et",
    editMethodFormBody:
      "Değişiklik Tripetica üzerinden U-ETDS’ye yeniden bildirilir. Düzenlenen yolcuların son bildirim zamanı değişebilir.",
    editMethodEdevletTitle: "e-Devlet üzerinden düzenlemeye devam et",
    editMethodEdevletBody:
      "Kamu Uygulama Merkezi’nde mevcut yolcu kaydını düzenleyebilirsiniz. Bu firma adına e-Devlet üzerinden işlem yapmaya yetkili olmanız gerekir.",
    editMethodEdevletHint:
      "Giriş ve firma seçiminden sonra Sefer Listesi açılır. Listede şu Firma Sefer Numarasını arayın: {firmaSeferNo}",
    editMethodEdevletHintGeneric:
      "Giriş ve firma seçiminden sonra Sefer Listesi’nde ilgili seferi plaka ve tarih ile bulun.",
    editMethodClose: "Vazgeç",
    cancelTrip: "İptal",
    cancelTripConfirm: "Bu U-ETDS bildirimi iptal edilecek. Devam etmek istiyor musunuz?",
    cancelTripYes: "Evet, iptal et",
    editTitle: "U-ETDS Bildirimini Düzenle",
    editSave: "Değişiklikleri Kaydet",
    editConfirmTitle: "U-ETDS bildirimi güncellenecek.",
    editChanges: "Değişiklikler:",
    editConfirmYes: "Onayla ve Güncelle",
    editStartLocked: "Sefer başlangıcına 61 dakikadan az kaldığı için başlangıç saati kilitlidir.",
    editStartTooSoon: "Başlangıç saati mevcut zamandan en az 61 dakika sonrası olmalıdır.",
    editNewPassengerBlocked:
      "Sefer başlangıcına 61 dakikadan az kaldığı için yeni yolcu bildirimi yapılamaz. Mevcut yolcu bilgilerini düzenleyebilirsiniz.",
    editRemovedPassengerBlocked:
      "Sefer başlangıcına 61 dakikadan az kaldığı için yolcu silinemez. Mevcut yolcu bilgilerini düzenleyebilirsiniz.",
    editPassengerCountLocked:
      "Sefer başlangıcına 61 dakikadan az kaldığı için yolcu sayısı kilitlidir. Mevcut yolcu bilgilerini, alış ve bırakma yerini düzenleyebilirsiniz.",
    editPassengerCorrectionBlocked:
      "Mevcut yolcu düzeltmesi Bakanlık referansı ile yapılır. Yeni kopya yolcu eklenmez.",
    editPassengerCountMismatch:
      "Bakanlık yolcu sayısı beklenen değerle uyuşmuyor. İşlem başarılı kabul edilmedi.",
    editMissingPassengerRef:
      "Mevcut yolcunun Bakanlık referansı bulunamadı. Düzeltme gönderilmedi.",
    editKamuSessionRequired:
      "e-Devlet / Kamu Uygulama Merkezi oturumu gerekli. Girişi yalnızca resmi Kamu sayfasında tamamlayın; TCKN veya e-Devlet şifresini Tripetica’ya yazmayın.",
    editKamuSessionExpired:
      "Kamu oturumu süresi dolmuş. Resmi e-Devlet/Kamu portalında yeniden giriş yapıp oturumu bağlayın.",
    editKamuFirmRequired:
      "Kamu portalında yetkili firmayı seçip Devam Et demeniz gerekiyor. Ardından Tripetica’da tekrar deneyin.",
    editKamuSeferNotFound:
      "Kamu portalında ilgili sefer bulunamadı. Firma sefer numarası / plaka / tarih ile kontrol edin.",
    editKamuYolcuNotFound:
      "Kamu portalında mevcut yolcu satırı bulunamadı. Yolcu kimlik bilgilerini kontrol edin.",
    editKamuUpdateFailed:
      "Kamu portalında yolcu güncellemesi tamamlanamadı. Oturumu ve seferi kontrol edip tekrar deneyin.",
    editKamuFlushBlocked:
      "Yeni yolcu (flush) yolu engellendi. Yalnızca mevcut yolcu güncellemesi kullanılır.",
    editKamuRefChanged:
      "Portal güncellemesi sonrası yolcu referansı değişti. İşlem başarısız kabul edildi.",
    editKamuVerifyFailed:
      "Portal güncellemesi Bakanlık sorgusu ile doğrulanamadı.",
    kamuLoginOpen: "Kamu Uygulama Merkezi'ni Aç",
    kamuLoginFallback: "Yeni sekmede aç",
    kamuPopupBlocked:
      "Açılır pencere engellendi. «Yeni sekmede aç» bağlantısını kullanın veya tarayıcıda pop-up’a izin verin.",
    kamuSessionBind: "Girişi tamamladım — oturumu bağla (DEV)",
    kamuSessionBindHint:
      "e-Devlet şifresi değil: giriş sonrası tarayıcı Cookie başlığını yalnızca DEV’de bir kez bağlar. Şifre/TCKN yapıştırmayın.",
    kamuSessionBound: "Kamu oturumu bağlandı. Güncellemeyi tekrar deneyin.",
    kamuSessionBindInvalid:
      "Geçerli oturum çerezi bulunamadı. Network → Cookie satırının tamamını kopyalayın (şifre değil). En az bir session/JSESSIONID/TURKIYE çerezi olmalı.",
    kamuSessionBindUnavailable:
      "Oturum bu sunucu sürecine alınamadı. Sayfayı yenileyip Cookie bağını bir kez daha deneyin.",
    editUpdated: "U-ETDS bildirimi güncellendi.",
    editPartial: "U-ETDS bildirimi kısmen güncellendi. Sonuçları kontrol edin.",
    editConfirmReservationSync:
      "Bu değişiklik bağlı rezervasyondaki şoför/araç atamasına da uygulanacaktır.",
    editCompanyMismatch: "Seçilen şoför/araç mevcut U-ETDS bildiriminin firmasıyla uyumlu değil.",
    editAssignmentFailed: "U-ETDS güncellendi ancak rezervasyon ataması doğrulanamadı.",
    editFleetVerifyFailed: "Bakanlık şoför/araç durumu beklenen değerle uyuşmuyor.",
    groupFare: "Grup Ücreti",
    groupPurpose: "Grup Açıklaması",
    notifyCompany: "Bildirim Firması",
  },
  en: {
    fillFromDocument: "Fill from document",
    addFile: "Add file",
    addImages: "Add images",
    pasteText: "Add description",
    removeSource: "Remove source",
    pastePlaceholder: "Write or paste reservation details, missing information or explicit corrections.",
    extract: "Analyze",
    extracting: "Analyzing document...",
    extractApplied: "AI filled in the details. Please review them before sending.",
    aiUnavailable: "AI extraction is currently unavailable. You can fill the form manually.",
    aiModelUnavailable: "The selected AI model is unavailable for this account. Contact your administrator or fill the form manually.",
    aiTimeout: "AI extraction timed out. Your details were not changed; you can try again.",
    aiUnsupported: "Unsupported file type. Choose PDF, JPG, PNG or WebP.",
    aiBusy: "Please wait for the current AI extraction to finish.",
    aiInputTooLarge: "Text must be at most 30,000 characters.",
    extractPartial: "AI added the available details. Review missing or conflicting fields before sending.",
    extractFailed: "The document could not be read. You can fill the form manually.",
    extractNone: "No new fields could be read from the document.",
    extractImagesHint: "Images were accepted but no text could be read. Fill the form manually.",
    extractConflict: "The document conflicts with a current value. Choose which one is correct.",
    fileTooLarge: "Each file can be at most 10 MB.",
    keepCurrent: "Keep current value",
    useExtracted: "Use document value",
    tripSection: "Trip details",
    origin: "Pickup",
    destination: "Drop-off",
    startDate: "Start date",
    startTime: "Start time",
    endDate: "End date",
    endTime: "End time",
    tripKind: "Trip type",
    tripTransfer: "Transfer",
    tripTour: "Tour",
    tripCharter: "Charter",
    tripOther: "Other",
    groupName: "Group name",
    purpose: "Description / purpose",
    fare: "Group / transport fare",
    verifyLocation: "This location could not be verified for U-ETDS. Please choose another result.",
    verifyAirport: "This location could not be verified for U-ETDS. Please choose another result.",
    locationUnresolved: "This location could not be verified for U-ETDS. Please choose another result.",
    officialConfirmed: "U-ETDS location: {label} ✓",
    correctOfficial: "Correct official location",
    startTooSoon: "The start time is no longer valid. Update it to the earliest allowed time.",
    startAdjusted:
      "The start time was updated. Because of the U-ETDS lead-time rule, the start time is now {time}.",
    endAdjusted: "The end time was updated to {time} to stay after the new start time.",
    endBeforeStart: "The end time must be after the start time.",
    ministryPdfView: "View PDF",
    ministryPdfDownload: "Download PDF",
    ministryPdfUnavailable: "The Ministry trip document could not be retrieved.",
    ministryPdfTitle: "Ministry trip document",
    passengers: "Passengers",
    addPassenger: "+ Add passenger",
    removePassenger: "Remove passenger",
    removePassengerTitle: "Remove this passenger from the notification?",
    removePassengerPrompt: "Are you sure you want to remove this passenger from the notification?",
    removePassengerYes: "Yes, remove",
    notificationDeleted: "The notification was deleted from Tripetica.",
    passengerN: "Passenger {n}",
    nationality: "Nationality",
    identity: "ID No / Passport No",
    identityTc: "National ID",
    identityPassport: "Passport",
    identityOther: "Other",
    firstName: "First name",
    lastName: "Last name",
    firstNamePlaceholder: "Ad giriniz",
    lastNamePlaceholder: "Soyad giriniz",
    identityTcPlaceholder: "T.C. Kimlik No giriniz",
    identityPassportPlaceholder: "Pasaport No giriniz",
    identityOtherPlaceholder: "Kimlik numarası giriniz",
    gender: "Gender",
    genderMale: "Male",
    genderFemale: "Female",
    genderEmpty: "Not selected",
    driverVehicle: "Driver and vehicle",
    driver: "Driver",
    vehicle: "Vehicle",
    selectDriver: "Select a driver",
    selectVehicle: "Select a vehicle",
    noDrivers: "No drivers available.",
    noVehicles: "No vehicles available.",
    eligibleVia: "The U-ETDS notification will be filed through {company}.",
    fromReservation: "From reservation",
    fromDocument: "Filled from document",
    suggested: "Guess — please check",
    missing: "Missing",
    summaryOkTrip: "Trip details complete",
    summaryOkFleet: "Driver and vehicle are eligible for U-ETDS",
    summaryPassengers: "{n} passengers",
    summarySuggested: "{n} guessed fields need review",
    summaryMissing: "{n} required fields missing",
    summaryOkRequired: "Required information is complete",
    send: "Submit U-ETDS notification",
    confirmTitle: "Submit U-ETDS notification",
    confirmYes: "Confirm and submit",
    confirmNo: "Cancel",
    confirmCompany: "Company",
    confirmRoute: "Route",
    confirmWhen: "Date/time",
    confirmPassengers: "Passengers",
    confirmLive: "The notification will be sent to the live U-ETDS service.",
    confirmTestPlate:
      "The U-ETDS TEST environment does not use live authorization vehicles. The official V15 sample plate will be sent: 06TARIFESIZ123",
    saved: "The U-ETDS TEST notification was sent successfully.",
    saveFailed: "The notification could not be saved. Please try again.",
    forbidden: "You are not allowed to do this.",
    testPartial: "The U-ETDS TEST notification completed only in part. Check the trip reference.",
    seferRef: "Trip reference",
    locationManual: "Choose official location",
    locationProvince: "Province",
    locationDistrict: "District",
    locationAirport: "Airport",
    locationTypeDistrict: "Province / district",
    locationTypeAirport: "Airport",
    officialLocation: "Official location",
    placesSearch: "Search a hotel, address or airport",
    noPlaceResults: "No results.",
    placesError: "Location search failed.",
    fieldErrorsTitle: "Complete these before sending:",
    missingOrigin: "Pickup could not be verified for U-ETDS. Please choose another result.",
    missingDestination: "Drop-off could not be verified for U-ETDS. Please choose another result.",
    missingEnd: "End date and time are required.",
    missingStartDate: "Start date is required.",
    missingStartTime: "Start time is required.",
    missingPurpose: "Description / purpose is required.",
    missingDriver: "A driver is required.",
    missingVehicle: "A vehicle is required.",
    missingPassengers: "At least one passenger is required.",
    missingPassengerName: "Passenger first and last name are required.",
    missingPassengerNationality: "Passenger nationality is required.",
    missingPassengerIdentity: "Passenger identity number is required.",
    missingGeneric: "Required information is missing.",
    missingGender: "Passenger gender is required.",
    missingDriverIdentity: "The selected driver is missing a national ID.",
    missingTestCredentials: "U-ETDS TEST credentials are missing.",
    missingLiveCredentials: "Live U-ETDS credentials are missing.",
    ministryFailed: "The U-ETDS TEST service rejected the notification.",
    ministryFailedLive: "The U-ETDS service rejected the notification.",
    savedLive: "The U-ETDS notification was sent successfully.",
    livePartial: "The U-ETDS notification completed only in part. Check the trip reference.",
    liveBlocked: "U-ETDS submission is blocked in this environment.",
    notifyAction: "Create U-ETDS notification",
    notifyEditAction: "Edit U-ETDS notification",
    duplicateReservation:
      "An active U-ETDS notification already exists for this reservation. A new trip was not created.",
    reasonUnassigned: "Assign a driver and vehicle before creating a U-ETDS notification.",
    reasonUnassignedDriver: "Assign a driver before creating a U-ETDS notification.",
    reasonUnassignedVehicle: "Assign a vehicle before creating a U-ETDS notification.",
    reasonExternal: "The driver and vehicle are missing a U-ETDS company link.",
    reasonIncomplete: "The driver or vehicle is missing a U-ETDS company link.",
    reasonMismatch: "The driver and vehicle belong to different U-ETDS companies. Please check.",
    reasonInactive: "The selected U-ETDS company cannot be used for notifications.",
    reasonNotReady: "The selected U-ETDS company cannot be used for notifications.",
    recorded: "Recorded",
    backToList: "Close",
    listStart: "Start",
    listEnd: "End",
    listPlate: "Plate",
    invalidFare: "Enter a valid group / transport fare.",
    listNo: "No",
    filterDate: "Date",
    filterStatus: "Status",
    filterAll: "All",
    filterToday: "Today",
    filterTomorrow: "Tomorrow",
    filterYesterday: "Yesterday",
    filterPast: "Past",
    filterFuture: "Future",
    listActive: "Active",
    listCompleted: "Completed",
    listArchive: "Archive",
    selectAll: "Select all",
    deleteSelected: "Delete selected",
    deleteConfirm: "Permanently delete the selected cancelled records from Tripetica?",
    deleteSummary: "{deleted} records deleted. {failed} records were kept because their cancellation in U-ETDS could not be verified.",
    deleteStillValid: "The notification is still valid in U-ETDS and was not deleted.",
    deleteUnverified: "U-ETDS cancellation could not be verified. The record was kept.",
    cancelVerifiedTitle: "Notification cancelled",
    cancelDeletePrompt: "Your U-ETDS notification was cancelled. Permanently delete this record from Tripetica?",
    deletePermanently: "Permanently delete",
    keepCancelled: "No, keep it",
    cancelUnverified: "The cancellation response was received, but the Ministry cancellation state is not yet verified. The record was kept.",
    filterApply: "Apply",
    listDetail: "Details",
    listSearch: "Search plate, driver, route or U-ETDS number",
    listStatus: "Status",
    verifiedByMinistry: "Verified by the Ministry",
    finalVerificationFailed: "The notification was sent to the Ministry, but final U-ETDS verification could not be completed. Please review the notification.",
    retryVerification: "Retry verification",
    verificationPending: "Verification pending",
    statusSubmitted: "Submitted",
    statusPartial: "Partial",
    statusFailed: "Failed",
    statusCancelled: "Cancelled",
    statusUpdated: "Updated",
    statusPartialUpdate: "Partial update",
    statusUpdateError: "Update error",
    lastPassengerNotify: "Last passenger notification date/time",
    lastPassengerNotifyUnknown: "Not yet verified from the Ministry document",
    edit: "Edit",
    editMethodTitle: "Edit method",
    editMethodFormTitle: "Continue editing in the form",
    editMethodFormBody:
      "Changes are re-notified to U-ETDS through Tripetica. The last notification time for edited passengers may change.",
    editMethodEdevletTitle: "Continue editing via e-Devlet",
    editMethodEdevletBody:
      "You can edit the existing passenger record in the Kamu Application Center. You must be authorized to act for this company via e-Devlet.",
    editMethodEdevletHint:
      "After login and company selection, Sefer Listesi opens. Find this Firma Sefer Numarası in the list: {firmaSeferNo}",
    editMethodEdevletHintGeneric:
      "After login and company selection, find the trip in Sefer Listesi by plate and date.",
    editMethodClose: "Cancel",
    cancelTrip: "Cancel",
    cancelTripConfirm: "This U-ETDS notification will be cancelled. Continue?",
    cancelTripYes: "Yes, cancel it",
    editTitle: "Edit U-ETDS notification",
    editSave: "Save changes",
    editConfirmTitle: "The U-ETDS notification will be updated.",
    editChanges: "Changes:",
    editConfirmYes: "Confirm and update",
    editStartLocked: "Start time is locked because fewer than 61 minutes remain.",
    editStartTooSoon: "Start time must be at least 61 minutes after the current time.",
    editNewPassengerBlocked:
      "A new passenger cannot be notified because fewer than 61 minutes remain before departure. You can still review existing passengers.",
    editRemovedPassengerBlocked:
      "An existing passenger cannot be removed because fewer than 61 minutes remain before departure. You can still correct existing passengers.",
    editPassengerCountLocked:
      "The passenger count is locked because fewer than 61 minutes remain. You can still correct existing passengers and pickup/drop-off.",
    editPassengerCorrectionBlocked:
      "Existing passengers are corrected by Ministry reference. An edited copy is not added as a new passenger.",
    editPassengerCountMismatch:
      "The Ministry passenger count does not match the expected count. The update was not treated as success.",
    editMissingPassengerRef:
      "This existing passenger has no Ministry reference, so the correction was not sent.",
    editKamuSessionRequired:
      "An e-Devlet / Kamu Application Center session is required. Complete login only on the official Kamu site; never enter TCKN or e-Devlet password into Tripetica.",
    editKamuSessionExpired:
      "The Kamu session expired. Sign in again on the official e-Devlet/Kamu portal and bind the session.",
    editKamuFirmRequired:
      "Select your authorized company in the Kamu portal and continue, then retry in Tripetica.",
    editKamuSeferNotFound:
      "The trip could not be found in the Kamu portal. Check firma sefer no / plate / date.",
    editKamuYolcuNotFound:
      "The existing passenger row could not be found in the Kamu portal. Check identity details.",
    editKamuUpdateFailed:
      "The Kamu portal passenger update did not complete. Check the session and trip, then retry.",
    editKamuFlushBlocked:
      "The new-passenger (flush) path is blocked. Only in-place existing passenger updates are allowed.",
    editKamuRefChanged:
      "The passenger reference changed after the portal update. Treated as failure.",
    editKamuVerifyFailed:
      "The portal update could not be verified via Ministry query.",
    kamuLoginOpen: "Open Kamu Application Center",
    kamuLoginFallback: "Open in new tab",
    kamuPopupBlocked:
      "Pop-up was blocked. Use «Open in new tab» or allow pop-ups for this site.",
    kamuSessionBind: "I finished login — bind session (DEV)",
    kamuSessionBindHint:
      "Not an e-Devlet password: paste only the browser Cookie header after login (DEV). Do not paste TCKN/password.",
    kamuSessionBound: "Kamu session bound. Retry the update.",
    kamuSessionBindInvalid:
      "No valid session cookie found. Copy the full Network → Cookie header (not a password). It must include a session/JSESSIONID/TURKIYE cookie.",
    kamuSessionBindUnavailable:
      "The session could not be stored in this server process. Refresh and bind the Cookie once more.",
    editUpdated: "The U-ETDS notification was updated.",
    editPartial: "The U-ETDS notification was only partly updated. Check the results.",
    editConfirmReservationSync:
      "This change will also be applied to the linked reservation driver/vehicle assignment.",
    editCompanyMismatch: "The selected driver/vehicle does not match this U-ETDS notification's company.",
    editAssignmentFailed: "U-ETDS was updated but the reservation assignment could not be verified.",
    editFleetVerifyFailed: "The Ministry driver/vehicle state does not match the expected values.",
    groupFare: "Group fare",
    groupPurpose: "Group description",
    notifyCompany: "Notification company",
  },
  ru: {
    fillFromDocument: "Заполнить из документа",
    addFile: "Добавить файл",
    addImages: "Добавить изображения",
    pasteText: "Добавить описание",
    removeSource: "Удалить источник",
    pastePlaceholder: "Введите или вставьте данные бронирования, недостающую информацию или явные исправления.",
    extract: "Анализировать",
    extracting: "Документ анализируется...",
    extractApplied: "ИИ заполнил данные. Проверьте их перед отправкой.",
    aiUnavailable: "Извлечение данных ИИ сейчас недоступно. Заполните форму вручную.",
    aiModelUnavailable: "Выбранная модель ИИ недоступна для этого аккаунта. Обратитесь к администратору или заполните форму вручную.",
    aiTimeout: "Время ожидания ИИ истекло. Данные не изменены; можно повторить попытку.",
    aiUnsupported: "Этот тип файла не поддерживается. Выберите PDF, JPG, PNG или WebP.",
    aiBusy: "Дождитесь завершения текущей обработки ИИ.",
    aiInputTooLarge: "Текст не должен превышать 30 000 символов.",
    extractPartial: "ИИ добавил найденные данные. Проверьте пропущенные или противоречивые поля перед отправкой.",
    extractFailed: "Не удалось прочитать документ. Заполните форму вручную.",
    extractNone: "Из документа не удалось прочитать новые данные.",
    extractImagesHint: "Изображения приняты, но текст не распознан. Заполните форму вручную.",
    extractConflict: "Документ противоречит текущему значению. Выберите верное.",
    fileTooLarge: "Размер файла не больше 10 МБ.",
    keepCurrent: "Оставить текущее",
    useExtracted: "Взять из документа",
    tripSection: "Данные поездки",
    origin: "Откуда",
    destination: "Куда",
    startDate: "Дата начала",
    startTime: "Время начала",
    endDate: "Дата окончания",
    endTime: "Время окончания",
    tripKind: "Тип перевозки",
    tripTransfer: "Трансфер",
    tripTour: "Тур",
    tripCharter: "Аренда",
    tripOther: "Другое",
    groupName: "Название группы",
    purpose: "Описание / цель",
    fare: "Стоимость перевозки",
    verifyLocation: "Это место не удалось подтвердить для U-ETDS. Выберите другой результат.",
    verifyAirport: "Это место не удалось подтвердить для U-ETDS. Выберите другой результат.",
    locationUnresolved: "Это место не удалось подтвердить для U-ETDS. Выберите другой результат.",
    officialConfirmed: "Локация U-ETDS: {label} ✓",
    correctOfficial: "Исправить официальную локацию",
    startTooSoon: "Время начала больше не действует. Обновите его до ближайшего допустимого.",
    startAdjusted:
      "Время начала обновлено. Из‑за правила U-ETDS время начала теперь {time}.",
    endAdjusted: "Время окончания обновлено на {time}, чтобы остаться после нового начала.",
    endBeforeStart: "Время окончания должно быть позже времени начала.",
    ministryPdfView: "Открыть PDF",
    ministryPdfDownload: "Скачать PDF",
    ministryPdfUnavailable: "Документ рейса министерства сейчас недоступен.",
    ministryPdfTitle: "Документ рейса министерства",
    passengers: "Пассажиры",
    addPassenger: "+ Добавить пассажира",
    removePassenger: "Удалить пассажира",
    removePassengerTitle: "Удалить пассажира из уведомления?",
    removePassengerPrompt: "Вы уверены, что хотите удалить этого пассажира из уведомления?",
    removePassengerYes: "Да, удалить",
    notificationDeleted: "Уведомление удалено из Tripetica.",
    passengerN: "Пассажир {n}",
    nationality: "Гражданство",
    identity: "Номер удостоверения / паспорта",
    identityTc: "Нац. ID",
    identityPassport: "Паспорт",
    identityOther: "Другое",
    firstName: "Имя",
    lastName: "Фамилия",
    firstNamePlaceholder: "Ad giriniz",
    lastNamePlaceholder: "Soyad giriniz",
    identityTcPlaceholder: "T.C. Kimlik No giriniz",
    identityPassportPlaceholder: "Pasaport No giriniz",
    identityOtherPlaceholder: "Kimlik numarası giriniz",
    gender: "Пол",
    genderMale: "Мужской",
    genderFemale: "Женский",
    genderEmpty: "Не выбран",
    driverVehicle: "Водитель и автомобиль",
    driver: "Водитель",
    vehicle: "Автомобиль",
    selectDriver: "Выберите водителя",
    selectVehicle: "Выберите автомобиль",
    noDrivers: "Нет доступных водителей.",
    noVehicles: "Нет доступных автомобилей.",
    eligibleVia: "Уведомление U-ETDS будет подано через {company}.",
    fromReservation: "Из брони",
    fromDocument: "Из документа",
    suggested: "Предположение — проверьте",
    missing: "Не хватает",
    summaryOkTrip: "Данные поездки заполнены",
    summaryOkFleet: "Водитель и автомобиль подходят для U-ETDS",
    summaryPassengers: "Пассажиров: {n}",
    summarySuggested: "Нужно проверить предположений: {n}",
    summaryMissing: "Не хватает обязательных полей: {n}",
    summaryOkRequired: "Обязательные сведения заполнены",
    send: "Отправить уведомление U-ETDS",
    confirmTitle: "Отправить уведомление U-ETDS",
    confirmYes: "Подтвердить и отправить",
    confirmNo: "Отмена",
    confirmCompany: "Компания",
    confirmRoute: "Маршрут",
    confirmWhen: "Дата/время",
    confirmPassengers: "Пассажиры",
    confirmLive: "Уведомление будет отправлено в рабочий сервис U-ETDS.",
    confirmTestPlate:
      "Среда U-ETDS TEST не использует живые транспортные средства. Будет отправлен официальный тестовый номер V15: 06TARIFESIZ123",
    saved: "Уведомление U-ETDS TEST успешно отправлено.",
    saveFailed: "Не удалось сохранить уведомление. Попробуйте ещё раз.",
    forbidden: "Недостаточно прав.",
    testPartial: "Уведомление U-ETDS TEST выполнено частично. Проверьте номер рейса.",
    seferRef: "Номер рейса",
    locationManual: "Выбрать официальную локацию",
    locationProvince: "Ил",
    locationDistrict: "Ильче",
    locationAirport: "Аэропорт",
    locationTypeDistrict: "Ил / ильче",
    locationTypeAirport: "Аэропорт",
    officialLocation: "Официальная локация",
    placesSearch: "Отель, адрес или аэропорт",
    noPlaceResults: "Ничего не найдено.",
    placesError: "Поиск места не удался.",
    fieldErrorsTitle: "Перед отправкой заполните:",
    missingOrigin: "Место посадки не удалось подтвердить для U-ETDS. Выберите другой результат.",
    missingDestination: "Место высадки не удалось подтвердить для U-ETDS. Выберите другой результат.",
    missingEnd: "Нужны дата и время окончания.",
    missingStartDate: "Нужна дата начала.",
    missingStartTime: "Нужно время начала.",
    missingPurpose: "Описание / цель перевозки обязательны.",
    missingDriver: "Нужно выбрать водителя.",
    missingVehicle: "Нужно выбрать автомобиль.",
    missingPassengers: "Нужен хотя бы один пассажир.",
    missingPassengerName: "Нужны имя и фамилия пассажира.",
    missingPassengerNationality: "Нужно гражданство пассажира.",
    missingPassengerIdentity: "Нужен документ пассажира.",
    missingGeneric: "Не хватает обязательной информации.",
    missingGender: "Нужен пол пассажира.",
    missingDriverIdentity: "У выбранного водителя нет номера удостоверения.",
    missingTestCredentials: "Нет учетных данных U-ETDS TEST.",
    missingLiveCredentials: "Нет учетных данных боевого U-ETDS.",
    ministryFailed: "Сервис U-ETDS TEST отклонил уведомление.",
    ministryFailedLive: "Сервис U-ETDS отклонил уведомление.",
    savedLive: "Уведомление U-ETDS успешно отправлено.",
    livePartial: "Уведомление U-ETDS выполнено частично. Проверьте номер рейса.",
    liveBlocked: "Отправка в U-ETDS в этой среде закрыта.",
    notifyAction: "Создать уведомление U-ETDS",
    notifyEditAction: "Изменить уведомление U-ETDS",
    duplicateReservation:
      "Для этой брони уже есть активное уведомление U-ETDS. Новый рейс не создан.",
    reasonUnassigned: "Сначала назначьте водителя и автомобиль.",
    reasonUnassignedDriver: "Сначала назначьте водителя.",
    reasonUnassignedVehicle: "Сначала назначьте автомобиль.",
    reasonExternal: "У водителя и автомобиля нет связи с компанией U-ETDS.",
    reasonIncomplete: "У водителя или автомобиля нет связи с компанией U-ETDS.",
    reasonMismatch: "Водитель и автомобиль привязаны к разным компаниям U-ETDS.",
    reasonInactive: "Выбранная компания U-ETDS недоступна для уведомлений.",
    reasonNotReady: "Выбранная компания U-ETDS недоступна для уведомлений.",
    recorded: "Сохранено",
    backToList: "Закрыть",
    listStart: "Начало",
    listEnd: "Конец",
    listPlate: "Номер",
    invalidFare: "Укажите корректную стоимость перевозки.",
    listNo: "№",
    filterDate: "Дата",
    filterStatus: "Статус",
    filterAll: "Все",
    filterToday: "Сегодня",
    filterTomorrow: "Завтра",
    filterYesterday: "Вчера",
    filterPast: "Прошедшие",
    filterFuture: "Будущие",
    listActive: "Активные",
    listCompleted: "Завершено",
    listArchive: "Архив",
    selectAll: "Выбрать все",
    deleteSelected: "Удалить выбранные",
    deleteConfirm: "Удалить выбранные отменённые записи из Tripetica навсегда?",
    deleteSummary: "Удалено записей: {deleted}. Сохранено: {failed}, поскольку отмена в U-ETDS не подтверждена.",
    deleteStillValid: "Запись действительна в U-ETDS и не удалена.",
    deleteUnverified: "Отмена в U-ETDS не подтверждена. Запись сохранена.",
    cancelVerifiedTitle: "Уведомление отменено",
    cancelDeletePrompt: "Уведомление U-ETDS отменено. Удалить эту запись из Tripetica навсегда?",
    deletePermanently: "Удалить навсегда",
    keepCancelled: "Нет, сохранить",
    cancelUnverified: "Ответ об отмене получен, но статус Министерства ещё не подтверждён. Запись сохранена.",
    filterApply: "Применить",
    listDetail: "Детали",
    listSearch: "Поиск по номеру, водителю, маршруту или U-ETDS",
    listStatus: "Статус",
    verifiedByMinistry: "Подтверждено Министерством",
    finalVerificationFailed: "Уведомление отправлено в Министерство, но итоговая проверка U-ETDS не завершена. Пожалуйста, проверьте уведомление.",
    retryVerification: "Повторить проверку",
    verificationPending: "Ожидает проверки",
    statusSubmitted: "Отправлено",
    statusPartial: "Частично",
    statusFailed: "Ошибка",
    statusCancelled: "Отменено",
    statusUpdated: "Обновлено",
    statusPartialUpdate: "Частичное обновление",
    statusUpdateError: "Ошибка обновления",
    lastPassengerNotify: "Дата/время последнего уведомления о пассажире",
    lastPassengerNotifyUnknown: "Ещё не подтверждено документом министерства",
    edit: "Изменить",
    editMethodTitle: "Способ изменения",
    editMethodFormTitle: "Продолжить изменение через форму",
    editMethodFormBody:
      "Изменения повторно уведомляются в U-ETDS через Tripetica. Время последнего уведомления для изменённых пассажиров может измениться.",
    editMethodEdevletTitle: "Продолжить изменение через e-Devlet",
    editMethodEdevletBody:
      "Вы можете изменить существующую запись пассажира в Центре государственных приложений Kamu. Для этой компании у вас должно быть право действовать через e-Devlet.",
    editMethodEdevletHint:
      "После входа и выбора компании откроется список рейсов. Найдите в списке этот номер рейса фирмы: {firmaSeferNo}",
    editMethodEdevletHintGeneric:
      "После входа и выбора компании найдите рейс в списке по номеру и дате.",
    editMethodClose: "Отмена",
    cancelTrip: "Отменить",
    cancelTripConfirm: "Это уведомление U-ETDS будет отменено. Продолжить?",
    cancelTripYes: "Да, отменить",
    editTitle: "Изменить уведомление U-ETDS",
    editSave: "Сохранить изменения",
    editConfirmTitle: "Уведомление U-ETDS будет обновлено.",
    editChanges: "Изменения:",
    editConfirmYes: "Подтвердить и обновить",
    editStartLocked: "Время начала заблокировано: до выезда меньше 61 минуты.",
    editStartTooSoon: "Время начала должно быть не раньше чем через 61 минуту.",
    editNewPassengerBlocked:
      "Нового пассажира нельзя добавить: до выезда меньше 61 минуты. Существующих пассажиров можно просмотреть.",
    editRemovedPassengerBlocked:
      "Существующего пассажира нельзя удалить: до выезда меньше 61 минуты. Существующих пассажиров можно исправить.",
    editPassengerCountLocked:
      "Число пассажиров заблокировано: до выезда меньше 61 минуты. Можно исправить существующих пассажиров и места посадки/высадки.",
    editPassengerCorrectionBlocked:
      "Существующие пассажиры исправляются по ссылке министерства. Исправленная копия не добавляется как новый пассажир.",
    editPassengerCountMismatch:
      "Число пассажиров в министерстве не совпало с ожидаемым. Обновление не считается успешным.",
    editMissingPassengerRef:
      "У существующего пассажира нет ссылки министерства, исправление не отправлено.",
    editKamuSessionRequired:
      "Нужна сессия e-Devlet / Центра государственных приложений Kamu. Входите только на официальном сайте Kamu; не вводите TCKN или пароль e-Devlet в Tripetica.",
    editKamuSessionExpired:
      "Сессия Kamu истекла. Снова войдите на официальном портале e-Devlet/Kamu и привяжите сессию.",
    editKamuFirmRequired:
      "Выберите уполномоченную фирму на портале Kamu и продолжите, затем повторите в Tripetica.",
    editKamuSeferNotFound:
      "Рейс не найден на портале Kamu. Проверьте номер рейса / номер / дату.",
    editKamuYolcuNotFound:
      "Строка существующего пассажира не найдена на портале Kamu. Проверьте удостоверение.",
    editKamuUpdateFailed:
      "Обновление пассажира на портале Kamu не завершено. Проверьте сессию и рейс.",
    editKamuFlushBlocked:
      "Путь нового пассажира (flush) заблокирован. Разрешено только in-place обновление.",
    editKamuRefChanged:
      "После обновления на портале изменилась ссылка пассажира. Считается ошибкой.",
    editKamuVerifyFailed:
      "Обновление на портале не подтверждено запросом министерства.",
    kamuLoginOpen: "Открыть Центр приложений Kamu",
    kamuLoginFallback: "Открыть в новой вкладке",
    kamuPopupBlocked:
      "Всплывающее окно заблокировано. Используйте «Открыть в новой вкладке» или разрешите pop-up.",
    kamuSessionBind: "Вход завершён — привязать сессию (DEV)",
    kamuSessionBindHint:
      "Не пароль e-Devlet: вставьте только Cookie после входа (DEV). Не вставляйте TCKN/пароль.",
    kamuSessionBound: "Сессия Kamu привязана. Повторите обновление.",
    kamuSessionBindInvalid:
      "Не найден корректный session cookie. Скопируйте полный Cookie из Network (не пароль). Нужен session/JSESSIONID/TURKIYE.",
    kamuSessionBindUnavailable:
      "Сессию не удалось сохранить в этом процессе сервера. Обновите страницу и привяжите Cookie ещё раз.",
    editUpdated: "Уведомление U-ETDS обновлено.",
    editPartial: "Уведомление U-ETDS обновлено только частично. Проверьте результат.",
    editConfirmReservationSync:
      "Это изменение также будет применено к назначению водителя/автомобиля в связанном бронировании.",
    editCompanyMismatch: "Выбранные водитель/автомобиль не соответствуют фирме этого уведомления U-ETDS.",
    editAssignmentFailed: "U-ETDS обновлён, но назначение бронирования не подтверждено.",
    editFleetVerifyFailed: "Состояние водителя/автомобиля в министерстве не совпало с ожидаемым.",
    groupFare: "Стоимость группы",
    groupPurpose: "Описание группы",
    notifyCompany: "Компания уведомления",
  },
} as const;

export type UetdsFormCopy = (typeof uetdsFormCopy)[PanelLocale];

export function uetdsFormCopyFor(locale: Locale): UetdsFormCopy {
  return uetdsFormCopy[asPanelLocale(locale)];
}

export function uetdsEligibilityMessage(reason: UetdsEligibilityReason, copy: UetdsFormCopy) {
  if (reason === "eligible") {
    return "";
  }
  if (reason === "mismatch") {
    return copy.reasonMismatch;
  }
  if (reason === "inactive") {
    return copy.reasonInactive;
  }
  if (reason === "not-ready") {
    return copy.reasonNotReady;
  }
  if (reason === "external") {
    return copy.reasonExternal;
  }
  if (reason === "incomplete") {
    return copy.reasonIncomplete;
  }
  if (reason === "unassigned-driver") {
    return copy.reasonUnassignedDriver;
  }
  if (reason === "unassigned-vehicle") {
    return copy.reasonUnassignedVehicle;
  }
  return copy.reasonUnassigned;
}

export function replaceCount(template: string, count: number) {
  return template.replace("{n}", String(count));
}

export function replaceCompany(template: string, company: string) {
  return template.replace("{company}", company);
}

export function replaceTime(template: string, time: string) {
  return template.replace("{time}", time);
}

export function uetdsStatusLabel(status: string, copy: UetdsFormCopy) {
  if (status === "submitted") {
    return copy.statusSubmitted;
  }
  if (status === "partial") {
    return copy.statusPartial;
  }
  if (status === "failed") {
    return copy.statusFailed;
  }
  if (status === "cancelled") {
    return copy.statusCancelled;
  }
  if (status === "updated") {
    return copy.statusUpdated;
  }
  if (status === "partial_update") {
    return copy.statusPartialUpdate;
  }
  if (status === "update_error") {
    return copy.statusUpdateError;
  }
  return copy.recorded;
}

export function uetdsMissingFieldMessage(key: string, copy: UetdsFormCopy) {
  if (key === "origin") {
    return copy.missingOrigin;
  }
  if (key === "destination") {
    return copy.missingDestination;
  }
  if (key === "startDate") {
    return copy.missingStartDate;
  }
  if (key === "startTime") {
    return copy.missingStartTime;
  }
  if (key === "endDate" || key === "endTime") {
    return copy.missingEnd;
  }
  if (key === "startTooSoon") {
    return copy.startTooSoon;
  }
  if (key === "endBeforeStart") {
    return copy.endBeforeStart;
  }
  if (key === "fare") return copy.invalidFare;
  if (key === "purpose") {
    return copy.missingPurpose;
  }
  if (key === "driverId") {
    return copy.missingDriver;
  }
  if (key === "vehicleId") {
    return copy.missingVehicle;
  }
  if (key === "passengers") {
    return copy.missingPassengers;
  }
  if (key.endsWith(".gender")) {
    return copy.missingGender;
  }
  if (key.endsWith(".name") || key.endsWith(".firstName") || key.endsWith(".lastName")) {
    return copy.missingPassengerName;
  }
  if (key.endsWith(".nationality")) {
    return copy.missingPassengerNationality;
  }
  if (key.endsWith(".identity")) {
    return copy.missingPassengerIdentity;
  }
  return copy.missingGeneric;
}
