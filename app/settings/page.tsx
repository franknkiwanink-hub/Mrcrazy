"use client";

import { Suspense, useEffect, useState } from "react";
import { useSearchParams } from "next/navigation";
import SiteriftyLoader from "@/components/layout/SiteriftyLoader";
import SettingsSidebar, { type SettingsPanelId } from "@/components/settings/SettingsSidebar";
import { useSettingsState } from "@/lib/useSettingsState";
import { useAuth } from "@/lib/AuthContext";
import SignInRequired from "@/components/auth/SignInRequired";
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
  const { user, loading: authLoading } = useAuth();
  const { state, setState, loading } = useSettingsState();
  const { openDisputePicker } = useDisputePicker();

  // Each panel renders its own header (icon + title + description, see
  // e.g. AccountPanel's .detail-panel-header) at the very top of
  // .detail-panel. Without this, switching panels while scrolled down
  // keeps #detailPanel's old scrollTop, so the newly-selected panel's own
  // header/title never appears — it's just sitting off-screen above
  // whatever the scroll position happened to land on, making the panel
  // look header-less instead of merely scrolled.
  useEffect(() => {
    document.getElementById("detailPanel")?.scrollTo({ top: 0 });
  }, [activePanel]);

  // <main> has min-height:100vh globally, so a hard height on this page's
  // own wrapper (rather than the min-height it had) plus marginTop:92 —
  // matching every other real page's clearance for the fixed Header +
  // AnnouncementBar — keeps this route exactly one viewport tall, same
  // as the original fixed-overlay version, without needing to lock
  // document scroll to fake that. Only .settings-sidebar / .detail-panel
  // (each their own overflow-y:auto box) scroll internally; the document
  // itself doesn't need to move at all since this wrapper is already
  // exactly the remaining viewport height.

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

  // Direct visits (bookmark, deep link, browser back) have no prior
  // click to have already gated this behind requireAuth — same gap
  // /myprofile had before SignInRequired was added there (see that
  // page's own comment). auth.loading / user === undefined is the
  // "we don't know yet" state — same check useAuth's own docs specify —
  // so a page refresh doesn't flash the sign-in prompt for a visitor
  // who actually is signed in, just before their session resolves.
  if (authLoading || user === undefined) {
    return (
      <div
        style={{
          marginTop: 92,
          minHeight: "60vh",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          color: "rgba(255,255,255,0.4)",
        }}
      >
        Loading…
      </div>
    );
  }

  if (!user) {
    return (
      <SignInRequired
        title="Sign in to view your settings"
        description="Your account, security, billing, and privacy settings are only visible once you're signed in."
      />
    );
  }

  return (
    <div
      style={{
        // Was position:fixed;inset:0 — that covered the entire viewport,
        // which also hid <Footer/> (rendered right after <main> in the
        // root layout) behind it, same bug fixed on /myprofile's
        // #profileModal. marginTop:92 clears the real fixed Header (52px)
        // + AnnouncementBar (40px) — same 92px convention every other
        // real page uses — and height (not min-height) locks this
        // wrapper to exactly the remaining viewport, so .main-content's
        // flex:1 + .detail-panel's overflow-y:auto keep working as a
        // real two-pane scroll UI without needing document scroll locked
        // to fake it.
        marginTop: 92,
        height: "calc(100dvh - 92px)",
        display: "flex",
        flexDirection: "column",
        background: "var(--mp-bg, #050508)",
      }}
    >
      {/* Real site Header + AnnouncementBar (both fixed, 92px total)
          already provide navigation here — AnnouncementBar swaps its
          Upgrade/Manage-Plan button for a Back button on this route
          (see AnnouncementBar.tsx's onBackRoute). No page-local header
          needed. */}
      <div className="main-content" style={{ flex: 1, minHeight: 0 }}>
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
