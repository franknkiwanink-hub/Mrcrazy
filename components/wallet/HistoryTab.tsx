"use client";

import { useWalletHistory } from "@/lib/useWalletHistory";
import { walletTxIconKind, walletFeeSub, fmtWalletDate } from "@/lib/walletHistoryHelpers";

// Ports _walletRenderHistory from wallet.js — same icon/fee-sub/date
// formatting, backed by useWalletHistory's live Firestore onSnapshot
// listener instead of the original's dynamically-imported SDK.
function TxIcon({ type }: { type?: string }) {
  const kind = walletTxIconKind(type);
  const color = kind === "pos" ? "#a3e635" : kind === "pending" ? "#facc15" : "#f87171";
  let path;
  if (kind === "pos") {
    path = <path d="M12 19V5M5 12l7-7 7 7" strokeLinecap="round" strokeLinejoin="round" />;
  } else if (type === "withdraw" || type === "escrow_pay" || type === "escrow_hold") {
    path =
      type === "withdraw" ? (
        <>
          <circle cx="12" cy="12" r="10" />
          <path d="M12 6v6l4 2" strokeLinecap="round" />
        </>
      ) : (
        <>
          <rect x="4" y="10" width="16" height="10" rx="2" />
          <path d="M8 10V7a4 4 0 018 0v3" />
        </>
      );
  } else {
    path = <path d="M12 5v14M5 12l7 7 7-7" strokeLinecap="round" strokeLinejoin="round" />;
  }
  return (
    <div style={{ width: 30, height: 30, borderRadius: "50%", display: "flex", alignItems: "center", justifyContent: "center", background: "#1c1c1c", flexShrink: 0 }}>
      <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="2.4">
        {path}
      </svg>
    </div>
  );
}

export default function HistoryTab({ active }: { active: boolean }) {
  const { transactions, loading } = useWalletHistory(active);

  if (loading || transactions === null) {
    return (
      <div id="walletHistoryList" style={{ display: "flex", flexDirection: "column", gap: 6 }}>
        {[0, 1, 2].map((i) => (
          <div key={i} className="wallet-skel-row" style={{ height: 46, borderRadius: 8, background: "rgba(255,255,255,0.05)" }} />
        ))}
      </div>
    );
  }

  if (transactions.length === 0) {
    return (
      <div id="walletHistoryEmpty" style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 6, color: "#666", padding: "2rem 0", textAlign: "center" }}>
        <span style={{ fontSize: "0.85rem" }}>No transactions yet.</span>
      </div>
    );
  }

  return (
    <div id="walletHistoryList" style={{ display: "flex", flexDirection: "column", gap: 2 }}>
      {transactions.map((tx, i) => {
        const amt = Number(tx.amount || 0);
        const isPos = amt >= 0;
        const whenStr = fmtWalletDate(tx.createdAt);
        const scheduled = tx.scheduledFor ? fmtWalletDate(tx.scheduledFor) : "";
        const feeStr = walletFeeSub(tx);
        return (
          <div
            key={i}
            className="wallet-tx-row"
            style={{ display: "flex", alignItems: "center", gap: 10, padding: "0.6rem 0", borderBottom: "1px solid #1c1c1c" }}
          >
            <TxIcon type={tx.type} />
            <div className="wallet-tx-mid" style={{ flex: 1, minWidth: 0 }}>
              <div className="wallet-tx-label" style={{ fontSize: "0.83rem", fontWeight: 600 }}>
                {tx.label || tx.type || "Transaction"}
              </div>
              <div className="wallet-tx-sub" style={{ fontSize: "0.72rem", color: "#888" }}>
                {whenStr}
                {tx.status === "pending" ? " · Pending" : ""}
                {scheduled ? ` · Scheduled ${scheduled}` : ""}
              </div>
              {feeStr ? (
                <div className="wallet-tx-fee" style={{ fontSize: "0.7rem", color: "#666" }}>
                  {feeStr}
                </div>
              ) : null}
            </div>
            <div className={`wallet-tx-amt ${isPos ? "pos" : "neg"}`} style={{ fontWeight: 700, fontSize: "0.85rem", color: isPos ? "#a3e635" : "#f87171", flexShrink: 0 }}>
              {isPos ? "+" : ""}${Math.abs(amt).toFixed(2)}
            </div>
          </div>
        );
      })}
    </div>
  );
}
