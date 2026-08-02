FIXES INCLUDED — deploy each file to the SAME relative path in your project.

1) BOOST STOP — real error now surfaces instead of generic message
   components/profile/MyProfileHub.tsx
   components/dashboard/SellerDashboard.tsx

2) DISCOVER PAGE — 3 independent horizontal-scroll rails (blogs / listings
   / sellers), each with its own "View all" / "View more" link, higher
   item limits (blogs 15, sellers 10, listings 12)
   app/api/listings/_handler.js         (server: limits)
   app/discover/DiscoverPageClient.tsx  (routed /discover page)
   components/marketplace/DiscoverPanel.tsx  (in-app takeover panel)
   app/styles/discover-panel.css        (rail CSS)

Just copy these files into your project at matching paths, overwriting
the originals. No other files were touched.
