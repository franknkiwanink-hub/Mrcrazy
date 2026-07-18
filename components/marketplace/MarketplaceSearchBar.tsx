"use client";

// Was: mpSearchInput's own focus/keydown handlers + mpRenderSuggestions'
// small fixed-position popover. Now: this bar is a tap target that opens
// SearchOverlay.tsx (full-screen, YouTube-style takeover with a
// localStorage-backed recent-searches list) instead of rendering its own
// dropdown — same scoring/highlight logic, just relocated into the
// overlay. AI Search is untouched (matches the original's
// mpAiSearchBtn/mpAiSearchPanel, unaffected by this change).
import { useState } from "react";
import type { Listing } from "@/lib/listings";
import SearchOverlay from "@/components/marketplace/SearchOverlay";

export default function MarketplaceSearchBar({
  listings,
  searchQuery,
  onSearchChange,
  onOpen,
}: {
  listings: Listing[];
  searchQuery: string;
  onSearchChange: (q: string) => void;
  onOpen: (listing: Listing) => void;
}) {
  const [overlayOpen, setOverlayOpen] = useState(false);

  return (
    <div className="mp-search-wrap">
      <svg className="mp-search-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2.2}>
        <circle cx={11} cy={11} r={8} />
        <line x1={21} y1={21} x2="16.65" y2="16.65" />
      </svg>
      <button
        type="button"
        id="mpSearchInput"
        className="mp-search-trigger"
        onClick={() => setOverlayOpen(true)}
      >
        {searchQuery || <span className="mp-search-placeholder">Search listings…</span>}
      </button>
      {searchQuery ? (
        <button
          className="mp-search-clear"
          id="mpSearchClear"
          aria-label="Clear"
          onClick={(e) => {
            e.stopPropagation();
            onSearchChange("");
          }}
        >
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2.8}>
            <line x1={18} y1={6} x2={6} y2={18} />
            <line x1={6} y1={6} x2={18} y2={18} />
          </svg>
        </button>
      ) : null}

      <SearchOverlay
        open={overlayOpen}
        listings={listings}
        initialQuery={searchQuery}
        onClose={() => setOverlayOpen(false)}
        onSearchChange={onSearchChange}
        onOpenListing={onOpen}
      />
    </div>
  );
}
