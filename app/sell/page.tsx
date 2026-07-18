"use client";

// Replaces the old modal-based #listModal type-picker + #listingFormModal /
// #listingFormModalGame / #listingFormModalApp with real routes: this page
// is the type picker, and each form lives in its own component. Website,
// Game, and App are all wired up (App's actual source lives in
// Js/onboarding.js despite the filename — see port-status.md).
//
// The old picker also showed a weekly-listing-limit bar + plan upgrade
// prompt (#lmLimitRow/lmPlansRow in auth-modal.js) before letting you into
// a form. The original computed used/max from a live listener over the
// user's own listings plus window.__limits (the public GET /api/limits
// payload) — this is a lighter-weight equivalent: one POST to the same
// check-listing-cap action /api/limits already exposes (see
// app/api/_lib/limits.js's handleCheckListingCap), shown as a simple bar +
// "Upgrade Plan" nudge when at the cap. The server still enforces the cap
// independently on submit either way (handleCreate's _checkWeeklyCap) —
// this is purely a heads-up so you don't fill out a whole form and hit the
// wall at the end.

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import WebsiteListingForm from "@/components/listing/WebsiteListingForm";
import GameListingForm from "@/components/listing/GameListingForm";
import AppListingForm from "@/components/listing/AppListingForm";
import { useAuth } from "@/lib/AuthContext";
import { usePlansModal } from "@/components/billing/PlansModalProvider";
import { useLimits } from "@/lib/useLimits";
import { db } from "@/lib/firebase";
import { collection, query, where, getDocs } from "firebase/firestore";

type ListingKind = "website" | "app" | "game" | null;

interface CapStatus {
  allowed: boolean;
  used: number;
  max: number | null;
  unlimited: boolean;
  plan: string;
  saleFeeDisplay?: string;
}

interface MyListingRow {
  id: string;
  title?: string;
  type?: string;
  url?: string;
  status?: string;
  images?: string[];
  imageCover?: string;
}

const TYPE_META: Record<string, { label: string; color: string }> = {
  website: { label: "WEBSITE", color: "#a3e635" },
  app: { label: "APP", color: "#fbbf24" },
  game: { label: "GAME", color: "#f59e0b" },
};

const TAB_META: Record<"website" | "app" | "game", { label: string; ctaLabel: string; ctaSub: string }> = {
  website: { label: "WEBSITE", ctaLabel: "List a Website", ctaSub: "Share a website you built or own" },
  app: { label: "APP", ctaLabel: "List an App", ctaSub: "Share a mobile or web app" },
  game: { label: "GAME", ctaLabel: "List a Game", ctaSub: "Share a browser game or downloadable build" },
};

function WeeklyLimitBar({ cap, open, onToggle }: { cap: CapStatus | null; open: boolean; onToggle: () => void }) {
  const { openPlansModal } = usePlansModal();
  if (!cap) return null;

  const pct = cap.unlimited ? 0 : Math.min(100, Math.round((cap.used / (cap.max || 1)) * 100));
  const atCap = !cap.unlimited && !cap.allowed;

  return (
    <>
      <div className="lm-limit-row" style={{ marginBottom: 0 }}>
        <div className="lm-limit-row-left" role="button" tabIndex={0} onClick={onToggle}>
          <span className="lm-limit-label">WEEKLY LIMIT</span>
          <div className="lm-limit-track">
            <div
              className="lm-limit-track-fill"
              style={{ width: `${pct}%`, background: atCap ? "#ef4444" : undefined }}
            />
          </div>
          <span className="lm-limit-numbers">{cap.unlimited ? `${cap.used} / ∞` : `${cap.used} / ${cap.max}`}</span>
          <span className="lm-limit-arrow">▼</span>
        </div>
        {cap.plan !== "pro" && (
          <button className="lm-btn-plan-upgrade" type="button" onClick={() => openPlansModal()}>
            <svg viewBox="0 0 24 24" strokeLinecap="round" strokeLinejoin="round">
              <line x1="12" y1="19" x2="12" y2="5" />
              <polyline points="6 11 12 5 18 11" />
            </svg>
            Upgrade Plan for More Listings
          </button>
        )}
      </div>
      <div className={`lm-limit-dropdown${open ? " open" : ""}`}>
        <span id="lmLimitSummary">{cap.unlimited ? `${cap.used} listed · unlimited` : `${cap.used} / ${cap.max} used`}</span> this week.{" "}
        {cap.saleFeeDisplay && <span id="lmLimitFeeNote">{cap.saleFeeDisplay} platform fee per sale{cap.unlimited ? " · unlimited listings" : ""}.</span>}
      </div>
    </>
  );
}

export default function SellPage() {
  const router = useRouter();
  const { user, profile } = useAuth();
  const { limits } = useLimits();
  const [kind, setKind] = useState<ListingKind>(null);
  const [activeTab, setActiveTab] = useState<"website" | "app" | "game">("website");
  const [cap, setCap] = useState<CapStatus | null>(null);
  const [limitOpen, setLimitOpen] = useState(false);
  const [myListings, setMyListings] = useState<MyListingRow[] | null>(null);

  useEffect(() => {
    if (!user) return;
    let cancelled = false;
    (async () => {
      try {
        const idToken = await user.getIdToken();
        const res = await fetch("/api/limits", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ action: "check-listing-cap", idToken }),
        });
        const json = await res.json().catch(() => null);
        if (!cancelled && res.ok && json) setCap(json);
      } catch {
        // heads-up only — server still enforces the real cap on submit
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [user]);

  useEffect(() => {
    if (!user) return;
    let cancelled = false;
    (async () => {
      try {
        const q = query(collection(db, "listings"), where("ownerId", "==", user.uid));
        const qs = await getDocs(q);
        if (!cancelled) setMyListings(qs.docs.map((d) => ({ id: d.id, ...(d.data() as any) })));
      } catch {
        if (!cancelled) setMyListings([]);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [user]);

  if (kind === "website") return <WebsiteListingForm />;
  if (kind === "game") return <GameListingForm />;
  if (kind === "app") return <AppListingForm />;

  const planKey = (cap?.plan || profile?.plan || "free") as "free" | "starter" | "growth" | "pro";
  const meta = TAB_META[activeTab];
  const initials = (profile?.username || user?.email || "?").charAt(0).toUpperCase();

  return (
    <div style={{ minHeight: "100vh", paddingTop: 92, paddingBottom: 80 }}>
      <div className="lm-app" style={{ maxWidth: 720, margin: "0 auto", padding: "0 20px" }}>
        <div className="lm-profile-bar">
          <div className="lm-profile-bar-inner">
            <div className="lm-profile-left">
              <div className="lm-user-avatar">{initials}</div>
              <div className="lm-profile-identity">
                <span className="lm-user-username">@{profile?.username || "you"}</span>
                <span className="lm-plan-badge">{planKey.charAt(0).toUpperCase() + planKey.slice(1)}</span>
              </div>
            </div>
          </div>
        </div>

        <WeeklyLimitBar cap={cap} open={limitOpen} onToggle={() => setLimitOpen((v) => !v)} />

        <div id="lmPlansRow" className="lm-pricing-grid">
          {(["free", "starter", "growth", "pro"] as const).map((key) => {
            const plan = limits.plans[key];
            return (
              <div className="lm-pricing-card" data-plan={key} key={key} data-active={planKey === key ? "true" : undefined}>
                {planKey === key && (
                  <span className="lm-plan-check-badge">
                    <svg viewBox="0 0 24 24" strokeLinecap="round" strokeLinejoin="round">
                      <polyline points="20 6 9 17 4 12" />
                    </svg>
                  </span>
                )}
                <div className="lm-plan-name">{key.toUpperCase()}</div>
                <div className="lm-plan-price">
                  {plan.unlimited ? "Unlimited" : (
                    <>
                      {plan.weeklyListings}
                      <small>/wk</small>
                    </>
                  )}
                </div>
                <div className="lm-plan-sub">{plan.saleFeeDisplay} fee</div>
              </div>
            );
          })}
        </div>

        <div className="lm-category-tabs">
          <button
            className={`lm-tab-btn${activeTab === "website" ? " active" : ""}`}
            data-tab="website"
            type="button"
            onClick={() => setActiveTab("website")}
          >
            <svg viewBox="0 0 24 24" strokeLinecap="round" strokeLinejoin="round">
              <rect x="2" y="3" width="20" height="14" rx="2" ry="2" />
              <line x1="8" y1="21" x2="16" y2="21" />
              <line x1="12" y1="17" x2="12" y2="21" />
            </svg>
            <span className="lm-tab-label"><span className="lm-tab-text">WEBSITE</span></span>
            {activeTab === "website" && (
              <span className="lm-tab-check-badge">
                <svg viewBox="0 0 24 24" strokeLinecap="round" strokeLinejoin="round">
                  <polyline points="20 6 9 17 4 12" />
                </svg>
              </span>
            )}
          </button>
          <button
            className={`lm-tab-btn${activeTab === "app" ? " active" : ""}`}
            data-tab="app"
            type="button"
            onClick={() => setActiveTab("app")}
          >
            <svg viewBox="0 0 24 24" strokeLinecap="round" strokeLinejoin="round">
              <rect x="2" y="2" width="20" height="20" rx="4" />
              <line x1="6" y1="12" x2="18" y2="12" />
              <line x1="12" y1="6" x2="12" y2="18" />
            </svg>
            <span className="lm-tab-label"><span className="lm-tab-text">APP</span></span>
          </button>
          <button
            className={`lm-tab-btn${activeTab === "game" ? " active" : ""}`}
            data-tab="game"
            type="button"
            onClick={() => setActiveTab("game")}
          >
            <svg viewBox="0 0 24 24" strokeLinecap="round" strokeLinejoin="round">
              <rect x="2" y="6" width="20" height="12" rx="3" />
              <circle cx="8" cy="12" r="1.5" />
              <circle cx="16" cy="12" r="1.5" />
              <line x1="12" y1="10" x2="12" y2="14" />
            </svg>
            <span className="lm-tab-label"><span className="lm-tab-text">GAME</span></span>
          </button>
        </div>

        <div className="lm-list-action">
          <button className="lm-cta-btn" data-type={activeTab} data-theme={activeTab} type="button" onClick={() => setKind(activeTab)}>
            <svg viewBox="0 0 24 24" strokeLinecap="round" strokeLinejoin="round">
              <line x1="12" y1="5" x2="12" y2="19" />
              <line x1="5" y1="12" x2="19" y2="12" />
            </svg>
            <span className="lm-btn-label"><span className="lm-btn-text">{meta.ctaLabel}</span></span>
          </button>
          <span className="lm-btn-list-sub">{meta.ctaSub}</span>
        </div>

        <div className="lm-listings-header">
          <h2>YOUR LISTINGS</h2>
          <button
            id="lmManageListingsBtn"
            type="button"
            className="lm-manage-listings-btn"
            onClick={() => router.push("/myprofile")}
          >
            <svg viewBox="0 0 24 24" strokeLinecap="round" strokeLinejoin="round">
              <rect x="2" y="3" width="20" height="14" rx="2" ry="2" />
              <line x1="8" y1="21" x2="16" y2="21" />
              <line x1="12" y1="17" x2="12" y2="21" />
            </svg>
            <span>Manage</span>
            <strong id="lmListingsCount">{myListings ? myListings.length : 0} total</strong>
          </button>
        </div>
        <div id="lmListingsList" className="lm-listings-grid">
          {myListings === null ? (
            <div style={{ textAlign: "center", padding: 24, color: "#3f3f46", fontSize: 12.5 }}>Loading your listings…</div>
          ) : myListings.length === 0 ? (
            <div style={{ textAlign: "center", padding: 24, color: "#3f3f46", fontSize: 12.5 }}>
              No listings yet — your first one will show up here.
            </div>
          ) : (
            myListings.map((l) => {
              const type = TYPE_META[l.type || ""] ? (l.type as string) : "website";
              const meta = TYPE_META[type];
              const thumb = l.images?.[2] || l.imageCover || l.images?.[0] || "";
              return (
                <div className="lm-listing-item" key={l.id}>
                  <div className={`lm-listing-icon type-${type}`}>
                    {thumb ? (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img src={thumb} alt="" loading="lazy" />
                    ) : (
                      <TypeIconSvg type={type} />
                    )}
                  </div>
                  <div className="lm-listing-info">
                    <div className="lm-title">{l.title || "Untitled"}</div>
                    <div className="lm-meta-row">
                      <span className="lm-url">{l.url || ""}</span>
                      <span className="lm-type-chip" style={{ background: `${meta.color}1a`, color: meta.color }}>
                        {meta.label}
                      </span>
                    </div>
                  </div>
                  <div className="lm-listing-actions">
                    <button className="lm-item-edit" onClick={() => router.push(`/listing/${l.id}`)}>
                      EDIT
                    </button>
                    <button className="lm-item-delete" onClick={() => router.push(`/myprofile`)}>
                      DELETE
                    </button>
                  </div>
                </div>
              );
            })
          )}
        </div>
      </div>
    </div>
  );
}

function TypeIconSvg({ type }: { type: string }) {
  if (type === "app") {
    return (
      <svg viewBox="0 0 24 24" strokeLinecap="round" strokeLinejoin="round">
        <rect x="2" y="2" width="20" height="20" rx="4" />
        <line x1="6" y1="12" x2="18" y2="12" />
        <line x1="12" y1="6" x2="12" y2="18" />
      </svg>
    );
  }
  if (type === "game") {
    return (
      <svg viewBox="0 0 24 24" strokeLinecap="round" strokeLinejoin="round">
        <rect x="2" y="6" width="20" height="12" rx="3" />
        <circle cx="8" cy="12" r="1.5" />
        <circle cx="16" cy="12" r="1.5" />
        <line x1="12" y1="10" x2="12" y2="14" />
      </svg>
    );
  }
  return (
    <svg viewBox="0 0 24 24" strokeLinecap="round" strokeLinejoin="round">
      <rect x="2" y="3" width="20" height="14" rx="2" ry="2" />
      <line x1="8" y1="21" x2="16" y2="21" />
      <line x1="12" y1="17" x2="12" y2="21" />
    </svg>
  );
}
