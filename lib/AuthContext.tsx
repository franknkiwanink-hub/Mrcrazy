"use client";

import {
  createContext,
  useContext,
  useEffect,
  useState,
  type ReactNode,
} from "react";
import { onAuthStateChanged, type User as FirebaseUser } from "firebase/auth";
import { doc, getDoc, onSnapshot } from "firebase/firestore";
import { auth, db } from "@/lib/firebase";

// Fields we read from users/{uid} in Firestore. Only the subset the UI
// currently needs (Header pill, nav drawer account card) — more fields
// (banned status, admin flag, etc.) can be added here in a later step
// without touching any consumer of this context.
export interface UserProfile {
  username: string;
  profilePic: string | null;
  walletBalance: number;
  plan: string;
  currency: string | null;
}

interface AuthContextValue {
  // `undefined` = we don't know yet (initial load).
  // `null` = we checked, nobody is signed in.
  // FirebaseUser = signed in.
  user: FirebaseUser | null | undefined;
  profile: UserProfile | null;
  loading: boolean;
}

const AuthContext = createContext<AuthContextValue>({
  user: undefined,
  profile: null,
  loading: true,
});

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<FirebaseUser | null | undefined>(undefined);
  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const unsub = onAuthStateChanged(auth, (firebaseUser) => {
      setUser(firebaseUser);
      setLoading(false);
    });
    return () => unsub();
  }, []);

  useEffect(() => {
    if (!user) {
      setProfile(null);
      return;
    }
    const ref = doc(db, "users", user.uid);
    const unsub = onSnapshot(
      ref,
      (snap) => {
        if (!snap.exists()) {
          setProfile(null);
          return;
        }
        const data = snap.data();
        setProfile({
          username: data.username || user.displayName || user.email?.split("@")[0] || "User",
          profilePic: data.profilePic || null,
          walletBalance: Number(data.walletBalance || 0),
          plan: data.plan || "free",
          currency: data.currency || null,
        });
      },
      (err) => {
        console.error("[AuthContext] profile listener error:", err);
      }
    );
    return () => unsub();
  }, [user]);

  return (
    <AuthContext.Provider value={{ user, profile, loading }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  return useContext(AuthContext);
}

// One-time profile fetch, for places that need a value without subscribing
// (e.g. right after signup, before the listener above has necessarily fired).
export async function fetchUserProfileOnce(uid: string): Promise<UserProfile | null> {
  const snap = await getDoc(doc(db, "users", uid));
  if (!snap.exists()) return null;
  const data = snap.data();
  return {
    username: data.username || "User",
    profilePic: data.profilePic || null,
    walletBalance: Number(data.walletBalance || 0),
    plan: data.plan || "free",
    currency: data.currency || null,
  };
}