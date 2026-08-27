export const headerControlClassName =
  "header-foreground cursor-pointer rounded-full transition-colors duration-200 ease-out hover:bg-white/10 hover:text-white focus-visible:bg-white/10 focus-visible:text-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white/35";

export function bindHeaderPressFeedback(element: HTMLElement, pressed: boolean) {
  if (pressed) {
    element.setAttribute("data-pressed", "true");
  } else {
    element.removeAttribute("data-pressed");
  }
}
