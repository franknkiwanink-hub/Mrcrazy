// Server-only Admin SDK fetch of a seller's SEO-relevant profile fields.
//
// Deliberately NOT a server port of lib/useSeller.ts's fetchFullSeller —
// that pulls the seller's full listings array, follower count, and a
// second network call for deal stats, all client-side data the page body
// still fetches itself on mount (see page.tsx below). This helper only
// reads what generateMetadata needs: username/bio/rating/plan/visibility
// and a cheap listing count. Keeping it separate avoids duplicating a
// heavier Admin-SDK version of fetchFullSeller that would drift from the
// client one over time.
//
// PRIVACY: profileVisibility gates what generateMetadata is allowed to
// expose to crawlers/link-preview bots, mirroring the same gate the
// client page already enforces for human visitors (see page.tsx's
// "private"/"members" branches). A private profile must never leak its
// real bio, stats, or listing count into a <meta> tag just because a
// crawler doesn't go through the client visibility check.

import { cache } from "react";
import { getAdminDb } from "@/lib/server/adminDb";

export interface SellerSeoProfile {
  uid: string;
  username: string;
  bio: string;
  profilePic: string;
  rating: number;
  ratingCount: number;
  plan: string;
  profileVisibility: string;
  showBio: boolean;
  activeListingCount: number;
  followerCount: number;
  joinedAt: Date | null;
}

// `segment` is the raw /seller/[id] route param. It's resolved as:
//   1. A direct doc-id (uid) lookup first — cheap, and keeps every old
//      /seller/{uid} link issued before usernames became the canonical
//      route shape working forever with no redirect table to maintain.
//   2. If that misses, treated as a username and resolved via the same
//      usernameLower uniqueness index the signup flow already
//      maintains (see app/api/account/_handler.js's resolveUniqueUsername),
//      so the common case — someone visiting the canonical
//      /seller/{username} URL — costs one indexed query.
// Firestore auto-ids and usernames can never collide in practice (ids are
// long random base62 strings; usernames are capped short human text), so
// there's no ambiguity between the two lookup paths.
export const getSellerSeoProfile = cache(async function getSellerSeoProfile(
  segment: string
): Promise<SellerSeoProfile | null> {
  if (!segment) return null;
  const db = getAdminDb();

  let snap = await db.collection("users").doc(segment).get();
  if (!snap.exists) {
    const lower = segment.toLowerCase();
    const q = await db.collection("users").where("usernameLower", "==", lower).limit(1).get();
    if (q.empty) return null;
    snap = q.docs[0];
  }
  const uid = snap.id;
  const d = snap.data() || {};

  // Cheap count-only query — mirrors the `active` status filter used
  // everywhere else (listings/_handler.js's feed query, useSeller.ts's
  // fetchFullSeller) — never fetches the actual listing docs, since
  // metadata only needs a number, not the listings themselves.
  let activeListingCount = 0;
  try {
    const countSnap = await db
      .collection("listings")
      .where("ownerId", "==", uid)
      .where("status", "==", "active")
      .count()
      .get();
    activeListingCount = countSnap.data().count;
  } catch (err) {
    console.error("[getSellerSeoProfile] listing count failed for", uid, err);
  }

  // Same `users/{uid}/followers` subcollection the client-side hook reads
  // (lib/useSeller.ts's fetchFullSeller), but via the Admin SDK's count()
  // aggregation rather than fetching every follower doc — metadata only
  // needs a number.
  let followerCount = 0;
  try {
    const followerSnap = await db.collection("users").doc(uid).collection("followers").count().get();
    followerCount = followerSnap.data().count;
  } catch (err) {
    console.error("[getSellerSeoProfile] follower count failed for", uid, err);
  }

  // Same defensive Timestamp-or-plain-value handling fetchFullSeller uses
  // for createdAt (Admin SDK Timestamps carry .toDate(); older/migrated
  // docs may have a plain value instead).
  const joinedAt: Date | null = d.createdAt
    ? d.createdAt.toDate
      ? d.createdAt.toDate()
      : new Date(d.createdAt)
    : null;

  return {
    uid,
    username: d.username || d.displayName || d.email?.split("@")[0] || "Anonymous",
    bio: d.bio || "",
    profilePic: d.profilePic || "",
    rating: typeof d.rating === "number" ? d.rating : 0,
    ratingCount: typeof d.ratingCount === "number" ? d.ratingCount : 0,
    plan: d.plan || "free",
    profileVisibility: d.profileVisibility || "public",
    showBio: d.showBio !== false,
    activeListingCount,
    followerCount,
    joinedAt,
  };
});
