"use client";

import { createContext, useContext, useState, type ReactNode } from "react";
import AuthModal from "@/components/auth/AuthModal";
import OnboardingWizard from "@/components/onboarding/OnboardingWizard";
import { useThemeModal } from "@/components/theme/ThemeModalProvider";

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
  const { openThemePicker } = useThemeModal();

  const [wizardOpen, setWizardOpen] = useState(false);
  const [wizardUsername, setWizardUsername] = useState("");

  return (
    <AuthModalContext.Provider value={{ openAuthModal: () => setOpen(true) }}>
      {children}
      <AuthModal
        open={open}
        onClose={() => setOpen(false)}
        onSignupComplete={(username) => {
          // Same 300ms delay after the auth modal closes as the original
          // tour used, now opening OnboardingWizard instead of TourModal
          // at this same signup call site.
          setTimeout(() => {
            setWizardUsername(username);
            setWizardOpen(true);
          }, 300);
        }}
      />
      <OnboardingWizard
        open={wizardOpen}
        username={wizardUsername}
        onFinish={() => {
          // Same as the old tour's last-step behavior: close, then open
          // the theme picker.
          setWizardOpen(false);
          openThemePicker();
        }}
      />
    </AuthModalContext.Provider>
  );
}
