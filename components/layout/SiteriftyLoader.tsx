"use client";

import { useEffect } from "react";

// Shared full-screen skeleton loader — glass/blurred overlay with shimmer
// skeleton blocks mirroring the real layout below the header (hero
// banner, section title, listing grid). The real <Header /> is a fixed,
// higher-z-index element (see globals.css) and stays visible on top of
// this overlay rather than being covered by it — this used to draw its
// own fake nav row and sit above the real header (z-index 9999 vs the
// header's old 20), which hid the actual header behind a plain dark
// backdrop on every navigation/feed load. Two call sites:
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
