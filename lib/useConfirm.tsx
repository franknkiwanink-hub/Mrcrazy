"use client";

import { useCallback, useState } from "react";

// Replaces the old global window.srfModal.confirm()/alert()/prompt()
// dialogs, which were never ported to this app (see the comment in
// SellerProfileHeader.tsx that established the inline-overlay pattern
// this hook generalizes). The deal chat panel needs several of these
// (pay confirm, release confirm, dispute reason prompt, cancel confirm,
// report confirm, plain alerts) — one shared hook avoids five ad-hoc
// copies of the same overlay markup.

export type ConfirmTheme = "success" | "warning" | "danger" | "info" | "report";

interface ConfirmOptions {
  theme?: ConfirmTheme;
  title: string;
  msg: string;
  confirmText?: string;
  cancelText?: string;
}

interface PromptOptions {
  theme?: ConfirmTheme;
  title: string;
  msg: string;
  inputPlaceholder?: string;
  confirmText?: string;
}

interface AlertOptions {
  theme?: ConfirmTheme;
  title: string;
  msg: string;
}

type PendingState =
  | { kind: "confirm"; opts: ConfirmOptions; resolve: (v: boolean) => void }
  | { kind: "prompt"; opts: PromptOptions; resolve: (v: string | null) => void; value: string }
  | { kind: "alert"; opts: AlertOptions; resolve: () => void }
  | null;

const THEME_COLOR: Record<ConfirmTheme, string> = {
  success: "#a3e635",
  warning: "#fbbf24",
  danger: "#f87171",
  info: "#60a5fa",
  report: "#fb7185",
};

export function useConfirm() {
  const [pending, setPending] = useState<PendingState>(null);

  const confirm = useCallback((opts: ConfirmOptions) => {
    return new Promise<boolean>((resolve) => {
      setPending({ kind: "confirm", opts, resolve });
    });
  }, []);

  const prompt = useCallback((opts: PromptOptions) => {
    return new Promise<string | null>((resolve) => {
      setPending({ kind: "prompt", opts, resolve, value: "" });
    });
  }, []);

  const alert = useCallback((opts: AlertOptions) => {
    return new Promise<void>((resolve) => {
      setPending({ kind: "alert", opts, resolve });
    });
  }, []);

  function close() {
    setPending(null);
  }

  const ConfirmHost = useCallback(() => {
    if (!pending) return null;
    const color = THEME_COLOR[pending.opts.theme || "info"];

    return (
      <div
        style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.7)", zIndex: 10001, display: "flex", alignItems: "center", justifyContent: "center", padding: 20 }}
        onClick={() => {
          if (pending.kind === "confirm") pending.resolve(false);
          else if (pending.kind === "prompt") pending.resolve(null);
          else pending.resolve();
          close();
        }}
      >
        <div
          style={{ background: "#111", border: `1px solid ${color}33`, padding: 24, borderRadius: 14, color: "#fff", maxWidth: 380, width: "100%" }}
          onClick={(e) => e.stopPropagation()}
        >
          <h3 style={{ marginTop: 0, marginBottom: 8, fontSize: "1.05rem" }}>{pending.opts.title}</h3>
          <p style={{ opacity: 0.7, fontSize: 13.5, lineHeight: 1.5, margin: "0 0 16px" }}>{pending.opts.msg}</p>

          {pending.kind === "prompt" ? (
            <input
              autoFocus
              type="text"
              placeholder={(pending.opts as PromptOptions).inputPlaceholder || ""}
              value={pending.value}
              onChange={(e) => setPending({ ...pending, value: e.target.value })}
              style={{ width: "100%", padding: "0.6rem 0.75rem", borderRadius: 8, background: "#0a0a0a", border: "1px solid #222", color: "#fff", fontSize: 13.5, marginBottom: 16, boxSizing: "border-box" }}
            />
          ) : null}

          <div style={{ display: "flex", gap: 8, justifyContent: "flex-end" }}>
            {pending.kind !== "alert" ? (
              <button
                onClick={() => {
                  if (pending.kind === "confirm") pending.resolve(false);
                  else pending.resolve(null);
                  close();
                }}
                style={{ padding: "0.5rem 1rem", borderRadius: 8, background: "transparent", border: "1px solid #333", color: "#aaa", fontSize: 13, cursor: "pointer" }}
              >
                {(pending.opts as ConfirmOptions | PromptOptions).cancelText || "Cancel"}
              </button>
            ) : null}
            <button
              onClick={() => {
                if (pending.kind === "confirm") pending.resolve(true);
                else if (pending.kind === "prompt") pending.resolve(pending.value.trim() || null);
                else pending.resolve();
                close();
              }}
              style={{ padding: "0.5rem 1.1rem", borderRadius: 8, background: color, border: "none", color: "#000", fontSize: 13, fontWeight: 700, cursor: "pointer" }}
            >
              {pending.kind === "alert" ? "OK" : (pending.opts as ConfirmOptions | PromptOptions).confirmText || "Confirm"}
            </button>
          </div>
        </div>
      </div>
    );
  }, [pending]);

  return { confirm, prompt, alert, ConfirmHost };
}
