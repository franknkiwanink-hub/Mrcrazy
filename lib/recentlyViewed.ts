"use client";

// Recently-viewed listings — purely client-side (localStorage), no
// Firestore reads/writes, no auth requirement. Records a lightweight
// snapshot of exactly the fields ListingCard's three variants (Site/App/
// Game) actually render — same subset SaveButton already snapshots for
// its own favorites doc — rather than a full Listing, so re-rendering a
// recently-viewed card never needs a second network fetch just to draw
// the strip.
//
// Deliberately NOT synced to Firestore / cross-device: this is meant to
// be an instant, always-available "what did I just look at" trail, not
// a durable feature — same tradeoff a browser's own history makes.
import type { Listing, ListingType } from "@/lib/listings";

const STORAGE_KEY = "srf_recently_viewed";
const MAX_ENTRIES = 16;

export interface RecentlyViewedEntry {
  id: string;
  title: string;
  type: ListingType;
  image: string;
  price: number | null;
  viewedAt: number;
}

function readAll(): RecentlyViewedEntry[] {
  if (typeof window === "undefined") return [];
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

function writeAll(entries: RecentlyViewedEntry[]) {
  try {
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(entries.slice(0, MAX_ENTRIES)));
  } catch {
    // Storage can fail (quota, private-browsing restrictions) — this is
    // a non-critical enhancement, so fail silently rather than throw.
  }
}

// Records a view — called from ListingViewBeacon alongside the existing
// trackListing("listing.view", ...) analytics beacon. Moves the listing
// to the front if already present (most-recently-viewed first) instead
// of duplicating it.
export function recordRecentlyViewed(listing: Listing) {
  if (typeof window === "undefined" || !listing.id) return;
  const snapshot: RecentlyViewedEntry = {
    id: listing.id,
    title: listing.title || "Untitled",
    type: listing.type || "website",
    image: listing.images?.[2] || listing.imageCover || listing.images?.[0] || listing.appIcon || "",
    price: typeof listing.financials?.price === "number" ? listing.financials.price : null,
    viewedAt: Date.now(),
  };
  const existing = readAll().filter((e) => e.id !== listing.id);
  writeAll([snapshot, ...existing]);
}

export function getRecentlyViewed(excludeId?: string): RecentlyViewedEntry[] {
  const all = readAll();
  return excludeId ? all.filter((e) => e.id !== excludeId) : all;
}

export function clearRecentlyViewed() {
  try {
    window.localStorage.removeItem(STORAGE_KEY);
  } catch {
    /* ignore */
  }
}

// Reconstructs a minimal Listing-shaped object from a stored snapshot —
// enough for ListingCard's Site/App/Game variants to render correctly
// (title, image, price), same posture as SaveButton's favorites-tab
// comment about rendering "a full card instantly without an extra
// per-item listing fetch".
export function entryToListing(entry: RecentlyViewedEntry): Listing {
  return {
    id: entry.id,
    type: entry.type,
    title: entry.title,
    images: entry.image ? [entry.image, entry.image, entry.image] : [],
    financials: entry.price !== null ? { price: entry.price } : {},
  };
}
