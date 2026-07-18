"use client";

// Shared full-screen skeleton loader — glass/blurred overlay with shimmer
// skeleton blocks mirroring the real layout (nav + search + avatar, hero
// banner, section title, listing grid). Two call sites:
//   1. app/loading.tsx — Next's route-level loading UI, shown
//      automatically during server-side navigation/data fetching for any
//      route that doesn't define its own more specific loading.tsx
//      (e.g. listing/[id] has its own ListingDetailSkeleton and takes
//      priority there).
//   2. MarketplaceGrid's client-side `loading` state — the feed itself is
//      fetched client-side via useFeed(), which app/loading.tsx can't see,
//      so the grid renders this directly while its first page loads.
export default function SiteriftyLoader() {
  return (
    <div id="siterifty-loader">
      <div className="s-nav">
        <a href="/" className="brand">
          Siterifty<span>.com</span>
        </a>
        <div className="skel s-search" />
        <div className="skel s-avatar" />
      </div>

      <div className="skel s-banner" />

      <div className="skel s-title" />

      <div className="s-grid">
        <div className="s-card">
          <div className="skel s-img" />
          <div className="skel s-text" />
          <div className="skel s-price" />
        </div>
        <div className="s-card">
          <div className="skel s-img" />
          <div className="skel s-text" />
          <div className="skel s-price" />
        </div>
        <div className="s-card">
          <div className="skel s-img" />
          <div className="skel s-text" />
          <div className="skel s-price" />
        </div>
        <div className="s-card">
          <div className="skel s-img" />
          <div className="skel s-text" />
          <div className="skel s-price" />
        </div>
      </div>
    </div>
  );
}
