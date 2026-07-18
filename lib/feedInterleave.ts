// Ports the ad/promo cadence logic from marketplace.js's mpRenderCards —
// _mpShouldShowSellerPromo, _mpShouldShowAiPromo, and the AD_CADENCE
// modulo checks. The original counts listings "since reset" across the
// whole session (not restarted each "load more" batch) so the rhythm
// continues seamlessly on infinite scroll; this is reproduced here by
// taking a running `startCount` (how many real listing cards have
// already been rendered before this call) rather than always starting
// from 0.

export type FeedItem =
  | { kind: "listing"; id: string }
  | { kind: "ad"; id: string; adKind: "rect" | "banner" }
  | { kind: "seller-promo"; id: string }
  | { kind: "ai-promo"; id: string };

const AD_CADENCE = { rect: 8, banner: 4 };

// First seller-promo card at listing #5, then every 15 after that
// (5, 20, 35, 50, ...) — an explicit two-part rule (first interval differs
// from repeat interval), not a single modulo.
const SELLER_PROMO_FIRST = 5;
const SELLER_PROMO_REPEAT = 15;
function shouldShowSellerPromo(count: number): boolean {
  if (count < SELLER_PROMO_FIRST) return false;
  return (count - SELLER_PROMO_FIRST) % SELLER_PROMO_REPEAT === 0;
}

// First AI-tools promo card at listing #10, then every 20 after that
// (10, 30, 50, 70, ...) — same two-part shape, independent counter.
const AI_PROMO_FIRST = 10;
const AI_PROMO_REPEAT = 20;
function shouldShowAiPromo(count: number): boolean {
  if (count < AI_PROMO_FIRST) return false;
  return (count - AI_PROMO_FIRST) % AI_PROMO_REPEAT === 0;
}

// Builds the full interleaved feed (listing cards + seller-promo/AI-promo
// cards + ad slots) for a full listing-id array, counting from 0 — used
// whenever the grid does a full reset (filter/search change, retry).
// `listingIds` should be in the exact order they'll be rendered.
export function buildInterleavedFeed(listingIds: string[]): FeedItem[] {
  return buildInterleavedFeedFrom(listingIds, 0);
}

// Same as above but continuing a running count — used when appending a
// "load more" batch, so the ad/promo rhythm doesn't restart at 0 for
// every page.
export function buildInterleavedFeedFrom(listingIds: string[], startCount: number): FeedItem[] {
  const out: FeedItem[] = [];
  let count = startCount;
  for (const id of listingIds) {
    out.push({ kind: "listing", id });
    count++;

    if (shouldShowSellerPromo(count)) {
      out.push({ kind: "seller-promo", id: `promo-seller-${count}` });
    }
    if (shouldShowAiPromo(count)) {
      out.push({ kind: "ai-promo", id: `promo-ai-${count}` });
    }

    if (count % AD_CADENCE.rect === 0) {
      out.push({ kind: "ad", adKind: "rect", id: `ad-rect-${count}` });
    } else if (count % AD_CADENCE.banner === 0) {
      out.push({ kind: "ad", adKind: "banner", id: `ad-banner-${count}` });
    }
  }
  return out;
}
