"use client";

import { useEffect, useRef } from "react";
import { useRouter } from "next/navigation";
import { useAuth } from "@/lib/AuthContext";
import { useAuthModal } from "@/components/auth/AuthModalProvider";
import { useNavDrawer } from "@/components/layout/NavDrawerProvider";
import { useWalletModal } from "@/components/wallet/WalletModalProvider";

const DEFAULT_AVATAR =
  "https://i.pinimg.com/736x/8d/c1/be/8dc1be45b32f2d6efebea0ec78e6b036.jpg";

// Ports the hamburger icon's idle line-shuffle from announcement-settings.js
// (index.html lines 30-41) — the 3 bars quietly cycle through 6 fixed-width
// permutations every 3-5s so the icon never looks perfectly static.
const SHUFFLE_WIDTHS = [
  [12, 18, 24],
  [12, 24, 18],
  [18, 12, 24],
  [18, 24, 12],
  [24, 12, 18],
  [24, 18, 12],
];

function useHamburgerShuffle() {
  const refs = [useRef<HTMLSpanElement>(null), useRef<HTMLSpanElement>(null), useRef<HTMLSpanElement>(null)];

  useEffect(() => {
    let permIdx = 0;
    let timer: ReturnType<typeof setTimeout>;

    function applyWidths(ws: number[]) {
      refs.forEach((r, i) => {
        if (r.current) r.current.style.width = `${ws[i]}px`;
      });
    }

    function shuffle() {
      permIdx = (permIdx + 1) % SHUFFLE_WIDTHS.length;
      applyWidths(SHUFFLE_WIDTHS[permIdx]);
      timer = setTimeout(shuffle, 3000 + Math.random() * 2000);
    }

    applyWidths(SHUFFLE_WIDTHS[0]);
    timer = setTimeout(shuffle, 3000 + Math.random() * 2000);
    return () => clearTimeout(timer);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return refs;
}

export default function Header() {
  const { user, profile } = useAuth();
  const { openAuthModal } = useAuthModal();
  const { isOpen, toggleNav } = useNavDrawer();
  const { openWallet } = useWalletModal();
  const router = useRouter();
  const [l1Ref, l2Ref, l3Ref] = useHamburgerShuffle();

  const isLoggedIn = !!user;
  const label = isLoggedIn ? "Profile" : "Sign up / Log in";
  const avatarSrc = profile?.profilePic || DEFAULT_AVATAR;

  return (
    <header>
      <div className="left">
        <button
          className={`hamburger${isOpen ? " open" : ""}`}
          id="hbg"
          aria-label="Menu"
          aria-expanded={isOpen}
          onClick={toggleNav}
        >
          <span id="l1" ref={l1Ref} />
          <span id="l2" ref={l2Ref} />
          <span id="l3" ref={l3Ref} />
        </button>
        <div className="brand">
          Siterifty<span>.com</span>
        </div>
      </div>
      <div className="btn-wrap">
        {isLoggedIn && (
          <div
            id="headerBalance"
            onClick={openWallet}
            style={{
              display: "flex",
              alignItems: "center",
              gap: 5,
              background: "rgba(255,255,255,0.08)",
              backdropFilter: "blur(12px)",
              WebkitBackdropFilter: "blur(12px)",
              border: "1px solid rgba(255,255,255,0.12)",
              borderRadius: 20,
              padding: "4px 11px 4px 9px",
              marginRight: 8,
              fontSize: 12.5,
              fontWeight: 600,
              color: "rgba(255,255,255,0.9)",
              letterSpacing: "0.01em",
              whiteSpace: "nowrap",
              cursor: "pointer",
            }}
          >
            <svg
              width="11"
              height="11"
              viewBox="0 0 24 24"
              fill="none"
              stroke="rgba(255,255,255,0.55)"
              strokeWidth="2.2"
              style={{ flexShrink: 0 }}
            >
              <path d="M9 12h6M12 8v8" strokeLinecap="round" />
              <circle cx="12" cy="12" r="10" />
            </svg>
            <span id="headerBalanceAmt">${(profile?.walletBalance ?? 0).toFixed(2)}</span>
          </div>
        )}
        <button
          className="btn-login"
          onClick={() => {
            // Ports the .btn-login click handler in announcement-settings.js:
            // logged-in → profile modal (here: /myprofile route, since that
            // page hasn't been built yet — this link will start working the
            // moment it is); logged-out → auth modal.
            if (isLoggedIn) router.push("/myprofile");
            else openAuthModal();
          }}
        >
          {isLoggedIn && (
            <img
              src={avatarSrc}
              alt=""
              style={{
                width: 26,
                height: 26,
                borderRadius: "50%",
                objectFit: "cover",
                flexShrink: 0,
              }}
              onError={(e) => {
                (e.target as HTMLImageElement).style.display = "none";
              }}
            />
          )}
          <span
            style={{
              maxWidth: 110,
              overflow: "hidden",
              textOverflow: "ellipsis",
              whiteSpace: "nowrap",
            }}
          >
            {label}
          </span>
        </button>
      </div>
    </header>
  );
}
