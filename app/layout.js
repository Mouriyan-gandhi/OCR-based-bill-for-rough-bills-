import { Outfit, JetBrains_Mono } from "next/font/google";
import "./globals.css";

const outfit = Outfit({
  subsets: ["latin"],
  variable: "--font-outfit",
  display: "swap",
});

const jetbrainsMono = JetBrains_Mono({
  subsets: ["latin"],
  variable: "--font-mono",
  display: "swap",
});

export const metadata = {
  title: "InvoiceAI — Intelligent Document Processing",
  description:
    "Transform bills, receipts & handwritten invoices into structured data and professional PDFs using AI-powered OCR.",
  keywords: ["invoice", "OCR", "AI", "billing", "receipt", "PDF"],
};

export default function RootLayout({ children }) {
  return (
    <html lang="en" className={`${outfit.variable} ${jetbrainsMono.variable}`}>
      <body>{children}</body>
    </html>
  );
}
