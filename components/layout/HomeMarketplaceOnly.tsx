"use client";

// The original site was a single always-mounted page where the bottom
// nav (fnav) and floating feedback launcher sat underneath whatever
// overlay/modal was currently open (settings, listings, sellers, etc all
// opened as overlays on top of the same page) — so they were always
// visible everywhere, and that was fine since nothing else was ever a
// truly separate "page" competing for the same screen space.
//
// Now that Settings/Profile/Listing/Seller/etc are real routes, having
// BottomNav + FeedbackWidget mounted globally means they float on top of
// content on every page (e.g. covering the bottom of a settings panel or
// a listing detail page) instead of just the two places they actually
// belong: the Home feed and the Marketplace grid, which are the two
// "browse" surfaces these controls are meant for.
import { useEffect } from "react";
import { usePathname } from "next/navigation";
import BottomNav from "@/components/layout/BottomNav";
import FeedbackWidget from "@/components/support/FeedbackWidget";

const VISIBLE_PATHS = new Set<string>(["/", "/marketplace"]);

// globals.css reserves space for .fnav via a blanket mobile media-query
// rule (`body { padding-bottom: calc(66px + safe-area-inset-bottom) }`)
// that assumed .fnav was always mounted, same as in the original
// single-page site. Now that .fnav only renders on Home/Marketplace,
// that same body padding was still being applied globally — leaving a
// blank 66px gap at the bottom of every other page (Settings, Listing,
// Profile, etc). Toggling this class keeps that reserved space scoped to
// only the two routes that actually render the nav.
const BODY_CLASS = "srf-fnav-space";

export default function HomeMarketplaceOnly() {
  const pathname = usePathname();
  const visible = VISIBLE_PATHS.has(pathname);

  useEffect(() => {
    document.body.classList.toggle(BODY_CLASS, visible);
    return () => {
      document.body.classList.remove(BODY_CLASS);
    };
  }, [visible]);

  if (!visible) return null;

  return (
    <>
      <BottomNav />
      <FeedbackWidget />
    </>
  );
}
