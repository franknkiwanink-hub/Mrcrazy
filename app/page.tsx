import Hero from "@/components/home/Hero";
import MarketplaceGrid from "@/components/marketplace/MarketplaceGrid";

// The original site renders the hero and the marketplace grid on the same
// page — index.html has <section class="hero"> immediately followed by
// #marketplaceOverlay, both inline, not on separate routes. This page
// matches that: Hero on top, MarketplaceGrid directly below, no gap
// between them (the fixed-header top margin lives on Hero's own
// .hero-content, matching how the original's hero already accounts for
// the header without an extra margin on the section after it).
//
// /marketplace also exists as its own standalone, linkable route (for
// share links, SEO, and the header's own nav link) — it renders the same
// MarketplaceGrid component, just with its own top margin since there's
// no hero above it there. Keeping the grid in one shared component means
// both stay in sync automatically as it gets built out further.
export default function HomePage() {
  return (
    <>
      <Hero />
      <MarketplaceGrid />
    </>
  );
}
