import type { Metadata } from "next";
import { getPublicBaseUrl } from "@/lib/server/adminDb";
import MarketplaceGrid from "@/components/marketplace/MarketplaceGrid";

// MarketplaceGrid is entirely client-rendered and filter-driven with no
// server-readable distinct routes per filter, so one static, professional
// description for the whole marketplace is correct here — no per-filter
// metadata.
const TITLE = "Marketplace — Websites, Apps, Games & Templates | Siterifty";
const DESCRIPTION =
  "Browse websites, apps, games, and templates for sale on Siterifty. Every deal is protected by escrow, from first message to final payout.";

export function generateMetadata(): Metadata {
  const url = `${getPublicBaseUrl()}/marketplace`;
  return {
    title: TITLE,
    description: DESCRIPTION,
    alternates: { canonical: url },
    openGraph: { title: TITLE, description: DESCRIPTION, url, type: "website" },
    twitter: { card: "summary_large_image", title: TITLE, description: DESCRIPTION },
  };
}

// Standalone, directly-linkable /marketplace route (share links, SEO, the
// header's "Marketplace" nav link). The homepage (app/page.tsx) renders
// the same MarketplaceGrid component inline below the hero, matching the
// original site's layout where the marketplace sits right after the hero
// on "/" — this route exists in addition to that, not instead of it.
export default function MarketplacePage() {
  return (
    <div style={{ marginTop: 92 }}>
      <MarketplaceGrid />
    </div>
  );
}
