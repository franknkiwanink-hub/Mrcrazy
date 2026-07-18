"use client";

// New feature (no legacy equivalent — see lib/useRecentSearches.ts's
// comment). Reuses MarketplaceSearchBar's existing match-scoring
// (startsWith=100 / includes=80 / type=60 / desc=40) and highlight-first-
// match logic rather than re-implementing it, so results here are
// identical to what the old small popover showed — this only changes the
// *presentation* (full-screen takeover, YouTube-style recent-searches
// list) and *persistence* (localStorage history), not the matching
// behavior. Driven entirely by the same `searchQuery` React state
// MarketplaceFilterBar already threads down to useMarketplaceFilters —
// opening/closing/typing here never navigates or refetches, same as the
// small popover it replaces.
import { useEffect, useRef, useState } from "react";
import type { Listing } from "@/lib/listings";
import { useRecentSearches } from "@/lib/useRecentSearches";

interface Suggestion {
  listing: Listing;
  title: string;
  type: string;
  score: number;
}

function highlight(text: string, q: string) {
  const i = text.toLowerCase().indexOf(q.toLowerCase());
  if (i === -1) return text;
  return (
    <>
      {text.slice(0, i)}
      <mark>{text.slice(i, i + q.length)}</mark>
      {text.slice(i + q.length)}
    </>
  );
}

const TYPE_COLOR: Record<string, string> = {
  website: "#60a5fa",
  app: "#a78bfa",
  game: "#f59e0b",
};

export default function SearchOverlay({
  open,
  listings,
  initialQuery,
  onClose,
  onSearchChange,
  onOpenListing,
}: {
  open: boolean;
  listings: Listing[];
  initialQuery: string;
  onClose: () => void;
  onSearchChange: (q: string) => void;
  onOpenListing: (listing: Listing) => void;
}) {
  const [value, setValue] = useState(initialQuery);
  const inputRef = useRef<HTMLInputElement>(null);
  const { items: recent, add: addRecent, remove: removeRecent, clear: clearRecent } = useRecentSearches();

  // Autofocus the input the moment the overlay mounts, same as tapping
  // YouTube's search bar drops you straight into a focused, keyboard-up
  // input rather than a still-blurred one.
  useEffect(() => {
    if (open) {
      setValue(initialQuery);
      const t = setTimeout(() => inputRef.current?.focus(), 30);
      return () => clearTimeout(t);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open]);

  // Lock background scroll while the overlay is up — a full-screen
  // takeover shouldn't let the marketplace grid scroll underneath it.
  useEffect(() => {
    if (!open) return;
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = prev;
    };
  }, [open]);

  useEffect(() => {
    if (!open) return;
    function onKeyDown(e: KeyboardEvent) {
      if (e.key === "Escape") handleClose();
    }
    document.addEventListener("keydown", onKeyDown);
    return () => document.removeEventListener("keydown", onKeyDown);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, value]);

  if (!open) return null;

  const q = value.trim().toLowerCase();

  const matches: Suggestion[] = q
    ? listings
        .map((l) => {
          const title = l.title || "Untitled";
          const type = l.type || "website";
          const desc = l.description || "";
          const tl = title.toLowerCase();
          let score = -1;
          if (tl.startsWith(q)) score = 100;
          else if (tl.includes(q)) score = 80;
          else if (type.toLowerCase().includes(q)) score = 60;
          else if (desc.toLowerCase().includes(q)) score = 40;
          return { listing: l, title, type, score };
        })
        .filter((m) => m.score >= 0)
        .sort((a, b) => b.score - a.score)
        .slice(0, 20)
    : [];

  function commitSearch(term: string) {
    const trimmed = term.trim();
    if (!trimmed) return;
    addRecent(trimmed);
    onSearchChange(trimmed.toLowerCase());
    handleClose();
  }

  function handleClose() {
    onClose();
  }

  function handleClear() {
    setValue("");
    inputRef.current?.focus();
  }

  return (
    <div id="mpSearchOverlay" className="active" role="dialog" aria-modal="true" aria-label="Search listings">
      <div className="mp-so-header">
        <button
          className="mp-so-back"
          aria-label="Close search"
          onClick={handleClose}
        >
          <svg width={20} height={20} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2.4}>
            <line x1={19} y1={12} x2={5} y2={12} />
            <polyline points="12 19 5 12 12 5" />
          </svg>
        </button>
        <div className="mp-so-input-wrap">
          <input
            ref={inputRef}
            type="text"
            id="mpSearchOverlayInput"
            placeholder="Search listings…"
            autoComplete="off"
            value={value}
            onChange={(e) => setValue(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter") commitSearch(value);
            }}
          />
          {value ? (
            <button className="mp-so-clear" aria-label="Clear" onClick={handleClear}>
              <svg width={12} height={12} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2.8}>
                <line x1={18} y1={6} x2={6} y2={18} />
                <line x1={6} y1={6} x2={18} y2={18} />
              </svg>
            </button>
          ) : null}
        </div>
      </div>

      <div className="mp-so-body">
        {!q ? (
          recent.length ? (
            <>
              <div className="mp-so-section-head">
                <span>Recent searches</span>
                <button className="mp-so-clear-all" onClick={clearRecent}>
                  Clear all
                </button>
              </div>
              <div className="mp-so-list">
                {recent.map((term) => (
                  <button key={term} className="mp-so-row" onClick={() => commitSearch(term)}>
                    <svg className="mp-so-row-icon" width={18} height={18} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2}>
                      <circle cx={12} cy={12} r={9} />
                      <polyline points="12 7 12 12 15 14" />
                    </svg>
                    <span className="mp-so-row-text">{term}</span>
                    <span
                      className="mp-so-row-remove"
                      role="button"
                      aria-label={`Remove ${term} from recent searches`}
                      onClick={(e) => {
                        e.stopPropagation();
                        removeRecent(term);
                      }}
                    >
                      <svg width={14} height={14} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2.4}>
                        <line x1={18} y1={6} x2={6} y2={18} />
                        <line x1={6} y1={6} x2={18} y2={18} />
                      </svg>
                    </span>
                  </button>
                ))}
              </div>
            </>
          ) : (
            <div className="mp-so-empty">
              <svg width={40} height={40} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.6}>
                <circle cx={11} cy={11} r={8} />
                <line x1={21} y1={21} x2="16.65" y2="16.65" />
              </svg>
              <span>Search listings by title, type, or description</span>
            </div>
          )
        ) : matches.length ? (
          <div className="mp-so-list">
            {matches.map((m) => {
              const price = m.listing.financials?.price;
              const priceStr = typeof price === "number" ? `$${price.toLocaleString()}` : "—";
              const tc = TYPE_COLOR[m.type] || "#34d399";
              return (
                <button
                  key={m.listing.id}
                  className="mp-so-row mp-so-result"
                  onClick={() => {
                    addRecent(value);
                    onOpenListing(m.listing);
                    handleClose();
                  }}
                >
                  <span className="mp-so-result-dot" style={{ background: tc }} />
                  <span className="mp-so-row-text">
                    <span className="mp-so-result-title">{highlight(m.title, q)}</span>
                    <span className="mp-so-result-sub">{m.type}</span>
                  </span>
                  <span className="mp-so-result-price">{priceStr}</span>
                </button>
              );
            })}
            <button className="mp-so-see-all" onClick={() => commitSearch(value)}>
              See all results for &quot;{value}&quot;
            </button>
          </div>
        ) : (
          <div className="mp-so-empty">
            <svg width={40} height={40} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.6}>
              <line x1={18} y1={6} x2={6} y2={18} />
              <line x1={6} y1={6} x2={18} y2={18} />
            </svg>
            <span>No matches for &quot;{value}&quot;</span>
          </div>
        )}
      </div>
    </div>
  );
}
