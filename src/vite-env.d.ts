/// <reference types="vite/client" />

interface ImportMetaEnv {
  readonly VITE_REVENUECAT_ANDROID_API_KEY?: string;
  readonly VITE_REVENUECAT_ENTITLEMENT_ID?: string;
}

interface ImportMeta {
  readonly env: ImportMetaEnv;
}
