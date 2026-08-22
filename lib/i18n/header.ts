import { type Locale } from "./config";

export const headerCopy: Record<
  Locale,
  {
    services: string;
    contact: string;
    language: string;
    account: string;
    signIn: string;
    openMenu: string;
    closeMenu: string;
  }
> = {
  ru: {
    services: "Наши услуги",
    contact: "Контакты",
    language: "Язык",
    account: "Аккаунт",
    signIn: "Войти",
    openMenu: "Открыть меню",
    closeMenu: "Закрыть меню",
  },
  en: {
    services: "Our Services",
    contact: "Contact",
    language: "Language",
    account: "Account",
    signIn: "Sign in",
    openMenu: "Open menu",
    closeMenu: "Close menu",
  },
};
