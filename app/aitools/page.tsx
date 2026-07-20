"use client";

// Ports the standalone "AI Tools" static HTML page (formatted__25_.html)
// into a real routed page, following this app's conventions:
//   - Auth gating via useAuth() / useAuthModal() (see app/myprofile/page.tsx),
//     not the original's own onAuthStateChanged + inline signInWithGoogle
//     wiring — the app already has a full sign-in modal for that.
//   - No page-local header: components/layout/Header.tsx is already global
//     (rendered from app/layout.tsx), so the original's brand/back-link/
//     user-avatar header markup was dropped, not re-implemented here.
//   - The one working tool (site ownership verification) is ported as-is,
//     calling the same external API — but the `diag +=` string-building
//     debug scaffolding and the final `alert('...' + diag)` from the
//     original are gone; failures now just set an error string in state.
//   - Of the six "Coming soon" cards, three already have real backends in
//     app/api/aistudio/_handler.js (auto-description, scam-check,
//     deal-message-assist) that were simply never wired into this page —
//     those three are wired for real here via lib/aiStudio.ts's
//     aiStudioCall, with real loading/error states, no placeholder alerts.
//   - The other three (valuation estimate, traffic snapshot, listing health
//     check) have NO backend anywhere in this app. They stay honest
//     "Coming soon" cards — nothing here fakes a result for them.
//
// This route fills a link that already existed and 404'd:
// components/marketplace/AiPromoCard.tsx's "Start using AI tools" CTA
// points at /aitools.

import { useState, type ReactNode } from "react";
import { useAuth } from "@/lib/AuthContext";
import SignInRequired from "@/components/auth/SignInRequired";
import { aiStudioCall, aiPlanCap } from "@/lib/aiStudio";
import { useAiLengthPicker } from "@/lib/useAiLengthPicker";

const VERIFY_API_BASE = "https://dlsvalue.site/api/verify.js";

function normalizeUrl(v: string): string | null {
  const trimmed = v.trim();
  if (!trimmed) return null;
  const withScheme = /^https?:\/\//i.test(trimmed) ? trimmed : `https://${trimmed}`;
  try {
    return new URL(withScheme).hostname.replace(/^www\./, "");
  } catch {
    return null;
  }
}

// ── Icons (ported inline from the original page's inline SVGs) ──
const IconVerify = (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2}>
    <path d="M9 12l2 2 4-4M7.835 4.697a3.42 3.42 0 001.68-.947 3.42 3.42 0 014.97 0 3.42 3.42 0 001.68.947 3.42 3.42 0 012.416 2.416 3.42 3.42 0 00.948 1.68 3.42 3.42 0 010 4.97 3.42 3.42 0 00-.948 1.68 3.42 3.42 0 01-2.416 2.416 3.42 3.42 0 00-1.68.947 3.42 3.42 0 01-4.97 0 3.42 3.42 0 00-1.68-.947 3.42 3.42 0 01-2.416-2.416 3.42 3.42 0 00-.947-1.68 3.42 3.42 0 010-4.97 3.42 3.42 0 00.947-1.68 3.42 3.42 0 012.416-2.416z" />
  </svg>
);
const IconValuation = (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2}>
    <path d="M12 2v20M17 5H9.5a3.5 3.5 0 000 7h5a3.5 3.5 0 010 7H6" />
  </svg>
);
const IconTraffic = (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2}>
    <path d="M3 3v18h18M7 14l4-4 3 3 5-6" />
  </svg>
);
const IconAutoDesc = (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2}>
    <path d="M12 20h9M16.5 3.5a2.12 2.12 0 013 3L7 19l-4 1 1-4L16.5 3.5z" />
  </svg>
);
const IconMessage = (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2}>
    <path d="M21 15a2 2 0 01-2 2H7l-4 4V5a2 2 0 012-2h14a2 2 0 012 2z" />
  </svg>
);
const IconScam = (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2}>
    <path d="M12 9v4M12 17h.01M10.29 3.86L1.82 18a2 2 0 001.71 3h16.94a2 2 0 001.71-3L13.71 3.86a2 2 0 00-3.42 0z" />
  </svg>
);
const IconHealth = (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2}>
    <circle cx="12" cy="12" r="10" />
    <path d="M12 6v6l4 2" />
  </svg>
);
const IconCopy = (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2}>
    <rect x="9" y="9" width="13" height="13" rx="2" />
    <path d="M5 15H4a2 2 0 01-2-2V4a2 2 0 012-2h9a2 2 0 012 2v1" />
  </svg>
);

// ══════════════════════════════════════════════════════════════════════
// Working tool: site ownership verification
// ══════════════════════════════════════════════════════════════════════
function VerifyOwnershipCard() {
  const [urlValue, setUrlValue] = useState("");
  const [inputErr, setInputErr] = useState(false);
  const [generating, setGenerating] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [snippet, setSnippet] = useState<{ domain: string; token: string } | null>(null);
  const [copied, setCopied] = useState(false);

  async function generateTag() {
    const domain = normalizeUrl(urlValue);
    if (!domain) {
      setInputErr(true);
      setTimeout(() => setInputErr(false), 1200);
      return;
    }
    setGenerating(true);
    setError(null);
    try {
      const res = await fetch(VERIFY_API_BASE, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "generate", domain }),
      });
      const data = await res.json().catch(() => null);
      if (!res.ok || !data?.token) {
        throw new Error(data?.error || "The verification service didn't return a token.");
      }
      setSnippet({ domain, token: data.token });
    } catch (e) {
      setError(e instanceof Error ? e.message : "Could not generate a snippet — please try again.");
      setSnippet(null);
    } finally {
      setGenerating(false);
    }
  }

  function copySnippet() {
    if (!snippet) return;
    navigator.clipboard.writeText(snippetText(snippet.token)).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    });
  }

  return (
    <div className="srf-tools-verify-card">
      <div className="srf-tools-verify-head">
        <div className="srf-tools-icon-badge">{IconVerify}</div>
        <h2>Verify site ownership</h2>
      </div>
      <p className="srf-tools-verify-desc">
        Enter your live website URL to generate a unique verification snippet. Paste it into your site&apos;s{" "}
        <code className="mono">&lt;head&gt;</code> — it will auto-verify your ownership and show a confirmation alert.
      </p>
      <div className="srf-tools-url-row">
        <input
          type="text"
          className={`srf-tools-url-input${inputErr ? " srf-tools-input-err" : ""}`}
          placeholder="yourwebsite.com"
          autoComplete="off"
          value={urlValue}
          onChange={(e) => setUrlValue(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter") generateTag();
          }}
        />
        <button className="srf-tools-btn-lime" disabled={generating} onClick={generateTag}>
          {generating ? "Generating…" : "Generate snippet"}
        </button>
      </div>
      {error && <div className="srf-tools-error">{error}</div>}
      {snippet && (
        <div className="srf-tools-result">
          <div className="srf-tools-result-label">Copy everything below into your site&apos;s &lt;head&gt;</div>
          <div className="srf-tools-code-block">
            <code>{snippetText(snippet.token)}</code>
            <button className={`srf-tools-copy-btn${copied ? " copied" : ""}`} onClick={copySnippet}>
              {IconCopy}
            </button>
          </div>
          <div className="srf-tools-verify-steps">
            <b>1.</b> Paste the snippet into your homepage&apos;s <code className="mono">&lt;head&gt;</code> &nbsp;•&nbsp;
            <b>2.</b> Save and publish your site &nbsp;•&nbsp;
            <b>3.</b> Visit your site — you&apos;ll see a &quot;Thanks!&quot; alert when it&apos;s verified
          </div>
        </div>
      )}
    </div>
  );
}

// Rebuilds the same self-verifying <meta>/<script> snippet the original
// page generated, minus the diag-building wrapper around it.
function snippetText(token: string): string {
  return `<!-- Siterifty verification -->
<meta name="siterifty-site-verification" content="${token}" />
<script>
!function(){var t="${token}",d=location.hostname.replace("www.","");fetch("${VERIFY_API_BASE}",{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify({action:"verify",domain:d,token:t})}).then(function(r){return r.json()}).then(function(r){if(r.verified)console.log("Siterifty: verified")}).catch(console.error)}();
</script>`;
}

// ══════════════════════════════════════════════════════════════════════
// Wired tool: Auto-description (existing backend: action 'auto-description')
// ══════════════════════════════════════════════════════════════════════
function AutoDescriptionCard({ plan }: { plan: string }) {
  const [expanded, setExpanded] = useState(false);
  const [title, setTitle] = useState("");
  const [generating, setGenerating] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [description, setDescription] = useState<string | null>(null);
  const [meta, setMeta] = useState<{ charCount: number; cap: number } | null>(null);
  const { pick, AiLengthPickerHost } = useAiLengthPicker();

  async function handleGenerate() {
    const t = title.trim();
    if (!t) {
      setError("Enter a listing title first so the AI knows what it's describing.");
      return;
    }
    setError(null);
    const cap = aiPlanCap(plan);
    const targetLength = await pick(cap, plan);
    if (targetLength === null) return; // cancelled

    setGenerating(true);
    try {
      const result = await aiStudioCall<{ description?: string; charCount?: number; cap?: number }>(
        "auto-description",
        { title: t, targetLength, plan }
      );
      const generated = (result.description || "").trim();
      if (!generated) throw new Error("The AI returned an empty description.");
      setDescription(generated);
      setMeta({ charCount: result.charCount ?? generated.length, cap: result.cap ?? cap });
    } catch (e) {
      setError(e instanceof Error ? e.message : "Could not generate a description right now — please try again.");
    } finally {
      setGenerating(false);
    }
  }

  return (
    <ToolCard
      icon={IconAutoDesc}
      name="Auto-description"
      desc="Turn your site's details into a clear, sellable listing description."
      live
      expanded={expanded}
      onToggle={() => setExpanded((v) => !v)}
    >
      <div className="srf-tools-field">
        <label htmlFor="srf-tools-autodesc-title">Listing title</label>
        <input
          id="srf-tools-autodesc-title"
          className="srf-tools-input"
          placeholder="e.g. Established SaaS tool for freelance invoicing"
          value={title}
          onChange={(e) => setTitle(e.target.value)}
        />
      </div>
      <button className="srf-tools-btn-lime" disabled={generating} onClick={handleGenerate}>
        {generating && <span className="srf-tools-spinner" />}
        {generating ? "Generating…" : "Generate description"}
      </button>
      {error && <div className="srf-tools-error">{error}</div>}
      {description && (
        <>
          <div className="srf-tools-result-box">{description}</div>
          {meta && (
            <div className="srf-tools-result-meta">
              {meta.charCount} / {meta.cap} characters — your {plan} plan&apos;s cap
            </div>
          )}
        </>
      )}
      <AiLengthPickerHost />
    </ToolCard>
  );
}

// ══════════════════════════════════════════════════════════════════════
// Wired tool: Buyer message assist (existing backend: action 'deal-message-assist')
// ══════════════════════════════════════════════════════════════════════
function BuyerMessageAssistCard() {
  const [expanded, setExpanded] = useState(false);
  const [listingTitle, setListingTitle] = useState("");
  const [listingSummary, setListingSummary] = useState("");
  const [buyerQuestion, setBuyerQuestion] = useState("");
  const [generating, setGenerating] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);

  async function handleGenerate() {
    if (!listingTitle.trim()) {
      setError("Enter the listing title so the reply stays on-topic.");
      return;
    }
    setError(null);
    setGenerating(true);
    try {
      const result = await aiStudioCall<{ message?: string }>("deal-message-assist", {
        listingTitle: listingTitle.trim(),
        listingSummary: listingSummary.trim(),
        userDraft: buyerQuestion.trim(),
      });
      const generated = (result.message || "").trim();
      if (!generated) throw new Error("The AI returned an empty reply.");
      setMessage(generated);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Could not draft a reply right now — please try again.");
    } finally {
      setGenerating(false);
    }
  }

  return (
    <ToolCard
      icon={IconMessage}
      name="Buyer message assist"
      desc="Draft clear, professional replies to buyer questions in one tap."
      live
      expanded={expanded}
      onToggle={() => setExpanded((v) => !v)}
    >
      <div className="srf-tools-field">
        <label htmlFor="srf-tools-bma-title">Listing title</label>
        <input
          id="srf-tools-bma-title"
          className="srf-tools-input"
          placeholder="e.g. Niche Shopify theme with 40 sales/mo"
          value={listingTitle}
          onChange={(e) => setListingTitle(e.target.value)}
        />
      </div>
      <div className="srf-tools-field">
        <label htmlFor="srf-tools-bma-summary">Listing summary (optional)</label>
        <textarea
          id="srf-tools-bma-summary"
          className="srf-tools-textarea"
          placeholder="A sentence or two about what you're selling"
          value={listingSummary}
          onChange={(e) => setListingSummary(e.target.value)}
        />
      </div>
      <div className="srf-tools-field">
        <label htmlFor="srf-tools-bma-question">Buyer&apos;s question / message</label>
        <textarea
          id="srf-tools-bma-question"
          className="srf-tools-textarea"
          placeholder="Paste what the buyer asked, or leave blank to draft an opening reply"
          value={buyerQuestion}
          onChange={(e) => setBuyerQuestion(e.target.value)}
        />
      </div>
      <button className="srf-tools-btn-lime" disabled={generating} onClick={handleGenerate}>
        {generating && <span className="srf-tools-spinner" />}
        {generating ? "Drafting…" : "Draft reply"}
      </button>
      {error && <div className="srf-tools-error">{error}</div>}
      {message && <div className="srf-tools-result-box">{message}</div>}
    </ToolCard>
  );
}

// ══════════════════════════════════════════════════════════════════════
// Wired tool: Scam guard (existing backend: action 'scam-check')
// ══════════════════════════════════════════════════════════════════════
function ScamGuardCard() {
  const [expanded, setExpanded] = useState(false);
  const [text, setText] = useState("");
  const [checking, setChecking] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [verdict, setVerdict] = useState<{
    action: "blocked" | "warned" | "allowed";
    reason?: string;
    warningText?: string | null;
  } | null>(null);

  async function handleCheck() {
    if (!text.trim()) {
      setError("Paste a message to check first.");
      return;
    }
    setError(null);
    setChecking(true);
    try {
      const result = await aiStudioCall<{
        action: "blocked" | "warned" | "allowed";
        reason?: string;
        warningText?: string | null;
      }>("scam-check", { text: text.trim() });
      setVerdict(result);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Could not check this message right now — please try again.");
      setVerdict(null);
    } finally {
      setChecking(false);
    }
  }

  return (
    <ToolCard
      icon={IconScam}
      name="Scam guard"
      desc="Flags risky language in buyer messages before you get pulled into a bad deal."
      live
      expanded={expanded}
      onToggle={() => setExpanded((v) => !v)}
    >
      <div className="srf-tools-field">
        <label htmlFor="srf-tools-scam-text">Message to check</label>
        <textarea
          id="srf-tools-scam-text"
          className="srf-tools-textarea"
          placeholder="Paste a buyer's message here"
          value={text}
          onChange={(e) => setText(e.target.value)}
        />
      </div>
      <button className="srf-tools-btn-lime" disabled={checking} onClick={handleCheck}>
        {checking && <span className="srf-tools-spinner" />}
        {checking ? "Checking…" : "Check message"}
      </button>
      {error && <div className="srf-tools-error">{error}</div>}
      {verdict && (
        <>
          <span className={`srf-tools-verdict ${verdict.action}`}>{verdict.action}</span>
          {verdict.warningText && <div className="srf-tools-result-box">{verdict.warningText}</div>}
          {!verdict.warningText && verdict.reason && <div className="srf-tools-result-box">{verdict.reason}</div>}
        </>
      )}
    </ToolCard>
  );
}

// ══════════════════════════════════════════════════════════════════════
// Shared card shell + honest stub for the three tools with no backend
// ══════════════════════════════════════════════════════════════════════
function ToolCard({
  icon,
  name,
  desc,
  live,
  expanded,
  onToggle,
  children,
}: {
  icon: ReactNode;
  name: string;
  desc: string;
  live: boolean;
  expanded: boolean;
  onToggle: () => void;
  children?: ReactNode;
}) {
  return (
    <div className={`srf-tools-card${live ? " srf-tools-live" : " srf-tools-locked"}${expanded ? " srf-tools-expanded" : ""}`}>
      <div className="srf-tools-tool-icon">{icon}</div>
      <div className="srf-tools-name">{name}</div>
      <div className="srf-tools-desc">{desc}</div>
      {live ? (
        <span className="srf-tools-badge srf-tools-live-badge" onClick={onToggle} role="button" tabIndex={0}>
          {expanded ? "Close" : "Try it"}
        </span>
      ) : (
        <span className="srf-tools-badge srf-tools-soon">Coming soon</span>
      )}
      {live && expanded && <div className="srf-tools-panel">{children}</div>}
    </div>
  );
}

function StubCard({ icon, name, desc }: { icon: ReactNode; name: string; desc: string }) {
  return (
    <div className="srf-tools-card srf-tools-locked">
      <div className="srf-tools-tool-icon">{icon}</div>
      <div className="srf-tools-name">{name}</div>
      <div className="srf-tools-desc">{desc}</div>
      <span className="srf-tools-badge srf-tools-soon">Coming soon</span>
    </div>
  );
}

// ══════════════════════════════════════════════════════════════════════
// Page
// ══════════════════════════════════════════════════════════════════════
export default function AiToolsPage() {
  const { user, profile, loading } = useAuth();

  return (
    <div className="srf-tools">
      <div className="srf-tools-bg-glow" />
      <div className="srf-tools-hero">
        <div className="srf-tools-eyebrow">
          <span className="srf-tools-dot" /> AI Tools
        </div>
        <h1 className="srf-tools-h1">
          Everything you need
          <br />
          before you <em>list it</em>.
        </h1>
        <p className="srf-tools-sub">
          Free tools for sellers — verify ownership, price it right, and get ready to sell with confidence.
        </p>
      </div>

      {loading || user === undefined ? (
        <div style={{ textAlign: "center", padding: "40px 0", color: "var(--st-text-faint, rgba(255,255,255,0.32))" }}>
          Loading…
        </div>
      ) : !user ? (
        <SignInRequired
          fullScreen={false}
          title="Sign in to use tools"
          description="You need to be signed in to generate verification snippets and use seller tools."
        />
      ) : (
        <>
          <VerifyOwnershipCard />

          <div className="srf-tools-section-head">
            <h3>More tools</h3>
            <p>New tools ship regularly</p>
          </div>
          <div className="srf-tools-grid">
            <StubCard
              icon={IconValuation}
              name="Valuation estimate"
              desc="Get an estimated price range based on traffic, revenue, and comparable sales."
            />
            <StubCard
              icon={IconTraffic}
              name="Traffic snapshot"
              desc="Pull a quick traffic and growth overview to include in your listing."
            />
            <AutoDescriptionCard plan={profile?.plan || "free"} />
            <BuyerMessageAssistCard />
            <ScamGuardCard />
            <StubCard
              icon={IconHealth}
              name="Listing health check"
              desc="A quick score on how complete and trustworthy your listing looks to buyers."
            />
          </div>
        </>
      )}

      <div className="srf-tools-foot-note">
        Have a tool idea? <a href="/feedback">Tell us what would help you sell.</a>
      </div>
    </div>
  );
}
