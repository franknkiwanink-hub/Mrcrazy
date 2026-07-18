"use client";

import { useRouter } from "next/navigation";
import { useSeller } from "@/lib/useSeller";
import Stars from "@/components/marketplace/Stars";
import type { Listing } from "@/lib/listings";

// Ports the seller-row portion of mpOpenModal's `sellerHtml` — avatar,
// name, handle, stars, clickable row that opens the seller profile page.
// Uses the same lightweight useSeller hook as cards (not the full
// mpGetSeller with follower/deal counts), so — like SellerStrip — this
// intentionally does NOT render the trust-badge cluster (sellerBadgesHtml)
// here; the full badge cluster renders on the seller profile page itself,
// which fetches the full seller record. The "Seller Reveals" reviews
// sub-section from the original is a separate scoped follow-up, not
// included here (Layer B, deferred consistently with the rest of the
// listing detail page).
export default function SellerBlock({ listing, accentColor }: { listing: Listing; accentColor: string }) {
  const seller = useSeller(listing.ownerId);
  const router = useRouter();
  const fallbackHandle = listing.ownerEmail?.split("@")[0] || "Anonymous";
  const displayName = seller?.username || fallbackHandle;
  const initial = displayName.charAt(0).toUpperCase();
  const handle = "@" + displayName.toLowerCase().replace(/\s+/g, "_");

  return (
    <div className="modal-section">
      <div className="modal-section-title with-icon">
        <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke={accentColor} strokeWidth="2.2">
          <path d="M20 21v-2a4 4 0 00-4-4H8a4 4 0 00-4 4v2" />
          <circle cx="12" cy="7" r="4" />
        </svg>
        Seller
      </div>
      <div
        className="modal-seller-section"
        onClick={() => {
          if (listing.ownerId) router.push(`/seller/${encodeURIComponent(listing.ownerId)}`);
        }}
      >
        <div className="seller-avatar">
          {seller?.profilePic ? (
            <img
              src={seller.profilePic}
              alt={displayName}
              onError={(e) => {
                (e.currentTarget.parentElement as HTMLElement).textContent = initial;
              }}
            />
          ) : (
            initial
          )}
        </div>
        <div className="seller-name-row">
          <div className="seller-name">{seller ? displayName : "Loading…"}</div>
          <div className="seller-handle">{seller ? handle : ""}</div>
          <div className="seller-stars-row">
            <Stars rating={seller?.rating || 0} count={seller?.ratingCount || 0} />
          </div>
        </div>
        <svg
          className="seller-chevron"
          width="16"
          height="16"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="2"
          strokeLinecap="round"
          strokeLinejoin="round"
        >
          <path d="M9 18l6-6-6-6" />
        </svg>
      </div>
    </div>
  );
}
