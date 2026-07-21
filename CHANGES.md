# Fixes applied

## 1. Bottom nav buttons not working
**File:** `components/layout/BottomNav.tsx`
`Sell Now` and `Sellers` buttons had no `onClick` at all — only `Marketplace`
and the search icon worked. Added `router.push("/sell")` and
`router.push("/sellers")` respectively. No visual/markup changes.

## 2. "Back to marketplace" unstyled and appears to just refresh
**File:** `components/marketplace/SearchResultsGrid.tsx`
When you land on `/marketplace?q=searchterm`, the app renders a completely
different component (`SearchResultsGrid`) than the normal grid. The old
"Back to marketplace" was a bare `<Link href="/marketplace">` — unstyled
(just floating text) and a soft client-side navigation that Next.js doesn't
reliably re-render when going to the same route segment, so it looked like
it just refreshed onto the same results.

Fixed: now a real styled pill button (border, background, icon, matches
the rest of the UI) that does `window.location.assign("/marketplace")` —
a hard navigation guaranteeing you actually land on the real marketplace
grid, not the search-results branch.

## 3. Content overlaid by header/announcement bar ("returns")
**File:** `app/globals.css`
Header (52px) + announcement bar (40px) = 92px of fixed chrome on every
page. Almost every page already correctly offsets content by `92px` —
except the blog post page and blog listing page had a **mobile-only**
override (`@media max-width: 560px`) that dropped this to `84px`, an 8px
shortfall that pushed content (including the "← Blog" back link) up under
the fixed header on phones. Fixed both mobile rules to `92px` to match
every other breakpoint and every other page.

Audited every top-level page/route for this same pattern — confirmed no
other page has a mismatched offset.

## 4. Three SEO blog posts
**File:** `scripts/seed-blog-posts.mjs` (new)
Blog posts in this app live in Firestore and can only be created through
the real admin-gated `POST /api/blog` endpoint (verified against
`ADMIN_EMAIL` server-side) — there's no static content file to just add.
I can't publish directly from this sandbox (no Firebase Admin credentials,
no network access), so instead: a ready-to-run seed script with the full
text of 3 SEO-targeted posts (selling a website, buying a website —
red flags, and how escrow works), each using your existing logo as the
cover image. Run it once with a real admin ID token and it publishes all
three through the exact same path the "Add Blog" button uses.

See the comment at the top of the script for exact run instructions.
