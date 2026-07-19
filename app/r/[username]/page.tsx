import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { getPublicBaseUrl } from "@/lib/server/adminDb";

// Fixes the referral link 404: ReferralsPanel hands out links shaped like
// /r/{username}, but until now nothing served that path at all — sharing
// it just hit Next's not-found page, and even if it had rendered, nothing
// downstream reads a path segment for referral tracking anyway.
//
// authActions.ts's getReferralCode() (used by every signup path —
// ensureUserDoc → ensureAccount) only ever reads a *query param*:
// `new URLSearchParams(window.location.search).get('r')`. So the fix
// isn't a page that renders content at /r/{username} — it's a redirect
// that lands the visitor on the homepage with that same username as
// ?r=username, which is the format the signup flow already knows how to
// read and persist as `referredBy` on the new user's own doc. From there
// the existing (and already fully working) 30%-commission payout in
// app/api/paypal/_handler.js's handleActivateSub runs unchanged the first
// time that referred user activates a paid plan.
//
// Basic username shape validated the same way the rest of the app does
// (see authActions.ts's USERNAME_RULES / getReferralCode) before it's
// forwarded, so a malformed or hostile path segment can't smuggle
// anything unexpected into the redirect target.
const USERNAME_RE = /^[a-zA-Z0-9_.-]{1,20}$/;

export async function generateMetadata({
  params,
}: {
  params: Promise<{ username: string }>;
}): Promise<Metadata> {
  const { username } = await params;
  const url = `${getPublicBaseUrl()}/r/${encodeURIComponent(username)}`;
  return {
    title: "You're invited to Siterifty",
    description: "Join Siterifty — the marketplace for indie developers to buy and sell websites, apps, and games.",
    alternates: { canonical: url },
    robots: { index: false, follow: false },
  };
}

export default async function ReferralRedirectPage({
  params,
}: {
  params: Promise<{ username: string }>;
}) {
  const { username } = await params;
  const safe = USERNAME_RE.test(username) ? username.toLowerCase() : null;
  redirect(safe ? `/?r=${encodeURIComponent(safe)}` : "/");
}
