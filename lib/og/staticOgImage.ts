import { getPublicBaseUrl } from "@/lib/server/adminDb";

// Static (pre-rendered) share-preview image, used in place of the
// dynamic next/og opengraph-image.tsx route for pages whose preview
// art doesn't change per-request. Returns absolute-URL image blocks
// for both openGraph.images and twitter.images so a page's
// generateMetadata can just spread the result in.
export function staticOgImage(path: string, alt: string) {
  const url = `${getPublicBaseUrl()}${path}`;
  const image = { url, width: 1200, height: 630, alt };
  return {
    openGraphImages: [image],
    twitterImages: [url],
  };
}

export const MARKETPLACE_OG_IMAGE = "/og/marketplace.jpg";
export const SUPPORT_OG_IMAGE = "/og/support.jpg";
