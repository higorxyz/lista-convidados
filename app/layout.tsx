import type { Metadata } from "next";
import { Fraunces, Karla, IBM_Plex_Mono } from "next/font/google";
import "./globals.css";

const fraunces = Fraunces({
  subsets: ["latin"],
  weight: ["300", "500", "600"],
  style: ["normal", "italic"],
  variable: "--font-display"
});

const karla = Karla({
  subsets: ["latin"],
  weight: ["400", "500", "600", "700"],
  variable: "--font-body"
});

const plexMono = IBM_Plex_Mono({
  subsets: ["latin"],
  weight: ["400", "500"],
  variable: "--font-mono"
});

export const metadata: Metadata = {
  title: "Marcia & Matheus — Confirmação de Presença",
  description: "Confirme a presença do seu convite para o casamento de Marcia e Matheus."
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="pt-BR" className={`${fraunces.variable} ${karla.variable} ${plexMono.variable}`}>
      <body style={{ fontFamily: "var(--font-body), sans-serif" }}>{children}</body>
    </html>
  );
}
