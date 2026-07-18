"use client";

import { useAuth } from "@/lib/AuthContext";
import { useAuthModal } from "@/components/auth/AuthModalProvider";
import MyProfileHub from "@/components/profile/MyProfileHub";

// Real routed page for the PROFILE MODAL (Js/profile.js + profile-early.js)
// — see MyProfileHub.tsx for the full port. Ports the original's
// window.__openProfileModal guard (only ever called from click handlers
// gated by __requireAuth) as an in-page check here instead, since a direct
// /myprofile visit (bookmark, deep link, browser back) has no prior click
// to gate.
export default function MyProfilePage() {
  const { user, loading } = useAuth();
  const { openAuthModal } = useAuthModal();

  if (loading || user === undefined) {
    return (
      <div style={{ marginTop: 92, minHeight: "60vh", display: "flex", alignItems: "center", justifyContent: "center", color: "rgba(255,255,255,0.4)" }}>
        Loading…
      </div>
    );
  }

  if (!user) {
    return (
      <div
        style={{
          marginTop: 92,
          minHeight: "60vh",
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
          justifyContent: "center",
          gap: 16,
          color: "#fff",
          textAlign: "center",
          padding: "0 24px",
        }}
      >
        <h1 style={{ fontSize: 24, fontWeight: 800 }}>Sign in to view your profile</h1>
        <p style={{ opacity: 0.6, maxWidth: 380 }}>
          Your profile, listings, favorites, and account settings are only visible once you&apos;re signed in.
        </p>
        <button
          onClick={openAuthModal}
          style={{
            background: "var(--mp-accent, #a3e635)",
            color: "#050505",
            fontWeight: 700,
            border: "none",
            borderRadius: 999,
            padding: "0.7rem 1.6rem",
            fontSize: 14,
            cursor: "pointer",
          }}
        >
          Sign In / Sign Up
        </button>
      </div>
    );
  }

  return <MyProfileHub />;
}
