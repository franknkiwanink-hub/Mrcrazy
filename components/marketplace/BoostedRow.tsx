// Ports _mpRenderBoostedRow from marketplace.js — a teaser section shown
// above the main grid, grouping currently-boosted listings by type
// (website/app/game never mixed, since the three card shapes differ
// structurally). A type's group only renders if it actually has boosted
// listings; if none exist at all across every type, the whole row is
// omitted. Reuses ListingCard so a boosted card here is pixel-identical
// to its counterpart in the main grid.
import type { Listing, ListingType } from "@/lib/listings";
import { isBoosted } from "@/lib/listings";
import ListingCard from "./ListingCard";

const FLAME_SVG = (
  <svg viewBox="0 0 24 24" fill="currentColor" width={14} height={14}>
    <path d="M12.5 1.5c.4 2.6-.6 4.3-2 5.8-1.7 1.8-3.5 3.6-3.5 6.7 0 3.6 2.9 6.5 6.5 6.5 3.4 0 6.2-2.6 6.5-5.9.3-3.4-1.6-5.9-3.3-7.8-.4-.5-1.1-.2-1 .4.4 2-.2 3.3-1.1 4.2-.2.2-.5.1-.6-.1-.7-1.6-.6-3.5.1-5.2.7-1.6.9-3.2-.6-4.6-.3-.3-.8-.2-.9.2-.2.7-.5 1.4-1.1 1.9-1.1 1-2.4 2.1-2.4 4 0 1.1.5 2 1.2 2.7.2.2 0 .6-.3.5-1.6-.5-2.7-2-2.5-3.7C7.7 4.9 9.6 2.9 12.5 1.5z" />
  </svg>
);

const BOOSTED_ROW_MAX_PER_TYPE = 6; // teaser cap, not the full pool
const FEED_TYPE_ORDER: ListingType[] = ["website", "app", "game"];
const TYPE_LABELS: Record<ListingType, string> = {
  website: "Boosted sites",
  app: "Boosted apps",
  game: "Boosted games",
};

export default function BoostedRow({
  listings,
  onOpen,
  onOpenSeller,
}: {
  listings: Listing[];
  onOpen: (listing: Listing) => void;
  onOpenSeller: (ownerId: string | undefined, listing: Listing) => void;
}) {
  const groups: Record<ListingType, Listing[]> = { website: [], app: [], game: [] };
  for (const listing of listings) {
    if (!isBoosted(listing)) continue;
    const t = (listing.type || "website") as ListingType;
    if (groups[t] && groups[t].length < BOOSTED_ROW_MAX_PER_TYPE) groups[t].push(listing);
  }

  const nonEmptyTypes = FEED_TYPE_ORDER.filter((t) => groups[t].length);
  if (!nonEmptyTypes.length) return null;

  return (
    <div id="mpBoostedRow">
      {nonEmptyTypes.map((t) => (
        <div className="mp-boosted-group" key={t}>
          <div className="mp-boosted-group-title">
            {FLAME_SVG}
            <span>{TYPE_LABELS[t]}</span>
          </div>
          <div className={`mp-boosted-grid mp-boosted-grid-${t}`}>
            {groups[t].map((listing) => (
              <ListingCard key={listing.id} listing={listing} onOpen={onOpen} onOpenSeller={onOpenSeller} />
            ))}
          </div>
        </div>
      ))}
    </div>
  );
}
