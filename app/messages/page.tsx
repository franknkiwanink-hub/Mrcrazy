import { Suspense } from "react";
import InboxShell from "@/components/messages/InboxShell";

// Real routed page (not a modal) — same convention as /dashboard and
// /settings. useSearchParams inside InboxShell (for the ?tab= deep link)
// requires a Suspense boundary at the page level in the App Router.
export default function MessagesPage() {
  return (
    <Suspense fallback={null}>
      <InboxShell />
    </Suspense>
  );
}
