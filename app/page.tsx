"use client";

import { Suspense, useState } from "react";
import Hero from "@/components/home/Hero";
import MarketplaceGrid from "@/components/marketplace/MarketplaceGrid";
import MarketplaceModal from "@/components/marketplace/MarketplaceModal";
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
// infinite scroll — ending in a "See full marketplace" CTA that opens the
// same full-screen MarketplaceModal Hero's own search bar already uses.
// The real, unrestricted infinite-scroll feed lives only on /marketplace
// itself (both inline as its own route, and here inside the modal).
export default function HomePage() {
  const [marketplaceModalOpen, setMarketplaceModalOpen] = useState(false);

  return (
    <>
      <Hero />
      <Suspense fallback={<SiteriftyLoader />}>
        <MarketplaceGrid preview onSeeFullMarketplace={() => setMarketplaceModalOpen(true)} />
      </Suspense>
      <MarketplaceModal open={marketplaceModalOpen} onClose={() => setMarketplaceModalOpen(false)} />
    </>
  );
}
