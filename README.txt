FIXED FILES — this session
Extract this zip and copy each file to the matching path in your project
(same relative path shown below), overwriting the existing file.

app/listing/[id]/getListing.ts
  - Wrapped getListingById in React's cache() so generateMetadata + the
    page component share one Firestore read instead of two per request.

app/seller/[id]/getSeller.ts
  - Same fix as above for getSellerSeoProfile (was up to 4 sequential
    reads x2 calls = 8 round trips; now 4).

app/layout.tsx
  - BootOverlay restored (not removed) but made non-blocking: page
    content renders and is clickable immediately behind it instead of
    waiting for auth to resolve.

app/globals.css
  - #appBootOverlay: pointer-events disabled + translucent background,
    so it no longer blocks clicks/content underneath.

components/layout/BottomNav.tsx
  - Sell Now, Sellers, and Search buttons had NO onClick handlers at all
    (did nothing). Now wired to real navigation.

components/marketplace/MarketplaceSearchBar.tsx
  - Added ?focusSearch=1 handling so BottomNav's Search button opens the
    marketplace search overlay.

components/support/FeedbackWidget.tsx
  - Modal shell was using made-up classnames (fb-modal) with no CSS
    behind them. Rebuilt to use the real supp-modal / full-modal /
    supp-shell / supp-header / supp-body / supp-hero classes from the
    original HTML so existing CSS actually applies.

app/sell/page.tsx
  - The "What are you listing?" picker was a from-scratch redesign that
    dropped the plan-tier pricing cards, category tabs, and "Your
    Listings" section entirely. Rebuilt using the real lm-* classes
    (lm-pricing-grid/lm-pricing-card, lm-category-tabs/lm-tab-btn,
    lm-cta-btn, lm-listings-header/lm-listing-item) from the original.
