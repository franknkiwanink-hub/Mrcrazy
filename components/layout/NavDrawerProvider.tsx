"use client";

import { createContext, useCallback, useContext, useEffect, useRef, useState, type ReactNode } from "react";

interface NavDrawerContextValue {
  isOpen: boolean;
  openNav: () => void;
  closeNav: () => void;
  toggleNav: () => void;
  scrollBodyRef: React.RefObject<HTMLDivElement>;
}

const NavDrawerContext = createContext<NavDrawerContextValue | null>(null);

export function useNavDrawer() {
  const ctx = useContext(NavDrawerContext);
  if (!ctx) throw new Error("useNavDrawer must be used within NavDrawerProvider");
  return ctx;
}

// Ports openNav/closeNav from auth-modal.js: toggles the drawer/overlay/
// hamburger open classes, locks page scroll while open, and resets the
// drawer's internal scroll position to the top on close so the next open
// is always fresh — same behavior as the original's navScrollBody.scrollTop
// reset.
export function NavDrawerProvider({ children }: { children: ReactNode }) {
  const [isOpen, setIsOpen] = useState(false);
  const scrollBodyRef = useRef<HTMLDivElement>(null);

  const openNav = useCallback(() => setIsOpen(true), []);
  const closeNav = useCallback(() => {
    setIsOpen(false);
    if (scrollBodyRef.current) scrollBodyRef.current.scrollTop = 0;
  }, []);
  const toggleNav = useCallback(() => setIsOpen((v) => !v), []);

  useEffect(() => {
    if (!isOpen) return;
    const prevOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = prevOverflow;
    };
  }, [isOpen]);

  return (
    <NavDrawerContext.Provider value={{ isOpen, openNav, closeNav, toggleNav, scrollBodyRef }}>
      {children}
    </NavDrawerContext.Provider>
  );
}
