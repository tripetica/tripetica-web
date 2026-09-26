import { asPanelLocale, type Locale } from "@/lib/i18n/config";

const COPY = {
  tr: {
    registerSubject: "Tripetica Partner e-posta doğrulama kodu",
    registerText: (code: string) =>
      `Tripetica Partner başvurusu için doğrulama kodunuz: ${code}\n\nKod 10 dakika geçerlidir. Bu işlemi siz başlatmadıysanız bu e-postayı yok sayın.`,
    changeSubject: "Tripetica Partner yeni e-posta doğrulama kodu",
    changeText: (code: string) =>
      `Tripetica Partner hesabınız için yeni e-posta doğrulama kodunuz: ${code}\n\nKod 10 dakika geçerlidir. Bu işlemi siz başlatmadıysanız destek ekibimizle iletişime geçin.`,
    changedSubject: "Tripetica Partner e-posta adresiniz değiştirildi",
    changedText:
      "Tripetica Partner hesabınızın e-posta adresi değiştirildi. Bu işlemi siz yapmadıysanız destek ekibimizle iletişime geçin.",
    passwordChangedSubject: "Tripetica Partner şifreniz değiştirildi",
    passwordChangedText:
      "Tripetica Partner hesabınızın şifresi değiştirildi. Bu işlemi siz yapmadıysanız destek ekibimizle iletişime geçin.",
    resetSubject: "Tripetica Partner Portal şifre sıfırlama kodu",
    resetText: (code: string) =>
      `Tripetica Partner Portal şifre sıfırlama kodunuz: ${code}\n\nBu kod yalnızca Partner Portal şifre sıfırlama içindir ve 10 dakika geçerlidir.\n\nBu işlemi siz başlatmadıysanız bu e-postayı dikkate almayın.`,
  },
  en: {
    registerSubject: "Tripetica Partner email verification code",
    registerText: (code: string) =>
      `Your verification code for the Tripetica Partner application is: ${code}\n\nThe code is valid for 10 minutes. If you did not start this, ignore this email.`,
    changeSubject: "Tripetica Partner new email verification code",
    changeText: (code: string) =>
      `Your verification code for the new Tripetica Partner email is: ${code}\n\nThe code is valid for 10 minutes. If you did not start this, contact support.`,
    changedSubject: "Your Tripetica Partner email address was changed",
    changedText:
      "The email address on your Tripetica Partner account was changed. If you did not do this, contact our support team.",
    passwordChangedSubject: "Your Tripetica Partner password was changed",
    passwordChangedText:
      "The password on your Tripetica Partner account was changed. If you did not do this, contact our support team.",
    resetSubject: "Tripetica Partner Portal password reset code",
    resetText: (code: string) =>
      `Your Tripetica Partner Portal password reset code is: ${code}\n\nThis code is only for Partner Portal password reset and is valid for 10 minutes.\n\nIf you did not request this, you can ignore this email.`,
  },
  ru: {
    registerSubject: "Код подтверждения email партнёра Tripetica",
    registerText: (code: string) =>
      `Код подтверждения заявки партнёра Tripetica: ${code}\n\nКод действует 10 минут. Если вы не начинали это действие, проигнорируйте письмо.`,
    changeSubject: "Код подтверждения нового email партнёра Tripetica",
    changeText: (code: string) =>
      `Код подтверждения нового адреса партнёра Tripetica: ${code}\n\nКод действует 10 минут. Если вы не начинали это действие, свяжитесь с поддержкой.`,
    changedSubject: "Адрес электронной почты партнёра Tripetica изменён",
    changedText:
      "Адрес электронной почты вашего аккаунта партнёра Tripetica был изменён. Если это сделали не вы, свяжитесь с нашей службой поддержки.",
    passwordChangedSubject: "Пароль партнёра Tripetica изменён",
    passwordChangedText:
      "Пароль вашего аккаунта партнёра Tripetica был изменён. Если это сделали не вы, свяжитесь с нашей службой поддержки.",
    resetSubject: "Код сброса пароля Tripetica Partner Portal",
    resetText: (code: string) =>
      `Ваш код сброса пароля Tripetica Partner Portal: ${code}\n\nЭтот код предназначен только для сброса пароля Partner Portal и действует 10 минут.\n\nЕсли вы не запрашивали это действие, проигнорируйте письмо.`,
  },
} as const;

export function buildPartnerRegisterCodeEmail(locale: Locale, code: string) {
  const copy = COPY[asPanelLocale(locale)];
  return {
    subject: copy.registerSubject,
    text: copy.registerText(code),
  };
}

export function buildPartnerEmailChangeCodeEmail(locale: Locale, code: string) {
  const copy = COPY[asPanelLocale(locale)];
  return {
    subject: copy.changeSubject,
    text: copy.changeText(code),
  };
}

export function buildPartnerEmailChangedNotice(locale: Locale) {
  const copy = COPY[asPanelLocale(locale)];
  return {
    subject: copy.changedSubject,
    text: copy.changedText,
  };
}

export function buildPartnerPasswordChangedNotice(locale: Locale) {
  const copy = COPY[asPanelLocale(locale)];
  return {
    subject: copy.passwordChangedSubject,
    text: copy.passwordChangedText,
  };
}

export function buildPartnerPasswordResetCodeEmail(locale: Locale, code: string) {
  const copy = COPY[asPanelLocale(locale)];
  return {
    subject: copy.resetSubject,
    text: copy.resetText(code),
  };
}
