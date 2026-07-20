import type { Metadata } from "next";
import { Suspense } from "react";
import { getPublicBaseUrl } from "@/lib/server/adminDb";
import MarketplaceGrid from "@/components/marketplace/MarketplaceGrid";
import SearchResultsGrid from "@/components/marketplace/SearchResultsGrid";
import SiteriftyLoader from "@/components/layout/SiteriftyLoader";
import { searchListingsServer } from "./searchListings";

// MarketplaceGrid is entirely client-rendered and filter-driven with no
// server-readable distinct routes per filter, so one static, professional
// description for the whole marketplace is correct here — no per-filter
// metadata. The one exception is `?q=` (see generateMetadata below):
// unlike type/template/price, a search query is meaningful to put in a
// shareable URL and in search-engine-facing metadata, since "marketplace
// search results for X" is a genuinely distinct, indexable page in a way
// "marketplace filtered to template=true" isn't.
const TITLE = "Siterifty Marketplace | Buy & Sell Websites, Apps & Games";
const DESCRIPTION =
  "Browse verified websites, apps, and games for sale — every deal backed by escrow protection, from first message to final payout.";

type SearchParams = { q?: string | string[] };

function firstParam(v: string | string[] | undefined): string | undefined {
  return Array.isArray(v) ? v[0] : v;
}

export async function generateMetadata({
  searchParams,
}: {
  searchParams: Promise<SearchParams>;
}): Promise<Metadata> {
  const q = firstParam((await searchParams).q)?.trim();
  const base = getPublicBaseUrl();

  if (q) {
    const url = `${base}/marketplace?q=${encodeURIComponent(q)}`;
    const title = `"${q}" — Search Results | Siterifty Marketplace`;
    const description = `Websites, apps, and games matching "${q}" on Siterifty — every deal backed by escrow protection, from first message to final payout.`;
    return {
      title,
      description,
      // Search-result pages for arbitrary user-typed queries are excluded
      // from indexing — same reasoning any e-commerce site applies to
      // internal search: infinite low-value/duplicate-content pages for
      // every possible query string is not what search engines should be
      // crawling, unlike the canonical unfiltered /marketplace page below.
      robots: { index: false, follow: true },
      alternates: { canonical: url },
      openGraph: { title, description, url, type: "website" },
      twitter: { card: "summary_large_image", title, description },
    };
  }

  const url = `${base}/marketplace`;
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
//
// `?q=` is the one case that branches server-side: rather than let
// MarketplaceGrid's client-side search (SearchOverlay/MarketplaceFilterBar,
// via fetchSearchResults) be the only way to see results, a directly-
// linked/shared/refreshed `/marketplace?q=foo` URL resolves to real
// results on first paint — calling handleSearch in-process (see
// ./searchListings) at zero extra Firestore cost beyond what browsing
// already pays, same as handleFeed. Once loaded, typing a new query in the
// search box still goes through the normal client-side path; this only
// covers the initial server-rendered load.
export default async function MarketplacePage({
  searchParams,
}: {
  searchParams: Promise<SearchParams>;
}) {
  const q = firstParam((await searchParams).q)?.trim();

  if (q) {
    const { listings, query } = await searchListingsServer(q);
    return (
      <div style={{ marginTop: 92 }}>
        <SearchResultsGrid listings={listings} query={query} />
      </div>
    );
  }

  return (
    <div style={{ marginTop: 92 }}>
      <Suspense fallback={<SiteriftyLoader />}>
        <MarketplaceGrid />
      </Suspense>
    </div>
  );
}
