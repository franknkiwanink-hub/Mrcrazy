"use client";

// /sell/app — thin route wrapper around AppListingForm. See /sell/website's
// page.tsx for why this is a real route instead of a state swap on /sell.

import { useRouter } from "next/navigation";
import AppListingForm from "@/components/listing/AppListingForm";

export default function SellAppPage() {
  const router = useRouter();
  return <AppListingForm onBack={() => router.push("/sell")} />;
}
