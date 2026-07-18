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

  return null;
}
