1import type { Metadata } from "next";
import { Suspense } from "react";
import { getPublicBaseUrl } from "@/lib/server/adminDb";
import DonatePageClient from "./DonatePageClient";

// Same treatment as /onboarding, /upgrade — own explicit metadata so this
// route doesn't inherit the root layout's site-wide title/description.
// noindex: this is a signed-in-only action page with no SEO value.
export function generateMetadata({ params }: { params: { id: string } }): Metadata {
  const url = `${getPublicBaseUrl()}/donate/${params.id}`;
  return {
    title: "Support a Seller — Siterifty",
    description: "Send a donation directly to a Siterifty seller's wallet.",
    alternates: { canonical: url },
    robots: { index: false, follow: false },
  };
}

export default function DonatePage({ params }: { params: { id: string } }) {
  return (
    <Suspense fallback={null}>
      <DonatePageClient sellerUid={params.id} />
    </Suspense>
  );
}
