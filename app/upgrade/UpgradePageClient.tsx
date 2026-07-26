"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { auth } from "@/lib/firebase";
import { useAuth } from "@/lib/AuthContext";
import { useAuthModal } from "@/components/auth/AuthModalProvider";
import { loadPaypalSdk } from "@/lib/paypalSdk";
import { useLimits } from "@/lib/useLimits";
import { useCurrency } from "@/lib/CurrencyContext";

// Full-page version of the old PlansModal (billing/PlansModal.tsx) —
// previously a centered popup opened from anywhere via
// PlansModalProvider's openPlansModal(). Same plan data, same PayPal
// subscribe flow, same live useLimits()-backed pricing; moved to its own
// /upgrade route and restyled full-screen (hero header, side-by-side
// plan grid instead of a tabbed single-card modal, comparison table, FAQ)
// for a more premium/dedicated feel instead of a cramped overlay.
// openPlansModal() now does router.push(`/upgrade?plan=...`) instead of
// setting modal state — see PlansModalProvider.tsx.
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
    price: 10,
    fee: "15%",
    color: "#60a5fa",
    tagline: "For developers listing regularly",
    pills: ["15 listings/wk", "15% fee"],
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
    price: 20,
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
    price: 30,
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

const COMPARISON_ROWS: { label: string; values: Record<PlanKey, string> }[] = [
  { label: "Weekly listings", values: { starter: "15", growth: "30", pro: "Unlimited" } },
  { label: "Sale fee", values: { starter: "15%", growth: "10%", pro: "5%" } },
  { label: "Analytics", values: { starter: "Basic", growth: "Advanced", pro: "Full dashboard" } },
  { label: "Search placement", values: { starter: "Priority", growth: "Priority", pro: "Top + badge" } },
  { label: "Featured badge", values: { starter: "—", growth: "Included", pro: "Included" } },
  { label: "Support", values: { starter: "Standard", growth: "Standard", pro: "Dedicated" } },
];

const FAQS = [
  {
    q: "Can I change plans later?",
    a: "Yes — upgrade or downgrade anytime from Settings. Changes apply to your next billing cycle, and your listing limits update immediately.",
  },
  {
    q: "What happens to my active listings if I downgrade?",
    a: "Existing listings stay live. You just won't be able to publish new ones past your new plan's weekly limit until it resets.",
  },
  {
    q: "Is the sale fee charged on top of PayPal's own fees?",
    a: "No — the percentage shown is Siterifty's total fee on a completed sale. Your subscription price is billed separately by PayPal each month.",
  },
  {
    q: "Can I cancel anytime?",
    a: "Yes, no lock-in. Cancel from Settings and you'll keep plan benefits until the end of your current billing period.",
  },
];

const CheckIcon = ({ color = "#a3e635" }: { color?: string }) => (
  <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="2.4" strokeLinecap="round">
    <polyline points="20 6 9 17 4 12" />
  </svg>
);
const XIcon = () => (
  <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="#444" strokeWidth="2.4" strokeLinecap="round">
    <line x1="18" y1="6" x2="6" y2="18" />
    <line x1="6" y1="6" x2="18" y2="18" />
  </svg>
);

export default function UpgradePageClient() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const { user, profile } = useAuth();
  const { openAuthModal } = useAuthModal();
  const currentPlan = (profile?.plan || "free") as string;
  const { limits } = useLimits();
  const { currency, formatBalance } = useCurrency();

  const preselect = (searchParams.get("plan") as PlanKey | null) || undefined;

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
  const [openFaq, setOpenFaq] = useState<number | null>(null);

  const paypalContainerRef = useRef<HTMLDivElement>(null);
  const buttonsRef = useRef<any>(null);

  // Redirect signed-out visitors to sign in rather than showing a dead
  // subscribe flow — mirrors the old openPlansModal() guard.
  useEffect(() => {
    if (user === null) {
      openAuthModal();
      router.replace("/marketplace");
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user]);

  useEffect(() => {
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
  }, [preselect]);

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
    const authUser = auth.currentUser;
    if (!container) return;
    if (!authUser) {
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
      console.error("[upgrade] SDK load failed", err);
      container.innerHTML = "";
      setMsg({ text: "Could not load PayPal. Check your connection and try again.", kind: "err" });
      return;
    }

    if (activePlan !== planKey) return;
    container.innerHTML = "";

    buttonsRef.current = paypal.Buttons({
      style: { layout: "horizontal", color: "gold", shape: "pill", height: 45, label: "subscribe" },

      createSubscription: async () => {
        try {
          const idToken = await authUser.getIdToken();
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
          const idToken = await authUser.getIdToken();
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
        } catch (err: any) {
          setMsg({ text: err.message || "Subscription could not be activated", kind: "err" });
        }
      },

      onError: (err: unknown) => {
        console.error("[upgrade] PayPal Buttons error", err);
        setMsg({ text: "PayPal ran into a problem. Please try again.", kind: "err" });
      },

      onCancel: () => {
        setMsg({ text: "", kind: "" });
      },
    });

    buttonsRef.current.render(container).catch((err: unknown) => {
      console.error("[upgrade] Buttons render failed", err);
      container.innerHTML = "";
      setMsg({ text: "Could not display PayPal button.", kind: "err" });
    });
  }

  const p = PLANS[activePlan];
  const isCurrentPlan = currentPlan === activePlan;

  return (
    <div className="upg-page">
      <div className="upg-hero">
        <button className="upg-back" onClick={() => router.back()} aria-label="Go back">
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round">
            <path d="M15 18l-6-6 6-6" />
          </svg>
          Back
        </button>
        <div className="upg-hero-icon">
          <svg viewBox="0 0 24 24" fill="none" stroke="#a3e635" strokeWidth="2">
            <path d="M3 9l9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z" />
            <polyline points="9 22 9 12 15 12 15 22" />
          </svg>
        </div>
        <h1 className="upg-hero-title">Grow further with the right plan</h1>
        <p className="upg-hero-sub">
          Lower fees, more listings, and priority placement as your store scales — cancel anytime.
        </p>
      </div>

      <div className="upg-plan-grid">
        {PLAN_ORDER.map((key) => {
          const plan = PLANS[key];
          const isActive = activePlan === key;
          return (
            <button
              key={key}
              className={`upg-plan-card${isActive ? " active" : ""}`}
              style={isActive ? { borderColor: `${plan.color}88`, boxShadow: `0 0 0 1px ${plan.color}55` } : undefined}
              onClick={() => selectPlan(key)}
            >
              {key === "growth" && <span className="upg-plan-chip">Most popular</span>}
              <div className="upg-plan-name">{plan.name}</div>
              <div className="upg-plan-price">
                {formatBalance(plan.price).replace(/\.00$/, "")}
                <small>/month</small>
              </div>
              <div className="upg-plan-tagline">{plan.tagline}</div>
              <div className="upg-plan-pills">
                {plan.pills.map((text) => (
                  <span key={text} className="upg-plan-pill" style={{ color: plan.color, borderColor: `${plan.color}55` }}>
                    {text}
                  </span>
                ))}
              </div>
            </button>
          );
        })}
      </div>

      <div className="upg-detail-panel">
        <div className="upg-detail-left">
          <div className="upg-detail-name">
            {p.name}
            {activePlan === "growth" && <span className="upg-plan-chip">Most popular</span>}
          </div>
          {currency !== "USD" && (
            <div className="upg-currency-note">Billed in USD via PayPal — shown converted to {currency}</div>
          )}
          <ul className="upg-feature-list">
            {p.features.map((f) => (
              <li key={f.text} className={f.on ? "" : "is-dim"}>
                {f.on ? <CheckIcon color={p.color} /> : <XIcon />}
                {f.text}
              </li>
            ))}
          </ul>
        </div>

        <div className="upg-detail-right">
          {isCurrentPlan ? (
            <div className="upg-current-banner">✓ This is your current plan</div>
          ) : (
            <>
              {showSubscribeBtn ? (
                <button
                  className="upg-subscribe-cta"
                  style={{ background: p.color, color: "#000" }}
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
              <div ref={paypalContainerRef} />
            </>
          )}
          {msg.text && <div className={`upg-msg${msg.kind ? ` ${msg.kind}` : ""}`}>{msg.text}</div>}
          <p className="upg-note">Secure payment via PayPal · Cancel anytime</p>
        </div>
      </div>

      <div className="upg-section">
        <h2 className="upg-section-title">Compare every plan</h2>
        <div className="upg-compare-table-wrap">
          <table className="upg-compare-table">
            <thead>
              <tr>
                <th />
                {PLAN_ORDER.map((key) => (
                  <th key={key} style={{ color: PLANS[key].color }}>
                    {PLANS[key].name}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {COMPARISON_ROWS.map((row) => (
                <tr key={row.label}>
                  <td className="upg-compare-label">{row.label}</td>
                  {PLAN_ORDER.map((key) => (
                    <td key={key}>{row.values[key]}</td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      <div className="upg-section">
        <h2 className="upg-section-title">Frequently asked questions</h2>
        <div className="upg-faq-list">
          {FAQS.map((item, i) => (
            <div key={item.q} className={`upg-faq-item${openFaq === i ? " open" : ""}`}>
              <button className="upg-faq-q" onClick={() => setOpenFaq(openFaq === i ? null : i)}>
                {item.q}
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round" className="upg-faq-chevron">
                  <polyline points="6 9 12 15 18 9" />
                </svg>
              </button>
              {openFaq === i && <div className="upg-faq-a">{item.a}</div>}
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
