"use client";

import { useEffect, useRef, useState } from "react";
import { auth } from "@/lib/firebase";
import { useAuth } from "@/lib/AuthContext";
import { loadPaypalSdk } from "@/lib/paypalSdk";
import { useLimits } from "@/lib/useLimits";

// Ports the PLANS MODAL from plans-boost.js (index.html lines
// 22915-23678). PLAN_DATA below is a mix of two kinds of content:
//   - Live business numbers (price, fee, color, tagline) — these now come
//     from useLimits() (GET /api/limits, LIMITS.plans) inside the
//     component below, via withLiveNumbers(). The literals here are only
//     the fallback, used until that fetch resolves.
//   - Static marketing content (pills, features checklist) — this isn't
//     part of LIMITS at all (the original's own window.__limits has no
//     equivalent field for it either), so it stays hardcoded here; there's
//     nothing to fetch.
type PlanKey = "starter" | "growth" | "pro";

interface PlanInfo {
  name: string;
  price: number;
  fee: string;
  color: string;
  tagline: string;
  pills: string[];
  features: { text: string; on: boolean }[];
}

const PLAN_DATA: Record<PlanKey, PlanInfo> = {
  starter: {
    name: "Starter",
    price: 15,
    fee: "20%",
    color: "#60a5fa",
    tagline: "For developers listing regularly",
    pills: ["15 listings/wk", "20% fee"],
    features: [
      { text: "Escrow protection", on: true },
      { text: "Wallet access", on: true },
      { text: "Basic analytics", on: true },
      { text: "Priority placement", on: true },
      { text: "Featured badge", on: false },
      { text: "Dedicated support", on: false },
    ],
  },
  growth: {
    name: "Growth",
    price: 30,
    fee: "10%",
    color: "#a3e635",
    tagline: "For serious sellers scaling up",
    pills: ["30 listings/wk", "10% fee"],
    features: [
      { text: "Escrow protection", on: true },
      { text: "Wallet access", on: true },
      { text: "Advanced analytics", on: true },
      { text: "Priority placement", on: true },
      { text: "Featured badge", on: true },
      { text: "Dedicated support", on: false },
    ],
  },
  pro: {
    name: "Pro",
    price: 60,
    fee: "5%",
    color: "#d8b4fe",
    tagline: "For high-volume power sellers",
    pills: ["Unlimited listings", "5% fee"],
    features: [
      { text: "Escrow protection", on: true },
      { text: "Wallet access", on: true },
      { text: "Full analytics dashboard", on: true },
      { text: "Top placement + Pro badge", on: true },
      { text: "Featured badge", on: true },
      { text: "Dedicated support", on: true },
    ],
  },
};

const PLAN_ORDER: PlanKey[] = ["starter", "growth", "pro"];

const CheckIcon = () => (
  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#a3e635" strokeWidth="2.4" strokeLinecap="round">
    <polyline points="20 6 9 17 4 12" />
  </svg>
);
const XIcon = () => (
  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#444" strokeWidth="2.4" strokeLinecap="round">
    <line x1="18" y1="6" x2="6" y2="18" />
    <line x1="6" y1="6" x2="18" y2="18" />
  </svg>
);

export default function PlansModal({
  open,
  preselect,
  onClose,
  onSubscribed,
}: {
  open: boolean;
  preselect?: PlanKey;
  onClose: () => void;
  onSubscribed: (plan: PlanKey) => void;
}) {
  const { profile } = useAuth();
  const currentPlan = (profile?.plan || "free") as string;
  const { limits } = useLimits();

  // Merges live price/fee/color/tagline from useLimits() onto the static
  // PLAN_DATA fallback (pills/features have no live equivalent — see the
  // header comment above). Falls back to PLAN_DATA's own literal for any
  // key useLimits() doesn't resolve yet.
  const PLANS: Record<PlanKey, PlanInfo> = Object.fromEntries(
    (Object.entries(PLAN_DATA) as [PlanKey, PlanInfo][]).map(([key, fallback]) => {
      const live = limits.plans[key];
      return [
        key,
        live
          ? { ...fallback, price: live.price, fee: live.saleFeeDisplay, color: live.color, tagline: live.tagline }
          : fallback,
      ];
    })
  ) as Record<PlanKey, PlanInfo>;

  const [activePlan, setActivePlan] = useState<PlanKey>("growth");
  const [showSubscribeBtn, setShowSubscribeBtn] = useState(true);
  const [msg, setMsg] = useState<{ text: string; kind: "ok" | "err" | "" }>({ text: "", kind: "" });

  const paypalContainerRef = useRef<HTMLDivElement>(null);
  const buttonsRef = useRef<any>(null);

  // Ports openPlansModal's preselect/default-tab logic.
  useEffect(() => {
    if (!open) return;
    let start: PlanKey =
      preselect && PLANS[preselect]
        ? preselect
        : currentPlan === "starter"
        ? "growth"
        : currentPlan === "growth"
        ? "pro"
        : "growth";
    if (currentPlan !== "free" && PLANS[currentPlan as PlanKey] && !preselect) {
      start = currentPlan as PlanKey;
    }
    setActivePlan(start);
    setShowSubscribeBtn(true);
    setMsg({ text: "", kind: "" });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, preselect]);

  function selectPlan(key: PlanKey) {
    setActivePlan(key);
    setShowSubscribeBtn(true);
    setMsg({ text: "", kind: "" });
    buttonsRef.current?.close?.();
    buttonsRef.current = null;
    if (paypalContainerRef.current) paypalContainerRef.current.innerHTML = "";
  }

  async function mountPaypalButton(planKey: PlanKey) {
    const container = paypalContainerRef.current;
    const user = auth.currentUser;
    if (!container) return;
    if (!user) {
      setMsg({ text: "Log in to subscribe.", kind: "err" });
      return;
    }

    buttonsRef.current?.close?.();
    container.innerHTML = '<div style="height:45px;border-radius:50px;background:rgba(255,255,255,.06);"></div>';
    setMsg({ text: "", kind: "" });

    let paypal;
    try {
      paypal = await loadPaypalSdk("vault=true&intent=subscription&components=buttons");
    } catch (err) {
      console.error("[plans] SDK load failed", err);
      container.innerHTML = "";
      setMsg({ text: "Could not load PayPal. Check your connection and try again.", kind: "err" });
      return;
    }

    if (activePlan !== planKey) return; // switched tabs while loading
    container.innerHTML = "";

    buttonsRef.current = paypal.Buttons({
      style: { layout: "horizontal", color: "gold", shape: "pill", height: 45, label: "subscribe" },

      createSubscription: async () => {
        try {
          const idToken = await user.getIdToken();
          const res = await fetch("/api/paypal", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ action: "get-plan-id", idToken, plan: planKey }),
          });
          const d = await res.json();
          if (!res.ok) throw new Error(d.error || "Could not start subscription");
          return d.planId;
        } catch (err: any) {
          setMsg({ text: err.message || "Could not start subscription", kind: "err" });
          throw err;
        }
      },

      onApprove: async (data: { subscriptionID: string }) => {
        try {
          const idToken = await user.getIdToken();
          const res = await fetch("/api/paypal", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              action: "activate-sub",
              idToken,
              plan: planKey,
              subscriptionID: data.subscriptionID,
            }),
          });
          const d = await res.json();
          if (!res.ok) throw new Error(d.error || "Subscription could not be activated");

          setMsg({ text: `You're now on the ${PLANS[planKey].name} plan.`, kind: "ok" });
          onSubscribed(planKey);
        } catch (err: any) {
          setMsg({ text: err.message || "Subscription could not be activated", kind: "err" });
        }
      },

      onError: (err: unknown) => {
        console.error("[plans] PayPal Buttons error", err);
        setMsg({ text: "PayPal ran into a problem. Please try again.", kind: "err" });
      },

      onCancel: () => {
        setMsg({ text: "", kind: "" });
      },
    });

    buttonsRef.current.render(container).catch((err: unknown) => {
      console.error("[plans] Buttons render failed", err);
      container.innerHTML = "";
      setMsg({ text: "Could not display PayPal button.", kind: "err" });
    });
  }

  if (!open) return null;

  const p = PLANS[activePlan];
  const isCurrentPlan = currentPlan === activePlan;

  return (
    <div
      id="srfPlansOverlay"
      className="active"
      style={{ position: "fixed", inset: 0, zIndex: 10000, display: "flex", alignItems: "center", justifyContent: "center", background: "rgba(0,0,0,0.75)" }}
      onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}
    >
      <div style={{ background: "#141420", borderRadius: 16, width: "min(460px, 92vw)", maxHeight: "88vh", overflowY: "auto", color: "#fff" }}>
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "1.1rem 1.3rem", borderBottom: "1px solid #222" }}>
          <h3 style={{ margin: 0, fontSize: "1.05rem" }}>Plans &amp; Billing</h3>
          <button id="srfPlansCloseBtn" onClick={onClose} style={{ background: "none", border: "none", color: "#888", fontSize: "1.4rem", cursor: "pointer", lineHeight: 1 }}>
            &times;
          </button>
        </div>

        <div id="srfPlansTabs" style={{ display: "flex", gap: 4, padding: "0.9rem 1.3rem 0" }}>
          {PLAN_ORDER.map((key) => (
            <button
              key={key}
              className={`srf-plan-tab${activePlan === key ? " active" : ""}`}
              data-plan={key}
              onClick={() => selectPlan(key)}
              style={{
                flex: 1,
                padding: "0.5rem 0",
                borderRadius: 8,
                border: activePlan === key ? `1px solid ${PLANS[key].color}` : "1px solid #2a2a2a",
                background: activePlan === key ? `${PLANS[key].color}22` : "transparent",
                color: activePlan === key ? PLANS[key].color : "#999",
                fontWeight: 700,
                fontSize: "0.82rem",
                cursor: "pointer",
              }}
            >
              {PLANS[key].name}
            </button>
          ))}
        </div>

        <div id="srfPlansBody" style={{ padding: "1.2rem 1.3rem 0" }}>
          <div className="srf-plan-name" style={{ fontWeight: 800, fontSize: "1.1rem", display: "flex", alignItems: "center", gap: 8 }}>
            {p.name}
            {activePlan === "growth" ? (
              <span className="srf-plan-chip" style={{ fontSize: "0.65rem", background: "#a3e635", color: "#000", padding: "2px 8px", borderRadius: 999, fontWeight: 700 }}>
                popular
              </span>
            ) : null}
          </div>
          <div className="srf-plan-price" style={{ color: p.color, fontWeight: 800, fontSize: "1.8rem", margin: "0.3rem 0" }}>
            ${p.price}
            <small style={{ fontSize: "0.9rem", fontWeight: 500, opacity: 0.7 }}>/month</small>
          </div>
          <p className="srf-plan-desc" style={{ color: "#aaa", fontSize: "0.85rem", margin: "0 0 0.7rem" }}>
            {p.tagline}
          </p>
          <div className="srf-plan-pills" style={{ display: "flex", gap: 8, flexWrap: "wrap", marginBottom: "0.9rem" }}>
            {p.pills.map((text) => (
              <span
                key={text}
                className="srf-plan-pill"
                style={{ color: p.color, border: `1px solid ${p.color}55`, borderRadius: 999, padding: "3px 10px", fontSize: "0.75rem", fontWeight: 600 }}
              >
                {text}
              </span>
            ))}
          </div>
          <ul className="srf-plan-features" style={{ listStyle: "none", margin: 0, padding: 0, display: "flex", flexDirection: "column", gap: 8 }}>
            {p.features.map((f) => (
              <li
                key={f.text}
                className={f.on ? "" : "is-dim"}
                style={{ display: "flex", alignItems: "center", gap: 8, fontSize: "0.85rem", color: f.on ? "#eee" : "#555" }}
              >
                {f.on ? <CheckIcon /> : <XIcon />}
                {f.text}
              </li>
            ))}
          </ul>
        </div>

        <div id="srfPlansFooterInner" style={{ padding: "1.2rem 1.3rem" }}>
          {isCurrentPlan ? (
            <div className="srf-current-banner" style={{ textAlign: "center", padding: "0.7rem", borderRadius: 8, background: "rgba(163,230,53,0.1)", color: "#a3e635", fontWeight: 700, fontSize: "0.85rem" }}>
              ✓ This is your current plan
            </div>
          ) : (
            <>
              {showSubscribeBtn ? (
                <button
                  id="srfSubscribeBtn"
                  className="srf-subscribe-cta"
                  style={{ width: "100%", padding: "0.8rem", borderRadius: 999, border: "none", background: p.color, color: "#000", fontWeight: 700, fontSize: "0.9rem", cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center", gap: 8 }}
                  onClick={() => {
                    setShowSubscribeBtn(false);
                    mountPaypalButton(activePlan);
                  }}
                >
                  <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                    <rect x="3" y="11" width="18" height="11" rx="2" ry="2" />
                    <path d="M7 11V7a5 5 0 0 1 10 0v4" />
                  </svg>
                  Subscribe to {p.name}
                </button>
              ) : null}
              <div id="srfPlansPaypalContainer" ref={paypalContainerRef} style={{ marginTop: showSubscribeBtn ? 0 : 8 }} />
            </>
          )}

          {msg.text ? (
            <div
              id="srfPlansMsg"
              className={`srf-plans-msg${msg.kind ? ` ${msg.kind}` : ""}`}
              style={{ marginTop: 10, fontSize: "0.85rem", textAlign: "center", color: msg.kind === "err" ? "#f87171" : msg.kind === "ok" ? "#a3e635" : "#aaa" }}
            >
              {msg.text}
            </div>
          ) : null}
        </div>
      </div>
    </div>
  );
}
