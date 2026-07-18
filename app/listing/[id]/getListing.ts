// Server-only Admin SDK fetch by listing id.
//
// lib/listings.ts's fetchListingById uses the CLIENT Firebase SDK
// (getDoc against lib/firebase.ts's `db`), which needs browser context and
// can't run in a Server Component. No server-side single-doc read action
// exists in api/listings/_handler.js either — the original SPA never
// needed one, since a listing was always already in memory from the feed
// before mpOpenModal ran. This is genuinely new: a direct-by-id server
// read for the /listing/[id] route's generateMetadata + initial render.
//
// Deliberately colocated with the page rather than added to
// api/listings/_handler.js's action surface — that file is a byte-for-byte
// port of the original api/listings.js and this isn't part of that port.

// Note: the `server-only` npm package would normally guard this file at
// build time, but it isn't in package.json and this sandbox has no network
// access to verify `npm install` succeeds — see adminDb.ts's header comment.
// Relying instead on the fact that this is only ever imported from
// Server Components (page.tsx below, sitemap.ts).
import { cache } from "react";
import { getAdminDb } from "@/lib/server/adminDb";
import type { Listing } from "@/lib/listings";
import { idFromListingSlug } from "@/lib/slug";

// Admin SDK Firestore Timestamps are class instances (Timestamp.prototype),
// not plain objects — Next.js refuses to pass those from a Server
// Component to a Client Component ("Only plain objects... can be passed").
// This walks the listing data and converts any Timestamp-shaped value
// (has both .toDate and .toMillis) to a plain ISO string, recursively,
// so no matter which field holds one (createdAt, updatedAt, or any future
// timestamp field added to a listing doc) it's always safe to serialize.
// Arrays and nested objects (financials, tech, settings, etc.) are walked
// too since a Timestamp could in principle live inside any of them.
function serializeTimestamps<T>(value: T): T {
  if (value === null || value === undefined) return value;
  if (
    typeof value === "object" &&
    typeof (value as any).toDate === "function" &&
    typeof (value as any).toMillis === "function"
  ) {
    return (value as any).toDate().toISOString() as unknown as T;
  }
  if (Array.isArray(value)) {
    return value.map((v) => serializeTimestamps(v)) as unknown as T;
  }
  if (typeof value === "object") {
    const out: Record<string, unknown> = {};
    for (const [k, v] of Object.entries(value as Record<string, unknown>)) {
      out[k] = serializeTimestamps(v);
    }
    return out as T;
  }
  return value;
}

// `segment` is the raw /listing/[id] route param — either the new
// "title-slug-{id}" format or a legacy bare id. idFromListingSlug pulls
// the real Firestore id out of either shape; the slug prefix itself is
// never trusted for the lookup (see lib/slug.ts's header comment), only
// used to make the URL readable.
export const getListingById = cache(async function getListingById(segment: string): Promise<Listing | null> {
  if (!segment) return null;
  const id = idFromListingSlug(segment);
  if (!id) return null;
  const db = getAdminDb();
  const snap = await db.collection("listings").doc(id).get();
  if (!snap.exists) return null;
  const data = serializeTimestamps(snap.data()) as Omit<Listing, "id">;
  return { id: snap.id, ...data };
});
