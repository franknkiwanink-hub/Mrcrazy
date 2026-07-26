3 BUG FIXES — drop these into your project at the same paths, overwriting the existing files (SellerStateScreen.tsx is new).

1) LOADING SHIMMER INVISIBLE ON DARK BACKGROUND
   - app/styles/seller-profile.css
     Old shimmer used an opacity-only pulse (spSkelPulse) on near-black
     blocks (#111114 against a near-black page) — barely visible even
     while animating. Replaced with a real gradient-sweep animation
     (sp-shimmer-sweep) with better contrast, applied to every skeleton
     block that had this problem (avatar, name/handle, bio, stat cards,
     donate-page skeleton rows).

2) DELETED SELLER SHOWED "ANONYMOUS" INSTEAD OF NOT-FOUND
   - lib/useSeller.ts
     Root cause: fetchFullSeller silently continued with an empty object
     when a seller's Firestore doc didn't exist, so every field fell
     back to a default ("Anonymous", 0 listings) instead of reporting
     not-found. Now returns null immediately for a missing doc.
   - components/seller/SellerStateScreen.tsx  (NEW FILE)
     Full-screen "This seller doesn't exist" state with a small animated
     SVG illustration, lime accent, and Browse Marketplace / Back to Home
     actions. Used by both the seller profile page and the donate page.
   - app/seller/[id]/SellerProfileClient.tsx
     Now renders SellerNotFoundScreen instead of a bare "Seller not
     found" heading. Also replaces the old private-profile mini-card with
     a full-screen SellerPrivateScreen (see fix 3) and adds a working
     Report button/flow to it.
   - app/seller/[id]/getSeller.ts
     Comment-only clarification — this file's SSR lookups were already
     correct (never fell back to "Anonymous" for a missing seller);
     included so the not-found handling is documented consistently
     across the client and server paths.
   - app/donate/[id]/DonatePageClient.tsx
     Replaced the plain "Seller not found." text with the same
     SellerNotFoundScreen full-screen state.

3) PRIVATE-PROFILE SCREEN CRASHED + HAD NO REPORT OPTION
   - components/seller/SellerStateScreen.tsx  (NEW FILE, same as above)
     Also exports SellerPrivateScreen: full-screen "profile has been
     made private" state with a lock SVG animation, the existing safety
     tip, and a working Report seller button (previously Report only
     existed inside SellerProfileHeader, which the private view never
     rendered — so a private seller couldn't be reported at all).
   - app/seller/[id]/SellerProfileClient.tsx
     Replaces the old inline private-profile card (which did unguarded
     string operations on seller.username) with SellerPrivateScreen, and
     adds a handleReportFromPrivateScreen function that mirrors
     SellerProfileHeader's report flow exactly.

BONUS — RATE & REPORT MODAL REDESIGN (requested alongside the 3 fixes)
   - app/styles/seller-profile.css
     Rate modal (stars, submit button, textarea focus ring, success
     message) recolored from amber (#f59e0b) to the site's lime accent
     (#a3e635).
   - app/styles/referrals-misc.css
     Shared Report confirm/alert dialog's icon and button recolored from
     orange (#f97316/#fb923c) to the same lime accent.
