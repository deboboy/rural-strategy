import type { Metadata } from "next";
import { Analytics } from "@vercel/analytics/react";
import "./globals.css";

export const metadata: Metadata = {
  title: "Rural Healthcare Transformation — National Scope",
  description:
    "National research applying the Mi Salud rural care-coordination model across the USA: closed-loop referrals, multimodal intake, and BYOD remote monitoring.",
};

export default function RootLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="en">
      <body>
        {children}
        <Analytics />
      </body>
    </html>
  );
}
