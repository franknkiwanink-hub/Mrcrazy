FIXES — deploy to the SAME relative path, overwrite the originals.

1) STOP BOOST "Unknown action"
   app/api/listings/_handler.js
   This file already has `case 'listing.unboost': ...` wired into the
   action switch. If your live server is throwing "Unknown action" for
   it, your deployed copy of this file is out of date — this is the
   root cause, not a new bug. Redeploying this exact file resolves it.
   (Client-side code that calls it — lib/listings.ts, MyProfileHub.tsx,
   SellerDashboard.tsx — was already correct from the earlier fix and
   doesn't need to change again.)

2) UNEVEN CARD HEIGHTS in the horizontal "Listings you might like" rail
   app/styles/discover-panel.css
   Rail items were sized to their own content (flex: 0 0 auto with no
   stretch), so an app card and a game card with different amounts of
   content ended up different heights, jamming together unevenly. Now
   every card in a row stretches to match the tallest card in that row,
   same as the old CSS-grid layout used to do automatically.
