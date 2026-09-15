import type { CapacitorConfig } from "@capacitor/cli";

const config: CapacitorConfig = {
  appId: "com.ppmsai.app",
  appName: "PPMS-AI",
  // Points to the live server — no static export needed since the app uses
  // server components, API routes, and server actions.
  server: {
    url: "https://ppmsai.com",
    cleartext: false,
  },
  android: {
    buildOptions: {
      releaseType: "APK",
    },
    backgroundColor: "#041A18",
    allowMixedContent: false,
  },
  plugins: {
    SplashScreen: {
      launchShowDuration: 2000,
      launchAutoHide: true,
      backgroundColor: "#041A18",
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
