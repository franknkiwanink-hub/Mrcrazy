"use client";

import { Suspense, useEffect, useState } from "react";
import { useSearchParams } from "next/navigation";
import SiteriftyLoader from "@/components/layout/SiteriftyLoader";
import SettingsSidebar, { type SettingsPanelId } from "@/components/settings/SettingsSidebar";
import { useSettingsState } from "@/lib/useSettingsState";
import AccountPanel from "@/components/settings/panels/AccountPanel";
import SecurityPanel from "@/components/settings/panels/SecurityPanel";
import NotificationsPanel from "@/components/settings/panels/NotificationsPanel";
import AppearancePanel from "@/components/settings/panels/AppearancePanel";
import PrivacyPanel from "@/components/settings/panels/PrivacyPanel";
import BillingPanel from "@/components/settings/panels/BillingPanel";
import PaymentsPanel from "@/components/settings/panels/PaymentsPanel";
import ApiPanel from "@/components/settings/panels/ApiPanel";
import WebhooksPanel from "@/components/settings/panels/WebhooksPanel";
import SessionsPanel from "@/components/settings/panels/SessionsPanel";
import ReferralsPanel from "@/components/settings/panels/ReferralsPanel";
import AnalyticsPanel from "@/components/settings/panels/AnalyticsPanel";
import SellerBadgePanel from "@/components/settings/panels/SellerBadgePanel";
import DangerZonePanel from "@/components/settings/panels/DangerZonePanel";
import { useDisputePicker } from "@/components/dispute/DisputePickerProvider";

// Labels for panels not yet built, so the placeholder is specific rather
// than generic ("Appearance settings" not just "Coming soon").
const PANEL_LABELS: Record<SettingsPanelId, string> = {
  account: "Account",
  security: "Security",
  notifications: "Notifications",
  appearance: "Appearance",
  billing: "Billing & Plans",
  payments: "Payment Methods",
  api: "API & Integrations",
  webhooks: "Webhooks",
  privacy: "Privacy & Data",
  sessions: "Active Sessions",
  referrals: "Referrals",
  analytics: "Listing Analytics",
  sellerbadge: "Seller Badge",
  danger: "Danger Zone",
};

const VALID_PANELS = new Set<string>(Object.keys(PANEL_LABELS));

// AgentModal's "Go to API Settings" button links here with ?panel=api so
// the user lands directly on the right panel instead of always defaulting
// to Account. useSearchParams needs a Suspense boundary in the App Router,
// so the actual page body lives in SettingsPageInner below.
function SettingsPageInner() {
  const searchParams = useSearchParams();
  const initialPanel = searchParams.get("panel");
  const [activePanel, setActivePanel] = useState<SettingsPanelId>(
    initialPanel && VALID_PANELS.has(initialPanel) ? (initialPanel as SettingsPanelId) : "account"
  );
  const { state, setState, loading } = useSettingsState();
  const { openDisputePicker } = useDisputePicker();

  // <main> has min-height:100vh globally, so with this page's own 92px
  // top margin the document is always taller than the viewport — meaning
  // the page itself scrolls no matter what overflow rules the inner
  // .main-content/.detail-panel use. The original had this exact problem
  // solved for free by being a position:fixed full-screen modal (so it
  // was never part of document flow at all). This locks html+body the
  // same stronger way .mnt-mode already does elsewhere in this codebase
  // (plain overflow:hidden alone doesn't reliably stop rubber-banding on
  // mobile Safari/Chrome per that rule's own comment) — so the document
  // can't move at all while Settings is open, and only
  // .settings-sidebar / .detail-panel (each overflow-y:auto) can scroll.
  useEffect(() => {
    const html = document.documentElement;
    const { body } = document;
    const prevHtmlOverflow = html.style.overflow;
    const prevHtmlHeight = html.style.height;
    const prevBodyOverflow = body.style.overflow;
    const prevOverscroll = (html.style as any).overscrollBehavior;
    const prevTouchAction = (html.style as any).touchAction;

    html.style.overflow = "hidden";
    html.style.height = "100%";
    body.style.overflow = "hidden";
    (html.style as any).overscrollBehavior = "none";
    (html.style as any).touchAction = "none";

    return () => {
      html.style.overflow = prevHtmlOverflow;
      html.style.height = prevHtmlHeight;
      body.style.overflow = prevBodyOverflow;
      (html.style as any).overscrollBehavior = prevOverscroll;
      (html.style as any).touchAction = prevTouchAction;
    };
  }, []);

  function renderPanel() {
    if (loading) {
      return <div style={{ opacity: 0.5, padding: "40px 0", textAlign: "center" }}>Loading…</div>;
    }
    switch (activePanel) {
      case "account":
        return <AccountPanel state={state} setState={setState} />;
      case "security":
        return <SecurityPanel state={state} setState={setState} />;
      case "notifications":
        return <NotificationsPanel state={state} setState={setState} />;
      case "appearance":
        return <AppearancePanel state={state} setState={setState} />;
      case "privacy":
        return <PrivacyPanel state={state} setState={setState} />;
      case "billing":
        return <BillingPanel state={state} setState={setState} />;
      case "payments":
        return <PaymentsPanel state={state} setState={setState} />;
      case "api":
        return <ApiPanel state={state} setState={setState} />;
      case "webhooks":
        return <WebhooksPanel state={state} setState={setState} />;
      case "sessions":
        return <SessionsPanel state={state} setState={setState} />;
      case "referrals":
        return <ReferralsPanel state={state} setState={setState} />;
      case "analytics":
        return <AnalyticsPanel state={state} setState={setState} />;
      case "sellerbadge":
        return <SellerBadgePanel state={state} setState={setState} />;
      case "danger":
        return <DangerZonePanel state={state} setState={setState} />;
      default:
        return (
          <div style={{ padding: "40px 0", textAlign: "center", opacity: 0.6 }}>
            <p>
              {PANEL_LABELS[activePanel]} is a separate step in the migration — not built yet.
            </p>
          </div>
        );
    }
  }

  return (
    <div
      style={{
        position: "fixed",
        top: 92,
        left: 0,
        right: 0,
        bottom: 0,
        // main collapses to 0 height once this panel takes itself out
        // of flow, so Footer (which sits right after <main> with no
        // z-index of its own) slides up underneath this point and,
        // being later in the DOM at the same auto stacking level, was
        // painting over this fixed panel instead of behind it. An
        // explicit z-index here (above Footer's implicit auto/0, below
        // Header's 9990 so the top bar stays usable) fixes the stacking
        // order without needing to touch Footer or Header at all.
        zIndex: 10,
        display: "flex",
      }}
    >
      <div className="main-content" style={{ height: "100%" }}>
        <SettingsSidebar
          activePanel={activePanel}
          onSelectPanel={setActivePanel}
          onRaiseDispute={openDisputePicker}
        />
        <div className="detail-panel" id="detailPanel">
          {renderPanel()}
        </div>
      </div>
    </div>
  );
}

export default function SettingsPage() {
  return (
    <Suspense fallback={<SiteriftyLoader />}>
      <SettingsPageInner />
    </Suspense>
  );
}
