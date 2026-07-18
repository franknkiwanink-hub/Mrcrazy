"use client";

import { useMemo, useState } from "react";
import StaticPage, { StaticSection } from "@/components/layout/StaticPage";

// Full port of the Help Center FAQ from Js/support-modals.js (lines
// 69-153 of the original — the HELP_FAQS dataset + category pills + live
// search). The version that was here before had the right shell
// (StaticPage) but only a handful of hand-picked FAQs in a plain
// accordion, with no search or category filtering — this replaces it with
// the complete original dataset and the same interactive behavior
// (category toggle, live search that also clears the active category,
// single-open accordion per item).

interface Faq {
  cat: string;
  q: string;
  a: string;
}

const CATS: { id: string; label: string }[] = [
  { id: "buying", label: "Buying" },
  { id: "selling", label: "Selling" },
  { id: "escrow", label: "Escrow & Payments" },
  { id: "disputes", label: "Disputes" },
  { id: "account", label: "Account" },
  { id: "billing", label: "Billing & Plans" },
];

const FAQS: Faq[] = [
  { cat: "buying", q: "How do I buy a listing safely?", a: "Every purchase goes through escrow: your payment is held by Siterifty, not sent directly to the seller. Once the seller delivers using the transfer method shown on the listing and you confirm everything works, funds are released. If something is wrong, you can open a dispute before confirming." },
  { cat: "buying", q: "What should I check before buying a website or app?", a: "Review the listed financials, the tech stack, and the transfer method. Ask the seller questions in the deal chat before paying if anything is unclear — that conversation is saved and can be referenced later if you need to open a dispute." },
  { cat: "buying", q: "Can I negotiate the price?", a: "Yes. Use the deal chat to message the seller directly before starting a purchase. Many listings marked \"Make offer\" expect a negotiation." },
  { cat: "buying", q: "What am I actually covered for as a buyer?", a: "See the Buyer Protection page (in the sidebar, or from About Us) for the full breakdown of what qualifies for a refund, the dispute window, and what to submit if something goes wrong." },
  { cat: "selling", q: "How do I list a website, app, or game for sale?", a: "Tap \"Start Selling\" from the sidebar, choose your listing type, and fill in the details — title, description, financials, tech stack, screenshots, and your preferred transfer method. Listings are reviewed briefly before going live." },
  { cat: "selling", q: "When do I get paid?", a: "Once the buyer confirms they've received and verified the asset, escrow releases the funds to your wallet, minus the marketplace fee. You can then withdraw or use the balance toward boosts and plans." },
  { cat: "selling", q: "Can I edit a listing after publishing it?", a: "Yes, from your listing management screen. Major changes to financials or asking price on an active listing with an open offer may require buyer notice." },
  { cat: "escrow", q: "How does escrow actually work?", a: "When a buyer pays, funds move into a secure holding balance tied to that deal — not into the seller's wallet yet. The seller then delivers the asset. The buyer has a window to verify everything matches the listing before confirming completion, which releases the funds." },
  { cat: "escrow", q: "What fees does Siterifty charge?", a: "A marketplace fee is deducted from the sale price when a deal completes. The exact percentage is shown at checkout before you confirm, so you always know the number before you commit." },
  { cat: "escrow", q: "What payment methods are supported?", a: "Wallet balance and PayPal are supported for deposits and withdrawals. Supported methods are shown in the Wallet screen and may vary by region." },
  { cat: "escrow", q: "How much is the fee on my plan, exactly?", a: "See the Escrow & Payments page (sidebar, or from About Us) for the full fee breakdown by plan and how withdrawals work." },
  { cat: "disputes", q: "What happens if a seller doesn't deliver?", a: "Open a dispute before confirming the deal as complete. Our support team reviews the deal chat and delivery evidence, and funds remain in escrow until it's resolved — they are not released to the seller automatically." },
  { cat: "disputes", q: "How long does a dispute take to resolve?", a: "Most disputes are reviewed within a few business days. Complex cases involving large transfers or conflicting evidence can take longer. You'll get updates in your notifications as the review progresses." },
  { cat: "disputes", q: "Can I cancel a deal before it completes?", a: "If the seller hasn't delivered yet, you can request cancellation through the deal chat. If both sides agree, escrow refunds the buyer. If there's disagreement, open a dispute instead." },
  { cat: "account", q: "How do I change my email or username?", a: "Go to Settings → General to update your profile details, including display name, username, and contact email." },
  { cat: "account", q: "I forgot my password — what do I do?", a: "Use \"Forgot password\" on the sign-in screen to receive a reset link for your account email." },
  { cat: "account", q: "How do I delete my account?", a: "Settings → Data includes an option to request account deletion. Any funds in escrow must be resolved first, and some transaction records may be retained as required by law." },
  { cat: "billing", q: "What's the difference between plans?", a: "Free accounts can buy and sell with standard fees. Paid plans reduce marketplace fees, unlock listing boosts, and add features like priority support — compare plans under Settings → Business." },
  { cat: "billing", q: "How do I cancel my subscription?", a: "Settings → Business → Manage Plan lets you downgrade or cancel at any time; you keep paid features until the end of the current billing period." },
  { cat: "billing", q: "Do boosted listings cost extra?", a: "Yes — boosting is a separate paid add-on from your subscription plan and is billed at the time you boost a listing." },
];

export default function HelpPage() {
  const [activeCat, setActiveCat] = useState<string | null>(null);
  const [search, setSearch] = useState("");
  const [openIdx, setOpenIdx] = useState<number | null>(null);

  const filtered = useMemo(() => {
    const term = search.trim().toLowerCase();
    let list = FAQS;
    if (activeCat) list = list.filter((f) => f.cat === activeCat);
    if (term) list = list.filter((f) => f.q.toLowerCase().includes(term) || f.a.toLowerCase().includes(term));
    return list;
  }, [activeCat, search]);

  const heading = activeCat ? CATS.find((c) => c.id === activeCat)?.label : "Frequently asked questions";

  return (
    <StaticPage
      eyebrow="Help Center"
      title="How can we help?"
      intro="Search the FAQ below, or browse by topic — buying, selling, escrow, disputes, account, and billing."
    >
      <StaticSection>
        <input
          type="search"
          value={search}
          onChange={(e) => {
            const v = e.target.value;
            setSearch(v);
            if (v.trim()) setActiveCat(null);
          }}
          placeholder="Search questions…"
          style={{
            width: "100%",
            background: "var(--mp-surface)",
            border: "1px solid var(--mp-border)",
            borderRadius: "var(--mp-radius)",
            color: "var(--mp-text)",
            fontSize: 15,
            padding: "12px 16px",
            outline: "none",
          }}
        />

        <div style={{ display: "flex", flexWrap: "wrap", gap: 8, marginTop: 16 }}>
          {CATS.map((c) => {
            const active = activeCat === c.id;
            return (
              <button
                key={c.id}
                type="button"
                onClick={() => {
                  setActiveCat(active ? null : c.id);
                  setOpenIdx(null);
                }}
                style={{
                  background: active ? "var(--mp-accent)" : "var(--mp-surface)",
                  color: active ? "#050505" : "var(--mp-text-sec)",
                  border: `1px solid ${active ? "var(--mp-accent)" : "var(--mp-border)"}`,
                  borderRadius: 999,
                  fontSize: 13,
                  fontWeight: 700,
                  padding: "7px 14px",
                  cursor: "pointer",
                }}
              >
                {c.label}
              </button>
            );
          })}
        </div>
      </StaticSection>

      <StaticSection heading={heading}>
        {filtered.length === 0 ? (
          <p style={{ opacity: 0.6 }}>No questions match your search. Try a different term, or see the Contact Us page.</p>
        ) : (
          <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
            {filtered.map((f, i) => {
              const isOpen = openIdx === i;
              return (
                <div
                  key={f.q}
                  style={{
                    background: "var(--mp-surface)",
                    border: "1px solid var(--mp-border)",
                    borderRadius: "var(--mp-radius)",
                    overflow: "hidden",
                  }}
                >
                  <button
                    type="button"
                    onClick={() => setOpenIdx(isOpen ? null : i)}
                    style={{
                      width: "100%",
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "space-between",
                      gap: 12,
                      background: "none",
                      border: "none",
                      color: "var(--mp-text)",
                      fontSize: 15,
                      fontWeight: 700,
                      textAlign: "left",
                      padding: "14px 18px",
                      cursor: "pointer",
                    }}
                  >
                    <span>{f.q}</span>
                    <svg
                      width="16"
                      height="16"
                      viewBox="0 0 24 24"
                      fill="none"
                      stroke="currentColor"
                      strokeWidth={2.4}
                      strokeLinecap="round"
                      style={{ flexShrink: 0, transform: isOpen ? "rotate(45deg)" : "none", transition: "transform 0.15s" }}
                    >
                      <line x1="12" y1="5" x2="12" y2="19" />
                      <line x1="5" y1="12" x2="19" y2="12" />
                    </svg>
                  </button>
                  {isOpen ? (
                    <div style={{ padding: "0 18px 16px", color: "var(--mp-text-sec)", fontSize: 14.5, lineHeight: 1.7 }}>{f.a}</div>
                  ) : null}
                </div>
              );
            })}
          </div>
        )}
      </StaticSection>

      <StaticSection heading="Still stuck?">
        <p>Reach out any time — see the Contact Us page for the fastest way to get a real answer.</p>
      </StaticSection>
    </StaticPage>
  );
}
