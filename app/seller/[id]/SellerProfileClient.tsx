"use client";

import { useEffect, useState } from "react";
import { useAuth } from "@/lib/AuthContext";
import { fetchFullSeller, fetchSellerDealStats, type FullSeller, type SellerDealStats } from "@/lib/useSeller";
import SellerProfileHeader from "@/components/seller/SellerProfileHeader";
import SellerListingsGrid from "@/components/seller/SellerListingsGrid";
import SellerDetailsOverlay from "@/components/seller/SellerDetailsOverlay";
import RateOverlay from "@/components/seller/RateOverlay";
import DonateOverlay from "@/components/seller/DonateOverlay";

// Unchanged from the old page.tsx's body — this is still the full
// client-side interactive profile (auth-aware isOwnProfile check,
// privacy gates for human visitors, overlays). What moved is only the
// outer shell: page.tsx is now a Server Component that handles
// generateMetadata + notFound() for crawlers/SSR, and renders this
// component for the actual interactive UI, same as the old page did
// for every visitor before.
export default function SellerProfileClient({ uid }: { uid: string }) {
  const { user } = useAuth();

  const [seller, setSeller] = useState<FullSeller | null>(null);
  const [notFoundState, setNotFoundState] = useState(false);
  const [dealStats, setDealStats] = useState<SellerDealStats | null>(null);
  const [detailsOpen, setDetailsOpen] = useState(false);
  const [rateOpen, setRateOpen] = useState(false);
  const [donateOpen, setDonateOpen] = useState(false);

  const isOwnProfile = !!user && user.uid === uid;

  useEffect(() => {
    if (!uid) return;
    let cancelled = false;
    setSeller(null);
    setNotFoundState(false);
    setDealStats(null);
    (async () => {
      const s = await fetchFullSeller(uid);
      if (cancelled) return;
      if (!s) {
        setNotFoundState(true);
        return;
      }
      setSeller(s);

      // Deal stats load separately, after the main profile paints —
      // mirrors spLoadSellerStats being called after the rest of
      // mpOpenSellerModal finishes rendering.
      fetchSellerDealStats(uid).then((stats) => {
        if (!cancelled) setDealStats(stats);
      });
    })();

    // Profile-view beacon — fire-and-forget, mirrors deal.js's
    // record-profile-view action.
    fetch("/api/deal", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action: "record-profile-view", sellerUid: uid }),
    }).catch((err) => console.error("[SellerProfileClient] profile view beacon", err.message));

    return () => {
      cancelled = true;
    };
  }, [uid]);

  if (notFoundState) {
    return (
      <div style={{ marginTop: 92, padding: "40px 24px 80px", textAlign: "center", color: "#fff" }}>
        <h1>Seller not found</h1>
      </div>
    );
  }

  if (!seller) {
    // Matches the original's .sp-loading skeleton state — CSS-driven
    // shimmer already exists for #spModal.sp-loading in globals.css.
    return (
      <div id="spModal" className="active sp-loading" style={{ position: "static", marginTop: 92 }}>
        <div id="spModalInner">
          <div id="spModalCover" />
          <div id="spModalMain">
            <div id="spModalAvatarRow">
              <div id="spModalAv">?</div>
            </div>
            <div id="spModalNameInfo">
              <div id="spModalNameSkelRow">
                <span className="sp-skel sp-skel-name" />
                <span className="sp-skel sp-skel-handle" />
              </div>
              <div id="spModalBioSkelRow">
                <span className="sp-skel sp-skel-bio" />
                <span className="sp-skel sp-skel-bio short" />
              </div>
            </div>
          </div>
        </div>
      </div>
    );
  }

  // ── Privacy gate ── mirrors mpOpenSellerModal exactly: a private
  // profile is fully hidden (except username/handle) from anyone but
  // its owner; a members-only profile is hidden from signed-out
  // visitors. Both cases skip the listings grid, socials, and
  // follow/rate actions entirely rather than rendering the full header.
  if (!isOwnProfile && seller.profileVisibility === "private") {
    return (
      <div id="spModal" className="active" style={{ position: "static", marginTop: 92 }}>
        <div id="spModalInner">
          <div id="spModalMain">
            <div id="spModalNameInfo">
              <div id="spModalNameLine">
                <span id="spModalName">{seller.username}</span>
                <span id="spModalHandle">{"@" + seller.username.toLowerCase().replace(/\s+/g, "_")}</span>
              </div>
              <div id="spModalBio">
                <div id="spModalBioText" style={{ color: "#555" }}>
                  This profile is private.
                </div>
              </div>
            </div>
          </div>
          <div id="spModalPrivate" style={{ display: "block" }}>
            <div className="sp-empty-icon">
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
                <rect x="3" y="11" width="18" height="11" rx="2" />
                <path d="M7 11V7a5 5 0 0 1 10 0v4" />
              </svg>
            </div>
            <h3>This profile has been made private</h3>
            <p>The seller&apos;s listings and details aren&apos;t visible right now.</p>
            <div className="sp-safety-row sp-safety-bad" id="spModalPrivateTip">
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
                <circle cx="12" cy="12" r="10" />
                <line x1="12" y1="8" x2="12" y2="12" />
                <line x1="12" y1="16" x2="12.01" y2="16" />
              </svg>
              <div>
                <b>Double-check before you buy.</b> Private profiles hide history and reviews, so it&apos;s harder to
                verify a seller. Prefer sellers with a visible track record, and always use Siterifty Escrow.
              </div>
            </div>
          </div>
        </div>
      </div>
    );
  }

  if (!isOwnProfile && seller.profileVisibility === "members" && !user) {
    return (
      <div id="spModal" className="active" style={{ position: "static", marginTop: 92 }}>
        <div id="spModalInner">
          <div id="spModalMain">
            <div id="spModalNameInfo">
              <div id="spModalNameLine">
                <span id="spModalName">{seller.username}</span>
              </div>
              <div id="spModalBio">
                <div id="spModalBioText" style={{ color: "#555" }}>
                  Sign in to view this profile.
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div id="spModal" className="active" style={{ position: "static", marginTop: 92 }}>
      <div id="spModalInner">
        <SellerProfileHeader
          seller={seller}
          onSellerChange={(updater) => setSeller((s) => (s ? updater(s) : s))}
          onOpenDetails={() => setDetailsOpen(true)}
          onOpenRate={() => setRateOpen(true)}
          onOpenDonate={() => setDonateOpen(true)}
        />
        <SellerListingsGrid listings={seller.listings} />
      </div>

      {detailsOpen && (
        <SellerDetailsOverlay seller={seller} cachedStats={dealStats} onClose={() => setDetailsOpen(false)} />
      )}
      {rateOpen && (
        <RateOverlay
          sellerUid={seller.uid}
          sellerName={seller.username}
          onClose={() => setRateOpen(false)}
          onSubmitted={(starValSubmitted, isNewReview) =>
            setSeller((s) =>
              s
                ? {
                    ...s,
                    // Matches the original exactly: displays the just-submitted
                    // star value, not a recomputed average (see RateOverlay's
                    // comment on this same behavior).
                    rating: starValSubmitted,
                    ratingCount: isNewReview ? s.ratingCount + 1 : s.ratingCount,
                  }
                : s
            )
          }
        />
      )}
      {donateOpen && <DonateOverlay sellerUid={seller.uid} sellerName={seller.username} onClose={() => setDonateOpen(false)} />}
    </div>
  );
}
