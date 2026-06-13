import type { Metadata, Viewport } from "next";
import { Press_Start_2P } from "next/font/google";
import "./globals.css";

const pressStart = Press_Start_2P({
  weight: "400",
  subsets: ["latin"],
  variable: "--font-press-start",
});

export const metadata: Metadata = {
  title: "Cepeda Bros",
  description:
    "Plataformero retro estilo Mario Bros: corre, salta y esquiva obstáculos con Iván Cepeda hasta llegar a la Casa de Nariño.",
  manifest: "/manifest.json",
  appleWebApp: {
    capable: true,
    title: "Cepeda Bros",
    statusBarStyle: "black-translucent",
  },
  other: {
    "mobile-web-app-capable": "yes",
  },
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  maximumScale: 1,
  userScalable: false,
  themeColor: "#5c94fc",
  viewportFit: "cover",
};

export default function RootLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="es">
      <body className={pressStart.variable}>{children}</body>
    </html>
  );
}
