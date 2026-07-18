"use client";

import type { WalletRecipient } from "@/lib/useRecipientLookup";

// Ports the wrp-avatar / wrp-mid / wrp-badge markup built inline by
// _walletLookupRecipient / _asendLookupRecipient in wallet.js.
export default function RecipientPreview({
  status,
  recipient,
  errorMsg,
}: {
  status: "idle" | "loading" | "ok" | "err";
  recipient: WalletRecipient | null;
  errorMsg: string;
}) {
  if (status === "idle") return null;

  const isErr = status === "err";
  const isLoading = status === "loading";
  const name = recipient ? recipient.displayName || recipient.username || recipient.email : "";
  const initials = (name || "?").slice(0, 2).toUpperCase();

  return (
    <div
      className={`wallet-recipient-preview${isErr ? " err" : ""}`}
      style={{
        display: "flex",
        alignItems: "center",
        gap: 10,
        padding: "0.6rem 0.7rem",
        borderRadius: 10,
        border: `1px solid ${isErr ? "rgba(247,100,100,0.35)" : "#2a2a2a"}`,
        marginTop: 8,
      }}
    >
      <div
        className="wrp-avatar"
        style={{
          width: 32,
          height: 32,
          borderRadius: "50%",
          background: "#222",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          fontSize: 12,
          fontWeight: 700,
          overflow: "hidden",
          flexShrink: 0,
          color: isErr ? "#f87171" : "#eee",
        }}
      >
        {isLoading ? (
          "…"
        ) : isErr ? (
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4">
            <line x1="18" y1="6" x2="6" y2="18" />
            <line x1="6" y1="6" x2="18" y2="18" />
          </svg>
        ) : recipient?.profilePic ? (
          <img
            src={recipient.profilePic}
            alt=""
            style={{ width: "100%", height: "100%", objectFit: "cover" }}
            onError={(e) => {
              (e.target as HTMLImageElement).style.display = "none";
            }}
          />
        ) : (
          initials
        )}
      </div>
      <div className="wrp-mid" style={{ flex: 1, minWidth: 0 }}>
        <div className="wrp-name" style={{ fontSize: "0.85rem", fontWeight: 600, color: isErr ? "#f87171" : "#fff" }}>
          {isLoading ? "Looking up recipient…" : isErr ? errorMsg : name}
        </div>
        {!isLoading && !isErr && recipient ? (
          <div className="wrp-email" style={{ fontSize: "0.75rem", color: "#888" }}>{recipient.email}</div>
        ) : null}
      </div>
      {!isLoading && !isErr && recipient ? (
        <div
          className="wrp-badge"
          style={{ display: "flex", alignItems: "center", gap: 4, fontSize: "0.7rem", color: "#a3e635", fontWeight: 700, flexShrink: 0 }}
        >
          <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3">
            <path d="M20 6L9 17l-5-5" strokeLinecap="round" strokeLinejoin="round" />
          </svg>
          Available
        </div>
      ) : null}
    </div>
  );
}
