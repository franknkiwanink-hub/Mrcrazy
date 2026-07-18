"use client";

import { createContext, useContext, useState, type ReactNode } from "react";
import PlansModal from "@/components/billing/PlansModal";
import { useAuth } from "@/lib/AuthContext";
import { useAuthModal } from "@/components/auth/AuthModalProvider";

// Ports window.__openPlansModal / window.__closePlansModal from
// plans-boost.js. Original wired 5 different trigger points via
// document-level delegation (nav pill, announcement bar, remove-ads
// buttons, billing panel data-paypal-plan buttons, public pricing cards)
// — in React each of those just imports useNavDrawer()... equivalent:
// useAuthModal()-style useContext hook and calls openPlansModal(plan?)
// directly, so no delegation layer is needed.
type PlanKey = "starter" | "growth" | "pro";

interface PlansModalContextValue {
  openPlansModal: (preselect?: PlanKey) => void;
}

const PlansModalContext = createContext<PlansModalContextValue>({
  openPlansModal: () => {},
});

export function usePlansModal() {
  return useContext(PlansModalContext);
}

export function PlansModalProvider({ children }: { children: ReactNode }) {
  const { user, profile } = useAuth();
  const { openAuthModal } = useAuthModal();
  const [open, setOpen] = useState(false);
  const [preselect, setPreselect] = useState<PlanKey | undefined>(undefined);

  function openPlansModal(plan?: PlanKey) {
    if (!user) {
      openAuthModal();
      return;
    }
    setPreselect(plan);
    setOpen(true);
  }

  return (
    <PlansModalContext.Provider value={{ openPlansModal }}>
      {children}
      <PlansModal
        open={open}
        preselect={preselect}
        onClose={() => setOpen(false)}
        onSubscribed={() => {
          // Ports the original's window.__fbUserData.plan write +
          // 'srf:plan-changed' event — here the Firestore doc itself is
          // updated server-side by activate-sub, and AuthContext's
          // onSnapshot listener on users/{uid} already picks that up
          // live, so no local plan mutation is needed. Just leave the
          // modal open on its "current plan" banner state so the user
          // sees the confirmation, same as the original leaving the
          // footer showing the success message in place.
        }}
      />
    </PlansModalContext.Provider>
  );
}
