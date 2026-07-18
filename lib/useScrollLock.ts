"use client";

import { useEffect } from "react";

// Shared scroll lock for every modal/overlay in the app. Replaces the
// copy-pasted "save body.style.overflow, set to hidden, restore on
// unmount" effect that used to be duplicated (slightly differently) in
// EditListingModal, BoostModal, AuthModal, TransferDealModal,
// AiSupportChatPanel, SearchOverlay, NavDrawerProvider, and
// LogoutModalProvider — and was missing entirely from every other
// modal/overlay (Wallet, Agent, Plans, Theme, DisputePicker, the seller
// overlays, dashboard/onboarding/system overlays, etc.), which is what let
// the page underneath keep scrolling while one of those was open.
//
// Reference-counted via a module-level counter rather than a plain
// boolean: several of these can legitimately be open at once (e.g.
// AuthModal's sign-in tour opening ThemeModal, or EditListingModal opening
// while MyProfileHub/WalletModal is already up). With a plain boolean,
// closing the second-opened modal would restore scroll while the first
// one is still open. Counting locks means scroll only actually restores
// once every open modal has released its lock.
let lockCount = 0;
let previousOverflow = "";

function lock() {
  if (lockCount === 0) {
    previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
  }
  lockCount += 1;
}

function unlock() {
  lockCount = Math.max(0, lockCount - 1);
  if (lockCount === 0) {
    document.body.style.overflow = previousOverflow;
  }
}

/**
 * Locks page scroll while `active` is true. Safe to use in many
 * components at once — scroll is only restored once every component
 * that locked it has released (unmounted or flipped `active` to false).
 */
export function useScrollLock(active: boolean) {
  useEffect(() => {
    if (!active) return;
    lock();
    return () => unlock();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [active]);
}
