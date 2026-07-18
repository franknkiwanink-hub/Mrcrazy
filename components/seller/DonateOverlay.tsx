"use client";

import { useEffect, useState } from "react";
import { useAuth } from "@/lib/AuthContext";
import { useAuthModal } from "@/components/auth/AuthModalProvider";

// Fixed 15% platform fee — mirrors DONATION_FEE_RATE in paypal.js. Used
// here only for the live "seller receives" preview as the donor types;
// the server recomputes this independently and is the real source of
// truth for what's actually charged.
const DONATION_FEE_RATE_CLIENT = 0.15;

interface DonationRow {
  donorName?: string;
  donorPic?: string;
  amount?: number;
  note?: string;
  createdAt?: string | number;
}

interface DonationsSummary {
  totalDonated?: number;
  donationCount?: number;
  recent?: DonationRow[];
}

const donateCache = new Map<string, DonationsSummary>();

function fmtMoney2(n: number) {
  return "$" + n.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

function DonationRowView({ don }: { don: DonationRow }) {
  const name = don.donorName || "Anonymous";
  const initial = name.charAt(0).toUpperCase();
  const amt = fmtMoney2(Number(don.amount || 0));
  const when = don.createdAt
    ? new Date(don.createdAt).toLocaleString(undefined, { month: "short", day: "numeric", hour: "numeric", minute: "2-digit" })
    : "";
  return (
    <div className="sp-donate-row">
      <div className="sp-donate-av">
        {don.donorPic ? (
          <img
            src={don.donorPic}
            alt={name}
            onError={(e) => {
              (e.currentTarget.parentElement as HTMLElement).textContent = initial;
            }}
          />
        ) : (
          initial
        )}
      </div>
      <div className="sp-donate-mid">
        <div className="sp-donate-name">{name}</div>
        {don.note ? <div className="sp-donate-note">&quot;{don.note}&quot;</div> : null}
        <div className="sp-donate-when">{when}</div>
      </div>
      <div className="sp-donate-amt">{amt}</div>
    </div>
  );
}

export default function DonateOverlay({
  sellerUid,
  sellerName,
  onClose,
}: {
  sellerUid: string;
  sellerName: string;
  onClose: () => void;
}) {
  const { user, profile } = useAuth();
  const { openAuthModal } = useAuthModal();
  const [summary, setSummary] = useState<DonationsSummary | null>(donateCache.get(sellerUid) || null);
  const [loadingSummary, setLoadingSummary] = useState(!donateCache.has(sellerUid));
  const [amt, setAmt] = useState("");
  const [note, setNote] = useState("");
  const [msg, setMsg] = useState<{ text: string; ok: boolean } | null>(null);
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    if (!user) {
      onClose();
      openAuthModal();
    }
    // Only checked once on mount, matching the original's guard at the
    // top of spOpenDonateOverlay before the overlay is ever shown.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const resp = await fetch("/api/paypal", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ action: "get-donations", sellerUid }),
        });
        const out = await resp.json();
        if (!resp.ok || !out.ok) throw new Error(out.error || "Could not load donations");
        donateCache.set(sellerUid, out);
        if (!cancelled) {
          setSummary(out);
          setLoadingSummary(false);
        }
      } catch (err) {
        console.error("[DonateOverlay] load donations failed", err);
        if (!cancelled && !donateCache.has(sellerUid)) setLoadingSummary(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [sellerUid]);

  const amtNum = parseFloat(amt);
  const showFee = amtNum > 0;
  const fee = showFee ? amtNum * DONATION_FEE_RATE_CLIENT : 0;
  const receive = showFee ? amtNum - fee : 0;

  async function handleSubmit() {
    setMsg(null);
    if (!user) {
      onClose();
      openAuthModal();
      return;
    }
    if (!amtNum || amtNum < 1 || amtNum > 2500) {
      setMsg({ text: "Enter an amount between $1 and $2,500.", ok: false });
      return;
    }
    const bal = Number(profile?.walletBalance || 0);
    if (amtNum > bal) {
      setMsg({ text: `Insufficient balance — you have $${bal.toFixed(2)}.`, ok: false });
      return;
    }
    setSubmitting(true);
    try {
      const idToken = await user.getIdToken();
      const res = await fetch("/api/paypal", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "donate",
          idToken,
          sellerUid,
          amount: amtNum,
          note: note.trim(),
        }),
      });
      const result = await res.json();
      if (!res.ok) throw new Error(result.error || "Donation failed");

      // profile.walletBalance updates live via AuthContext's onSnapshot
      // listener once the server-side balance write lands, so no manual
      // wallet-bridge sync is needed here (the original's window.__wallet*
      // bridge calls were working around not having that live listener).

      setMsg({ text: `✓ Donated $${amtNum.toFixed(2)} to ${result.sellerName || sellerName}. Thank you!`, ok: true });
      setAmt("");
      setNote("");

      donateCache.delete(sellerUid);
      setLoadingSummary(true);
      fetch("/api/paypal", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "get-donations", sellerUid }),
      })
        .then((r) => r.json())
        .then((out) => {
          if (out.ok !== false) {
            donateCache.set(sellerUid, out);
            setSummary(out);
          }
          setLoadingSummary(false);
        })
        .catch(() => setLoadingSummary(false));
    } catch (err: any) {
      setMsg({ text: err.message || "Something went wrong. Please try again.", ok: false });
    } finally {
      setSubmitting(false);
    }
  }

  const recent = summary?.recent || [];

  return (
    <div
      id="spDonateOverlay"
      className="active"
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div id="spDonateBox">
        <button id="spDonateClose" aria-label="Close" onClick={onClose}>
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
            <line x1="18" y1="6" x2="6" y2="18" />
            <line x1="6" y1="6" x2="18" y2="18" />
          </svg>
        </button>

        <div id="spDonateHeader">
          <div id="spDonateIcon">
            <svg viewBox="0 0 24 24" fill="currentColor">
              <path d="M20.84 4.61a5.5 5.5 0 00-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 00-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 000-7.78z" />
            </svg>
          </div>
          <div>
            <div id="spDonateTitle">
              Support <span id="spDonateSellerName">{sellerName}</span>
            </div>
            <div id="spDonateSubtitle">Donations go straight to their wallet.</div>
          </div>
        </div>

        <div id="spDonateSummary">
          <div className="sp-donate-summary-stat">
            <div className="sp-donate-summary-val" id="spDonateTotalVal">
              {loadingSummary ? "—" : fmtMoney2(Number(summary?.totalDonated || 0))}
            </div>
            <div className="sp-donate-summary-lbl">Total received</div>
          </div>
          <div className="sp-donate-summary-divider" />
          <div className="sp-donate-summary-stat">
            <div className="sp-donate-summary-val" id="spDonateCountVal">
              {loadingSummary ? "—" : String(summary?.donationCount || 0)}
            </div>
            <div className="sp-donate-summary-lbl">Donations</div>
          </div>
        </div>

        <div className="wallet-field-label" style={{ marginTop: 4 }}>
          Amount to donate
        </div>
        <div className="wallet-amount-input-wrap">
          <span className="wallet-amount-currency">$</span>
          <input
            type="number"
            id="spDonateAmt"
            inputMode="decimal"
            placeholder="0.00"
            min={1}
            max={2500}
            step={0.01}
            value={amt}
            onChange={(e) => setAmt(e.target.value)}
          />
        </div>
        <div id="spDonateQuickAmounts">
          {[5, 10, 25, 50].map((v) => (
            <button
              key={v}
              type="button"
              className={`sp-donate-quick-btn${amtNum === v ? " active" : ""}`}
              onClick={() => setAmt(String(v))}
            >
              ${v}
            </button>
          ))}
        </div>

        <div className="wallet-field-label">Message (optional)</div>
        <input
          type="text"
          id="spDonateNote"
          className="wallet-text-input"
          placeholder="Say something nice…"
          maxLength={200}
          value={note}
          onChange={(e) => setNote(e.target.value)}
        />

        {showFee && (
          <div className="wallet-fee-breakdown" id="spDonateFeeRow">
            <div className="wallet-fee-line">
              <span>Platform fee (15%)</span>
              <span id="spDonateFee">${fee.toFixed(2)}</span>
            </div>
            <div className="wallet-fee-line total">
              <span>Seller receives</span>
              <span id="spDonateReceive">${receive.toFixed(2)}</span>
            </div>
          </div>
        )}

        {msg && <div id="spDonateMsg" className={`wallet-msg ${msg.ok ? "ok" : "err"}`}>{msg.text}</div>}

        <button id="spDonateSubmitBtn" disabled={submitting} onClick={handleSubmit}>
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round">
            <path
              d="M20.84 4.61a5.5 5.5 0 00-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 00-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 000-7.78z"
              fill="currentColor"
              stroke="none"
            />
          </svg>
          <span>{submitting ? "Donating…" : "Donate"}</span>
        </button>

        <div id="spDonateRecentHdr">Recent donations</div>
        {loadingSummary ? (
          <div id="spDonateRecentList">
            <div className="sp-donate-skel" />
            <div className="sp-donate-skel" />
            <div className="sp-donate-skel" />
          </div>
        ) : recent.length ? (
          <div id="spDonateRecentList">
            {recent.map((d, i) => (
              <DonationRowView key={i} don={d} />
            ))}
          </div>
        ) : (
          <div id="spDonateRecentEmpty" style={{ display: "block" }}>
            No donations yet — be the first!
          </div>
        )}
      </div>
    </div>
  );
}
