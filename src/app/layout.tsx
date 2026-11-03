import type { Metadata, Viewport } from "next";
import { Inter } from "next/font/google";
import "./globals.css";
import { Providers } from "./providers";
import { SplashOverlay } from "@/components/SplashOverlay";

// Self-hosted variable font — exposed as a CSS var so pages can opt in.
const inter = Inter({ subsets: ["latin"], variable: "--font-inter", display: "swap" });

export const metadata: Metadata = {
  title: "RF Health · Private Patient Management System",
  description: "Multi-hospital EMR & appointment platform for visiting ophthalmologists",
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  viewportFit: "cover",
  // Keep the soft keyboard out of the LAYOUT viewport: it resizes only the
  // visual viewport, so position:fixed boxes and every vh/svh/lvh unit stay
  // put when a field is focused. Without this, opening the keyboard drags the
  // login page's blurred background around and forces a full re-raster.
  interactiveWidget: "resizes-visual",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" className={`h-full antialiased ${inter.variable}`}>
      <head>
        {/* The launch splash is server-rendered so the app shows it on first
            paint. Capacitor's bridge exists before any page script, so a plain
            browser can hide it here, before paint, instead of flashing it until
            hydration removes it. */}
        <script
          dangerouslySetInnerHTML={{
            __html: `if(!(window.Capacitor&&window.Capacitor.isNativePlatform&&window.Capacitor.isNativePlatform())){var s=document.createElement("style");s.textContent=".rf-splash{display:none!important}";document.head.appendChild(s)}`,
          }}
        />
      </head>
      <body className="min-h-full flex flex-col overflow-x-hidden">
        <SplashOverlay />
        <Providers>{children}</Providers>
      </body>
    </html>
  );
}
