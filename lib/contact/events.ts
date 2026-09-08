export const CONTACT_LAUNCHER_OPEN_EVENT = "tripetica:contact-open";

export function openContactLauncher() {
  window.dispatchEvent(new CustomEvent(CONTACT_LAUNCHER_OPEN_EVENT));
}
