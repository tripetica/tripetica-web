# FMB920 DOUT1 röle montaj notu

Bu not, Teltonika’nın yayımladığı FMB920 sayfalarından alınmıştır. Tripetica bu montaj sırasında cihaza komut göndermez. DIN1 çıkış olarak kullanılmaz.

Kaynaklar:

- [FMB920 General description](https://wiki.teltonika-gps.com/view/FMB920_General_description)
- [FMB920 First Start](https://wiki.teltonika-gps.com/view/FMB920_First_Start)
- [FMB920 Quick Manual v1.8](https://wiki.teltonika-gps.com/images/1/19/Quick-manual-FMB920.pdf)
- [setdigout](https://wiki.teltonika-gps.com/view/SMS/GPRS_command_-_setdigout)

## Çıkış

FMB920’de bir açık kolektör (open drain) dijital çıkış vardır. Teltonika bunu harici röle, LED veya buzzer için tanımlar.

Quick Manual v1.8 kablo renkleri:

| Pin | Ad | Renk | İşlev |
| --- | --- | --- | --- |
| 1 | VCC | Kırmızı | Besleme, 6–30 V DC |
| 2 | GND | Siyah | Şasi |
| 3 | DIN1 | Sarı | Dijital giriş. Kontak için ayrılmıştır. Çıkış değildir. |
| 4 | AIN1 | Gri | Analog giriş, 0–30 V DC |
| 5 | DOUT1 | Beyaz | Açık kolektör dijital çıkış |

Röle yalnız pin 5, beyaz DOUT1 kablosuna bağlanır. Sarı DIN1 kablosu kontağa ayrılır. İkisi yer değiştirilmez.

## Akım sınırı

Güncel genel açıklama sayfası, çıkış açıkken önerilen çalışma akımını 0,1–0,5 A olarak verir. Kapalıyken kaçak akım en fazla 120 µA’dır. Quick Manual v1.8 de DOUT1 için en fazla 0,5 A yazar.

First Start sayfası ve daha eski kullanıcı kılavuzu pin 5 için 3,3 A yazar. Bu iki değer çelişir. Röle bobini 0,5 A sınırına göre seçilir. 3,3 A’lık bir yük DOUT1’e bağlanmaz. Marş motoru veya yakıt pompası doğrudan DOUT1’e bağlanmaz.

Mutlak sınırlar, genel açıklama sayfasında besleme için −32…+32 V ve açık drenaj kelepçe eşiği için 2 mA’da +36 V olarak yazılır.

## Röle

Teltonika, DOUT1’i harici röle sürmek için tanımlar. Quick Manual’daki bağlantı şemasında röle uçları, kontak algılama ve marş etiketi vardır. Şemanın hangi ucu hangi pine bağladığı metin olarak çıkarılmadı. Bağlantı, basılı Quick Manual v1.8 “Wiring scheme” şekline göre yapılır. Bu not o şekli yeniden çizmez.

Röle, bobini enerjisizken kapalı kontağı açık olan tipte seçilir. Bobin akımı 0,5 A’nın altında ölçülür. Bobinin artı beslemesine, bu akımı aşmayacak bir sigorta konur. Teltonika belirli bir sigorta amperi yayımlamaz.

GSM kesilince DOUT1’in bırakılacağı, incelenen sayfalarda yazmaz. `setdigout 1` yanıtı `DOUT1:ON Timeout:INFINITY` ise çıkış, yeni bir komut veya süre dolana kadar o durumda kalır. Bırakma davranışı montajdan sonra ölçü aletiyle doğrulanır. Doğrulanmadan marş devresine bağlanmaz.

## Kontak

DIN1 gerçek kontak girişidir. AVL IO kimliği 1’dir. DIN1 = 1 kontak açık, DIN1 = 0 kontak kapalıdır. Kırmızı VCC sürekli beslemedir ve kontak sinyali olarak kullanılmaz. Sarı DIN1 kablosu, motor çalıştıktan sonra da kaybolmayan gerçek kontak kontrollü hatta bağlanır. ACC hattı kullanılmaz.

Teltonika Configurator’da Ignition Source = DIN1 yapılır. Parametre listesinde bu değer 1’dir. Varsayılan değer DIN1 değildir. IO 239, Ignition Source ayarını izler. Kırmızı besleme kontak kaynağı olarak seçilirse IO 239 kontak açık gibi görünebilir. Tripetica harita rengi IO 239’u değil, DIN1’i okur.

## Rölenin işlevi

Teltonika kullanıcı kılavuzu, şemadaki bağlantıda çıkış ON iken FMB9YX’in motor marşını kestiğini yazar. İstenen davranış budur: çalışan motorun yakıtı, ateşlemesi veya ECU beslemesi kesilmez. Araç durup motor kapatıldıktan sonra sonraki marş engellenir. Bu not, basılı şemadaki röle uçlarını yeniden çizmez. Elektrikçi Quick Manual v1.8 Wiring scheme şeklini izler ve rölenin yalnız marş devresini etkilediğini, motor çalışırken kesinti yaratmadığını ölçer.

## Komut

FMB920’nin yayımlanan komutu `setdigout` dir. Tek çıkış için `setdigout 1` açar, `setdigout 0` kapatır. Yanıt `DOUT1:ON` veya `DOUT1:OFF` uygulandığını, `QUEUED` ise henüz uygulanmadığını gösterir. `DOUT1:Is disabled from CFG` çıkışın konfigurasyonda kapalı olduğunu gösterir.

Hız eşiğiyle kuyruğa alınan `setdigout` biçimi kullanılmaz. Cihaz, hız düşünce komutu kendisi uygulayabilir. FMB920 firmware 03.27.14 için `setigndigout` yayımlanmış komut değildir. O komut 03.28.03 ve sonrasında eklenmiştir.

Komut, Codec 12 ile açık bir GPRS oturumunda gider. Cihaz çevrimdışıyken bu oturum yoktur ve komut cihaza ulaşmaz. Production dinleyicisi `setdigout` metnini yalnız marş devresi fiziksel olarak doğrulandıktan sonra kuyruktaki talep için yazar. Doğrulama yokken talep kaydedilir ve sokete yazılmaz. Komut yanıtı, marşın fiziksel olarak engellendiğinin kanıtı değildir.

## Montajdan sonra

1. Araç park halinde, kontak kapalı ve motor çalışmıyorken yapılır.
2. Beyaz kablonun DOUT1, sarı kablonun DIN1 olduğu gözle kontrol edilir. Sarı kablo sürekli kırmızı beslemeye değil, kontak kontrollü hatta bağlanır.
3. Teltonika Configurator’da Ignition Source = DIN1 yapılır. I/O ekranında DIN1, kontak anahtarıyla birlikte değişir. DOUT1 bu kontrolde kapalı görünür.
4. Röle bobin akımı 0,5 A’nın altında ölçülür. Ölçüm Tripetica üzerinden yapılmaz.
5. Bobin enerjisizken röle kontağının açık olduğu ölçülür.
6. Bu ölçümler tamamlanmadan marş devresinde yol testi yapılmaz.
7. Ölçümden sonra operasyon kullanıcısı röle montajını ve kurulum doğrulamasını işaretleyebilir. Marş devresi doğrulaması ayrıdır ve varsayılan kapalıdır. Bu işaret, rölenin yalnız marş devresini etkilediği ve çalışan motoru kesmediği fiziksel olarak ölçüldükten sonra konur. İşaret konmadan çıkış komutu gönderilmez.
