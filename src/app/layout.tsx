import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import "./globals.css";
import { ThemeScript } from "./theme";

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
      // ThemeScript stamps data-theme here before React hydrates, so the
      // server HTML and the client DOM differ by that one attribute on
      // purpose. This is the case the escape hatch is for; it covers this
      // element's attributes only, not the tree below it.
      suppressHydrationWarning
      className={`${geistSans.variable} ${geistMono.variable} h-full antialiased`}
    >
      <body className="min-h-full flex flex-col font-sans text-sm">
        <ThemeScript />
        {children}
      </body>
    </html>
  );
}
