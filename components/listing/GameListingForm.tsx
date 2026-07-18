"use client";

// Ports Js/listing-form-game.js — the standalone game listing form
// (distinct from listing-form.js's website flow). Field-for-field
// mirror of the original 3-step modal:
//   Step 1 (Basics): 3 screenshots (2 portrait, 1 landscape — NO aspect-ratio
//     enforcement, unlike the website form's slots), game source (upload
//     HTML/CSS/JS build OR external link), title, description
//   Step 2 (Details): platform, genre, monetization, age, business
//     structure, reason (optional), transfer methods (at least 1 required)
//   Step 3 (Financials): price, monthly revenue, monthly expenses
//
// Game-build upload combines the uploaded .html/.css/.js files into one
// blob (CSS inlined in <style>, JS inlined in <script>) for local Test
// Play preview, then on submit uploads that same combined HTML to
// /api/storage (now wired — see app/api/storage/route.ts) exactly like
// the original's _uploadCombinedGameHtml.
//
// Draft save/restore uses localStorage (key: srf_draft_game). GitHub
// repo attach isn't ported yet elsewhere in this app, so attachedRepo
// is always sent as null.

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { useAuth } from "@/lib/AuthContext";
import { createListing } from "@/lib/listings";
import { aiStudioCall, aiPlanCap } from "@/lib/aiStudio";
import { useAiLengthPicker } from "@/lib/useAiLengthPicker";
import { useLimits } from "@/lib/useLimits";

const ACCENT = "#f59e0b";
const DRAFT_KEY = "srf_draft_game";

// Fallback limits — used only until useLimits() resolves live values from
// GET /api/limits (app/api/_lib/limits.js's LIMITS.listing). Same numbers
// as that source (title 3-99 chars, desc 100-5000 chars), kept here as the
// initial/degrade-on-failure state rather than a permanent hardcode.
const FALLBACK_TITLE_MIN = 3;
const FALLBACK_TITLE_MAX = 99;
const FALLBACK_DESC_MIN = 100;
const FALLBACK_DESC_MAX = 5000;

const PLATFORM_OPTIONS = [
  { value: "android", label: "Android" },
  { value: "desktop", label: "Desktop" },
  { value: "both", label: "Both" },
];
const GENRE_OPTIONS = ["Action", "Adventure", "RPG", "Shooter", "Strategy", "Simulation", "Sports", "Puzzle", "Other"];
const AGE_OPTIONS = ["< 3 months", "3–5 months", "6–11 months", "1+ year", "2+ years", "3+ years", "5+ years", "10+ years"];
const STRUCTURE_OPTIONS = ["Sole Proprietorship", "LLC", "Corporation", "Partnership", "Other"];

const TRANSFER_METHODS: { value: string; label: string; sub?: string; featured?: boolean }[] = [
  { value: "html_css_js", label: "HTML/CSS/JS Files", sub: "Hand off source files directly in chat — no complications", featured: true },
  { value: "steam_key", label: "Steam Key / CD Key" },
  { value: "direct_download", label: "Direct Download (EXE, APK, ROM)" },
  { value: "account_handover", label: "Account Handover (Pre-loaded)" },
  { value: "gift_code", label: "In-Game Gift Code" },
  { value: "console_code", label: "Console Store Code (Xbox / PS / Nintendo)" },
  { value: "google_play_games", label: "Google Play Games Transfer" },
];

const SLOT_LABELS = ["Portrait 1", "Portrait 2", "Landscape 16:9"];

interface SlotImage {
  file: File;
  dataUrl: string;
}

interface Draft {
  step?: number;
  gameType?: "upload" | "link";
  url?: string;
  title?: string;
  desc?: string;
  platform?: string;
  genre?: string;
  monetization?: string;
  reason?: string;
  price?: string;
  revenue?: string;
  expenses?: string;
  age?: string;
  structure?: string;
  transferMethods?: string[];
}

const IMGUR_CLIENT_ID = "891e5bb4aa94282";

async function uploadToImgur(file: File): Promise<string> {
  const fd = new FormData();
  fd.append("image", file);
  const res = await fetch("https://api.imgur.com/3/image", {
    method: "POST",
    headers: { Authorization: "Client-ID " + IMGUR_CLIENT_ID },
    body: fd,
  });
  const json = await res.json();
  if (!json.success) throw new Error("Imgur upload failed: " + (json.data && json.data.error));
  return json.data.link;
}

// Combines uploaded html/css/js files into one playable HTML blob —
// mirrors _combineAndPreview exactly (CSS inlined in <style> before
// </head>, JS inlined in <script> before </body>).
function combineGameFiles(files: File[]): Promise<string> {
  const htmlFile = files.find((f) => /\.html?$/i.test(f.name));
  const cssFiles = files.filter((f) => /\.css$/i.test(f.name));
  const jsFiles = files.filter((f) => /\.js$/i.test(f.name));

  const readText = (f: File) =>
    new Promise<string>((resolve) => {
      const r = new FileReader();
      r.onload = (e) => resolve((e.target?.result as string) || "");
      r.readAsText(f);
    });

  return (async () => {
    let htmlContent = htmlFile
      ? await readText(htmlFile)
      : '<!DOCTYPE html><html><head><meta charset="UTF-8"><title>Game</title></head><body></body></html>';
    let cssContent = "";
    for (const f of cssFiles) cssContent += "\n/* " + f.name + " */\n" + (await readText(f));
    let jsContent = "";
    for (const f of jsFiles) jsContent += "\n// " + f.name + "\n" + (await readText(f));

    let finalHtml = htmlContent;
    if (cssContent) {
      const styleTag = "<style>" + cssContent + "</style>";
      finalHtml = finalHtml.includes("</head>") ? finalHtml.replace("</head>", styleTag + "</head>") : finalHtml.replace("<body>", "<body>" + styleTag);
    }
    if (jsContent) {
      const scriptTag = "<script>" + jsContent + "</" + "script>";
      finalHtml = finalHtml.includes("</body>") ? finalHtml.replace("</body>", scriptTag + "</body>") : finalHtml + scriptTag;
    }
    return finalHtml;
  })();
}

async function uploadTextToStorage(filename: string, content: string, idToken: string): Promise<string> {
  const res = await fetch("/api/storage", {
    method: "POST",
    headers: { "Content-Type": "application/json", Authorization: `Bearer ${idToken}` },
    body: JSON.stringify({ filename, content, encoding: "utf8" }),
  });
  const json = await res.json();
  if (!res.ok) throw new Error(json.error || "File upload failed.");
  return json.url;
}

export default function GameListingForm() {
  const router = useRouter();
  const { user, profile } = useAuth();
  const { limits } = useLimits();

  const TITLE_MIN = limits.listing.titleMinLength ?? FALLBACK_TITLE_MIN;
  const TITLE_MAX = limits.listing.titleMaxLength ?? FALLBACK_TITLE_MAX;
  const DESC_MIN = limits.listing.descMinLength ?? FALLBACK_DESC_MIN;
  const DESC_MAX = limits.listing.descMaxLength ?? FALLBACK_DESC_MAX;

  const [step, setStep] = useState(1);
  const [images, setImages] = useState<(SlotImage | null)[]>([null, null, null]);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const targetIdxRef = useRef<number | null>(null);

  const [gameType, setGameType] = useState<"upload" | "link">("upload");
  const [url, setUrl] = useState("");
  const [title, setTitle] = useState("");
  const [desc, setDesc] = useState("");

  // ── AI auto-description (ports gfmAutoGenBtn from ai-support-chat.js) ──
  const { pick, AiLengthPickerHost } = useAiLengthPicker();
  const [aiGenerating, setAiGenerating] = useState(false);
  const [aiError, setAiError] = useState<string | null>(null);

  async function handleAutoGenerate() {
    const t = title.trim();
    if (!t) {
      setErrors((prev) => ({ ...prev, title: `Title must be between ${TITLE_MIN} and ${TITLE_MAX} characters (currently 0).` }));
      return;
    }
    setAiError(null);
    const plan = profile?.plan || "free";
    const cap = aiPlanCap(plan);
    const targetLength = await pick(cap, plan);
    if (targetLength === null) return; // cancelled

    setAiGenerating(true);
    try {
      const result = await aiStudioCall<{ description?: string }>("auto-description", { title: t, targetLength, plan });
      const generated = (result.description || "").trim();
      if (!generated) throw new Error("The AI returned an empty description.");
      setDesc(generated);
    } catch (e) {
      setAiError(e instanceof Error ? `Couldn't generate a description: ${e.message}` : "Could not generate a description right now — please try again or write your own.");
    } finally {
      setAiGenerating(false);
    }
  }

  const gameFileInputRef = useRef<HTMLInputElement>(null);
  const [uploadedFiles, setUploadedFiles] = useState<File[]>([]);
  const [combinedHtml, setCombinedHtml] = useState<string>("");
  const [previewBlobUrl, setPreviewBlobUrl] = useState<string | null>(null);
  const [testPlayOpen, setTestPlayOpen] = useState(false);
  const [duplicateError, setDuplicateError] = useState("");

  const [platform, setPlatform] = useState("");
  const [genre, setGenre] = useState("");
  const [monetization, setMonetization] = useState("");
  const [age, setAge] = useState("");
  const [structure, setStructure] = useState("");
  const [reason, setReason] = useState("");
  const [transferMethods, setTransferMethods] = useState<string[]>([]);

  const [price, setPrice] = useState("");
  const [revenue, setRevenue] = useState("");
  const [expenses, setExpenses] = useState("");

  const [errors, setErrors] = useState<Record<string, string>>({});
  const [submitting, setSubmitting] = useState(false);
  const [progress, setProgress] = useState<{ pct: number; label: string } | null>(null);
  const [submitError, setSubmitError] = useState("");
  const [success, setSuccess] = useState(false);

  // ── Draft restore on mount ──
  useEffect(() => {
    try {
      const raw = localStorage.getItem(DRAFT_KEY);
      if (!raw) return;
      const ok = window.confirm("You have a saved draft for a game listing. Restore it?");
      if (!ok) {
        localStorage.removeItem(DRAFT_KEY);
        return;
      }
      const d: Draft = JSON.parse(raw);
      if (d.gameType) setGameType(d.gameType);
      if (d.url) setUrl(d.url);
      if (d.title) setTitle(d.title);
      if (d.desc) setDesc(d.desc);
      if (d.platform) setPlatform(d.platform);
      if (d.genre) setGenre(d.genre);
      if (d.monetization) setMonetization(d.monetization);
      if (d.reason) setReason(d.reason);
      if (d.price) setPrice(d.price);
      if (d.revenue) setRevenue(d.revenue);
      if (d.expenses) setExpenses(d.expenses);
      if (d.age) setAge(d.age);
      if (d.structure) setStructure(d.structure);
      if (d.transferMethods?.length) setTransferMethods(d.transferMethods);
      if (d.step && d.step > 1) setStep(d.step);
    } catch {
      // ignore corrupt draft
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  function saveDraft(nextStep = step) {
    try {
      const d: Draft = {
        step: nextStep, gameType, url, title, desc, platform, genre, monetization,
        reason, price, revenue, expenses, age, structure, transferMethods,
      };
      localStorage.setItem(DRAFT_KEY, JSON.stringify(d));
    } catch {
      // ignore
    }
  }
  function clearDraft() {
    try {
      localStorage.removeItem(DRAFT_KEY);
    } catch {
      // ignore
    }
  }

  function hasAnyData() {
    return [url, title, desc, price, revenue, expenses].some((v) => v.trim().length > 0) || uploadedFiles.length > 0;
  }

  function handleBack() {
    if (hasAnyData()) {
      const save = window.confirm(
        "You have unsaved listing info. Save as a draft so you can pick up where you left off?\n\nOK = Save Draft, Cancel = Discard & Close"
      );
      if (save) saveDraft();
      else clearDraft();
    }
    if (previewBlobUrl) URL.revokeObjectURL(previewBlobUrl);
    router.push("/marketplace");
  }

  // ── Screenshot slots (no aspect-ratio enforcement, unlike website form) ──
  function openSlotPicker(idx: number) {
    targetIdxRef.current = idx;
    if (fileInputRef.current) {
      fileInputRef.current.value = "";
      fileInputRef.current.click();
    }
  }

  function readImageFile(file: File, idx: number) {
    const reader = new FileReader();
    reader.onload = (ev) => {
      const img = new Image();
      img.onload = () => {
        const canvas = document.createElement("canvas");
        canvas.width = img.naturalWidth;
        canvas.height = img.naturalHeight;
        canvas.getContext("2d")?.drawImage(img, 0, 0);
        canvas.toBlob(
          (blob) => {
            if (!blob) return;
            const normalized = new File([blob], file.name.replace(/\.[^.]+$/, ".jpg"), { type: "image/jpeg" });
            setImages((prev) => {
              const next = [...prev];
              next[idx] = { file: normalized, dataUrl: ev.target?.result as string };
              return next;
            });
          },
          "image/jpeg",
          0.92
        );
      };
      img.src = ev.target?.result as string;
    };
    reader.readAsDataURL(file);
  }

  function onFileInputChange(e: React.ChangeEvent<HTMLInputElement>) {
    const f = e.target.files?.[0];
    const idx = targetIdxRef.current;
    if (!f || idx == null) return;
    if (!f.type.startsWith("image/")) {
      window.alert("Please select an image file (PNG, JPG, or WebP).");
      return;
    }
    readImageFile(f, idx);
  }

  function removeImage(idx: number) {
    setImages((prev) => {
      const next = [...prev];
      next[idx] = null;
      return next;
    });
  }

  // ── Game build upload (html/css/js) ──
  async function handleGameFiles(fileList: FileList | File[]) {
    setDuplicateError("");
    const allowed = [".html", ".htm", ".css", ".js"];
    let valid = Array.from(fileList).filter((f) => allowed.includes("." + f.name.split(".").pop()!.toLowerCase()));
    if (valid.length === 0) {
      setErrors((e) => ({ ...e, upload: "Please upload HTML, CSS, or JS files." }));
      return;
    }
    const htmlFiles = valid.filter((f) => /\.html?$/i.test(f.name));
    if (htmlFiles.length > 1) {
      setDuplicateError("Only one HTML file allowed.");
      valid = valid.filter((f) => !/\.html?$/i.test(f.name) || f === htmlFiles[0]);
    }
    const names = valid.map((f) => f.name);
    if (new Set(names).size !== names.length) {
      setDuplicateError("Duplicate file names detected.");
      const seen = new Set<string>();
      valid = valid.filter((f) => {
        if (seen.has(f.name)) return false;
        seen.add(f.name);
        return true;
      });
    }
    if (valid.length === 0) return;
    setErrors((e) => ({ ...e, upload: "" }));
    setUploadedFiles(valid);
    const finalHtml = await combineGameFiles(valid);
    setCombinedHtml(finalHtml);
    if (previewBlobUrl) URL.revokeObjectURL(previewBlobUrl);
    const blob = new Blob([finalHtml], { type: "text/html" });
    setPreviewBlobUrl(URL.createObjectURL(blob));
  }

  function removeGameFiles() {
    setUploadedFiles([]);
    setCombinedHtml("");
    setDuplicateError("");
    if (previewBlobUrl) {
      URL.revokeObjectURL(previewBlobUrl);
      setPreviewBlobUrl(null);
    }
  }

  // ── Validation ──
  function clearAllErrors() {
    setErrors({});
  }

  function validateStep1(): boolean {
    clearAllErrors();
    const filled = images.filter(Boolean);
    if (filled.length !== 3) {
      setErrors({ img: "Please upload all 3 images (2 portrait + 1 landscape) before continuing." });
      return false;
    }
    if (gameType === "upload") {
      if (uploadedFiles.length === 0 || !combinedHtml) {
        setErrors({ upload: "Please upload your game files (must include an HTML file)." });
        return false;
      }
    } else {
      const urlVal = url.trim();
      if (!urlVal) {
        setErrors({ upload: "Please enter a game URL." });
        return false;
      }
      if (!/^https?:\/\/.+/.test(urlVal)) {
        setErrors({ upload: "Please enter a valid URL starting with https://." });
        return false;
      }
    }
    const t = title.trim();
    if (t.length < TITLE_MIN || t.length > TITLE_MAX) {
      setErrors({ title: `Title must be between ${TITLE_MIN} and ${TITLE_MAX} characters (currently ${t.length}).` });
      return false;
    }
    const d = desc.trim();
    if (d.length < DESC_MIN || d.length > DESC_MAX) {
      setErrors({ desc: `Description must be between ${DESC_MIN} and ${DESC_MAX} characters (currently ${d.length}).` });
      return false;
    }
    return true;
  }

  function validateStep2(): boolean {
    clearAllErrors();
    if (!platform || !genre) {
      setErrors({ details: "Please select Platform and Genre." });
      return false;
    }
    if (!monetization.trim()) {
      setErrors({ details: "Please enter how this game is monetized." });
      return false;
    }
    if (transferMethods.length === 0) {
      setErrors({ transfer: "Please select at least one transfer method." });
      return false;
    }
    return true;
  }

  function goToStep(n: number) {
    if (n > step) {
      if (step === 1 && !validateStep1()) return;
      if (step === 2 && !validateStep2()) return;
    }
    setStep(n);
    saveDraft(n);
  }

  const profit = (parseFloat(revenue) || 0) - (parseFloat(expenses) || 0);

  function toggleTransfer(value: string) {
    setTransferMethods((prev) => (prev.includes(value) ? prev.filter((v) => v !== value) : [...prev, value]));
  }

  async function handleSubmit() {
    clearAllErrors();
    setSubmitError("");

    const filled = images.filter(Boolean);
    if (filled.length !== 3) {
      setStep(1);
      setErrors({ img: "Please upload exactly 3 images (2 portrait + 1 landscape)." });
      return;
    }
    let gameUrl: string | null = null;
    if (gameType === "upload") {
      if (!combinedHtml) {
        setStep(1);
        setErrors({ upload: "Please upload your game files." });
        return;
      }
    } else {
      gameUrl = url.trim();
      if (!gameUrl || !/^https?:\/\/.+/.test(gameUrl)) {
        setStep(1);
        setErrors({ upload: "Please enter a valid game URL." });
        return;
      }
    }
    if (!platform || !genre) {
      setStep(2);
      setErrors({ details: "Please select Platform and Genre." });
      return;
    }
    if (!monetization.trim()) {
      setStep(2);
      setErrors({ details: "Please enter how this game is monetized." });
      return;
    }
    if (!price.trim() || !revenue.trim() || !expenses.trim()) {
      setErrors({ fin: "Please fill in Price, Monthly Revenue, and Monthly Expenses." });
      return;
    }
    if (!user) {
      setSubmitError("You must be logged in to list.");
      return;
    }

    setSubmitting(true);
    try {
      setProgress({ pct: 0, label: "Uploading screenshots…" });
      const imgUrls: string[] = [];
      for (let i = 0; i < 3; i++) {
        const imgFile = images[i]!.file;
        const uploadedUrl = await uploadToImgur(imgFile);
        imgUrls.push(uploadedUrl);
        setProgress({ pct: Math.round(((i + 1) / 3) * 50), label: `Uploading screenshot ${i + 1} of 3…` });
      }

      const idToken = await user.getIdToken();

      if (gameType === "upload") {
        setProgress({ pct: 60, label: "Uploading game build…" });
        gameUrl = await uploadTextToStorage("game.html", combinedHtml, idToken);
      }
      setProgress({ pct: 75, label: "Saving listing to marketplace…" });

      const frontendLabel = platform === "android" ? "Android" : platform === "desktop" ? "Desktop" : "Android & Desktop";

      await createListing({
        idToken,
        type: "game",
        gameType,
        url: gameUrl,
        title: title.trim(),
        description: desc.trim(),
        images: imgUrls,
        category: "Game",
        tech: { frontend: frontendLabel, backend: genre, database: "", monetization },
        settings: { category: "Game", age: age || "", location: "", structure: structure || "", reason: reason || "" },
        financials: {
          price: parseFloat(price),
          revenue: parseFloat(revenue),
          expenses: parseFloat(expenses),
        },
        transferMethods,
        attachedRepo: null,
      });

      setProgress({ pct: 100, label: "Published!" });
      setSuccess(true);
      clearDraft();
      setTimeout(() => router.push("/marketplace"), 2000);
    } catch (err: any) {
      setSubmitError("Error: " + (err?.message || "Something went wrong. Please try again."));
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div style={{ minHeight: "100vh", background: "#000", color: "#fff", fontFamily: "'Segoe UI',system-ui,sans-serif" }}>
      <AiLengthPickerHost />
      <input ref={fileInputRef} type="file" accept="image/*" style={{ display: "none" }} onChange={onFileInputChange} />
      <input
        ref={gameFileInputRef}
        type="file"
        accept=".html,.htm,.css,.js"
        multiple
        style={{ display: "none" }}
        onChange={(e) => {
          if (e.target.files?.length) handleGameFiles(e.target.files);
          e.target.value = "";
        }}
      />

      {/* Header */}
      <header
        style={{
          position: "sticky",
          top: 0,
          zIndex: 10,
          height: 52,
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          padding: "0 20px",
          background: "rgba(0,0,0,0.9)",
          backdropFilter: "blur(18px)",
          WebkitBackdropFilter: "blur(18px)",
          borderBottom: "1px solid rgba(255,255,255,0.07)",
        }}
      >
        <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
          <button onClick={handleBack} style={backBtnStyle}>
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2.2} strokeLinecap="round" strokeLinejoin="round" style={{ width: 14, height: 14 }}>
              <path d="M19 12H5M12 5l-7 7 7 7" />
            </svg>
            Back
          </button>
          <div style={{ fontSize: 15, fontWeight: 800, letterSpacing: "-0.03em" }}>
            Siterifty<span style={{ color: "rgba(245,158,11,0.55)" }}>.com</span>
          </div>
        </div>
        <span style={{ fontSize: 11, fontWeight: 800, textTransform: "uppercase", letterSpacing: "0.08em", color: ACCENT }}>
          Game Listing
        </span>
      </header>

      <div style={{ maxWidth: 820, margin: "0 auto", padding: "28px 16px 80px" }}>
        <h1 style={{ fontSize: 28, fontWeight: 800, letterSpacing: "-0.02em", marginBottom: 6 }}>
          List a <em style={{ fontStyle: "normal", color: "rgba(245,158,11,0.85)" }}>Game</em>
        </h1>
        <p style={{ fontSize: 14, color: "rgba(255,255,255,0.4)", marginBottom: 28 }}>
          Showcase your game with screenshots, upload your build, or link an external page — then set your price.
        </p>

        {/* Step tabs */}
        <div style={{ display: "flex", gap: 8, margin: "0 0 20px", borderBottom: "1px solid rgba(255,255,255,0.06)", paddingBottom: 12 }}>
          {["1. Basics", "2. Details", "3. Financials"].map((label, i) => (
            <button
              key={label}
              onClick={() => goToStep(i + 1)}
              style={{
                background: step === i + 1 ? "rgba(245,158,11,0.1)" : "none",
                color: step === i + 1 ? ACCENT : "rgba(255,255,255,0.25)",
                border: "none",
                fontSize: 13,
                fontWeight: 700,
                padding: "8px 14px",
                borderRadius: 20,
                cursor: "pointer",
              }}
            >
              {label}
            </button>
          ))}
        </div>

        {step === 1 && (
          <div>
            <span style={sectionLabelStyle}>
              Screenshots <span style={{ color: "#f87171" }}>*</span>
            </span>
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12, marginBottom: 12 }}>
              {SLOT_LABELS.map((label, idx) => (
                <ImageSlot
                  key={idx}
                  image={images[idx]}
                  label={label}
                  landscape={idx === 2}
                  onClick={() => openSlotPicker(idx)}
                  onRemove={() => removeImage(idx)}
                />
              ))}
            </div>
            {errors.img && <ErrorBox>{errors.img}</ErrorBox>}

            <span style={sectionLabelStyle}>Game Source</span>
            <div style={{ display: "flex", background: "rgba(255,255,255,0.04)", border: "1px solid rgba(255,255,255,0.08)", borderRadius: 14, padding: 4, marginBottom: 16, gap: 4 }}>
              <button
                onClick={() => setGameType("upload")}
                style={{ ...typeBtnStyle, ...(gameType === "upload" ? activeAmberStyle : {}) }}
              >
                Upload Build
              </button>
              <button
                onClick={() => setGameType("link")}
                style={{ ...typeBtnStyle, ...(gameType === "link" ? activeAmberStyle : {}) }}
              >
                External Link
              </button>
            </div>

            {gameType === "upload" ? (
              <div style={{ marginBottom: 20 }}>
                <div
                  onClick={() => gameFileInputRef.current?.click()}
                  style={{
                    border: `2px dashed ${uploadedFiles.length ? "rgba(245,158,11,0.4)" : "rgba(255,255,255,0.15)"}`,
                    borderRadius: 14,
                    padding: 24,
                    textAlign: "center",
                    cursor: "pointer",
                    background: "rgba(255,255,255,0.02)",
                  }}
                >
                  <div style={{ fontSize: 13, color: "rgba(255,255,255,0.5)", marginBottom: 8 }}>
                    {uploadedFiles.length
                      ? `${uploadedFiles.length} file${uploadedFiles.length > 1 ? "s" : ""} selected — click to add more`
                      : "Click or drag to upload your game (.html, .css, .js)"}
                  </div>
                  {uploadedFiles.length > 0 && (
                    <div style={{ display: "flex", flexWrap: "wrap", gap: 6, justifyContent: "center", marginTop: 8 }}>
                      {uploadedFiles.map((f) => (
                        <span key={f.name} style={fileTagStyle}>{f.name}</span>
                      ))}
                    </div>
                  )}
                </div>
                {duplicateError && <ErrorBox>{duplicateError}</ErrorBox>}
                {errors.upload && <ErrorBox>{errors.upload}</ErrorBox>}
                {uploadedFiles.length > 0 && (
                  <div style={{ display: "flex", gap: 10, marginTop: 10 }}>
                    <button onClick={() => setTestPlayOpen(true)} style={testPlayBtnStyle}>▶ Test Play</button>
                    <button onClick={removeGameFiles} style={prevBtnStyle}>Remove Files</button>
                  </div>
                )}
              </div>
            ) : (
              <Field label="Game URL" required error={errors.upload}>
                <input type="url" value={url} onChange={(e) => setUrl(e.target.value)} placeholder="https://example.com/play" style={inputStyle} />
              </Field>
            )}

            <Field label="Title" required error={errors.title}>
              <input type="text" value={title} onChange={(e) => setTitle(e.target.value)} placeholder="A short, catchy name for your game" style={inputStyle} />
              <CharCount value={title} min={TITLE_MIN} max={TITLE_MAX} />
            </Field>

            <Field label="Description" required error={errors.desc}>
              <textarea
                value={desc}
                onChange={(e) => setDesc(e.target.value)}
                placeholder="Describe the gameplay, genre, and what's included in the sale…"
                rows={6}
                style={{ ...inputStyle, height: "auto", padding: 14, resize: "vertical" }}
              />
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginTop: 6 }}>
                <button
                  type="button"
                  className="ai-autogen-btn"
                  onClick={handleAutoGenerate}
                  disabled={aiGenerating}
                >
                  <span>{aiGenerating ? "✨ Generating…" : "✨ Auto Generate"}</span>
                </button>
                <CharCount value={desc} min={DESC_MIN} max={DESC_MAX} />
              </div>
              {aiError && <ErrorBox>{aiError}</ErrorBox>}
            </Field>

            <NextButton onClick={() => goToStep(2)} />
          </div>
        )}

        {step === 2 && (
          <div>
            <span style={sectionLabelStyle}>Details</span>
            {errors.details && <ErrorBox>{errors.details}</ErrorBox>}
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12, marginBottom: 16 }}>
              <Field label="Platform">
                <select value={platform} onChange={(e) => setPlatform(e.target.value)} style={inputStyle}>
                  <option value="">Select</option>
                  {PLATFORM_OPTIONS.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
                </select>
              </Field>
              <Field label="Genre">
                <select value={genre} onChange={(e) => setGenre(e.target.value)} style={inputStyle}>
                  <option value="">Select</option>
                  {GENRE_OPTIONS.map((o) => <option key={o} value={o}>{o}</option>)}
                </select>
              </Field>
            </div>
            <Field label="Monetization" required>
              <input value={monetization} onChange={(e) => setMonetization(e.target.value)} placeholder="e.g. Ads, In-app purchases, One-time purchase" style={inputStyle} />
            </Field>

            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12, marginBottom: 16 }}>
              <Field label="Game Age">
                <select value={age} onChange={(e) => setAge(e.target.value)} style={inputStyle}>
                  <option value="">Select</option>
                  {AGE_OPTIONS.map((o) => <option key={o} value={o}>{o}</option>)}
                </select>
              </Field>
              <Field label="Business Structure">
                <select value={structure} onChange={(e) => setStructure(e.target.value)} style={inputStyle}>
                  <option value="">Select</option>
                  {STRUCTURE_OPTIONS.map((o) => <option key={o} value={o}>{o}</option>)}
                </select>
              </Field>
            </div>

            <Field label="Reason for selling (optional)">
              <input value={reason} onChange={(e) => setReason(e.target.value)} placeholder="e.g. Moving to a new project, time constraints" style={inputStyle} />
            </Field>

            <span style={sectionLabelStyle}>
              Transfer Methods <span style={{ color: "#f87171" }}>*</span>
            </span>
            {errors.transfer && <ErrorBox>{errors.transfer}</ErrorBox>}
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8, marginBottom: 24 }}>
              {TRANSFER_METHODS.map((m) => (
                <label
                  key={m.value}
                  style={{
                    gridColumn: m.featured ? "1/-1" : undefined,
                    display: "flex",
                    alignItems: "center",
                    gap: 8,
                    padding: "10px 12px",
                    background: transferMethods.includes(m.value) ? "rgba(245,158,11,0.08)" : "rgba(255,255,255,0.03)",
                    border: `1px solid ${transferMethods.includes(m.value) ? "rgba(245,158,11,0.3)" : "rgba(255,255,255,0.08)"}`,
                    borderRadius: 10,
                    cursor: "pointer",
                    fontSize: 13,
                  }}
                >
                  <input type="checkbox" checked={transferMethods.includes(m.value)} onChange={() => toggleTransfer(m.value)} style={{ accentColor: ACCENT }} />
                  <span style={{ display: "flex", flexDirection: "column" }}>
                    <span style={{ fontWeight: 600 }}>{m.featured ? "⚡ " : ""}{m.label}</span>
                    {m.sub && <span style={{ fontSize: 11, opacity: 0.5 }}>{m.sub}</span>}
                  </span>
                </label>
              ))}
            </div>

            <div style={{ display: "flex", gap: 10 }}>
              <PrevButton onClick={() => setStep(1)} />
              <NextButton onClick={() => goToStep(3)} />
            </div>
          </div>
        )}

        {step === 3 && (
          <div>
            {errors.fin && <ErrorBox>{errors.fin}</ErrorBox>}
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 12, marginBottom: 16 }}>
              <Field label="Asking Price ($)">
                <input type="number" min="0" value={price} onChange={(e) => setPrice(e.target.value)} placeholder="1000" style={inputStyle} />
              </Field>
              <Field label="Monthly Revenue ($)">
                <input type="number" min="0" value={revenue} onChange={(e) => setRevenue(e.target.value)} placeholder="200" style={inputStyle} />
              </Field>
              <Field label="Monthly Expenses ($)">
                <input type="number" min="0" value={expenses} onChange={(e) => setExpenses(e.target.value)} placeholder="20" style={inputStyle} />
              </Field>
            </div>

            <div style={{ padding: 16, background: "rgba(255,255,255,0.03)", borderRadius: 12, marginBottom: 24, display: "flex", justifyContent: "space-between", alignItems: "center" }}>
              <span style={{ fontSize: 13, color: "rgba(255,255,255,0.5)", fontWeight: 600 }}>Monthly Profit</span>
              <span style={{ fontSize: 20, fontWeight: 800, color: profit >= 0 ? ACCENT : "#f87171" }}>
                {profit >= 0 ? "+" : ""}${profit.toFixed(2)}
              </span>
            </div>

            {submitError && <ErrorBox>{submitError}</ErrorBox>}

            {progress && (
              <div style={{ marginBottom: 16 }}>
                <div style={{ height: 8, background: "rgba(255,255,255,0.08)", borderRadius: 4, overflow: "hidden" }}>
                  <div style={{ height: "100%", width: `${progress.pct}%`, background: ACCENT, transition: "width 0.3s" }} />
                </div>
                <div style={{ fontSize: 12, color: "rgba(255,255,255,0.5)", marginTop: 6 }}>{progress.label} ({progress.pct}%)</div>
              </div>
            )}

            {success && (
              <div style={{ padding: 14, background: "rgba(245,158,11,0.1)", border: "1px solid rgba(245,158,11,0.3)", borderRadius: 10, color: ACCENT, fontWeight: 700, marginBottom: 16, textAlign: "center" }}>
                ✓ Published! Redirecting to the marketplace…
              </div>
            )}

            <div style={{ display: "flex", gap: 10 }}>
              <PrevButton onClick={() => setStep(2)} disabled={submitting} />
              <button onClick={handleSubmit} disabled={submitting || success} style={{ ...nextBtnStyle, opacity: submitting || success ? 0.6 : 1 }}>
                {submitting ? "Publishing…" : "Publish Listing"}
              </button>
            </div>
          </div>
        )}
      </div>

      {/* Test Play modal */}
      {testPlayOpen && previewBlobUrl && (
        <div
          onClick={() => setTestPlayOpen(false)}
          style={{
            position: "fixed", inset: 0, zIndex: 10000, background: "rgba(0,0,0,0.85)",
            display: "flex", alignItems: "center", justifyContent: "center", padding: 20,
          }}
        >
          <div onClick={(e) => e.stopPropagation()} style={{ width: "100%", maxWidth: 480, height: "80vh", background: "#000", borderRadius: 16, border: "1px solid rgba(245,158,11,0.3)", overflow: "hidden", position: "relative" }}>
            <button
              onClick={() => setTestPlayOpen(false)}
              style={{ position: "absolute", top: 10, right: 10, zIndex: 1, width: 32, height: 32, borderRadius: "50%", background: "rgba(0,0,0,0.7)", color: "#fff", border: "none", cursor: "pointer" }}
            >
              ✕
            </button>
            <iframe src={previewBlobUrl} sandbox="allow-scripts allow-same-origin" style={{ width: "100%", height: "100%", border: "none" }} />
          </div>
        </div>
      )}
    </div>
  );
}

// ── Shared subcomponents ──

function ImageSlot({
  image,
  label,
  landscape,
  onClick,
  onRemove,
}: {
  image: SlotImage | null;
  label: string;
  landscape: boolean;
  onClick: () => void;
  onRemove: () => void;
}) {
  return (
    <div
      onClick={image ? undefined : onClick}
      style={{
        gridColumn: landscape ? "1/-1" : undefined,
        height: landscape ? 140 : 180,
        background: "rgba(255,255,255,0.03)",
        border: `2px dashed ${image ? "transparent" : "rgba(255,255,255,0.15)"}`,
        borderRadius: 14,
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        justifyContent: "center",
        cursor: image ? "default" : "pointer",
        position: "relative",
        overflow: "hidden",
      }}
    >
      {image ? (
        <>
          <img src={image.dataUrl} alt={label} style={{ width: "100%", height: "100%", objectFit: "cover", display: "block" }} />
          <button
            type="button"
            onClick={(e) => {
              e.stopPropagation();
              onRemove();
            }}
            style={{
              position: "absolute",
              top: 6,
              right: 6,
              width: 24,
              height: 24,
              borderRadius: "50%",
              background: "rgba(0,0,0,0.7)",
              color: "#fff",
              border: "none",
              cursor: "pointer",
              fontSize: 12,
            }}
          >
            ✕
          </button>
        </>
      ) : (
        <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 6, color: "rgba(255,255,255,0.25)", fontSize: 12, fontWeight: 500, textAlign: "center", padding: 8 }}>
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.6} style={{ width: 28, height: 28, opacity: 0.5 }}>
            <rect x="3" y="3" width="18" height="18" rx="2" />
            <circle cx="8.5" cy="8.5" r="1.5" />
            <path d="M21 15l-5-5L5 21" />
          </svg>
          <span>{label}</span>
        </div>
      )}
    </div>
  );
}

function Field({
  label,
  required,
  error,
  children,
}: {
  label: string;
  required?: boolean;
  error?: string;
  children: React.ReactNode;
}) {
  return (
    <div style={{ marginBottom: 16 }}>
      <label style={fieldLabelStyle}>
        {label} {required && <span style={{ color: "#f87171" }}>*</span>}
      </label>
      {children}
      {error && <ErrorBox>{error}</ErrorBox>}
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

function ErrorBox({ children }: { children: React.ReactNode }) {
  return (
    <div
      style={{
        marginTop: 8,
        padding: "10px 14px",
        background: "rgba(239,68,68,0.1)",
        border: "1px solid rgba(239,68,68,0.25)",
        borderRadius: 8,
        color: "#fca5a5",
        fontSize: 13,
        fontWeight: 600,
      }}
    >
      {children}
    </div>
  );
}

function NextButton({ onClick }: { onClick: () => void }) {
  return (
    <button onClick={onClick} style={nextBtnStyle}>
      Continue
    </button>
  );
}
function PrevButton({ onClick, disabled }: { onClick: () => void; disabled?: boolean }) {
  return (
    <button onClick={onClick} disabled={disabled} style={prevBtnStyle}>
      Back
    </button>
  );
}

// ── Styles ──
const backBtnStyle: React.CSSProperties = {
  background: "rgba(255,255,255,0.06)",
  border: "1px solid rgba(255,255,255,0.1)",
  color: "rgba(255,255,255,0.7)",
  padding: "7px 14px",
  borderRadius: 8,
  fontSize: 12,
  fontWeight: 600,
  cursor: "pointer",
  display: "flex",
  alignItems: "center",
  gap: 6,
};
const typeBtnStyle: React.CSSProperties = {
  flex: 1,
  padding: "12px 10px",
  border: "none",
  background: "transparent",
  borderRadius: 10,
  fontSize: 14,
  fontWeight: 700,
  color: "rgba(255,255,255,0.3)",
  cursor: "pointer",
};
const activeAmberStyle: React.CSSProperties = {
  background: "rgba(245,158,11,0.12)",
  color: ACCENT,
  boxShadow: "0 0 0 1px rgba(245,158,11,0.15)",
};
const sectionLabelStyle: React.CSSProperties = {
  display: "block",
  fontSize: 12,
  fontWeight: 700,
  textTransform: "uppercase",
  letterSpacing: "0.06em",
  color: "rgba(255,255,255,0.5)",
  marginBottom: 10,
};
const fieldLabelStyle: React.CSSProperties = {
  display: "block",
  fontSize: 12,
  fontWeight: 700,
  color: "rgba(255,255,255,0.5)",
  marginBottom: 6,
  textTransform: "uppercase",
  letterSpacing: "0.04em",
};
const inputStyle: React.CSSProperties = {
  width: "100%",
  height: 44,
  padding: "0 14px",
  background: "#09090b",
  border: "1px solid #3f3f46",
  borderRadius: 8,
  fontSize: 14,
  color: "#fff",
  outline: "none",
  fontFamily: "inherit",
  boxSizing: "border-box",
};
const fileTagStyle: React.CSSProperties = {
  display: "inline-flex",
  alignItems: "center",
  gap: 6,
  background: "rgba(255,255,255,0.06)",
  border: "1px solid rgba(255,255,255,0.12)",
  borderRadius: 8,
  padding: "5px 10px",
  fontSize: 11.5,
  color: "rgba(255,255,255,0.75)",
};
const nextBtnStyle: React.CSSProperties = {
  flex: 1,
  height: 48,
  background: ACCENT,
  color: "#09090b",
  border: "none",
  borderRadius: 10,
  fontSize: 14,
  fontWeight: 800,
  cursor: "pointer",
  textTransform: "uppercase",
  letterSpacing: "0.04em",
};
const prevBtnStyle: React.CSSProperties = {
  height: 48,
  padding: "0 24px",
  background: "rgba(255,255,255,0.06)",
  color: "rgba(255,255,255,0.7)",
  border: "1px solid rgba(255,255,255,0.1)",
  borderRadius: 10,
  fontSize: 14,
  fontWeight: 700,
  cursor: "pointer",
};
const testPlayBtnStyle: React.CSSProperties = {
  flex: 1,
  height: 44,
  background: "rgba(245,158,11,0.12)",
  color: ACCENT,
  border: "1px solid rgba(245,158,11,0.3)",
  borderRadius: 10,
  fontSize: 13,
  fontWeight: 700,
  cursor: "pointer",
};
