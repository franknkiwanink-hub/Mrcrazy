import type { MetadataRoute } from "next";
import { getPublicBaseUrl } from "@/lib/server/adminDb";

// Converted from the static public/robots.txt so the Sitemap: line always
// matches the deployed origin (PUBLIC_BASE_URL / VERCEL_URL) instead of
// being hardcoded to siterifty.com — same rule set, unchanged, just
// generated. A static public/robots.txt and this file can't coexist
// (Next.js build-time conflict), so the static file has been removed.
export default function robots(): MetadataRoute.Robots {
  const baseUrl = getPublicBaseUrl();

  return {
    rules: {
      userAgent: "*",
      allow: ["/", "/listing/", "/seller/", "/leaderboard", "/marketplace", "/about", "/contact", "/help", "/terms"],
      // Auth-gated app sections — a crawler can't sign in, so these just
      // hit a login wall. No SEO value in indexing them, and disallowing
      // keeps crawl budget on the public pages above. Note /sellers
      // (plural, the browse/directory page) is disallowed while
      // /seller/ (singular, individual profiles) is allowed above —
      // that distinction is intentional, carried over as-is.
      disallow: ["/settings", "/myprofile", "/profile", "/messages", "/aiagent", "/sell", "/sellers"],
    },
    sitemap: `${baseUrl}/sitemap.xml`,
  };
}
