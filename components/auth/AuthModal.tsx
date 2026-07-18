"use client";

import { useState } from "react";
import {
  loginWithEmail,
  signupWithEmail,
  loginWithGoogle,
  loginWithGithub,
  sendForgotPasswordEmail,
  friendlyAuthError,
} from "@/lib/authActions";

const AVATAR_OPTIONS = [
  "https://i.pinimg.com/736x/8d/c1/be/8dc1be45b32f2d6efebea0ec78e6b036.jpg",
  "https://encrypted-tbn0.gstatic.com/images?q=tbn:ANd9GcQDfsluOgF7616BbxQSzOXNvGLfXVzE_-WZOWcIW3oPujiBgmHJ0mUpA-FD&s=10",
  "https://encrypted-tbn0.gstatic.com/images?q=tbn:ANd9GcQAFqKcJtNruTDoCmD8KVW7ZBhq4tmItcEzaiGnYQY0QA&s=10",
  "https://encrypted-tbn0.gstatic.com/images?q=tbn:ANd9GcTFfEJAs4Oomlw-gUD7EJTrGnp9Nkd7_iiOpMuXzHRy8k-9_MSQqJ1QMEs&s=10",
  "https://encrypted-tbn0.gstatic.com/images?q=tbn:ANd9GcScqrTQ9BZdUGLKk3ZKT_uZAiv1KEIJCyeeYzhr8ZhSkg&s=10",
];

interface AuthModalProps {
  open: boolean;
  onClose: () => void;
  /** Fired once a signup (email, or a brand-new Google/GitHub account)
   *  finishes, so the parent can show the post-signup tour — ports
   *  window.__startTour(username, profilePic), called unconditionally
   *  after email signup and only when isNew is true after OAuth, exactly
   *  like the original's setTimeout(() => window.__startTour(...), 300). */
  onSignupComplete?: (username: string, profilePic: string) => void;
}

type Tab = "login" | "signup";

export default function AuthModal({ open, onClose, onSignupComplete }: AuthModalProps) {
  const [tab, setTab] = useState<Tab>("login");
  const [oauthError, setOauthError] = useState("");

  const [loginEmail, setLoginEmail] = useState("");
  const [loginPassword, setLoginPassword] = useState("");
  const [loginError, setLoginError] = useState("");
  const [loginLoading, setLoginLoading] = useState(false);

  const [signupUsername, setSignupUsername] = useState("");
  const [signupEmail, setSignupEmail] = useState("");
  const [signupPassword, setSignupPassword] = useState("");
  const [signupAvatar, setSignupAvatar] = useState<string | null>(null);
  const [signupAvatarError, setSignupAvatarError] = useState(false);
  const [signupError, setSignupError] = useState("");
  const [signupLoading, setSignupLoading] = useState(false);

  if (!open) return null;

  async function handleLogin(e: React.FormEvent) {
    e.preventDefault();
    setLoginError("");
    setLoginLoading(true);
    try {
      await loginWithEmail(loginEmail, loginPassword);
      onClose();
    } catch (err: any) {
      setLoginError(friendlyAuthError(err?.code));
    } finally {
      setLoginLoading(false);
    }
  }

  async function handleForgotPassword() {
    setLoginError("");
    try {
      await sendForgotPasswordEmail(loginEmail);
      setLoginError("✓ Reset email sent — check your inbox.");
    } catch (err: any) {
      setLoginError(err?.code ? friendlyAuthError(err.code) : err.message);
    }
  }

  async function handleSignup(e: React.FormEvent) {
    e.preventDefault();
    setSignupError("");

    if (!signupAvatar) {
      setSignupAvatarError(true);
      return;
    }
    setSignupAvatarError(false);

    setSignupLoading(true);
    try {
      const { username, profilePic } = await signupWithEmail(
        signupUsername,
        signupEmail,
        signupPassword,
        signupAvatar
      );
      onClose();
      // Reset form
      setSignupUsername("");
      setSignupEmail("");
      setSignupPassword("");
      setSignupAvatar(null);
      // Tour fires unconditionally after email signup, same as the
      // original's setTimeout(() => window.__startTour(username,
      // profilePic), 300) right after the signup success path.
      onSignupComplete?.(username, profilePic);
    } catch (err: any) {
      setSignupError(err?.code ? friendlyAuthError(err.code) : err.message);
    } finally {
      setSignupLoading(false);
    }
  }

  async function handleGoogle() {
    setOauthError("");
    try {
      const { isNew, username, profilePic } = await loginWithGoogle();
      onClose();
      // Original only fires the tour for a brand-new account
      // (if (isNew) { await _finishOauthSignup(cred.user); }) — an
      // existing user logging back in via Google never sees it again.
      if (isNew) onSignupComplete?.(username, profilePic);
    } catch (err: any) {
      setOauthError(friendlyAuthError(err?.code));
    }
  }

  async function handleGithub() {
    setOauthError("");
    try {
      const { isNew, username, profilePic } = await loginWithGithub();
      onClose();
      if (isNew) onSignupComplete?.(username, profilePic);
    } catch (err: any) {
      setOauthError(friendlyAuthError(err?.code));
    }
  }

  return (
    <div
      style={{
        display: "flex",
        position: "fixed",
        top: 0,
        left: 0,
        width: "100%",
        height: "100%",
        background: "rgba(0,0,0,0.85)",
        backdropFilter: "blur(12px)",
        WebkitBackdropFilter: "blur(12px)",
        justifyContent: "center",
        alignItems: "center",
        zIndex: 9999,
        fontFamily: "-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif",
      }}
    >
      <div
        style={{
          background: "#121214",
          width: "100%",
          maxWidth: 440,
          maxHeight: "85vh",
          border: "1px solid #27272a",
          borderRadius: 14,
          boxShadow: "0 30px 60px -15px rgba(0,0,0,0.8)",
          display: "flex",
          flexDirection: "column",
          overflow: "hidden",
          margin: 16,
        }}
      >
        <header
          style={{
            position: "sticky",
            top: 0,
            zIndex: 10,
            background: "#121214",
            padding: "20px 24px",
            display: "flex",
            justifyContent: "space-between",
            alignItems: "center",
            borderBottom: "1px solid #232326",
          }}
        >
          <span style={{ fontSize: "0.85rem", fontWeight: 800, color: "#fff", letterSpacing: "0.08em" }}>
            DEVELOPERS LAND
          </span>
          <button
            onClick={onClose}
            style={{
              background: "#ef4444",
              color: "#fff",
              border: "none",
              padding: "6px 14px",
              borderRadius: 6,
              fontSize: "0.8rem",
              fontWeight: 600,
              textTransform: "uppercase",
              letterSpacing: "0.03em",
              cursor: "pointer",
            }}
          >
            Close
          </button>
        </header>

        <div style={{ padding: 24, overflowY: "auto", flexGrow: 1 }}>
          {oauthError && (
            <div
              style={{
                background: "rgba(239,68,68,0.1)",
                border: "1px solid rgba(239,68,68,0.3)",
                color: "#fca5a5",
                fontSize: "0.8rem",
                padding: "10px 14px",
                borderRadius: 8,
                marginBottom: 16,
              }}
            >
              {oauthError}
            </div>
          )}

          {/* Tab switch */}
          <div
            style={{
              display: "flex",
              background: "#09090b",
              padding: 4,
              borderRadius: 8,
              marginBottom: 20,
              border: "1px solid #232326",
            }}
          >
            <button
              onClick={() => setTab("login")}
              style={{
                flex: 1,
                padding: 10,
                background: tab === "login" ? "#121214" : "none",
                border: tab === "login" ? "1px solid #27272a" : "none",
                fontSize: "0.85rem",
                fontWeight: 600,
                color: tab === "login" ? "#fff" : "#71717a",
                cursor: "pointer",
                borderRadius: 6,
                fontFamily: "inherit",
                transition: "all 0.15s",
              }}
            >
              Login
            </button>
            <button
              onClick={() => setTab("signup")}
              style={{
                flex: 1,
                padding: 10,
                background: tab === "signup" ? "#121214" : "none",
                border: tab === "signup" ? "1px solid #27272a" : "none",
                fontSize: "0.85rem",
                fontWeight: 600,
                color: tab === "signup" ? "#fff" : "#71717a",
                cursor: "pointer",
                borderRadius: 6,
                fontFamily: "inherit",
                transition: "all 0.15s",
              }}
            >
              Sign Up
            </button>
          </div>

          {/* OAuth buttons */}
          <div style={{ display: "flex", gap: 12, marginBottom: 20 }}>
            <button
              onClick={handleGoogle}
              style={{
                flex: 1,
                height: 42,
                background: "#18181b",
                border: "1px solid #27272a",
                borderRadius: 8,
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                gap: 10,
                color: "#e4e4e7",
                fontSize: "0.85rem",
                fontWeight: 600,
                cursor: "pointer",
                fontFamily: "inherit",
              }}
            >
              <svg viewBox="0 0 24 24" style={{ width: 18, height: 18 }}>
                <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" />
                <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" />
                <path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.06H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.94l2.85-2.22z" />
                <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.06l3.66 2.84c.87-2.6 3.3-4.52 6.16-4.52z" />
              </svg>
              Google
            </button>
            <button
              onClick={handleGithub}
              style={{
                flex: 1,
                height: 42,
                background: "#18181b",
                border: "1px solid #27272a",
                borderRadius: 8,
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                gap: 10,
                color: "#e4e4e7",
                fontSize: "0.85rem",
                fontWeight: 600,
                cursor: "pointer",
                fontFamily: "inherit",
              }}
            >
              <svg viewBox="0 0 24 24" fill="#ffffff" style={{ width: 18, height: 18 }}>
                <path
                  fillRule="evenodd"
                  clipRule="evenodd"
                  d="M12 2C6.477 2 2 6.484 2 12.017c0 4.425 2.865 8.18 6.839 9.504.5.092.682-.217.682-.483 0-.237-.008-.868-.013-1.703-2.782.605-3.369-1.343-3.369-1.343-.454-1.158-1.11-1.466-1.11-1.466-.908-.62.069-.608.069-.608 1.003.07 1.531 1.032 1.531 1.032.892 1.53 2.341 1.088 2.91.832.092-.647.35-1.088.636-1.338-2.22-.253-4.555-1.113-4.555-4.951 0-1.093.39-1.988 1.029-2.688-.103-.253-.446-1.272.098-2.65 0 0 .84-.27 2.75 1.026A9.564 9.564 0 0112 6.844c.85.004 1.705.115 2.504.337 1.909-1.296 2.747-1.027 2.747-1.027.546 1.379.202 2.398.1 2.651.64.7 1.028 1.595 1.028 2.688 0 3.848-2.339 4.695-4.566 4.943.359.309.678.92.678 1.855 0 1.338-.012 2.419-.012 2.747 0 .268.18.58.688.482A10.019 10.019 0 0022 12.017C22 6.484 17.522 2 12 2z"
                />
              </svg>
              GitHub
            </button>
          </div>

          <div
            style={{
              display: "flex",
              alignItems: "center",
              color: "#4b4b52",
              fontSize: "0.7rem",
              fontWeight: 700,
              letterSpacing: "0.05em",
              marginBottom: 20,
            }}
          >
            <span style={{ flex: 1, borderBottom: "1px solid #232326", marginRight: ".75em" }} />
            OR CONTINUE WITH
            <span style={{ flex: 1, borderBottom: "1px solid #232326", marginLeft: ".75em" }} />
          </div>

          {tab === "login" ? (
            <form onSubmit={handleLogin} style={{ display: "flex", flexDirection: "column", gap: 18 }}>
              {loginError && (
                <div
                  style={{
                    background: "rgba(239,68,68,0.1)",
                    border: "1px solid rgba(239,68,68,0.3)",
                    color: "#fca5a5",
                    fontSize: "0.8rem",
                    padding: "10px 14px",
                    borderRadius: 8,
                  }}
                >
                  {loginError}
                </div>
              )}
              <FormField label="Email Address" icon={EmailIcon}>
                <input
                  type="email"
                  placeholder="you@domain.com"
                  required
                  value={loginEmail}
                  onChange={(e) => setLoginEmail(e.target.value)}
                  style={inputStyle}
                />
              </FormField>
              <FormField label="Password" icon={PasswordIcon}>
                <input
                  type="password"
                  placeholder="••••••••"
                  required
                  value={loginPassword}
                  onChange={(e) => setLoginPassword(e.target.value)}
                  style={inputStyle}
                />
              </FormField>
              <div style={{ display: "flex", justifyContent: "flex-end", marginTop: -2 }}>
                <a
                  href="#"
                  onClick={(e) => {
                    e.preventDefault();
                    handleForgotPassword();
                  }}
                  style={{ fontSize: "0.8rem", color: "#a1a1aa", textDecoration: "none" }}
                >
                  Forgot password?
                </a>
              </div>
              <button type="submit" disabled={loginLoading} style={submitButtonStyle}>
                {loginLoading ? "Please wait…" : "Access Account"}
              </button>
            </form>
          ) : (
            <form onSubmit={handleSignup} style={{ display: "flex", flexDirection: "column", gap: 18 }}>
              {signupError && (
                <div
                  style={{
                    background: "rgba(239,68,68,0.1)",
                    border: "1px solid rgba(239,68,68,0.3)",
                    color: "#fca5a5",
                    fontSize: "0.8rem",
                    padding: "10px 14px",
                    borderRadius: 8,
                  }}
                >
                  {signupError}
                </div>
              )}
              <FormField label="Username" icon={UsernameIcon}>
                <input
                  type="text"
                  placeholder="player_one"
                  required
                  value={signupUsername}
                  onChange={(e) => setSignupUsername(e.target.value)}
                  style={inputStyle}
                />
              </FormField>
              <FormField label="Email Address" icon={EmailIcon}>
                <input
                  type="email"
                  placeholder="you@domain.com"
                  required
                  value={signupEmail}
                  onChange={(e) => setSignupEmail(e.target.value)}
                  style={inputStyle}
                />
              </FormField>
              <FormField label="Password" icon={PasswordIcon}>
                <input
                  type="password"
                  placeholder="Create secure password"
                  required
                  value={signupPassword}
                  onChange={(e) => setSignupPassword(e.target.value)}
                  style={inputStyle}
                />
              </FormField>
              <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
                <label style={fieldLabelStyle}>
                  Choose Profile Picture <span style={{ color: "#fca5a5" }}>*</span>
                </label>
                <div
                  style={{
                    display: "flex",
                    flexDirection: "row",
                    gap: 10,
                    padding: "8px 2px",
                    overflowX: "auto",
                    overflowY: "visible",
                    WebkitOverflowScrolling: "touch",
                    width: "100%",
                    boxSizing: "border-box",
                  }}
                >
                  {AVATAR_OPTIONS.map((url) => (
                    <img
                      key={url}
                      src={url}
                      alt=""
                      onClick={() => {
                        setSignupAvatar(url);
                        setSignupAvatarError(false);
                      }}
                      style={{
                        width: 58,
                        height: 58,
                        minWidth: 58,
                        flexShrink: 0,
                        borderRadius: "50%",
                        objectFit: "cover",
                        cursor: "pointer",
                        border: signupAvatar === url ? "3px solid #fff" : "3px solid #3f3f46",
                        boxShadow: signupAvatar === url ? "0 0 0 2px rgba(255,255,255,0.3)" : "none",
                        transition: "all 0.2s ease",
                        background: "#1a1a1e",
                      }}
                    />
                  ))}
                </div>
                {signupAvatarError && (
                  <div style={{ color: "#fca5a5", fontSize: "0.78rem", textAlign: "center" }}>
                    Please select a profile picture to continue.
                  </div>
                )}
              </div>
              <button type="submit" disabled={signupLoading} style={submitButtonStyle}>
                {signupLoading ? "Please wait…" : "Register Account"}
              </button>
            </form>
          )}
        </div>
      </div>
    </div>
  );
}

function FormField({
  label,
  icon,
  children,
}: {
  label: string;
  icon?: React.ReactNode;
  children: React.ReactNode;
}) {
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
      <label style={fieldLabelStyle}>{label}</label>
      <div style={{ position: "relative", display: "flex", alignItems: "center" }}>
        {icon && (
          <span
            style={{
              position: "absolute",
              left: 14,
              width: 18,
              height: 18,
              color: "#a1a1aa",
              pointerEvents: "none",
              display: "flex",
            }}
          >
            {icon}
          </span>
        )}
        {children}
      </div>
    </div>
  );
}

const EmailIcon = (
  <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.8} stroke="currentColor">
    <path
      strokeLinecap="round"
      strokeLinejoin="round"
      d="M21.75 6.75v10.5a2.25 2.25 0 0 1-2.25 2.25h-15a2.25 2.25 0 0 1-2.25-2.25V6.75m19.5 0A2.25 2.25 0 0 0 19.5 4.5h-15a2.25 2.25 0 0 0-2.25 2.25m19.5 0v.243a2.25 2.25 0 0 1-1.07 1.916l-7.5 4.615a2.25 2.25 0 0 1-2.36 0L3.32 8.91a2.25 2.25 0 0 1-1.07-1.916V6.75"
    />
  </svg>
);

const PasswordIcon = (
  <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.8} stroke="currentColor">
    <path
      strokeLinecap="round"
      strokeLinejoin="round"
      d="M16.5 10.5V6.75a4.5 4.5 0 1 0-9 0v3.75m-.75 11.25h10.5a2.25 2.25 0 0 0 2.25-2.25v-6.75a2.25 2.25 0 0 0-2.25-2.25H6.75a2.25 2.25 0 0 0-2.25 2.25v6.75a2.25 2.25 0 0 0 2.25 2.25Z"
    />
  </svg>
);

const UsernameIcon = (
  <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.8} stroke="currentColor">
    <path
      strokeLinecap="round"
      strokeLinejoin="round"
      d="M15.75 6a3.75 3.75 0 1 1-7.5 0 3.75 3.75 0 0 1 7.5 0ZM4.501 20.118a7.5 7.5 0 0 1 14.998 0A17.933 17.933 0 0 1 12 21.75c-2.676 0-5.216-.584-7.499-1.632Z"
    />
  </svg>
);

const fieldLabelStyle: React.CSSProperties = {
  fontSize: "0.75rem",
  fontWeight: 600,
  color: "#a1a1aa",
  textTransform: "uppercase",
  letterSpacing: "0.05em",
};

const inputStyle: React.CSSProperties = {
  width: "100%",
  height: 44,
  padding: "0 14px 0 46px",
  background: "#09090b",
  border: "1px solid #3f3f46",
  borderRadius: 8,
  fontSize: "0.95rem",
  color: "#fff",
  outline: "none",
  fontFamily: "inherit",
};

const submitButtonStyle: React.CSSProperties = {
  width: "100%",
  height: 46,
  background: "#fff",
  color: "#09090b",
  border: "none",
  borderRadius: 8,
  fontSize: "0.9rem",
  fontWeight: 700,
  textTransform: "uppercase",
  letterSpacing: "0.05em",
  cursor: "pointer",
  fontFamily: "inherit",
};
