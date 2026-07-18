"use client";

import { useAuth } from "@/lib/AuthContext";
import { usePlansModal } from "@/components/billing/PlansModalProvider";

// Ports the announcement-bar half of announcement-settings.js (index.html
// lines 3-28): plan badge label/class + the Upgrade (free plan) or
// Manage Plan (paid plan) action button. Both open PlansModalProvider's
// modal — one of its 5 original trigger points (see that provider's own
// top-of-file comment), the last of which wasn't wired up until now.
const PLAN_META: Record<string, { label: string; cls: string }> = {
  free: { label: "Free", cls: "plan-free" },
  starter: { label: "Starter", cls: "plan-starter" },
  growth: { label: "Growth", cls: "plan-growth" },
  pro: { label: "Pro", cls: "plan-pro" },
};

export default function AnnouncementBar() {
  const { user, profile } = useAuth();
  const { openPlansModal } = usePlansModal();

  const displayName = user
    ? profile?.username || user.email?.split("@")[0] || "User"
    : "Guest";
  const plan = profile?.plan || "free";
  const meta = PLAN_META[plan] || PLAN_META.free;

  return (
    <div id="announcement-bar" data-plan={plan}>
      <div className="ab-left">
        <span className="ab-username" id="ab-user">
          {displayName}
        </span>
        <span className={`plan-badge ${meta.cls}`} id="ab-badge">
          {meta.label}
        </span>
      </div>
      {/* Unread-messages / notifications action slot, driven by Js/inbox.js
          originally — wired up in a later step. */}
      <div id="ab-action">
        {plan === "free" ? (
          <div className="btn-upgrade-wrap">
            <button className="btn-upgrade" onClick={() => openPlansModal()}>
              <svg
                className="upgrade-icon"
                width="13"
                height="13"
                viewBox="0 0 24 24"
                fill="none"
                xmlns="http://www.w3.org/2000/svg"
              >
                <path
                  className="star"
                  d="M12 2.5l2.6 5.3 5.9.86-4.25 4.14 1 5.88L12 16.1l-5.25 2.58 1-5.88L3.5 8.66l5.9-.86z"
                  fill="rgba(216,180,254,0.95)"
                  stroke="rgba(167,139,250,0.5)"
                  strokeWidth="0.5"
                  strokeLinejoin="round"
                />
              </svg>
              Upgrade
            </button>
          </div>
        ) : (
          <button className="btn-manage" onClick={() => openPlansModal()}>
            Manage Plan
          </button>
        )}
      </div>
    </div>
  );
}
