"use client";

import { useState } from "react";
import { auth } from "@/lib/firebase";
import { useLimits } from "@/lib/useLimits";
import AutoWithdrawAddon from "@/components/wallet/AutoWithdrawAddon";

// Ports the WITHDRAW section from wallet.js (payment method, scheduler,
// fee breakdown, submit). Live bounds now come from useLimits() (GET
// /api/limits, LIMITS.wallet). FALLBACK_* match app/api/_lib/limits.js's
// wallet block exactly (withdrawMin:10, withdrawMax:10000, withdrawFee:0.05)
// and are used only until that fetch resolves. Markup mirrors
// index.html's #walletPanelWithdraw structure so globals.css's
// .wallet-* rules apply.
const FALLBACK_WITHDRAW_MIN = 10;
const FALLBACK_WITHDRAW_MAX = 10000;
const FALLBACK_WITHDRAW_FEE_RATE = 0.05;

function tomorrowStr() {
  return new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString().slice(0, 10);
}
function maxDateStr() {
  return new Date(Date.now() + 90 * 24 * 60 * 60 * 1000).toISOString().slice(0, 10);
}

export default function WithdrawTab({
  active,
  withdrawable,
  onSuccess,
  awdOpen,
  onToggleAwd,
}: {
  active: boolean;
  withdrawable: number;
  onSuccess: () => void;
  awdOpen: boolean;
  onToggleAwd: () => void;
}) {
  const [method, setMethod] = useState<"paypal" | "bank">("paypal");
  const [scheduleMode, setScheduleMode] = useState<"asap" | "scheduled">("asap");
  const [amount, setAmount] = useState("");
  const [email, setEmail] = useState("");
  const [bankEmail, setBankEmail] = useState("");
  const [date, setDate] = useState(tomorrowStr());
  const [time, setTime] = useState("12:00");
  const [submitting, setSubmitting] = useState(false);
  const [msg, setMsg] = useState<{ text: string; kind: "ok" | "err" | "" }>({ text: "", kind: "" });

  const { limits } = useLimits();
  const WITHDRAW_MIN = limits.wallet.withdrawMin ?? FALLBACK_WITHDRAW_MIN;
  const WITHDRAW_MAX = limits.wallet.withdrawMax ?? FALLBACK_WITHDRAW_MAX;
  const WITHDRAW_FEE_RATE = limits.wallet.withdrawFee ?? FALLBACK_WITHDRAW_FEE_RATE;

  const amt = parseFloat(amount);
  const showFee = amt > 0;
  const fee = showFee ? amt * WITHDRAW_FEE_RATE : 0;
  const receive = showFee ? amt - fee : 0;

  async function handleSubmit() {
    setMsg({ text: "", kind: "" });
    const activeEmail = method === "bank" ? bankEmail.trim() : email.trim();

    if (!amt || amt < WITHDRAW_MIN || amt > WITHDRAW_MAX) {
      setMsg({ text: `Enter an amount between $${WITHDRAW_MIN} and $${WITHDRAW_MAX.toLocaleString()}.`, kind: "err" });
      return;
    }
    if (amt > withdrawable) {
      setMsg({
        text:
          withdrawable <= 0
            ? "You don't have any withdrawable balance yet. Deposited funds can be spent on Siterifty but can't be cashed out — only sale earnings, money received, and referral bonuses qualify."
            : `You can only withdraw up to $${withdrawable.toFixed(2)} — the rest of your balance came from deposits, which aren't withdrawable.`,
        kind: "err",
      });
      return;
    }
    if (!activeEmail.includes("@")) {
      setMsg({ text: `Enter a valid ${method === "bank" ? "account" : "PayPal"} email address.`, kind: "err" });
      return;
    }

    let scheduledForIso: string | null = null;
    if (scheduleMode === "scheduled") {
      if (!date || !time) {
        setMsg({ text: "Pick a date and time for the scheduled payout.", kind: "err" });
        return;
      }
      scheduledForIso = new Date(`${date}T${time}:00`).toISOString();
    }

    setSubmitting(true);
    try {
      const user = auth.currentUser;
      if (!user) throw new Error("Not signed in");
      const idToken = await user.getIdToken();
      const res = await fetch("/api/paypal", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "withdraw",
          idToken,
          amount: amt,
          paypalEmail: activeEmail,
          method,
          scheduledFor: scheduledForIso,
        }),
      });
      const result = await res.json();
      if (!res.ok) throw new Error(result.error || "Withdrawal failed");

      const whenMsg = scheduledForIso
        ? `on ${new Date(scheduledForIso).toLocaleDateString(undefined, { month: "short", day: "numeric", year: "numeric" })} at ${new Date(scheduledForIso).toLocaleTimeString(undefined, { hour: "numeric", minute: "2-digit" })}`
        : `within ${method === "bank" ? "3–5" : "1–3"} business days`;
      setMsg({ text: `✓ Withdrawal requested. You'll receive $${result.receive.toFixed(2)} ${whenMsg}.`, kind: "ok" });
      setAmount("");
      setEmail("");
      setBankEmail("");
      onSuccess();
    } catch (err: any) {
      console.error("[wallet withdraw]", err);
      setMsg({ text: err.message || "Something went wrong. Please try again.", kind: "err" });
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className={`wallet-panel${active ? " active" : ""}`} id="walletPanelWithdraw">
      <div id="walletWithdrawAvailBanner">
        <span>Available to withdraw</span>
        <strong id="walletWithdrawAvailAmt">${withdrawable.toFixed(2)}</strong>
      </div>

      <div className="wallet-field-label">Amount to withdraw</div>
      <div className="wallet-amount-input-wrap">
        <span className="wallet-amount-currency">$</span>
        <input
          type="number"
          id="walletWithdrawAmt"
          inputMode="decimal"
          placeholder="0.00"
          min={WITHDRAW_MIN}
          max={WITHDRAW_MAX}
          step="0.01"
          value={amount}
          onChange={(e) => setAmount(e.target.value)}
        />
        <button type="button" id="walletWithdrawMaxBtn" onClick={() => setAmount(withdrawable > 0 ? withdrawable.toFixed(2) : "")}>
          Max
        </button>
      </div>

      <div className="wallet-field-label" style={{ marginTop: 18 }}>Payment method</div>
      <div id="walletMethodGrid">
        <button type="button" className={`wallet-method-card${method === "paypal" ? " active" : ""}`} data-method="paypal" onClick={() => setMethod("paypal")}>
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8">
            <path d="M7 5h8a4 4 0 010 8H9l-1 6H5l3-14z" />
            <path d="M11 9h6a3.5 3.5 0 010 7h-4" />
          </svg>
          <span>PayPal</span>
        </button>
        <button type="button" className={`wallet-method-card${method === "bank" ? " active" : ""}`} data-method="bank" onClick={() => setMethod("bank")}>
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8">
            <path d="M3 10l9-6 9 6" />
            <path d="M4 10v9h16v-9" />
            <path d="M9 21v-6h6v6" />
          </svg>
          <span>Bank</span>
        </button>
      </div>

      <div id="walletMethodPaypalFields" style={method === "paypal" ? undefined : { display: "none" }}>
        <div className="wallet-field-label" style={{ marginTop: 16 }}>PayPal email</div>
        <input
          type="email"
          id="walletWithdrawEmail"
          className="wallet-text-input"
          placeholder="you@example.com"
          autoComplete="email"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
        />
      </div>
      <div id="walletMethodBankFields" style={method === "bank" ? undefined : { display: "none" }}>
        <div className="wallet-field-label" style={{ marginTop: 16 }}>Bank account email on file</div>
        <input
          type="email"
          id="walletWithdrawBankEmail"
          className="wallet-text-input"
          placeholder="you@example.com"
          autoComplete="email"
          value={bankEmail}
          onChange={(e) => setBankEmail(e.target.value)}
        />
        <div className="wallet-hint" style={{ marginTop: 8 }}>Bank transfers route through PayPal's linked bank payout — same email as your PayPal-linked account.</div>
      </div>

      <div className="wallet-field-label" style={{ marginTop: 18 }}>When should we send it?</div>
      <div id="walletScheduleRow">
        <button type="button" className={`wallet-schedule-chip${scheduleMode === "asap" ? " active" : ""}`} data-when="asap" onClick={() => setScheduleMode("asap")}>
          <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2">
            <path d="M13 2L3 14h7l-1 8 11-14h-7l1-6z" />
          </svg>
          As soon as possible
        </button>
        <button type="button" className={`wallet-schedule-chip${scheduleMode === "scheduled" ? " active" : ""}`} data-when="scheduled" onClick={() => setScheduleMode("scheduled")}>
          <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2">
            <rect x="3" y="5" width="18" height="16" rx="2" />
            <path d="M16 3v4M8 3v4M3 10h18" strokeLinecap="round" />
          </svg>
          Choose date &amp; time
        </button>
      </div>
      <div id="walletScheduleFields" style={scheduleMode === "scheduled" ? undefined : { display: "none" }}>
        <div className="wallet-schedule-inputs">
          <div className="wallet-schedule-field">
            <label htmlFor="walletScheduleDate">Date</label>
            <input
              type="date"
              id="walletScheduleDate"
              min={tomorrowStr()}
              max={maxDateStr()}
              value={date}
              onChange={(e) => setDate(e.target.value)}
            />
          </div>
          <div className="wallet-schedule-field">
            <label htmlFor="walletScheduleTime">Time</label>
            <input type="time" id="walletScheduleTime" value={time} onChange={(e) => setTime(e.target.value)} />
          </div>
        </div>
        <div className="wallet-hint">Payouts can be scheduled up to 90 days ahead. We'll process it automatically on that date.</div>
      </div>

      <div className="wallet-fee-breakdown" id="walletWithdrawFeeRow" style={showFee ? undefined : { display: "none" }}>
        <div className="wallet-fee-line"><span>Withdrawal amount</span><span id="walletWithdrawGross">${amt ? amt.toFixed(2) : "0.00"}</span></div>
        <div className="wallet-fee-line"><span id="walletWithdrawFeeLabel">Processing fee (5%)</span><span id="walletWithdrawFee">${fee.toFixed(2)}</span></div>
        <div className="wallet-fee-line total"><span>You'll receive</span><span id="walletWithdrawReceive">${receive.toFixed(2)}</span></div>
      </div>

      <div className="wallet-hint" id="walletWithdrawHint">Min ${WITHDRAW_MIN} · Max ${WITHDRAW_MAX.toLocaleString()} · PayPal: 1–3 business days · Bank: 3–5 business days</div>
      {msg.text ? <div id="walletWithdrawMsg" className={`wallet-msg${msg.kind ? ` ${msg.kind}` : ""}`}>{msg.text}</div> : <div id="walletWithdrawMsg" className="wallet-msg" />}
      <button className="wallet-submit-btn" id="walletWithdrawSubmit" onClick={handleSubmit} disabled={submitting}>
        <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4">
          <path d="M12 5v14M5 12l7 7 7-7" strokeLinecap="round" strokeLinejoin="round" />
        </svg>
        <span>{submitting ? "Processing…" : "Request Withdrawal"}</span>
      </button>

      {/* ── Auto Withdrawal addon ── */}
      <button type="button" className={`wallet-addon-toggle${awdOpen ? " open" : ""}`} id="awdAddonToggle" aria-expanded={awdOpen} onClick={onToggleAwd}>
        <span className="wallet-addon-toggle-left">
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <path d="M12 5v14M5 12l7 7 7-7" strokeLinecap="round" strokeLinejoin="round" />
          </svg>
          <span>Auto Withdrawal</span>
        </span>
        <svg className="wallet-addon-chevron" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2">
          <path d="M6 9l6 6 6-6" strokeLinecap="round" strokeLinejoin="round" />
        </svg>
      </button>
      <div className={`wallet-addon-panel${awdOpen ? " open" : ""}`} id="walletPanelAutowithdraw">
        {awdOpen ? <AutoWithdrawAddon onEnabled={onSuccess} /> : null}
      </div>
    </div>
  );
}
