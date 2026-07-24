"use client";

// /sell/website — thin route wrapper around WebsiteListingForm. Splitting
// each listing type into its own URL (instead of a client-state swap on
// /sell) gives Back a real page to return to and gives this type its own
// indexable route for SEO.

import { useRouter } from "next/navigation";
import WebsiteListingForm from "@/components/listing/WebsiteListingForm";

export default function SellWebsitePage() {
  const router = useRouter();
  return <WebsiteListingForm onBack={() => router.push("/sell")} />;
}
