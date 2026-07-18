"use client";

import { useState } from "react";
import { auth } from "@/lib/firebase";
import { useLimits } from "@/lib/useLimits";

// Ports the WITHDRAW section from wallet.js (payment method, scheduler,
// fee breakdown, submit). Live bounds now come from useLimits() (GET
// /api/limits, LIMITS.wallet). FALLBACK_* match app/api/_lib/limits.js's
// wallet block exactly (withdrawMin:10, withdrawMax:10000, withdrawFee:0.05)
// and are used only until that fetch resolves.
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
  withdrawable,
  onSuccess,
}: {
  withdrawable: number;
  onSuccess: () => void;
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
    <div id="walletPanelWithdraw" className="active">
      <div style={{ display: "flex", gap: 8, marginBottom: 12 }}>
        {(["paypal", "bank"] as const).map((m) => (
          <button
            key={m}
            className={`wallet-method-card${method === m ? " active" : ""}`}
            data-method={m}
            onClick={() => setMethod(m)}
            style={{
              flex: 1,
              padding: "0.6rem",
              borderRadius: 8,
              border: method === m ? "1px solid #fff" : "1px solid #2a2a2a",
              background: method === m ? "rgba(255,255,255,0.08)" : "transparent",
              color: method === m ? "#fff" : "#999",
              fontWeight: 600,
              fontSize: "0.82rem",
              cursor: "pointer",
              textTransform: "capitalize",
            }}
          >
            {m === "paypal" ? "PayPal" : "Bank Transfer"}
          </button>
        ))}
      </div>

      <div className="input-group" style={{ marginBottom: 10 }}>
        <label>Amount (USD)</label>
        <div style={{ display: "flex", gap: 8 }}>
          <input
            id="walletWithdrawAmt"
            className="input-field"
            type="number"
            min={WITHDRAW_MIN}
            max={WITHDRAW_MAX}
            step="0.01"
            value={amount}
            onChange={(e) => setAmount(e.target.value)}
            placeholder={`${WITHDRAW_MIN} – ${WITHDRAW_MAX.toLocaleString()}`}
            style={{ flex: 1 }}
          />
          <button
            id="walletWithdrawMaxBtn"
            onClick={() => setAmount(withdrawable > 0 ? withdrawable.toFixed(2) : "")}
            style={{
              padding: "0 14px",
              borderRadius: 8,
              border: "1px solid #333",
              background: "transparent",
              color: "#ddd",
              fontWeight: 700,
              fontSize: "0.78rem",
              cursor: "pointer",
            }}
          >
            Max
          </button>
        </div>
        <span className="hint">Withdrawable: ${withdrawable.toFixed(2)}</span>
      </div>

      <div className="input-group" style={{ marginBottom: 10, display: method === "paypal" ? "block" : "none" }}>
        <label>PayPal Email</label>
        <input
          id="walletWithdrawEmail"
          className="input-field"
          type="email"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          placeholder="your@paypal.com"
        />
      </div>
      <div className="input-group" style={{ marginBottom: 10, display: method === "bank" ? "block" : "none" }}>
        <label>Bank Payout Email</label>
        <input
          id="walletWithdrawBankEmail"
          className="input-field"
          type="email"
          value={bankEmail}
          onChange={(e) => setBankEmail(e.target.value)}
          placeholder="you@example.com"
        />
      </div>

      <div style={{ display: "flex", gap: 8, marginBottom: 10 }}>
        {(["asap", "scheduled"] as const).map((mode) => (
          <button
            key={mode}
            className={`wallet-schedule-chip${scheduleMode === mode ? " active" : ""}`}
            data-when={mode}
            onClick={() => setScheduleMode(mode)}
            style={{
              flex: 1,
              padding: "0.45rem",
              borderRadius: 999,
              border: scheduleMode === mode ? "1px solid #fff" : "1px solid #2a2a2a",
              background: scheduleMode === mode ? "#fff" : "transparent",
              color: scheduleMode === mode ? "#000" : "#999",
              fontWeight: 700,
              fontSize: "0.78rem",
              cursor: "pointer",
            }}
          >
            {mode === "asap" ? "As soon as possible" : "Schedule for later"}
          </button>
        ))}
      </div>

      {scheduleMode === "scheduled" ? (
        <div id="walletScheduleFields" style={{ display: "flex", gap: 8, marginBottom: 10 }}>
          <input
            id="walletScheduleDate"
            className="input-field"
            type="date"
            min={tomorrowStr()}
            max={maxDateStr()}
            value={date}
            onChange={(e) => setDate(e.target.value)}
            style={{ flex: 1 }}
          />
          <input
            id="walletScheduleTime"
            className="input-field"
            type="time"
            value={time}
            onChange={(e) => setTime(e.target.value)}
            style={{ flex: 1 }}
          />
        </div>
      ) : null}

      {showFee ? (
        <div
          id="walletWithdrawFeeRow"
          style={{ display: "flex", justifyContent: "space-between", fontSize: "0.8rem", color: "#aaa", padding: "0.5rem 0", borderTop: "1px solid #222", marginBottom: 10 }}
        >
          <span>
            Gross <strong id="walletWithdrawGross" style={{ color: "#ddd" }}>${amt.toFixed(2)}</strong>
          </span>
          <span>
            Fee (5%) <strong id="walletWithdrawFee" style={{ color: "#ddd" }}>${fee.toFixed(2)}</strong>
          </span>
          <span>
            You get <strong id="walletWithdrawReceive" style={{ color: "#a3e635" }}>${receive.toFixed(2)}</strong>
          </span>
        </div>
      ) : null}

      <button
        id="walletWithdrawSubmit"
        className="save-btn"
        style={{ width: "100%" }}
        onClick={handleSubmit}
        disabled={submitting}
      >
        <span>{submitting ? "Processing…" : "Request Withdrawal"}</span>
      </button>

      {msg.text ? (
        <div
          id="walletWithdrawMsg"
          className={`wallet-msg${msg.kind ? ` ${msg.kind}` : ""}`}
          style={{ marginTop: 10, fontSize: "0.85rem", color: msg.kind === "err" ? "#f87171" : msg.kind === "ok" ? "#a3e635" : "#aaa" }}
        >
          {msg.text}
        </div>
      ) : null}
    </div>
  );
}
