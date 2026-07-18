"use client";

import { useEffect, useRef } from "react";
import type { Listing } from "@/lib/listings";
import { isBoosted, isPremiumSeller, trackListing } from "@/lib/listings";
import { useCurrency } from "@/lib/CurrencyContext";
import SellerStrip from "./SellerStrip";
import SaveButton from "./SaveButton";

const PLACEHOLDER_MAIN = "https://placehold.co/1280x720/0d0d14/444?text=No+Preview";

export default function SiteCard({
  listing,
  onOpen,
  onOpenSeller,
}: {
  listing: Listing;
  onOpen: (listing: Listing) => void;
  onOpenSeller: (ownerId: string | undefined, listing: Listing) => void;
}) {
  const fin = listing.financials || {};
  const title = listing.title || "Untitled";
  const desc = listing.description || "";
  // Asking price is the one figure a buyer actually pays, so it's the
  // only one shown in the selected display currency — revenue/expenses/
  // profit below stay in USD (they're performance metrics being reported
  // on, not an amount anyone is being charged). Short form (no "(≈ $X
  // USD)" suffix) to fit the card's fixed-width price slot; the full USD
  // figure is still available via the title tooltip.
  const { formatPriceShort } = useCurrency();
  const price = formatPriceShort(fin.price);
  const priceTooltip = typeof fin.price === "number" ? `$${fin.price.toLocaleString()} USD` : undefined;
  const sellerHandle = listing.ownerEmail?.split("@")[0] || "Anonymous";

  const mainImg = listing.images?.[2] || listing.imageCover || listing.images?.[0] || PLACEHOLDER_MAIN;
  const subImg1 = listing.images?.[0] || "";
  const subImg2 = listing.images?.[1] || "";
  const revenue = typeof fin.revenue === "number" ? `$${fin.revenue.toLocaleString()}` : "—";
  const expenses = typeof fin.expenses === "number" ? `$${fin.expenses.toLocaleString()}` : "—";
  const profit = typeof fin.profit === "number" ? fin.profit : null;
  const profitStr = profit !== null ? `$${Math.abs(profit).toLocaleString()}` : "—";
  const profitCls = profit !== null ? (profit >= 0 ? "sr-pos" : "sr-neg") : "";
  const tech = listing.tech || {};
  const techStr = [tech.frontend, tech.backend, tech.database, tech.monetization].filter(Boolean).slice(0, 3).join(" · ");

  const cardRef = useRef<HTMLDivElement>(null);
  useEffect(() => {
    // Per-card impression observer — fires once when scrolled into view,
    // mirrors _mpObserveImpression.
    const el = cardRef.current;
    if (!el || !listing.id || !("IntersectionObserver" in window)) return;
    const io = new IntersectionObserver(
      (entries) => {
        if (entries[0].isIntersecting) {
          io.disconnect();
          trackListing("listing.impression", listing.id);
        }
      },
      { threshold: 0.5 }
    );
    io.observe(el);
    return () => io.disconnect();
  }, [listing.id]);

  const className = "sr-site" + (isBoosted(listing) ? " sr-boosted" : "") + (isPremiumSeller(listing) ? " sr-premium-shimmer" : "");

  return (
    <div ref={cardRef} className={className} data-type="website">
      <div className="sr-site-media">
        <div className="sr-site-media-main">
          <img
            src={mainImg}
            alt={title}
            loading="lazy"
            onError={(e) => {
              e.currentTarget.src = PLACEHOLDER_MAIN;
            }}
          />
          <div className="sr-site-tag">Site{listing.isTemplate ? " · Template" : ""}</div>
        </div>
        <div className="sr-site-media-sub">
          <div className="sr-site-media-thumb">
            {subImg1 ? (
              <img
                src={subImg1}
                alt={`${title} screenshot 2`}
                loading="lazy"
                onError={(e) => {
                  e.currentTarget.style.visibility = "hidden";
                }}
              />
            ) : null}
          </div>
          <div className="sr-site-media-thumb">
            {subImg2 ? (
              <img
                src={subImg2}
                alt={`${title} screenshot 3`}
                loading="lazy"
                onError={(e) => {
                  e.currentTarget.style.visibility = "hidden";
                }}
              />
            ) : null}
          </div>
        </div>
      </div>
      <div className="sr-site-main">
        <div className="sr-site-headline">
          <h3 className="sr-site-title">{title}</h3>
          <div className="sr-site-price" title={priceTooltip}>{price}</div>
        </div>
        <p className="sr-site-desc">
          {desc.slice(0, 110)}
          {desc.length > 110 ? "…" : ""}
        </p>
        <div className="sr-site-stats">
          <div className="sr-stat">
            <span className="sr-stat-k">Revenue</span>
            <span className="sr-stat-v">{revenue}</span>
          </div>
          <div className="sr-stat">
            <span className="sr-stat-k">Expenses</span>
            <span className="sr-stat-v">{expenses}</span>
          </div>
          <div className="sr-stat">
            <span className="sr-stat-k">Profit</span>
            <span className={`sr-stat-v ${profitCls}`}>{profitStr}</span>
          </div>
        </div>
        {techStr ? <div className="sr-site-tech">{techStr}</div> : null}
        <div className="sr-site-foot">
          <SellerStrip ownerId={listing.ownerId} fallbackHandle={sellerHandle} />
          <div className="sr-site-actions">
            <SaveButton listing={listing} />
            <button
              className="sr-ghost-btn"
              onClick={(e) => {
                e.stopPropagation();
                onOpenSeller(listing.ownerId, listing);
              }}
            >
              Seller
            </button>
            <button
              className="sr-btn sr-btn-site"
              onClick={(e) => {
                e.stopPropagation();
                onOpen(listing);
              }}
            >
              Open site
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
