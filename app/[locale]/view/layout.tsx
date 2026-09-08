import type { Metadata, Viewport } from "next";
import type { ReactNode } from "react";
import { noindexFollowRobots } from "@/lib/seo/metadata";
import { lightBrowserThemeColor } from "@/lib/theme";

export const viewport: Viewport = {
  themeColor: lightBrowserThemeColor,
  colorScheme: "only light",
};

export const metadata: Metadata = {
  robots: noindexFollowRobots,
};

export default function ReviewViewLayout({ children }: { children: ReactNode }) {
  return children;
}
