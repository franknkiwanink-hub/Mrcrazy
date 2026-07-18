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
// only until that fetch resolves.
const FALLBACK_TRANSFER_FEE_RATE = 0.05;
const FALLBACK_TRANSFER_MIN = 1;
const FALLBACK_TRANSFER_MAX = 10000;

export default function SendTab({
  balance,
  onSuccess,
}: {
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
    <div id="walletPanelSend" className="active">
      <div className="input-group" style={{ marginBottom: 4 }}>
        <label>Recipient Email</label>
        <input
          id="walletSendEmail"
          className="input-field"
          type="email"
          value={email}
          onChange={(e) => {
            setEmail(e.target.value);
            onEmailChange(e.target.value);
          }}
          placeholder="friend@example.com"
        />
      </div>
      <RecipientPreview status={status} recipient={recipient} errorMsg={errorMsg} />

      <div className="input-group" style={{ margin: "10px 0" }}>
        <label>Amount (USD)</label>
        <input
          id="walletSendAmt"
          className="input-field"
          type="number"
          min={TRANSFER_MIN}
          max={TRANSFER_MAX}
          step="0.01"
          value={amount}
          onChange={(e) => setAmount(e.target.value)}
          placeholder={`${TRANSFER_MIN} – ${TRANSFER_MAX.toLocaleString()}`}
        />
        <span className="hint">Available: ${balance.toFixed(2)}</span>
      </div>

      <div className="input-group" style={{ marginBottom: 10 }}>
        <label>Note (optional)</label>
        <input
          id="walletSendNote"
          className="input-field"
          type="text"
          maxLength={200}
          value={note}
          onChange={(e) => setNote(e.target.value)}
          placeholder="What's this for?"
        />
      </div>

      {showFee ? (
        <div
          id="walletSendFeeRow"
          style={{ display: "flex", justifyContent: "space-between", fontSize: "0.8rem", color: "#aaa", padding: "0.5rem 0", borderTop: "1px solid #222", marginBottom: 10 }}
        >
          <span>
            Fee (5%) <strong id="walletSendFee" style={{ color: "#ddd" }}>${fee.toFixed(2)}</strong>
          </span>
          <span>
            Recipient gets <strong id="walletSendReceive" style={{ color: "#a3e635" }}>${receive.toFixed(2)}</strong>
          </span>
        </div>
      ) : null}

      <button id="walletSendSubmit" className="save-btn" style={{ width: "100%" }} onClick={handleSubmit} disabled={submitting}>
        <span>{submitting ? "Sending…" : "Send Money"}</span>
      </button>

      {msg.text ? (
        <div
          id="walletSendMsg"
          className={`wallet-msg${msg.kind ? ` ${msg.kind}` : ""}`}
          style={{ marginTop: 10, fontSize: "0.85rem", color: msg.kind === "err" ? "#f87171" : msg.kind === "ok" ? "#a3e635" : "#aaa" }}
        >
          {msg.text}
        </div>
      ) : null}

      <hr className="detail-divider" style={{ margin: "1rem 0" }} />
      <button
        id="asendAddonToggle"
        className={`wallet-addon-toggle${addonOpen ? " open" : ""}`}
        aria-expanded={addonOpen}
        onClick={() => setAddonOpen((o) => !o)}
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
        Auto Send (recurring transfers)
        <span style={{ transform: addonOpen ? "rotate(180deg)" : "none", transition: "transform 0.15s" }}>▾</span>
      </button>
      {addonOpen ? <AutoSendAddon /> : null}
    </div>
  );
}
