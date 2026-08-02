FIX — deploy to the SAME relative path, overwrite the original.

app/styles/discover-panel.css

WHAT CHANGED

1) Cards getting cropped mid-scroll on Discover
   The rail sat inside the section's own left/right padding with no
   scroll gutter, so a card scrolling into view got hard-clipped right
   at that padding edge instead of showing a clean peek. Fixed by
   letting the rail bleed to the full viewport width and re-adding the
   padding inside itself as scroll room, so cards now peek in/out
   smoothly instead of being sliced off.

2) Listings of different types (app/game/site) having different card
   heights in the same row
   Site/App/Game cards each use a different internal template — a
   fixed-size icon block, a 21:9 media banner, plain text — so simply
   stretching the outer wrapper (align-self: stretch) couldn't make
   them match; the fixed-ratio pieces inside don't reshape just
   because their container got taller. Rail items now get a fixed
   height (360px, 330px on very narrow screens) and every card
   template already pins its footer/CTA to the bottom via
   margin-top: auto and clips extra content with overflow: hidden —
   same as they already do inside the regular grid — so every card in
   a row now lines up evenly regardless of listing type.
