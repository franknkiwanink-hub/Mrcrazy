"use client";

import { useState } from "react";
import { useUnreadNotificationCount } from "@/lib/notifications";
import NotificationCenterModal from "./NotificationCenterModal";

// Bell icon shown at the left of the announcement bar, before the
// username/plan badge. Opens the fullscreen NotificationCenterModal on
// tap, so sellers/buyers have one place to review deal offers, new
// messages, and payment/escrow updates without digging through /messages.
export default function NotificationBellButton({ uid }: { uid: string | null | undefined }) {
  const unread = useUnreadNotificationCount(uid);
  const [open, setOpen] = useState(false);

  if (!uid) return null;

  return (
    <>
      <button
        className="ab-bell-btn"
        onClick={() => setOpen(true)}
        aria-label={unread > 0 ? `Notifications, ${unread} unread` : "Notifications"}
      >
        <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <path d="M18 8a6 6 0 0 0-12 0c0 7-3 9-3 9h18s-3-2-3-9" />
          <path d="M13.73 21a2 2 0 0 1-3.46 0" />
        </svg>
        {unread > 0 && <span className="ab-bell-badge">{unread > 9 ? "9+" : unread}</span>}
      </button>
      <NotificationCenterModal uid={uid} open={open} onClose={() => setOpen(false)} />
    </>
  );
}
