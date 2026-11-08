import type { Metadata, Viewport } from "next";
import { Inter, Noto_Sans_Devanagari } from "next/font/google";
import { RegisterSW } from "@/components/register-sw";
import "./globals.css";

const inter = Inter({ variable: "--font-inter", subsets: ["latin"], display: "swap" });
const devanagari = Noto_Sans_Devanagari({
  variable: "--font-devanagari",
  subsets: ["devanagari"],
  display: "swap",
});

export const metadata: Metadata = {
  appleWebApp: { capable: true, title: "Society", statusBarStyle: "black-translucent" },
  icons: { apple: "/icons/apple-touch-icon.png" },
  title: { default: "Society", template: "%s · Society" },
  description: "Maintenance, complaints and payments for a gated township, in one app.",
};

export const viewport: Viewport = {
  themeColor: "#090a0a",
  width: "device-width",
  initialScale: 1,
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html lang="en" className={`${inter.variable} ${devanagari.variable} h-full`}>
      <body className="min-h-full flex flex-col bg-surface text-fg">{children}
        <RegisterSW />
      </body>
    </html>
  );
}
