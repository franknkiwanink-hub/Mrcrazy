"use client";

import { useAuth } from "@/lib/AuthContext";
import SignInRequired from "@/components/auth/SignInRequired";
import MyProfileHub from "@/components/profile/MyProfileHub";

// Real routed page for the PROFILE MODAL (Js/profile.js + profile-early.js)
// — see MyProfileHub.tsx for the full port. Ports the original's
// window.__openProfileModal guard (only ever called from click handlers
// gated by __requireAuth) as an in-page check here instead, since a direct
// /myprofile visit (bookmark, deep link, browser back) has no prior click
// to gate.
export default function MyProfilePage() {
  const { user, loading } = useAuth();

  if (loading || user === undefined) {
    return (
      <div style={{ marginTop: 92, minHeight: "60vh", display: "flex", alignItems: "center", justifyContent: "center", color: "rgba(255,255,255,0.4)" }}>
        Loading…
      </div>
    );
  }

  if (!user) {
    return (
      <SignInRequired
        title="Sign in to view your profile"
        description="Your profile, listings, favorites, and account settings are only visible once you're signed in."
      />
    );
  }

  return <MyProfileHub />;
}
