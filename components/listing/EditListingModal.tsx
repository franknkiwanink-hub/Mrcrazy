"use client";

// Ports the edit-listing modal from Js/sellers-transfer.js (lines 168-562,
// #editListingOverlay + window.__openEditListingModal/__closeEditListingModal).
// This was previously routed to /sell as a placeholder (see MyProfileHub's
// old "Listing editing isn't wired up yet" toast) — this is the real thing.
//
// Field-for-field mirror of the original: title/description (with the same
// char-count validation as the create forms), URL (hidden for app listings,
// skipped entirely for templates — matches _handleSave's `type !== 'app' &&
// !isTemplate` gate), category, tech fields (frontend/backend/database/
// monetization — relabeled to Platform/Genre for games, same as
// _applySectionVisibility), financials with a live profit readout, transfer
// methods checklist, and an image grid (existing images shown by URL,
// replaceable one at a time — newly-picked files upload to Imgur on save,
// untouched slots keep their existing URL). Delete is a separate destructive
// action in the footer, gated behind a confirm dialog exactly like the
// original's srfModal.confirm.
//
// Unlike the original (a single global overlay reused across listings via
// window.__openEditListingModal(id)), this is a React modal driven by
// EditListingModalProvider — same pattern as BoostModalProvider/
// WalletModalProvider. Any component reaches it via
// useEditListingModal().openEdit(listingId).
//
// listing.update already supports every field this form sends (see
// handleUpdate in app/api/listings/_handler.js) — no server-side change
// was needed.

import React, { useEffect, useState } from "react";
import { fetchListingById, updateListing, type Listing } from "@/lib/listings";
import { useAuth } from "@/lib/AuthContext";
import { useLimits } from "@/lib/useLimits";

const IMGUR_CLIENT_ID = "891e5bb4aa94282";

// Fallback limits — used only until useLimits() resolves live values from
// GET /api/limits (app/api/_lib/limits.js's LIMITS.listing). Same numbers
// as that source (title 3-99 chars, desc 100-5000 chars), kept here as the
// initial/degrade-on-failure state rather than a permanent hardcode.
const FALLBACK_TITLE_MIN = 3;
const FALLBACK_TITLE_MAX = 99;
const FALLBACK_DESC_MIN = 100;
const FALLBACK_DESC_MAX = 5000;

const TRANSFER_OPTIONS = [
  { value: "html_css_js", label: "HTML/CSS/JS Files ⚡" },
  { value: "domain_push", label: "Domain Push" },
  { value: "zip_download", label: "Full Site ZIP" },
  { value: "cpanel", label: "cPanel" },
  { value: "github", label: "GitHub / GitLab" },
  { value: "hosting_handover", label: "Hosting Handover" },
  { value: "db_dump", label: "Database Dump" },
  { value: "ftp", label: "FTP Credentials" },
  { value: "escrow_migration", label: "Escrow Migration" },
  { value: "account_handover", label: "Account Handover" },
  { value: "source_code", label: "Source Code Handover" },
  { value: "direct_download", label: "Direct Build Transfer (APK/IPA)" },
  { value: "steam_key", label: "Steam Key / CD Key" },
  { value: "other", label: "Other (discuss in chat)" },
];

const TYPE_LABEL: Record<string, string> = { website: "Website", app: "App", game: "Game" };

interface ImageSlotState {
  url?: string;
  file?: File;
  dataUrl?: string;
}

async function uploadToImgur(file: File): Promise<string> {
  const fd = new FormData();
  fd.append("image", file);
  const res = await fetch("https://api.imgur.com/3/image", {
    method: "POST",
    headers: { Authorization: `Client-ID ${IMGUR_CLIENT_ID}` },
    body: fd,
  });
  const json = await res.json();
  if (!json.success) throw new Error("Image upload failed. Please try again.");
  return json.data.link;
}

export default function EditListingModal({
  open,
  onClose,
  listingId,
  onSaved,
  onDeleted,
}: {
  open: boolean;
  onClose: () => void;
  listingId: string | null;
  onSaved?: (listing: Listing) => void;
  onDeleted?: (listingId: string) => void;
}) {
  const { user } = useAuth();
  const { limits } = useLimits();

  const TITLE_MIN = limits.listing.titleMinLength ?? FALLBACK_TITLE_MIN;
  const TITLE_MAX = limits.listing.titleMaxLength ?? FALLBACK_TITLE_MAX;
  const DESC_MIN = limits.listing.descMinLength ?? FALLBACK_DESC_MIN;
  const DESC_MAX = limits.listing.descMaxLength ?? FALLBACK_DESC_MAX;

  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState("");
  const [listing, setListing] = useState<Listing | null>(null);

  const [title, setTitle] = useState("");
  const [desc, setDesc] = useState("");
  const [url, setUrl] = useState("");
  const [category, setCategory] = useState("");
  const [frontend, setFrontend] = useState("");
  const [backend, setBackend] = useState("");
  const [database, setDatabase] = useState("");
  const [monetization, setMonetization] = useState("");
  const [price, setPrice] = useState("");
  const [revenue, setRevenue] = useState("");
  const [expenses, setExpenses] = useState("");
  const [transferMethods, setTransferMethods] = useState<string[]>([]);
  const [images, setImages] = useState<ImageSlotState[]>([]);

  const [saving, setSaving] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [errMsg, setErrMsg] = useState("");
  const [successMsg, setSuccessMsg] = useState(false);
  const [confirmingDelete, setConfirmingDelete] = useState(false);

  // Load the listing fresh each time the modal opens for a (possibly
  // different) listing — mirrors the original's _loadListing.
  useEffect(() => {
    if (!open || !listingId) return;
    setLoading(true);
    setLoadError("");
    setErrMsg("");
    setSuccessMsg(false);
    setConfirmingDelete(false);
    (async () => {
      const l = await fetchListingById(listingId).catch(() => null);
      if (!l) {
        setLoadError("Could not load this listing. Please try again.");
        setLoading(false);
        return;
      }
      setListing(l);
      setTitle(l.title || "");
      setDesc(l.description || "");
      setUrl(l.url && l.url !== "[TEMPLATE]" ? l.url : "");
      setCategory(l.category || l.settings?.category || "");
      setFrontend(l.tech?.frontend || "");
      setBackend(l.tech?.backend || "");
      setDatabase(l.tech?.database || "");
      setMonetization(l.tech?.monetization || "");
      setPrice(l.financials?.price != null ? String(l.financials.price) : "");
      setRevenue(l.financials?.revenue != null ? String(l.financials.revenue) : "");
      setExpenses(l.financials?.expenses != null ? String(l.financials.expenses) : "");
      setTransferMethods(l.transferMethods || []);
      const existing = l.images || [];
      const slotCount = l.type === "app" ? Math.max(existing.length, 3) : 3;
      const slots: ImageSlotState[] = existing.slice(0, Math.max(slotCount, existing.length)).map((u) => ({ url: u }));
      while (slots.length < slotCount) slots.push({});
      setImages(slots);
      setLoading(false);
    })();
  }, [open, listingId]);

  if (!open) return null;

  const type = listing?.type || "website";
  const isGame = type === "game";
  const isApp = type === "app";
  const isWebsite = type === "website";
  const profit = (parseFloat(revenue) || 0) - (parseFloat(expenses) || 0);

  function onPickImage(idx: number, file: File) {
    const reader = new FileReader();
    reader.onload = (ev) => {
      setImages((prev) => {
        const next = [...prev];
        next[idx] = { file, dataUrl: ev.target?.result as string };
        return next;
      });
    };
    reader.readAsDataURL(file);
  }

  function toggleTransfer(value: string) {
    setTransferMethods((prev) => (prev.includes(value) ? prev.filter((v) => v !== value) : [...prev, value]));
  }

  async function handleSave() {
    if (!listingId || !listing) return;
    setErrMsg("");
    setSuccessMsg(false);

    const t = title.trim();
    const d = desc.trim();
    if (t.length < TITLE_MIN || t.length > TITLE_MAX) {
      setErrMsg(`Title must be between ${TITLE_MIN} and ${TITLE_MAX} characters (currently ${t.length}).`);
      return;
    }
    if (d.length < DESC_MIN || d.length > DESC_MAX) {
      setErrMsg(`Description must be between ${DESC_MIN} and ${DESC_MAX} characters (currently ${d.length}).`);
      return;
    }
    const trimmedUrl = url.trim();
    if (type !== "app" && !listing.isTemplate) {
      if (!trimmedUrl || !/^https?:\/\/.+/.test(trimmedUrl)) {
        setErrMsg("Please provide a valid URL starting with https://.");
        return;
      }
    }
    if (!user) {
      setErrMsg("You must be logged in to edit this listing.");
      return;
    }

    setSaving(true);
    try {
      const finalImages: string[] = [];
      for (const slot of images) {
        if (slot.file) finalImages.push(await uploadToImgur(slot.file));
        else if (slot.url) finalImages.push(slot.url);
      }

      const idToken = await user.getIdToken();
      const priceVal = parseFloat(price);
      const revenueVal = parseFloat(revenue);
      const expensesVal = parseFloat(expenses);

      await updateListing({
        idToken,
        listingId,
        title: t,
        description: d,
        url: type === "app" ? undefined : listing.isTemplate ? "[TEMPLATE]" : trimmedUrl,
        images: finalImages,
        category: category.trim() || undefined,
        tech: {
          frontend: frontend.trim(),
          backend: backend.trim(),
          database: database.trim(),
          monetization: monetization.trim(),
        },
        settings: { category: category.trim() || listing.settings?.category || "" },
        financials: {
          price: Number.isFinite(priceVal) ? priceVal : null,
          revenue: Number.isFinite(revenueVal) ? revenueVal : null,
          expenses: Number.isFinite(expensesVal) ? expensesVal : null,
        },
        transferMethods,
      });

      setSuccessMsg(true);
      onSaved?.({
        ...listing,
        title: t,
        description: d,
        images: finalImages,
        category: category.trim() || listing.category,
      });
      setTimeout(() => onClose(), 900);
    } catch (err: any) {
      setErrMsg(err?.message || "Something went wrong. Please try again.");
    } finally {
      setSaving(false);
    }
  }

  async function handleDelete() {
    if (!listingId || !user) return;
    setDeleting(true);
    try {
      const idToken = await user.getIdToken();
      const resp = await fetch("/api/listings", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "listing.delete", idToken, listingId }),
      });
      const out = await resp.json().catch(() => ({}));
      if (!resp.ok || !out.ok) throw new Error(out.error?.message || "Delete failed");
      onDeleted?.(listingId);
      onClose();
    } catch {
      setErrMsg("Could not delete this listing. Please try again.");
      setConfirmingDelete(false);
    } finally {
      setDeleting(false);
    }
  }

  return (
    <div
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
      style={overlayStyle}
    >
      <div style={cardStyle}>
        {/* Sticky header */}
        <div style={headerStyle}>
          <div style={{ minWidth: 0 }}>
            <div style={{ fontSize: 15, fontWeight: 800, color: "#fff" }}>
              Edit {TYPE_LABEL[type] || "Listing"}
            </div>
            <div style={{ fontSize: 12, color: "#888", marginTop: 2, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>
              {listing?.title || "Untitled listing"}
            </div>
          </div>
          <button onClick={onClose} style={closeBtnStyle} aria-label="Close">
            ✕
          </button>
        </div>

        <div style={{ overflowY: "auto", padding: 20, flex: 1 }}>
          {loading ? (
            <div style={{ padding: "40px 0", textAlign: "center", color: "#888", fontSize: 13 }}>Loading listing…</div>
          ) : loadError ? (
            <div style={{ padding: "40px 0", textAlign: "center", color: "#f87171", fontSize: 13 }}>{loadError}</div>
          ) : (
            <>
              <Field label="Title" required>
                <input type="text" value={title} onChange={(e) => setTitle(e.target.value)} style={inputStyle} />
                <CharCount value={title} min={TITLE_MIN} max={TITLE_MAX} />
              </Field>

              <Field label="Description" required>
                <textarea
                  value={desc}
                  onChange={(e) => setDesc(e.target.value)}
                  rows={5}
                  style={{ ...inputStyle, height: "auto", padding: 14, resize: "vertical" }}
                />
                <CharCount value={desc} min={DESC_MIN} max={DESC_MAX} />
              </Field>

              {!isApp && (
                <Field label={isGame ? "Game URL (external link)" : "URL"}>
                  <input type="url" value={url} onChange={(e) => setUrl(e.target.value)} style={inputStyle} disabled={listing?.isTemplate} />
                </Field>
              )}

              {(isWebsite || isApp) && (
                <Field label="Category">
                  <input type="text" value={category} onChange={(e) => setCategory(e.target.value)} style={inputStyle} />
                </Field>
              )}

              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12, marginBottom: 16 }}>
                <Field label={isGame ? "Platform" : "Frontend"}>
                  <input type="text" value={frontend} onChange={(e) => setFrontend(e.target.value)} style={inputStyle} />
                </Field>
                <Field label={isGame ? "Genre" : "Backend"}>
                  <input type="text" value={backend} onChange={(e) => setBackend(e.target.value)} style={inputStyle} />
                </Field>
              </div>

              {!isGame && (
                <Field label="Database">
                  <input type="text" value={database} onChange={(e) => setDatabase(e.target.value)} style={inputStyle} />
                </Field>
              )}

              <Field label="Monetization">
                <input type="text" value={monetization} onChange={(e) => setMonetization(e.target.value)} style={inputStyle} />
              </Field>

              <span style={sectionLabelStyle}>Images</span>
              <div style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: 10, marginBottom: 20 }}>
                {images.map((slot, i) => (
                  <label key={i} style={imgSlotStyle}>
                    <input
                      type="file"
                      accept="image/*"
                      style={{ display: "none" }}
                      onChange={(e) => {
                        const f = e.target.files?.[0];
                        e.target.value = "";
                        if (f) onPickImage(i, f);
                      }}
                    />
                    {slot.dataUrl || slot.url ? (
                      <img src={slot.dataUrl || slot.url} alt={`Image ${i + 1}`} style={{ width: "100%", height: "100%", objectFit: "cover" }} />
                    ) : (
                      <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 4, color: "rgba(255,255,255,0.25)", fontSize: 11 }}>
                        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.6} style={{ width: 22, height: 22 }}>
                          <rect x="3" y="3" width="18" height="18" rx="2" />
                          <path d="M3 9h18M9 21V9" />
                        </svg>
                        Add image
                      </div>
                    )}
                    <div style={imgReplaceOverlayStyle}>Replace</div>
                  </label>
                ))}
              </div>

              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 12, marginBottom: 12 }}>
                <Field label="Price ($)">
                  <input type="number" min="0" value={price} onChange={(e) => setPrice(e.target.value)} style={inputStyle} />
                </Field>
                <Field label="Monthly Revenue ($)">
                  <input type="number" min="0" value={revenue} onChange={(e) => setRevenue(e.target.value)} style={inputStyle} />
                </Field>
                <Field label="Monthly Expenses ($)">
                  <input type="number" min="0" value={expenses} onChange={(e) => setExpenses(e.target.value)} style={inputStyle} />
                </Field>
              </div>
              <div style={{ padding: 14, background: "rgba(255,255,255,0.03)", borderRadius: 10, marginBottom: 20, display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                <span style={{ fontSize: 12, color: "#888", fontWeight: 600 }}>Monthly Profit</span>
                <span style={{ fontSize: 16, fontWeight: 800, color: profit < 0 ? "#f87171" : "#a3e635" }}>
                  {profit < 0 ? "-" : ""}${Math.abs(profit).toLocaleString()}
                </span>
              </div>

              <span style={sectionLabelStyle}>Transfer Methods</span>
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8, marginBottom: 8 }}>
                {TRANSFER_OPTIONS.map((o) => (
                  <label
                    key={o.value}
                    style={{
                      display: "flex", alignItems: "center", gap: 8, padding: "9px 11px",
                      background: transferMethods.includes(o.value) ? "rgba(124,58,237,0.1)" : "rgba(255,255,255,0.03)",
                      border: `1px solid ${transferMethods.includes(o.value) ? "rgba(124,58,237,0.35)" : "rgba(255,255,255,0.08)"}`,
                      borderRadius: 10, cursor: "pointer", fontSize: 12.5,
                    }}
                  >
                    <input type="checkbox" checked={transferMethods.includes(o.value)} onChange={() => toggleTransfer(o.value)} style={{ accentColor: "#7c3aed" }} />
                    {o.label}
                  </label>
                ))}
              </div>

              {errMsg && <div style={errorBoxStyle}>{errMsg}</div>}
              {successMsg && <div style={successBoxStyle}>✓ Changes saved.</div>}
            </>
          )}
        </div>

        {!loading && !loadError && (
          <div style={footerStyle}>
            {confirmingDelete ? (
              <div style={{ display: "flex", flexDirection: "column", gap: 8, width: "100%" }}>
                <div style={{ fontSize: 12.5, color: "#f87171", textAlign: "center" }}>
                  This will permanently remove the listing. This cannot be undone.
                </div>
                <div style={{ display: "flex", gap: 8 }}>
                  <button onClick={() => setConfirmingDelete(false)} style={cancelBtnStyle} disabled={deleting}>
                    Cancel
                  </button>
                  <button onClick={handleDelete} style={deleteConfirmBtnStyle} disabled={deleting}>
                    {deleting ? "Deleting…" : "Delete Listing"}
                  </button>
                </div>
              </div>
            ) : (
              <>
                <button onClick={() => setConfirmingDelete(true)} style={deleteBtnStyle} disabled={saving}>
                  Delete
                </button>
                <div style={{ display: "flex", gap: 8, flex: 1, justifyContent: "flex-end" }}>
                  <button onClick={onClose} style={cancelBtnStyle} disabled={saving}>
                    Cancel
                  </button>
                  <button onClick={handleSave} style={saveBtnStyle} disabled={saving || successMsg}>
                    {saving ? "Saving…" : "Save Changes"}
                  </button>
                </div>
              </>
            )}
          </div>
        )}
      </div>
    </div>
  );
}

function Field({ label, required, children }: { label: string; required?: boolean; children: React.ReactNode }) {
  return (
    <div style={{ marginBottom: 16 }}>
      <label style={fieldLabelStyle}>
        {label} {required && <span style={{ color: "#f87171" }}>*</span>}
      </label>
      {children}
    </div>
  );
}

function CharCount({ value, min, max }: { value: string; min: number; max: number }) {
  const len = value.trim().length;
  const ok = len >= min && len <= max;
  return (
    <div style={{ fontSize: 11, color: ok ? "rgba(255,255,255,0.35)" : "#f87171", marginTop: 4 }}>
      {len} / {max} characters (min {min})
    </div>
  );
}

// ── Styles ──
const overlayStyle: React.CSSProperties = {
  position: "fixed", inset: 0, zIndex: 99999, background: "rgba(0,0,0,0.82)",
  backdropFilter: "blur(14px)", WebkitBackdropFilter: "blur(14px)",
  display: "flex", alignItems: "center", justifyContent: "center", padding: 20, fontFamily: "inherit",
};
const cardStyle: React.CSSProperties = {
  position: "relative", width: "100%", maxWidth: 560, maxHeight: "90vh", display: "flex", flexDirection: "column",
  overflow: "hidden", background: "radial-gradient(120% 100% at 50% 0%, rgba(124,58,237,0.14) 0%, rgba(0,0,0,0) 55%), #060606",
  border: "1px solid #2a2a2a", borderRadius: 22, boxShadow: "0 30px 80px -20px rgba(124,58,237,0.3), 0 10px 40px -10px rgba(0,0,0,0.6)",
};
const headerStyle: React.CSSProperties = {
  position: "sticky", top: 0, zIndex: 5, display: "flex", alignItems: "center", justifyContent: "space-between",
  gap: 12, background: "rgba(6,6,6,0.92)", backdropFilter: "blur(10px)", WebkitBackdropFilter: "blur(10px)",
  borderBottom: "1px solid #1e1e1e", padding: "16px 18px", flexShrink: 0,
};
const closeBtnStyle: React.CSSProperties = {
  width: 30, height: 30, borderRadius: "50%", background: "rgba(255,255,255,0.06)", border: "1px solid rgba(255,255,255,0.1)",
  color: "#aaa", cursor: "pointer", fontSize: 13, flexShrink: 0,
};
const footerStyle: React.CSSProperties = {
  display: "flex", alignItems: "center", gap: 8, padding: "14px 18px", borderTop: "1px solid #1e1e1e",
  background: "rgba(6,6,6,0.92)", flexShrink: 0,
};
const sectionLabelStyle: React.CSSProperties = {
  display: "block", fontSize: 11.5, fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.06em",
  color: "rgba(255,255,255,0.45)", marginBottom: 10,
};
const fieldLabelStyle: React.CSSProperties = {
  display: "block", fontSize: 11.5, fontWeight: 700, color: "rgba(255,255,255,0.45)", marginBottom: 6,
  textTransform: "uppercase", letterSpacing: "0.04em",
};
const inputStyle: React.CSSProperties = {
  width: "100%", height: 42, padding: "0 12px", background: "#0c0c0c", border: "1px solid #2e2e2e",
  borderRadius: 8, fontSize: 13.5, color: "#fff", outline: "none", fontFamily: "inherit", boxSizing: "border-box",
};
const imgSlotStyle: React.CSSProperties = {
  position: "relative", display: "flex", alignItems: "center", justifyContent: "center", height: 90,
  background: "rgba(255,255,255,0.03)", border: "1px solid rgba(255,255,255,0.1)", borderRadius: 10,
  cursor: "pointer", overflow: "hidden",
};
const imgReplaceOverlayStyle: React.CSSProperties = {
  position: "absolute", inset: "auto 0 0 0", background: "rgba(0,0,0,0.7)", color: "#fff", fontSize: 10,
  fontWeight: 700, textAlign: "center", padding: "3px 0", textTransform: "uppercase", letterSpacing: "0.04em",
};
const errorBoxStyle: React.CSSProperties = {
  padding: "10px 14px", background: "rgba(239,68,68,0.1)", border: "1px solid rgba(239,68,68,0.25)",
  borderRadius: 8, color: "#fca5a5", fontSize: 12.5, fontWeight: 600, marginBottom: 8,
};
const successBoxStyle: React.CSSProperties = {
  padding: "10px 14px", background: "rgba(163,230,53,0.1)", border: "1px solid rgba(163,230,53,0.25)",
  borderRadius: 8, color: "#a3e635", fontSize: 12.5, fontWeight: 600,
};
const deleteBtnStyle: React.CSSProperties = {
  background: "none", border: "none", color: "#f87171", fontSize: 12.5, fontWeight: 700, cursor: "pointer", padding: "10px 4px",
};
const cancelBtnStyle: React.CSSProperties = {
  flex: 1, height: 40, background: "rgba(255,255,255,0.06)", color: "rgba(255,255,255,0.7)",
  border: "1px solid rgba(255,255,255,0.1)", borderRadius: 100, fontSize: 13, fontWeight: 700, cursor: "pointer",
};
const saveBtnStyle: React.CSSProperties = {
  flex: 1, height: 40, background: "linear-gradient(135deg, #5b21b6 0%, #7c3aed 55%, #6d28d9 100%)",
  border: "1px solid #8b5cf6", color: "#fff", borderRadius: 100, fontSize: 13, fontWeight: 800, cursor: "pointer",
};
const deleteConfirmBtnStyle: React.CSSProperties = {
  flex: 1, height: 40, background: "#dc2626", border: "1px solid #ef4444", color: "#fff",
  borderRadius: 100, fontSize: 13, fontWeight: 800, cursor: "pointer",
};
