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
import { usePathname } from "next/navigation";
import BottomNav from "@/components/layout/BottomNav";
import FeedbackWidget from "@/components/support/FeedbackWidget";

const VISIBLE_PATHS = new Set<string>(["/", "/marketplace"]);

export default function HomeMarketplaceOnly() {
  const pathname = usePathname();
  if (!VISIBLE_PATHS.has(pathname)) return null;

  return (
    <>
      <BottomNav />
      <FeedbackWidget />
    </>
  );
}
