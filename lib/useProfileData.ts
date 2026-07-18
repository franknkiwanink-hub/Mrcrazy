"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import {
  doc,
  getDoc,
  updateDoc,
  deleteDoc,
  increment,
  arrayUnion,
  serverTimestamp,
  collection,
  query,
  where,
  orderBy,
  onSnapshot,
  getDocs,
} from "firebase/firestore";
import { auth, db } from "@/lib/firebase";

// Ports profile.js's pmRender + pmLoadListings + pmLoadFavorites +
// ibxStartUnreadListener into a single hook backing the /myprofile page.
// AuthContext's UserProfile is intentionally the small subset the header
// pill/nav drawer need — this hook reads the fuller users/{uid} doc
// directly (same fields fetchFullSeller reads for the public seller page)
// since the profile hub itself needs bio/contactEmail/github/showBio/etc,
// none of which belong on the shared header-facing shape.

export interface ProfileData {
  username: string;
  contactEmail: string;
  plan: string;
  profilePic: string | null;
  followerCount: number;
  dealsCompleted: number;
  bio: string;
  showBio: boolean;
  showEmail: boolean;
  githubUsername: string | null;
}

export interface ProfileListing {
  id: string;
  title?: string;
  description?: string;
  images?: string[];
  status?: string;
}

export interface FavoriteListing {
  id: string; // savedListings doc id
  listingId: string;
  title?: string;
  type?: string;
  image?: string;
  price?: number;
}

const EMPTY_PROFILE: ProfileData = {
  username: "",
  contactEmail: "",
  plan: "free",
  profilePic: null,
  followerCount: 0,
  dealsCompleted: 0,
  bio: "",
  showBio: true,
  showEmail: false,
  githubUsername: null,
};

export function useProfileData() {
  const [uid, setUid] = useState<string | null | undefined>(undefined);
  const [profile, setProfile] = useState<ProfileData>(EMPTY_PROFILE);
  const [profileLoading, setProfileLoading] = useState(true);
  const [profileError, setProfileError] = useState<string | null>(null);

  const [listings, setListings] = useState<ProfileListing[]>([]);
  const [listingsLoading, setListingsLoading] = useState(true);
  const [listingsError, setListingsError] = useState<string | null>(null);

  const [favorites, setFavorites] = useState<FavoriteListing[]>([]);
  const [favoritesLoading, setFavoritesLoading] = useState(true);
  const [favoritesError, setFavoritesError] = useState<string | null>(null);

  const [unreadDeals, setUnreadDeals] = useState(0);

  const mountedRef = useRef(true);
  useEffect(() => {
    mountedRef.current = true;
    return () => {
      mountedRef.current = false;
    };
  }, []);

  // Auth wiring — mirrors AuthContext but kept local so this hook is
  // self-contained and can re-fetch on demand (Save changes re-reads).
  useEffect(() => {
    const unsub = auth.onAuthStateChanged((user) => {
      setUid(user ? user.uid : null);
    });
    return () => unsub();
  }, []);

  const loadProfile = useCallback(async (userId: string) => {
    setProfileLoading(true);
    setProfileError(null);
    try {
      const snap = await getDoc(doc(db, "users", userId));
      if (!snap.exists()) {
        setProfileError("Could not load your profile — please try again.");
        return;
      }
      const d: any = snap.data();
      if (!mountedRef.current) return;
      setProfile({
        username: d.username || d.displayName || auth.currentUser?.email?.split("@")[0] || "User",
        contactEmail: d.contactEmail || "",
        plan: d.plan || "free",
        profilePic: d.profilePic || null,
        followerCount: typeof d.followerCount === "number" ? d.followerCount : 0,
        dealsCompleted: typeof d.dealsCompleted === "number" ? d.dealsCompleted : 0,
        bio: d.bio || "",
        showBio: d.showBio !== false,
        showEmail: d.showEmail === true,
        githubUsername: d.githubUsername || null,
      });
    } catch (err) {
      console.error("[useProfileData] loadProfile failed", err);
      setProfileError("Could not load your profile — please try again.");
    } finally {
      if (mountedRef.current) setProfileLoading(false);
    }
  }, []);

  const loadListings = useCallback(async (userId: string) => {
    setListingsLoading(true);
    setListingsError(null);
    try {
      const q = query(collection(db, "listings"), where("ownerId", "==", userId));
      const qs = await getDocs(q);
      if (!mountedRef.current) return;
      setListings(qs.docs.map((d) => ({ id: d.id, ...(d.data() as any) })));
    } catch (err) {
      console.error("[useProfileData] loadListings failed", err);
      setListingsError("Could not load your listings.");
    } finally {
      if (mountedRef.current) setListingsLoading(false);
    }
  }, []);

  const loadFavorites = useCallback(async (userId: string) => {
    setFavoritesLoading(true);
    setFavoritesError(null);
    try {
      const q = query(collection(db, "users", userId, "savedListings"), orderBy("savedAt", "desc"));
      const qs = await getDocs(q);
      if (!mountedRef.current) return;
      setFavorites(
        qs.docs.map((d) => {
          const f: any = d.data();
          return {
            id: d.id,
            listingId: f.listingId || d.id,
            title: f.title,
            type: ["website", "app", "game"].includes(f.type) ? f.type : "website",
            image: f.image,
            price: typeof f.price === "number" ? f.price : undefined,
          };
        })
      );
    } catch (err) {
      console.error("[useProfileData] loadFavorites failed", err);
      setFavoritesError("Could not load favorites.");
    } finally {
      if (mountedRef.current) setFavoritesLoading(false);
    }
  }, []);

  // Kick off all three loads once we know who's signed in.
  useEffect(() => {
    if (!uid) {
      setProfileLoading(uid === undefined);
      return;
    }
    loadProfile(uid);
    loadListings(uid);
    loadFavorites(uid);
  }, [uid, loadProfile, loadListings, loadFavorites]);

  // Live unread-deals badge — ports ibxStartUnreadListener.
  useEffect(() => {
    if (!uid) {
      setUnreadDeals(0);
      return;
    }
    const dealsQ = query(collection(db, "users", uid, "deals"), where("read", "==", false));
    const unsub = onSnapshot(
      dealsQ,
      (snap) => setUnreadDeals(snap.size),
      () => setUnreadDeals(0)
    );
    return () => unsub();
  }, [uid]);

  // ── Mutations ──────────────────────────────────────────────────────

  async function saveAccount(newUsername: string, newContactEmail: string) {
    const user = auth.currentUser;
    if (!user) throw new Error("Not signed in.");

    const usernameChanged = newUsername !== profile.username;
    const emailChanged = newContactEmail !== profile.contactEmail;
    if (!usernameChanged && !emailChanged) return;

    const updates: Record<string, unknown> = {};
    if (usernameChanged) {
      const lower = newUsername.toLowerCase().replace(/\s+/g, "_");
      const taken = await getDocs(query(collection(db, "users"), where("usernameLower", "==", lower)));
      const takenByOther = !taken.empty && !(taken.docs.length === 1 && taken.docs[0].id === user.uid);
      if (takenByOther) throw new Error("That username is already taken. Please choose another.");
      updates.username = newUsername;
      updates.displayName = newUsername;
      updates.usernameLower = lower;
      updates.usernameChangedAt = serverTimestamp();
    }
    if (emailChanged) {
      updates.contactEmail = newContactEmail;
      updates.contactEmailChanges = arrayUnion(Date.now());
    }

    await updateDoc(doc(db, "users", user.uid), updates);
    await loadProfile(user.uid);
  }

  async function savePublicProfile(bio: string, showBio: boolean, showEmail: boolean) {
    const user = auth.currentUser;
    if (!user) throw new Error("Not signed in.");
    await updateDoc(doc(db, "users", user.uid), {
      bio,
      showBio,
      showEmail,
      updatedAt: serverTimestamp(),
      profileUpdatedAt: serverTimestamp(),
    });
    setProfile((prev) => ({ ...prev, bio, showBio, showEmail }));
  }

  async function uploadAvatar(file: File): Promise<string> {
    const user = auth.currentUser;
    if (!user) throw new Error("Not signed in.");

    // Server is the source of truth for the cooldown — always ask before
    // uploading anything (mirrors the original's pmWireAvatarUpload, and
    // the same check-username-change/check-email-change pattern used
    // elsewhere in this file). /api/limits previously had no route at all
    // for this — now wired, see app/api/_lib/limits.js's
    // handleCheckProfilePic.
    const idToken = await user.getIdToken();
    const checkRes = await fetch("/api/limits", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action: "check-profilepic-change", idToken }),
    });
    const checkJson = await checkRes.json().catch(() => ({}));
    if (!checkRes.ok) {
      throw new Error(checkJson.error || "Couldn't check your profile picture cooldown — try again.");
    }
    if (!checkJson.allowed) {
      const d = checkJson.daysLeft;
      throw new Error(`You can change your profile picture again in ${d} day${d !== 1 ? "s" : ""}.`);
    }

    const fd = new FormData();
    fd.append("image", file);
    const res = await fetch("https://api.imgur.com/3/image", {
      method: "POST",
      headers: { Authorization: "Client-ID 891e5bb4aa94282" },
      body: fd,
    });
    const json = await res.json();
    if (!json.success) throw new Error(json.data?.error || "Imgur upload failed");
    const url = json.data.link as string;
    await updateDoc(doc(db, "users", user.uid), {
      profilePic: url,
      profilePicChangedAt: serverTimestamp(),
      updatedAt: serverTimestamp(),
    });
    setProfile((prev) => ({ ...prev, profilePic: url }));
    return url;
  }

  async function deleteListing(listingId: string) {
    const user = auth.currentUser;
    if (!user) throw new Error("You must be logged in.");
    const idToken = await user.getIdToken();
    const resp = await fetch("/api/listings", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action: "listing.delete", idToken, listingId }),
    });
    const out = await resp.json().catch(() => ({}));
    if (!resp.ok || !out.ok) throw new Error(out.error?.message || "Delete failed");
    setListings((prev) => prev.filter((l) => l.id !== listingId));
  }

  async function removeFavorite(listingId: string) {
    const user = auth.currentUser;
    if (!user) return;
    await deleteDoc(doc(db, "users", user.uid, "savedListings", listingId));
    try {
      await updateDoc(doc(db, "listings", listingId), { saves: increment(-1) });
    } catch {
      // Listing may already be gone — fine to swallow, same as the original.
    }
    setFavorites((prev) => prev.filter((f) => f.listingId !== listingId));
  }

  async function cancelPlan() {
    const user = auth.currentUser;
    if (!user) throw new Error("Not signed in.");
    const idToken = await user.getIdToken();
    const r = await fetch("/api/paypal", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action: "cancel-sub", idToken }),
    });
    const data = await r.json();
    if (!r.ok) throw new Error(data.error || "Cancellation failed");
    setProfile((prev) => ({ ...prev, plan: "free" }));
  }

  return {
    uid,
    profile,
    profileLoading,
    profileError,
    listings,
    listingsLoading,
    listingsError,
    favorites,
    favoritesLoading,
    favoritesError,
    unreadDeals,
    saveAccount,
    savePublicProfile,
    uploadAvatar,
    deleteListing,
    removeFavorite,
    cancelPlan,
    refreshListings: () => uid && loadListings(uid),
  };
}
