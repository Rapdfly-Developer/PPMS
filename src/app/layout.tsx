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
      <body className="min-h-full flex flex-col overflow-x-hidden">
        {/* The launch splash is server-rendered so the app shows it on first
            paint. Capacitor's bridge exists before any page script, so a plain
            browser can hide it here, before paint, instead of flashing it until
            hydration removes it. The script sits in raw HTML (not a React
            <script> element) so the browser still runs it while parsing, ahead
            of the splash markup, without React's dev "script tag" warning.
            In the app, the marketing landing page ("/") is skipped and the
            launch goes straight to /login; browsers still get the landing. */}
        <div
          hidden
          dangerouslySetInnerHTML={{
            __html: `<script>if(!(window.Capacitor&&window.Capacitor.isNativePlatform&&window.Capacitor.isNativePlatform())){var s=document.createElement("style");s.textContent=".rf-splash{display:none!important}";document.head.appendChild(s)}else{var n=document.createElement("style");n.textContent=".rf-native-hide{display:none!important}";document.head.appendChild(n);if(location.pathname==="/"){location.replace("/login")}}</script>`,
          }}
        />
        <SplashOverlay />
        <Providers>{children}</Providers>
      </body>
    </html>
  );
}
