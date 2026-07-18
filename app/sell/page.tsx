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
import WebsiteListingForm from "@/components/listing/WebsiteListingForm";
import GameListingForm from "@/components/listing/GameListingForm";
import AppListingForm from "@/components/listing/AppListingForm";
import { useAuth } from "@/lib/AuthContext";
import { usePlansModal } from "@/components/billing/PlansModalProvider";

type ListingKind = "website" | "app" | "game" | null;

interface CapStatus {
  allowed: boolean;
  used: number;
  max: number | null;
  unlimited: boolean;
  plan: string;
  saleFeeDisplay?: string;
}

function WeeklyLimitBar() {
  const { user } = useAuth();
  const { openPlansModal } = usePlansModal();
  const [cap, setCap] = useState<CapStatus | null>(null);
  const [open, setOpen] = useState(false);

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
        // silent — this is a heads-up, not a blocking check; the server
        // still enforces the real cap on submit regardless
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [user]);

  if (!user || !cap) return null;

  const pct = cap.unlimited ? 0 : Math.min(100, Math.round((cap.used / (cap.max || 1)) * 100));
  const atCap = !cap.unlimited && !cap.allowed;

  return (
    <div className={`lm-limit-row${open ? " open" : ""}`} style={{ marginBottom: 24 }} onClick={() => setOpen((v) => !v)}>
      <div className="lm-limit-row-left" role="button" tabIndex={0}>
        <span className="lm-limit-label">Weekly limit</span>
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
        <button
          className="lm-btn-plan-upgrade"
          type="button"
          onClick={(e) => {
            e.stopPropagation();
            openPlansModal();
          }}
        >
          <svg viewBox="0 0 24 24" strokeLinecap="round" strokeLinejoin="round">
            <line x1="12" y1="19" x2="12" y2="5" />
            <polyline points="6 11 12 5 18 11" />
          </svg>
          Upgrade Plan for More Listings
        </button>
      )}
      <div className={`lm-limit-dropdown${open ? " open" : ""}`} onClick={(e) => e.stopPropagation()}>
        <span id="lmLimitSummary">{cap.unlimited ? `${cap.used} listed · unlimited` : `${cap.used} / ${cap.max} used`}</span> this week.{" "}
        {cap.saleFeeDisplay && <span>{cap.saleFeeDisplay} platform fee per sale{cap.unlimited ? " · unlimited listings" : ""}.</span>}
      </div>
    </div>
  );
}

export default function SellPage() {
  const [kind, setKind] = useState<ListingKind>(null);

  if (kind === "website") return <WebsiteListingForm />;
  if (kind === "game") return <GameListingForm />;
  if (kind === "app") return <AppListingForm />;

  return (
    <div style={{ minHeight: "100vh", background: "#000", color: "#fff", paddingTop: 92, paddingBottom: 80 }}>
      <div style={{ maxWidth: 720, margin: "0 auto", padding: "0 20px" }}>
        <h1 style={{ fontSize: 32, fontWeight: 800, letterSpacing: "-0.02em", marginBottom: 8 }}>
          What are you listing?
        </h1>
        <p style={{ fontSize: 15, color: "rgba(255,255,255,0.4)", marginBottom: 32 }}>
          Choose a type to get started.
        </p>

        <WeeklyLimitBar />

        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(200px, 1fr))", gap: 16 }}>
          <TypeCard
            label="Website"
            desc="A live site, SaaS, or online business."
            accent="#a3e635"
            icon={<GlobeIcon />}
            onClick={() => setKind("website")}
          />
          <TypeCard
            label="App"
            desc="A mobile or web app."
            accent="#fbbf24"
            icon={<AppIcon />}
            onClick={() => setKind("app")}
          />
          <TypeCard
            label="Game"
            desc="A browser game or downloadable build."
            accent="#f59e0b"
            icon={<GameIcon />}
            onClick={() => setKind("game")}
          />
        </div>
      </div>
    </div>
  );
}

function TypeCard({
  label,
  desc,
  accent,
  icon,
  onClick,
  comingSoon,
}: {
  label: string;
  desc: string;
  accent: string;
  icon: React.ReactNode;
  onClick?: () => void;
  comingSoon?: boolean;
}) {
  return (
    <button
      onClick={onClick}
      disabled={comingSoon}
      style={{
        position: "relative",
        display: "flex",
        flexDirection: "column",
        alignItems: "flex-start",
        gap: 10,
        padding: 20,
        background: "rgba(255,255,255,0.03)",
        border: "1px solid rgba(255,255,255,0.08)",
        borderRadius: 16,
        cursor: comingSoon ? "not-allowed" : "pointer",
        textAlign: "left",
        fontFamily: "inherit",
        opacity: comingSoon ? 0.5 : 1,
        transition: "border-color 0.2s",
      }}
    >
      <span style={{ width: 36, height: 36, color: accent, display: "flex" }}>{icon}</span>
      <span style={{ fontSize: 17, fontWeight: 700 }}>{label}</span>
      <span style={{ fontSize: 13, color: "rgba(255,255,255,0.4)" }}>{desc}</span>
      {comingSoon && (
        <span
          style={{
            position: "absolute",
            top: 14,
            right: 14,
            fontSize: 10,
            fontWeight: 800,
            textTransform: "uppercase",
            letterSpacing: "0.05em",
            color: "rgba(255,255,255,0.4)",
            background: "rgba(255,255,255,0.08)",
            padding: "3px 8px",
            borderRadius: 20,
          }}
        >
          Coming soon
        </span>
      )}
    </button>
  );
}

function GlobeIcon() {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.8} strokeLinecap="round" strokeLinejoin="round" style={{ width: "100%", height: "100%" }}>
      <circle cx="12" cy="12" r="10" />
      <path d="M2 12h20M12 2a15.3 15.3 0 010 20M12 2a15.3 15.3 0 000 20" />
    </svg>
  );
}
function AppIcon() {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.8} strokeLinecap="round" strokeLinejoin="round" style={{ width: "100%", height: "100%" }}>
      <rect x="5" y="2" width="14" height="20" rx="2" />
      <line x1="12" y1="18" x2="12.01" y2="18" />
    </svg>
  );
}
function GameIcon() {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.8} strokeLinecap="round" strokeLinejoin="round" style={{ width: "100%", height: "100%" }}>
      <rect x="2" y="6" width="20" height="12" rx="6" />
      <line x1="7" y1="12" x2="9" y2="12" />
      <line x1="8" y1="11" x2="8" y2="13" />
      <circle cx="16" cy="10.5" r="0.8" fill="currentColor" />
      <circle cx="18" cy="13" r="0.8" fill="currentColor" />
    </svg>
  );
}
