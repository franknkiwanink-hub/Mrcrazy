"use client";

import { useState } from "react";
import { auth } from "@/lib/firebase";
import { useRecipientLookup } from "@/lib/useRecipientLookup";
import RecipientPreview from "@/components/wallet/RecipientPreview";
import AutoSendAddon from "@/components/wallet/AutoSendAddon";
import { useLimits } from "@/lib/useLimits";

// Ports the SEND (P2P transfer) section from wallet.js. Live fee/min/max
// now come from useLimits() (GET /api/limits, LIMITS.wallet).
// FALLBACK_* match app/api/_lib/limits.js's wallet block exactly
// (transferFee: 0.05, transferMin:1, transferMax:10000) and are used
// only until that fetch resolves. Markup mirrors index.html's
// #walletPanelSend structure so globals.css's .wallet-* rules apply.
const FALLBACK_TRANSFER_FEE_RATE = 0.05;
const FALLBACK_TRANSFER_MIN = 1;
const FALLBACK_TRANSFER_MAX = 10000;

export default function SendTab({
  active,
  balance,
  onSuccess,
}: {
  active: boolean;
  balance: number;
  onSuccess: () => void;
}) {
  const { limits } = useLimits();
  const TRANSFER_FEE_RATE = limits.wallet.transferFee ?? FALLBACK_TRANSFER_FEE_RATE;
  const TRANSFER_MIN = limits.wallet.transferMin ?? FALLBACK_TRANSFER_MIN;
  const TRANSFER_MAX = limits.wallet.transferMax ?? FALLBACK_TRANSFER_MAX;

  const { recipient, status, errorMsg, onEmailChange, reset } = useRecipientLookup();
  const [email, setEmail] = useState("");
  const [amount, setAmount] = useState("");
  const [note, setNote] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [msg, setMsg] = useState<{ text: string; kind: "ok" | "err" | "" }>({ text: "", kind: "" });
  const [addonOpen, setAddonOpen] = useState(false);

  const amt = parseFloat(amount);
  const showFee = amt > 0;
  const fee = showFee ? amt * TRANSFER_FEE_RATE : 0;
  const receive = showFee ? amt - fee : 0;

  async function handleSubmit() {
    setMsg({ text: "", kind: "" });

    if (!recipient) {
      setMsg({ text: "Enter a recipient email that matches a Siterifty account first.", kind: "err" });
      return;
    }
    if (!amt || amt < TRANSFER_MIN || amt > TRANSFER_MAX) {
      setMsg({ text: `Enter an amount between $${TRANSFER_MIN} and $${TRANSFER_MAX.toLocaleString()}.`, kind: "err" });
      return;
    }
    if (amt > balance) {
      setMsg({ text: `Insufficient balance — you have $${balance.toFixed(2)}.`, kind: "err" });
      return;
    }

    setSubmitting(true);
    try {
      const user = auth.currentUser;
      if (!user) throw new Error("Not signed in");
      const idToken = await user.getIdToken();
      const res = await fetch("/api/paypal", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "transfer", idToken, recipientUid: recipient.uid, amount: amt, note: note.trim() }),
      });
      const result = await res.json();
      if (!res.ok) throw new Error(result.error || "Transfer failed");

      setMsg({ text: `✓ Sent $${amt.toFixed(2)} to ${result.recipientName}.`, kind: "ok" });
      setEmail("");
      setAmount("");
      setNote("");
      reset();
      onSuccess();
    } catch (err: any) {
      console.error("[wallet send]", err);
      setMsg({ text: err.message || "Something went wrong. Please try again.", kind: "err" });
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className={`wallet-panel${active ? " active" : ""}`} id="walletPanelSend">
      <div className="wallet-field-label">Recipient's email</div>
      <div className="wallet-input-status-wrap">
        <input
          type="email"
          id="walletSendEmail"
          className="wallet-text-input"
          placeholder="friend@example.com"
          autoComplete="off"
          value={email}
          onChange={(e) => {
            setEmail(e.target.value);
            onEmailChange(e.target.value);
          }}
        />
        <span className="wallet-input-status-icon" id="walletSendEmailStatus" />
      </div>
      <RecipientPreview status={status} recipient={recipient} errorMsg={errorMsg} />

      <div className="wallet-field-label" style={{ marginTop: 16 }}>Amount to send</div>
      <div className="wallet-amount-input-wrap">
        <span className="wallet-amount-currency">$</span>
        <input
          type="number"
          id="walletSendAmt"
          inputMode="decimal"
          placeholder="0.00"
          min={TRANSFER_MIN}
          max={TRANSFER_MAX}
          step="0.01"
          value={amount}
          onChange={(e) => setAmount(e.target.value)}
        />
      </div>

      <div className="wallet-field-label" style={{ marginTop: 16 }}>Note (optional)</div>
      <input
        type="text"
        id="walletSendNote"
        className="wallet-text-input"
        placeholder="What's this for?"
        maxLength={200}
        value={note}
        onChange={(e) => setNote(e.target.value)}
      />

      <div className="wallet-fee-breakdown" id="walletSendFeeRow" style={showFee ? undefined : { display: "none" }}>
        <div className="wallet-fee-line"><span id="walletSendFeeLabel">Transfer fee (5%)</span><span id="walletSendFee">${fee.toFixed(2)}</span></div>
        <div className="wallet-fee-line total"><span>They'll receive</span><span id="walletSendReceive">${receive.toFixed(2)}</span></div>
      </div>
      {msg.text ? <div id="walletSendMsg" className={`wallet-msg${msg.kind ? ` ${msg.kind}` : ""}`}>{msg.text}</div> : <div id="walletSendMsg" className="wallet-msg" />}
      <button className="wallet-submit-btn" id="walletSendSubmit" onClick={handleSubmit} disabled={submitting}>
        <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4">
          <path d="M22 2L11 13M22 2l-7 20-4-9-9-4 20-7z" />
        </svg>
        <span>{submitting ? "Sending…" : "Send Money"}</span>
      </button>

      {/* ── Auto Send addon (was its own tab; now lives inside Send) ── */}
      <button type="button" className={`wallet-addon-toggle${addonOpen ? " open" : ""}`} id="asendAddonToggle" aria-expanded={addonOpen} onClick={() => setAddonOpen((o) => !o)}>
        <span className="wallet-addon-toggle-left">
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <circle cx="12" cy="12" r="10" />
            <path d="M12 6v6l4 2" strokeLinecap="round" />
          </svg>
          <span>Auto Send</span>
        </span>
        <svg className="wallet-addon-chevron" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2">
          <path d="M6 9l6 6 6-6" strokeLinecap="round" strokeLinejoin="round" />
        </svg>
      </button>
      <div className={`wallet-addon-panel${addonOpen ? " open" : ""}`} id="walletPanelAutosend">
        {addonOpen ? <AutoSendAddon /> : null}
      </div>
    </div>
  );
}
