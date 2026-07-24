FIXED FILES — this session
Extract this zip and copy each file to the matching path in your project
(same relative path shown below), overwriting the existing file, except
where noted otherwise.

1) CHECKOUT SHOWING USD INSTEAD OF LOCAL CURRENCY
   components/messages/CheckoutRoute.tsx
   - Was using its own local `usd()` helper for every price. Now uses
     useCurrency()'s formatBalance() like every other price in the app,
     so the item price, fee breakdown, total, and Pay button amount all
     show in the buyer's selected currency. The real charge is still USD
     under the hood (no live payment provider yet — see PAY_LIVE), so
     when currency !== USD a small disclosure line now shows the actual
     USD amount that will be charged.
   - Also fixes the "blank page on click" / "footer flashes on top" bug
     for this route — see item 4 below, same file.

2) DONATE TOTAL/FEES SHOWING USD INSTEAD OF LOCAL CURRENCY
   components/seller/DonateOverlay.tsx
   - The "Total received" stat and recent-donations list already used
     formatBalance correctly. The fee breakdown ("Platform fee" /
     "Seller receives") and the insufficient-balance / success messages
     were still hardcoded to `$`. Now use formatBalance() too, so they
     match the rest of the overlay. The amount *input* stays labeled
     "(USD)" — donations are actually drawn from the donor's USD wallet
     balance, so that's the one place USD-as-source-of-truth is called
     out explicitly (a small "Charged from your wallet as $X USD" line
     appears under the breakdown when a non-USD currency is selected,
     so nothing is hidden).
   - Removed an unused fmtMoney2() helper while in there.

3) DAILY OBJECTIVE SCREEN SHOWING ON EVERY REFRESH
   components/system/WelcomeBackScreen.tsx
   - Previously the only guard was an in-memory ref, which resets on
     every page load — so a returning user saw the takeover on every
     single refresh. Now the last-shown time is persisted in
     localStorage per-uid, and the screen only reopens once
     REOPEN_COOLDOWN_MS (30 minutes) has passed since it was last shown.
     Refreshing 10 times in a row within that window no longer
     re-triggers it.

4) CLICKS WITH NO FEEDBACK UNTIL THE SERVER RENDERS
   components/messages/DealChatPanel.tsx
   - handlePay() ("Pay Now" in the deal chat) already had a `ctaBusy`
     state wired into the button's "Processing…" / disabled display, but
     nothing ever actually set it to true. Now it does, so tapping Pay
     Now shows instant feedback instead of silence while the checkout
     route loads.
   components/profile/MyProfileHub.tsx
   - The "Messages & Deals" button had the same problem: nothing
     indicated a tap had registered before /messages appeared. Added a
     `navigatingToInbox` state that swaps the button's icon for a
     spinner and disables it the instant it's clicked.
   app/globals-snippet-pm-inbox-btn.css
   - Two small CSS rules needed for the spinner above (disabled state +
     spin animation, reusing the existing dcpSpin keyframes). See that
     file's own instructions for exactly where to paste it into your
     real globals.css.

5) SELLER PROFILE & CHECKOUT: BLANK/FOOTER-FIRST RENDER INSTEAD OF A
   MATCHING SKELETON
   Root cause: neither /seller/[id] nor /messages (and its sub-routes)
   had their own loading.tsx, so Next fell back to the generic
   app/loading.tsx (SiteriftyLoader) — which is shaped like the
   marketplace grid (nav+search+banner+cards). That shape has nothing to
   do with a seller profile or a checkout page, so the page would show
   the wrong skeleton, then "pop" into the real layout — visible as the
   footer flashing on top before real content replaced it.

   New/changed files:
   - app/seller/[id]/loading.tsx (NEW)
       Renders the seller page's own existing loading skeleton.
   - app/seller/[id]/SellerProfileClient.tsx
       Extracted the inline sp-loading skeleton markup into an exported
       `SellerProfileSkeleton` component (used by both the client
       component's own loading state AND the new loading.tsx above, so
       there's exactly one copy of this markup instead of two).
   - components/messages/CheckoutRoute.tsx
       Exported a new `CheckoutRouteSkeleton` component (same
       two-column shape as the real checkout, built from the shared
       .skel-block shimmer class), and swapped the old
       `if (!chat.room) return null;` for this skeleton instead of a
       blank screen.
   - app/messages/deal/[id]/checkout/loading.tsx (NEW)
       Route-level loading.tsx using CheckoutRouteSkeleton.
   - components/messages/InboxShell.tsx
       Extracted an exported `InboxShellSkeleton` component (header +
       tabs + the same skeleton rows InboxShell already shows once
       mounted), so the shell shows immediately rather than only after
       InboxShell's own JS mounts.
   - app/messages/page.tsx
       Suspense fallback now uses InboxShellSkeleton instead of the
       mismatched SiteriftyLoader.
   - app/messages/loading.tsx (NEW)
       Route-level loading.tsx for /messages and everything under it
       (deal, checkout — which has its own more specific one above —
       transfer, group) using InboxShellSkeleton.

HOW TO APPLY
============
Extract this zip into the ROOT of your project (the folder containing
your app/ and components/ folders) — paths mirror your project
structure. Then:

  1. Overwrite every .tsx file at its matching path.
  2. Open app/globals-snippet-pm-inbox-btn.css, follow the instructions
     inside it to paste its two rules into your real app/globals.css,
     then delete that snippet file — it isn't imported by the app.
  3. The three loading.tsx files are brand new — just make sure they
     land in the exact folders shown (they won't overwrite anything).

Nothing here touches the actual payment/escrow logic (still not live —
see PAY_LIVE in CheckoutRoute.tsx) or wallet currency (still real USD
balances) — only what's displayed and how quickly feedback appears.
