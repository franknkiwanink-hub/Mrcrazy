// POST /api/blog — the only way blog posts get written.
//
// New plumbing (not a legacy port — see lib/server/adminDb.ts's header
// comment for why new server-only code lives outside app/api/_lib's
// byte-for-byte-port files). Deliberately its own route rather than a
// new action bolted onto account/_handler.js's six-action file, since
// that file's whole point is staying untouched.
//
// SECURITY: this is the actual access-control boundary for "who can
// publish to the blog" — not the "+" button's visibility in the UI.
// The client only ever *shows or hides* the add-post button (see
// components/blog/AddBlogButton.tsx); a hidden button is not a security
// control, since any client-side check can be bypassed by whoever's
// driving the browser. Every write request's Firebase ID token is
// independently re-verified here against ADMIN_EMAIL, exactly mirroring
// actionAmIAdmin in app/api/account/_handler.js — same trust model,
// same env var, so there's exactly one definition of "who is admin"
// across the app.
import { getApps, initializeApp, cert } from "firebase-admin/app";
import { getAuth } from "firebase-admin/auth";
import { getAdminDb } from "@/lib/server/adminDb";
import { FieldValue } from "firebase-admin/firestore";

function ensureFirebaseApp() {
  if (!getApps().length) {
    initializeApp({
      credential: cert({
        projectId: process.env.FIREBASE_PROJECT_ID,
        clientEmail: process.env.FIREBASE_CLIENT_EMAIL,
        privateKey: (process.env.FIREBASE_PRIVATE_KEY || "").replace(/\\n/g, "\n"),
      }),
    });
  }
}

async function verifyAdmin(authHeader: string | null): Promise<string | null> {
  const adminEmail = process.env.ADMIN_EMAIL;
  if (!adminEmail || !authHeader?.startsWith("Bearer ")) return null;
  const idToken = authHeader.slice(7);
  try {
    ensureFirebaseApp();
    const decoded = await getAuth().verifyIdToken(idToken);
    const email = (decoded.email || "").trim().toLowerCase();
    if (email && email === adminEmail.trim().toLowerCase() && decoded.email_verified !== false) {
      return decoded.uid;
    }
    return null;
  } catch {
    return null;
  }
}

export async function POST(request: Request) {
  const uid = await verifyAdmin(request.headers.get("authorization"));
  if (!uid) {
    return Response.json({ error: "Admin sign-in required" }, { status: 403 });
  }

  const body = await request.json().catch(() => ({}));
  const title = String(body.title || "").trim();
  const description = String(body.description || "").trim();
  const coverImage = String(body.coverImage || "").trim();

  if (!title || title.length > 140) {
    return Response.json({ error: "Title is required (max 140 characters)" }, { status: 400 });
  }
  if (!description || description.length > 20000) {
    return Response.json({ error: "Description is required" }, { status: 400 });
  }
  if (!coverImage) {
    return Response.json({ error: "Cover image is required" }, { status: 400 });
  }

  const db = getAdminDb();
  const docRef = await db.collection("blogPosts").add({
    title,
    description,
    coverImage,
    authorUid: uid,
    createdAt: FieldValue.serverTimestamp(),
  });

  const saved = await docRef.get();
  const data = saved.data();

  return Response.json({
    post: {
      id: docRef.id,
      title,
      description,
      coverImage,
      authorUid: uid,
      createdAt: data?.createdAt ? data.createdAt.toDate().toISOString() : new Date().toISOString(),
    },
  });
}
