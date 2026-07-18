"use client";

// Display-only currency conversion. Never touches the actual deal/escrow
// amount — app/api/paypal/_handler.js hardcodes currency_code: 'USD' for
// every real charge, and that stays true regardless of what's selected
// here. This purely controls what number is shown next to a USD price
// while browsing.
//
// Same persistence convention as components/theme/ThemeModalProvider.tsx:
// localStorage first (works signed-out, applies instantly), best-effort
// Firestore sync via setDoc(..., { merge: true }) when signed in so the
// preference follows the user across devices.

import { createContext, useContext, useEffect, useState, type ReactNode } from "react";
import { doc, setDoc } from "firebase/firestore";
import { auth, db } from "@/lib/firebase";
import { useAuth } from "@/lib/AuthContext";
import { SUPPORTED_CURRENCIES, type CurrencyCode } from "@/lib/currencies";

export type { CurrencyCode };

const STORAGE_KEY = "srf_currency";
const DEFAULT_CURRENCY: CurrencyCode = "USD";

const CURRENCY_SYMBOLS: Record<string, string> = {
  USD: "$", EUR: "€", GBP: "£", CAD: "CA$", AUD: "AU$", JPY: "¥",
  INR: "₹", BRL: "R$", MXN: "MX$", NGN: "₦", ZAR: "R", SGD: "S$",
  AED: "AED ", CHF: "CHF ", SEK: "kr", PLN: "zł",
};

interface CurrencyContextValue {
  currency: CurrencyCode;
  setCurrency: (code: CurrencyCode) => void;
  rates: Record<string, number> | null;
  ratesLoading: boolean;
  /** Converts a USD amount into the selected currency. Returns null if rates aren't loaded yet or the currency is USD (no conversion needed). */
  convert: (usdAmount: number) => number | null;
  /** Formats a USD amount as "{symbol}{converted} (≈ $usd USD)" when currency !== USD, or just "${usd}" when it is. Mirrors fmtPrice's "Make offer" fallback for null/undefined. */
  formatPrice: (usdAmount: number | undefined | null) => string;
  /** Same as formatPrice but without the "(≈ $usd USD)" suffix — just the converted figure, for tight spaces like marketplace card headlines where the full disclosure doesn't fit. Pair with a tooltip/title attribute showing the USD amount where possible. */
  formatPriceShort: (usdAmount: number | undefined | null) => string;
}

const CurrencyContext = createContext<CurrencyContextValue | null>(null);

export function useCurrency(): CurrencyContextValue {
  const ctx = useContext(CurrencyContext);
  if (!ctx) throw new Error("useCurrency must be used within CurrencyProvider");
  return ctx;
}

function loadStoredCurrency(): CurrencyCode {
  if (typeof window === "undefined") return DEFAULT_CURRENCY;
  try {
    const stored = localStorage.getItem(STORAGE_KEY);
    if (stored && (SUPPORTED_CURRENCIES as readonly string[]).includes(stored)) {
      return stored as CurrencyCode;
    }
  } catch {}
  return DEFAULT_CURRENCY;
}

async function saveCurrencyToFirestore(code: CurrencyCode) {
  const user = auth.currentUser;
  if (!user) return;
  try {
    await setDoc(doc(db, "users", user.uid), { currency: code }, { merge: true });
  } catch {
    // silent — local preference already applied, Firestore sync is non-critical
  }
}

export function CurrencyProvider({ children }: { children: ReactNode }) {
  const { user, profile } = useAuth();
  const [currency, setCurrencyState] = useState<CurrencyCode>(DEFAULT_CURRENCY);
  const [rates, setRates] = useState<Record<string, number> | null>(null);
  const [ratesLoading, setRatesLoading] = useState(true);

  // Local preference on mount — works before auth resolves, works
  // signed-out.
  useEffect(() => {
    setCurrencyState(loadStoredCurrency());
  }, []);

  // Once signed in, a Firestore-saved preference (set from another
  // device) takes precedence over whatever's in this browser's
  // localStorage — same "remote wins once loaded" behavior
  // ThemeModalProvider follows for theme.
  useEffect(() => {
    const remote = profile?.currency;
    if (remote && (SUPPORTED_CURRENCIES as readonly string[]).includes(remote)) {
      setCurrencyState(remote as CurrencyCode);
      try {
        localStorage.setItem(STORAGE_KEY, remote);
      } catch {}
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user, profile?.currency]);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const res = await fetch("/api/fx");
        const data = await res.json();
        if (!cancelled) setRates(data?.rates || { USD: 1 });
      } catch {
        if (!cancelled) setRates({ USD: 1 });
      } finally {
        if (!cancelled) setRatesLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  function setCurrency(code: CurrencyCode) {
    setCurrencyState(code);
    try {
      localStorage.setItem(STORAGE_KEY, code);
    } catch {}
    saveCurrencyToFirestore(code);
  }

  function convert(usdAmount: number): number | null {
    if (currency === "USD") return usdAmount;
    if (!rates || !rates[currency]) return null;
    return usdAmount * rates[currency];
  }

  function formatPrice(usdAmount: number | undefined | null): string {
    if (typeof usdAmount !== "number") return "Make offer";
    const usdFormatted = `$${usdAmount.toLocaleString()}`;
    if (currency === "USD") return usdFormatted;

    const converted = convert(usdAmount);
    if (converted === null) return usdFormatted; // rates not ready yet — fall back to USD rather than show nothing

    const symbol = CURRENCY_SYMBOLS[currency] || `${currency} `;
    const convertedFormatted = `${symbol}${Math.round(converted).toLocaleString()}`;
    return `${convertedFormatted} (≈ ${usdFormatted} USD)`;
  }

  function formatPriceShort(usdAmount: number | undefined | null): string {
    if (typeof usdAmount !== "number") return "Make offer";
    if (currency === "USD") return `$${usdAmount.toLocaleString()}`;

    const converted = convert(usdAmount);
    if (converted === null) return `$${usdAmount.toLocaleString()}`;

    const symbol = CURRENCY_SYMBOLS[currency] || `${currency} `;
    return `${symbol}${Math.round(converted).toLocaleString()}`;
  }

  return (
    <CurrencyContext.Provider
      value={{ currency, setCurrency, rates, ratesLoading, convert, formatPrice, formatPriceShort }}
    >
      {children}
    </CurrencyContext.Provider>
  );
}
