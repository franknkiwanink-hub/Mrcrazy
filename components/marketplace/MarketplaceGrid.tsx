"use client";

import { useEffect, useMemo, useRef } from "react";
import { useRouter } from "next/navigation";
import { useFeed } from "@/lib/useFeed";
import { useMarketplaceFilters } from "@/lib/useMarketplaceFilters";
import { buildInterleavedFeed } from "@/lib/feedInterleave";
import type { Listing } from "@/lib/listings";
import ListingCard from "@/components/marketplace/ListingCard";
import MarketplaceFilterBar from "@/components/marketplace/MarketplaceFilterBar";
import PremiumSellersStrip from "@/components/marketplace/PremiumSellersStrip";
import BoostedRow from "@/components/marketplace/BoostedRow";
import AdSlot from "@/components/marketplace/AdSlot";
import SellerPromoCard from "@/components/marketplace/SellerPromoCard";
import AiPromoCard from "@/components/marketplace/AiPromoCard";

export default function MarketplaceGrid() {
  const filters = useMarketplaceFilters();
  const type = filters.typeFilter === "all" ? undefined : filters.typeFilter;
  const { listings, loading, loadingMore, error, exhausted, loadMore, reset } = useFeed({ pageSize: 24, type });
  const router = useRouter();
  const onOpen = (listing: Listing) => {
    if (listing?.id) router.push(`/listing/${encodeURIComponent(listing.id)}`);
  };
  // Seller profile page now exists (app/seller/[id]/page.tsx) — cards
  // navigate straight there, same as onOpen does for listings. Signature
  // matches what every card (SiteCard/AppCard/GameCard) actually calls:
  // onOpenSeller(listing.ownerId, listing) — the listing param isn't
  // needed for a plain ownerId-based navigation, but keeping the second
  // parameter in the signature (even unused) is what makes this function
  // actually satisfy the (ownerId, listing) => void type every consumer
  // is typed against, instead of silently relying on JS's "extra args are
  // ignored" behavior to paper over a real type mismatch.
  const onOpenSeller = (ownerId: string | undefined, _listing?: Listing) => {
    if (ownerId) router.push(`/seller/${encodeURIComponent(ownerId)}`);
  };

  // Client-side portion of mpApplyAndRender: template/price filters apply
  // on top of whatever the server already returned for the current type.
  const filteredListings = useMemo(
    () => filters.applyClientFilters(listings),
    // applyClientFilters is itself memoized on [templateFilter, priceMin,
    // priceMax] inside the hook, so depending on it (not the whole
    // `filters` object, which is a fresh literal every render) avoids
    // recomputing this on unrelated re-renders.
    [filters.applyClientFilters, listings]
  );
  const listingById = useMemo(() => new Map(filteredListings.map((l) => [l.id, l])), [filteredListings]);

  // Ports mpRenderCards' ad/promo interleaving off the filtered set.
  const feedItems = useMemo(() => buildInterleavedFeed(filteredListings.map((l) => l.id)), [filteredListings]);

  // Infinite scroll — mirrors _setupSentinel's IntersectionObserver +
  // rootMargin: '200px' pattern exactly.
  const sentinelRef = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const sentinel = sentinelRef.current;
    if (!sentinel) return;
    const observer = new IntersectionObserver(
      (entries) => {
        if (entries[0].isIntersecting) loadMore();
      },
      { rootMargin: "200px" }
    );
    observer.observe(sentinel);
    return () => observer.disconnect();
  }, [loadMore]);

  return (
    <div style={{ padding: "0 24px 80px" }}>
      <MarketplaceFilterBar
        typeFilter={filters.typeFilter}
        onTypeChange={filters.setTypeFilter}
        templateFilter={filters.templateFilter}
        onTemplateChange={filters.setTemplateFilter}
        priceMin={filters.priceMin}
        priceMax={filters.priceMax}
        onPriceChange={filters.setPriceRange}
        activeTags={filters.activeTags}
        searchListings={listings}
        searchQuery={filters.searchQuery}
        onSearchChange={filters.setSearchQuery}
        onOpenListing={onOpen}
        onOpenSeller={onOpenSeller}
      />

      <PremiumSellersStrip />

      <div className="mp-results">
        Showing <strong id="mpResultCount">{loading ? "—" : filteredListings.length}</strong>
      </div>

      <BoostedRow listings={filteredListings} onOpen={onOpen} onOpenSeller={onOpenSeller} />

      <div className="mp-grid-wrap">
        <div className="mp-grid" id="mpGrid">
          {loading ? (
            <div className="mp-state" id="mpLoading">
              <div className="mp-spinner" />
              <div className="mp-state-title">Loading listings…</div>
              <div className="mp-state-desc">Fetching the latest from the marketplace</div>
            </div>
          ) : error ? (
            <div className="mp-state" id="mpError" style={{ display: "flex" }}>
              <svg viewBox="0 0 24 24">
                <circle cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="1.8" />
                <line x1="12" y1="8" x2="12" y2="12" stroke="currentColor" strokeWidth="1.8" />
                <circle cx="12" cy="16" r="0.5" fill="currentColor" stroke="none" />
              </svg>
              <div className="mp-state-title">Something went wrong</div>
              <div className="mp-state-desc">Could not load listings. Tap Try Again.</div>
              <button
                id="mpRetryBtn"
                style={{
                  marginTop: "0.9rem",
                  padding: "0.55rem 1.4rem",
                  background: "rgba(163,230,53,0.1)",
                  border: "1.5px solid rgba(163,230,53,0.4)",
                  borderRadius: "2rem",
                  color: "#a3e635",
                  fontSize: "0.82rem",
                  fontWeight: 700,
                  cursor: "pointer",
                  fontFamily: "inherit",
                  letterSpacing: "0.02em",
                }}
                onClick={reset}
              >
                Try Again
              </button>
            </div>
          ) : !filteredListings.length ? (
            <div className="mp-state" id="mpEmpty" style={{ display: "flex" }}>
              <svg viewBox="0 0 24 24">
                <rect x="3" y="3" width="18" height="18" rx="2" stroke="currentColor" strokeWidth="1.8" />
                <path d="M9 9l6 6M15 9l-6 6" stroke="currentColor" strokeWidth="1.8" />
              </svg>
              <div className="mp-state-title">No listings found</div>
              <div className="mp-state-desc">Try adjusting your search or filters.</div>
            </div>
          ) : (
            feedItems.map((item) => {
              if (item.kind === "listing") {
                const listing = listingById.get(item.id);
                if (!listing) return null;
                return <ListingCard key={item.id} listing={listing} onOpen={onOpen} onOpenSeller={onOpenSeller} />;
              }
              if (item.kind === "ad") return <AdSlot key={item.id} kind={item.adKind} />;
              if (item.kind === "seller-promo") return <SellerPromoCard key={item.id} />;
              return <AiPromoCard key={item.id} />;
            })
          )}
        </div>

        <div ref={sentinelRef} id="mpLoadSentinel" />
        {loadingMore ? (
          <div id="mpLoadMoreSpinner" style={{ display: "flex" }}>
            <svg
              width="18"
              height="18"
              viewBox="0 0 24 24"
              fill="none"
              stroke="rgba(255,255,255,0.35)"
              strokeWidth="2.2"
              style={{ animation: "mp-spin 1s linear infinite", flexShrink: 0 }}
            >
              <circle cx="12" cy="12" r="10" strokeOpacity="0.2" />
              <path d="M12 2a10 10 0 0110 10" strokeLinecap="round" />
            </svg>
            Loading more…
          </div>
        ) : exhausted && filteredListings.length ? (
          <div style={{ textAlign: "center", padding: "16px 0", opacity: 0.5, fontSize: 13 }}>
            You&apos;ve reached the end of the marketplace.
          </div>
        ) : null}
      </div>
    </div>
  );
}
