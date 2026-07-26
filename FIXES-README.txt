2 FIXES — drop these into your project at the same paths, overwriting the existing files.

1) HAMBURGER SIDEBAR COULDN'T SCROLL
   - components/layout/NavDrawer.tsx
     Root cause: the app-wide scroll lock (lib/useScrollLock.ts) blocks
     touchmove everywhere on the page while any modal/drawer is open,
     except on elements marked data-scroll-lock-exempt. The drawer's own
     scrollable content area (#navScrollBody) was never given that
     exemption, so on touch devices you couldn't drag-scroll the menu at
     all — the background page was correctly locked, but so was the menu
     itself. Added data-scroll-lock-exempt to #navScrollBody, same
     pattern already used for other in-app modals with scrollable
     content.

2) HOW IT WORKS PAGE — STEP 3 WAS FACTUALLY WRONG
   - app/how-it-works/page.tsx
     Step 3 said the buyer "pays from their Siterifty wallet" straight
     into escrow. That's not how payment actually works — buyers pay at
     the dedicated checkout page (/messages/deal/[id]/checkout), not by
     debiting their wallet balance. Reworded to say the buyer goes to
     checkout to pay, which now matches both the Escrow & Payments page
     and the real checkout flow in the code.
