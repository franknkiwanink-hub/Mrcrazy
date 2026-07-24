"use client";

// /sell/template — thin route wrapper around TemplateListingForm. See
// /sell/website's page.tsx for why this is a real route instead of a state
// swap on /sell.

import { useRouter } from "next/navigation";
import TemplateListingForm from "@/components/listing/TemplateListingForm";

export default function SellTemplatePage() {
  const router = useRouter();
  return <TemplateListingForm onBack={() => router.push("/sell")} />;
}
