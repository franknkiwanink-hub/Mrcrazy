FIXES — deploy to the SAME relative path, overwrite the originals.

1) HOME LINK in hamburger sidebar
   components/layout/NavDrawer.tsx
   Added "Home" at the top of the Browse section, linking to "/".
   Also added "/" to the drawer's route-prefetch list.

2) DISCOVER SCROLL POSITION on Back
   components/layout/ScrollToTop.tsx
   Discover has 3 tall horizontal rails now (blogs/listings/sellers),
   so scrolling down the page to reach "Sellers to check out" and then
   tapping into a seller meant the app correctly remembered you were
   near the bottom — and restored you there on Back, which looked like
   "it dumps me at the footer."
   Discover is now a special case: Back from Discover always resets to
   the very top, regardless of where you scrolled before navigating
   away. Every other page keeps the normal "return to where you were"
   behavior.
