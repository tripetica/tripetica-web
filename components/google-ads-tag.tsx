import Script from "next/script";

export const GOOGLE_ADS_TAG_ID = "AW-18432845886";

export function GoogleAdsTag() {
  return (
    <>
      <Script
        async
        id="google-ads-gtag-js"
        src={`https://www.googletagmanager.com/gtag/js?id=${GOOGLE_ADS_TAG_ID}`}
        strategy="afterInteractive"
      />
      <Script id="google-ads-gtag-init" strategy="afterInteractive">
        {`
window.dataLayer = window.dataLayer || [];
function gtag(){dataLayer.push(arguments);}
gtag('js', new Date());
gtag('config', '${GOOGLE_ADS_TAG_ID}');
`}
      </Script>
    </>
  );
}
