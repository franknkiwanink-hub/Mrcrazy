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
import { getAdminDb } from "@/lib/server/adminDb";
import type { Listing } from "@/lib/listings";

export async function getListingById(id: string): Promise<Listing | null> {
  if (!id) return null;
  const db = getAdminDb();
  const snap = await db.collection("listings").doc(id).get();
  if (!snap.exists) return null;
  return { id: snap.id, ...(snap.data() as Omit<Listing, "id">) };
}
