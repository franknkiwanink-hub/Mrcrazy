"use client";

import { useEffect, useState } from "react";
import { auth } from "@/lib/firebase";
import { useLimits } from "@/lib/useLimits";

// Ports the AUTO WITHDRAWAL section from wallet.js (autowithdraw-get/
// -save). Live bounds now come from useLimits() (GET /api/limits,
// LIMITS.autoWithdraw). FALLBACK_* match app/api/_lib/limits.js's
// autoWithdraw block exactly (minThreshold:10, maxThreshold:10000,
// minKeepBalance:0, maxKeepBalance:10000) and are used only until that
// fetch resolves.
const FALLBACK_MIN_THRESHOLD = 10;
const FALLBACK_MAX_THRESHOLD = 10000;
const FALLBACK_MIN_KEEP = 0;
const FALLBACK_MAX_KEEP = 10000;

export default function AutoWithdrawAddon({ onEnabled }: { onEnabled: () => void }) {
  const { limits } = useLimits();
  const MIN_THRESHOLD = limits.autoWithdraw.minThreshold ?? FALLBACK_MIN_THRESHOLD;
  const MAX_THRESHOLD = limits.autoWithdraw.maxThreshold ?? FALLBACK_MAX_THRESHOLD;
  const MIN_KEEP = limits.autoWithdraw.minKeepBalance ?? FALLBACK_MIN_KEEP;
  const MAX_KEEP = limits.autoWithdraw.maxKeepBalance ?? FALLBACK_MAX_KEEP;

  const [loaded, setLoaded] = useState(false);
  const [enabled, setEnabled] = useState(false);
  const [threshold, setThreshold] = useState("");
  const [keepBalance, setKeepBalance] = useState("");
  const [method, setMethod] = useState<"paypal" | "bank">("paypal");
  const [paypalEmail, setPaypalEmail] = useState("");
  const [saving, setSaving] = useState(false);
  const [msg, setMsg] = useState<{ text: string; kind: "ok" | "err" | "" }>({ text: "", kind: "" });

  useEffect(() => {
    loadSettings();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  async function loadSettings() {
    const user = auth.currentUser;
    if (!user) return;
    try {
      const idToken = await user.getIdToken();
      const res = await fetch("/api/paypal", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "autowithdraw-get", idToken }),
      });
      const d = await res.json();
      if (!res.ok) throw new Error(d.error || "Could not load auto withdrawal settings");
      setLoaded(true);
      setEnabled(Boolean(d.enabled));
      setThreshold(d.threshold ? d.threshold.toFixed(2) : "");
      setKeepBalance(d.keepBalance != null ? Number(d.keepBalance).toFixed(2) : "");
      setPaypalEmail(d.paypalEmail || user.email || "");
      setMethod(d.method === "bank" ? "bank" : "paypal");
    } catch (err) {
      console.error("[autowithdraw get]", err);
    }
  }

  async function handleSave() {
    setMsg({ text: "", kind: "" });
    const th = parseFloat(threshold);
    const keep = keepBalance === "" ? 0 : parseFloat(keepBalance);

    if (enabled) {
      if (!paypalEmail.trim() || !paypalEmail.includes("@")) {
        setMsg({ text: "Enter a valid payout email.", kind: "err" });
        return;
      }
      if (!th || th < MIN_THRESHOLD || th > MAX_THRESHOLD) {
        setMsg({ text: `Threshold must be between $${MIN_THRESHOLD} and $${MAX_THRESHOLD.toLocaleString()}.`, kind: "err" });
        return;
      }
      if (keep < MIN_KEEP || keep > MAX_KEEP) {
        setMsg({ text: `Keep-in-wallet amount must be between $${MIN_KEEP} and $${MAX_KEEP.toLocaleString()}.`, kind: "err" });
        return;
      }
      if (keep >= th) {
        setMsg({ text: "The amount you keep must be less than your threshold.", kind: "err" });
        return;
      }
    }

    setSaving(true);
    try {
      const user = auth.currentUser;
      if (!user) throw new Error("Not signed in");
      const idToken = await user.getIdToken();
      const res = await fetch("/api/paypal", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "autowithdraw-save",
          idToken,
          enabled,
          threshold: th,
          keepBalance: keep,
          method,
          paypalEmail: paypalEmail.trim(),
        }),
      });
      const result = await res.json();
      if (!res.ok) throw new Error(result.error || "Could not save auto withdrawal settings");

      setMsg({ text: enabled ? "✓ Auto withdrawal enabled." : "✓ Auto withdrawal disabled.", kind: "ok" });
      // Enabling can trigger an immediate payout server-side if the user is
      // already over threshold — let the parent refresh balance/history.
      if (enabled) onEnabled();
    } catch (err: any) {
      console.error("[autowithdraw save]", err);
      setMsg({ text: err.message || "Something went wrong. Please try again.", kind: "err" });
    } finally {
      setSaving(false);
    }
  }

  return (
    <div style={{ padding: "0.8rem 0 0.2rem" }}>
      <label style={{ display: "flex", alignItems: "center", gap: 10, cursor: "pointer", marginBottom: 4 }}>
        <input
          id="awdToggle"
          type="checkbox"
          checked={enabled}
          onChange={(e) => {
            setEnabled(e.target.checked);
            setMsg({ text: "", kind: "" });
          }}
        />
        <span style={{ fontWeight: 700, fontSize: "0.85rem" }}>Enable Auto Withdrawal</span>
      </label>
      <p className="hint" style={{ margin: "0 0 8px" }}>
        Automatically withdraw funds above a threshold, keeping a set balance in your wallet.
      </p>

      {!loaded ? null : enabled ? (
        <div id="awdExtra" className="visible">
          <div style={{ display: "flex", gap: 8, marginBottom: 10 }}>
            {(["paypal", "bank"] as const).map((m) => (
              <button
                key={m}
                className={`wallet-method-card${method === m ? " active" : ""}`}
                data-awdmethod={m}
                onClick={() => setMethod(m)}
                style={{
                  flex: 1,
                  padding: "0.55rem",
                  borderRadius: 8,
                  border: method === m ? "1px solid #fff" : "1px solid #2a2a2a",
                  background: method === m ? "rgba(255,255,255,0.08)" : "transparent",
                  color: method === m ? "#fff" : "#999",
                  fontWeight: 600,
                  fontSize: "0.8rem",
                  cursor: "pointer",
                  textTransform: "capitalize",
                }}
              >
                {m === "paypal" ? "PayPal" : "Bank Transfer"}
              </button>
            ))}
          </div>
          <div className="input-group" style={{ marginBottom: 10 }}>
            <label>Payout Email</label>
            <input
              id="awdPaypalEmail"
              className="input-field"
              type="email"
              value={paypalEmail}
              onChange={(e) => setPaypalEmail(e.target.value)}
              placeholder="you@example.com"
            />
          </div>
          <div style={{ display: "flex", gap: 8, marginBottom: 10 }}>
            <div className="input-group" style={{ flex: 1 }}>
              <label>When withdrawable reaches</label>
              <input
                id="awdThreshold"
                className="input-field"
                type="number"
                min={MIN_THRESHOLD}
                max={MAX_THRESHOLD}
                step="0.01"
                value={threshold}
                onChange={(e) => setThreshold(e.target.value)}
                placeholder="100.00"
              />
            </div>
            <div className="input-group" style={{ flex: 1 }}>
              <label>Keep in wallet</label>
              <input
                id="awdKeepBalance"
                className="input-field"
                type="number"
                min={MIN_KEEP}
                max={MAX_KEEP}
                step="0.01"
                value={keepBalance}
                onChange={(e) => setKeepBalance(e.target.value)}
                placeholder="0.00"
              />
            </div>
          </div>
        </div>
      ) : null}

      <button id="awdSubmit" className="save-btn" style={{ width: "100%" }} onClick={handleSave} disabled={saving}>
        <span>{saving ? "Saving…" : "Save Auto Withdrawal Settings"}</span>
      </button>

      {msg.text ? (
        <div
          id="awdMsg"
          className={`wallet-msg${msg.kind ? ` ${msg.kind}` : ""}`}
          style={{ marginTop: 10, fontSize: "0.85rem", color: msg.kind === "err" ? "#f87171" : msg.kind === "ok" ? "#a3e635" : "#aaa" }}
        >
          {msg.text}
        </div>
      ) : null}
    </div>
  );
}
