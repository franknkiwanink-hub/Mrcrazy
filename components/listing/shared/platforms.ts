// Shared platform metadata for App and Game listing forms. A "platform"
// here means anywhere the product is actually distributed — including a
// game that also ships as a Play Store / App Store app rather than only
// running in a browser, which the old game form didn't support (it only
// had a single Android/Desktop/Both dropdown with no store link or
// installs/MAU capture at all).
//
// Store-distributed platforms (ios/android) require Installs + Monthly
// Active Users when the listing is marked Live on that platform — those
// numbers are how a buyer sanity-checks a store listing's traction.
// Non-store platforms (web/steam/desktop) don't get that requirement since
// there's no single install-count source of truth for them.

export type PlatformKey = "ios" | "android" | "web" | "steam" | "desktop";

export interface PlatformMeta {
  key: PlatformKey;
  label: string;
  isStore: boolean; // store-distributed → installs/MAU apply when live
  urlLabel: string;
  urlPlaceholder: string;
  buildUrlLabel: string;
  buildUrlPlaceholder: string;
}

export const PLATFORM_META: Record<PlatformKey, PlatformMeta> = {
  ios: {
    key: "ios",
    label: "iOS (App Store)",
    isStore: true,
    urlLabel: "App Store URL",
    urlPlaceholder: "https://apps.apple.com/...",
    buildUrlLabel: "Link to your .ipa (any host)",
    buildUrlPlaceholder: "https://drive.google.com/... or any direct link",
  },
  android: {
    key: "android",
    label: "Android (Play Store)",
    isStore: true,
    urlLabel: "Play Store URL",
    urlPlaceholder: "https://play.google.com/...",
    buildUrlLabel: "Link to your .apk/.aab (any host)",
    buildUrlPlaceholder: "https://drive.google.com/... or any direct link",
  },
  web: {
    key: "web",
    label: "Web",
    isStore: false,
    urlLabel: "Site URL",
    urlPlaceholder: "https://example.com",
    buildUrlLabel: "",
    buildUrlPlaceholder: "",
  },
  steam: {
    key: "steam",
    label: "Steam",
    isStore: false,
    urlLabel: "Steam Store URL",
    urlPlaceholder: "https://store.steampowered.com/app/...",
    buildUrlLabel: "Link to your build (any host)",
    buildUrlPlaceholder: "https://drive.google.com/... or any direct link",
  },
  desktop: {
    key: "desktop",
    label: "Desktop (direct download)",
    isStore: false,
    urlLabel: "Download page URL (optional)",
    urlPlaceholder: "https://example.com/download",
    buildUrlLabel: "Link to your build (any host)",
    buildUrlPlaceholder: "https://drive.google.com/... or any direct link",
  },
};

export interface PlatformStats {
  installs?: string;
  mau?: string;
}
