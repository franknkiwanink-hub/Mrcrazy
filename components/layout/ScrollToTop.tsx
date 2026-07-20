"use client";

import { useEffect, useRef } from "react";
import { usePathname, useSearchParams } from "next/navigation";

// Fixes: clicking a footer link (or any link near the bottom of a long
// window-scrolled page, e.g. Home) navigates to the new page but the
// window stays scrolled to wherever the click happened — so the new
// page mounts already scrolled down to roughly where the footer was,
// instead of at the top. Then hitting Back re-triggers the same thing
// in reverse, so it *looks* like "going back always lands on the
// footer" even though the real cause is the forward navigation never
// resetting scroll in the first place.
//
// Root cause: most of this app's pages (Settings, Marketplace, the
// listing/seller detail views, etc.) scroll an inner `overflow-y: auto`
// panel rather than the window, so the browser's own native "new page
// starts at the top" behavior and Next's scroll-restoration heuristics
// don't reliably apply — the ones that DO use plain window scroll
// (Home, the static pages, and by extension Footer, which lives at the
// bottom of window-scrolled flow on those pages) are the ones this
// bites, since nothing was ever forcing the window itself back to 0.
//
// Fix: on every pathname change from an actual forward navigation
// (link click / router.push), force window scroll to 0. True
// browser Back/Forward (popstate) is left alone so the platform's own
// scroll-position restoration for that specific gesture still works —
// this only intervenes for new navigations, matching how a traditional
// multi-page site always starts a freshly-navigated-to page at the top.
export default function ScrollToTop() {
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const isPopState = useRef(false);

  useEffect(() => {
    const onPopState = () => {
      isPopState.current = true;
    };
    window.addEventListener("popstate", onPopState);
    return () => window.removeEventListener("popstate", onPopState);
  }, []);

  useEffect(() => {
    if (isPopState.current) {
      // Browser back/forward — let the browser/Next restore whatever
      // scroll position it already has for that history entry.
      isPopState.current = false;
      return;
    }
    // Any other navigation (Link click, router.push, router.replace):
    // always start the new page at the top, matching normal multi-page
    // site behavior, regardless of which scroll container (window or
    // an inner panel) the click originated in.
    window.scrollTo(0, 0);
    // Some pages also render their own inner overflow-y:auto scroll
    // container as the "real" scrollable surface (Settings' detail
    // panel, the marketplace grid's #mpBody, etc.) — resetting those
    // too so a stale scroll position from the previous mount of that
    // same DOM id/class can't bleed through.
    document.querySelectorAll<HTMLElement>("#mpBody, #detailPanel, #mpModalBody").forEach((el) => {
      el.scrollTop = 0;
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [pathname, searchParams]);

  return null;
}
