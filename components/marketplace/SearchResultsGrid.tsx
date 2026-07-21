"use client";

// Renders the initial ?q= search results the SSR /marketplace page fetched
// server-side (via app/marketplace/searchListings.ts → handleSearch),
// reusing the same ListingCard every other listing grid in the app uses.
// This is intentionally a thin client wrapper and not a data-fetching
// component itself — navigation (onOpen/onOpenSeller) needs the router,
// which only works client-side, but the actual search call already
// happened server-side before this ever rendered. Typing a *new* query
// after the page has loaded is handled separately by SearchOverlay /
// MarketplaceFilterBar (client-side fetchSearchResults), not this
// component — this only ever renders the query the page was loaded with.
import { useRouter } from "next/navigation";
import type { Listing } from "@/lib/listings";
import ListingCard from "@/components/marketplace/ListingCard";
import { buildListingSlug } from "@/lib/slug";

export default function SearchResultsGrid({
  listings,
  query,
}: {
  listings: Listing[];
  query: string;
}) {
  const router = useRouter();
  const onOpen = (listing: Listing) => {
    if (listing?.id) router.push(`/listing/${buildListingSlug(listing.title, listing.id)}`);
  };
  const onOpenSeller = (ownerId: string | undefined, _listing?: Listing) => {
    if (ownerId) router.push(`/seller/${encodeURIComponent(ownerId)}`);
  };

  return (
    <div>
      <div className="mp-results" style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 12 }}>
        <span>
          {listings.length ? (
            <>
              <strong>{listings.length}</strong> result{listings.length === 1 ? "" : "s"} for &ldquo;{query}&rdquo;
            </>
          ) : (
            <>No results for &ldquo;{query}&rdquo;</>
          )}
        </span>
        <button
          type="button"
          onClick={() => {
            // A soft client-side push to the same /marketplace route
            // segment (even with the ?q= param dropped) doesn't reliably
            // re-run this page's server-side branch — Next treats it as
            // a navigation within the same segment, so it can appear to
            // just "refresh" back onto this same search-results view.
            // A full navigation guarantees we land on the real
            // no-query marketplace grid.
            window.location.assign("/marketplace");
          }}
          style={{
            display: "inline-flex",
            alignItems: "center",
            gap: 6,
            fontSize: 13,
            fontWeight: 600,
            color: "var(--mp-text-sec)",
            background: "var(--mp-surface)",
            border: "1px solid var(--mp-border)",
            borderRadius: 999,
            padding: "7px 14px",
            cursor: "pointer",
            whiteSpace: "nowrap",
          }}
        >
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2.4}>
            <path d="M15 18l-6-6 6-6" strokeLinecap="round" strokeLinejoin="round" />
          </svg>
          Back to marketplace
        </button>
      </div>

      <div className="mp-grid-wrap">
        <div className="mp-grid">
          {listings.length ? (
            listings.map((listing) => (
              <ListingCard key={listing.id} listing={listing} onOpen={onOpen} onOpenSeller={onOpenSeller} />
            ))
          ) : (
            <div className="mp-state" style={{ display: "flex" }}>
              <svg viewBox="0 0 24 24">
                <rect x="3" y="3" width="18" height="18" rx="2" stroke="currentColor" strokeWidth="1.8" />
                <path d="M9 9l6 6M15 9l-6 6" stroke="currentColor" strokeWidth="1.8" />
              </svg>
              <div className="mp-state-title">No listings found</div>
              <div className="mp-state-desc">Try a different search term.</div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
