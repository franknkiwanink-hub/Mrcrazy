"use client";

import { useRef } from "react";
import { useRouter } from "next/navigation";
import { useAuth } from "@/lib/AuthContext";
import { useAuthModal } from "@/components/auth/AuthModalProvider";
import CreditsTicker from "./CreditsTicker";

// Ports the hero section, including the two CTAs' original auth-gating
// behavior (__requireAuth in auth-modal.js): both buttons require the
// visitor to be signed in before navigating, opening the auth modal
// instead if they're not.
export default function Hero() {
  const heroRef = useRef<HTMLElement>(null);
  const ctaRef = useRef<HTMLDivElement>(null);
  const { user } = useAuth();
  const { openAuthModal } = useAuthModal();
  const router = useRouter();

  function requireAuth(fn: () => void) {
    if (user) fn();
    else openAuthModal();
  }

  return (
    <section className="hero" ref={heroRef}>
      <div className="hero-bg" />
      <div className="hero-overlay" />
      <CreditsTicker heroRef={heroRef} ctaRef={ctaRef} />
      <div className="hero-content">
        <span className="hero-eyebrow">The dev marketplace</span>
        <h1 className="hero-title">
          Sell your apps, games
          <br />
          &amp; <em>templates</em> — fast.
        </h1>
        <p className="hero-desc">
          A marketplace built for independent developers. List your digital products, reach real buyers, and keep
          more of what you earn.
        </p>
        <div className="hero-ctas" ref={ctaRef}>
          <button className="cta-primary" onClick={() => requireAuth(() => router.push("/sell"))}>
            Start Selling
          </button>
          <button className="cta-secondary" onClick={() => requireAuth(() => router.push("/marketplace"))}>
            Browse Marketplace
          </button>
        </div>
      </div>
    </section>
  );
}
