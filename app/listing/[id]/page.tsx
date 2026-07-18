import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { getListingById } from "./getListing";
import { getPublicBaseUrl } from "@/lib/server/adminDb";
import { fmtPrice, type Listing } from "@/lib/listings";
import ListingViewBeacon from "./ListingViewBeacon";
import SimilarListingsStrip from "@/components/listing/SimilarListingsStrip";
import AppListingBody from "@/components/listing/AppListingBody";
import WebsiteListingBody from "@/components/listing/WebsiteListingBody";
import GameListingBody from "@/components/listing/GameListingBody";

// Only ACTIVE listings get real per-listing metadata / are servable at
// all here — mirrors the `status === 'active'` gate used everywhere else
// (feed query, isBoosted context, etc.). A sold/removed/pending listing
// was never publicly linked from the marketplace grid in the first
// place, so treating it as a 404 (rather than rendering stale data) is
// consistent with the rest of the app, not a new restriction.
function isPubliclyVisible(listing: Listing): boolean {
  return listing.status === "active";
}

// Short, crawler/link-preview-friendly description built from whatever
// fields the listing actually has — tagline first (author-written,
// usually the best summary), falling back to a truncated description,
// then a generic type+price line so metadata is never empty even for a
// bare-minimum listing doc.
function buildDescription(listing: Listing): string {
  if (listing.tagline) return listing.tagline;
  if (listing.description) {
    const trimmed = listing.description.trim();
    return trimmed.length > 160 ? trimmed.slice(0, 157) + "…" : trimmed;
  }
  const typeLabel = listing.type === "app" ? "App" : listing.type === "game" ? "Game" : "Website";
  return `${typeLabel} for sale on Siterifty — ${fmtPrice(listing.financials?.price)}.`;
}

export async function generateMetadata({
  params,
}: {
  params: Promise<{ id: string }>;
}): Promise<Metadata> {
  const { id } = await params;
  const listing = await getListingById(id);

  if (!listing || !isPubliclyVisible(listing)) {
    return {
      title: "Listing not found — Siterifty",
      description: "This listing may have been removed or the link is incorrect.",
    };
  }

  const title = `${listing.title || "Listing"} — Siterifty`;
  const description = buildDescription(listing);
  const baseUrl = getPublicBaseUrl();
  const url = `${baseUrl}/listing/${listing.id}`;

  // og:image / twitter:image are no longer set manually here — the
  // sibling opengraph-image.tsx route generates a branded, per-listing
  // card and Next.js auto-wires it for both og:image and the Twitter
  // card, so anything set here would just be dead weight that gets
  // overridden anyway.
  return {
    title,
    description,
    alternates: { canonical: url },
    openGraph: {
      title,
      description,
      url,
      type: "website",
    },
    twitter: {
      card: "summary_large_image",
      title,
      description,
    },
  };
}

export default async function ListingDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const listing = await getListingById(id);

  if (!listing || !isPubliclyVisible(listing)) {
    notFound();
  }

  const type = listing.type || "website";

  return (
    <>
      {/* Detail-view beacon — fires once per open, distinct from the
          card-impression counter. Mirrors _mpTrackListing('listing.view', ...)
          in mpOpenModal. Kept as a tiny client component since it's a
          fire-once-on-mount browser beacon, not something that belongs
          in a Server Component. */}
      <ListingViewBeacon listingId={listing.id} />

      {type === "app" && (
        <div style={{ marginTop: 92, maxWidth: 760, margin: "92px auto 0", padding: "0 0 80px" }}>
          <AppListingBody listing={listing} />
        </div>
      )}

      {type === "website" && (
        <div style={{ marginTop: 92, maxWidth: 760, margin: "92px auto 0", padding: "0 0 80px" }}>
          <WebsiteListingBody listing={listing} />
        </div>
      )}

      {type === "game" && (
        <div style={{ marginTop: 92, maxWidth: 760, margin: "92px auto 0", padding: "0 0 80px" }}>
          <GameListingBody listing={listing} />
        </div>
      )}

      {(type === "app" || type === "website" || type === "game") && (
        <SimilarListingsStrip listingId={listing.id} />
      )}

      {/* Every known listing type (website/app/game) now has a real body —
          this only catches an unexpected/corrupt `type` value on the doc. */}
      {type !== "app" && type !== "website" && type !== "game" && (
        <div style={{ marginTop: 92, padding: "40px 24px 80px", textAlign: "center", color: "#fff" }}>
          <h1>{listing.title || "Listing"}</h1>
          <p style={{ opacity: 0.7 }}>
            This listing has an unrecognized type (&ldquo;{type}&rdquo;) and can&apos;t be displayed.
          </p>
        </div>
      )}
    </>
  );
}
