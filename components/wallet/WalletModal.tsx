"use client";

import { useEffect, useRef, useState } from "react";
import { auth } from "@/lib/firebase";
import { useAuth } from "@/lib/AuthContext";
import { loadPaypalSdk } from "@/lib/paypalSdk";
import { useWalletSummary } from "@/lib/useWalletSummary";
import WithdrawTab from "@/components/wallet/WithdrawTab";
import SendTab from "@/components/wallet/SendTab";
import HistoryTab from "@/components/wallet/HistoryTab";
import AutoTopUpAddon from "@/components/wallet/AutoTopUpAddon";
import AutoWithdrawAddon from "@/components/wallet/AutoWithdrawAddon";

// Ports the WALLET MODAL from wallet.js (index.html lines 7026-8192) — all
// 4 tabs. Deposit tab's Auto Top-Up addon and Withdraw tab's Auto
// Withdrawal addon are collapsible disclosures nested inside those tabs
// (matching the original's DOM placement — "was its own tab; now lives
// inside Add Funds" per index.html's own comment), not separate top-level
// tabs. Auto Send similarly lives inside SendTab.tsx itself. The balance
// hero (shared across all tabs) uses the live AuthContext
// profile.walletBalance for the headline number (same source Header/
// NavDrawer already read) and useWalletSummary for the pending/escrow
// breakdown, which isn't in the profile listener.
const QUICK_AMOUNTS = [10, 25, 50, 100];

export default function WalletModal({ open, onClose }: { open: boolean; onClose: () => void }) {
  const { profile } = useAuth();
  const { summary, refresh } = useWalletSummary();
  const [tab, setTab] = useState<"deposit" | "withdraw" | "send" | "history">("deposit");
  const [amountInput, setAmountInput] = useState("");
  const [msg, setMsg] = useState<{ text: string; kind: "ok" | "err" | "" }>({ text: "", kind: "" });
  const [atuOpen, setAtuOpen] = useState(false);
  const [awdOpen, setAwdOpen] = useState(false);

  const paypalWrapRef = useRef<HTMLDivElement>(null);
  const buttonsRef = useRef<any>(null);
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    if (open) {
      refresh();
      setTab("deposit");
    }
  }, [open, refresh]);

  function validAmount(): number | null {
    const amt = parseFloat(amountInput);
    return amt >= 5 && amt <= 10000 ? amt : null;
  }

  // Debounced (re)mount of the PayPal Buttons for the current amount —
  // ports _walletRenderDepositButton's 350ms debounce.
  useEffect(() => {
    if (tab !== "deposit") return;
    if (debounceRef.current) clearTimeout(debounceRef.current);
    setMsg({ text: "", kind: "" });
    buttonsRef.current?.close?.();
    buttonsRef.current = null;
    if (paypalWrapRef.current) paypalWrapRef.current.innerHTML = "";

    const amt = validAmount();
    if (!amt) return;
    debounceRef.current = setTimeout(() => mountPaypalButton(amt), 350);

    return () => {
      if (debounceRef.current) clearTimeout(debounceRef.current);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [amountInput, tab]);

  async function mountPaypalButton(amt: number) {
    const user = auth.currentUser;
    const wrap = paypalWrapRef.current;
    if (!wrap) return;
    if (!user) {
      wrap.innerHTML = "";
      setMsg({ text: "Log in to add funds.", kind: "err" });
      return;
    }
    wrap.innerHTML =
      '<div style="width:100%;height:45px;border-radius:999px;background:rgba(255,255,255,.06);"></div>';

    let paypal;
    try {
      paypal = await loadPaypalSdk("components=buttons&currency=USD&intent=capture");
    } catch (err) {
      console.error("[wallet deposit] SDK load failed", err);
      wrap.innerHTML =
        '<div class="wallet-msg err">Could not load PayPal. Check your connection and try again.</div>';
      return;
    }

    // Amount may have changed while the SDK was loading — bail if stale.
    if (validAmount() !== amt) return;
    wrap.innerHTML = "";

    buttonsRef.current = paypal.Buttons({
      style: { layout: "horizontal", color: "gold", shape: "pill", height: 45, label: "pay" },

      createOrder: async () => {
        setMsg({ text: "", kind: "" });
        try {
          const idToken = await user.getIdToken();
          const res = await fetch("/api/paypal", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ action: "create-order", idToken, amount: amt }),
          });
          const d = await res.json();
          if (!res.ok) throw new Error(d.error || "Could not start checkout");
          return d.orderID;
        } catch (err: any) {
          setMsg({ text: err.message || "Could not start checkout", kind: "err" });
          throw err;
        }
      },

      onApprove: async (data: { orderID: string }) => {
        try {
          const idToken = await user.getIdToken();
          const res = await fetch("/api/paypal", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ action: "capture-order", idToken, orderID: data.orderID }),
          });
          const d = await res.json();
          if (!res.ok) throw new Error(d.error || "Payment could not be completed");

          setMsg({ text: `$${d.amount.toFixed(2)} added to your wallet.`, kind: "ok" });
          setAmountInput("");
          if (wrap) wrap.innerHTML = "";
          refresh();
        } catch (err: any) {
          setMsg({ text: err.message || "Payment could not be completed", kind: "err" });
        }
      },

      onError: (err: unknown) => {
        console.error("[wallet deposit] PayPal Buttons error", err);
        setMsg({ text: "PayPal ran into a problem. Please try again.", kind: "err" });
      },

      onCancel: () => {
        setMsg({ text: "", kind: "" });
      },
    });

    buttonsRef.current.render(wrap).catch((err: unknown) => {
      console.error("[wallet deposit] Buttons render failed", err);
      wrap.innerHTML = '<div class="wallet-msg err">Could not display PayPal button.</div>';
    });
  }

  if (!open) return null;

  const balance = profile?.walletBalance ?? summary.walletBalance ?? 0;

  return (
    <div
      id="walletModal"
      className="active"
      style={{ position: "fixed", inset: 0, zIndex: 10000, display: "flex", alignItems: "center", justifyContent: "center", background: "rgba(0,0,0,0.7)" }}
      onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}
    >
      <div style={{ background: "#141420", borderRadius: 16, width: "min(440px, 92vw)", maxHeight: "88vh", overflowY: "auto", color: "#fff" }}>
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "1.1rem 1.3rem", borderBottom: "1px solid #222" }}>
          <h3 style={{ margin: 0, fontSize: "1.05rem" }}>Wallet</h3>
          <button id="walletModalClose" onClick={onClose} style={{ background: "none", border: "none", color: "#888", fontSize: "1.4rem", cursor: "pointer", lineHeight: 1 }}>
            &times;
          </button>
        </div>

        <div style={{ padding: "1.1rem 1.3rem 0.4rem" }}>
          <div id="walletBalanceAmt" style={{ fontSize: "2rem", fontWeight: 800 }}>
            ${balance.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
          </div>
          {summary.pendingBalance > 0 ? (
            <div id="walletPendingRow" style={{ display: "flex", gap: 6, fontSize: "0.8rem", color: "#facc15", marginTop: 4 }}>
              <span>Pending</span>
              <span id="walletPendingAmt">${summary.pendingBalance.toFixed(2)}</span>
            </div>
          ) : null}
          <div style={{ display: "flex", gap: "1rem", fontSize: "0.78rem", color: "#999", marginTop: 8, flexWrap: "wrap" }}>
            <span>Withdrawable: <strong id="walletWithdrawableAmt" style={{ color: "#ddd" }}>${summary.withdrawableBalance.toFixed(2)}</strong></span>
            <span>Escrow held: <strong id="walletEscrowHeldAmt" style={{ color: "#ddd" }}>${summary.escrowHeld.toFixed(2)}</strong></span>
          </div>
        </div>

        <div style={{ display: "flex", gap: 4, padding: "0.9rem 1.3rem 0", borderBottom: "1px solid #222" }}>
          {(["deposit", "withdraw", "send", "history"] as const).map((t) => (
            <button
              key={t}
              className={`wallet-tab${tab === t ? " active" : ""}`}
              onClick={() => setTab(t)}
              style={{
                background: "none",
                border: "none",
                padding: "0.5rem 0.7rem",
                color: tab === t ? "#fff" : "#777",
                borderBottom: tab === t ? "2px solid #fff" : "2px solid transparent",
                fontWeight: 600,
                fontSize: "0.85rem",
                cursor: "pointer",
                textTransform: "capitalize",
              }}
            >
              {t === "deposit" ? "Add Funds" : t}
            </button>
          ))}
        </div>

        <div style={{ padding: "1.2rem 1.3rem" }}>
          {tab === "deposit" ? (
            <div id="walletPanelDeposit" className="active">
              <div style={{ display: "flex", gap: 8, marginBottom: 10 }}>
                {QUICK_AMOUNTS.map((amt) => (
                  <button
                    key={amt}
                    className={`wallet-quick-btn${amountInput === String(amt) ? " active" : ""}`}
                    onClick={() => setAmountInput(String(amt))}
                    style={{
                      flex: 1,
                      padding: "0.55rem 0",
                      borderRadius: 8,
                      border: amountInput === String(amt) ? "1px solid #fff" : "1px solid #333",
                      background: amountInput === String(amt) ? "#fff" : "transparent",
                      color: amountInput === String(amt) ? "#000" : "#ddd",
                      fontWeight: 700,
                      cursor: "pointer",
                    }}
                  >
                    ${amt}
                  </button>
                ))}
              </div>
              <div className="input-group">
                <label>Custom amount (USD)</label>
                <input
                  id="walletDepositAmt"
                  className="input-field"
                  type="number"
                  min={5}
                  max={10000}
                  step="0.01"
                  placeholder="5.00 – 10,000.00"
                  value={amountInput}
                  onChange={(e) => setAmountInput(e.target.value)}
                />
                <span className="hint">Minimum $5, maximum $10,000 per deposit.</span>
              </div>

              <div id="walletPaypalBtnWrap" ref={paypalWrapRef} style={{ marginTop: 12, minHeight: 45 }} />

              {msg.text ? (
                <div
                  id="walletDepositMsg"
                  className={`wallet-msg${msg.kind ? ` ${msg.kind}` : ""}`}
                  style={{ marginTop: 10, fontSize: "0.85rem", color: msg.kind === "err" ? "#f87171" : msg.kind === "ok" ? "#a3e635" : "#aaa" }}
                >
                  {msg.text}
                </div>
              ) : null}

              <hr className="detail-divider" style={{ margin: "1rem 0" }} />
              <button
                id="atuAddonToggle"
                className={`wallet-addon-toggle${atuOpen ? " open" : ""}`}
                aria-expanded={atuOpen}
                onClick={() => setAtuOpen((o) => !o)}
                style={{
                  width: "100%",
                  display: "flex",
                  justifyContent: "space-between",
                  alignItems: "center",
                  background: "none",
                  border: "none",
                  color: "#ddd",
                  fontWeight: 700,
                  fontSize: "0.85rem",
                  cursor: "pointer",
                  padding: "0.4rem 0",
                }}
              >
                Auto Top-Up
                <span style={{ transform: atuOpen ? "rotate(180deg)" : "none", transition: "transform 0.15s" }}>▾</span>
              </button>
              {atuOpen ? <AutoTopUpAddon /> : null}
            </div>
          ) : tab === "withdraw" ? (
            <>
              <WithdrawTab withdrawable={summary.withdrawableBalance} onSuccess={refresh} />
              <hr className="detail-divider" style={{ margin: "1rem 0" }} />
              <button
                id="awdAddonToggle"
                className={`wallet-addon-toggle${awdOpen ? " open" : ""}`}
                aria-expanded={awdOpen}
                onClick={() => setAwdOpen((o) => !o)}
                style={{
                  width: "100%",
                  display: "flex",
                  justifyContent: "space-between",
                  alignItems: "center",
                  background: "none",
                  border: "none",
                  color: "#ddd",
                  fontWeight: 700,
                  fontSize: "0.85rem",
                  cursor: "pointer",
                  padding: "0.4rem 0",
                }}
              >
                Auto Withdrawal
                <span style={{ transform: awdOpen ? "rotate(180deg)" : "none", transition: "transform 0.15s" }}>▾</span>
              </button>
              {awdOpen ? <AutoWithdrawAddon onEnabled={refresh} /> : null}
            </>
          ) : tab === "send" ? (
            <SendTab balance={balance} onSuccess={refresh} />
          ) : (
            <HistoryTab active={tab === "history"} />
          )}
        </div>
      </div>
    </div>
  );
}
