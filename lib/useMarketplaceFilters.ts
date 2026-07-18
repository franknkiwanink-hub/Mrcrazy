"use client";

// Ports the filter state + mpApplyAndRender's filter predicate from
// marketplace.js. Type filtering is passed through to the server (see
// useFeed's `type` param / handleFeed's activeTypes) exactly like the
// original passes mpTypeFilter into /api/listings — everything else
// (template/price) is client-side only in the original too, since
// handleFeed has no template/price params at all.
import { useCallback, useMemo, useState } from "react";
import type { Listing, ListingType } from "@/lib/listings";

export type TemplateFilter = "all" | "template" | "not-template";

export interface MarketplaceFilters {
  typeFilter: ListingType | "all";
  templateFilter: TemplateFilter;
  priceMin: number;
  priceMax: number | null;
}

// FALLBACK_PRICE_CAP is used only until useLimits() resolves the live value
// from GET /api/limits (app/api/_lib/limits.js's LIMITS.marketplace.priceCap
// / LIMITS.listing.priceMax — both mirror the same 10000 cap). This constant
// can't itself be the hook-derived live value since it's a module-level
// export consumed outside any component (this file has no JSX) — the actual
// live value is read via useLimits() in MarketplaceFilterBar.tsx, which is
// the only consumer that needs it.
export const FALLBACK_PRICE_CAP = 10000;

export interface ActiveTag {
  label: string;
  clear: () => void;
}

// Module-level cache, same rationale as useFeed's feedCache: MarketplaceGrid
// unmounts/remounts on navigation to/from /listing/[id] (a real route, not
// a modal), so component-local useState alone loses the user's filter and
// search selections on every "back" navigation. Persisting them here keeps
// the marketplace feeling like it never left, matching the original's
// single always-mounted overlay.
interface FiltersCacheEntry {
  typeFilter: ListingType | "all";
  templateFilter: TemplateFilter;
  priceMin: number;
  priceMax: number | null;
  searchQuery: string;
}
let filtersCache: FiltersCacheEntry | null = null;

export function useMarketplaceFilters() {
  const [typeFilter, setTypeFilterState] = useState<ListingType | "all">(filtersCache?.typeFilter ?? "all");
  const [templateFilter, setTemplateFilterState] = useState<TemplateFilter>(filtersCache?.templateFilter ?? "all");
  const [priceMin, setPriceMinState] = useState(filtersCache?.priceMin ?? 0);
  const [priceMax, setPriceMaxState] = useState<number | null>(filtersCache?.priceMax ?? null);
  // Mirrors mpSearchQuery — trimmed/lowercased in the input handler, not
  // here, same as the original. Deliberately excluded from mpUpdateActiveTags
  // / activeTags below (confirmed: search never appears as an active-filter
  // chip in the original).
  const [searchQuery, setSearchQueryState] = useState(filtersCache?.searchQuery ?? "");

  // Keep the cache in sync with every change so the next mount (after a
  // navigate-away-and-back) rehydrates from the latest values.
  const syncCache = useCallback((patch: Partial<FiltersCacheEntry>) => {
    filtersCache = {
      typeFilter: filtersCache?.typeFilter ?? "all",
      templateFilter: filtersCache?.templateFilter ?? "all",
      priceMin: filtersCache?.priceMin ?? 0,
      priceMax: filtersCache?.priceMax ?? null,
      searchQuery: filtersCache?.searchQuery ?? "",
      ...patch,
    };
  }, []);

  const setTypeFilter = useCallback(
    (v: ListingType | "all") => {
      setTypeFilterState(v);
      syncCache({ typeFilter: v });
    },
    [syncCache]
  );
  const setTemplateFilter = useCallback(
    (v: TemplateFilter) => {
      setTemplateFilterState(v);
      syncCache({ templateFilter: v });
    },
    [syncCache]
  );
  const setSearchQuery = useCallback(
    (v: string) => {
      setSearchQueryState(v);
      syncCache({ searchQuery: v });
    },
    [syncCache]
  );

  const clearType = useCallback(() => setTypeFilter("all"), [setTypeFilter]);
  const clearTemplate = useCallback(() => setTemplateFilter("all"), [setTemplateFilter]);
  const clearPrice = useCallback(() => {
    setPriceMinState(0);
    setPriceMaxState(null);
    syncCache({ priceMin: 0, priceMax: null });
  }, [syncCache]);

  const fmt = (n: number) =>
    Number.isInteger(n) ? n.toLocaleString() : n.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 });

  const activeTags: ActiveTag[] = useMemo(() => {
    const tags: ActiveTag[] = [];
    if (typeFilter !== "all") {
      tags.push({ label: `Type: ${typeFilter}`, clear: clearType });
    }
    if (templateFilter !== "all") {
      tags.push({
        label: templateFilter === "template" ? "Templates only" : "Full products",
        clear: clearTemplate,
      });
    }
    if (priceMin > 0 || priceMax !== null) {
      const hMin = priceMin > 0;
      const hMax = priceMax !== null;
      let label: string;
      if (hMin && hMax) label = `Price: $${fmt(priceMin)} – $${fmt(priceMax as number)}`;
      else if (hMin) label = `Price: $${fmt(priceMin)}+`;
      else label = `Price: up to $${fmt(priceMax as number)}`;
      tags.push({ label, clear: clearPrice });
    }
    return tags;
  }, [typeFilter, templateFilter, priceMin, priceMax, clearType, clearTemplate, clearPrice]);

  // Client-side portion of mpApplyAndRender's filter chain — template,
  // price, and now search (ported verbatim from mpApplyAndRender's
  // mpSearchQuery filter: title/description/type substring match). Type
  // itself is still applied server-side via useFeed's `type` param.
  const applyClientFilters = useCallback(
    (listings: Listing[]) => {
      let f = listings;
      if (templateFilter === "template") f = f.filter((l) => l.isTemplate === true);
      else if (templateFilter === "not-template") f = f.filter((l) => !l.isTemplate);
      if (priceMin > 0 || priceMax !== null) {
        f = f.filter((l) => {
          const p = l.financials?.price;
          if (typeof p !== "number") return false;
          if (priceMin > 0 && p < priceMin) return false;
          if (priceMax !== null && p > priceMax) return false;
          return true;
        });
      }
      if (searchQuery) {
        f = f.filter(
          (l) =>
            (l.title || "").toLowerCase().includes(searchQuery) ||
            (l.description || "").toLowerCase().includes(searchQuery) ||
            (l.type || "").toLowerCase().includes(searchQuery)
        );
      }
      return f;
    },
    [templateFilter, priceMin, priceMax, searchQuery]
  );

  return {
    typeFilter,
    setTypeFilter,
    templateFilter,
    setTemplateFilter,
    priceMin,
    priceMax,
    setPriceRange: (min: number, max: number | null) => {
      setPriceMinState(min);
      setPriceMaxState(max);
      syncCache({ priceMin: min, priceMax: max });
    },
    searchQuery,
    setSearchQuery,
    activeTags,
    applyClientFilters,
  };
}
