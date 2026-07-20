"use client";

import { Suspense } from "react";
import { useRouter } from "next/navigation";
import Hero from "@/components/home/Hero";
import MarketplaceGrid from "@/components/marketplace/MarketplaceGrid";
import SiteriftyLoader from "@/components/layout/SiteriftyLoader";

// The original site renders the hero and the marketplace grid on the same
// page — index.html has <section class="hero"> immediately followed by
// #marketplaceOverlay, both inline, not on separate routes. This page
// matches that: Hero on top, MarketplaceGrid directly below, no gap
// between them (the fixed-header top margin lives on Hero's own
// .hero-content, matching how the original's hero already accounts for
// the header without an extra margin on the section after it).
//
// The homepage grid runs in `preview` mode — a fixed dozen listings, no
// infinite scroll — ending in a "See full marketplace" CTA. That CTA is a
// real navigation to the standalone /marketplace route (not a modal, and
// not the search overlay) — it just eases into that navigation with a
// brief smooth-scroll-to-top first, so the shift reads as intentional
// rather than an abrupt jump straight into a page change mid-scroll.
export default function HomePage() {
  const router = useRouter();

  const handleSeeFullMarketplace = () => {
    window.scrollTo({ top: 0, behavior: "smooth" });
    // Give the smooth-scroll a moment to actually play before the route
    // change swaps the page out from under it — long enough to read as
    // a deliberate transition, short enough not to feel like a delay.
    window.setTimeout(() => {
      router.push("/marketplace");
    }, 350);
  };

  return (
    <>
      <Hero />
      <Suspense fallback={<SiteriftyLoader />}>
        <MarketplaceGrid preview onSeeFullMarketplace={handleSeeFullMarketplace} />
      </Suspense>
    </>
  );
}
