FIXES ONLY — drop these into your project at the same paths, overwriting
the existing files, except where noted as NEW.

1) HAMBURGER/DRAWER SCROLL LOCK DIDN'T STOP BACKGROUND SCROLL
   lib/useScrollLock.ts
   - Was only setting document.body.style.overflow = "hidden". On pages
     where <html> (not <body>) was the element that actually scrolled,
     wheel/keyboard scroll could still move the page behind an open
     drawer/modal. Now locks both html and body overflow together (same
     pairing already used for html.mnt-mode in base.css), reference-
     counted the same way as before.

2) PROFILE PAGE (AND SETTINGS) HID THE FOOTER
   app/styles/profile.css
   components/profile/MyProfileHub.tsx
   app/settings/page.tsx
   app/settings/loading.tsx (NEW)
   - Root cause: #profileModal (and Settings' equivalent wrapper) used
     position:fixed; inset:0 — correct for their original design as
     overlays-over-the-marketplace, but both are now real routed pages
     (/myprofile, /settings) rendered inside <main>, above the site-wide
     <Footer/> in normal document flow. Fixed+inset:0 covered the whole
     viewport, hiding the footer behind it (it was still rendering, just
     never visible). Switched both to min-height:100dvh so they flow
     normally and the footer shows once the page is scrolled past.
     Settings' internal sidebar+detail-panel split-scroll UI is
     unaffected — that still works exactly as before.
   - NOT changed: the onboarding wizard (.ob-wizard) — that's a
     deliberate full-screen, no-dismiss signup takeover, not a content
     page, so it correctly stays fixed+no-footer.

3) 28 ROUTES HAD NO LOADING STATE — BLANK SCREEN ON NAVIGATION
   app/{about,buyer-protection,escrow,how-it-works,privacy,terms,contact,
   help,gallery,aitools,dashboard,sellers,leaderboard,onboarding,blog,
   blog/[id],settings,myprofile,marketplace,marketplace/[type],
   marketplace/[type]/[bracket],sell,sell/app,sell/game,sell/website,
   sell/template,sell/3d-assets}/loading.tsx (all NEW)
   components/layout/StaticPageSkeleton.tsx (NEW — shared shape for
     every page built on components/layout/StaticPage)
   components/listing/SellFormSkeleton.tsx (NEW — shared shape for the
     5 /sell/* listing-type forms)
   - None of these routes had their own loading.tsx, so Next fell back
     to either nothing or the generic marketplace-grid-shaped
     app/loading.tsx, which looked wrong on non-marketplace pages. Each
     now has a loading.tsx shaped like its own real content (support
     pages get StaticPageSkeleton, marketplace routes reuse the already-
     correct SiteriftyLoader, settings/myprofile/dashboard/sellers/
     leaderboard get bespoke skeletons matching their real layout).
   - messages/deal/[id] and messages/group/[id] were already covered by
     the existing app/messages/loading.tsx (Next applies a parent
     segment's loading.tsx to any nested route that doesn't define its
     own more specific one) — no new file needed there, so it's not
     included in this zip.

4) REDIRECT PAGES SHOWED A BLANK SCREEN WHILE REDIRECTING
   app/aiagent/page.tsx
   app/profile/loading.tsx (NEW)
   app/r/[username]/loading.tsx (NEW)
   - /aiagent (client-side redirect after opening the agent modal),
     /profile, and /r/[username] (both server-side redirect()) all had a
     moment of nothing on screen before landing on their real
     destination — same "silence reads as broken" problem
     lib/useNavigating.ts already documents for the outbound side of a
     nav. /aiagent now renders a centered NavSpinnerIcon for the instant
     before its redirect fires; /profile and /r/[username] get a
     loading.tsx with the same spinner, shown immediately while their
     server-side redirect resolves.

5) DISCOVER HAD NO REAL URL — NO META TAGS / PREVIEW IMAGE POSSIBLE
   app/discover/page.tsx (NEW)
   app/discover/DiscoverPageClient.tsx (NEW)
   components/marketplace/MarketplaceFilterBar.tsx
   - Discover was only an in-page takeover panel (DiscoverPanel.tsx,
     opened over the marketplace) with no URL of its own, so there was
     nowhere to attach a title/description/preview image — sharing "the
     Discover page" had no real page behind it. Added a real /discover
     route with its own generateMetadata, reusing the exact same
     MARKETPLACE_OG_IMAGE the root layout and /marketplace already use
     (lib/og/staticOgImage.ts) as its preview image. DiscoverPageClient
     is a standalone version of the same panel content (identical
     markup/classnames/data source), flowing as a normal page (so the
     footer shows below it, same fix as #2) instead of a fixed portal
     takeover. The marketplace's own "Discover" button now navigates to
     this real route instead of opening the old in-page panel, so
     there's one implementation instead of two that could drift apart.
     (DiscoverPanel.tsx itself is unchanged and still in use — it still
     exports the DiscoverButton trigger — so it's not included here.)

HOW TO APPLY
============
Extract this zip into the ROOT of your project (the folder containing
your app/, components/, and lib/ folders) — paths mirror your project
structure exactly. Then:

  1. Overwrite every existing file at its matching path.
  2. Every loading.tsx, StaticPageSkeleton.tsx, SellFormSkeleton.tsx,
     and everything under app/discover/ is brand new — just make sure
     it lands in the exact folder shown (none of these overwrite
     anything).
