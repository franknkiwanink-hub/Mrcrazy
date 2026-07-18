"use client";

import React, { useEffect, useRef, useState } from "react";
import { useConfirm } from "@/lib/useConfirm";
import {
  useTransferDeal,
  TDM_CATEGORIES,
  TDM_TYPE_THEME,
  TDM_IMAGE_EXT_RE,
  type TdmListingType,
  type TdmItemType,
  type TdmPayload,
} from "@/lib/useTransferDeal";
import { TdmIcon, TdmArrowIcon, TdmCheckmarkIcon } from "./tdmIcons";
import type { PaymentStatus } from "@/lib/useDealChat";

// Ports the UI layer of Js/transfer-deal.js (933 lines) — checklist grid
// (2-column, per .tdm-checklist-column in globals.css), per-item modal
// (upload/transfer/credential + login-form toggle), preview sheet,
// finalize-into-zip flow, real payment-status warning banner, and the
// GitHub collaborator card. Styling is 100% the already-ported .tdm-*
// classes in globals.css (verified 1:1 against the original — no new
// CSS was needed for this component).
//
// Opened from DealChatPanel.tsx's two "Coming soon" stubs:
//   - Seller's "Mark Delivered" button → opens straight into the
//     checklist for the buyer's listing type.
//   - "Transfer Deal" attach-pill → same modal.
// Both call sites pass the same props; this component doesn't care
// which one opened it.

const NAV_TABS: TdmListingType[] = ["website", "game", "app"];

export interface TransferDealModalProps {
  chatRoomId: string;
  sellerUid: string | null;
  buyerUid: string | null;
  listingId: string | null;
  dealId: string | null;
  paymentStatus: PaymentStatus;
  isSeller: boolean;
  syncThreads: (previewText: string, sellerUid: string | null, buyerUid: string | null) => Promise<void>;
  onClose: () => void;
}

export default function TransferDealModal(props: TransferDealModalProps) {
  const { chatRoomId, sellerUid, buyerUid, listingId, dealId, paymentStatus, isSeller, syncThreads, onClose } = props;
  const { alert, ConfirmHost } = useConfirm();

  const tdm = useTransferDeal({ chatRoomId, sellerUid, buyerUid, listingId, dealId, paymentStatus, isSeller, syncThreads });

  const [activeItem, setActiveItem] = useState<{ key: string; type: TdmItemType; label: string } | null>(null);
  const [previewOpen, setPreviewOpen] = useState(false);

  // Lock page scroll while open, same as the rest of the app's modals.
  useEffect(() => {
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = prev;
    };
  }, []);

  function handleClose() {
    onClose();
  }

  const warningBannerText = getWarningBanner(paymentStatus, tdm.isTabFinalized);

  return (
    <div id="transferDealModal" className="tdm-open">
      <header className="tdm-header">
        <div className="tdm-brand">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
            <path d="M17 1l4 4-4 4" />
            <path d="M3 11V9a4 4 0 014-4h14" />
            <path d="M7 23l-4-4 4-4" />
            <path d="M21 13v2a4 4 0 01-4 4H3" />
          </svg>
          <h2>TRANSFER DEALS</h2>
        </div>
        <button className="tdm-cancel-btn" onClick={handleClose}>
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2.5}>
            <line x1="18" y1="6" x2="6" y2="18" />
            <line x1="6" y1="6" x2="18" y2="18" />
          </svg>
          Cancel
        </button>
      </header>

      {warningBannerText ? (
        <div className={`tdm-warning-banner active ${warningBannerClass(paymentStatus, tdm.isTabFinalized)}`} dangerouslySetInnerHTML={{ __html: warningBannerText }} />
      ) : null}

      {tdm.loadError ? (
        <div style={{ padding: "0.5rem 1.2rem", fontSize: "0.78rem", color: "#eab308", textAlign: "center" }}>{tdm.loadError}</div>
      ) : null}

      <GithubCard tdm={tdm} isSeller={isSeller} alert={alert} />

      <nav className="tdm-checklist-nav">
        {NAV_TABS.map((t) => (
          <button key={t} className={`tdm-nav-btn${tdm.tab === t ? " active" : ""}`} onClick={() => tdm.switchTab(t)}>
            {t.toUpperCase()}
          </button>
        ))}
      </nav>

      <main className="tdm-checklist-main">
        <ChecklistGrid tab={tdm.tab} completed={tdm.completed} onOpenItem={(key, type, label) => setActiveItem({ key, type, label })} />
      </main>

      <FloatingCta finalized={tdm.isTabFinalized} enabled={tdm.anyCompletedInTab} onClick={() => tdm.anyCompletedInTab && !tdm.isTabFinalized && setPreviewOpen(true)} />

      {activeItem ? (
        <ItemModal
          key={activeItem.key}
          label={activeItem.label}
          type={activeItem.type}
          buyerEmail={tdm.buyerEmail}
          existing={tdm.payloads[activeItem.key]}
          onCancel={() => setActiveItem(null)}
          onDone={(payload) => {
            tdm.markCompleted(activeItem.key, payload);
            setActiveItem(null);
          }}
          alert={alert}
        />
      ) : null}

      {previewOpen ? (
        <PreviewSheet
          tab={tdm.tab}
          completedKeysForTab={tdm.completedKeysForTab}
          finalizing={tdm.finalizing}
          onRemove={(key) => {
            tdm.unmarkCompleted(key);
            if (tdm.completedKeysForTab(tdm.tab).length <= 1) setPreviewOpen(false);
          }}
          onClose={() => setPreviewOpen(false)}
          onConfirm={async () => {
            const result = await tdm.finalizeTransfer();
            if (result.ok === true) {
              setPreviewOpen(false);
            } else if (result.ok === false) {
              await alert({ theme: "danger", title: "Transfer Failed", msg: result.error });
            }
          }}
        />
      ) : null}

      <ConfirmHost />
    </div>
  );
}

function getWarningBanner(status: PaymentStatus, isFinalized: boolean): string | null {
  if (isFinalized) return "\u26a0\ufe0f <b>This cannot be reversed.</b> The deal is finalized. Thank you \u263a\ufe0f";
  if (status === "unfunded") return "<b>Payment hasn\u2019t been made yet.</b> You can prepare your delivery items now, but wait for the buyer\u2019s payment to be confirmed in escrow before sending credentials or files.";
  if (status === "funded") return "<b>Payment is locked in escrow.</b> It won\u2019t reach your wallet until the buyer confirms they\u2019ve received everything. Either side can open a dispute if something goes wrong.";
  if (status === "delivered") return "<b>Delivery sent.</b> Funds stay in escrow until the buyer confirms receipt \u2014 you\u2019ll be notified once they release payment.";
  if (status === "disputed") return "<b>This deal is under dispute.</b> Funds remain in escrow while our support team reviews it.";
  return "<b>Funds are secured in escrow</b> for the duration of this deal.";
}

function warningBannerClass(status: PaymentStatus, isFinalized: boolean): string {
  if (isFinalized) return "tdm-status-delivered";
  if (status === "funded") return "tdm-status-funded";
  if (status === "delivered") return "tdm-status-delivered";
  if (status === "disputed") return "tdm-status-disputed";
  return "";
}

function ChecklistGrid({
  tab,
  completed,
  onOpenItem,
}: {
  tab: TdmListingType;
  completed: Record<string, boolean>;
  onOpenItem: (key: string, type: TdmItemType, label: string) => void;
}) {
  const data = TDM_CATEGORIES[tab];
  return (
    <div className="tdm-checklist-container">
      <div className="tdm-checklist-column">
        {data.left.map((item, idx) => (
          <ChecklistRow key={idx} item={item} itemKey={`${tab}-${idx}`} completed={!!completed[`${tab}-${idx}`]} onOpen={onOpenItem} />
        ))}
      </div>
      <div className="tdm-checklist-column">
        {data.right.map((item, idx) => {
          const realIdx = data.left.length + idx;
          return <ChecklistRow key={realIdx} item={item} itemKey={`${tab}-${realIdx}`} completed={!!completed[`${tab}-${realIdx}`]} onOpen={onOpenItem} />;
        })}
      </div>
    </div>
  );
}

function ChecklistRow({
  item,
  itemKey,
  completed,
  onOpen,
}: {
  item: { label: string; icon: string; type: TdmItemType };
  itemKey: string;
  completed: boolean;
  onOpen: (key: string, type: TdmItemType, label: string) => void;
}) {
  return (
    <div className={`tdm-checklist-item${completed ? " tdm-completed" : ""}`} onClick={() => onOpen(itemKey, item.type, item.label)}>
      <div className="tdm-icon-wrapper">
        <TdmIcon id={item.icon} />
      </div>
      <span className="tdm-item-label">{item.label}</span>
      <div className="tdm-arrow-wrapper">
        <TdmArrowIcon />
      </div>
      <TdmCheckmarkIcon />
    </div>
  );
}

function FloatingCta({ finalized, enabled, onClick }: { finalized: boolean; enabled: boolean; onClick: () => void }) {
  const cls = finalized ? "tdm-floating-cta tdm-finalized" : enabled ? "tdm-floating-cta tdm-enabled" : "tdm-floating-cta";
  return (
    <button className={cls} disabled={finalized || !enabled} onClick={onClick}>
      {finalized ? "TRANSFERRED \u2713" : "TRANSFER NOW"}
    </button>
  );
}

// ---------- Item modal ----------
function ItemModal({
  type,
  label,
  buyerEmail,
  existing,
  onCancel,
  onDone,
  alert,
}: {
  type: TdmItemType;
  label: string;
  buyerEmail: string;
  existing: TdmPayload | undefined;
  onCancel: () => void;
  onDone: (payload: TdmPayload) => void;
  alert: (opts: { theme?: "success" | "warning" | "danger" | "info" | "report"; title: string; msg: string }) => Promise<void>;
}) {
  const theme = TDM_TYPE_THEME[type];
  const [filesArray, setFilesArray] = useState<File[]>(existing?.kind === "files" ? existing.files : []);
  const [textValue, setTextValue] = useState(existing?.kind === "text" ? existing.textValue : "");
  const [loginOpen, setLoginOpen] = useState(existing?.kind === "credentials");
  const [loginUrl, setLoginUrl] = useState(existing?.kind === "credentials" ? existing.loginUrl : "");
  const [loginEmail, setLoginEmail] = useState(existing?.kind === "credentials" ? existing.loginEmail : "");
  const [loginPassword, setLoginPassword] = useState(existing?.kind === "credentials" ? existing.loginPassword : "");
  const [dragOver, setDragOver] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const thumbUrlsRef = useRef<string[]>([]);

  useEffect(() => {
    // Capture the ref's current array reference now; reading
    // thumbUrlsRef.current directly inside the cleanup would pick up
    // whatever it happens to be at unmount time (an ESLint
    // react-hooks/exhaustive-deps warning: "ref value will likely have
    // changed by the time the cleanup runs").
    const thumbUrls = thumbUrlsRef.current;
    return () => {
      thumbUrls.forEach((u) => URL.revokeObjectURL(u));
    };
  }, []);

  function addFiles(newFiles: File[]) {
    setFilesArray((f) => [...f, ...newFiles]);
  }
  function removeFile(idx: number) {
    setFilesArray((f) => f.filter((_, i) => i !== idx));
  }

  async function handleSubmitLogin() {
    const url = loginUrl.trim();
    const email = loginEmail.trim();
    const password = loginPassword.trim();
    if (url && email && password) {
      onDone({ kind: "credentials", label, loginUrl: url, loginEmail: email, loginPassword: password });
    } else {
      await alert({ theme: "warning", title: "Missing Information", msg: "Please fill in all login fields." });
    }
  }

  async function handleDone() {
    if (type === "input") {
      const val = textValue.trim();
      if (!val) {
        await alert({ theme: "warning", title: "Missing Information", msg: "Please enter credentials." });
        return;
      }
      onDone({ kind: "text", label, textValue: val });
    } else {
      if (filesArray.length === 0) {
        await alert({ theme: "warning", title: "Missing Information", msg: "Please upload at least one file." });
        return;
      }
      onDone({ kind: "files", label, files: filesArray });
    }
  }

  const doneDisabled = type !== "input" && filesArray.length === 0;

  return (
    <div className="tdm-item-modal-overlay active" onClick={(e) => e.target === e.currentTarget && onCancel()}>
      <div className="tdm-item-modal" style={{ "--tdm-accent": theme.accent } as React.CSSProperties}>
        <div className="tdm-modal-theme-head" style={{ "--tdm-accent": theme.accent } as React.CSSProperties}>
          <div className="tdm-modal-theme-icon">
            <TypeThemeIcon type={type} />
          </div>
          <div>
            <div className="tdm-modal-theme-kicker">{theme.heading}</div>
            <h2 style={{ margin: 0 }}>{label}</h2>
          </div>
        </div>
        <p className="tdm-modal-blurb">{theme.blurb}</p>

        {type === "transfer" || type === "upload" ? (
          <>
            {type === "transfer" ? (
              <div className="tdm-buyer-email">
                <span>{buyerEmail || "buyer@example.com"}</span>
                <button className="tdm-copy-btn" onClick={() => navigator.clipboard.writeText(buyerEmail || "buyer@example.com")}>
                  Copy
                </button>
              </div>
            ) : null}
            <label>{type === "transfer" ? "Upload proof (screenshot, confirmation email, etc.)" : "Drop files or click to browse"}</label>
            <div
              className={`tdm-dropzone${dragOver ? " tdm-dragover" : ""}`}
              style={{ "--tdm-accent": theme.accent } as React.CSSProperties}
              onClick={() => fileInputRef.current?.click()}
              onDragOver={(e) => {
                e.preventDefault();
                setDragOver(true);
              }}
              onDragLeave={() => setDragOver(false)}
              onDrop={(e) => {
                e.preventDefault();
                setDragOver(false);
                addFiles(Array.from(e.dataTransfer.files));
              }}
            >
              <p>Drag &amp; drop files here or click to select</p>
              <div className="tdm-file-list">
                {filesArray.map((f, i) =>
                  TDM_IMAGE_EXT_RE.test(f.name) ? (
                    <FileThumb key={i} file={f} onRemove={() => removeFile(i)} thumbUrlsRef={thumbUrlsRef} />
                  ) : (
                    <span key={i} className="tdm-file-chip">
                      {f.name}
                      <button type="button" className="tdm-file-chip-remove" onClick={(e) => (e.stopPropagation(), removeFile(i))}>
                        ✕
                      </button>
                    </span>
                  )
                )}
              </div>
              <input ref={fileInputRef} type="file" multiple hidden onChange={(e) => e.target.files && addFiles(Array.from(e.target.files))} />
            </div>
          </>
        ) : (
          <>
            <label>Paste the key/credentials</label>
            <input type="text" placeholder="API key, keystore, etc." value={textValue} onChange={(e) => setTextValue(e.target.value)} />
          </>
        )}

        <span className="tdm-login-toggle" onClick={() => setLoginOpen((v) => !v)}>
          Send login credentials instead →
        </span>
        <div className={`tdm-login-form${loginOpen ? " active" : ""}`}>
          <label>Site URL</label>
          <input type="text" placeholder="https://example.com/admin" value={loginUrl} onChange={(e) => setLoginUrl(e.target.value)} />
          <label>Email / Username</label>
          <input type="text" placeholder="user@example.com" value={loginEmail} onChange={(e) => setLoginEmail(e.target.value)} />
          <label>Password</label>
          <input type="password" placeholder="••••••••" value={loginPassword} onChange={(e) => setLoginPassword(e.target.value)} />
          <button className="tdm-btn tdm-btn-login-submit" style={{ background: theme.accent, color: "#000" }} onClick={handleSubmitLogin}>
            Submit Login &amp; Mark Done
          </button>
        </div>

        <div className="tdm-btn-group">
          <button className="tdm-btn tdm-btn-cancel" onClick={onCancel}>
            Cancel
          </button>
          <button className="tdm-btn tdm-btn-done" style={{ background: theme.accent, color: "#000" }} disabled={doneDisabled} onClick={handleDone}>
            {type !== "input" && doneDisabled ? "Mark Done (upload required)" : "Mark Done"}
          </button>
        </div>
      </div>
    </div>
  );
}

function TypeThemeIcon({ type }: { type: TdmItemType }) {
  if (type === "transfer")
    return (
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
        <path d="M17 1l4 4-4 4" />
        <path d="M3 11V9a4 4 0 014-4h14" />
        <path d="M7 23l-4-4 4-4" />
        <path d="M21 13v2a4 4 0 01-4 4H3" />
      </svg>
    );
  if (type === "upload")
    return (
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
        <path d="M21 15v4a2 2 0 01-2 2H5a2 2 0 01-2-2v-4" />
        <polyline points="17 8 12 3 7 8" />
        <line x1="12" y1="3" x2="12" y2="15" />
      </svg>
    );
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
      <path d="M21 2l-2 2m-7.61 7.61a5.5 5.5 0 1 1-7.778 7.778 5.5 5.5 0 0 1 7.777-7.777zm0 0L15.5 7.5m0 0l3 3L22 7l-3-3m-3.5 3.5L19 4" />
    </svg>
  );
}

function FileThumb({ file, onRemove, thumbUrlsRef }: { file: File; onRemove: () => void; thumbUrlsRef: React.MutableRefObject<string[]> }) {
  const [url] = useState(() => {
    const u = URL.createObjectURL(file);
    thumbUrlsRef.current.push(u);
    return u;
  });
  return (
    <div className="tdm-file-thumb">
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img src={url} alt={file.name} />
      <button type="button" className="tdm-file-thumb-remove" onClick={(e) => (e.stopPropagation(), onRemove())}>
        ✕
      </button>
      <span>{file.name}</span>
    </div>
  );
}

// ---------- Preview sheet ----------
function PreviewSheet({
  tab,
  completedKeysForTab,
  finalizing,
  onRemove,
  onClose,
  onConfirm,
}: {
  tab: TdmListingType;
  completedKeysForTab: (t: TdmListingType) => string[];
  finalizing: boolean;
  onRemove: (key: string) => void;
  onClose: () => void;
  onConfirm: () => void;
}) {
  const keys = completedKeysForTab(tab);
  const items = { ...TDM_CATEGORIES[tab] };
  const flat = [...items.left, ...items.right];

  return (
    <div className="tdm-preview-overlay active" onClick={(e) => e.target === e.currentTarget && onClose()}>
      <div className="tdm-preview-sheet">
        <h3>Review completed items</h3>
        {keys.map((key) => {
          const idx = parseInt(key.split("-")[1], 10);
          const item = flat[idx];
          return (
            <div className="tdm-preview-item" key={key}>
              <span>{item.label}</span>
              <button className="tdm-remove-btn" onClick={() => onRemove(key)}>
                ✕
              </button>
            </div>
          );
        })}
        <button className="tdm-confirm-btn" disabled={finalizing} onClick={onConfirm}>
          {finalizing ? "BUNDLING\u2026" : "CONFIRM TRANSFER"}
        </button>
      </div>
    </div>
  );
}

// ---------- GitHub repo card ----------
function GithubCard({
  tdm,
  isSeller,
  alert,
}: {
  tdm: ReturnType<typeof useTransferDeal>;
  isSeller: boolean;
  alert: (opts: { theme?: "success" | "warning" | "danger" | "info" | "report"; title: string; msg: string }) => Promise<void>;
}) {
  const [inviteUsername, setInviteUsername] = useState(tdm.githubCollabUsername);
  const [inviting, setInviting] = useState(false);
  const [inviteMsg, setInviteMsg] = useState<{ text: string; kind: "success" | "error" | "" }>({ text: "", kind: "" });

  useEffect(() => {
    setInviteUsername(tdm.githubCollabUsername);
  }, [tdm.githubCollabUsername]);

  // Still loading
  if (tdm.attachedRepo === undefined) return null;

  // Buyer with no repo yet — nothing to show.
  if (!tdm.attachedRepo && !isSeller) return null;

  if (!tdm.attachedRepo && isSeller) {
    // No repo attached. The original mounted a repo picker here via
    // window.__srfMountRepoPicker, which itself called the (absent in
    // this backend) /api/github to list the seller's repos — see
    // port-status.md. Rather than render a picker with nothing to
    // populate it, this is shown as a clear informational state.
    return (
      <div id="tdmGithubCard" style={{ display: "block" }}>
        <div className="tdm-gh-card">
          <div className="tdm-gh-card-top">
            <GithubMarkIcon />
            <span className="tdm-gh-repo-name" style={{ color: "rgba(255,255,255,0.6)" }}>
              GitHub Repository
            </span>
          </div>
          <div className="tdm-gh-status">No repository attached to this listing yet.</div>
        </div>
      </div>
    );
  }

  const repo = tdm.attachedRepo!;
  const status = tdm.githubStatus;
  const statusLine =
    status === "invited" ? (
      <span className="tdm-gh-status tdm-gh-status-pending">Invite sent to @{tdm.githubCollabUsername} — awaiting acceptance</span>
    ) : status === "added" ? (
      <span className="tdm-gh-status tdm-gh-status-done">@{tdm.githubCollabUsername} has access</span>
    ) : (
      <span className="tdm-gh-status">Not shared with buyer yet</span>
    );

  async function handleInvite() {
    const username = inviteUsername.trim();
    if (!username) {
      setInviteMsg({ text: "Enter the buyer's GitHub username first.", kind: "error" });
      return;
    }
    setInviting(true);
    setInviteMsg({ text: "", kind: "" });
    const result = await tdm.inviteGithubCollaborator(username);
    setInviting(false);
    if (result.ok === true) {
      setInviteMsg({
        text: result.status === "invited" ? "Invite sent! The buyer will see it in their GitHub notifications." : "Buyer added successfully.",
        kind: "success",
      });
    } else if (result.ok === false) {
      setInviteMsg({ text: result.error, kind: "error" });
    }
  }

  return (
    <div id="tdmGithubCard" style={{ display: "block" }}>
      <div className="tdm-gh-card">
        <div className="tdm-gh-card-top">
          <GithubMarkIcon />
          <a href={repo.htmlUrl || "#"} target="_blank" rel="noopener noreferrer" className="tdm-gh-repo-name">
            {repo.fullName}
          </a>
          <span className="tdm-gh-badge">{repo.private ? "Private" : "Public"}</span>
          {isSeller ? (
            <button className="tdm-gh-change-btn" onClick={() => tdm.clearRepoSelection()}>
              Change
            </button>
          ) : null}
        </div>
        <div className="tdm-gh-status-row">{statusLine}</div>
        {isSeller ? (
          <>
            <div className="tdm-gh-invite-row">
              <input
                type="text"
                className="tdm-gh-input"
                placeholder="Buyer's GitHub username"
                value={inviteUsername}
                onChange={(e) => setInviteUsername(e.target.value)}
              />
              <button className="tdm-gh-invite-btn" disabled={inviting} onClick={handleInvite}>
                {inviting ? "Inviting\u2026" : status === "none" ? "Add as Collaborator" : "Re-send Invite"}
              </button>
            </div>
            {inviteMsg.text ? <div className={`tdm-gh-invite-msg${inviteMsg.kind === "success" ? " tdm-gh-msg-success" : inviteMsg.kind === "error" ? " tdm-gh-msg-error" : ""}`}>{inviteMsg.text}</div> : null}
          </>
        ) : status === "invited" ? (
          <div className="tdm-gh-invite-msg">Check your GitHub notifications (or email) for the invite to accept.</div>
        ) : null}
      </div>
    </div>
  );
}

function GithubMarkIcon() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="currentColor" style={{ flexShrink: 0 }}>
      <path d="M12 0C5.374 0 0 5.373 0 12c0 5.302 3.438 9.8 8.207 11.387.599.111.793-.261.793-.577v-2.234c-3.338.726-4.033-1.416-4.033-1.416-.546-1.387-1.333-1.756-1.333-1.756-1.089-.745.083-.729.083-.729 1.205.084 1.839 1.237 1.839 1.237 1.07 1.834 2.807 1.304 3.492.997.107-.775.418-1.305.762-1.604-2.665-.305-5.467-1.334-5.467-5.931 0-1.311.469-2.381 1.236-3.221-.124-.303-.535-1.524.117-3.176 0 0 1.008-.322 3.301 1.23A11.509 11.509 0 0112 5.803c1.02.005 2.047.138 3.006.404 2.291-1.552 3.297-1.23 3.297-1.23.653 1.653.242 2.874.118 3.176.77.84 1.235 1.911 1.235 3.221 0 4.609-2.807 5.624-5.479 5.921.43.372.823 1.102.823 2.222v3.293c0 .319.192.694.801.576C20.566 21.797 24 17.3 24 12c0-6.627-5.373-12-12-12z" />
    </svg>
  );
}
