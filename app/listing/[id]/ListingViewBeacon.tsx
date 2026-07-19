"use client";

import { useEffect, useRef } from "react";
import { trackListing } from "@/lib/listings";

// Fires once per page open. Split out from page.tsx so the page itself
// can be a Server Component — this is the one piece of the old
// useEffect-based page that genuinely needs the browser (a per-view
// fetch beacon), everything else (the actual listing fetch) moved to
// server-side rendering in page.tsx / getListing.ts.
export default function ListingViewBeacon({ listingId }: { listingId: string }) {
  const fired = useRef(false);

  useEffect(() => {
    if (fired.current) return;
    fired.current = true;
    trackListing("listing.view", listingId);
  }, [listingId]);

  // Scroll to the top of the new listing page on every open — including
  // navigating from one listing's own "Similar listings" strip straight
  // into another listing, which is a same-route-pattern navigation
  // (/listing/[id] -> /listing/[id]) that the browser/Next.js can
  // otherwise carry the previous page's scroll position into, landing
  // the new page scrolled down near the bottom instead of at the top.
  useEffect(() => {
    window.scrollTo(0, 0);
  }, [listingId]);

  return null;
}
