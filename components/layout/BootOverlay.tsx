"use client";

import { useEffect, useMemo, useState, type CSSProperties } from "react";
import { useAuth } from "@/lib/AuthContext";

// Ports the "BOOT OVERLAY — hidden once, after the first auth resolution
// + a 1.5s cooldown" block from firebase-init.js, plus the appBootOverlay
// markup from index.html. Same timing as the original:
//   - shown immediately on mount (nothing to wait on, matches the
//     original rendering it as the very first thing in <body>)
//   - AuthContext's `loading` flips false the instant onAuthStateChanged
//     fires once (with a user OR null) — this is the exact same
//     "__authReady resolves once" moment the original's onAuthStateChanged
//     callback used to trigger __dismissBootOverlay()
//   - a further 1.5s cooldown after that before the fade-out starts,
//     ported verbatim from the original's setTimeout(..., 1500)
//   - the overlay fades out via the .boot-hidden CSS class (opacity/
//     visibility transition, ~0.5s — see #appBootOverlay.boot-hidden in
//     globals.css), then unmounts after that transition completes
//   - an 8s absolute safety net in case auth never resolves (matches the
//     original's setTimeout(__dismissBootOverlay, 8000) belt-and-braces
//     call), so a stalled network/auth call can never leave this stuck up
//     forever
//
// NOT included here: the original's __dismissBootOverlay also kicks off
// the "Welcome Back" full-screen takeover for returning users
// (window.__welcomeBackPending / __openWelcomeBack) once the boot overlay
// itself finishes. That's now a separate component —
// components/system/WelcomeBackScreen.tsx, mounted alongside this one in
// app/layout.tsx — which mirrors the same BOOT_HOLD_MS timing off
// useAuth().loading directly rather than this component signaling it,
// since nothing else currently needs to know when the boot splash has
// fully faded.
const BOOT_HOLD_MS = 1500;
const BOOT_FADE_MS = 550;
const BOOT_SAFETY_NET_MS = 8000;

interface GlitterParticle {
  key: number;
  style: CSSProperties & Record<"--gx" | "--gtx" | "--gy", string>;
}

// Ports the falling-glitter generator IIFE from maintenance-banned.js
// (index.html lines 1767-1795) verbatim — same particle count, same
// random ranges for spawn position/drift/fall distance/size/delay/
// duration, same --gx/--gtx/--gy custom-property scheme feeding the
// shared boot-glitter-fall keyframe. Computed once (useMemo with no
// deps), matching the original's one-time IIFE rather than
// regenerating a new random field on every re-render.
function makeGlitterParticles(): GlitterParticle[] {
  const count = 18;
  const particles: GlitterParticle[] = [];
  for (let i = 0; i < count; i++) {
    const startXvw = Number((Math.random() * 80 - 40).toFixed(1));
    const driftX = Math.round(-startXvw * 2.2);
    const fallY = `${(54 + Math.random() * 6).toFixed(1)}vh`;
    const size = Math.random() < 0.5 ? 3 : 4;
    const delay = (Math.random() * 3.2).toFixed(2);
    const dur = (2.6 + Math.random() * 0.8).toFixed(2);
    const rotated = Math.random() < 0.5;
    particles.push({
      key: i,
      style: {
        left: `calc(50% + ${startXvw}vw)`,
        width: size,
        height: size,
        transform: rotated ? "rotate(45deg)" : undefined,
        "--gx": "0px",
        "--gtx": `${driftX}px`,
        "--gy": fallY,
        animationDelay: `${delay}s`,
        animationDuration: `${dur}s`,
      } as GlitterParticle["style"],
    });
  }
  return particles;
}

export default function BootOverlay() {
  const { loading } = useAuth();
  const [hidden, setHidden] = useState(false);
  const [removed, setRemoved] = useState(false);
  const [dismissed, setDismissed] = useState(false);
  const [mounted, setMounted] = useState(false);

  // Particles use Math.random(), so they must not be generated during
  // SSR/the first client render (which has to match the server's HTML).
  // Generating them only after mount avoids a hydration mismatch.
  useEffect(() => {
    setMounted(true);
  }, []);
  const glitter = useMemo(() => (mounted ? makeGlitterParticles() : []), [mounted]);

  // Dismiss once auth resolves (loading -> false), after the same 1.5s
  // cooldown the original applies so the splash doesn't flash away
  // instantly on a very fast cold load.
  useEffect(() => {
    if (loading || dismissed) return;
    setDismissed(true);
    const t = setTimeout(() => setHidden(true), BOOT_HOLD_MS);
    return () => clearTimeout(t);
  }, [loading, dismissed]);

  // Safety net: never let a stalled network/auth call leave the overlay
  // up forever, independent of whether `loading` ever resolves.
  useEffect(() => {
    const t = setTimeout(() => {
      setDismissed(true);
      setHidden(true);
    }, BOOT_SAFETY_NET_MS);
    return () => clearTimeout(t);
  }, []);

  // Unmount only after the fade-out transition has actually finished,
  // matching the original's setTimeout(() => el.remove(), 550).
  useEffect(() => {
    if (!hidden) return;
    const t = setTimeout(() => setRemoved(true), BOOT_FADE_MS);
    return () => clearTimeout(t);
  }, [hidden]);

  if (removed) return null;

  return (
    <div id="appBootOverlay" className={hidden ? "boot-hidden" : undefined}>
      <div className="boot-glitter-field" id="bootGlitterField">
        {glitter.map((p) => (
          <div key={p.key} className="boot-glitter" style={p.style} />
        ))}
      </div>
      <div className="boot-content">
        <div className="boot-mark-wrap">
          <div className="boot-mark-glyph">
            <img
              src="https://www.image2url.com/r2/default/images/1783717278670-ca484861-c917-4fdb-b330-a2baf612127e.svg"
              alt="Siterifty"
              width={22}
              height={22}
              style={{ display: "block" }}
            />
          </div>
          <div className="boot-mark">
            Siterifty<span>.</span>
          </div>
          <div className="boot-tagline">Buy, sell & build digital products</div>
        </div>
        <div className="boot-ring-wrap">
          <svg viewBox="0 0 56 56">
            <circle className="boot-ring-track" cx="28" cy="28" r="24" />
            <circle className="boot-ring-fill" cx="28" cy="28" r="24" />
          </svg>
        </div>
        <div className="boot-status-row">
          <div className="boot-status-text">Loading your account</div>
          <div className="boot-skel-col">
            <div className="boot-skel-line w60" />
            <div className="boot-skel-line" />
            <div className="boot-skel-line w40" />
          </div>
        </div>
      </div>
    </div>
  );
}
