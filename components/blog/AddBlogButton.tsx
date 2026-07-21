"use client";

// Admin-only "add post" control for /blog. The button itself only
// renders for the admin account (see useIsAdmin) — that's a UI nicety,
// not the security boundary; every write is independently re-verified
// server-side in app/api/blog/route.ts. A signed-out or non-admin
// visitor never sees this button at all.
import { useRef, useState } from "react";
import { createPortal } from "react-dom";
import { useRouter } from "next/navigation";
import { useAuth } from "@/lib/AuthContext";
import { useIsAdmin } from "@/lib/useIsAdmin";
import { createBlogPost } from "@/lib/blog";

async function uploadCoverImage(file: File, idToken: string): Promise<string> {
  const base64 = await new Promise<string>((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve((reader.result as string).split(",")[1]);
    reader.onerror = () => reject(new Error("Image read failed"));
    reader.readAsDataURL(file);
  });
  const res = await fetch("/api/storage", {
    method: "POST",
    headers: { "Content-Type": "application/json", Authorization: `Bearer ${idToken}` },
    body: JSON.stringify({ filename: file.name, content: base64, encoding: "base64" }),
  });
  const json = await res.json();
  if (!res.ok) throw new Error(json.error || "Image upload failed");
  return json.url;
}

export default function AddBlogButton() {
  const { user } = useAuth();
  const isAdmin = useIsAdmin();
  const [open, setOpen] = useState(false);

  if (!isAdmin || !user) return null;

  return (
    <>
      <button
        type="button"
        className="sr-blog-add-btn"
        aria-label="Add blog post"
        onClick={() => setOpen(true)}
      >
        <svg width={22} height={22} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2.4} strokeLinecap="round">
          <line x1={12} y1={5} x2={12} y2={19} />
          <line x1={5} y1={12} x2={19} y2={12} />
        </svg>
      </button>
      {open && <AddBlogModal onClose={() => setOpen(false)} />}
    </>
  );
}

function AddBlogModal({ onClose }: { onClose: () => void }) {
  const router = useRouter();
  const { user } = useAuth();
  const fileInputRef = useRef<HTMLInputElement>(null);

  const [imageFile, setImageFile] = useState<File | null>(null);
  const [imagePreview, setImagePreview] = useState<string | null>(null);
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  function handleFile(file: File | null) {
    setImageFile(file);
    setImagePreview(file ? URL.createObjectURL(file) : null);
  }

  async function handleSubmit() {
    if (!user) return;
    if (!imageFile) return setError("Add a cover image");
    if (!title.trim()) return setError("Add a title");
    if (!description.trim()) return setError("Add a description");

    setSubmitting(true);
    setError(null);
    try {
      const idToken = await user.getIdToken();
      const coverImage = await uploadCoverImage(imageFile, idToken);
      const post = await createBlogPost(idToken, {
        title: title.trim(),
        description: description.trim(),
        coverImage,
      });
      onClose();
      router.refresh();
      router.push(`/blog/${post.id}`);
    } catch (err: any) {
      setError(err.message || "Something went wrong");
    } finally {
      setSubmitting(false);
    }
  }

  return createPortal(
    <div
      role="dialog"
      aria-modal="true"
      aria-label="Add blog post"
      className="sr-blog-modal-backdrop"
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div className="sr-blog-modal">
        <div className="sr-blog-modal-head">
          <h2>New post</h2>
          <button type="button" aria-label="Close" className="sr-blog-modal-close" onClick={onClose}>
            <svg width={16} height={16} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2.4}>
              <line x1={18} y1={6} x2={6} y2={18} />
              <line x1={6} y1={6} x2={18} y2={18} />
            </svg>
          </button>
        </div>

        <button
          type="button"
          className="sr-blog-modal-dropzone"
          onClick={() => fileInputRef.current?.click()}
          style={imagePreview ? { backgroundImage: `url(${imagePreview})` } : undefined}
        >
          {!imagePreview && (
            <span>
              <svg width={26} height={26} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2}>
                <rect x={3} y={3} width={18} height={18} rx={2} />
                <circle cx={9} cy={9} r={2} />
                <path d="M21 15l-5-5L5 21" />
              </svg>
              Upload cover image (16:9)
            </span>
          )}
        </button>
        <input
          ref={fileInputRef}
          type="file"
          accept="image/*"
          hidden
          onChange={(e) => handleFile(e.target.files?.[0] || null)}
        />

        <input
          className="sr-blog-modal-input"
          placeholder="Title"
          maxLength={140}
          value={title}
          onChange={(e) => setTitle(e.target.value)}
        />
        <textarea
          className="sr-blog-modal-textarea"
          placeholder="Write your post…"
          rows={8}
          value={description}
          onChange={(e) => setDescription(e.target.value)}
        />

        {error && <div className="sr-blog-modal-error">{error}</div>}

        <button type="button" className="sr-blog-modal-submit" disabled={submitting} onClick={handleSubmit}>
          {submitting ? "Publishing…" : "Publish"}
        </button>
      </div>
    </div>,
    document.body
  );
}
