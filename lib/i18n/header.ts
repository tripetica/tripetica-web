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
    primaryNav: string;
    mobileNav: string;
    home: string;
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
    primaryNav: "Primary",
    mobileNav: "Mobile",
    home: "Главная",
  },
  en: {
    services: "Our Services",
    contact: "Contact",
    language: "Language",
    account: "Account",
    signIn: "Sign in",
    openMenu: "Open menu",
    closeMenu: "Close menu",
    primaryNav: "Primary",
    mobileNav: "Mobile",
    home: "Home",
  },
  tr: {
    services: "Hizmetlerimiz",
    contact: "İletişim",
    language: "Dil",
    account: "Hesap",
    signIn: "Giriş yap",
    openMenu: "Menüyü aç",
    closeMenu: "Menüyü kapat",
    primaryNav: "Ana menü",
    mobileNav: "Mobil",
    home: "Ana Sayfa",
  },
};
