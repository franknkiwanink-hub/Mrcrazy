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
// 4 tabs. Markup mirrors index.html's #walletModal structure 1:1 (same
// ids/classes) so the #walletModal / .wallet-* rules in globals.css
// (ported verbatim from styles/siterifty.css) actually apply — the
// previous version reimplemented this shell with inline styles, which
// left ~90% of that CSS block unused. Deposit tab's Auto Top-Up addon
// and Withdraw tab's Auto Withdrawal addon are collapsible disclosures
// nested inside those tabs (matching the original's DOM placement —
// "was its own tab; now lives inside Add Funds" per index.html's own
// comment), not separate top-level tabs. Auto Send similarly lives
// inside SendTab.tsx itself. The balance hero (shared across all tabs)
// uses the live AuthContext profile.walletBalance for the headline
// number (same source Header/NavDrawer already read) and
// useWalletSummary for the pending/escrow breakdown, which isn't in the
// profile listener.
const QUICK_AMOUNTS = [20, 50, 100, 250];

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
  const hasPending = summary.pendingBalance > 0;
  const hasIncoming = summary.escrowIncoming > 0;

  return (
    <div id="walletModal" className="active">
      <div id="walletModalInner">
        <div id="walletModalHeader">
          <div id="walletModalHeaderLeft">
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#a3e635" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <rect x="2" y="6" width="20" height="14" rx="2.5" />
              <path d="M2 10h20" />
              <path d="M17 15h.01" />
            </svg>
            <div>
              <div id="walletModalTitle">Wallet</div>
              <div id="walletModalSub">Manage your balance</div>
            </div>
          </div>
          <button id="walletModalClose" aria-label="Close wallet" onClick={onClose}>
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
              <line x1="18" y1="6" x2="6" y2="18" />
              <line x1="6" y1="6" x2="18" y2="18" />
            </svg>
          </button>
        </div>

        <div id="walletModalBody">
          {/* Balance hero */}
          <div id="walletBalanceCard">
            <img
              src="https://cdn.phototourl.com/member/2026-07-19-ffcaa670-d57c-44f6-8415-ab73856860b2.png"
              alt="Siterifty.com"
              style={{ height: 22, marginBottom: 8, display: "block" }}
            />
            <div id="walletBalanceLabel">Available balance</div>
            <div id="walletBalanceAmt">
              ${balance.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
            </div>
            <div id="walletPendingRow" style={hasPending ? undefined : { display: "none" }}>
              <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2">
                <circle cx="12" cy="12" r="10" />
                <path d="M12 6v6l4 2" strokeLinecap="round" />
              </svg>
              <span>
                <span id="walletPendingAmt">${summary.pendingBalance.toFixed(2)}</span> pending withdrawal
              </span>
            </div>

            {/* Sub-balance breakdown grid */}
            <div id="walletSubBalances">
              <div className="wallet-subbal" id="walletSubWithdrawable">
                <div className="wallet-subbal-icon wd">
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2">
                    <path d="M12 19V5M5 12l7-7 7 7" strokeLinecap="round" strokeLinejoin="round" />
                  </svg>
                </div>
                <div className="wallet-subbal-mid">
                  <div className="wallet-subbal-label">Withdrawable</div>
                  <div className="wallet-subbal-amt" id="walletWithdrawableAmt">${summary.withdrawableBalance.toFixed(2)}</div>
                </div>
              </div>
              <div className="wallet-subbal" id="walletSubEscrowHeld">
                <div className="wallet-subbal-icon lk">
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2">
                    <rect x="4" y="10" width="16" height="10" rx="2" />
                    <path d="M8 10V7a4 4 0 018 0v3" />
                  </svg>
                </div>
                <div className="wallet-subbal-mid">
                  <div className="wallet-subbal-label">In Escrow</div>
                  <div className="wallet-subbal-amt" id="walletEscrowHeldAmt">${summary.escrowHeld.toFixed(2)}</div>
                </div>
              </div>
              <div className="wallet-subbal" id="walletSubEscrowIncoming" style={hasIncoming ? undefined : { display: "none" }}>
                <div className="wallet-subbal-icon inc">
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2">
                    <path d="M12 5v14M19 12l-7 7-7-7" strokeLinecap="round" strokeLinejoin="round" />
                  </svg>
                </div>
                <div className="wallet-subbal-mid">
                  <div className="wallet-subbal-label">Incoming (Escrow)</div>
                  <div className="wallet-subbal-amt" id="walletEscrowIncomingAmt">${summary.escrowIncoming.toFixed(2)}</div>
                </div>
              </div>
            </div>
            <div id="walletEscrowHint">
              <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2">
                <circle cx="12" cy="12" r="10" />
                <path d="M12 8v5M12 16h.01" strokeLinecap="round" />
              </svg>
              Only sale earnings, money received, and referral bonuses can be withdrawn. Deposited funds can be spent on Siterifty but not cashed out.
            </div>
          </div>

          {/* Tabs */}
          <div id="walletTabs">
            <button className={`wallet-tab${tab === "deposit" ? " active" : ""}`} data-wtab="deposit" onClick={() => setTab("deposit")}>
              Add Funds
            </button>
            <button className={`wallet-tab${tab === "withdraw" ? " active" : ""}`} data-wtab="withdraw" onClick={() => setTab("withdraw")}>
              Withdraw
            </button>
            <button className={`wallet-tab${tab === "send" ? " active" : ""}`} data-wtab="send" onClick={() => setTab("send")}>
              Send
            </button>
            <button className={`wallet-tab${tab === "history" ? " active" : ""}`} data-wtab="history" onClick={() => setTab("history")}>
              History
            </button>
          </div>

          {/* ── Deposit panel ── */}
          <div className={`wallet-panel${tab === "deposit" ? " active" : ""}`} id="walletPanelDeposit">
            <div className="wallet-field-label">Amount to add</div>
            <div className="wallet-amount-input-wrap">
              <span className="wallet-amount-currency">$</span>
              <input
                type="number"
                id="walletDepositAmt"
                inputMode="decimal"
                placeholder="0.00"
                min={5}
                max={10000}
                step="0.01"
                value={amountInput}
                onChange={(e) => setAmountInput(e.target.value)}
              />
            </div>
            <div className="wallet-quick-amounts" id="walletQuickAmounts">
              {QUICK_AMOUNTS.map((amt) => (
                <button
                  key={amt}
                  type="button"
                  className={`wallet-quick-btn${amountInput === String(amt) ? " active" : ""}`}
                  data-amt={amt}
                  onClick={() => setAmountInput(String(amt))}
                >
                  ${amt}
                </button>
              ))}
            </div>
            <div className="wallet-hint">Min $5 · Max $10,000 per deposit · Spendable instantly, not withdrawable</div>
            {msg.text ? <div id="walletDepositMsg" className={`wallet-msg${msg.kind ? ` ${msg.kind}` : ""}`}>{msg.text}</div> : <div id="walletDepositMsg" className="wallet-msg" />}
            <div id="walletPaypalBtnWrap" ref={paypalWrapRef} />

            {/* ── Auto Top-Up addon (was its own tab; now lives inside Add Funds) ── */}
            <button type="button" className={`wallet-addon-toggle${atuOpen ? " open" : ""}`} id="atuAddonToggle" aria-expanded={atuOpen} onClick={() => setAtuOpen((o) => !o)}>
              <span className="wallet-addon-toggle-left">
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <path d="M12 19V5M5 12l7-7 7 7" strokeLinecap="round" strokeLinejoin="round" />
                </svg>
                <span>Auto Top-Up</span>
              </span>
              <svg className="wallet-addon-chevron" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2">
                <path d="M6 9l6 6 6-6" strokeLinecap="round" strokeLinejoin="round" />
              </svg>
            </button>
            <div className={`wallet-addon-panel${atuOpen ? " open" : ""}`} id="walletPanelAutotopup">
              {atuOpen ? <AutoTopUpAddon /> : null}
            </div>
          </div>

          {/* ── Withdraw panel ── */}
          <WithdrawTab active={tab === "withdraw"} withdrawable={summary.withdrawableBalance} onSuccess={refresh} awdOpen={awdOpen} onToggleAwd={() => setAwdOpen((o) => !o)} />

          {/* ── Send panel ── */}
          <SendTab active={tab === "send"} balance={balance} onSuccess={refresh} />

          {/* ── History panel ── */}
          <div className={`wallet-panel${tab === "history" ? " active" : ""}`} id="walletPanelHistory">
            <HistoryTab active={tab === "history"} />
          </div>
        </div>
      </div>
    </div>
  );
}
