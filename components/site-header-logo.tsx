"use client";

import {
  bindHeaderPressFeedback,
  headerControlClassName,
} from "@/lib/ui/header";

type SiteHeaderLogoLinkProps = {
  href: string;
  className: string;
  children: string;
};

export function SiteHeaderLogoLink({
  href,
  className,
  children,
}: SiteHeaderLogoLinkProps) {
  return (
    <a
      href={href}
      className={`${className} ${headerControlClassName} liquid-lens touch-manipulation`}
      onPointerDown={(event) => bindHeaderPressFeedback(event.currentTarget, true)}
      onPointerUp={(event) => bindHeaderPressFeedback(event.currentTarget, false)}
      onPointerCancel={(event) => bindHeaderPressFeedback(event.currentTarget, false)}
      onPointerLeave={(event) => bindHeaderPressFeedback(event.currentTarget, false)}
    >
      {children}
    </a>
  );
}
