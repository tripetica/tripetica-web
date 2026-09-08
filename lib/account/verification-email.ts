import { type Locale } from "@/lib/i18n/config";

export type VerificationEmailContent = {
  subject: string;
  text: string;
  html: string;
};

type VerificationCopy = {
  subject: string;
  greeting: string;
  intro: string;
  button: string;
  fallback: string;
  ignore: string;
  footer: string;
};

const copyByLocale: Record<Locale, VerificationCopy> = {
  tr: {
    subject: "Tripetica — E-posta adresinizi doğrulayın",
    greeting: "Merhaba,",
    intro:
      "Tripetica hesabınızı etkinleştirmek için e-posta adresinizi doğrulayın.",
    button: "E-posta adresimi doğrula",
    fallback: "Buton çalışmazsa bu bağlantıyı tarayıcınıza yapıştırın:",
    ignore:
      "Bu hesabı siz oluşturmadıysanız bu e-postayı dikkate almayın. Hesabınızda herhangi bir değişiklik yapılmaz.",
    footer: "Tripetica",
  },
  en: {
    subject: "Tripetica — Verify your email address",
    greeting: "Hello,",
    intro: "Please verify your email address to activate your Tripetica account.",
    button: "Verify my email",
    fallback: "If the button does not work, paste this link into your browser:",
    ignore:
      "If you did not create this account, you can ignore this email. No changes will be made to your account.",
    footer: "Tripetica",
  },
  ru: {
    subject: "Tripetica — Подтвердите адрес электронной почты",
    greeting: "Здравствуйте,",
    intro:
      "Подтвердите адрес электронной почты, чтобы активировать аккаунт Tripetica.",
    button: "Подтвердить email",
    fallback: "Если кнопка не работает, вставьте эту ссылку в браузер:",
    ignore:
      "Если вы не создавали этот аккаунт, просто проигнорируйте это письмо. Никаких изменений не будет.",
    footer: "Tripetica",
  },
};

function escapeHtml(value: string) {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

export function buildVerificationEmail(
  locale: Locale,
  verifyUrl: string,
): VerificationEmailContent {
  const copy = copyByLocale[locale];
  const safeUrl = escapeHtml(verifyUrl);

  const text = [
    copy.greeting,
    "",
    copy.intro,
    "",
    `${copy.button}:`,
    verifyUrl,
    "",
    copy.ignore,
    "",
    copy.footer,
  ].join("\n");

  const html = `<!DOCTYPE html>
<html lang="${locale}">
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1" />
  <title>${escapeHtml(copy.subject)}</title>
</head>
<body style="margin:0;padding:0;background:#f4f5f7;font-family:Arial,Helvetica,sans-serif;color:#1a1a1a;">
  <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="background:#f4f5f7;padding:32px 12px;">
    <tr>
      <td align="center">
        <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="max-width:560px;background:#ffffff;border-radius:12px;padding:32px 28px;">
          <tr>
            <td style="font-size:22px;font-weight:700;letter-spacing:0.02em;padding-bottom:20px;">
              Tripetica
            </td>
          </tr>
          <tr>
            <td style="font-size:16px;line-height:1.55;padding-bottom:12px;">
              ${escapeHtml(copy.greeting)}
            </td>
          </tr>
          <tr>
            <td style="font-size:16px;line-height:1.55;padding-bottom:24px;">
              ${escapeHtml(copy.intro)}
            </td>
          </tr>
          <tr>
            <td align="center" style="padding-bottom:24px;">
              <a href="${safeUrl}" style="display:inline-block;background:#0f3d2e;color:#ffffff;text-decoration:none;font-size:16px;font-weight:600;padding:14px 22px;border-radius:8px;">
                ${escapeHtml(copy.button)}
              </a>
            </td>
          </tr>
          <tr>
            <td style="font-size:13px;line-height:1.5;color:#555555;padding-bottom:8px;">
              ${escapeHtml(copy.fallback)}
            </td>
          </tr>
          <tr>
            <td style="font-size:13px;line-height:1.5;word-break:break-all;padding-bottom:24px;">
              <a href="${safeUrl}" style="color:#0f3d2e;">${safeUrl}</a>
            </td>
          </tr>
          <tr>
            <td style="font-size:13px;line-height:1.5;color:#666666;padding-bottom:20px;border-top:1px solid #ececec;padding-top:20px;">
              ${escapeHtml(copy.ignore)}
            </td>
          </tr>
          <tr>
            <td style="font-size:13px;color:#888888;">
              ${escapeHtml(copy.footer)}
            </td>
          </tr>
        </table>
      </td>
    </tr>
  </table>
</body>
</html>`;

  return {
    subject: copy.subject,
    text,
    html,
  };
}
