import NavSpinnerIcon from "@/components/shared/NavSpinnerIcon";

// /r/[username]'s page.tsx does a server-side redirect() to /?r=username
// — same shape as /profile's redirect, same fix: this loading.tsx is
// shown immediately while the redirect resolves, instead of a blank
// screen for the round-trip.
export default function Loading() {
  return (
    <div style={{ display: "flex", alignItems: "center", justifyContent: "center", minHeight: "60vh", color: "var(--mp-text-sec, rgba(255,255,255,0.4))" }}>
      <NavSpinnerIcon size={22} />
    </div>
  );
}
