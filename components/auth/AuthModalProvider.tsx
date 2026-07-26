"use client";

import { createContext, useContext, useState, type ReactNode } from "react";
import { useRouter } from "next/navigation";
import AuthModal from "@/components/auth/AuthModal";

interface AuthModalContextValue {
  openAuthModal: () => void;
}

const AuthModalContext = createContext<AuthModalContextValue>({
  openAuthModal: () => {},
});

export function useAuthModal() {
  return useContext(AuthModalContext);
}

export function AuthModalProvider({ children }: { children: ReactNode }) {
  const [open, setOpen] = useState(false);
  const router = useRouter();

  return (
    <AuthModalContext.Provider value={{ openAuthModal: () => setOpen(true) }}>
      {children}
      <AuthModal
        open={open}
        onClose={() => setOpen(false)}
        onSignupComplete={(username) => {
          // Onboarding now lives at its own /onboarding route instead of
          // opening as a modal over the current page. Same 300ms delay
          // after the auth modal closes as before.
          setTimeout(() => {
            setOpen(false);
            router.push(`/onboarding?username=${encodeURIComponent(username)}`);
          }, 300);
        }}
      />
    </AuthModalContext.Provider>
  );
}
