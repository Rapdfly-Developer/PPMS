import type { CapacitorConfig } from "@capacitor/cli";

const config: CapacitorConfig = {
  appId: "com.ppmsai.app",
  appName: "PPMS-AI",
  // Points to the live server — no static export needed since the app uses
  // server components, API routes, and server actions.
  server: {
    url: "https://ppmsai.com",
    cleartext: false,
    // Cashfree's auto-pay approval page is on another host. Without this the app
    // hands it to the phone browser, which loses the session id and shows
    // "subs_session_id is not present or is invalid".
    allowNavigation: ["*.cashfree.com", "cashfree.com", "*.cashfree.net", "*.cardinalcommerce.com", "*.modirum.com"],
  },
  android: {
    buildOptions: {
      releaseType: "APK",
    },
    backgroundColor: "#FFFFFF",
    allowMixedContent: false,
  },
  plugins: {
    SplashScreen: {
      launchShowDuration: 0,
      launchAutoHide: false,
      backgroundColor: "#FFFFFF",
      androidSplashResourceName: "splash",
      androidScaleType: "CENTER_CROP",
      showSpinner: false,
    },
    StatusBar: {
      style: "DARK",
      backgroundColor: "#041A18",
    },
  },
};

export default config;
