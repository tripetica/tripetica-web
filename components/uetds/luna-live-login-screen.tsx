"use client";

import { type Locale } from "@/lib/i18n/config";
import { AiEditLunaWorkspace } from "@/components/uetds/ai-edit-luna-workspace";

export function LunaLiveLoginScreen({
  locale,
  notificationId,
  authorityId,
  listHref,
}: {
  locale: Locale;
  notificationId: string;
  authorityId: string;
  listHref: string;
}) {
  return (
    <AiEditLunaWorkspace
      open
      locale={locale}
      notificationId={notificationId}
      authorityId={authorityId}
      onClose={() => {
        window.location.assign(listHref);
      }}
    />
  );
}
