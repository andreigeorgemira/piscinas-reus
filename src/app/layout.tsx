import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import "./globals.css";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  // Every page sets its own title; the template is what turns "Tarifario"
  // into a browser tab a staff member with six tabs open can tell apart.
  title: {
    default: "Piscinas Reus",
    template: "%s · Piscinas Reus",
  },
  description:
    "Construcción y mantenimiento de piscinas en Reus y el Baix Camp.",
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html
      lang="es"
      className={`${geistSans.variable} ${geistMono.variable} h-full antialiased`}
    >
      <body className="min-h-full flex flex-col font-sans">{children}</body>
    </html>
  );
}
