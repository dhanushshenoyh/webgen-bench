import type { Metadata } from "next";
import { Bricolage_Grotesque, Instrument_Sans } from "next/font/google";
import "./globals.css";

const display = Bricolage_Grotesque({ variable: "--font-display", subsets: ["latin"], display: "swap" });
const text = Instrument_Sans({ variable: "--font-text", subsets: ["latin"], display: "swap" });

export const metadata: Metadata = {
  title: "webgen-bench",
  description: "One brief, every AI website builder, the same tests. Lighthouse, WCAG 2.2, the W3C validator and blind design judging.",
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html lang="en" className={`${display.variable} ${text.variable} h-full antialiased`}>
      <body className="min-h-full">{children}</body>
    </html>
  );
}
