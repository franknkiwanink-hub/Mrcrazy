"use client";

// Ports the app-listing form that actually lives inside Js/onboarding.js
// (lines ~1-993) — despite the filename, that file has nothing to do with
// product-tour onboarding; every line of it is the standalone "list an app"
// modal (window.__openAppListingForm / #listingFormModalApp), a sibling of
// listing-form.js (website) and listing-form-game.js (game). The real
// onboarding/welcome-tour flow lives elsewhere and is already ported as
// components/onboarding/TourModal.tsx — that naming collision is why this
// form was previously marked "done" in port-status.md when it had never
// been started. See port-status.md for the corrected breakdown.
//
// Field-for-field mirror of the original 4-step modal:
//   Step 1 (Basics): name, description, category, app age, business
//     structure, reason for selling (optional)
//   Step 2 (Media): banner (16:9), icon, exactly 3 screenshots
//   Step 3 (Platforms & Transfer): iOS / Android / Web toggles (each with
//     its own store/site URL OR a per-platform "Not live yet" build
//     upload), a separate global "Not Live" tile (app isn't published
//     anywhere yet — clears/disables iOS/Android/Web and requires its own
//     build upload instead), optional extra files, transfer methods
//   Step 4 (Financials): price (always required), revenue/expenses/
//     monetization model (disabled + cleared while globally "Not Live",
//     since there's nothing live generating them yet), subscription
//     monthly/annual sub-fields when monetization is "Subscription"
//
// Images (banner/icon/screenshots) upload to Imgur, exactly like the
// website/game forms. Build files (per-platform "not live" uploads, the
// global "not live" upload, and the optional extra-files slot) upload to
// /api/storage — that handler already accepts both text (html/css/js) and
// base64 (apk/aab/obb/apks/xapk/ipa/zip) encodings untouched from the
// legacy backend, so no server-side change was needed for this form.
//
// Draft save/restore uses localStorage (key: srf_draft_app), matching the
// original's AFM_DRAFT_KEY. GitHub repo attach isn't ported yet anywhere
// in this app, so attachedRepo is always sent as null (same as the
// website/game forms).

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { useAuth } from "@/lib/AuthContext";
import { createListing, type ListingBuildFile } from "@/lib/listings";
import { aiStudioCall, aiPlanCap } from "@/lib/aiStudio";
import { useAiLengthPicker } from "@/lib/useAiLengthPicker";
import { useLimits } from "@/lib/useLimits";

const ACCENT = "#fbbf24";
const DRAFT_KEY = "srf_draft_app";

// Fallback limits — used only until useLimits() resolves live values from
// GET /api/limits (app/api/_lib/limits.js's LIMITS.listing). Same numbers
// as that source (title 3-99 chars, desc 100-5000 chars), kept here as the
// initial/degrade-on-failure state rather than a permanent hardcode.
const FALLBACK_TITLE_MIN = 3;
const FALLBACK_TITLE_MAX = 99;
const FALLBACK_DESC_MIN = 100;
const FALLBACK_DESC_MAX = 5000;

const CATEGORY_OPTIONS = ["Productivity", "Social", "Finance", "Health & Fitness", "Entertainment", "Education", "Utilities", "Other"];
const AGE_OPTIONS = ["< 3 months", "3–5 months", "6–11 months", "1+ year", "2+ years", "3+ years", "5+ years", "10+ years"];
const STRUCTURE_OPTIONS = ["Sole Proprietorship", "LLC", "Corporation", "Partnership", "Other"];
const MONETIZATION_OPTIONS = ["Ads", "Subscription", "One-time purchase", "In-app purchases", "Freemium", "Other"];

const TRANSFER_METHODS: { value: string; label: string; sub?: string; featured?: boolean }[] = [
  { value: "account_handover", label: "Account Handover (App Store / Play Console access)", featured: true },
  { value: "source_code", label: "Source Code Handover" },
  { value: "direct_download", label: "Direct Build Transfer (APK/IPA)" },
  { value: "other", label: "Other (discuss in chat)" },
];

type Platform = "ios" | "android" | "web";
const PLATFORM_META: Record<Platform, { label: string; urlLabel: string; urlPlaceholder: string; exts: string[] }> = {
  ios: { label: "iOS", urlLabel: "App Store URL", urlPlaceholder: "https://apps.apple.com/...", exts: [".ipa"] },
  android: { label: "Android", urlLabel: "Play Store URL", urlPlaceholder: "https://play.google.com/...", exts: [".apk", ".aab", ".obb", ".apks", ".xapk"] },
  web: { label: "Web", urlLabel: "Site URL", urlPlaceholder: "https://example.com", exts: [".html", ".htm", ".css", ".js", ".zip"] },
};
const GLOBAL_NOT_LIVE_EXTS = [".apk", ".aab", ".obb", ".apks", ".xapk", ".ipa"];
const EXTRA_FILE_EXTS = [".apk", ".aab", ".obb", ".apks", ".xapk", ".ipa", ".html", ".htm", ".css", ".js", ".zip"];
const TEXT_EXTS = ["html", "htm", "css", "js"];

interface SlotImage {
  file: File;
  dataUrl: string;
}
interface NamedFile {
  file: File;
  name: string;
}

interface Draft {
  step?: number;
  name?: string;
  desc?: string;
  category?: string;
  age?: string;
  structure?: string;
  reason?: string;
  videoUrl?: string;
  previewUrl?: string;
  price?: string;
  revenue?: string;
  expenses?: string;
  techFrontend?: string;
  techBackend?: string;
  techDatabase?: string;
  platforms?: Platform[];
  iosStoreUrl?: string;
  androidStoreUrl?: string;
  webSiteUrl?: string;
  globalNotLive?: boolean;
  transferMethods?: string[];
  monetization?: string;
  subMonthly?: string;
  subAnnual?: string;
}

function extOf(filename: string): string {
  return "." + (filename.split(".").pop() || "").toLowerCase();
}

async function uploadToImgur(file: File): Promise<string> {
  const fd = new FormData();
  fd.append("image", file);
  const res = await fetch("https://api.imgur.com/3/image", {
    method: "POST",
    headers: { Authorization: "Client-ID 891e5bb4aa94282" },
    body: fd,
  });
  const json = await res.json();
  if (!json.success) throw new Error("Imgur upload failed: " + (json.data && json.data.error));
  return json.data.link;
}

// Uploads one File to /api/storage, choosing utf8 vs base64 encoding by
// extension exactly like the original's per-file branch — text web assets
// get a real `url` back, binaries/zips get a private `storagePath` that
// must be resolved to a signed URL later at render time.
async function uploadBuildFile(file: File, idToken: string): Promise<ListingBuildFile> {
  const ext = extOf(file.name).slice(1);
  let body: Record<string, string>;
  if (TEXT_EXTS.includes(ext)) {
    const content = await file.text();
    body = { filename: file.name, content, encoding: "utf8" };
  } else {
    const base64 = await new Promise<string>((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => resolve((reader.result as string).split(",")[1]);
      reader.onerror = () => reject(new Error(file.name + " read failed"));
      reader.readAsDataURL(file);
    });
    body = { filename: file.name, content: base64, encoding: "base64" };
  }
  const res = await fetch("/api/storage", {
    method: "POST",
    headers: { "Content-Type": "application/json", Authorization: `Bearer ${idToken}` },
    body: JSON.stringify(body),
  });
  const json = await res.json();
  if (!res.ok) throw new Error(json.error || file.name + " upload failed");
  return {
    filename: file.name,
    url: json.url || null,
    storagePath: json.storagePath || null,
  };
}

export default function AppListingForm() {
  const router = useRouter();
  const { user, profile } = useAuth();
  const { limits } = useLimits();

  const TITLE_MIN = limits.listing.titleMinLength ?? FALLBACK_TITLE_MIN;
  const TITLE_MAX = limits.listing.titleMaxLength ?? FALLBACK_TITLE_MAX;
  const DESC_MIN = limits.listing.descMinLength ?? FALLBACK_DESC_MIN;
  const DESC_MAX = limits.listing.descMaxLength ?? FALLBACK_DESC_MAX;

  const [step, setStep] = useState(1);

  // Step 1 — Basics
  const [name, setName] = useState("");
  const [desc, setDesc] = useState("");

  // ── AI auto-description (ports afmAutoGenBtn from ai-support-chat.js) ──
  const { pick, AiLengthPickerHost } = useAiLengthPicker();
  const [aiGenerating, setAiGenerating] = useState(false);
  const [aiError, setAiError] = useState<string | null>(null);

  async function handleAutoGenerate() {
    const n = name.trim();
    if (!n) {
      setErrors((prev) => ({ ...prev, name: `Name must be between ${TITLE_MIN} and ${TITLE_MAX} characters (currently 0).` }));
      return;
    }
    setAiError(null);
    const plan = profile?.plan || "free";
    const cap = aiPlanCap(plan);
    const targetLength = await pick(cap, plan);
    if (targetLength === null) return; // cancelled

    setAiGenerating(true);
    try {
      // Server action takes `title` regardless of listing type — the app
      // form's field is just labeled "Name" in the UI (same mapping the
      // original's afmAutoGenBtn wiring uses: titleId points at afmName).
      const result = await aiStudioCall<{ description?: string }>("auto-description", { title: n, targetLength, plan });
      const generated = (result.description || "").trim();
      if (!generated) throw new Error("The AI returned an empty description.");
      setDesc(generated);
    } catch (e) {
      setAiError(e instanceof Error ? `Couldn't generate a description: ${e.message}` : "Could not generate a description right now — please try again or write your own.");
    } finally {
      setAiGenerating(false);
    }
  }
  const [category, setCategory] = useState("");
  const [age, setAge] = useState("");
  const [structure, setStructure] = useState("");
  const [reason, setReason] = useState("");

  // Step 2 — Media
  const [banner, setBanner] = useState<SlotImage | null>(null);
  const [icon, setIcon] = useState<SlotImage | null>(null);
  const [screenshots, setScreenshots] = useState<SlotImage[]>([]);
  const bannerInputRef = useRef<HTMLInputElement>(null);
  const iconInputRef = useRef<HTMLInputElement>(null);
  const screenshotInputRef = useRef<HTMLInputElement>(null);
  const MAX_SCREENSHOTS = 3;

  // Step 3 — Platforms & Transfer
  const [platforms, setPlatforms] = useState<Set<Platform>>(new Set());
  const [globalNotLive, setGlobalNotLive] = useState(false);
  const [notLive, setNotLive] = useState<Record<Platform, boolean>>({ ios: false, android: false, web: false });
  const [platformUrls, setPlatformUrls] = useState<Record<Platform, string>>({ ios: "", android: "", web: "" });
  const [platformFiles, setPlatformFiles] = useState<Record<Platform, NamedFile[]>>({ ios: [], android: [], web: [] });
  const [globalNotLiveFiles, setGlobalNotLiveFiles] = useState<NamedFile[]>([]);
  const [videoUrl, setVideoUrl] = useState("");
  const [previewUrl, setPreviewUrl] = useState("");
  const [extraFiles, setExtraFiles] = useState<NamedFile[]>([]);
  const [transferMethods, setTransferMethods] = useState<string[]>([]);
  const platformFileInputRefs: Record<Platform, React.RefObject<HTMLInputElement>> = {
    ios: useRef<HTMLInputElement>(null),
    android: useRef<HTMLInputElement>(null),
    web: useRef<HTMLInputElement>(null),
  };
  const globalNotLiveInputRef = useRef<HTMLInputElement>(null);
  const extraFileInputRef = useRef<HTMLInputElement>(null);

  // Step 4 — Financials
  const [price, setPrice] = useState("");
  const [revenue, setRevenue] = useState("");
  const [expenses, setExpenses] = useState("");
  const [techFrontend, setTechFrontend] = useState("");
  const [techBackend, setTechBackend] = useState("");
  const [techDatabase, setTechDatabase] = useState("");
  const [monetization, setMonetization] = useState("");
  const [subMonthly, setSubMonthly] = useState("");
  const [subAnnual, setSubAnnual] = useState("");

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
      const ok = window.confirm("You have a saved draft for an app listing. Restore it?");
      if (!ok) {
        localStorage.removeItem(DRAFT_KEY);
        return;
      }
      const d: Draft = JSON.parse(raw);
      if (d.name) setName(d.name);
      if (d.desc) setDesc(d.desc);
      if (d.category) setCategory(d.category);
      if (d.age) setAge(d.age);
      if (d.structure) setStructure(d.structure);
      if (d.reason) setReason(d.reason);
      if (d.videoUrl) setVideoUrl(d.videoUrl);
      if (d.previewUrl) setPreviewUrl(d.previewUrl);
      if (d.price) setPrice(d.price);
      if (d.revenue) setRevenue(d.revenue);
      if (d.expenses) setExpenses(d.expenses);
      if (d.techFrontend) setTechFrontend(d.techFrontend);
      if (d.techBackend) setTechBackend(d.techBackend);
      if (d.techDatabase) setTechDatabase(d.techDatabase);
      if (d.platforms?.length) setPlatforms(new Set(d.platforms));
      if (d.iosStoreUrl || d.androidStoreUrl || d.webSiteUrl) {
        setPlatformUrls({ ios: d.iosStoreUrl || "", android: d.androidStoreUrl || "", web: d.webSiteUrl || "" });
      }
      if (d.globalNotLive) setGlobalNotLive(true);
      if (d.transferMethods?.length) setTransferMethods(d.transferMethods);
      if (d.monetization) setMonetization(d.monetization);
      if (d.subMonthly) setSubMonthly(d.subMonthly);
      if (d.subAnnual) setSubAnnual(d.subAnnual);
      if (d.step && d.step > 1) setStep(d.step);
    } catch {
      // ignore corrupt draft
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  function saveDraft(nextStep = step) {
    try {
      const d: Draft = {
        step: nextStep, name, desc, category, age, structure, reason, videoUrl, previewUrl,
        price, revenue, expenses, techFrontend, techBackend, techDatabase,
        platforms: Array.from(platforms), iosStoreUrl: platformUrls.ios, androidStoreUrl: platformUrls.android,
        webSiteUrl: platformUrls.web, globalNotLive, transferMethods, monetization, subMonthly, subAnnual,
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
    return [name, desc, price].some((v) => v.trim().length > 0);
  }

  function handleBack() {
    if (hasAnyData()) {
      const save = window.confirm(
        "You have unsaved app listing info. Save as a draft so you can pick up where you left off?\n\nOK = Save Draft, Cancel = Discard & Close"
      );
      if (save) saveDraft();
      else clearDraft();
    }
    router.push("/marketplace");
  }

  // ── Image helpers (banner/icon/screenshots — plain read, no normalization needed) ──
  function readImage(file: File): Promise<SlotImage> {
    return new Promise((resolve) => {
      const reader = new FileReader();
      reader.onload = (ev) => resolve({ file, dataUrl: ev.target?.result as string });
      reader.readAsDataURL(file);
    });
  }

  async function onBannerChange(e: React.ChangeEvent<HTMLInputElement>) {
    const f = e.target.files?.[0];
    e.target.value = "";
    if (!f) return;
    if (!f.type.startsWith("image/")) {
      window.alert("Please select an image file.");
      return;
    }
    setBanner(await readImage(f));
  }
  async function onIconChange(e: React.ChangeEvent<HTMLInputElement>) {
    const f = e.target.files?.[0];
    e.target.value = "";
    if (!f) return;
    if (!f.type.startsWith("image/")) {
      window.alert("Please select an image file.");
      return;
    }
    setIcon(await readImage(f));
  }
  async function onScreenshotsChange(e: React.ChangeEvent<HTMLInputElement>) {
    const files = Array.from(e.target.files || []).filter((f) => f.type.startsWith("image/"));
    e.target.value = "";
    const remaining = MAX_SCREENSHOTS - screenshots.length;
    if (remaining <= 0 || files.length === 0) return;
    const toAdd = files.slice(0, remaining);
    const read = await Promise.all(toAdd.map(readImage));
    setScreenshots((prev) => [...prev, ...read]);
  }
  function removeScreenshot(idx: number) {
    setScreenshots((prev) => prev.filter((_, i) => i !== idx));
  }

  // ── Platform toggles ──
  function togglePlatform(p: Platform) {
    if (globalNotLive) return;
    setPlatforms((prev) => {
      const next = new Set(prev);
      if (next.has(p)) next.delete(p);
      else next.add(p);
      return next;
    });
  }
  function toggleGlobalNotLive() {
    setGlobalNotLive((prev) => {
      const next = !prev;
      if (next) setPlatforms(new Set());
      return next;
    });
  }
  function togglePlatformNotLive(p: Platform) {
    setNotLive((prev) => ({ ...prev, [p]: !prev[p] }));
  }
  function setPlatformUrl(p: Platform, v: string) {
    setPlatformUrls((prev) => ({ ...prev, [p]: v }));
  }
  function addPlatformFiles(p: Platform, fileList: FileList | File[]) {
    const allowed = PLATFORM_META[p].exts;
    const valid = Array.from(fileList).filter((f) => allowed.includes(extOf(f.name)));
    if (valid.length === 0) return;
    setPlatformFiles((prev) => {
      const existing = new Set(prev[p].map((f) => f.name));
      const additions = valid.filter((f) => !existing.has(f.name)).map((f) => ({ file: f, name: f.name }));
      return { ...prev, [p]: [...prev[p], ...additions] };
    });
  }
  function removePlatformFile(p: Platform, idx: number) {
    setPlatformFiles((prev) => ({ ...prev, [p]: prev[p].filter((_, i) => i !== idx) }));
  }
  function addGlobalNotLiveFiles(fileList: FileList | File[]) {
    const valid = Array.from(fileList).filter((f) => GLOBAL_NOT_LIVE_EXTS.includes(extOf(f.name)));
    if (valid.length === 0) return;
    setGlobalNotLiveFiles((prev) => {
      const existing = new Set(prev.map((f) => f.name));
      const additions = valid.filter((f) => !existing.has(f.name)).map((f) => ({ file: f, name: f.name }));
      return [...prev, ...additions];
    });
  }
  function removeGlobalNotLiveFile(idx: number) {
    setGlobalNotLiveFiles((prev) => prev.filter((_, i) => i !== idx));
  }
  function addExtraFiles(fileList: FileList | File[]) {
    const valid = Array.from(fileList).filter((f) => EXTRA_FILE_EXTS.includes(extOf(f.name)));
    if (valid.length === 0) return;
    setExtraFiles((prev) => {
      const existing = new Set(prev.map((f) => f.name));
      const additions = valid.filter((f) => !existing.has(f.name)).map((f) => ({ file: f, name: f.name }));
      return [...prev, ...additions].slice(0, 10);
    });
  }
  function removeExtraFile(idx: number) {
    setExtraFiles((prev) => prev.filter((_, i) => i !== idx));
  }
  function toggleTransfer(value: string) {
    setTransferMethods((prev) => (prev.includes(value) ? prev.filter((v) => v !== value) : [...prev, value]));
  }

  function isValidUrl(url: string): boolean {
    try {
      new URL(url);
      return true;
    } catch {
      return false;
    }
  }

  // ── Validation ──
  function clearAllErrors() {
    setErrors({});
  }

  function validateStep1(): boolean {
    clearAllErrors();
    const n = name.trim();
    if (n.length < TITLE_MIN || n.length > TITLE_MAX) {
      setErrors({ name: `Name must be between ${TITLE_MIN} and ${TITLE_MAX} characters (currently ${n.length}).` });
      return false;
    }
    const d = desc.trim();
    if (d.length < DESC_MIN || d.length > DESC_MAX) {
      setErrors({ desc: `Description must be between ${DESC_MIN} and ${DESC_MAX} characters (currently ${d.length}).` });
      return false;
    }
    if (!category || !age || !structure) {
      setErrors({ basics: "Please fill in Category, App Age, and Business Structure." });
      return false;
    }
    return true;
  }

  function validateStep2(): boolean {
    clearAllErrors();
    if (!banner) {
      setErrors({ banner: "Please upload a banner image." });
      return false;
    }
    if (!icon) {
      setErrors({ icon: "Please upload an app icon." });
      return false;
    }
    if (screenshots.length !== MAX_SCREENSHOTS) {
      setErrors({ screenshots: `Please upload exactly ${MAX_SCREENSHOTS} screenshots.` });
      return false;
    }
    return true;
  }

  function validateStep3(): boolean {
    clearAllErrors();
    if (globalNotLive) {
      if (globalNotLiveFiles.length === 0) {
        setErrors({ platforms: "Please upload at least one build file for this not-yet-published app." });
        return false;
      }
    } else if (platforms.size === 0) {
      setErrors({ platforms: "Please select at least one platform, or mark the app as Not Live." });
      return false;
    }
    if (!globalNotLive) {
      for (const p of platforms) {
        if (notLive[p]) {
          if (platformFiles[p].length === 0) {
            setErrors({ platforms: `Please upload a build file for ${PLATFORM_META[p].label}, or switch it back to live.` });
            return false;
          }
        } else {
          const u = platformUrls[p].trim();
          if (!u || !isValidUrl(u)) {
            setErrors({ platforms: `Please enter a valid ${PLATFORM_META[p].urlLabel} for ${PLATFORM_META[p].label}.` });
            return false;
          }
        }
      }
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
      if (step === 3 && !validateStep3()) return;
    }
    setStep(n);
    saveDraft(n);
  }

  const profit = (parseFloat(revenue) || 0) - (parseFloat(expenses) || 0);

  async function handleSubmit() {
    clearAllErrors();
    setSubmitError("");

    if (!validateStep1()) {
      setStep(1);
      return;
    }
    if (!validateStep2()) {
      setStep(2);
      return;
    }
    if (!validateStep3()) {
      setStep(3);
      return;
    }
    const priceVal = price.trim();
    if (!priceVal || isNaN(parseFloat(priceVal)) || parseFloat(priceVal) < 0) {
      setErrors({ fin: "Please enter a valid asking price." });
      return;
    }
    if (!globalNotLive) {
      if (!revenue.trim() || isNaN(parseFloat(revenue)) || !expenses.trim() || isNaN(parseFloat(expenses)) || !monetization) {
        setErrors({ fin: "Please fill in Monthly Revenue, Monthly Expenses, and Monetization Model." });
        return;
      }
      if (monetization === "Subscription") {
        if (!subMonthly.trim() || isNaN(parseFloat(subMonthly)) || !subAnnual.trim() || isNaN(parseFloat(subAnnual))) {
          setErrors({ fin: "Please fill in the monthly and annual subscription prices." });
          return;
        }
      }
    }
    if (!user) {
      setSubmitError("You must be logged in to list.");
      return;
    }

    setSubmitting(true);
    try {
      setProgress({ pct: 0, label: "Uploading banner…" });
      const bannerUrl = await uploadToImgur(banner!.file);
      setProgress({ pct: 15, label: "Uploading icon…" });
      const iconUrl = await uploadToImgur(icon!.file);

      const shotUrls: string[] = [];
      for (let i = 0; i < screenshots.length; i++) {
        setProgress({ pct: 20 + Math.round(((i + 1) / screenshots.length) * 25), label: `Uploading screenshot ${i + 1} of ${screenshots.length}…` });
        shotUrls.push(await uploadToImgur(screenshots[i].file));
      }
      // banner isn't a listing field on its own in the backend contract —
      // it's folded into images[0] the same way the original sends it
      // (images = shots, appIcon = icon); keep banner as the cover image.
      const allImages = [bannerUrl, ...shotUrls];

      const idToken = await user.getIdToken();

      setProgress({ pct: 48, label: "Uploading extra files…" });
      const additionalFiles: ListingBuildFile[] = [];
      for (const f of extraFiles) additionalFiles.push(await uploadBuildFile(f.file, idToken));
      const firstBinary = additionalFiles.find((f) => f.storagePath && !f.url);
      const apkStorageUrl = firstBinary ? firstBinary.storagePath ?? undefined : undefined;
      const apkIpaFileName = firstBinary ? firstBinary.filename : undefined;

      setProgress({ pct: 60, label: "Uploading platform builds…" });
      const notLiveBuilds: Record<Platform, ListingBuildFile[] | null> = { ios: null, android: null, web: null };
      for (const p of ["ios", "android", "web"] as Platform[]) {
        if (!globalNotLive && platforms.has(p) && notLive[p] && platformFiles[p].length) {
          const uploaded: ListingBuildFile[] = [];
          for (const f of platformFiles[p]) uploaded.push(await uploadBuildFile(f.file, idToken));
          notLiveBuilds[p] = uploaded;
        }
      }
      let globalBuild: ListingBuildFile[] | undefined;
      if (globalNotLive && globalNotLiveFiles.length) {
        setProgress({ pct: 75, label: "Uploading not-live build…" });
        const uploaded: ListingBuildFile[] = [];
        for (const f of globalNotLiveFiles) uploaded.push(await uploadBuildFile(f.file, idToken));
        globalBuild = uploaded;
      }

      setProgress({ pct: 88, label: "Saving listing to marketplace…" });

      const effectivePreviewUrl = platforms.has("web") && !notLive.web ? previewUrl.trim() || undefined : undefined;

      await createListing({
        idToken,
        type: "app",
        title: name.trim(),
        description: desc.trim(),
        appIcon: iconUrl,
        images: allImages,
        videoUrl: videoUrl.trim() || undefined,
        previewUrl: effectivePreviewUrl,
        category,
        apkUrl: apkStorageUrl,
        apkStorageUrl,
        apkIpaFileName,
        additionalFiles,
        platforms: {
          selected: Array.from(platforms),
          iosUrl: platforms.has("ios") && !notLive.ios ? platformUrls.ios.trim() : null,
          androidUrl: platforms.has("android") && !notLive.android ? platformUrls.android.trim() : null,
          webUrl: platforms.has("web") && !notLive.web ? platformUrls.web.trim() : null,
          previewUrl: effectivePreviewUrl || null,
          notLive: {
            ios: platforms.has("ios") ? notLive.ios : false,
            android: platforms.has("android") ? notLive.android : false,
            web: platforms.has("web") ? notLive.web : false,
          },
          iosBuildFiles: notLiveBuilds.ios,
          androidBuildFiles: notLiveBuilds.android,
          webBuildFiles: notLiveBuilds.web,
        },
        notLive: { ios: false, android: false, web: false, global: globalNotLive },
        notLiveBuildFiles: globalNotLive ? { global: globalBuild } : undefined,
        tech: {
          frontend: techFrontend.trim() || undefined,
          backend: techBackend.trim() || undefined,
          database: techDatabase.trim() || undefined,
          monetization: monetization || undefined,
        },
        settings: { category, age, structure, reason: reason.trim() || undefined },
        financials: globalNotLive
          ? { price: parseFloat(priceVal), revenue: 0, expenses: 0 }
          : { price: parseFloat(priceVal), revenue: parseFloat(revenue), expenses: parseFloat(expenses) },
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
      <input ref={bannerInputRef} type="file" accept="image/*" style={{ display: "none" }} onChange={onBannerChange} />
      <input ref={iconInputRef} type="file" accept="image/*" style={{ display: "none" }} onChange={onIconChange} />
      <input ref={screenshotInputRef} type="file" accept="image/*" multiple style={{ display: "none" }} onChange={onScreenshotsChange} />
      {(["ios", "android", "web"] as Platform[]).map((p) => (
        <input
          key={p}
          ref={platformFileInputRefs[p]}
          type="file"
          accept={PLATFORM_META[p].exts.join(",")}
          multiple
          style={{ display: "none" }}
          onChange={(e) => {
            if (e.target.files?.length) addPlatformFiles(p, e.target.files);
            e.target.value = "";
          }}
        />
      ))}
      <input
        ref={globalNotLiveInputRef}
        type="file"
        accept={GLOBAL_NOT_LIVE_EXTS.join(",")}
        multiple
        style={{ display: "none" }}
        onChange={(e) => {
          if (e.target.files?.length) addGlobalNotLiveFiles(e.target.files);
          e.target.value = "";
        }}
      />
      <input
        ref={extraFileInputRef}
        type="file"
        accept={EXTRA_FILE_EXTS.join(",")}
        multiple
        style={{ display: "none" }}
        onChange={(e) => {
          if (e.target.files?.length) addExtraFiles(e.target.files);
          e.target.value = "";
        }}
      />

      {/* Header */}
      <header
        style={{
          position: "sticky", top: 0, zIndex: 10, height: 52, display: "flex", alignItems: "center",
          justifyContent: "space-between", padding: "0 20px", background: "rgba(0,0,0,0.9)",
          backdropFilter: "blur(18px)", WebkitBackdropFilter: "blur(18px)", borderBottom: "1px solid rgba(255,255,255,0.07)",
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
            Siterifty<span style={{ color: "rgba(251,191,36,0.55)" }}>.com</span>
          </div>
        </div>
        <span style={{ fontSize: 11, fontWeight: 800, textTransform: "uppercase", letterSpacing: "0.08em", color: ACCENT }}>
          App Listing
        </span>
      </header>

      <div style={{ maxWidth: 820, margin: "0 auto", padding: "28px 16px 80px" }}>
        <h1 style={{ fontSize: 28, fontWeight: 800, letterSpacing: "-0.02em", marginBottom: 6 }}>
          List an <em style={{ fontStyle: "normal", color: "rgba(251,191,36,0.85)" }}>App</em>
        </h1>
        <p style={{ fontSize: 14, color: "rgba(255,255,255,0.4)", marginBottom: 28 }}>
          Add your app&apos;s details, media, platforms, and price to list it on the marketplace.
        </p>

        {/* Step tabs */}
        <div style={{ display: "flex", gap: 8, margin: "0 0 20px", borderBottom: "1px solid rgba(255,255,255,0.06)", paddingBottom: 12, flexWrap: "wrap" }}>
          {["1. Basics", "2. Media", "3. Platforms", "4. Financials"].map((label, i) => (
            <button
              key={label}
              onClick={() => goToStep(i + 1)}
              style={{
                background: step === i + 1 ? "rgba(251,191,36,0.1)" : "none",
                color: step === i + 1 ? ACCENT : "rgba(255,255,255,0.25)",
                border: "none", fontSize: 13, fontWeight: 700, padding: "8px 14px", borderRadius: 20, cursor: "pointer",
              }}
            >
              {label}
            </button>
          ))}
        </div>

        {step === 1 && (
          <div>
            {errors.basics && <ErrorBox>{errors.basics}</ErrorBox>}
            <Field label="App Name" required error={errors.name}>
              <input type="text" value={name} onChange={(e) => setName(e.target.value)} placeholder="Your app's name" style={inputStyle} />
              <CharCount value={name} min={TITLE_MIN} max={TITLE_MAX} />
            </Field>

            <Field label="Description" required error={errors.desc}>
              <textarea
                value={desc}
                onChange={(e) => setDesc(e.target.value)}
                placeholder="Describe what the app does, its users, and what's included in the sale…"
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

            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12, marginBottom: 16 }}>
              <Field label="Category">
                <select value={category} onChange={(e) => setCategory(e.target.value)} style={inputStyle}>
                  <option value="">Select</option>
                  {CATEGORY_OPTIONS.map((o) => <option key={o} value={o}>{o}</option>)}
                </select>
              </Field>
              <Field label="App Age">
                <select value={age} onChange={(e) => setAge(e.target.value)} style={inputStyle}>
                  <option value="">Select</option>
                  {AGE_OPTIONS.map((o) => <option key={o} value={o}>{o}</option>)}
                </select>
              </Field>
            </div>

            <Field label="Business Structure">
              <select value={structure} onChange={(e) => setStructure(e.target.value)} style={inputStyle}>
                <option value="">Select</option>
                {STRUCTURE_OPTIONS.map((o) => <option key={o} value={o}>{o}</option>)}
              </select>
            </Field>

            <Field label="Reason for selling (optional)">
              <input value={reason} onChange={(e) => setReason(e.target.value)} placeholder="e.g. Moving to a new project, time constraints" style={inputStyle} />
            </Field>

            <NextButton onClick={() => goToStep(2)} />
          </div>
        )}

        {step === 2 && (
          <div>
            <span style={sectionLabelStyle}>
              Banner <span style={{ color: "#f87171" }}>*</span> <span style={{ opacity: 0.5, textTransform: "none", fontWeight: 400 }}>— 16:9, e.g. 1280×720px</span>
            </span>
            <ImageSlot image={banner} label="Upload Banner" landscape onClick={() => bannerInputRef.current?.click()} onRemove={() => setBanner(null)} />
            {errors.banner && <ErrorBox>{errors.banner}</ErrorBox>}

            <div style={{ height: 16 }} />
            <span style={sectionLabelStyle}>
              Icon <span style={{ color: "#f87171" }}>*</span>
            </span>
            <div style={{ width: 120 }}>
              <ImageSlot image={icon} label="Upload Icon" onClick={() => iconInputRef.current?.click()} onRemove={() => setIcon(null)} square />
            </div>
            {errors.icon && <ErrorBox>{errors.icon}</ErrorBox>}

            <div style={{ height: 16 }} />
            <span style={sectionLabelStyle}>
              Screenshots <span style={{ color: "#f87171" }}>*</span> <span style={{ opacity: 0.5, textTransform: "none", fontWeight: 400 }}>— exactly {MAX_SCREENSHOTS}</span>
            </span>
            <div style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: 12 }}>
              {Array.from({ length: MAX_SCREENSHOTS }).map((_, i) => (
                <ImageSlot
                  key={i}
                  image={screenshots[i] || null}
                  label="+ Add"
                  onClick={() => screenshotInputRef.current?.click()}
                  onRemove={() => removeScreenshot(i)}
                />
              ))}
            </div>
            {errors.screenshots && <ErrorBox>{errors.screenshots}</ErrorBox>}

            <div style={{ display: "flex", gap: 10, marginTop: 24 }}>
              <PrevButton onClick={() => setStep(1)} />
              <NextButton onClick={() => goToStep(3)} />
            </div>
          </div>
        )}

        {step === 3 && (
          <div>
            {errors.platforms && <ErrorBox>{errors.platforms}</ErrorBox>}

            <span style={sectionLabelStyle}>Platforms</span>
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 8, marginBottom: 12 }}>
              {(["ios", "android", "web"] as Platform[]).map((p) => (
                <button
                  key={p}
                  onClick={() => togglePlatform(p)}
                  disabled={globalNotLive}
                  style={{
                    ...platformToggleStyle,
                    ...(platforms.has(p) ? activeAmberStyle : {}),
                    opacity: globalNotLive ? 0.35 : 1,
                    cursor: globalNotLive ? "not-allowed" : "pointer",
                  }}
                >
                  {PLATFORM_META[p].label}
                </button>
              ))}
            </div>

            {!globalNotLive && (["ios", "android", "web"] as Platform[]).map((p) =>
              platforms.has(p) ? (
                <div key={p} style={{ marginBottom: 16, padding: 14, background: "rgba(255,255,255,0.03)", borderRadius: 12, border: "1px solid rgba(255,255,255,0.06)" }}>
                  <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 10 }}>
                    <span style={{ fontSize: 13, fontWeight: 700 }}>{PLATFORM_META[p].label}</span>
                    <button onClick={() => togglePlatformNotLive(p)} style={notLiveBtnStyle(notLive[p])}>
                      {notLive[p] ? "Live — switch back" : "Not live yet"}
                    </button>
                  </div>
                  {notLive[p] ? (
                    <div>
                      <div
                        onClick={() => platformFileInputRefs[p].current?.click()}
                        style={{ border: "2px dashed rgba(251,191,36,0.3)", borderRadius: 10, padding: 16, textAlign: "center", cursor: "pointer", fontSize: 12, color: "rgba(255,255,255,0.5)" }}
                      >
                        Click or drag to upload a build ({PLATFORM_META[p].exts.join(", ")})
                      </div>
                      <div style={{ display: "flex", flexWrap: "wrap", gap: 6, marginTop: 8 }}>
                        {platformFiles[p].map((f, i) => (
                          <FileTag key={f.name} name={f.name} onRemove={() => removePlatformFile(p, i)} />
                        ))}
                      </div>
                    </div>
                  ) : (
                    <input
                      type="url"
                      value={platformUrls[p]}
                      onChange={(e) => setPlatformUrl(p, e.target.value)}
                      placeholder={PLATFORM_META[p].urlPlaceholder}
                      style={inputStyle}
                    />
                  )}
                </div>
              ) : null
            )}

            <div
              onClick={toggleGlobalNotLive}
              style={{
                marginBottom: 16, padding: 14, borderRadius: 12, cursor: "pointer",
                background: globalNotLive ? "rgba(251,191,36,0.08)" : "rgba(255,255,255,0.03)",
                border: `1px solid ${globalNotLive ? "rgba(251,191,36,0.35)" : "rgba(255,255,255,0.08)"}`,
              }}
            >
              <div style={{ fontSize: 13, fontWeight: 700, color: globalNotLive ? ACCENT : "#fff" }}>
                {globalNotLive ? "✓ " : ""}App isn&apos;t published anywhere yet
              </div>
              <div style={{ fontSize: 12, opacity: 0.5, marginTop: 4 }}>
                Selecting this clears platform selections and lets buyers preview via an uploaded build instead. Price is still required; revenue/expenses/monetization won&apos;t apply yet.
              </div>
              {globalNotLive && (
                <div style={{ marginTop: 10 }} onClick={(e) => e.stopPropagation()}>
                  <div
                    onClick={() => globalNotLiveInputRef.current?.click()}
                    style={{ border: "2px dashed rgba(251,191,36,0.4)", borderRadius: 10, padding: 16, textAlign: "center", cursor: "pointer", fontSize: 12, color: "rgba(255,255,255,0.5)" }}
                  >
                    Click or drag to upload a build ({GLOBAL_NOT_LIVE_EXTS.join(", ")})
                  </div>
                  <div style={{ display: "flex", flexWrap: "wrap", gap: 6, marginTop: 8 }}>
                    {globalNotLiveFiles.map((f, i) => (
                      <FileTag key={f.name} name={f.name} onRemove={() => removeGlobalNotLiveFile(i)} />
                    ))}
                  </div>
                </div>
              )}
            </div>

            {platforms.has("web") && !notLive.web && !globalNotLive && (
              <Field label="Preview URL (optional)">
                <input type="url" value={previewUrl} onChange={(e) => setPreviewUrl(e.target.value)} placeholder="https://example.com/demo" style={inputStyle} />
              </Field>
            )}

            <Field label="Demo video URL (optional)">
              <input type="url" value={videoUrl} onChange={(e) => setVideoUrl(e.target.value)} placeholder="https://youtube.com/watch?v=..." style={inputStyle} />
            </Field>

            <span style={sectionLabelStyle}>Additional files (optional)</span>
            <div
              onClick={() => extraFileInputRef.current?.click()}
              style={{ border: "2px dashed rgba(255,255,255,0.15)", borderRadius: 12, padding: 16, textAlign: "center", cursor: "pointer", fontSize: 12, color: "rgba(255,255,255,0.5)", marginBottom: 8 }}
            >
              Click or drag extra files ({EXTRA_FILE_EXTS.join(", ")})
            </div>
            <div style={{ display: "flex", flexWrap: "wrap", gap: 6, marginBottom: 20 }}>
              {extraFiles.map((f, i) => (
                <FileTag key={f.name} name={f.name} onRemove={() => removeExtraFile(i)} />
              ))}
            </div>

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
                    display: "flex", alignItems: "center", gap: 8, padding: "10px 12px",
                    background: transferMethods.includes(m.value) ? "rgba(251,191,36,0.08)" : "rgba(255,255,255,0.03)",
                    border: `1px solid ${transferMethods.includes(m.value) ? "rgba(251,191,36,0.3)" : "rgba(255,255,255,0.08)"}`,
                    borderRadius: 10, cursor: "pointer", fontSize: 13,
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
              <PrevButton onClick={() => setStep(2)} />
              <NextButton onClick={() => goToStep(4)} />
            </div>
          </div>
        )}

        {step === 4 && (
          <div>
            {errors.fin && <ErrorBox>{errors.fin}</ErrorBox>}

            <Field label="Asking Price ($)" required>
              <input type="number" min="0" value={price} onChange={(e) => setPrice(e.target.value)} placeholder="1000" style={inputStyle} />
            </Field>

            {globalNotLive && (
              <div style={{ padding: 12, background: "rgba(251,191,36,0.06)", border: "1px solid rgba(251,191,36,0.2)", borderRadius: 10, marginBottom: 16, fontSize: 12, color: ACCENT }}>
                This app is marked &quot;Not Live&quot; — revenue, expenses, and monetization model aren&apos;t applicable yet and are disabled. Price is still required.
              </div>
            )}

            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12, marginBottom: 16, opacity: globalNotLive ? 0.4 : 1 }}>
              <Field label="Monthly Revenue ($)">
                <input type="number" min="0" value={revenue} onChange={(e) => setRevenue(e.target.value)} placeholder="200" disabled={globalNotLive} style={inputStyle} />
              </Field>
              <Field label="Monthly Expenses ($)">
                <input type="number" min="0" value={expenses} onChange={(e) => setExpenses(e.target.value)} placeholder="20" disabled={globalNotLive} style={inputStyle} />
              </Field>
            </div>

            <div style={{ opacity: globalNotLive ? 0.4 : 1, marginBottom: 16 }}>
              <Field label="Monetization Model">
                <select value={monetization} onChange={(e) => setMonetization(e.target.value)} disabled={globalNotLive} style={inputStyle}>
                  <option value="">Select</option>
                  {MONETIZATION_OPTIONS.map((o) => <option key={o} value={o}>{o}</option>)}
                </select>
              </Field>
              {monetization === "Subscription" && !globalNotLive && (
                <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12, marginTop: 12 }}>
                  <Field label="Sub. Price — Monthly ($)">
                    <input type="number" min="0" value={subMonthly} onChange={(e) => setSubMonthly(e.target.value)} placeholder="9.99" style={inputStyle} />
                  </Field>
                  <Field label="Sub. Price — Annual ($)">
                    <input type="number" min="0" value={subAnnual} onChange={(e) => setSubAnnual(e.target.value)} placeholder="99" style={inputStyle} />
                  </Field>
                </div>
              )}
            </div>

            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 12, marginBottom: 16 }}>
              <Field label="Frontend (optional)">
                <input value={techFrontend} onChange={(e) => setTechFrontend(e.target.value)} placeholder="React Native" style={inputStyle} />
              </Field>
              <Field label="Backend (optional)">
                <input value={techBackend} onChange={(e) => setTechBackend(e.target.value)} placeholder="Node.js" style={inputStyle} />
              </Field>
              <Field label="Database (optional)">
                <input value={techDatabase} onChange={(e) => setTechDatabase(e.target.value)} placeholder="Firestore" style={inputStyle} />
              </Field>
            </div>

            {!globalNotLive && (
              <div style={{ padding: 16, background: "rgba(255,255,255,0.03)", borderRadius: 12, marginBottom: 24, display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                <span style={{ fontSize: 13, color: "rgba(255,255,255,0.5)", fontWeight: 600 }}>Monthly Profit</span>
                <span style={{ fontSize: 20, fontWeight: 800, color: profit >= 0 ? ACCENT : "#f87171" }}>
                  {profit >= 0 ? "+" : ""}${profit.toFixed(2)}
                </span>
              </div>
            )}

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
              <div style={{ padding: 14, background: "rgba(251,191,36,0.1)", border: "1px solid rgba(251,191,36,0.3)", borderRadius: 10, color: ACCENT, fontWeight: 700, marginBottom: 16, textAlign: "center" }}>
                ✓ Published! Redirecting to the marketplace…
              </div>
            )}

            <div style={{ display: "flex", gap: 10 }}>
              <PrevButton onClick={() => setStep(3)} disabled={submitting} />
              <button onClick={handleSubmit} disabled={submitting || success} style={{ ...nextBtnStyle, opacity: submitting || success ? 0.6 : 1 }}>
                {submitting ? "Publishing…" : "Publish Listing"}
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

// ── Shared subcomponents ──

function ImageSlot({
  image,
  label,
  landscape,
  square,
  onClick,
  onRemove,
}: {
  image: SlotImage | null;
  label: string;
  landscape?: boolean;
  square?: boolean;
  onClick: () => void;
  onRemove: () => void;
}) {
  return (
    <div
      onClick={image ? undefined : onClick}
      style={{
        height: landscape ? 140 : square ? 120 : 110,
        background: "rgba(255,255,255,0.03)",
        border: `2px dashed ${image ? "transparent" : "rgba(255,255,255,0.15)"}`,
        borderRadius: 14,
        display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center",
        cursor: image ? "default" : "pointer", position: "relative", overflow: "hidden",
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
            style={{ position: "absolute", top: 6, right: 6, width: 24, height: 24, borderRadius: "50%", background: "rgba(0,0,0,0.7)", color: "#fff", border: "none", cursor: "pointer", fontSize: 12 }}
          >
            ✕
          </button>
        </>
      ) : (
        <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 6, color: "rgba(255,255,255,0.25)", fontSize: 12, fontWeight: 500, textAlign: "center", padding: 8 }}>
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.6} style={{ width: 26, height: 26, opacity: 0.5 }}>
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

function FileTag({ name, onRemove }: { name: string; onRemove: () => void }) {
  return (
    <span style={fileTagStyle}>
      {name}
      <button type="button" onClick={onRemove} style={{ background: "none", border: "none", color: "inherit", cursor: "pointer", fontSize: 12, lineHeight: 1, padding: 0 }}>
        ✕
      </button>
    </span>
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
    <div style={{ marginTop: 8, padding: "10px 14px", background: "rgba(239,68,68,0.1)", border: "1px solid rgba(239,68,68,0.25)", borderRadius: 8, color: "#fca5a5", fontSize: 13, fontWeight: 600 }}>
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
  background: "rgba(255,255,255,0.06)", border: "1px solid rgba(255,255,255,0.1)", color: "rgba(255,255,255,0.7)",
  padding: "7px 14px", borderRadius: 8, fontSize: 12, fontWeight: 600, cursor: "pointer", display: "flex", alignItems: "center", gap: 6,
};
const activeAmberStyle: React.CSSProperties = {
  background: "rgba(251,191,36,0.12)", color: ACCENT, boxShadow: "0 0 0 1px rgba(251,191,36,0.2)",
};
const platformToggleStyle: React.CSSProperties = {
  padding: "12px 10px", border: "1px solid rgba(255,255,255,0.08)", background: "rgba(255,255,255,0.03)",
  borderRadius: 10, fontSize: 13, fontWeight: 700, color: "rgba(255,255,255,0.5)", cursor: "pointer",
};
function notLiveBtnStyle(active: boolean): React.CSSProperties {
  return {
    padding: "5px 10px", fontSize: 11, fontWeight: 700, borderRadius: 8, cursor: "pointer",
    background: active ? "rgba(251,191,36,0.15)" : "rgba(255,255,255,0.05)",
    color: active ? ACCENT : "rgba(255,255,255,0.4)",
    border: `1px solid ${active ? "rgba(251,191,36,0.3)" : "rgba(255,255,255,0.1)"}`,
  };
}
const sectionLabelStyle: React.CSSProperties = {
  display: "block", fontSize: 12, fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.06em", color: "rgba(255,255,255,0.5)", marginBottom: 10,
};
const fieldLabelStyle: React.CSSProperties = {
  display: "block", fontSize: 12, fontWeight: 700, color: "rgba(255,255,255,0.5)", marginBottom: 6, textTransform: "uppercase", letterSpacing: "0.04em",
};
const inputStyle: React.CSSProperties = {
  width: "100%", height: 44, padding: "0 14px", background: "#09090b", border: "1px solid #3f3f46",
  borderRadius: 8, fontSize: 14, color: "#fff", outline: "none", fontFamily: "inherit", boxSizing: "border-box",
};
const fileTagStyle: React.CSSProperties = {
  display: "inline-flex", alignItems: "center", gap: 6, background: "rgba(255,255,255,0.06)", border: "1px solid rgba(255,255,255,0.12)",
  borderRadius: 8, padding: "5px 10px", fontSize: 11.5, color: "rgba(255,255,255,0.75)",
};
const nextBtnStyle: React.CSSProperties = {
  flex: 1, height: 48, background: ACCENT, color: "#09090b", border: "none", borderRadius: 10,
  fontSize: 14, fontWeight: 800, cursor: "pointer", textTransform: "uppercase", letterSpacing: "0.04em",
};
const prevBtnStyle: React.CSSProperties = {
  height: 48, padding: "0 24px", background: "rgba(255,255,255,0.06)", color: "rgba(255,255,255,0.7)",
  border: "1px solid rgba(255,255,255,0.1)", borderRadius: 10, fontSize: 14, fontWeight: 700, cursor: "pointer",
};
