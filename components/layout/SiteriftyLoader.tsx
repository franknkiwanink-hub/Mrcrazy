"use client";

import { useEffect } from "react";

// Shared full-screen skeleton loader — glass/blurred overlay with shimmer
// skeleton blocks mirroring the real layout (nav + search + avatar, hero
// banner, section title, listing grid). Two call sites:
//   1. app/loading.tsx — Next's route-level loading UI, shown
//      automatically during server-side navigation/data fetching for any
//      route that doesn't define its own more specific loading.tsx
//      (e.g. listing/[id] has its own ListingDetailSkeleton and takes
//      priority there).
//   2. MarketplaceGrid's own client-side feed loading state — the feed itself is
//      fetched client-side via useFeed(), which app/loading.tsx can't see,
//      so the grid renders this directly while its first page loads.
//
// Body scroll is locked for as long as this is mounted so the page behind
// it can't scroll/jump underneath the fixed overlay (this was the source
// of the "white sheet" flash at the bottom — the underlying page content
// peeking through while it scrolled independently of the loader).
export default function SiteriftyLoader() {
  useEffect(() => {
    const { style } = document.body;
    const prevOverflow = style.overflow;
    const prevPosition = style.position;
    const prevWidth = style.width;
    style.overflow = "hidden";
    style.position = "fixed";
    style.width = "100%";
    return () => {
      style.overflow = prevOverflow;
      style.position = prevPosition;
      style.width = prevWidth;
    };
  }, []);

  return (
    <div id="siterifty-loader">
      <div className="s-nav">
        <a href="/" className="brand">
          <img
            src="https://cdn.phototourl.com/member/2026-07-19-ffcaa670-d57c-44f6-8415-ab73856860b2.png"
            alt="Siterifty.com"
            style={{ height: "1.3rem", display: "block" }}
          />
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
