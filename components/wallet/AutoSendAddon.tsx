"use client";

import { useEffect, useState } from "react";
import { auth } from "@/lib/firebase";
import { useRecipientLookup } from "@/lib/useRecipientLookup";
import RecipientPreview from "@/components/wallet/RecipientPreview";
import { useLimits } from "@/lib/useLimits";

// Ports the AUTO SEND section from wallet.js (autosend-create/-list/
// -cancel). Live interval options + transfer bounds now come from
// useLimits() (GET /api/limits, LIMITS.autoSend.intervals /
// LIMITS.wallet). FALLBACK_* match app/api/_lib/limits.js exactly
// ([1,3,7,14,21,30] days, transferMin:1, transferMax:10000) and are
// used only until that fetch resolves.
const FALLBACK_INTERVALS = [1, 3, 7, 14, 21, 30];
const FALLBACK_TRANSFER_MIN = 1;
const FALLBACK_TRANSFER_MAX = 10000;

interface Schedule {
  id: string;
  recipientName: string;
  amount: number;
  intervalDays: number;
  status: string;
  nextRunAt: number | null;
  runCount: number;
}

export default function AutoSendAddon() {
  const { limits } = useLimits();
  const INTERVALS = limits.autoSend.intervals ?? FALLBACK_INTERVALS;
  const TRANSFER_MIN = limits.wallet.transferMin ?? FALLBACK_TRANSFER_MIN;
  const TRANSFER_MAX = limits.wallet.transferMax ?? FALLBACK_TRANSFER_MAX;

  const { recipient, status, errorMsg, onEmailChange, reset } = useRecipientLookup();
  const [email, setEmail] = useState("");
  const [amount, setAmount] = useState("");
  const [interval, setInterval_] = useState(7);
  const [note, setNote] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [msg, setMsg] = useState<{ text: string; kind: "ok" | "err" | "" }>({ text: "", kind: "" });
  const [schedules, setSchedules] = useState<Schedule[] | null>(null);
  const [cancellingId, setCancellingId] = useState<string | null>(null);

  useEffect(() => {
    loadList();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  async function loadList() {
    const user = auth.currentUser;
    if (!user) return;
    try {
      const idToken = await user.getIdToken();
      const res = await fetch("/api/paypal", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "autosend-list", idToken }),
      });
      const d = await res.json();
      if (!res.ok) throw new Error(d.error || "Could not load schedules");
      setSchedules(d.schedules || []);
    } catch (err) {
      console.error("[autosend list]", err);
    }
  }

  async function handleCancel(id: string) {
    const user = auth.currentUser;
    if (!user) return;
    setCancellingId(id);
    try {
      const idToken = await user.getIdToken();
      const res = await fetch("/api/paypal", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "autosend-cancel", idToken, scheduleId: id }),
      });
      const d = await res.json();
      if (!res.ok) throw new Error(d.error || "Could not cancel schedule");
      await loadList();
    } catch (err) {
      console.error("[autosend cancel]", err);
    } finally {
      setCancellingId(null);
    }
  }

  async function handleSubmit() {
    setMsg({ text: "", kind: "" });
    const amt = parseFloat(amount);

    if (!recipient) {
      setMsg({ text: "Enter a recipient email that matches a Siterifty account first.", kind: "err" });
      return;
    }
    if (!amt || amt < TRANSFER_MIN || amt > TRANSFER_MAX) {
      setMsg({ text: `Enter an amount between $${TRANSFER_MIN} and $${TRANSFER_MAX.toLocaleString()}.`, kind: "err" });
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
        body: JSON.stringify({
          action: "autosend-create",
          idToken,
          recipientUid: recipient.uid,
          amount: amt,
          intervalDays: interval,
          note: note.trim(),
        }),
      });
      const result = await res.json();
      if (!res.ok) throw new Error(result.error || "Could not schedule auto send");

      setMsg({ text: `✓ Scheduled $${amt.toFixed(2)} to ${result.schedule.recipientName} every ${interval} days.`, kind: "ok" });
      setEmail("");
      setAmount("");
      setNote("");
      reset();
      loadList();
    } catch (err: any) {
      console.error("[autosend create]", err);
      setMsg({ text: err.message || "Something went wrong. Please try again.", kind: "err" });
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div style={{ padding: "0.8rem 0 0.2rem" }}>
      <div className="input-group" style={{ marginBottom: 4 }}>
        <label>Recipient Email</label>
        <input
          id="asendEmail"
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

      <div style={{ display: "flex", gap: 8, margin: "10px 0" }}>
        <div className="input-group" style={{ flex: 1 }}>
          <label>Amount (USD)</label>
          <input
            id="asendAmt"
            className="input-field"
            type="number"
            min={TRANSFER_MIN}
            max={TRANSFER_MAX}
            step="0.01"
            value={amount}
            onChange={(e) => setAmount(e.target.value)}
            placeholder="25.00"
          />
        </div>
        <div className="input-group" style={{ flex: 1 }}>
          <label>Every</label>
          <select
            id="asendInterval"
            className="input-field"
            value={interval}
            onChange={(e) => setInterval_(Number(e.target.value))}
          >
            {INTERVALS.map((d) => (
              <option key={d} value={d}>
                {d} day{d !== 1 ? "s" : ""}
              </option>
            ))}
          </select>
        </div>
      </div>

      <div className="input-group" style={{ marginBottom: 10 }}>
        <label>Note (optional)</label>
        <input
          id="asendNote"
          className="input-field"
          type="text"
          maxLength={200}
          value={note}
          onChange={(e) => setNote(e.target.value)}
          placeholder="What's this for?"
        />
      </div>

      <button id="asendSubmit" className="save-btn" style={{ width: "100%" }} onClick={handleSubmit} disabled={submitting}>
        <span>{submitting ? "Scheduling…" : "Schedule Auto Send"}</span>
      </button>

      {msg.text ? (
        <div
          id="asendMsg"
          className={`wallet-msg${msg.kind ? ` ${msg.kind}` : ""}`}
          style={{ marginTop: 10, fontSize: "0.85rem", color: msg.kind === "err" ? "#f87171" : msg.kind === "ok" ? "#a3e635" : "#aaa" }}
        >
          {msg.text}
        </div>
      ) : null}

      <div id="asendList" style={{ marginTop: 12, display: "flex", flexDirection: "column", gap: 6 }}>
        {schedules?.map((s) => {
          const cancelledOrDone = s.status !== "active";
          const next = s.nextRunAt ? new Date(s.nextRunAt).toLocaleDateString(undefined, { month: "short", day: "numeric" }) : "—";
          return (
            <div
              key={s.id}
              className="wallet-tx-row"
              data-schedule-id={s.id}
              style={{ display: "flex", alignItems: "center", gap: 10, padding: "0.5rem 0", borderBottom: "1px solid #1c1c1c" }}
            >
              <div className={`wallet-tx-icon ${cancelledOrDone ? "neg" : "pending"}`} style={{ width: 28, height: 28, borderRadius: "50%", display: "flex", alignItems: "center", justifyContent: "center", background: "#1c1c1c", flexShrink: 0 }}>
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke={cancelledOrDone ? "#f87171" : "#facc15"} strokeWidth="2.4">
                  <circle cx="12" cy="12" r="10" />
                  <path d="M12 6v6l4 2" strokeLinecap="round" />
                </svg>
              </div>
              <div className="wallet-tx-mid" style={{ flex: 1, minWidth: 0 }}>
                <div className="wallet-tx-label" style={{ fontSize: "0.82rem", fontWeight: 600 }}>
                  ${Number(s.amount).toFixed(2)} to {s.recipientName} · every {s.intervalDays}d
                </div>
                <div className="wallet-tx-sub" style={{ fontSize: "0.72rem", color: "#888" }}>
                  {cancelledOrDone ? "Cancelled" : `Next: ${next} · Sent ${s.runCount || 0}×`}
                </div>
              </div>
              {!cancelledOrDone ? (
                <button
                  className="asend-cancel-btn"
                  data-schedule-id={s.id}
                  onClick={() => handleCancel(s.id)}
                  disabled={cancellingId === s.id}
                  style={{ background: "none", border: "1px solid rgba(247,100,100,.3)", color: "#f76464", borderRadius: 8, padding: "6px 10px", fontSize: 11, fontWeight: 700, cursor: "pointer" }}
                >
                  {cancellingId === s.id ? "Cancelling…" : "Cancel"}
                </button>
              ) : null}
            </div>
          );
        })}
        {schedules && schedules.length === 0 ? (
          <div id="asendEmpty" style={{ textAlign: "center", color: "#666", fontSize: "0.8rem", padding: "0.8rem 0" }}>
            No auto sends scheduled.
          </div>
        ) : null}
      </div>
    </div>
  );
}
