"use client";

import { useEffect, useState } from "react";
import { useDealPopup } from "@/components/deal/DealPopupProvider";
import type { Listing } from "@/lib/listings";

// Ports the listing modal's bottom CTA bar (#mpModalCtaBar /
// #mpModalDealBtn, index.html lines 1566-1574) onto the standalone
// listing detail page. In the original this bar is part of the shared
// mpOpenModal popup used for all three listing types; since this app
// renders each type as its own routed page instead of a shared modal,
// this is a small standalone component each *ListingBody renders once,
// at the bottom, rather than duplicating the bar's JSX three times.
//
// The original never hides this bar (or otherwise client-side-guards
// against it) for a listing's own owner — mpModalCtaBar's display is
// only ever toggled by mpOpenModal itself, not by an ownerId check —
// so this doesn't add one either. A seller who clicks "Send Deal" on
// their own listing gets the server's actual guard (deal.js's
// `sellerUid === buyerUid` check) surfaced as the popup's inline error,
// same as the original.
//
// cta-visible fade-in class is applied one frame after mount, matching
// mpOpenModal's double-rAF timing so the animation fires fresh on
// every listing page load.
export default function DealCtaBar({ listing }: { listing: Listing }) {
  const { openDeal } = useDealPopup();
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    const raf1 = requestAnimationFrame(() => {
      const raf2 = requestAnimationFrame(() => setVisible(true));
      return () => cancelAnimationFrame(raf2);
    });
    return () => cancelAnimationFrame(raf1);
  }, []);

  return (
    <div className={`mp-modal-cta-bar${visible ? " cta-visible" : ""}`} style={{ display: "flex" }}>
      <button className="mp-modal-cta-deal" onClick={() => openDeal(listing)}>
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2">
          <path d="M22 2L11 13M22 2l-7 20-4-9-9-4 20-7z" strokeLinecap="round" strokeLinejoin="round" />
        </svg>
        Send Deal
      </button>
    </div>
  );
}
