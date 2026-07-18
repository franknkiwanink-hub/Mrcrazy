"use client";

import { useRef, useState, type ReactElement } from "react";
import { useRouter } from "next/navigation";
import { doc, getDoc } from "firebase/firestore";
import { auth, db } from "@/lib/firebase";
import { useAuth } from "@/lib/AuthContext";
import { useProfileData } from "@/lib/useProfileData";
import { useBoostModal } from "@/components/boost/BoostModalProvider";
import { useAgentModal } from "@/components/agent/AgentModalProvider";
import { useEditListingModal } from "@/components/listing/EditListingModalProvider";
import { usePlansModal } from "@/components/billing/PlansModalProvider";
import { useToast } from "@/lib/useToast";
import { useLimits } from "@/lib/useLimits";
import SellerBadges from "@/components/seller/SellerBadges";
import { useLogoutModal } from "@/components/layout/LogoutModalProvider";
import { useDisputePicker } from "@/components/dispute/DisputePickerProvider";
import { buildListingSlug } from "@/lib/slug";

// Ports the PROFILE MODAL from Js/profile.js + Js/profile-early.js
// (index.html lines 12099-12279 and 17189-18238) as a real routed page at
// /myprofile, rather than a floating global modal — same "route-backed
// section" convention SellerDashboard.tsx already established for
// /dashboard. All of #profileModal's original markup/classnames are kept
// verbatim (see app/globals.css's already-ported .pm-* rules) so this
// reuses that styling directly instead of re-implementing it.
//
// Known gaps, called out inline where relevant rather than silently
// papered over:
//  - GitHub connect/disconnect calls /api/github, which was never present
//    in the backend zip this port worked from (not just unported — the
//    endpoint doesn't exist anywhere in this codebase). The UI below is
//    wired exactly as the original was, so it starts working the moment
//    that route exists; until then the Connect button will error out via
//    its own existing failure toast.
//  - The avatar cooldown pre-check calls /api/limits with
//    action:'check-profilepic-change' — now real (see
//    app/api/_lib/limits.js's handleCheckProfilePic + the new /api/limits
//    route), same pattern as the username/email checks. Was previously a
//    known gap: the action existed nowhere server-side, so this used to
//    always silently succeed with no cooldown enforced at all.
//  - The listing Edit button opens EditListingModal (via
//    useEditListingModal().openEdit) — real edit/delete now, not a
//    redirect to /sell. onSaved/onDeleted both call refreshListings()
//    so this page's own list re-fetches rather than duplicating the
//    modal's save/delete logic locally.

const TYPE_ICONS: Record<string, ReactElement> = {
  website: (
    <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
      <circle cx="12" cy="12" r="10" />
      <line x1="2" y1="12" x2="22" y2="12" />
      <path d="M12 2a15.3 15.3 0 0 1 4 10 15.3 15.3 0 0 1-4 10 15.3 15.3 0 0 1-4-10 15.3 15.3 0 0 1 4-10z" />
    </svg>
  ),
  app: (
    <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
      <rect x="2" y="3" width="7" height="7" rx="1" />
      <rect x="15" y="3" width="7" height="7" rx="1" />
      <rect x="2" y="14" width="7" height="7" rx="1" />
      <rect x="15" y="14" width="7" height="7" rx="1" />
    </svg>
  ),
  game: (
    <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
      <rect x="2" y="6" width="20" height="12" rx="2" />
      <path d="M12 12h.01" />
      <path d="M17 12h.01" />
      <path d="M7 12h.01" />
    </svg>
  ),
};

function pmPlanClass(plan: string) {
  return "pm-plan-" + (["starter", "growth", "pro"].includes(plan) ? plan : "free");
}

type ParentTab = "profile" | "listings" | "favorites";
type SubTab = "account" | "public";

function ConfirmOverlay({
  title,
  message,
  confirmLabel,
  danger,
  busy,
  onCancel,
  onConfirm,
}: {
  title: string;
  message: string;
  confirmLabel: string;
  danger?: boolean;
  busy?: boolean;
  onCancel: () => void;
  onConfirm: () => void;
}) {
  return (
    <div
      style={{
        position: "fixed",
        inset: 0,
        background: "rgba(0,0,0,0.7)",
        zIndex: 10001,
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
      }}
      onClick={() => !busy && onCancel()}
    >
      <div
        style={{ background: "#141420", padding: 24, borderRadius: 12, color: "#fff", maxWidth: 360 }}
        onClick={(e) => e.stopPropagation()}
      >
        <h3 style={{ marginTop: 0 }}>{title}</h3>
        <p style={{ opacity: 0.7, fontSize: 14 }}>{message}</p>
        <div style={{ display: "flex", gap: 8, justifyContent: "flex-end", marginTop: 16 }}>
          <button onClick={onCancel} disabled={busy}>
            Cancel
          </button>
          <button
            onClick={onConfirm}
            disabled={busy}
            style={danger ? { background: "#f87171", color: "#000", fontWeight: 700 } : undefined}
          >
            {busy ? "Working…" : confirmLabel}
          </button>
        </div>
      </div>
    </div>
  );
}

export default function MyProfileHub({ initialTab }: { initialTab?: ParentTab }) {
  const router = useRouter();
  const { user } = useAuth();
  const { openBoost } = useBoostModal();
  const { openAgent } = useAgentModal();
  const { openEdit } = useEditListingModal();
  const { openPlansModal } = usePlansModal();
  const { toast, ToastHost } = useToast();
  const { limits } = useLimits();

  const {
    profile,
    profileLoading,
    profileError,
    listings,
    listingsLoading,
    listingsError,
    favorites,
    favoritesLoading,
    unreadDeals,
    saveAccount,
    savePublicProfile,
    uploadAvatar,
    deleteListing,
    removeFavorite,
    cancelPlan,
    refreshListings,
  } = useProfileData();

  const [parentTab, setParentTab] = useState<ParentTab>(initialTab || "profile");
  const [subTab, setSubTab] = useState<SubTab>("account");

  const [usernameInput, setUsernameInput] = useState("");
  const [contactEmailInput, setContactEmailInput] = useState("");
  const [accountErr, setAccountErr] = useState("");
  const [savingAccount, setSavingAccount] = useState<"idle" | "saving" | "saved">("idle");

  const [bioInput, setBioInput] = useState("");
  const [showBio, setShowBio] = useState(true);
  const [showEmail, setShowEmail] = useState(false);
  const [savingPublic, setSavingPublic] = useState<"idle" | "saving" | "saved">("idle");

  const [avatarUploading, setAvatarUploading] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const [deleteTarget, setDeleteTarget] = useState<string | null>(null);
  const [deleting, setDeleting] = useState(false);
  const [cancelConfirming, setCancelConfirming] = useState(false);
  const [cancelling, setCancelling] = useState(false);
  const { confirmLogout } = useLogoutModal();
  const { openDisputePicker } = useDisputePicker();

  // Sync form fields whenever fresh profile data lands (initial load, or
  // after a successful save re-fetch) — same as pmRender re-populating
  // the inputs on every call.
  const lastSyncedUsername = useRef<string | null>(null);
  if (!profileLoading && lastSyncedUsername.current !== profile.username) {
    lastSyncedUsername.current = profile.username;
    setUsernameInput(profile.username);
    setContactEmailInput(profile.contactEmail);
    setBioInput(profile.bio);
    setShowBio(profile.showBio);
    setShowEmail(profile.showEmail);
  }

  async function handleAvatarChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    e.target.value = "";
    if (!file) return;
    if (!file.type.startsWith("image/")) {
      toast("Please choose an image file.");
      return;
    }
    if (file.size > 10 * 1024 * 1024) {
      toast("Image must be under 10MB.");
      return;
    }
    setAvatarUploading(true);
    try {
      await uploadAvatar(file);
    } catch (err: any) {
      toast("Upload failed: " + (err.message || "unknown error"));
    } finally {
      setAvatarUploading(false);
    }
  }

  async function handleSaveAccount() {
    setAccountErr("");
    const newUsername = usernameInput.trim();
    const newContactEmail = contactEmailInput.trim();
    if (!newUsername) {
      setAccountErr("Username cannot be empty.");
      return;
    }
    if (newContactEmail && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(newContactEmail)) {
      setAccountErr("Enter a valid contact email.");
      return;
    }
    if (newUsername.length < (limits.username.minLength ?? 5)) {
      setAccountErr(`Username must be at least ${limits.username.minLength ?? 5} characters.`);
      return;
    }
    if (newUsername.length > (limits.username.maxLength ?? 15)) {
      setAccountErr(`Username cannot exceed ${limits.username.maxLength ?? 15} characters.`);
      return;
    }
    if (!new RegExp(limits.username.pattern || "^[a-zA-Z0-9_.-]+$").test(newUsername)) {
      setAccountErr(limits.username.patternHint || "Username can only contain letters, numbers, underscores, hyphens, and dots.");
      return;
    }
    setSavingAccount("saving");
    try {
      await saveAccount(newUsername, newContactEmail);
      setSavingAccount("saved");
      setTimeout(() => setSavingAccount("idle"), 1800);
    } catch (err: any) {
      setAccountErr(err.message || "Save failed.");
      setSavingAccount("idle");
    }
  }

  async function handleSavePublic() {
    setSavingPublic("saving");
    try {
      await savePublicProfile(bioInput.trim(), showBio, showEmail);
      setSavingPublic("saved");
      setTimeout(() => setSavingPublic("idle"), 1800);
    } catch {
      setSavingPublic("idle");
      toast("Save failed. Please try again.");
    }
  }

  async function handleDeleteListing() {
    if (!deleteTarget) return;
    setDeleting(true);
    try {
      await deleteListing(deleteTarget);
      setDeleteTarget(null);
    } catch {
      toast("Could not delete this listing. Please try again.");
    } finally {
      setDeleting(false);
    }
  }

  async function handleBoost(listingId: string) {
    let listingData: any = null;
    try {
      const snap = await getDoc(doc(db, "listings", listingId));
      if (snap.exists()) listingData = { id: snap.id, ...snap.data() };
    } catch {
      /* fall back to id-only */
    }
    openBoost(listingId, listingData);
  }

  async function handleCancelPlan() {
    setCancelling(true);
    try {
      await cancelPlan();
      setCancelConfirming(false);
      toast(`Your ${planLabel} plan has been cancelled. You'll stay on ${planLabel} until the end of your billing period, then revert to Free.`);
    } catch (err: any) {
      toast(err.message || "Cancellation failed. Please try again.");
    } finally {
      setCancelling(false);
    }
  }

  const planLabel = profile.plan.charAt(0).toUpperCase() + profile.plan.slice(1);
  const active = listings.filter((l) => l.status !== "draft").length;
  const drafts = listings.filter((l) => l.status === "draft").length;
  let listingCountText = active > 0 ? `${active} active listing${active !== 1 ? "s" : ""}` : "No active listings";
  if (drafts > 0) listingCountText += ` · ${drafts} draft${drafts !== 1 ? "s" : ""}`;

  return (
    <div id="profileModal" style={{ position: "relative", minHeight: "100vh" }}>
      <div className="pm-modal" style={{ minHeight: "100vh" }}>
        <div className="pm-modal-header">
          <div className="pm-left-title">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2" strokeLinecap="round" strokeLinejoin="round" />
              <circle cx="12" cy="7" r="4" strokeLinecap="round" strokeLinejoin="round" />
            </svg>
            <span>My Profile</span>
          </div>
          <button className="pm-close-btn" onClick={() => router.push("/")}>
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <line x1="18" y1="6" x2="6" y2="18" strokeLinecap="round" />
              <line x1="6" y1="6" x2="18" y2="18" strokeLinecap="round" />
            </svg>
            Close
          </button>
        </div>

        <div className="pm-modal-content">
          {/* Identity */}
          <div className="pm-identity" style={{ position: "relative", zIndex: 1 }}>
            <div className="pm-avatar-wrapper">
              {profileLoading ? (
                <span className="pm-skel pm-skel-avatar" />
              ) : (
                <>
                  <div className="pm-avatar-ring" />
                  <button
                    type="button"
                    className="pm-avatar-circle"
                    title="Tap to change your profile picture"
                    style={{ cursor: "pointer", padding: 0, border: "none", position: "relative", overflow: "hidden", opacity: avatarUploading ? 0.6 : 1 }}
                    onClick={() => fileInputRef.current?.click()}
                  >
                    {profile.profilePic ? (
                      <img src={profile.profilePic} style={{ width: "100%", height: "100%", borderRadius: "50%", objectFit: "cover" }} alt="" />
                    ) : (
                      <span>{profile.username.slice(0, 2).toUpperCase()}</span>
                    )}
                    <div
                      className="pm-avatar-hover"
                      style={{ position: "absolute", inset: 0, background: "rgba(0,0,0,0.55)", opacity: 0, transition: "opacity 0.15s", display: "flex", alignItems: "center", justifyContent: "center" }}
                    >
                      <svg viewBox="0 0 24 24" fill="none" stroke="#fff" strokeWidth="2" style={{ width: 18, height: 18 }}>
                        <path d="M12 16V8M12 8l-3 3M12 8l3 3" />
                        <rect x="3" y="3" width="18" height="18" rx="2" />
                      </svg>
                    </div>
                  </button>
                  <input
                    ref={fileInputRef}
                    type="file"
                    accept="image/png,image/jpeg,image/gif,image/webp"
                    style={{ display: "none" }}
                    onChange={handleAvatarChange}
                  />
                </>
              )}
            </div>

            {profileLoading ? (
              <>
                <span className="pm-skel pm-skel-name" />
                <span className="pm-skel pm-skel-handle" />
              </>
            ) : (
              <>
                <div className="pm-username-text">
                  <span className="pm-displayname-text">{profile.username}</span>
                  <SellerBadges seller={{ plan: profile.plan, followerCount: profile.followerCount, dealsCompleted: profile.dealsCompleted }} />
                </div>
                <div className="pm-handle-text">@{profile.username.toLowerCase().replace(/\s+/g, "")}</div>
                <div className="pm-email-text">{user?.email || ""}</div>
                <div style={{ display: "flex", alignItems: "center", gap: "0.5rem", marginTop: "0.3rem" }}>
                  <span className={`pm-plan-badge ${pmPlanClass(profile.plan)}`}>{planLabel}</span>
                </div>
              </>
            )}
            {profileError ? <div style={{ color: "#f87171", fontSize: 12, marginTop: 8 }}>{profileError}</div> : null}
          </div>

          {/* Messages & Deals */}
          <button className="pm-inbox-btn" style={{ position: "relative", zIndex: 1 }} onClick={() => router.push("/messages")}>
            <span className="pm-inbox-btn-left">
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z" />
              </svg>
              <span className="pm-inbox-label">Messages &amp; Deals</span>
            </span>
            <span className="pm-inbox-badge-wrap">
              {unreadDeals > 0 ? <span className="pm-inbox-unread-badge">{unreadDeals > 99 ? "99+" : unreadDeals}</span> : null}
              <svg className="pm-inbox-arrow" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M9 18l6-6-6-6" />
              </svg>
            </span>
          </button>

          {/* AI Agent / Dashboard */}
          <div className="pm-quick-row" style={{ position: "relative", zIndex: 1 }}>
            <button className="pm-quick-btn pm-ai-btn" onClick={openAgent}>
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <rect x="3" y="11" width="18" height="10" rx="2" />
                <circle cx="12" cy="5" r="2" />
                <path d="M12 7v4" />
                <line x1="8" y1="16" x2="8" y2="16" />
                <line x1="16" y1="16" x2="16" y2="16" />
              </svg>
              <span>AI Agent</span>
            </button>
            <button className="pm-quick-btn pm-dash-btn" type="button" onClick={() => router.push("/dashboard")}>
              <span className="pm-dash-chart" aria-hidden="true">
                <span className="pm-dash-bar" />
                <span className="pm-dash-bar" />
                <span className="pm-dash-bar" />
                <span className="pm-dash-bar" />
              </span>
              <span>Dashboard</span>
            </button>
          </div>

          {/* Plan */}
          <div className="pm-plan-card" style={{ position: "relative", zIndex: 1 }}>
            <div style={{ display: "flex", flexDirection: "column", gap: "0.25rem", minWidth: 0 }}>
              <div style={{ display: "flex", alignItems: "center", gap: "0.5rem" }}>
                <span className={`pm-sub-badge ${pmPlanClass(profile.plan)}`}>{planLabel}</span>
                <span style={{ fontSize: "0.78rem", color: "var(--mp-text-sec)" }}>
                  {profile.plan === "free" ? "Free plan · Upgrade to unlock more features" : `${planLabel} plan · Active`}
                </span>
              </div>
              <span style={{ fontSize: "0.73rem", color: "var(--mp-text-muted)" }}>
                {listingsLoading ? "Loading listings…" : listingCountText}
              </span>
            </div>
            <div style={{ display: "flex", flexDirection: "column", alignItems: "flex-end", gap: "0.4rem", flexShrink: 0 }}>
              {profile.plan === "free" ? (
                <button className="pm-manage-plan-btn" onClick={() => openPlansModal()}>
                  Upgrade
                </button>
              ) : (
                <button className="pm-cancel-plan-btn" onClick={() => setCancelConfirming(true)}>
                  Cancel Plan
                </button>
              )}
            </div>
          </div>

          {/* Parent tabs */}
          <div className="pm-parent-tab-row" style={{ position: "relative", zIndex: 1 }}>
            <button className={`pm-parent-tab${parentTab === "profile" ? " active" : ""}`} onClick={() => setParentTab("profile")}>
              <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2" />
                <circle cx="12" cy="7" r="4" />
              </svg>
              <span>My Profile</span>
            </button>
            <button className={`pm-parent-tab${parentTab === "listings" ? " active" : ""}`} onClick={() => setParentTab("listings")}>
              <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
                <rect x="3" y="3" width="7" height="7" rx="1" />
                <rect x="14" y="3" width="7" height="7" rx="1" />
                <rect x="3" y="14" width="7" height="7" rx="1" />
                <rect x="14" y="14" width="7" height="7" rx="1" />
              </svg>
              <span>My Listings</span>
            </button>
            <button className={`pm-parent-tab${parentTab === "favorites" ? " active" : ""}`} onClick={() => setParentTab("favorites")}>
              <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M20.84 4.61a5.5 5.5 0 0 0-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 0 0-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 0 0 0-7.78z" />
              </svg>
              <span>Favorites</span>
            </button>
          </div>

          {/* My Profile tab */}
          {parentTab === "profile" && (
            <div className="pm-parent-content active" style={{ position: "relative", zIndex: 1 }}>
              <div className="pm-sub-tab-row">
                <button className={`pm-sub-tab${subTab === "account" ? " active" : ""}`} onClick={() => setSubTab("account")}>
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
                    <circle cx="12" cy="12" r="3" />
                    <path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 1 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-4 0v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 1 1-2.83-2.83l.06-.06A1.65 1.65 0 0 0 4.6 15a1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1 0-4h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 1 1 2.83-2.83l.06.06A1.65 1.65 0 0 0 9 4.6a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 4 0v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 1 1 2.83 2.83l-.06.06A1.65 1.65 0 0 0 19.4 9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1z" />
                  </svg>
                  <span>Account</span>
                </button>
                <button className={`pm-sub-tab${subTab === "public" ? " active" : ""}`} onClick={() => setSubTab("public")}>
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
                    <circle cx="12" cy="12" r="10" />
                    <line x1="2" y1="12" x2="22" y2="12" />
                    <path d="M12 2a15.3 15.3 0 0 1 4 10 15.3 15.3 0 0 1-4 10 15.3 15.3 0 0 1-4-10 15.3 15.3 0 0 1 4-10z" />
                  </svg>
                  <span>Public Profile</span>
                </button>
              </div>

              {subTab === "account" && (
                <div className="pm-sub-tab-content active">
                  <div className="pm-input-group">
                    <label>Username</label>
                    <input
                      className="pm-input-field"
                      type="text"
                      placeholder="Your username"
                      value={usernameInput}
                      onChange={(e) => setUsernameInput(e.target.value)}
                      minLength={limits.username.minLength}
                      maxLength={limits.username.maxLength}
                    />
                    <span className="pm-hint">
                      Can be changed once every {Math.round((limits.username.changeCooldownMs ?? 0) / (24 * 60 * 60 * 1000))} days.
                    </span>
                  </div>
                  <div className="pm-input-group">
                    <label>Contact email</label>
                    <input
                      className="pm-input-field"
                      type="email"
                      placeholder="contact@example.com"
                      value={contactEmailInput}
                      onChange={(e) => setContactEmailInput(e.target.value)}
                    />
                    <span className="pm-hint">
                      Up to {limits.contactEmail.maxChangesPerPeriod ?? 2} changes every{" "}
                      {Math.round((limits.contactEmail.periodMs ?? 0) / (24 * 60 * 60 * 1000))} days.
                    </span>
                  </div>
                  {accountErr ? (
                    <div style={{ color: "#f87171", fontSize: "0.8rem", padding: "0.5rem 0.8rem", background: "rgba(248,113,113,0.08)", borderRadius: "0.6rem", border: "1px solid rgba(248,113,113,0.2)" }}>
                      {accountErr}
                    </div>
                  ) : null}
                  <button className="pm-save-btn" onClick={handleSaveAccount} disabled={savingAccount === "saving"}>
                    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                      <path d="M19 21H5C3.89543 21 3 20.1046 3 19V5C3 3.89543 3.89543 3 5 3H16L21 8V19C21 20.1046 20.1046 21 19 21Z" />
                      <polyline points="17 21 17 13 7 13 7 21" />
                      <polyline points="7 3 7 8 15 8" />
                    </svg>
                    <span>{savingAccount === "saving" ? "Saving…" : savingAccount === "saved" ? "Saved ✓" : "Save changes"}</span>
                  </button>

                  <div className="pm-github-row" id="pmGithubSection">
                    <div style={{ display: "flex", alignItems: "center", gap: "0.75rem", minWidth: 0 }}>
                      <div className="pm-github-icon">
                        <svg width="17" height="17" viewBox="0 0 24 24" fill="#fff">
                          <path d="M12 0C5.37 0 0 5.37 0 12c0 5.31 3.435 9.795 8.205 11.385.6.105.825-.255.825-.57 0-.285-.015-1.23-.015-2.235-3.015.555-3.795-.735-4.035-1.41-.135-.345-.72-1.41-1.23-1.695-.42-.225-1.02-.78-.015-.795.945-.015 1.62.87 1.845 1.23 1.08 1.815 2.805 1.305 3.495.99.105-.78.42-1.305.765-1.605-2.67-.3-5.46-1.335-5.46-5.925 0-1.305.465-2.385 1.23-3.225-.12-.3-.54-1.53.12-3.18 0 0 1.005-.315 3.3 1.23.96-.27 1.98-.405 3-.405s2.04.135 3 .405c2.295-1.56 3.3-1.23 3.3-1.23.66 1.65.24 2.88.12 3.18.765.84 1.23 1.905 1.23 3.225 0 4.605-2.805 5.625-5.475 5.925.435.375.81 1.095.81 2.22 0 1.605-.015 2.895-.015 3.3 0 .315.225.69.825.57A12.02 12.02 0 0 0 24 12c0-6.63-5.37-12-12-12z" />
                        </svg>
                      </div>
                      <div style={{ minWidth: 0 }}>
                        <div className="pm-github-name">GitHub</div>
                        <div className="pm-github-status">
                          {profile.githubUsername ? (
                            <>
                              <span style={{ color: "var(--mp-accent)", fontWeight: 700 }}>✓ Connected</span>{" "}
                              <span style={{ color: "var(--mp-text-muted)" }}>@{profile.githubUsername}</span>
                            </>
                          ) : (
                            "Not connected"
                          )}
                        </div>
                      </div>
                    </div>
                    <div style={{ display: "flex", alignItems: "center", gap: "0.5rem", flexShrink: 0 }}>
                      {profile.githubUsername ? (
                        <button
                          className="pm-github-disconnect-btn"
                          onClick={async () => {
                            const user2 = auth.currentUser;
                            if (!user2) return;
                            try {
                              const idToken = await user2.getIdToken();
                              await fetch("/api/github?action=disconnect", {
                                method: "POST",
                                headers: { "Content-Type": "application/json" },
                                body: JSON.stringify({ idToken }),
                              });
                            } catch {
                              toast("Could not disconnect GitHub. Please try again.");
                            }
                          }}
                        >
                          Disconnect
                        </button>
                      ) : (
                        <button
                          className="pm-github-connect-btn"
                          onClick={async () => {
                            const user2 = auth.currentUser;
                            if (!user2) return;
                            try {
                              const idToken = await user2.getIdToken();
                              window.location.href = "/api/github?action=connect&idToken=" + encodeURIComponent(idToken);
                            } catch {
                              toast("Could not start GitHub connection. Please try again.");
                            }
                          }}
                        >
                          Connect
                        </button>
                      )}
                    </div>
                  </div>
                </div>
              )}

              {subTab === "public" && (
                <div className="pm-sub-tab-content active">
                  <div className="pm-input-group">
                    <label>Bio</label>
                    <textarea
                      className="pm-input-field"
                      placeholder="Tell buyers and sellers about yourself…"
                      value={bioInput}
                      onChange={(e) => setBioInput(e.target.value)}
                    />
                  </div>
                  <div className="pm-toggle-item">
                    <span className="pm-toggle-label">Show bio publicly</span>
                    <label className="pm-toggle-switch">
                      <input type="checkbox" checked={showBio} onChange={(e) => setShowBio(e.target.checked)} />
                      <span className="pm-slider" />
                    </label>
                  </div>
                  <div className="pm-toggle-item">
                    <span className="pm-toggle-label">Show email on profile</span>
                    <label className="pm-toggle-switch">
                      <input type="checkbox" checked={showEmail} onChange={(e) => setShowEmail(e.target.checked)} />
                      <span className="pm-slider" />
                    </label>
                  </div>
                  <button className="pm-save-btn" onClick={handleSavePublic} disabled={savingPublic === "saving"}>
                    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                      <path d="M19 21H5C3.89543 21 3 20.1046 3 19V5C3 3.89543 3.89543 3 5 3H16L21 8V19C21 20.1046 20.1046 21 19 21Z" />
                    </svg>
                    <span>{savingPublic === "saving" ? "Saving…" : savingPublic === "saved" ? "Saved ✓" : "Save public profile"}</span>
                  </button>
                </div>
              )}
            </div>
          )}

          {/* My Listings tab */}
          {parentTab === "listings" && (
            <div className="pm-parent-content active" style={{ position: "relative", zIndex: 1 }}>
              <div style={{ width: "100%" }}>
                {listingsLoading ? (
                  <div style={{ textAlign: "center", padding: "2rem", color: "var(--mp-text-muted)", fontSize: "0.9rem" }}>Loading your listings…</div>
                ) : listingsError ? (
                  <div style={{ textAlign: "center", padding: "2rem", color: "#555", fontSize: "0.88rem" }}>{listingsError}</div>
                ) : listings.length === 0 ? (
                  <div style={{ textAlign: "center", padding: "2.5rem 1rem", color: "#555", fontSize: "0.88rem" }}>You have no listings yet.</div>
                ) : (
                  <div className="pm-listings-grid">
                    {listings.map((l) => {
                      const thumb = (l.images && (l.images[2] || l.images[0])) || "";
                      const title = l.title || "Untitled";
                      const desc = l.description ? l.description.slice(0, 60) + (l.description.length > 60 ? "…" : "") : "";
                      return (
                        <div className="pm-listing-card" key={l.id}>
                          {thumb ? (
                            <img className="pm-listing-image" src={thumb} alt={title} loading="lazy" />
                          ) : (
                            <div className="pm-listing-image" style={{ background: "#111", display: "flex", alignItems: "center", justifyContent: "center" }}>
                              <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="#333" strokeWidth="1.5">
                                <rect x="3" y="3" width="18" height="18" rx="2" />
                                <path d="M3 9h18M9 21V9" />
                              </svg>
                            </div>
                          )}
                          <div className="pm-listing-info">
                            <div className="pm-listing-title">
                              {title}
                              {l.status === "draft" ? (
                                <span style={{ fontSize: "0.65rem", background: "#222", color: "#888", padding: "2px 8px", borderRadius: "1rem", marginLeft: 4 }}>Draft</span>
                              ) : null}
                            </div>
                            {desc ? <div className="pm-listing-desc">{desc}</div> : null}
                            <button className="pm-listing-boost" type="button" onClick={() => handleBoost(l.id)}>
                              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round">
                                <path d="M13 2 3 14h7l-1 8 10-12h-7l1-8z" />
                              </svg>
                              <span>BOOST LISTING</span>
                            </button>
                            <div className="pm-listing-actions-row">
                              <button
                                className="pm-listing-edit-btn"
                                type="button"
                                onClick={() =>
                                  openEdit(l.id, {
                                    onSaved: () => refreshListings(),
                                    onDeleted: () => refreshListings(),
                                  })
                                }
                              >
                                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                                  <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7" />
                                  <path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z" />
                                </svg>
                                Edit
                              </button>
                              <button className="pm-listing-delete-btn" type="button" onClick={() => setDeleteTarget(l.id)}>
                                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                                  <polyline points="3 6 5 6 21 6" />
                                  <path d="M19 6l-1 14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6" />
                                  <path d="M10 11v6M14 11v6" />
                                  <path d="M8 6V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2" />
                                </svg>
                                Delete
                              </button>
                            </div>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>
              <button className="pm-add-listing-btn" onClick={() => router.push("/sell")}>
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2">
                  <line x1="12" y1="5" x2="12" y2="19" />
                  <line x1="5" y1="12" x2="19" y2="12" />
                </svg>
                Add new listing
              </button>
            </div>
          )}

          {/* Favorites tab */}
          {parentTab === "favorites" && (
            <div className="pm-parent-content active" style={{ position: "relative", zIndex: 1 }}>
              <div style={{ width: "100%" }}>
                {favoritesLoading ? (
                  <div style={{ textAlign: "center", padding: "2rem", color: "var(--mp-text-muted)", fontSize: "0.9rem" }}>Loading your favorites…</div>
                ) : favorites.length === 0 ? (
                  <div style={{ textAlign: "center", padding: "2.5rem 1rem", color: "#555", fontSize: "0.88rem" }}>
                    You have not saved any listings yet. Tap the heart on a listing to save it here.
                  </div>
                ) : (
                  <div className="pm-listings-grid">
                    {favorites.map((f) => {
                      const price = typeof f.price === "number" ? "$" + f.price.toLocaleString() : "";
                      return (
                        <div
                          className="pm-listing-card pm-favorite-card"
                          key={f.id}
                          style={{ cursor: "pointer", position: "relative" }}
                          onClick={() => router.push(`/listing/${buildListingSlug(f.title, f.listingId)}`)}
                        >
                          <button
                            className="pm-favorite-remove-btn"
                            type="button"
                            aria-label="Remove from favorites"
                            title="Remove from favorites"
                            onClick={async (e) => {
                              e.stopPropagation();
                              try {
                                await removeFavorite(f.listingId);
                              } catch {
                                toast("Could not remove. Please try again.");
                              }
                            }}
                          >
                            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
                              <path d="M3 6h18" />
                              <path d="M8 6V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2" />
                              <path d="M19 6l-1 14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6" />
                              <line x1="10" y1="11" x2="10" y2="17" />
                              <line x1="14" y1="11" x2="14" y2="17" />
                            </svg>
                            <span>Remove</span>
                          </button>
                          {f.image ? (
                            <img className="pm-listing-image" src={f.image} alt={f.title || ""} loading="lazy" />
                          ) : (
                            <div className="pm-listing-image" style={{ background: "#111", display: "flex", alignItems: "center", justifyContent: "center" }}>
                              <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="#333" strokeWidth="1.5">
                                <rect x="3" y="3" width="18" height="18" rx="2" />
                                <path d="M3 9h18M9 21V9" />
                              </svg>
                            </div>
                          )}
                          <div className="pm-listing-info">
                            <div className="pm-listing-title" style={{ display: "flex", alignItems: "center", gap: 5 }}>
                              {TYPE_ICONS[f.type || "website"]}
                              {f.title || "Untitled"}
                            </div>
                            {price ? <div className="pm-listing-desc">{price}</div> : null}
                          </div>
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>
            </div>
          )}

          {/* Always-visible bottom actions */}
          <div className="pm-bottom-actions" style={{ position: "relative", zIndex: 1 }}>
            <div className="pm-bottom-row">
              <button className="pm-bottom-btn" onClick={() => router.push("/settings")}>
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8">
                  <circle cx="12" cy="12" r="3" />
                  <path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-4 0v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83-2.83l.06-.06A1.65 1.65 0 0 0 4.68 15a1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1 0-4h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 2.83-2.83l.06.06A1.65 1.65 0 0 0 9 4.68a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 4 0v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 2.83l-.06.06A1.65 1.65 0 0 0 19.4 9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1z" />
                </svg>
                Settings
              </button>
              <button
                className="pm-bottom-btn pm-bottom-dispute"
                onClick={openDisputePicker}
              >
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M10.29 3.86L1.82 18a2 2 0 001.71 3h16.94a2 2 0 001.71-3L13.71 3.86a2 2 0 00-3.42 0z" />
                  <line x1="12" y1="9" x2="12" y2="13" />
                  <line x1="12" y1="17" x2="12.01" y2="17" />
                </svg>
                Dispute
              </button>
            </div>
            <button className="pm-bottom-btn pm-bottom-logout" style={{ width: "100%" }} onClick={() => confirmLogout()}>
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M9 21H5a2 2 0 01-2-2V5a2 2 0 012-2h4" />
                <polyline points="16 17 21 12 16 7" />
                <line x1="21" y1="12" x2="9" y2="12" />
              </svg>
              Sign Out
            </button>
          </div>
        </div>
      </div>

      {deleteTarget ? (
        <ConfirmOverlay
          title="Delete Listing?"
          message="This will permanently remove the listing. This cannot be undone."
          confirmLabel="Delete"
          danger
          busy={deleting}
          onCancel={() => setDeleteTarget(null)}
          onConfirm={handleDeleteListing}
        />
      ) : null}

      {cancelConfirming ? (
        <ConfirmOverlay
          title={`Cancel ${planLabel} Plan`}
          message="Your subscription will be cancelled and your account will revert to the Free plan at the end of your current billing cycle. Are you sure?"
          confirmLabel="Yes, Cancel Plan"
          danger
          busy={cancelling}
          onCancel={() => setCancelConfirming(false)}
          onConfirm={handleCancelPlan}
        />
      ) : null}

      <ToastHost />
    </div>
  );
}
