# All session edits — consolidated

Every file in this zip that was touched during this session, across all
three rounds of work. Folder structure matches the project root, so
these can be dropped straight in.

## Round 1 — initial bug fixes
- **`components/layout/BottomNav.tsx`** — "Sell Now" and "Sellers"
  buttons had no `onClick`; wired to `router.push("/sell")` /
  `router.push("/sellers")`.
- **`app/globals.css`** — blog post/listing pages had a mobile-only
  (`max-width: 560px`) header offset of `84px` instead of `92px` (the
  value used everywhere else), causing content to sit under the fixed
  header/announcement bar on phones. Fixed both mobile rules to `92px`.
- **`scripts/seed-blog-posts.mjs`** (new) — ready-to-run seed script with
  3 SEO-targeted blog posts, since posts can only be published through
  the real admin-gated API endpoint (no static content file to add
  directly).

## Round 2 — "Back to marketplace" + homepage preview CTA
- **`components/marketplace/SearchResultsGrid.tsx`**
  - "Back to marketplace" button restyled from a dark/near-black pill
    (`--mp-surface`/`--mp-border`) to a translucent white glass pill
    (`rgba(255,255,255,0.10)` + blur), with a hover state.
  - Replaced `window.location.assign("/marketplace")` (full page reload)
    with `router.push("/marketplace")` + `router.refresh()` — a real
    client-side nav that still forces the server component to re-run.
- **`components/marketplace/MarketplaceGrid.tsx`**
  - Removed the `IntersectionObserver`-based auto-redirect that fired
    when scrolling to the end of the homepage preview grid (unreliable,
    felt like an unexpected redirect).
  - Replaced with an explicit **"View more listings"** CTA button (lime
    pill, arrow icon) that calls the same `onSeeFullMarketplace` handler.

## Round 3 — five new features + share button
- **Skeleton loading:**
  - `components/marketplace/ListingCardSkeleton.tsx` (new) — card-shaped
    shimmer placeholder matching SiteCard's layout.
  - `app/globals.css` — added globally-scoped `.sr-skel` shimmer class.
  - `MarketplaceGrid.tsx` — homepage preview grid now shows in-grid card
    skeletons on first load instead of the full-screen loader.
- **Empty-state CTAs:**
  - `MarketplaceGrid.tsx` — "Clear filters & search" button on the empty
    state when a filter/search is active.
  - `SearchResultsGrid.tsx` — "Browse all listings" button on empty
    search results.
- **Toast notifications:**
  - `components/system/SrToastProvider.tsx` (new) — lightweight,
    disposable UI-confirmation toast system (bottom-center), separate
    from the existing notifications inbox system.
  - `app/globals.css` — `#srToastStack` / `.sr-toast` styles.
  - `app/layout.tsx` — mounted `SrToastProvider` as an outer provider.
  - Wired into `SaveButton.tsx`, `MarketplaceGrid.tsx`,
    `SearchResultsGrid.tsx`, `ShareButton.tsx`.
- **Recently viewed listings:**
  - `lib/recentlyViewed.ts` (new) — client-only (localStorage) history
    of the last 16 listings opened.
  - `app/listing/[id]/ListingViewBeacon.tsx` — now also records each
    view into recently-viewed (signature changed from `listingId` to the
    full `listing` object to support this).
  - `components/marketplace/RecentlyViewedStrip.tsx` (new) — horizontal
    snap-scroll strip, reuses the real `ListingCard`.
  - `app/page.tsx` — strip placed between Hero and the preview grid.
- **Seller trust badges on cards:**
  - `lib/useSeller.ts` — lightweight per-card `SellerSummary` now
    includes `plan` and `dealsCompleted` (no extra query cost).
  - `components/marketplace/SellerStrip.tsx` — renders `SellerBadges`
    next to the seller name on every card.
- **Bonus — Share button:**
  - `components/listing/ShareButton.tsx` (new) — native share sheet on
    mobile, popover with destinations + copy link on desktop.
  - `lib/share.ts` — pre-existing share-URL/destination model, now
    actually wired into the UI for the first time.
  - Wired into `WebsiteListingBody.tsx`, `AppListingBody.tsx`,
    `GameListingBody.tsx`.
