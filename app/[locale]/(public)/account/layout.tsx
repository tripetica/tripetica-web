import type { Metadata } from "next";
import type { ReactNode } from "react";
import { noindexFollowRobots } from "@/lib/seo/metadata";

export const metadata: Metadata = {
  robots: noindexFollowRobots,
};

export default function AccountLayout({ children }: { children: ReactNode }) {
  return children;
}
