import { type Locale } from "@/lib/i18n/config";

type ActionEmailKind = "password_reset" | "email_change";

const copy: Record<
  Locale,
  Record<ActionEmailKind, { subject: string; intro: string; action: string; ignore: string }>
> = {
  tr: {
    password_reset: {
      subject: "Tripetica — Şifrenizi sıfırlayın",
      intro: "Tripetica şifrenizi sıfırlamak için aşağıdaki bağlantıyı kullanın.",
      action: "Şifremi sıfırla",
      ignore: "Bu isteği siz yapmadıysanız bu e-postayı dikkate almayın.",
    },
    email_change: {
      subject: "Tripetica — Yeni e-posta adresinizi doğrulayın",
      intro: "Yeni Tripetica e-posta adresinizi doğrulamak için bağlantıyı kullanın.",
      action: "Yeni e-postamı doğrula",
      ignore: "Bu değişikliği siz istemediyseniz bu e-postayı dikkate almayın.",
    },
  },
  en: {
    password_reset: {
      subject: "Tripetica — Reset your password",
      intro: "Use the link below to reset your Tripetica password.",
      action: "Reset my password",
      ignore: "If you did not request this, you can ignore this email.",
    },
    email_change: {
      subject: "Tripetica — Confirm your new email",
      intro: "Use the link below to confirm your new Tripetica email address.",
      action: "Confirm my new email",
      ignore: "If you did not request this change, you can ignore this email.",
    },
  },
  ru: {
    password_reset: {
      subject: "Tripetica — Сброс пароля",
      intro: "Используйте ссылку ниже, чтобы сбросить пароль Tripetica.",
      action: "Сбросить пароль",
      ignore: "Если вы не отправляли этот запрос, проигнорируйте письмо.",
    },
    email_change: {
      subject: "Tripetica — Подтвердите новый email",
      intro: "Используйте ссылку ниже, чтобы подтвердить новый email Tripetica.",
      action: "Подтвердить новый email",
      ignore: "Если вы не запрашивали это изменение, проигнорируйте письмо.",
    },
  },
  ar: {
    password_reset: {
      subject: "Tripetica — إعادة تعيين كلمة المرور",
      intro: "استخدم الرابط أدناه لإعادة تعيين كلمة مرور حسابك في Tripetica.",
      action: "إعادة تعيين كلمة المرور",
      ignore: "إذا لم تطلب ذلك، يمكنك تجاهل هذه الرسالة.",
    },
    email_change: {
      subject: "Tripetica — أكّد بريدك الإلكتروني الجديد",
      intro: "استخدم الرابط أدناه لتأكيد بريدك الإلكتروني الجديد في Tripetica.",
      action: "تأكيد بريدي الإلكتروني الجديد",
      ignore: "إذا لم تطلب هذا التغيير، يمكنك تجاهل هذه الرسالة.",
    },
  },
};

function escapeHtml(value: string) {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

export function buildAccountActionEmail(
  locale: Locale,
  kind: ActionEmailKind,
  url: string,
) {
  const content = copy[locale][kind];
  const safeUrl = escapeHtml(url);
  return {
    subject: content.subject,
    text: `${content.intro}\n\n${content.action}:\n${url}\n\n${content.ignore}\n`,
    html: `<p>${escapeHtml(content.intro)}</p><p><a href="${safeUrl}">${escapeHtml(content.action)}</a></p><p>${escapeHtml(content.ignore)}</p>`,
  };
}
