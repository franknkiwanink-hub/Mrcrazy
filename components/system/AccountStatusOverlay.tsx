"use client";

import { useEffect, useState } from "react";
import type { AccountStatus } from "@/lib/accountStatus";

// Ports #acctStatusOverlay + __applyAccountStatusOverlay's countdown
// logic. Purely a display layer — never writes banned/suspended state
// itself (see lib/accountStatus.ts's deriveAccountStatus). Re-checks via
// a full reload once the countdown reaches zero rather than trusting
// the client clock alone, matching the original.
export default function AccountStatusOverlay({
  status,
  onAppeal,
}: {
  status: AccountStatus;
  onAppeal: () => void;
}) {
  const [countdownText, setCountdownText] = useState("");

  useEffect(() => {
    if (status.isBanned || !status.isSuspendedActive || !status.suspendedUntilMs) return;

    const tick = () => {
      const remaining = status.suspendedUntilMs! - Date.now();
      if (remaining <= 0) {
        setCountdownText("Suspension ending…");
        // Re-check shortly after expiry rather than trusting the client
        // clock alone — a fresh read confirms the account is actually
        // clear once suspendedUntil has passed.
        setTimeout(() => window.location.reload(), 4000);
        return false;
      }
      const h = Math.floor(remaining / 3600000);
      const m = Math.floor((remaining % 3600000) / 60000);
      const s = Math.floor((remaining % 60000) / 1000);
      setCountdownText(`Time remaining: ${h}h ${m}m ${s}s`);
      return true;
    };

    if (!tick()) return;
    const interval = setInterval(() => {
      if (!tick()) clearInterval(interval);
    }, 1000);
    return () => clearInterval(interval);
  }, [status.isBanned, status.isSuspendedActive, status.suspendedUntilMs]);

  if (!status.isBanned && !status.isSuspendedActive) return null;

  const pillClass = status.isBanned ? "acct-banned" : "acct-suspended";
  const heading = status.isBanned ? "Your account has been banned" : "Your account is temporarily suspended";
  const body = status.isBanned
    ? status.banReason
      ? "Reason given: " + status.banReason
      : "This is a permanent restriction — you won't be able to sign back in while it's in place."
    : status.suspendReason
    ? "Reason given: " + status.suspendReason
    : "Some actions are on hold for a few hours while we review your account.";

  return (
    <div id="acctStatusOverlay" className="mnt-active">
      <div className="mnt-glow" />
      <div className="mnt-content" id="acctStatusContent">
        <div className={`mnt-status-pill ${pillClass}`}>
          <span className="mnt-status-dot" /> {status.isBanned ? "Account banned" : "Account suspended"}
        </div>
        <div className="mnt-mark">
          <div className="mnt-mark-glyph">
            <img
              src="https://www.image2url.com/r2/default/images/1783717278670-ca484861-c917-4fdb-b330-a2baf612127e.svg"
              alt="Siterifty"
              width={22}
              height={22}
              style={{ display: "block" }}
            />
          </div>
          <div className="mnt-mark-text">
            Siterifty<span>.</span>
          </div>
        </div>
        <h1 className="mnt-heading">{heading}</h1>
        <p className="mnt-body">{body}</p>
        {!status.isBanned && <div className="mnt-eta">{countdownText}</div>}

        <button type="button" className="mnt-notify-btn" style={{ marginTop: "0.4rem" }} onClick={onAppeal}>
          Appeal this decision
        </button>
      </div>
    </div>
  );
}
