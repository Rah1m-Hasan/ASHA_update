import type { Metadata } from "next";
import { LinkCatcher } from "@/features/session/LinkCatcher";

export const metadata: Metadata = { title: "Asha dashboard", manifest: "/app.webmanifest" };

export default function DashboardLayout({ children }: { children: React.ReactNode }) {
  return (
    <>
      <LinkCatcher />
      {children}
    </>
  );
}
