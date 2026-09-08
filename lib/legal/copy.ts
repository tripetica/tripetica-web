import { type Locale } from "@/lib/i18n/config";
import { type LegalSlug } from "./catalog";

export type LegalTextPart =
  | string
  | { slug: LegalSlug; label: string };

export type LegalSection = {
  title?: string;
  paragraphs: Array<string | LegalTextPart[]>;
  bullets?: string[];
  afterBullets?: Array<string | LegalTextPart[]>;
};

export type LegalDocumentCopy = {
  metaTitle: string;
  metaDescription: string;
  h1: string;
  updated?: string;
  sections: LegalSection[];
};

export const legalDocuments: Record<
  Locale,
  Record<LegalSlug, LegalDocumentCopy>
> = {
  tr: {
    "preliminary-information": {
      metaTitle: "Ön Bilgilendirme Formu | Tripetica",
      metaDescription:
        "Tripetica.com üzerinden özel transfer, havalimanı transferi ve şoförlü araç rezervasyonu için ön bilgilendirme formu.",
      h1: "Ön Bilgilendirme Formu",
      sections: [
        {
          paragraphs: [
            "Tripetica.com üzerinden yapılacak özel transfer, havalimanı transferi, şoförlü araç ve benzeri ulaşım hizmeti rezervasyonları için kullanıcıya/hizmet alıcısına rezervasyon tamamlanmadan önce temel bilgileri sunmak amacıyla hazırlanmıştır.",
          ],
        },
        {
          title: "1. Hizmet sağlayıcı bilgileri",
          paragraphs: [
            "Tripetica.com, Search Travel Agency Turizm Taşımacılık Ticaret Limited Şirketi tarafından işletilen bir markadır.",
            "Şirketin resmi adresi, vergi dairesi, vergi numarası, lisans bilgileri ve diğer yasal bilgileri Yasal Bilgiler sayfasında ayrıca gösterilir.",
          ],
        },
        {
          title: "2. Hizmetin konusu",
          paragraphs: [
            "Hizmetin konusu, kullanıcının Tripetica.com üzerinden seçtiği alış noktası, bırakma noktası, tarih, saat, yolcu sayısı, bagaj bilgisi, araç sınıfı ve varsa ek hizmetlere göre özel transfer, havalimanı transferi, şoförlü araç veya benzeri ulaşım hizmetinin sağlanmasıdır.",
          ],
        },
        {
          title: "3. Rezervasyon bilgileri",
          paragraphs: [
            "Kullanıcı rezervasyon sırasında alış noktası, bırakma noktası, tarih, saat, yolcu sayısı, bagaj sayısı, iletişim bilgileri ve gerekiyorsa uçuş numarası, tren/otobüs/gemi sefer bilgisi gibi bilgileri girer.",
            "Kullanıcı, rezervasyon sırasında verdiği bilgilerin doğru, güncel ve eksiksiz olmasından sorumludur. Yanlış veya eksik bilgi nedeniyle hizmetin sağlanamaması, gecikme yaşanması, yanlış noktaya gidilmesi veya no-show oluşması halinde sorumluluk kullanıcıya ait olabilir.",
          ],
        },
        {
          title: "4. Fiyat ve ödeme",
          paragraphs: [
            "Rezervasyon sırasında gösterilen fiyat; seçilen hizmet türü, rota, mesafe, araç sınıfı, yolcu sayısı, bagaj bilgisi, ek hizmetler ve seçilen ödeme yöntemine göre hesaplanır.",
            "Kullanıcı, rezervasyonu tamamlamadan önce toplam fiyatı ve ödeme yöntemini görür.",
            "Kullanıcının rezervasyonu tamamlaması veya online ödeme sayfasına devam etmesi, seçilen hizmet için ödeme yükümlülüğü doğurduğunu kabul ettiği anlamına gelir.",
          ],
        },
        {
          title: "5. Ek ücretler ve ek hizmetler",
          paragraphs: [
            "Rezervasyon sırasında seçilen fazla yolcu, fazla bagaj, bebek koltuğu, karşılama hizmeti veya benzeri ek hizmetler, araç seçim ekranında ve/veya rezervasyon özetinde kullanıcıya gösterilir. Kullanıcı, rezervasyonu tamamlamadan önce toplam fiyatı ve varsa ek hizmet ücretlerini görerek kabul eder.",
            "Rezervasyon tamamlandıktan sonra talep edilen ek durak, rota değişikliği, 8. maddede düzenlenen bekleme süreleri dışındaki ekstra bekleme, farklı varış noktası, ilave yolcu, fazla bagaj veya benzeri operasyonel değişiklikler ek ücrete tabi olabilir.",
            "Ek ücret gerektiren durumlarda kullanıcıya mümkün olduğu ölçüde önceden bilgi verilir.",
          ],
        },
        {
          title: "6. Araç sınıfı",
          paragraphs: [
            "Rezervasyon sırasında gösterilen araç modelleri temsilidir. Hizmet sağlayıcı, operasyonel uygunluk, araç müsaitliği, yasal gereklilikler veya hizmet kalitesi nedeniyle kullanıcının seçtiği araç sınıfına eşdeğer ya da daha üst sınıf bir araç gönderebilir.",
            "Operasyonel zorunluluk, teknik arıza, kaza, trafik koşulları, araç müsaitliği veya benzeri nedenlerle kullanıcının ödeme yaptığı araç sınıfından daha alt bir araç sınıfı sağlanırsa, kullanıcı ödediği araç sınıfı ile fiilen sağlanan araç sınıfı arasındaki fiyat farkının iadesini talep edebilir.",
          ],
        },
        {
          title: "7. İptal ve iade",
          paragraphs: [
            [
              "Tripetica.com üzerinden yapılan rezervasyonlarda iptal ve iade şartları ",
              {
                slug: "cancellation-refund-policy",
                label: "İptal ve İade Politikası",
              },
              " sayfasında açıklanır.",
            ],
            "Genel kural olarak rezervasyon, hizmet başlangıç saatine 6 saatten fazla süre kaldığı sürece iptal edilebilir veya değiştirilebilir.",
            "İzin verilen süre içinde yapılan iptallerde, önceden tahsil edilmiş ve henüz iade edilmemiş net tutarın %100’ü iade edilir. Hizmet başlangıcına 6 saat veya daha az kaldığında iptal veya değişiklik yapılamaz. No-show durumunda ödeme iade edilmeyebilir.",
          ],
        },
        {
          title: "8. Ücretsiz bekleme süreleri ve no-show",
          paragraphs: [
            "Alış noktasına göre ücretsiz bekleme süreleri; havalimanlarında 90 dakika, gar, otogar, liman, kruvaziyer terminali ve benzeri noktalarda 30 dakika, otel, özel adres, hastane, iş yeri, restoran ve benzeri noktalarda 20 dakikadır.",
            "Transfer hizmetlerinde, ilgili ücretsiz bekleme süresi sona erdiği halde yolcunun belirlenen alış veya buluşma noktasına gelmemesi halinde rezervasyon no-show olarak değerlendirilebilir. No-show olarak değerlendirilen rezervasyonlarda hizmet bedeli iade edilmez.",
            "Belirli bir süre için satın alınan Saatlik Şoförlü Araç ve aynı süre esasına tabi hizmetlerde ise ücretsiz bekleme süresinin sona ermesi doğrudan no-show oluşturmaz. Şoför yolcuyu beklemeye devam eder ve ücretsiz bekleme süresinin sona erdiği andan itibaren satın alınan hizmet süresi işlemeye başlar. Bu andan sonra geçen bekleme süresi müşterinin satın aldığı toplam hizmet süresinden düşülür. Yolcunun daha sonra gelmesi halinde hizmet, kalan süre boyunca devam eder. Satın alınan hizmet süresinin tamamı sona erdiği halde yolcunun hizmeti başlatmamış olması halinde rezervasyon no-show olarak değerlendirilebilir.",
            "Sabit program veya hareket saatine bağlı tur ve etkinliklerde, ilgili hizmet için rezervasyon sırasında ve rezervasyon belgesinde bildirilen özel katılım, buluşma, servis ve hareket saati kuralları uygulanır.",
          ],
        },
        {
          title: "9. Cayma hakkı ve hizmetin niteliği",
          paragraphs: [
            "Kullanıcı, rezervasyonun belirli bir tarih ve saatte sağlanacak özel ulaşım, transfer, araç tahsisi veya şoförlü araç hizmetine ilişkin olduğunu kabul eder.",
            [
              "Hizmetin belirli bir tarih ve saate bağlı olması ve araç/operasyon planlamasının bu rezervasyona göre yapılması nedeniyle, cayma hakkı ve iptal işlemleri ilgili mevzuat, hizmetin niteliği ve Tripetica.com ",
              {
                slug: "cancellation-refund-policy",
                label: "İptal ve İade Politikası",
              },
              " kapsamında değerlendirilir.",
            ],
            "Kullanıcı, rezervasyonu tamamlamadan önce iptal ve iade şartlarını okuyup kabul ettiğini onaylar.",
          ],
        },
        {
          title: "10. Kişisel veriler",
          paragraphs: [
            "Kullanıcıdan alınan ad, soyad, telefon, e-posta, alış ve bırakış konumları, uçuş numarası, yolcu bilgileri, uyruk, pasaport bilgisi ve benzeri bilgiler; rezervasyonun oluşturulması, hizmetin sağlanması, yasal bildirimlerin yapılması, müşteri desteği ve operasyonel iletişim amacıyla kullanılabilir.",
            [
              "Kişisel verilerin işlenmesine ilişkin detaylar ",
              { slug: "privacy-policy", label: "Gizlilik Politikası" },
              " sayfasında açıklanır.",
            ],
          ],
        },
        {
          title: "11. İletişim",
          paragraphs: [
            "Rezervasyon, değişiklik, iptal, ödeme, operasyonel destek ve şikayetler için Tripetica.com iletişim kanalları kullanılabilir.",
            "Güncel iletişim bilgileri sitenin Footer bölümündeki İletişim alanında gösterilir.",
          ],
        },
        {
          title: "12. Onay",
          paragraphs: [
            [
              "Kullanıcı, rezervasyonu tamamlamadan veya online ödeme sayfasına devam etmeden önce Ön Bilgilendirme Formu’nu, Mesafeli Hizmet Satış Sözleşmesi’ni, ",
              {
                slug: "cancellation-refund-policy",
                label: "İptal ve İade Politikası",
              },
              "’nı ve ",
              { slug: "privacy-policy", label: "Gizlilik Politikası" },
              "’nı okuduğunu, anladığını ve kabul ettiğini onaylar.",
            ],
          ],
        },
        {
          paragraphs: ["Belge sürümü:", "pre_info_v1.0_2026-07-01"],
        },
      ],
    },
    "distance-sales-agreement": {
      metaTitle: "Mesafeli Hizmet Satış Sözleşmesi | Tripetica",
      metaDescription:
        "Tripetica.com üzerinden özel transfer, havalimanı transferi ve şoförlü araç rezervasyonları için mesafeli hizmet satış sözleşmesi.",
      h1: "Mesafeli Hizmet Satış Sözleşmesi",
      sections: [
        {
          paragraphs: [
            "Tripetica.com üzerinden yapılan özel transfer, havalimanı transferi, şoförlü araç ve benzeri ulaşım hizmeti rezervasyonlarında, hizmet sağlayıcı ile kullanıcı/hizmet alıcısı arasındaki temel hak ve yükümlülükleri düzenlemek amacıyla hazırlanmıştır.",
          ],
        },
        {
          title: "1. Taraflar",
          paragraphs: [
            "Hizmet sağlayıcı:",
            "Tripetica.com, Search Travel Agency Turizm Taşımacılık Ticaret Limited Şirketi tarafından işletilen bir markadır.",
            "Kullanıcı / hizmet alıcısı:",
            "Tripetica.com üzerinden rezervasyon oluşturan, hizmet satın alan veya adına hizmet alınan gerçek ya da tüzel kişidir.",
            "Kullanıcı, rezervasyon oluştururken verdiği bilgilerin doğru, güncel ve eksiksiz olduğunu kabul eder.",
          ],
        },
        {
          title: "2. Sözleşmenin konusu",
          paragraphs: [
            "Bu sözleşmenin konusu, kullanıcının Tripetica.com üzerinden seçtiği alış noktası, bırakma noktası, tarih, saat, yolcu sayısı, bagaj bilgisi, araç sınıfı ve varsa ek hizmetlere göre özel transfer, havalimanı transferi, şoförlü araç veya benzeri ulaşım hizmetinin sağlanmasıdır.",
          ],
        },
        {
          title: "3. Rezervasyonun oluşturulması",
          paragraphs: [
            "Kullanıcı, Tripetica.com üzerinden gerekli rezervasyon bilgilerini girerek araç sınıfını, fiyatı ve ödeme yöntemini görür.",
            [
              "Kullanıcının rezervasyonu tamamlaması veya online ödeme sayfasına devam etmesi, bu sözleşmeyi, ",
              {
                slug: "preliminary-information",
                label: "Ön Bilgilendirme Formu",
              },
              "’nu, ",
              {
                slug: "cancellation-refund-policy",
                label: "İptal ve İade Politikası",
              },
              "’nı ve ",
              { slug: "privacy-policy", label: "Gizlilik Politikası" },
              "’nı okuduğunu, anladığını ve kabul ettiğini gösterir.",
            ],
            "Rezervasyon, Tripetica sistemi üzerinde rezervasyon kodu ile oluşturulduğunda tamamlanmış sayılır. Kullanıcıya gönderilen rezervasyon onayı, oluşturulan rezervasyonun bilgilendirme ve teyit kaydı niteliğindedir.",
          ],
        },
        {
          title: "4. Fiyat ve ödeme yükümlülüğü",
          paragraphs: [
            "Rezervasyon sırasında gösterilen fiyat; seçilen hizmet türü, rota, mesafe, araç sınıfı, yolcu sayısı, bagaj bilgisi, ek hizmetler ve seçilen ödeme yöntemine göre hesaplanır.",
            "Kullanıcı, rezervasyonu tamamlamadan önce toplam fiyatı görür.",
            "Kullanıcının rezervasyonu tamamlaması veya online ödeme sayfasına devam etmesi, seçilen hizmet için ödeme yükümlülüğü doğurduğunu kabul ettiği anlamına gelir.",
          ],
        },
        {
          title: "5. Ek hizmetler ve ek ücretler",
          paragraphs: [
            "Rezervasyon sırasında seçilen fazla yolcu, fazla bagaj, bebek koltuğu, karşılama hizmeti veya benzeri ek hizmetler, araç seçim ekranında ve/veya rezervasyon özetinde kullanıcıya gösterilir. Kullanıcı, rezervasyonu tamamlamadan önce toplam fiyatı ve varsa ek hizmet ücretlerini görerek kabul eder.",
            "Rezervasyon tamamlandıktan sonra talep edilen ek durak, rota değişikliği, farklı varış noktası, ilave yolcu, fazla bagaj, satın alınan hizmet kapsamı veya süresi dışındaki ilave bekleme ve benzeri operasyonel değişiklikler ek ücrete tabi olabilir.",
            "Ek ücret gerektiren durumlarda kullanıcıya mümkün olduğu ölçüde önceden bilgi verilir.",
          ],
        },
        {
          title: "6. Kullanıcının yükümlülükleri",
          paragraphs: [
            "Kullanıcı; alış noktası, bırakma noktası, tarih, saat, yolcu sayısı, bagaj sayısı, iletişim bilgileri ve gerekiyorsa uçuş numarası, tren/otobüs/gemi sefer bilgisi gibi bilgileri doğru ve eksiksiz vermekle yükümlüdür.",
            "Yanlış veya eksik bilgi nedeniyle hizmetin sağlanamaması, gecikme yaşanması, yanlış noktaya gidilmesi veya no-show oluşması halinde sorumluluk kullanıcıya ait olabilir.",
            "Kullanıcı, rezervasyon sırasında belirttiği yolcu sayısı ve bagaj kapasitesine uygun araç sınıfı seçmekle sorumludur.",
          ],
        },
        {
          title: "7. Hizmet sağlayıcının yükümlülükleri",
          paragraphs: [
            "Hizmet sağlayıcı, onaylanan rezervasyon bilgilerine uygun şekilde hizmeti sağlamak için gerekli operasyonel planlamayı yapar.",
            "Hizmet sağlayıcı, operasyonel uygunluk, araç müsaitliği, trafik, yol durumu, güvenlik, teknik arıza veya benzeri nedenlerle hizmetin sağlanma şeklinde makul değişiklikler yapabilir.",
          ],
        },
        {
          title: "8. Araç sınıfı ve araç değişiklikleri",
          paragraphs: [
            "Rezervasyon sırasında gösterilen araç modelleri temsilidir. Aynı sınıfta veya benzer özelliklerde farklı marka/model araç sağlanabilir.",
            "Hizmet sağlayıcı, operasyonel uygunluk, araç müsaitliği, yasal gereklilikler veya hizmet kalitesi nedeniyle kullanıcının seçtiği araç sınıfına eşdeğer ya da daha üst sınıf bir araç gönderebilir.",
            "Operasyonel zorunluluk, teknik arıza, kaza, trafik koşulları, araç müsaitliği veya benzeri nedenlerle kullanıcının ödeme yaptığı araç sınıfından daha alt bir araç sınıfı sağlanırsa, kullanıcı ödediği araç sınıfı ile fiilen sağlanan araç sınıfı arasındaki fiyat farkının iadesini talep edebilir.",
          ],
        },
        {
          title: "9. Ücretsiz bekleme süreleri",
          paragraphs: [
            "Ücretsiz bekleme süresi, alış noktasının türüne ve kullanıcının rezervasyon sırasında paylaştığı bilgilere göre değerlendirilir.",
            "Havalimanı alışlarında, kullanıcı rezervasyon sırasında geçerli bir uçuş numarası paylaşmışsa ücretsiz bekleme süresi uçağın gerçek iniş saatinden itibaren başlar. Uçuş numarası paylaşılmamışsa veya uçuş bilgisi doğrulanamıyorsa, ücretsiz bekleme süresi kullanıcının rezervasyon sırasında belirttiği tarih ve saatten itibaren başlar.",
            "Tren garı, otobüs terminali, liman, kruvaziyer terminali veya benzeri ulaşım noktalarındaki alışlarda, kullanıcı rezervasyon sırasında geçerli sefer bilgisi paylaşmışsa ücretsiz bekleme süresi tren, otobüs, gemi veya ilgili ulaşım aracının gerçek varış saatinden itibaren başlar. Sefer bilgisi paylaşılmamışsa veya doğrulanamıyorsa, ücretsiz bekleme süresi kullanıcının rezervasyon sırasında belirttiği tarih ve saatten itibaren başlar.",
            "Otel, özel adres, hastane, iş yeri, restoran veya benzeri diğer alış noktalarında ücretsiz bekleme süresi kullanıcının rezervasyon sırasında belirttiği tarih ve saatten itibaren başlar.",
            "Ücretsiz bekleme süreleri aşağıdaki şekildedir:",
          ],
          bullets: [
            "Havalimanı alışları: 90 dakika",
            "Tren garı, otobüs terminali, liman, kruvaziyer terminali ve benzeri ulaşım noktaları: 30 dakika",
            "Otel, özel adres, hastane, iş yeri, restoran ve diğer alış noktaları: 20 dakika",
          ],
          afterBullets: [
            "Transfer hizmetlerinde, ilgili ücretsiz bekleme süresi sona erdiği halde yolcunun belirlenen alış veya buluşma noktasına gelmemesi halinde rezervasyon no-show olarak değerlendirilebilir.",
            "Belirli bir süre için satın alınan Saatlik Şoförlü Araç ve aynı süre esasına tabi hizmetlerde ise ücretsiz bekleme süresinin sona ermesi doğrudan no-show oluşturmaz. Şoför yolcuyu beklemeye devam eder ve ücretsiz bekleme süresinin sona erdiği andan itibaren satın alınan hizmet süresi işlemeye başlar. Bu andan sonra geçen bekleme süresi müşterinin satın aldığı toplam hizmet süresinden düşülür. Yolcunun daha sonra gelmesi halinde hizmet, kalan süre boyunca devam eder. Satın alınan hizmet süresinin tamamı sona erdiği halde yolcunun hizmeti başlatmamış olması halinde rezervasyon no-show olarak değerlendirilebilir.",
            "Sabit program veya hareket saatine bağlı tur ve etkinliklerde, ilgili hizmet için rezervasyon sırasında ve rezervasyon belgesinde bildirilen özel katılım, buluşma, servis ve hareket saati kuralları uygulanır.",
          ],
        },
        {
          title: "10. İptal, iade ve no-show",
          paragraphs: [
            [
              "İptal, iade ve no-show şartları ayrıca ",
              {
                slug: "cancellation-refund-policy",
                label: "İptal ve İade Politikası",
              },
              " sayfasında açıklanır.",
            ],
            "Genel kural olarak rezervasyon, hizmet başlangıç saatine 6 saatten fazla süre kaldığı sürece iptal edilebilir veya değiştirilebilir.",
            "İzin verilen süre içinde yapılan iptallerde, önceden tahsil edilmiş ve henüz iade edilmemiş net tutarın %100’ü iade edilir. Hizmet başlangıcına 6 saat veya daha az kaldığında iptal veya değişiklik yapılamaz. 9. maddede belirtilen koşullara göre oluşan no-show durumlarında ödeme iade edilmeyebilir.",
          ],
        },
        {
          title: "11. Cayma hakkı ve hizmetin niteliği",
          paragraphs: [
            "Kullanıcı, rezervasyonun belirli bir tarih ve saatte sağlanacak özel ulaşım, transfer, araç tahsisi veya şoförlü araç hizmetine ilişkin olduğunu kabul eder.",
            [
              "Hizmetin belirli bir tarih ve saate bağlı olması ve araç/operasyon planlamasının bu rezervasyona göre yapılması nedeniyle, cayma hakkı ve iptal işlemleri ilgili mevzuat, hizmetin niteliği ve Tripetica.com ",
              {
                slug: "cancellation-refund-policy",
                label: "İptal ve İade Politikası",
              },
              " kapsamında değerlendirilir.",
            ],
          ],
        },
        {
          title: "12. Mücbir sebepler ve operasyonel durumlar",
          paragraphs: [
            "Trafik yoğunluğu, kaza, yol kapanması, hava koşulları, resmi güvenlik önlemleri, araç arızası, uçuş/ulaşım gecikmeleri, doğal afetler, toplumsal olaylar veya hizmet sağlayıcının makul kontrolü dışında gelişen benzeri durumlarda hizmette gecikme, rota değişikliği, araç değişikliği veya operasyonel düzenleme yapılabilir.",
            "Bu tür durumlarda hizmet sağlayıcı, mümkün olduğu ölçüde kullanıcıyı bilgilendirmeye ve hizmeti makul şekilde sağlamaya çalışır.",
          ],
        },
        {
          title: "13. Kişisel veriler",
          paragraphs: [
            "Kullanıcıdan alınan ad, soyad, telefon, e-posta, alış ve bırakış konumları, uçuş numarası, yolcu bilgileri, uyruk, pasaport bilgisi ve benzeri bilgiler; rezervasyonun oluşturulması, hizmetin sağlanması, yasal bildirimlerin yapılması, müşteri desteği ve operasyonel iletişim amacıyla kullanılabilir.",
            [
              "Kişisel verilerin işlenmesine ilişkin detaylar ",
              { slug: "privacy-policy", label: "Gizlilik Politikası" },
              " sayfasında açıklanır.",
            ],
          ],
        },
        {
          title: "14. İletişim",
          paragraphs: [
            "Rezervasyon, değişiklik, iptal, ödeme, operasyonel destek ve şikayetler için Tripetica.com iletişim kanalları kullanılabilir.",
            "Güncel iletişim bilgileri sitenin Footer bölümündeki İletişim alanında gösterilir.",
          ],
        },
        {
          title: "15. Yürürlük ve onay",
          paragraphs: [
            [
              "Kullanıcı, rezervasyonu tamamlamadan veya online ödeme sayfasına devam etmeden önce bu Mesafeli Hizmet Satış Sözleşmesi’ni, ",
              {
                slug: "preliminary-information",
                label: "Ön Bilgilendirme Formu",
              },
              "’nu, ",
              {
                slug: "cancellation-refund-policy",
                label: "İptal ve İade Politikası",
              },
              "’nı ve ",
              { slug: "privacy-policy", label: "Gizlilik Politikası" },
              "’nı okuduğunu, anladığını ve kabul ettiğini onaylar.",
            ],
            "Bu sözleşme, kullanıcının rezervasyonu tamamlamasıyla birlikte yürürlüğe girer.",
          ],
        },
        {
          paragraphs: ["service_agreement_v1.0_2026-07-01"],
        },
      ],
    },
    "cancellation-refund-policy": {
      metaTitle: "İptal ve İade Politikası | Tripetica",
      metaDescription:
        "Tripetica.com üzerinden yapılan transfer ve şoförlü araç rezervasyonlarında iptal, iade, ücretsiz bekleme ve no-show şartları.",
      h1: "İptal ve İade Politikası",
      sections: [
        {
          paragraphs: [
            "Tripetica.com üzerinden yapılan özel transfer, havalimanı transferi, şoförlü araç ve benzeri ulaşım hizmeti rezervasyonlarında uygulanacak iptal, iade, ücretsiz bekleme ve no-show şartlarını açıklamak amacıyla hazırlanmıştır.",
          ],
        },
        {
          title: "1. Genel kapsam",
          paragraphs: [
            "Bu politika, Tripetica.com üzerinden oluşturulan rezervasyonlar için geçerlidir.",
            "Kullanıcı, rezervasyonu tamamlamadan veya online ödeme sayfasına devam etmeden önce bu İptal ve İade Politikası’nı okuduğunu, anladığını ve kabul ettiğini onaylar.",
          ],
        },
        {
          title: "2. İptal ve değişiklik hakkı",
          paragraphs: [
            "Genel kural olarak rezervasyon, hizmet başlangıç saatine 6 saatten fazla süre kaldığı sürece iptal edilebilir veya değiştirilebilir.",
            "İzin verilen süre içinde yapılan iptallerde, online ödeme yapılmışsa önceden tahsil edilmiş ve henüz iade edilmemiş net tutarın %100’ü iade edilir. Şoföre nakit ödeme seçilmişse kullanıcıdan herhangi bir hizmet bedeli tahsil edilmez.",
          ],
        },
        {
          title: "3. 6 saat veya daha az kala yapılan iptal ve değişiklik talepleri",
          paragraphs: [
            "Hizmet başlangıç saatine 6 saat veya daha az kaldığında müşteri rezervasyonu iptal edemez veya değiştiremez ve ödeme iade edilmez.",
            "Şoföre nakit ödeme seçeneğiyle yapılan rezervasyonlarda, hizmet sağlayıcı tekrarlanan, kötüye kullanım niteliğinde veya operasyonel zarara sebep olan rezervasyonları ileride reddetme hakkını saklı tutar.",
          ],
        },
        {
          title: "4. Ücretsiz bekleme süreleri",
          paragraphs: [
            "Ücretsiz bekleme süresi, alış noktasının türüne ve kullanıcının rezervasyon sırasında paylaştığı bilgilere göre değerlendirilir.",
            "Havalimanı alışlarında, kullanıcı rezervasyon sırasında geçerli bir uçuş numarası paylaşmışsa ücretsiz bekleme süresi uçağın gerçek iniş saatinden itibaren başlar. Uçuş numarası paylaşılmamışsa veya uçuş bilgisi doğrulanamıyorsa, ücretsiz bekleme süresi kullanıcının rezervasyon sırasında belirttiği tarih ve saatten itibaren başlar.",
            "Tren garı, otobüs terminali, liman, kruvaziyer terminali veya benzeri ulaşım noktalarındaki alışlarda, kullanıcı rezervasyon sırasında geçerli sefer bilgisi paylaşmışsa ücretsiz bekleme süresi tren, otobüs, gemi veya ilgili ulaşım aracının gerçek varış saatinden itibaren başlar. Sefer bilgisi paylaşılmamışsa veya doğrulanamıyorsa, ücretsiz bekleme süresi kullanıcının rezervasyon sırasında belirttiği tarih ve saatten itibaren başlar.",
            "Otel, özel adres, hastane, iş yeri, restoran veya benzeri diğer alış noktalarında ücretsiz bekleme süresi kullanıcının rezervasyon sırasında belirttiği tarih ve saatten itibaren başlar.",
            "Ücretsiz bekleme süreleri aşağıdaki şekildedir:",
          ],
          bullets: [
            "Havalimanı alışları: 90 dakika",
            "Tren garı, otobüs terminali, liman, kruvaziyer terminali ve benzeri ulaşım noktaları: 30 dakika",
            "Otel, özel adres, hastane, iş yeri, restoran ve diğer alış noktaları: 20 dakika",
          ],
        },
        {
          title: "5. No-show",
          paragraphs: [
            "Transfer hizmetlerinde, ilgili ücretsiz bekleme süresi sona erdiği halde yolcunun belirlenen alış veya buluşma noktasına gelmemesi halinde rezervasyon no-show olarak değerlendirilebilir.",
            "Belirli bir süre için satın alınan Saatlik Şoförlü Araç ve aynı süre esasına tabi hizmetlerde ücretsiz bekleme süresinin sona ermesi doğrudan no-show oluşturmaz. Şoför yolcuyu beklemeye devam eder ve ücretsiz bekleme süresinin sona erdiği andan itibaren satın alınan hizmet süresi işlemeye başlar. Bu andan sonra geçen bekleme süresi müşterinin satın aldığı toplam hizmet süresinden düşülür. Yolcunun daha sonra gelmesi halinde hizmet, kalan süre boyunca devam eder. Satın alınan hizmet süresinin tamamı sona erdiği halde yolcunun hizmeti başlatmamış olması halinde rezervasyon no-show olarak değerlendirilebilir.",
            "Sabit program veya hareket saatine bağlı tur ve etkinliklerde, ilgili hizmet için rezervasyon sırasında ve rezervasyon belgesinde bildirilen özel katılım, buluşma, servis ve hareket saati kuralları uygulanır. Yolcunun bu kurallara uymaması nedeniyle hizmete katılamaması durumunda ilgili rezervasyon no-show olarak değerlendirilebilir.",
            "No-show durumunda ödeme iade edilmeyebilir.",
            "Kullanıcının yanlış alış noktası, yanlış tarih, yanlış saat, eksik iletişim bilgisi, hatalı uçuş/sefer bilgisi veya benzeri yanlış/eksik bilgi vermesi nedeniyle hizmetin sağlanamaması halinde de rezervasyon no-show kapsamında değerlendirilebilir.",
          ],
        },
        {
          title: "6. Uçuş, tren, otobüs veya gemi gecikmeleri",
          paragraphs: [
            "Kullanıcı geçerli uçuş numarası veya sefer bilgisi paylaşmışsa, operasyon ekibi ilgili ulaşım aracının varış bilgisini takip edebilir.",
            "Ancak uçuş, tren, otobüs, gemi veya benzeri ulaşım bilgilerinin takip edilebilmesi; bilgilerin doğru verilmesine, sistemlerden doğrulanabilmesine ve operasyonel imkanlara bağlıdır.",
            "Bilgi paylaşılmamışsa veya doğrulanamıyorsa, ücretsiz bekleme süresi kullanıcının rezervasyon sırasında belirttiği tarih ve saatten itibaren başlar.",
          ],
        },
        {
          title: "7. Yanlış veya eksik bilgi",
          paragraphs: [
            "Kullanıcı; alış noktası, bırakma noktası, tarih, saat, uçuş numarası, sefer bilgisi, iletişim bilgileri, yolcu sayısı ve bagaj bilgilerini doğru ve eksiksiz vermekle sorumludur.",
            "Yanlış veya eksik bilgi nedeniyle hizmetin sağlanamaması, gecikme yaşanması, aracın yanlış noktaya yönlendirilmesi veya no-show oluşması halinde ödeme iade edilmeyebilir.",
          ],
        },
        {
          title: "8. Rota değişikliği, ek durak ve ek hizmetler",
          paragraphs: [
            "Rezervasyon tamamlandıktan sonra talep edilen ek durak, rota değişikliği, farklı varış noktası, ilave yolcu, fazla bagaj, satın alınan hizmet kapsamı veya süresi dışındaki ilave bekleme ve benzeri operasyonel değişiklikler ek ücrete tabi olabilir.",
            "Kullanıcı ek ücreti kabul etmezse, hizmet onaylanan rezervasyon bilgilerine göre sağlanır. Onaylanan rezervasyon dışında talep edilen değişikliklerin sağlanamaması iade hakkı doğurmaz.",
          ],
        },
        {
          title: "9. Daha alt araç sınıfı sağlanması durumunda iade",
          paragraphs: [
            "Operasyonel zorunluluk, teknik arıza, kaza, trafik koşulları, araç müsaitliği veya benzeri nedenlerle, kullanıcının ödeme yaptığı araç sınıfından daha alt bir araç sınıfı sağlanırsa, kullanıcı ödediği araç sınıfı ile fiilen sağlanan araç sınıfı arasındaki fiyat farkının iadesini talep edebilir.",
            "Daha üst sınıf veya eşdeğer araç sağlanması halinde kullanıcıdan ek ücret talep edilmez.",
          ],
        },
        {
          title: "10. İade yöntemi ve süresi",
          paragraphs: [
            "Onaylanan iadeler, ödeme yöntemine ve operasyonel koşullara uygun bir iade yöntemiyle işleme alınır.",
            "Online ödemelerde iadenin kullanıcının hesabına yansıma süresi, ödeme sağlayıcısına, bankaya veya kart kuruluşuna bağlı olarak değişebilir.",
            "Şoföre nakit ödeme seçilen ve henüz ödeme yapılmamış rezervasyonlarda, uygun iptal durumunda kullanıcıdan herhangi bir tahsilat yapılmaz.",
          ],
        },
        {
          title: "11. Mücbir sebepler ve operasyonel durumlar",
          paragraphs: [
            "Trafik yoğunluğu, kaza, yol kapanması, hava koşulları, resmi güvenlik önlemleri, araç arızası, uçuş/ulaşım gecikmeleri, doğal afetler, toplumsal olaylar veya hizmet sağlayıcının makul kontrolü dışında gelişen benzeri durumlarda hizmette gecikme, rota değişikliği, araç değişikliği veya operasyonel düzenleme yapılabilir.",
            "Bu tür durumlarda hizmet sağlayıcı, mümkün olduğu ölçüde kullanıcıyı bilgilendirmeye ve hizmeti makul şekilde sağlamaya çalışır.",
          ],
        },
        {
          title: "12. İletişim",
          paragraphs: [
            "İptal, iade, rezervasyon değişikliği veya no-show ile ilgili talepler için Tripetica.com iletişim kanalları kullanılabilir.",
            "Güncel iletişim bilgileri sitenin Footer bölümündeki İletişim alanında gösterilir.",
          ],
        },
        {
          paragraphs: ["cancellation_v1.0_2026-07-01"],
        },
      ],
    },
    "privacy-policy": {
      metaTitle: "Gizlilik Politikası ve KVKK Aydınlatma Metni | Tripetica",
      metaDescription:
        "Tripetica.com üzerinden alınan kişisel verilerin işlenmesi, kullanımı, paylaşımı ve 6698 sayılı KVKK kapsamında aydınlatma metni.",
      h1: "Gizlilik Politikası ve KVKK Aydınlatma Metni",
      sections: [
        {
          paragraphs: [
            "Tripetica.com üzerinden yapılan özel transfer, havalimanı transferi, şoförlü araç, tur, etkinlik ve benzeri seyahat veya ulaşım hizmeti rezervasyonlarında kullanıcıdan alınan kişisel verilerin hangi amaçlarla işlendiğini, nasıl kullanıldığını, hangi durumlarda paylaşılabileceğini ve 6698 sayılı Kişisel Verilerin Korunması Kanunu kapsamında kullanıcıya yapılan bilgilendirmeyi açıklamak amacıyla hazırlanmıştır.",
          ],
        },
        {
          title: "1. Genel kapsam",
          paragraphs: [
            "Bu metin, Tripetica.com üzerinden rezervasyon oluşturan, hizmet satın alan, iletişim kuran veya siteyi kullanan kişiler için geçerlidir.",
            "Kullanıcı, rezervasyonu tamamlamadan veya online ödeme sayfasına devam etmeden önce bu Gizlilik Politikası ve KVKK Aydınlatma Metni’ni okuduğunu, anladığını ve kabul ettiğini onaylar.",
          ],
        },
        {
          title: "2. Veri sorumlusu",
          paragraphs: [
            "Tripetica.com, Search Travel Agency Turizm Taşımacılık Ticaret Limited Şirketi tarafından işletilen bir markadır.",
            "Kişisel veriler, sunulan hizmetlerin sağlanması, rezervasyonların yürütülmesi, yasal yükümlülüklerin yerine getirilmesi ve operasyonel süreçlerin yönetilmesi amacıyla işlenebilir.",
            "Şirketin resmi adresi, vergi dairesi, vergi numarası, lisans bilgileri ve diğer yasal bilgileri Yasal Bilgiler sayfasında ayrıca gösterilir.",
          ],
        },
        {
          title: "3. Toplanan kişisel veriler",
          paragraphs: [
            "Tripetica.com üzerinden rezervasyon oluşturulması, hizmet sağlanması veya iletişim kurulması sırasında aşağıdaki bilgiler alınabilir:",
          ],
          bullets: [
            "Ad ve soyad",
            "Telefon numarası",
            "E-posta adresi",
            "Alış noktası ve bırakma noktası",
            "Rezervasyon tarihi ve saati",
            "Seçilen hizmet veya tur bilgisi",
            "Yolcu sayısı",
            "Bagaj bilgisi",
            "Bebek koltuğu, karşılama hizmeti veya benzeri ek hizmet tercihleri",
            "Uçuş numarası, tren/otobüs/gemi sefer bilgisi",
            "Yolcu ve katılımcı bilgileri",
            "Uyruk bilgisi",
            "Pasaport bilgisi",
            "Ödeme yöntemi",
            "Rezervasyon notları",
            "Kullanıcının iletişim kanalları üzerinden paylaştığı diğer bilgiler",
            "Site kullanımı sırasında oluşabilecek teknik veriler",
          ],
        },
        {
          title: "4. Kişisel verilerin kullanım amaçları",
          paragraphs: [
            "Toplanan kişisel veriler aşağıdaki amaçlarla işlenebilir:",
          ],
          bullets: [
            "Rezervasyonun oluşturulması",
            "Transfer, şoförlü araç, tur, etkinlik veya rezervasyonu yapılan diğer hizmetlerin sağlanması",
            "Yolcu, katılımcı, araç ve operasyon planlamasının yapılması ve gerekli rezervasyon bilgilerinin operasyon ekibine aktarılması",
            "Kullanıcı ile rezervasyon, ödeme, buluşma noktası, değişiklik veya iptal konularında iletişim kurulması",
            "Voucher, rezervasyon onayı ve operasyonel bilgilendirme gönderilmesi",
            "Yasal bildirimlerin, resmi kayıtların ve zorunlu operasyonel işlemlerin yapılması",
            "UETDS veya benzeri resmi/operasyonel bildirim yükümlülüklerinin yerine getirilmesi",
            "Müşteri desteği sağlanması",
            "Şikayet, iade, no-show veya operasyonel anlaşmazlıkların değerlendirilmesi",
            "Hizmet kalitesinin artırılması ve güvenliğin sağlanması",
            "Muhasebe, finans ve ödeme süreçlerinin yürütülmesi",
          ],
        },
        {
          title: "5. Kişisel verilerin işlenme sebepleri",
          paragraphs: [
            "Kişisel veriler; rezervasyonun oluşturulması, hizmet sözleşmesinin kurulması ve ifası, hizmetin sağlanması, yasal yükümlülüklerin yerine getirilmesi, resmi bildirimlerin yapılması, kullanıcı taleplerinin karşılanması ve hizmet sağlayıcının meşru operasyonel menfaatleri kapsamında işlenebilir.",
            "Gerekli olduğu durumlarda, kullanıcının açık rızasına dayalı olarak da kişisel veri işlenebilir.",
          ],
        },
        {
          title: "6. Yolcu bilgileri ve yasal yükümlülükler",
          paragraphs: [
            "Bazı hizmetlerde, yürürlükteki mevzuat, resmi bildirim yükümlülükleri, UETDS veya benzeri yasal/operasyonel gereklilikler nedeniyle yolcuların ad, soyad, uyruk, pasaport numarası ve benzeri bilgileri talep edilebilir.",
            "Kullanıcı, kendisine veya hizmetten yararlanacak yolculara ait bu bilgilerin hizmetin sağlanması, yasal yükümlülüklerin yerine getirilmesi ve gerekli resmi/operasyonel bildirimlerin yapılması amacıyla kullanılabileceğini kabul eder.",
            "Kullanıcı, başka yolcular adına bilgi paylaşıyorsa, bu bilgileri paylaşmaya yetkili olduğunu ve ilgili kişileri gerekli şekilde bilgilendirdiğini kabul eder.",
          ],
        },
        {
          title: "7. Ödeme bilgileri",
          paragraphs: [
            "Online ödeme işlemleri, ilgili ödeme sağlayıcısı üzerinden gerçekleştirilebilir.",
            "Tripetica.com, kullanıcının tam kart numarası, kart güvenlik kodu veya benzeri hassas kart bilgilerini kendi sisteminde saklamaz.",
            "Ödeme işlemi sırasında ödeme sağlayıcısı tarafından işlem tutarı, ödeme durumu, ödeme referans numarası, ödeme tarihi ve benzeri ödeme işlem bilgileri Tripetica.com ile paylaşılabilir ve rezervasyon kaydıyla ilişkilendirilebilir.",
          ],
        },
        {
          title: "8. Kişisel verilerin paylaşılması",
          paragraphs: [
            "Kişisel veriler, hizmetin sağlanması ve yasal/operasyonel yükümlülüklerin yerine getirilmesi amacıyla gerekli olduğu ölçüde aşağıdaki kişi ve kurumlarla paylaşılabilir:",
          ],
          bullets: [
            "Sürücüler",
            "Araç tedarikçileri",
            "Tur, etkinlik ve rezervasyonu yapılan hizmetin yerine getirilmesinde görev alan hizmet sağlayıcıları",
            "Operasyon ekibi",
            "Ödeme sağlayıcıları",
            "E-posta, mesajlaşma veya bildirim hizmeti sağlayıcıları",
            "Yetkili kamu kurumları ve resmi merciler",
            "Yasal yükümlülükler kapsamında ilgili kurum ve kuruluşlar",
            "Teknik altyapı, barındırma, güvenlik ve destek hizmeti sağlayıcıları",
          ],
          afterBullets: [
            "Kişisel veriler, hizmetin sağlanması veya yasal yükümlülükler için gerekli olmadıkça üçüncü kişilerle paylaşılmaz.",
          ],
        },
        {
          title: "9. İletişim ve operasyonel bildirimler",
          paragraphs: [
            "Kullanıcı, rezervasyonla ilgili bilgilendirme, operasyonel destek, buluşma noktası, servis saati, katılım ve hareket saati açıklamaları, sürücü/araç bilgileri, ödeme durumu, iptal/değişiklik ve benzeri konularda telefon, e-posta, WhatsApp, Telegram, Viber veya benzeri iletişim kanalları üzerinden bilgilendirilebilir.",
            "Bu bildirimler, hizmetin sağlanması ve rezervasyonun doğru şekilde yürütülmesi amacıyla yapılır.",
          ],
        },
        {
          title: "10. Verilerin saklanması",
          paragraphs: [
            "Kişisel veriler, rezervasyonun oluşturulması, hizmetin sağlanması, yasal yükümlülüklerin yerine getirilmesi, muhasebe/finans kayıtlarının tutulması, uyuşmazlıkların değerlendirilmesi ve operasyonel kayıtların saklanması için gerekli süre boyunca saklanabilir.",
            "Yasal saklama süreleri, resmi yükümlülükler veya olası uyuşmazlıklar nedeniyle bazı bilgiler daha uzun süre saklanabilir.",
            "Saklama süresi sona erdiğinde veya saklanmasını gerektiren sebep ortadan kalktığında bilgiler silinebilir, anonim hale getirilebilir veya mevzuata uygun şekilde arşivlenebilir.",
          ],
        },
        {
          title: "11. Kullanıcının sorumluluğu",
          paragraphs: [
            "Kullanıcı, rezervasyon sırasında kendisine veya hizmetten yararlanacak yolculara ait bilgileri doğru, güncel ve eksiksiz olarak paylaşmakla sorumludur.",
            "Yanlış veya eksik bilgi nedeniyle hizmetin sağlanamaması, gecikme yaşanması, yasal bildirimlerin yapılamaması veya operasyonel sorun oluşması halinde sorumluluk kullanıcıya ait olabilir.",
          ],
        },
        {
          title: "12. Veri güvenliği",
          paragraphs: [
            "Tripetica.com, kişisel verilerin yetkisiz erişime, kayba, kötüye kullanıma veya izinsiz paylaşıma karşı korunması için makul teknik ve idari önlemleri almaya çalışır.",
            "Bununla birlikte, internet üzerinden yapılan hiçbir veri aktarımı veya elektronik sistem tamamen risksiz değildir. Kullanıcı, elektronik iletişim ve online işlem süreçlerinde belirli teknik risklerin bulunabileceğini kabul eder.",
          ],
        },
        {
          title: "13. Çerezler ve teknik veriler",
          paragraphs: [
            "Tripetica.com, sitenin çalışması, kullanıcı deneyiminin iyileştirilmesi, dil/para birimi tercihleri, rezervasyon akışı, güvenlik ve performans amacıyla çerezler veya benzeri teknik araçlar kullanabilir.",
            "Site kullanımı sırasında cihaz, tarayıcı, IP adresi, oturum bilgisi, ziyaret edilen sayfalar ve benzeri teknik veriler işlenebilir.",
          ],
        },
        {
          title: "14. Kullanıcı hakları",
          paragraphs: [
            "Kullanıcı, yürürlükteki mevzuat kapsamında kişisel verileriyle ilgili bilgi talep etme, düzeltme, silme, işlenmesini sınırlandırma, aktarım veya itiraz etme gibi haklara sahip olabilir.",
            "Kullanıcı, kişisel verilerine ilişkin talepleri için Tripetica.com iletişim kanallarını kullanabilir.",
            "Talebin yerine getirilebilmesi için kullanıcının kimliğinin ve ilgili rezervasyonun doğrulanması gerekebilir.",
          ],
        },
        {
          title: "15. Politika değişiklikleri",
          paragraphs: [
            "Tripetica.com, bu Gizlilik Politikası ve KVKK Aydınlatma Metni’ni zaman zaman güncelleyebilir.",
            "Güncel metin, Tripetica.com üzerinde yayınlanan aktif versiyondur.",
            "Kullanıcının rezervasyon sırasında kabul ettiği metin versiyonu, ilgili rezervasyon kaydında saklanabilir.",
          ],
        },
        {
          title: "16. İletişim",
          paragraphs: [
            "Kişisel veriler, gizlilik talepleri, rezervasyon bilgileri veya diğer sorular için Tripetica.com iletişim kanalları kullanılabilir.",
            "Güncel iletişim bilgileri sitenin Footer bölümündeki İletişim alanında gösterilir.",
          ],
        },
        {
          paragraphs: ["privacy_v1.0_2026-07-01"],
        },
      ],
    },
  },
  en: {
    "preliminary-information": {
      metaTitle: "Preliminary Information Form | Tripetica",
      metaDescription:
        "Preliminary information for private transfer, airport transfer and chauffeur reservations made through Tripetica.com.",
      h1: "Preliminary Information Form",
      sections: [
        {
          paragraphs: [
            "It has been prepared to provide the user/service recipient with essential information before completing a reservation for private transfer, airport transfer, chauffeur service and similar transportation services to be made through Tripetica.com.",
          ],
        },
        {
          title: "1. Service provider information",
          paragraphs: [
            "Tripetica.com is a brand operated by Search Travel Agency Turizm Taşımacılık Ticaret Limited Şirketi.",
            "The company’s registered address, tax office, tax number, license information and other legal details are shown separately on the Legal Information page.",
          ],
        },
        {
          title: "2. Subject of the service",
          paragraphs: [
            "The subject of the service is the provision of private transfer, airport transfer, chauffeur service or similar transportation service according to the pickup point, drop-off point, date, time, passenger count, luggage information, vehicle class and any additional services selected by the user through Tripetica.com.",
          ],
        },
        {
          title: "3. Reservation information",
          paragraphs: [
            "During the reservation process, the user enters information such as pickup point, drop-off point, date, time, passenger count, luggage count, contact details and, where required, flight number, train/bus/ship service information.",
            "The user is responsible for ensuring that the information provided during the reservation process is accurate, current and complete. If the service cannot be provided, a delay occurs, the vehicle goes to an incorrect location or a no-show occurs due to incorrect or incomplete information, the responsibility may belong to the user.",
          ],
        },
        {
          title: "4. Price and payment",
          paragraphs: [
            "The price shown during the reservation process is calculated according to the selected service type, route, distance, vehicle class, passenger count, luggage information, additional services and selected payment method.",
            "The user sees the total price and payment method before completing the reservation.",
            "Completing the reservation or continuing to the online payment page means that the user accepts that a payment obligation arises for the selected service.",
          ],
        },
        {
          title: "5. Additional charges and additional services",
          paragraphs: [
            "Additional services selected during the reservation process, such as extra passengers, extra luggage, baby seat, meet & greet service or similar services, are shown to the user on the vehicle selection screen and/or in the reservation summary. The user accepts the total price and any additional service charges before completing the reservation.",
            "Additional stops, route changes, extra waiting time outside the waiting periods governed by Section 8, a different destination, additional passengers, extra luggage or similar operational changes requested after the reservation has been completed may be subject to additional charges.",
            "Where additional charges are required, the user will be informed in advance as far as reasonably possible.",
          ],
        },
        {
          title: "6. Vehicle class",
          paragraphs: [
            "Vehicle models displayed during the reservation process are representative. The service provider may send an equivalent or higher-class vehicle than the class selected by the user due to operational suitability, vehicle availability, legal requirements or service quality considerations.",
            "If, due to operational necessity, technical failure, accident, traffic conditions, vehicle availability or similar reasons, a lower vehicle class than the one paid for by the user is provided, the user may request a refund of the price difference between the vehicle class paid for and the vehicle class actually provided.",
          ],
        },
        {
          title: "7. Cancellation and refund",
          paragraphs: [
            [
              "Cancellation and refund conditions for reservations made through Tripetica.com are explained on the ",
              {
                slug: "cancellation-refund-policy",
                label: "Cancellation and Refund Policy",
              },
              " page.",
            ],
            "As a general rule, the reservation may be cancelled or changed while more than 6 hours remain before the service start time.",
            "For cancellations made within the permitted period, 100% of the net amount previously collected and not yet refunded is refunded. When 6 hours or less remain before the service start time, cancellation or changes are not available. In case of no-show, the payment may not be refunded.",
          ],
        },
        {
          title: "8. Free waiting times and no-show",
          paragraphs: [
            "Free waiting time is 90 minutes for airport pickups; 30 minutes for pickups from train stations, bus terminals, ports, cruise terminals and similar locations; and 20 minutes for pickups from hotels, private addresses, hospitals, workplaces, restaurants and similar locations.",
            "For transfer services, if the passenger has not arrived at the designated pickup or meeting point when the applicable free waiting period ends, the reservation may be considered a no-show. No refund is issued for reservations considered a no-show.",
            "For Hourly Chauffeur Service and other services purchased for a defined period, the end of the free waiting period does not immediately constitute a no-show. The chauffeur will continue to wait, and the purchased service duration will begin to run from the moment the free waiting period ends. Any waiting time thereafter will be deducted from the total service duration purchased by the customer. If the passenger arrives later, the service will continue for the remaining duration. If the passenger has not started the service by the time the entire purchased service duration has elapsed, the reservation may be considered a no-show.",
            "For tours and activities tied to a fixed programme or departure time, the specific participation, meeting, shuttle service and departure-time rules communicated during the reservation process and in the reservation document for the relevant service will apply.",
          ],
        },
        {
          title: "9. Right of withdrawal and nature of the service",
          paragraphs: [
            "The user accepts that the reservation relates to a private transportation, transfer, vehicle allocation or chauffeur service to be provided on a specific date and at a specific time.",
            [
              "Since the service is linked to a specific date and time and vehicle/operation planning is made according to this reservation, withdrawal rights and cancellation procedures are evaluated within the scope of applicable legislation, the nature of the service and the Tripetica.com ",
              {
                slug: "cancellation-refund-policy",
                label: "Cancellation and Refund Policy",
              },
              ".",
            ],
            "The user confirms that they have read and accepted the cancellation and refund conditions before completing the reservation.",
          ],
        },
        {
          title: "10. Personal data",
          paragraphs: [
            "Information received from the user, such as first name, last name, phone number, email address, pickup and drop-off locations, flight number, passenger information, nationality, passport information and similar data, may be used for creating the reservation, providing the service, making legal notifications, customer support and operational communication.",
            [
              "Details regarding the processing of personal data are explained on the ",
              { slug: "privacy-policy", label: "Privacy Policy" },
              " page.",
            ],
          ],
        },
        {
          title: "11. Contact",
          paragraphs: [
            "Tripetica.com contact channels may be used for reservations, changes, cancellations, payments, operational support and complaints.",
            "Current contact information is shown in the Contact section of the site Footer.",
          ],
        },
        {
          title: "12. Confirmation",
          paragraphs: [
            [
              "Before completing the reservation or continuing to the online payment page, the user confirms that they have read, understood and accepted the Preliminary Information Form, ",
              {
                slug: "distance-sales-agreement",
                label: "Distance Service Sales Agreement",
              },
              ", ",
              {
                slug: "cancellation-refund-policy",
                label: "Cancellation and Refund Policy",
              },
              " and ",
              { slug: "privacy-policy", label: "Privacy Policy" },
              ".",
            ],
          ],
        },
        {
          paragraphs: ["pre_info_v1.0_2026-07-01"],
        },
      ],
    },
    "distance-sales-agreement": {
      metaTitle: "Distance Service Sales Agreement | Tripetica",
      metaDescription:
        "Distance Service Sales Agreement for private transfer, airport transfer and chauffeur reservations made through Tripetica.com.",
      h1: "Distance Service Sales Agreement",
      sections: [
        {
          paragraphs: [
            "It has been prepared to regulate the basic rights and obligations between the service provider and the user/service recipient for private transfer, airport transfer, chauffeur service and similar transportation service reservations made through Tripetica.com.",
          ],
        },
        {
          title: "1. Parties",
          paragraphs: [
            "Service provider:",
            "Tripetica.com is a brand operated by Search Travel Agency Turizm Taşımacılık Ticaret Limited Şirketi.",
            "User / service recipient:",
            "The user/service recipient is the natural or legal person who creates a reservation, purchases a service or receives a service on behalf of another person through Tripetica.com.",
            "The user accepts that the information provided while creating the reservation is accurate, current and complete.",
          ],
        },
        {
          title: "2. Subject of the agreement",
          paragraphs: [
            "The subject of this agreement is the provision of private transfer, airport transfer, chauffeur service or similar transportation service according to the pickup point, drop-off point, date, time, passenger count, luggage information, vehicle class and any additional services selected by the user through Tripetica.com.",
          ],
        },
        {
          title: "3. Creation of the reservation",
          paragraphs: [
            "The user enters the required reservation information through Tripetica.com and sees the vehicle class, price and payment method.",
            [
              "Completing the reservation or continuing to the online payment page means that the user has read, understood and accepted this agreement, the ",
              {
                slug: "preliminary-information",
                label: "Preliminary Information Form",
              },
              ", the ",
              {
                slug: "cancellation-refund-policy",
                label: "Cancellation and Refund Policy",
              },
              " and the ",
              { slug: "privacy-policy", label: "Privacy Policy" },
              ".",
            ],
            "The reservation is considered completed when it is created in the Tripetica system with a reservation code. The reservation confirmation sent to the user is an information and confirmation record for the created reservation.",
          ],
        },
        {
          title: "4. Price and payment obligation",
          paragraphs: [
            "The price shown during the reservation process is calculated according to the selected service type, route, distance, vehicle class, passenger count, luggage information, additional services and selected payment method.",
            "The user sees the total price before completing the reservation.",
            "Completing the reservation or continuing to the online payment page means that the user accepts that a payment obligation arises for the selected service.",
          ],
        },
        {
          title: "5. Additional services and additional charges",
          paragraphs: [
            "Additional services selected during the reservation process, such as extra passengers, extra luggage, baby seat, meet & greet service or similar services, are shown to the user on the vehicle selection screen and/or in the reservation summary. The user accepts the total price and any additional service charges before completing the reservation.",
            "Additional stops, route changes, a different destination, additional passengers, extra luggage, additional waiting outside the scope or duration of the purchased service, or similar operational changes requested after the reservation has been completed may be subject to additional charges.",
            "Where additional charges are required, the user will be informed in advance as far as reasonably possible.",
          ],
        },
        {
          title: "6. User obligations",
          paragraphs: [
            "The user is responsible for providing accurate and complete information such as pickup point, drop-off point, date, time, passenger count, luggage count, contact details and, where required, flight number, train/bus/ship service information.",
            "If the service cannot be provided, a delay occurs, the vehicle goes to an incorrect location or a no-show occurs due to incorrect or incomplete information, the responsibility may belong to the user.",
            "The user is responsible for selecting a vehicle class suitable for the passenger count and luggage capacity stated during the reservation process.",
          ],
        },
        {
          title: "7. Service provider obligations",
          paragraphs: [
            "The service provider makes the necessary operational planning to provide the service in accordance with the confirmed reservation information.",
            "The service provider may make reasonable changes to the manner in which the service is provided due to operational suitability, vehicle availability, traffic, road conditions, security, technical failure or similar reasons.",
          ],
        },
        {
          title: "8. Vehicle class and vehicle changes",
          paragraphs: [
            "Vehicle models displayed during the reservation process are representative. A different brand/model vehicle in the same class or with similar features may be provided.",
            "The service provider may send an equivalent or higher-class vehicle than the class selected by the user due to operational suitability, vehicle availability, legal requirements or service quality considerations.",
            "If, due to operational necessity, technical failure, accident, traffic conditions, vehicle availability or similar reasons, a lower vehicle class than the one paid for by the user is provided, the user may request a refund of the price difference between the vehicle class paid for and the vehicle class actually provided.",
          ],
        },
        {
          title: "9. Free waiting times",
          paragraphs: [
            "The free waiting time is evaluated according to the type of pickup point and the information shared by the user during the reservation process.",
            "For airport pickups, if the user has provided a valid flight number during the reservation process, the free waiting time starts from the actual landing time of the flight. If no flight number has been provided or the flight information cannot be verified, the free waiting time starts from the date and time specified by the user during the reservation process.",
            "For pickups from train stations, bus terminals, ports, cruise terminals or similar transportation points, if the user has provided valid service information during the reservation process, the free waiting time starts from the actual arrival time of the train, bus, ship or relevant means of transportation. If service information has not been provided or cannot be verified, the free waiting time starts from the date and time specified by the user during the reservation process.",
            "For hotels, private addresses, hospitals, workplaces, restaurants or other similar pickup points, the free waiting time starts from the date and time specified by the user during the reservation process.",
            "The free waiting times are as follows:",
          ],
          bullets: [
            "Airport pickups: 90 minutes",
            "Train stations, bus terminals, ports, cruise terminals and similar transportation points: 30 minutes",
            "Hotels, private addresses, hospitals, workplaces, restaurants and other pickup points: 20 minutes",
          ],
          afterBullets: [
            "For transfer services, if the passenger has not arrived at the designated pickup or meeting point when the applicable free waiting period ends, the reservation may be considered a no-show.",
            "For Hourly Chauffeur Service and other services purchased for a defined period, the end of the free waiting period does not immediately constitute a no-show. The chauffeur will continue to wait, and the purchased service duration will begin to run from the moment the free waiting period ends. Any waiting time thereafter will be deducted from the total service duration purchased by the customer. If the passenger arrives later, the service will continue for the remaining duration. If the passenger has not started the service by the time the entire purchased service duration has elapsed, the reservation may be considered a no-show.",
            "For tours and activities tied to a fixed programme or departure time, the specific participation, meeting, shuttle service and departure-time rules communicated during the reservation process and in the reservation document for the relevant service will apply.",
          ],
        },
        {
          title: "10. Cancellation, refund and no-show",
          paragraphs: [
            [
              "Cancellation, refund and no-show conditions are explained separately on the ",
              {
                slug: "cancellation-refund-policy",
                label: "Cancellation and Refund Policy",
              },
              " page.",
            ],
            "As a general rule, the reservation may be cancelled or changed while more than 6 hours remain before the service start time.",
            "For cancellations made within the permitted period, 100% of the net amount previously collected and not yet refunded is refunded. When 6 hours or less remain before the service start time, cancellation or changes are not available. In no-show cases arising under the conditions set out in Section 9, the payment may not be refunded.",
          ],
        },
        {
          title: "11. Right of withdrawal and nature of the service",
          paragraphs: [
            "The user accepts that the reservation relates to a private transportation, transfer, vehicle allocation or chauffeur service to be provided on a specific date and at a specific time.",
            [
              "Since the service is linked to a specific date and time and vehicle/operation planning is made according to this reservation, withdrawal rights and cancellation procedures are evaluated within the scope of applicable legislation, the nature of the service and the Tripetica.com ",
              {
                slug: "cancellation-refund-policy",
                label: "Cancellation and Refund Policy",
              },
              ".",
            ],
          ],
        },
        {
          title: "12. Force majeure and operational circumstances",
          paragraphs: [
            "In cases such as traffic congestion, accident, road closure, weather conditions, official security measures, vehicle failure, flight/transportation delays, natural disasters, public incidents or similar circumstances beyond the reasonable control of the service provider, delays, route changes, vehicle changes or operational arrangements may occur.",
            "In such cases, the service provider will try to inform the user and provide the service in a reasonable manner as far as possible.",
          ],
        },
        {
          title: "13. Personal data",
          paragraphs: [
            "Information received from the user, such as first name, last name, phone number, email address, pickup and drop-off locations, flight number, passenger information, nationality, passport information and similar data, may be used for creating the reservation, providing the service, making legal notifications, customer support and operational communication.",
            [
              "Details regarding the processing of personal data are explained on the ",
              { slug: "privacy-policy", label: "Privacy Policy" },
              " page.",
            ],
          ],
        },
        {
          title: "14. Contact",
          paragraphs: [
            "Tripetica.com contact channels may be used for reservations, changes, cancellations, payments, operational support and complaints.",
            "Current contact information is shown in the Contact section of the site Footer.",
          ],
        },
        {
          title: "15. Entry into force and confirmation",
          paragraphs: [
            [
              "Before completing the reservation or continuing to the online payment page, the user confirms that they have read, understood and accepted this Distance Service Sales Agreement, the ",
              {
                slug: "preliminary-information",
                label: "Preliminary Information Form",
              },
              ", the ",
              {
                slug: "cancellation-refund-policy",
                label: "Cancellation and Refund Policy",
              },
              " and the ",
              { slug: "privacy-policy", label: "Privacy Policy" },
              ".",
            ],
            "This agreement enters into force when the user completes the reservation.",
          ],
        },
        {
          paragraphs: ["service_agreement_v1.0_2026-07-01"],
        },
      ],
    },
    "cancellation-refund-policy": {
      metaTitle: "Cancellation and Refund Policy | Tripetica",
      metaDescription:
        "Cancellation, refund, free waiting time and no-show conditions for reservations made through Tripetica.com.",
      h1: "Cancellation and Refund Policy",
      sections: [
        {
          paragraphs: [
            "It has been prepared to explain the cancellation, refund, free waiting time and no-show conditions applicable to private transfer, airport transfer, chauffeur service and similar transportation service reservations made through Tripetica.com.",
          ],
        },
        {
          title: "1. General scope",
          paragraphs: [
            "This policy applies to reservations created through Tripetica.com.",
            "Before completing the reservation or continuing to the online payment page, the user confirms that they have read, understood and accepted this Cancellation and Refund Policy.",
          ],
        },
        {
          title: "2. Cancellation and change rights",
          paragraphs: [
            "As a general rule, the reservation may be cancelled or changed while more than 6 hours remain before the service start time.",
            "For cancellations made within the permitted period, if an online payment has been made, 100% of the net amount previously collected and not yet refunded is refunded. If cash to driver has been selected, no service fee is charged to the user.",
          ],
        },
        {
          title: "3. Cancellation and change requests when 6 hours or less remain",
          paragraphs: [
            "When 6 hours or less remain before the service start time, the customer cannot cancel or change the reservation and no refund is issued.",
            "For reservations made with the cash to driver option, the service provider reserves the right to refuse future reservations that are repeated, abusive or cause operational loss.",
          ],
        },
        {
          title: "4. Free waiting times",
          paragraphs: [
            "The free waiting time is evaluated according to the type of pickup point and the information shared by the user during the reservation process.",
            "For airport pickups, if the user has provided a valid flight number during the reservation process, the free waiting time starts from the actual landing time of the flight. If no flight number has been provided or the flight information cannot be verified, the free waiting time starts from the date and time specified by the user during the reservation process.",
            "For pickups from train stations, bus terminals, ports, cruise terminals or similar transportation points, if the user has provided valid service information during the reservation process, the free waiting time starts from the actual arrival time of the train, bus, ship or relevant means of transportation. If service information has not been provided or cannot be verified, the free waiting time starts from the date and time specified by the user during the reservation process.",
            "For hotels, private addresses, hospitals, workplaces, restaurants or other similar pickup points, the free waiting time starts from the date and time specified by the user during the reservation process.",
            "The free waiting times are as follows:",
          ],
          bullets: [
            "Airport pickups: 90 minutes",
            "Train stations, bus terminals, ports, cruise terminals and similar transportation points: 30 minutes",
            "Hotels, private addresses, hospitals, workplaces, restaurants and other pickup points: 20 minutes",
          ],
        },
        {
          title: "5. No-show",
          paragraphs: [
            "For transfer services, if the passenger has not arrived at the designated pickup or meeting point when the applicable free waiting period ends, the reservation may be considered a no-show.",
            "For Hourly Chauffeur Service and other services purchased for a defined period, the end of the free waiting period does not immediately constitute a no-show. The chauffeur will continue to wait, and the purchased service duration will begin to run from the moment the free waiting period ends. Any waiting time thereafter will be deducted from the total service duration purchased by the customer. If the passenger arrives later, the service will continue for the remaining duration. If the passenger has not started the service by the time the entire purchased service duration has elapsed, the reservation may be considered a no-show.",
            "For tours and activities tied to a fixed programme or departure time, the specific participation, meeting, shuttle service and departure-time rules communicated during the reservation process and in the reservation document for the relevant service will apply. If the passenger is unable to participate in the service because they failed to comply with those rules, the reservation may be considered a no-show.",
            "In case of no-show, the payment may not be refunded.",
            "If the service cannot be provided due to the user providing an incorrect pickup point, incorrect date, incorrect time, incomplete contact information, incorrect flight/service information or similar incorrect/incomplete information, the reservation may also be considered within the scope of no-show.",
          ],
        },
        {
          title: "6. Flight, train, bus or ship delays",
          paragraphs: [
            "If the user has provided a valid flight number or service information, the operations team may monitor the arrival information of the relevant means of transportation.",
            "However, the ability to monitor flight, train, bus, ship or similar transportation information depends on the information being provided correctly, being verifiable through systems and operational availability.",
            "If the information has not been shared or cannot be verified, the free waiting time starts from the date and time specified by the user during the reservation process.",
          ],
        },
        {
          title: "7. Incorrect or incomplete information",
          paragraphs: [
            "The user is responsible for providing accurate and complete pickup point, drop-off point, date, time, flight number, service information, contact details, passenger count and luggage information.",
            "If the service cannot be provided, a delay occurs, the vehicle is directed to an incorrect point or a no-show occurs due to incorrect or incomplete information, the payment may not be refunded.",
          ],
        },
        {
          title: "8. Route changes, additional stops and additional services",
          paragraphs: [
            "Additional stops, route changes, a different destination, additional passengers, extra luggage, additional waiting outside the scope or duration of the purchased service, or similar operational changes requested after the reservation has been completed may be subject to additional charges.",
            "If the user does not accept the additional charge, the service will be provided according to the confirmed reservation information. Failure to provide changes requested outside the confirmed reservation does not create a right to refund.",
          ],
        },
        {
          title: "9. Refund in case of lower vehicle class",
          paragraphs: [
            "If, due to operational necessity, technical failure, accident, traffic conditions, vehicle availability or similar reasons, a lower vehicle class than the one paid for by the user is provided, the user may request a refund of the price difference between the vehicle class paid for and the vehicle class actually provided.",
            "If an equivalent or higher-class vehicle is provided, no additional charge will be requested from the user.",
          ],
        },
        {
          title: "10. Refund method and timing",
          paragraphs: [
            "Approved refunds are processed using a suitable refund method depending on the payment method and operational circumstances.",
            "For online payments, the time it takes for the refund to appear in the user’s account may vary depending on the payment provider, bank or card issuer.",
            "For reservations where cash to driver was selected and no payment has yet been made, no collection is made from the user in eligible cancellation cases.",
          ],
        },
        {
          title: "11. Force majeure and operational circumstances",
          paragraphs: [
            "In cases such as traffic congestion, accident, road closure, weather conditions, official security measures, vehicle failure, flight/transportation delays, natural disasters, public incidents or similar circumstances beyond the reasonable control of the service provider, delays, route changes, vehicle changes or operational arrangements may occur.",
            "In such cases, the service provider will try to inform the user and provide the service in a reasonable manner as far as possible.",
          ],
        },
        {
          title: "12. Contact",
          paragraphs: [
            "Tripetica.com contact channels may be used for requests related to cancellation, refund, reservation change or no-show.",
            "Current contact information is shown in the Contact section of the site Footer.",
          ],
        },
        {
          paragraphs: ["cancellation_v1.0_2026-07-01"],
        },
      ],
    },
    "privacy-policy": {
      metaTitle:
        "Privacy Policy and Personal Data Protection Notice | Tripetica",
      metaDescription:
        "How personal data collected through Tripetica.com reservations is processed, used, shared where necessary, and protected.",
      h1: "Privacy Policy and Personal Data Protection Notice",
      sections: [
        {
          paragraphs: [
            "This text has been prepared to explain how personal data collected from users during reservations for private transfers, airport transfers, chauffeur services, tours, activities and similar travel or transportation services made through Tripetica.com is processed, used, shared where necessary, and protected.",
          ],
        },
        {
          title: "1. General scope",
          paragraphs: [
            "This text applies to persons who create a reservation, purchase a service, contact Tripetica.com or use the website.",
            "Before completing the reservation or continuing to the online payment page, the user confirms that they have read, understood and accepted this Privacy Policy and Personal Data Protection Notice.",
          ],
        },
        {
          title: "2. Data controller",
          paragraphs: [
            "Tripetica.com is a brand operated by Search Travel Agency Turizm Taşımacılık Ticaret Limited Şirketi.",
            "Personal data may be processed for the purpose of providing the offered services, managing reservations, fulfilling legal obligations and carrying out operational processes.",
            "The company’s official address, tax office, tax number, licence information and other legal information are shown separately on the Legal Information page.",
          ],
        },
        {
          title: "3. Personal data collected",
          paragraphs: [
            "The following information may be collected during the creation of a reservation, provision of a service or communication through Tripetica.com:",
          ],
          bullets: [
            "First name and last name",
            "Phone number",
            "Email address",
            "Pickup point and drop-off point",
            "Reservation date and time",
            "Selected service or tour information",
            "Passenger count",
            "Luggage information",
            "Baby seat, meet & greet service or similar additional service preferences",
            "Flight number, train/bus/ship service information",
            "Passenger and participant information",
            "Nationality information",
            "Passport information",
            "Payment method",
            "Reservation notes",
            "Other information shared by the user through communication channels",
            "Technical data that may occur during website use",
          ],
        },
        {
          title: "4. Purposes of processing personal data",
          paragraphs: [
            "Collected personal data may be processed for the following purposes:",
          ],
          bullets: [
            "Creating the reservation",
            "Providing transfer, chauffeur, tour, activity or other reserved services",
            "Planning passengers, participants, vehicles and operations and providing the operations team with the reservation information required",
            "Communicating with the user regarding reservation, payment, meeting point, changes or cancellation",
            "Sending voucher, reservation confirmation and operational notifications",
            "Carrying out legal notifications, official records and mandatory operational procedures",
            "Fulfilling UETDS or similar official/operational notification obligations",
            "Providing customer support",
            "Evaluating complaints, refunds, no-show cases or operational disputes",
            "Improving service quality and ensuring security",
            "Carrying out accounting, finance and payment processes",
          ],
        },
        {
          title: "5. Legal grounds for processing personal data",
          paragraphs: [
            "Personal data may be processed within the scope of creating the reservation, establishing and performing the service agreement, providing the service, fulfilling legal obligations, making official notifications, responding to user requests and the legitimate operational interests of the service provider.",
            "Where required, personal data may also be processed based on the user’s explicit consent.",
          ],
        },
        {
          title: "6. Passenger information and legal obligations",
          paragraphs: [
            "For some services, passengers’ first name, last name, nationality, passport number and similar information may be requested due to applicable legislation, official notification obligations, UETDS or similar legal/operational requirements.",
            "The user accepts that this information belonging to themselves or to passengers receiving the service may be used for providing the service, fulfilling legal obligations and making necessary official/operational notifications.",
            "If the user shares information on behalf of other passengers, the user accepts that they are authorised to share such information and that they have properly informed the relevant persons.",
          ],
        },
        {
          title: "7. Payment information",
          paragraphs: [
            "Online payment transactions may be carried out through the relevant payment provider.",
            "Tripetica.com does not store the user’s full card number, card security code or similar sensitive card information in its own system.",
            "During the payment process, transaction amount, payment status, payment reference number, payment date and similar payment transaction information may be shared with Tripetica.com by the payment provider and may be associated with the reservation record.",
          ],
        },
        {
          title: "8. Sharing of personal data",
          paragraphs: [
            "Personal data may be shared with the following persons and institutions to the extent necessary for providing the service and fulfilling legal/operational obligations:",
          ],
          bullets: [
            "Drivers",
            "Vehicle suppliers",
            "Service providers involved in delivering tours, activities or other reserved services",
            "Operations team",
            "Payment providers",
            "Email, messaging or notification service providers",
            "Authorised public institutions and official authorities",
            "Relevant institutions and organisations within the scope of legal obligations",
            "Technical infrastructure, hosting, security and support service providers",
          ],
          afterBullets: [
            "Personal data is not shared with third parties unless necessary for providing the service or fulfilling legal obligations.",
          ],
        },
        {
          title: "9. Communication and operational notifications",
          paragraphs: [
            "The user may be contacted through phone, email, WhatsApp, Telegram, Viber or similar communication channels regarding reservation information, operational support, meeting point, shuttle time, participation and departure-time instructions, driver/vehicle information, payment status, cancellation/change and similar matters.",
            "These notifications are made for the purpose of providing the service and carrying out the reservation correctly.",
          ],
        },
        {
          title: "10. Data retention",
          paragraphs: [
            "Personal data may be retained for as long as necessary for creating the reservation, providing the service, fulfilling legal obligations, keeping accounting/financial records, evaluating disputes and retaining operational records.",
            "Some information may be retained for a longer period due to legal retention periods, official obligations or possible disputes.",
            "When the retention period expires or the reason requiring retention no longer exists, the information may be deleted, anonymised or archived in accordance with applicable legislation.",
          ],
        },
        {
          title: "11. User responsibility",
          paragraphs: [
            "The user is responsible for sharing accurate, up-to-date and complete information belonging to themselves or to passengers receiving the service during the reservation process.",
            "If the service cannot be provided, delays occur, legal notifications cannot be made or operational problems arise due to incorrect or incomplete information, responsibility may belong to the user.",
          ],
        },
        {
          title: "12. Data security",
          paragraphs: [
            "Tripetica.com seeks to take reasonable technical and administrative measures to protect personal data against unauthorised access, loss, misuse or unauthorised sharing.",
            "However, no data transmission over the internet or electronic system is completely risk-free. The user accepts that certain technical risks may exist in electronic communication and online transaction processes.",
          ],
        },
        {
          title: "13. Cookies and technical data",
          paragraphs: [
            "Tripetica.com may use cookies or similar technical tools for the operation of the website, improvement of user experience, language/currency preferences, reservation flow, security and performance.",
            "During website use, device, browser, IP address, session information, visited pages and similar technical data may be processed.",
          ],
        },
        {
          title: "14. User rights",
          paragraphs: [
            "The user may have rights under applicable legislation to request information about their personal data, request correction, deletion, restriction of processing, transfer or objection.",
            "The user may use Tripetica.com contact channels for requests regarding their personal data.",
            "In order to fulfil the request, verification of the user’s identity and the relevant reservation may be required.",
          ],
        },
        {
          title: "15. Policy changes",
          paragraphs: [
            "Tripetica.com may update this Privacy Policy and Personal Data Protection Notice from time to time.",
            "The current text is the active version published on Tripetica.com.",
            "The version of the text accepted by the user during the reservation process may be stored in the relevant reservation record.",
          ],
        },
        {
          title: "16. Contact",
          paragraphs: [
            "Tripetica.com contact channels may be used for personal data, privacy requests, reservation information or other questions.",
            "Current contact information is shown in the Contact section of the site Footer.",
          ],
        },
        {
          paragraphs: ["privacy_v1.0_2026-07-01"],
        },
      ],
    },
  },
  ru: {
    "preliminary-information": {
      metaTitle: "Форма предварительной информации | Tripetica",
      metaDescription:
        "Форма предварительной информации Tripetica.com: частный трансфер, трансфер из/в аэропорт и автомобиль с водителем.",
      h1: "Форма предварительной информации",
      sections: [
        {
          paragraphs: [
            "Подготовлено для предоставления пользователю/получателю услуги основной информации до завершения бронирования частного трансфера, трансфера из/в аэропорт, услуги автомобиля с водителем и аналогичных транспортных услуг, оформляемых через Tripetica.com.",
          ],
        },
        {
          title: "1. Информация о поставщике услуги",
          paragraphs: [
            "Tripetica.com является брендом, управляемым компанией Search Travel Agency Turizm Taşımacılık Ticaret Limited Şirketi.",
            "Официальный адрес компании, налоговая инспекция, налоговый номер, информация о лицензиях и другие юридические сведения отдельно указаны на странице Legal Information / Юридическая информация.",
          ],
        },
        {
          title: "2. Предмет услуги",
          paragraphs: [
            "Предметом услуги является предоставление частного трансфера, трансфера из/в аэропорт, услуги автомобиля с водителем или аналогичной транспортной услуги в соответствии с выбранными пользователем через Tripetica.com пунктом посадки, пунктом назначения, датой, временем, количеством пассажиров, информацией о багаже, классом автомобиля и дополнительными услугами, если они выбраны.",
          ],
        },
        {
          title: "3. Информация о бронировании",
          paragraphs: [
            "В процессе бронирования пользователь указывает такие данные, как пункт посадки, пункт назначения, дата, время, количество пассажиров, количество багажа, контактная информация, а при необходимости номер рейса, информацию о поезде, автобусе или судне.",
            "Пользователь несет ответственность за точность, актуальность и полноту информации, предоставленной при бронировании. Если из-за неверной или неполной информации услуга не может быть оказана, возникает задержка, автомобиль направляется по неверному адресу или возникает ситуация no-show, ответственность может лежать на пользователе.",
          ],
        },
        {
          title: "4. Цена и оплата",
          paragraphs: [
            "Цена, отображаемая в процессе бронирования, рассчитывается в зависимости от выбранного типа услуги, маршрута, расстояния, класса автомобиля, количества пассажиров, информации о багаже, дополнительных услуг и выбранного способа оплаты.",
            "Пользователь видит итоговую стоимость и способ оплаты до завершения бронирования.",
            "Завершение бронирования или переход на страницу онлайн-оплаты означает, что пользователь принимает возникновение платежного обязательства за выбранную услугу.",
          ],
        },
        {
          title: "5. Дополнительные сборы и дополнительные услуги",
          paragraphs: [
            "Дополнительные услуги, выбранные в процессе бронирования, такие как дополнительные пассажиры, дополнительный багаж, детское кресло, услуга встречи или аналогичные услуги, отображаются пользователю на экране выбора автомобиля и/или в резюме бронирования. Пользователь принимает итоговую стоимость и возможные дополнительные сборы до завершения бронирования.",
            "Дополнительные остановки, изменение маршрута, дополнительное время ожидания, не относящееся к периодам ожидания, регулируемым разделом 8, другой пункт назначения, дополнительные пассажиры, дополнительный багаж или аналогичные операционные изменения, запрошенные после завершения бронирования, могут подлежать дополнительной оплате.",
            "В случаях, когда требуется дополнительная оплата, пользователь будет по возможности заранее проинформирован.",
          ],
        },
        {
          title: "6. Класс автомобиля",
          paragraphs: [
            "Модели автомобилей, отображаемые в процессе бронирования, являются представительными. Поставщик услуги может отправить автомобиль равного или более высокого класса, чем выбранный пользователем, по причинам операционной целесообразности, доступности автомобилей, юридических требований или качества обслуживания.",
            "Если по причине операционной необходимости, технической неисправности, аварии, дорожных условий, доступности автомобилей или аналогичных причин предоставляется автомобиль более низкого класса, чем тот, за который пользователь оплатил, пользователь может запросить возврат разницы между оплаченным классом автомобиля и фактически предоставленным классом автомобиля.",
          ],
        },
        {
          title: "7. Отмена и возврат",
          paragraphs: [
            [
              "Условия отмены и возврата для бронирований, оформленных через Tripetica.com, объясняются на странице ",
              {
                slug: "cancellation-refund-policy",
                label:
                  "Cancellation and Refund Policy / Политика отмены и возврата",
              },
              ".",
            ],
            "Как общее правило, бронирование можно отменить или изменить, если до начала услуги остаётся больше 6 часов.",
            "При отмене в разрешённый срок возвращается 100% ранее полученной и ещё не возвращённой чистой суммы. Если до начала услуги осталось 6 часов или меньше, отмена и изменение недоступны. В случае no-show оплата может не возвращаться.",
          ],
        },
        {
          title: "8. Бесплатное время ожидания и no-show",
          paragraphs: [
            "Бесплатное время ожидания составляет 90 минут при посадке в аэропорту, 30 минут при посадке на железнодорожном вокзале, автобусном терминале, в порту, круизном терминале и аналогичном месте и 20 минут при посадке у отеля, по частному адресу, у больницы, места работы, ресторана и в аналогичном месте.",
            "При оказании услуг трансфера, если пассажир не прибыл в установленный пункт посадки или место встречи к моменту окончания соответствующего бесплатного времени ожидания, бронирование может быть признано no-show. Стоимость услуги по бронированию, признанному no-show, не возвращается.",
            "Для услуги «Автомобиль с водителем с почасовой оплатой» и иных услуг, приобретённых на определённый срок, окончание бесплатного времени ожидания не означает немедленного признания бронирования no-show. Водитель продолжает ожидать пассажира, а приобретённая продолжительность услуги начинает исчисляться с момента окончания бесплатного времени ожидания. Последующее время ожидания вычитается из общей продолжительности услуги, приобретённой клиентом. Если пассажир прибывает позднее, услуга оказывается в течение оставшегося времени. Если пассажир не приступил к получению услуги до истечения всей приобретённой продолжительности услуги, бронирование может быть признано no-show.",
            "Для туров и мероприятий, связанных с фиксированной программой или временем отправления, применяются специальные правила участия, встречи, трансферного обслуживания и времени отправления, сообщённые при бронировании и указанные в документе бронирования для соответствующей услуги.",
          ],
        },
        {
          title: "9. Право на отказ и характер услуги",
          paragraphs: [
            "Пользователь принимает, что бронирование относится к частной транспортной услуге, трансферу, предоставлению автомобиля или услуге автомобиля с водителем, которые оказываются в конкретную дату и в конкретное время.",
            [
              "Поскольку услуга привязана к конкретной дате и времени, а планирование автомобиля и операций выполняется в соответствии с этим бронированием, право на отказ и процедуры отмены оцениваются в рамках применимого законодательства, характера услуги и ",
              {
                slug: "cancellation-refund-policy",
                label: "Политики отмены и возврата",
              },
              " Tripetica.com.",
            ],
            "Пользователь подтверждает, что до завершения бронирования прочитал и принял условия отмены и возврата.",
          ],
        },
        {
          title: "10. Персональные данные",
          paragraphs: [
            "Информация, полученная от пользователя, такая как имя, фамилия, номер телефона, адрес электронной почты, места посадки и назначения, номер рейса, информация о пассажирах, гражданство, паспортные данные и аналогичные сведения, может использоваться для создания бронирования, предоставления услуги, выполнения юридических уведомлений, поддержки клиентов и операционной коммуникации.",
            [
              "Подробности об обработке персональных данных объясняются на странице ",
              {
                slug: "privacy-policy",
                label: "Privacy Policy / Политика конфиденциальности",
              },
              ".",
            ],
          ],
        },
        {
          title: "11. Контакты",
          paragraphs: [
            "Каналы связи Tripetica.com могут использоваться для бронирований, изменений, отмен, платежей, операционной поддержки и жалоб.",
            "Актуальная контактная информация указана в разделе «Контакты» в Footer сайта.",
          ],
        },
        {
          title: "12. Подтверждение",
          paragraphs: [
            [
              "Перед завершением бронирования или переходом на страницу онлайн-оплаты пользователь подтверждает, что прочитал, понял и принял Preliminary Information Form / Форму предварительной информации, Distance Service Sales Agreement / Дистанционный договор оказания услуг, ",
              {
                slug: "cancellation-refund-policy",
                label:
                  "Cancellation and Refund Policy / Политику отмены и возврата",
              },
              " и ",
              {
                slug: "privacy-policy",
                label: "Privacy Policy / Политику конфиденциальности",
              },
              ".",
            ],
          ],
        },
        {
          paragraphs: ["pre_info_v1.0_2026-07-01"],
        },
      ],
    },
    "distance-sales-agreement": {
      metaTitle: "Дистанционный договор продажи услуги | Tripetica",
      metaDescription:
        "Дистанционный договор продажи услуги Tripetica.com: частный трансфер, трансфер из/в аэропорт и автомобиль с водителем.",
      h1: "Дистанционный договор продажи услуги",
      sections: [
        {
          paragraphs: [
            "Подготовлено для регулирования основных прав и обязанностей между поставщиком услуги и пользователем/получателем услуги при бронировании частного трансфера, трансфера из/в аэропорт, услуги автомобиля с водителем и аналогичных транспортных услуг через Tripetica.com.",
          ],
        },
        {
          title: "1. Стороны",
          paragraphs: [
            "Поставщик услуги:",
            "Tripetica.com является брендом, управляемым компанией Search Travel Agency Turizm Taşımacılık Ticaret Limited Şirketi.",
            "Пользователь / получатель услуги:",
            "Пользователь/получатель услуги — это физическое или юридическое лицо, которое создает бронирование, приобретает услугу или получает услугу от имени другого лица через Tripetica.com.",
            "Пользователь подтверждает, что информация, предоставленная при создании бронирования, является точной, актуальной и полной.",
          ],
        },
        {
          title: "2. Предмет договора",
          paragraphs: [
            "Предметом настоящего договора является предоставление частного трансфера, трансфера из/в аэропорт, услуги автомобиля с водителем или аналогичной транспортной услуги в соответствии с выбранными пользователем через Tripetica.com пунктом посадки, пунктом назначения, датой, временем, количеством пассажиров, информацией о багаже, классом автомобиля и дополнительными услугами, если они выбраны.",
          ],
        },
        {
          title: "3. Создание бронирования",
          paragraphs: [
            "Пользователь вводит необходимые данные бронирования через Tripetica.com и видит класс автомобиля, стоимость и способ оплаты.",
            [
              "Завершение бронирования или переход на страницу онлайн-оплаты означает, что пользователь прочитал, понял и принял настоящий договор, ",
              {
                slug: "preliminary-information",
                label: "Форму предварительной информации",
              },
              ", ",
              {
                slug: "cancellation-refund-policy",
                label: "Политику отмены и возврата",
              },
              " и ",
              {
                slug: "privacy-policy",
                label: "Политику конфиденциальности",
              },
              ".",
            ],
            "Бронирование считается завершенным, когда оно создано в системе Tripetica с кодом бронирования. Подтверждение бронирования, отправленное пользователю, является информационной и подтверждающей записью созданного бронирования.",
          ],
        },
        {
          title: "4. Стоимость и платежное обязательство",
          paragraphs: [
            "Стоимость, отображаемая в процессе бронирования, рассчитывается в зависимости от выбранного типа услуги, маршрута, расстояния, класса автомобиля, количества пассажиров, информации о багаже, дополнительных услуг и выбранного способа оплаты.",
            "Пользователь видит итоговую стоимость до завершения бронирования.",
            "Завершение бронирования или переход на страницу онлайн-оплаты означает, что пользователь принимает возникновение платежного обязательства за выбранную услугу.",
          ],
        },
        {
          title: "5. Дополнительные услуги и дополнительные сборы",
          paragraphs: [
            "Дополнительные услуги, выбранные в процессе бронирования, такие как дополнительные пассажиры, дополнительный багаж, детское кресло, услуга встречи или аналогичные услуги, отображаются пользователю на экране выбора автомобиля и/или в резюме бронирования. Пользователь принимает итоговую стоимость и возможные дополнительные сборы до завершения бронирования.",
            "Дополнительные остановки, изменение маршрута, другой пункт назначения, дополнительные пассажиры, дополнительный багаж, дополнительное ожидание за пределами объёма или продолжительности приобретённой услуги и аналогичные операционные изменения, запрошенные после завершения бронирования, могут подлежать дополнительной оплате.",
            "В случаях, когда требуется дополнительная оплата, пользователь будет по возможности заранее проинформирован.",
          ],
        },
        {
          title: "6. Обязанности пользователя",
          paragraphs: [
            "Пользователь обязан предоставить точную и полную информацию, такую как пункт посадки, пункт назначения, дата, время, количество пассажиров, количество багажа, контактные данные и, при необходимости, номер рейса, информацию о поезде, автобусе или судне.",
            "Если из-за неверной или неполной информации услуга не может быть оказана, возникает задержка, автомобиль направляется по неверному адресу или возникает ситуация no-show, ответственность может лежать на пользователе.",
            "Пользователь несет ответственность за выбор класса автомобиля, подходящего для указанного при бронировании количества пассажиров и вместимости багажа.",
          ],
        },
        {
          title: "7. Обязанности поставщика услуги",
          paragraphs: [
            "Поставщик услуги выполняет необходимое операционное планирование для предоставления услуги в соответствии с подтвержденной информацией бронирования.",
            "Поставщик услуги может вносить разумные изменения в способ предоставления услуги по причинам операционной целесообразности, доступности автомобилей, дорожного движения, состояния дорог, безопасности, технической неисправности или аналогичным причинам.",
          ],
        },
        {
          title: "8. Класс автомобиля и изменения автомобиля",
          paragraphs: [
            "Модели автомобилей, отображаемые в процессе бронирования, являются представительными. Может быть предоставлен автомобиль другой марки/модели того же класса или с аналогичными характеристиками.",
            "Поставщик услуги может отправить автомобиль равного или более высокого класса, чем выбранный пользователем, по причинам операционной целесообразности, доступности автомобилей, юридических требований или качества обслуживания.",
            "Если по причине операционной необходимости, технической неисправности, аварии, дорожных условий, доступности автомобилей или аналогичных причин предоставляется автомобиль более низкого класса, чем тот, за который пользователь оплатил, пользователь может запросить возврат разницы между оплаченным классом автомобиля и фактически предоставленным классом автомобиля.",
          ],
        },
        {
          title: "9. Бесплатное время ожидания",
          paragraphs: [
            "Бесплатное время ожидания оценивается в зависимости от типа пункта посадки и информации, предоставленной пользователем в процессе бронирования.",
            "При посадке в аэропорту, если пользователь указал действительный номер рейса в процессе бронирования, бесплатное время ожидания начинается с фактического времени посадки самолета. Если номер рейса не был предоставлен или информацию о рейсе невозможно проверить, бесплатное время ожидания начинается с даты и времени, указанных пользователем в процессе бронирования.",
            "При посадке на железнодорожном вокзале, автобусном терминале, в порту, круизном терминале или аналогичных транспортных пунктах, если пользователь предоставил действительную информацию о рейсе/маршруте, бесплатное время ожидания начинается с фактического времени прибытия поезда, автобуса, судна или соответствующего транспортного средства. Если такая информация не была предоставлена или ее невозможно проверить, бесплатное время ожидания начинается с даты и времени, указанных пользователем в процессе бронирования.",
            "Для отелей, частных адресов, больниц, рабочих мест, ресторанов или других аналогичных пунктов посадки бесплатное время ожидания начинается с даты и времени, указанных пользователем в процессе бронирования.",
            "Бесплатное время ожидания составляет:",
          ],
          bullets: [
            "Посадка в аэропорту: 90 минут",
            "Железнодорожные вокзалы, автобусные терминалы, порты, круизные терминалы и аналогичные транспортные пункты: 30 минут",
            "Отели, частные адреса, больницы, рабочие места, рестораны и другие пункты посадки: 20 минут",
          ],
          afterBullets: [
            "При оказании услуг трансфера, если пассажир не прибыл в установленный пункт посадки или место встречи к моменту окончания соответствующего бесплатного времени ожидания, бронирование может быть признано no-show.",
            "Для услуги «Автомобиль с водителем с почасовой оплатой» и иных услуг, приобретённых на определённый срок, окончание бесплатного времени ожидания не означает немедленного признания бронирования no-show. Водитель продолжает ожидать пассажира, а приобретённая продолжительность услуги начинает исчисляться с момента окончания бесплатного времени ожидания. Последующее время ожидания вычитается из общей продолжительности услуги, приобретённой клиентом. Если пассажир прибывает позднее, услуга оказывается в течение оставшегося времени. Если пассажир не приступил к получению услуги до истечения всей приобретённой продолжительности услуги, бронирование может быть признано no-show.",
            "Для туров и мероприятий, связанных с фиксированной программой или временем отправления, применяются специальные правила участия, встречи, трансферного обслуживания и времени отправления, сообщённые при бронировании и указанные в документе бронирования для соответствующей услуги.",
          ],
        },
        {
          title: "10. Отмена, возврат и no-show",
          paragraphs: [
            [
              "Условия отмены, возврата и no-show отдельно объясняются на странице ",
              {
                slug: "cancellation-refund-policy",
                label: "Политики отмены и возврата",
              },
              ".",
            ],
            "Как общее правило, бронирование можно отменить или изменить, если до начала услуги остаётся больше 6 часов.",
            "При отмене в разрешённый срок возвращается 100% ранее полученной и ещё не возвращённой чистой суммы. Если до начала услуги осталось 6 часов или меньше, отмена и изменение недоступны. В случаях no-show, возникших при условиях, указанных в разделе 9, оплата может не возвращаться.",
          ],
        },
        {
          title: "11. Право на отказ и характер услуги",
          paragraphs: [
            "Пользователь принимает, что бронирование относится к частной транспортной услуге, трансферу, предоставлению автомобиля или услуге автомобиля с водителем, которые оказываются в конкретную дату и в конкретное время.",
            [
              "Поскольку услуга привязана к конкретной дате и времени, а планирование автомобиля и операций выполняется в соответствии с этим бронированием, право на отказ и процедуры отмены оцениваются в рамках применимого законодательства, характера услуги и ",
              {
                slug: "cancellation-refund-policy",
                label: "Политики отмены и возврата",
              },
              " Tripetica.com.",
            ],
          ],
        },
        {
          title: "12. Форс-мажор и операционные обстоятельства",
          paragraphs: [
            "В случаях дорожной загруженности, аварии, перекрытия дороги, погодных условий, официальных мер безопасности, неисправности автомобиля, задержек рейсов/транспорта, природных бедствий, общественных событий или аналогичных обстоятельств, находящихся вне разумного контроля поставщика услуги, могут возникнуть задержки, изменения маршрута, замена автомобиля или операционные корректировки.",
            "В таких случаях поставщик услуги постарается по возможности проинформировать пользователя и предоставить услугу разумным образом.",
          ],
        },
        {
          title: "13. Персональные данные",
          paragraphs: [
            "Информация, полученная от пользователя, такая как имя, фамилия, номер телефона, адрес электронной почты, места посадки и назначения, номер рейса, информация о пассажирах, гражданство, паспортные данные и аналогичные сведения, может использоваться для создания бронирования, предоставления услуги, выполнения юридических уведомлений, поддержки клиентов и операционной коммуникации.",
            [
              "Подробности об обработке персональных данных объясняются на странице ",
              {
                slug: "privacy-policy",
                label: "Политики конфиденциальности",
              },
              ".",
            ],
          ],
        },
        {
          title: "14. Контакты",
          paragraphs: [
            "Каналы связи Tripetica.com могут использоваться для бронирований, изменений, отмен, платежей, операционной поддержки и жалоб.",
            "Актуальная контактная информация указана в разделе «Контакты» в Footer сайта.",
          ],
        },
        {
          title: "15. Вступление в силу и подтверждение",
          paragraphs: [
            [
              "Перед завершением бронирования или переходом на страницу онлайн-оплаты пользователь подтверждает, что прочитал, понял и принял настоящий Дистанционный договор продажи услуги, ",
              {
                slug: "preliminary-information",
                label: "Форму предварительной информации",
              },
              ", ",
              {
                slug: "cancellation-refund-policy",
                label: "Политику отмены и возврата",
              },
              " и ",
              {
                slug: "privacy-policy",
                label: "Политику конфиденциальности",
              },
              ".",
            ],
            "Настоящий договор вступает в силу после завершения бронирования пользователем.",
          ],
        },
        {
          paragraphs: ["service_agreement_v1.0_2026-07-01"],
        },
      ],
    },
    "cancellation-refund-policy": {
      metaTitle: "Политика отмены и возврата | Tripetica",
      metaDescription:
        "Условия отмены, возврата, бесплатного времени ожидания и no-show для бронирований через Tripetica.com.",
      h1: "Политика отмены и возврата",
      sections: [
        {
          paragraphs: [
            "Подготовлено для объяснения условий отмены, возврата, бесплатного времени ожидания и no-show, применимых к бронированиям частного трансфера, трансфера из/в аэропорт, услуги автомобиля с водителем и аналогичных транспортных услуг через Tripetica.com.",
          ],
        },
        {
          title: "1. Общая область применения",
          paragraphs: [
            "Настоящая политика применяется к бронированиям, созданным через Tripetica.com.",
            "Перед завершением бронирования или переходом на страницу онлайн-оплаты пользователь подтверждает, что прочитал, понял и принял настоящую Политику отмены и возврата.",
          ],
        },
        {
          title: "2. Право на отмену и изменение",
          paragraphs: [
            "Как общее правило, бронирование можно отменить или изменить, если до начала услуги остаётся больше 6 часов.",
            "При отмене в разрешённый срок, если была произведена онлайн-оплата, возвращается 100% ранее полученной и ещё не возвращённой чистой суммы. Если был выбран вариант оплаты наличными водителю, с пользователя не взимается плата за услугу.",
          ],
        },
        {
          title: "3. Отмена и изменение при остатке 6 часов или меньше",
          paragraphs: [
            "Если до начала услуги осталось 6 часов или меньше, клиент не может отменить или изменить бронирование, и возврат не производится.",
            "Для бронирований с вариантом оплаты наличными водителю поставщик услуги оставляет за собой право отказать в будущих бронированиях, если они являются повторяющимися, злоупотребляющими системой или вызывающими операционные убытки.",
          ],
        },
        {
          title: "4. Бесплатное время ожидания",
          paragraphs: [
            "Бесплатное время ожидания оценивается в зависимости от типа пункта посадки и информации, предоставленной пользователем в процессе бронирования.",
            "При посадке в аэропорту, если пользователь указал действительный номер рейса в процессе бронирования, бесплатное время ожидания начинается с фактического времени посадки самолета. Если номер рейса не был предоставлен или информацию о рейсе невозможно проверить, бесплатное время ожидания начинается с даты и времени, указанных пользователем в процессе бронирования.",
            "При посадке на железнодорожном вокзале, автобусном терминале, в порту, круизном терминале или аналогичных транспортных пунктах, если пользователь предоставил действительную информацию о рейсе/маршруте, бесплатное время ожидания начинается с фактического времени прибытия поезда, автобуса, судна или соответствующего транспортного средства. Если такая информация не была предоставлена или ее невозможно проверить, бесплатное время ожидания начинается с даты и времени, указанных пользователем в процессе бронирования.",
            "Для отелей, частных адресов, больниц, рабочих мест, ресторанов или других аналогичных пунктов посадки бесплатное время ожидания начинается с даты и времени, указанных пользователем в процессе бронирования.",
            "Бесплатное время ожидания составляет:",
          ],
          bullets: [
            "Посадка в аэропорту: 90 минут",
            "Железнодорожные вокзалы, автобусные терминалы, порты, круизные терминалы и аналогичные транспортные пункты: 30 минут",
            "Отели, частные адреса, больницы, рабочие места, рестораны и другие пункты посадки: 20 минут",
          ],
        },
        {
          title: "5. No-show",
          paragraphs: [
            "При оказании услуг трансфера, если пассажир не прибыл в установленный пункт посадки или место встречи к моменту окончания соответствующего бесплатного времени ожидания, бронирование может быть признано no-show.",
            "Для услуги «Автомобиль с водителем с почасовой оплатой» и иных услуг, приобретённых на определённый срок, окончание бесплатного времени ожидания не означает немедленного признания бронирования no-show. Водитель продолжает ожидать пассажира, а приобретённая продолжительность услуги начинает исчисляться с момента окончания бесплатного времени ожидания. Последующее время ожидания вычитается из общей продолжительности услуги, приобретённой клиентом. Если пассажир прибывает позднее, услуга оказывается в течение оставшегося времени. Если пассажир не приступил к получению услуги до истечения всей приобретённой продолжительности услуги, бронирование может быть признано no-show.",
            "Для туров и мероприятий, связанных с фиксированной программой или временем отправления, применяются специальные правила участия, встречи, трансферного обслуживания и времени отправления, сообщённые при бронировании и указанные в документе бронирования для соответствующей услуги. Если пассажир не смог принять участие в услуге из-за несоблюдения этих правил, бронирование может быть признано no-show.",
            "В случае no-show оплата может не возвращаться.",
            "Если услуга не может быть предоставлена из-за того, что пользователь указал неверный пункт посадки, неверную дату, неверное время, неполные контактные данные, неверную информацию о рейсе/маршруте или аналогичную неверную/неполную информацию, бронирование также может рассматриваться как no-show.",
          ],
        },
        {
          title: "6. Задержки рейса, поезда, автобуса или судна",
          paragraphs: [
            "Если пользователь предоставил действительный номер рейса или информацию о маршруте, операционная команда может отслеживать информацию о прибытии соответствующего транспортного средства.",
            "Однако возможность отслеживания информации о рейсе, поезде, автобусе, судне или аналогичном транспорте зависит от правильности предоставленных данных, возможности их проверки через системы и операционных возможностей.",
            "Если информация не была предоставлена или не может быть проверена, бесплатное время ожидания начинается с даты и времени, указанных пользователем в процессе бронирования.",
          ],
        },
        {
          title: "7. Неверная или неполная информация",
          paragraphs: [
            "Пользователь несет ответственность за правильное и полное предоставление пункта посадки, пункта назначения, даты, времени, номера рейса, информации о маршруте, контактных данных, количества пассажиров и информации о багаже.",
            "Если из-за неверной или неполной информации услуга не может быть предоставлена, возникает задержка, автомобиль направляется в неверный пункт или возникает no-show, оплата может не возвращаться.",
          ],
        },
        {
          title: "8. Изменения маршрута, дополнительные остановки и дополнительные услуги",
          paragraphs: [
            "Дополнительные остановки, изменение маршрута, другой пункт назначения, дополнительные пассажиры, дополнительный багаж, дополнительное ожидание за пределами объёма или продолжительности приобретённой услуги и аналогичные операционные изменения, запрошенные после завершения бронирования, могут подлежать дополнительной оплате.",
            "Если пользователь не принимает дополнительную оплату, услуга предоставляется в соответствии с подтвержденной информацией бронирования. Невозможность предоставления изменений, запрошенных вне подтвержденного бронирования, не создает права на возврат.",
          ],
        },
        {
          title: "9. Возврат при предоставлении автомобиля более низкого класса",
          paragraphs: [
            "Если по причине операционной необходимости, технической неисправности, аварии, дорожных условий, доступности автомобилей или аналогичных причин предоставляется автомобиль более низкого класса, чем тот, за который пользователь оплатил, пользователь может запросить возврат разницы между оплаченным классом автомобиля и фактически предоставленным классом автомобиля.",
            "Если предоставляется автомобиль равного или более высокого класса, дополнительная оплата с пользователя не взимается.",
          ],
        },
        {
          title: "10. Способ и срок возврата",
          paragraphs: [
            "Одобренные возвраты обрабатываются подходящим способом возврата в зависимости от способа оплаты и операционных условий.",
            "При онлайн-оплатах срок зачисления возврата на счет пользователя может различаться в зависимости от платежного провайдера, банка или эмитента карты.",
            "Для бронирований, по которым выбран вариант оплаты наличными водителю и оплата еще не была произведена, в подходящих случаях отмены с пользователя не производится взыскание.",
          ],
        },
        {
          title: "11. Форс-мажор и операционные обстоятельства",
          paragraphs: [
            "В случаях дорожной загруженности, аварии, перекрытия дороги, погодных условий, официальных мер безопасности, неисправности автомобиля, задержек рейсов/транспорта, природных бедствий, общественных событий или аналогичных обстоятельств, находящихся вне разумного контроля поставщика услуги, могут возникнуть задержки, изменения маршрута, замена автомобиля или операционные корректировки.",
            "В таких случаях поставщик услуги постарается по возможности проинформировать пользователя и предоставить услугу разумным образом.",
          ],
        },
        {
          title: "12. Контакты",
          paragraphs: [
            "Каналы связи Tripetica.com могут использоваться для запросов, связанных с отменой, возвратом, изменением бронирования или no-show.",
            "Актуальная контактная информация указана в разделе «Контакты» в Footer сайта.",
          ],
        },
        {
          paragraphs: ["cancellation_v1.0_2026-07-01"],
        },
      ],
    },
    "privacy-policy": {
      metaTitle:
        "Политика конфиденциальности и уведомление о защите персональных данных | Tripetica",
      metaDescription:
        "Как обрабатываются персональные данные при бронировании услуг через Tripetica.com.",
      h1: "Политика конфиденциальности и уведомление о защите персональных данных",
      sections: [
        {
          paragraphs: [
            "Данный текст подготовлен для объяснения того, как обрабатываются, используются и при необходимости передаются персональные данные, полученные от пользователей при бронировании через Tripetica.com частного трансфера, трансфера из/в аэропорт, услуги автомобиля с водителем, тура, мероприятия и аналогичных туристических или транспортных услуг, а также для предоставления информации о защите персональных данных.",
          ],
        },
        {
          title: "1. Общая область применения",
          paragraphs: [
            "Настоящий текст применяется к лицам, которые создают бронирование, приобретают услугу, связываются с Tripetica.com или используют веб-сайт.",
            "Перед завершением бронирования или переходом на страницу онлайн-оплаты пользователь подтверждает, что прочитал, понял и принял настоящую Политику конфиденциальности и Уведомление о защите персональных данных.",
          ],
        },
        {
          title: "2. Контролер данных",
          paragraphs: [
            "Tripetica.com является брендом, управляемым Search Travel Agency Turizm Taşımacılık Ticaret Limited Şirketi.",
            "Персональные данные могут обрабатываться в целях предоставления предлагаемых услуг, управления бронированиями, выполнения юридических обязательств и ведения операционных процессов.",
            "Официальный адрес компании, налоговая инспекция, налоговый номер, сведения о лицензиях и другая юридическая информация отдельно указаны на странице Legal Information / Юридическая информация.",
          ],
        },
        {
          title: "3. Собираемые персональные данные",
          paragraphs: [
            "Во время создания бронирования, предоставления услуги или общения через Tripetica.com могут быть получены следующие данные:",
          ],
          bullets: [
            "Имя и фамилия",
            "Номер телефона",
            "Адрес электронной почты",
            "Пункт посадки и пункт назначения",
            "Дата и время бронирования",
            "Информация о выбранной услуге или туре",
            "Количество пассажиров",
            "Информация о багаже",
            "Предпочтения по детскому креслу, услуге встречи или аналогичным дополнительным услугам",
            "Номер рейса, информация о рейсе поезда/автобуса/судна",
            "Информация о пассажирах и участниках",
            "Информация о гражданстве",
            "Паспортные данные",
            "Способ оплаты",
            "Примечания к бронированию",
            "Другая информация, переданная пользователем через каналы связи",
            "Технические данные, которые могут возникать при использовании веб-сайта",
          ],
        },
        {
          title: "4. Цели обработки персональных данных",
          paragraphs: [
            "Собранные персональные данные могут обрабатываться для следующих целей:",
          ],
          bullets: [
            "Создание бронирования",
            "Предоставление трансфера, услуги автомобиля с водителем, тура, мероприятия или других забронированных услуг",
            "Планирование пассажиров, участников, автомобилей и операций, а также передача операционной команде необходимых сведений о бронировании",
            "Связь с пользователем по вопросам бронирования, оплаты, места встречи, изменений или отмены",
            "Отправка ваучера, подтверждения бронирования и операционных уведомлений",
            "Выполнение юридических уведомлений, официальных записей и обязательных операционных процедур",
            "Выполнение обязательств по UETDS или аналогичных официальных/операционных уведомлений",
            "Предоставление клиентской поддержки",
            "Оценка жалоб, возвратов, случаев no-show или операционных споров",
            "Повышение качества услуги и обеспечение безопасности",
            "Ведение бухгалтерских, финансовых и платежных процессов",
          ],
        },
        {
          title: "5. Правовые основания обработки персональных данных",
          paragraphs: [
            "Персональные данные могут обрабатываться в рамках создания бронирования, заключения и исполнения договора оказания услуги, предоставления услуги, выполнения юридических обязательств, направления официальных уведомлений, ответа на запросы пользователя и законных операционных интересов поставщика услуги.",
            "При необходимости персональные данные также могут обрабатываться на основании явного согласия пользователя.",
          ],
        },
        {
          title: "6. Информация о пассажирах и юридические обязательства",
          paragraphs: [
            "В некоторых услугах имя, фамилия, гражданство, номер паспорта и аналогичная информация пассажиров могут запрашиваться в связи с применимым законодательством, обязательствами по официальным уведомлениям, UETDS или аналогичными юридическими/операционными требованиями.",
            "Пользователь соглашается, что эта информация, относящаяся к нему самому или к пассажирам, получающим услугу, может использоваться для предоставления услуги, выполнения юридических обязательств и направления необходимых официальных/операционных уведомлений.",
            "Если пользователь передает информацию от имени других пассажиров, пользователь подтверждает, что он уполномочен передавать такую информацию и надлежащим образом проинформировал соответствующих лиц.",
          ],
        },
        {
          title: "7. Платежная информация",
          paragraphs: [
            "Онлайн-платежи могут осуществляться через соответствующего платежного провайдера.",
            "Tripetica.com не хранит полный номер карты пользователя, код безопасности карты или аналогичную конфиденциальную карточную информацию в своей системе.",
            "Во время платежного процесса платежный провайдер может передавать Tripetica.com сумму операции, статус платежа, номер платежной ссылки, дату платежа и аналогичную информацию о платежной операции, которая может быть связана с записью бронирования.",
          ],
        },
        {
          title: "8. Передача персональных данных",
          paragraphs: [
            "Персональные данные могут передаваться следующим лицам и организациям в той мере, в какой это необходимо для предоставления услуги и выполнения юридических/операционных обязательств:",
          ],
          bullets: [
            "Водители",
            "Поставщики автомобилей",
            "Поставщики услуг, участвующие в проведении туров, мероприятий или оказании других забронированных услуг",
            "Операционная команда",
            "Платежные провайдеры",
            "Поставщики услуг электронной почты, сообщений или уведомлений",
            "Уполномоченные государственные учреждения и официальные органы",
            "Соответствующие учреждения и организации в рамках юридических обязательств",
            "Поставщики услуг технической инфраструктуры, хостинга, безопасности и поддержки",
          ],
          afterBullets: [
            "Персональные данные не передаются третьим лицам, если это не является необходимым для предоставления услуги или выполнения юридических обязательств.",
          ],
        },
        {
          title: "9. Связь и операционные уведомления",
          paragraphs: [
            "С пользователем могут связываться по телефону, электронной почте, WhatsApp, Telegram, Viber или аналогичным каналам связи по вопросам информации о бронировании, операционной поддержки, места встречи, времени трансферного обслуживания, участия и времени отправления, информации о водителе/автомобиле, статуса оплаты, отмены/изменения и аналогичных вопросов.",
            "Такие уведомления направляются с целью предоставления услуги и корректного выполнения бронирования.",
          ],
        },
        {
          title: "10. Хранение данных",
          paragraphs: [
            "Персональные данные могут храниться в течение срока, необходимого для создания бронирования, предоставления услуги, выполнения юридических обязательств, ведения бухгалтерских/финансовых записей, оценки споров и хранения операционных записей.",
            "Некоторая информация может храниться дольше в связи с законными сроками хранения, официальными обязательствами или возможными спорами.",
            "После истечения срока хранения или исчезновения причины, требующей хранения, информация может быть удалена, обезличена или архивирована в соответствии с применимым законодательством.",
          ],
        },
        {
          title: "11. Ответственность пользователя",
          paragraphs: [
            "Пользователь несет ответственность за предоставление точной, актуальной и полной информации о себе или о пассажирах, получающих услугу, во время процесса бронирования.",
            "Если услуга не может быть предоставлена, возникает задержка, юридические уведомления не могут быть выполнены или появляются операционные проблемы из-за неверной или неполной информации, ответственность может лежать на пользователе.",
          ],
        },
        {
          title: "12. Безопасность данных",
          paragraphs: [
            "Tripetica.com стремится принимать разумные технические и административные меры для защиты персональных данных от несанкционированного доступа, утраты, неправомерного использования или несанкционированной передачи.",
            "Тем не менее ни одна передача данных через интернет и ни одна электронная система не являются полностью безрисковыми. Пользователь соглашается, что в процессах электронной коммуникации и онлайн-транзакций могут существовать определенные технические риски.",
          ],
        },
        {
          title: "13. Cookies и технические данные",
          paragraphs: [
            "Tripetica.com может использовать cookies или аналогичные технические инструменты для работы веб-сайта, улучшения пользовательского опыта, языковых/валютных предпочтений, процесса бронирования, безопасности и производительности.",
            "Во время использования веб-сайта могут обрабатываться технические данные, такие как устройство, браузер, IP-адрес, информация о сессии, посещенные страницы и аналогичные данные.",
          ],
        },
        {
          title: "14. Права пользователя",
          paragraphs: [
            "В соответствии с применимым законодательством пользователь может иметь права запрашивать информацию о своих персональных данных, требовать исправления, удаления, ограничения обработки, передачи данных или возражать против обработки.",
            "Пользователь может использовать каналы связи Tripetica.com для запросов, связанных с его персональными данными.",
            "Для выполнения запроса может потребоваться подтверждение личности пользователя и соответствующего бронирования.",
          ],
        },
        {
          title: "15. Изменения политики",
          paragraphs: [
            "Tripetica.com может время от времени обновлять настоящую Политику конфиденциальности и Уведомление о защите персональных данных.",
            "Актуальным текстом является активная версия, опубликованная на Tripetica.com.",
            "Версия текста, принятая пользователем во время процесса бронирования, может храниться в соответствующей записи бронирования.",
          ],
        },
        {
          title: "16. Контакты",
          paragraphs: [
            "Каналы связи Tripetica.com могут использоваться по вопросам персональных данных, запросов о конфиденциальности, информации о бронировании или другим вопросам.",
            "Актуальная контактная информация указана в разделе «Контакты» в Footer сайта.",
          ],
        },
        {
          paragraphs: ["privacy_v1.0_2026-07-01"],
        },
      ],
    },
  },
};
