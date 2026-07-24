"use client";

// /sell/game — thin route wrapper around GameListingForm. See
// /sell/website's page.tsx for why this is a real route instead of a state
// swap on /sell.

import { useRouter } from "next/navigation";
import GameListingForm from "@/components/listing/GameListingForm";

export default function SellGamePage() {
  const router = useRouter();
  return <GameListingForm onBack={() => router.push("/sell")} />;
}
