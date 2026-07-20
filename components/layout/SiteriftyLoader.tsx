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
    const { style: bodyStyle } = document.body;
    const { style: htmlStyle } = document.documentElement;
    const scrollY = window.scrollY;

    const prev = {
      bodyOverflow: bodyStyle.overflow,
      bodyPosition: bodyStyle.position,
      bodyWidth: bodyStyle.width,
      bodyTop: bodyStyle.top,
      bodyHeight: bodyStyle.height,
      htmlOverflow: htmlStyle.overflow,
      htmlHeight: htmlStyle.height,
    };

    // Lock BOTH html and body, and pin body to its current scroll offset
    // via a negative top — position:fixed alone (with no top set) still
    // lets some browsers scroll the underlying document, and locking
    // body without also locking html leaves html free to scroll on its
    // own. This combination is what makes the lock airtight.
    htmlStyle.overflow = "hidden";
    htmlStyle.height = "100%";
    bodyStyle.overflow = "hidden";
    bodyStyle.position = "fixed";
    bodyStyle.width = "100%";
    bodyStyle.height = "100%";
    bodyStyle.top = `-${scrollY}px`;

    return () => {
      htmlStyle.overflow = prev.htmlOverflow;
      htmlStyle.height = prev.htmlHeight;
      bodyStyle.overflow = prev.bodyOverflow;
      bodyStyle.position = prev.bodyPosition;
      bodyStyle.width = prev.bodyWidth;
      bodyStyle.height = prev.bodyHeight;
      bodyStyle.top = prev.bodyTop;
      // Restore the exact scroll position the page was at before the
      // lock — without this, removing position:fixed snaps the page
      // back to the top instead of where the user actually was.
      window.scrollTo(0, scrollY);
    };
  }, []);

  return (
    <div id="siterifty-loader">
      <div className="s-nav">
        <a href="/" className="brand">
          <img
            src="/images/siterifty-logo.png"
            alt="Siterifty.com — Buy, Sell, Build, Trust"
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
