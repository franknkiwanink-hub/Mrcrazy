"use client";

// Ports Js/feedback-widget.js (index.html lines 26696-27080) — the
// floating "Feedback" launcher + its modal (compose / vote board /
// "what we're working on" archive), backed by the already-ported
// feedback-* actions in app/api/aistudio/_handler.js. Mounted once in
// app/layout.tsx, same tier as the other global overlays.
//
// Scroll-lock and "another modal is already open" suppression aren't
// ported from window.__srfLockScroll / window.__anyModalOpen — neither
// exists as a real helper yet (that's the pending shared confirm-dialog/
// modal-coordination work). This uses its own local scroll lock instead,
// which is safe on its own but can double-lock if opened at the same
// time as another modal; low-risk today since nothing else currently
// triggers it. Revisit once that shared helper lands.
//
// Voting and submitting require sign-in (matches fbAuthedFetch in the
// original); the board and archive are readable signed-out
// (fbPublicFetch), and the daily nudge only ever fires for signed-in
// users.
import { useCallback, useEffect, useRef, useState } from "react";
import { auth } from "@/lib/firebase";

type Pane = "compose" | "board" | "working";

interface Suggestion {
  id: string;
  text: string;
  totalScore: number;
  voteCount: number;
  myVote?: number | null;
  breakdown?: Record<string, number>;
}

interface ArchiveItem {
  text: string;
  totalScore: number;
  voteCount: number;
  archivedAt?: number;
}

interface Cycle {
  serverNow: number;
  cycleEnd: number;
  justReset?: boolean;
}

const VOTE_OPTIONS: { score: number; label: string; key: string }[] = [
  { score: 3, label: "Fantastic idea", key: "fantastic" },
  { score: 2, label: "Nice idea", key: "nice" },
  { score: 1, label: "Average", key: "average" },
  { score: -1, label: "Bad idea", key: "bad" },
];

function scoreKey(score: number) {
  if (score === 3) return "fantastic";
  if (score === 2) return "nice";
  if (score === 1) return "average";
  return "bad";
}

async function authedFetch<T = any>(action: string, extra?: Record<string, unknown>): Promise<T> {
  const user = auth.currentUser;
  if (!user) throw new Error("Sign in to send feedback.");
  const idToken = await user.getIdToken();
  const res = await fetch("/api/aistudio", {
    method: "POST",
    headers: { "Content-Type": "application/json", Authorization: `Bearer ${idToken}` },
    body: JSON.stringify({ action, ...extra }),
  });
  const data = await res.json();
  if (!res.ok) throw new Error(data.error || "Something went wrong.");
  return data;
}

// Works signed-out too; attaches the token when available so actions
// like feedback-list-top can report back "myVote".
async function publicFetch<T = any>(action: string, extra?: Record<string, unknown>): Promise<T> {
  const user = auth.currentUser;
  const headers: Record<string, string> = { "Content-Type": "application/json" };
  if (user) {
    try {
      headers.Authorization = `Bearer ${await user.getIdToken()}`;
    } catch {
      // no token available — proceed unauthenticated
    }
  }
  const res = await fetch("/api/aistudio", {
    method: "POST",
    headers,
    body: JSON.stringify({ action, ...extra }),
  });
  const data = await res.json();
  if (!res.ok) throw new Error(data.error || "Something went wrong.");
  return data;
}

function pad(n: number) {
  return String(n).padStart(2, "0");
}

export default function FeedbackWidget() {
  const [open, setOpen] = useState(false);
  const [pane, setPane] = useState<Pane>("compose");
  const [explainerOpen, setExplainerOpen] = useState(true);

  const [text, setText] = useState("");
  const [status, setStatus] = useState<{ kind: "idle" | "ok" | "err"; msg: string }>({ kind: "idle", msg: "" });
  const [submitting, setSubmitting] = useState(false);

  const [board, setBoard] = useState<Suggestion[] | null>(null);
  const [boardError, setBoardError] = useState("");
  const boardLoadedRef = useRef(false);

  const [archive, setArchive] = useState<ArchiveItem[] | null>(null);
  const [archiveError, setArchiveError] = useState("");
  const workingLoadedRef = useRef(false);

  const [cycleEnd, setCycleEnd] = useState<number | null>(null);
  const serverOffsetRef = useRef(0);
  const [countdown, setCountdown] = useState("");

  const [nudgeShown, setNudgeShown] = useState(false);
  const [pendingVote, setPendingVote] = useState<string | null>(null); // suggestion id currently being voted on

  const applyCycle = useCallback((cycle?: Cycle) => {
    if (!cycle) return;
    serverOffsetRef.current = Date.now() - cycle.serverNow;
    setCycleEnd(cycle.cycleEnd);
    // If the server just reset the cycle while we were open (or on this
    // load), the board and archive are both stale — force a reload.
    if (cycle.justReset) {
      boardLoadedRef.current = false;
      workingLoadedRef.current = false;
    }
  }, []);

  const loadBoard = useCallback(async () => {
    setBoard(null);
    setBoardError("");
    try {
      const data = await publicFetch<{ suggestions: Suggestion[]; cycle: Cycle }>("feedback-list-top", { limit: 50 });
      boardLoadedRef.current = true;
      applyCycle(data.cycle);
      setBoard(data.suggestions || []);
    } catch (err: any) {
      setBoard([]);
      setBoardError(err.message || "Could not load suggestions");
    }
  }, [applyCycle]);

  const loadWorking = useCallback(async () => {
    setArchive(null);
    setArchiveError("");
    try {
      const data = await publicFetch<{ items: ArchiveItem[] }>("feedback-list-archive", { limit: 300 });
      workingLoadedRef.current = true;
      setArchive(data.items || []);
    } catch (err: any) {
      setArchive([]);
      setArchiveError(err.message || "Could not load this right now — try again in a bit.");
    }
  }, []);

  const refreshCycle = useCallback(async () => {
    try {
      const data = await publicFetch<Cycle>("feedback-get-cycle", {});
      applyCycle(data);
    } catch (err) {
      console.error("[feedback] cycle check failed:", (err as Error).message);
    }
  }, [applyCycle]);

  // Paint the countdown right away, same as the original — don't make
  // people open the board tab first to see it.
  useEffect(() => {
    refreshCycle();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // ── 7-day countdown ticker ──
  useEffect(() => {
    if (cycleEnd == null) return;
    function tick() {
      const localNow = Date.now() - serverOffsetRef.current;
      let msLeft = cycleEnd! - localNow;
      if (msLeft <= 0) {
        refreshCycle();
        return;
      }
      const d = Math.floor(msLeft / 86400000);
      msLeft -= d * 86400000;
      const h = Math.floor(msLeft / 3600000);
      msLeft -= h * 3600000;
      const m = Math.floor(msLeft / 60000);
      msLeft -= m * 60000;
      const s = Math.floor(msLeft / 1000);
      setCountdown(`${pad(d)}d ${pad(h)}h ${pad(m)}m ${pad(s)}s`);
    }
    tick();
    const t = setInterval(tick, 1000);
    return () => clearInterval(t);
  }, [cycleEnd, refreshCycle]);

  // ── Daily random nudge — signed-in users only, small random delay ──
  useEffect(() => {
    let timer: ReturnType<typeof setTimeout> | undefined;
    async function checkNudge(uid: string) {
      const delay = 10000 + Math.random() * 80000;
      timer = setTimeout(async () => {
        if (open) return; // already in there
        try {
          const data = await authedFetch<{ shouldShow: boolean }>("check-nudge");
          if (data.shouldShow) setNudgeShown(true);
        } catch (err) {
          console.error("[feedback] nudge check failed:", (err as Error).message);
        }
      }, delay);
    }
    const unsub = auth.onAuthStateChanged((u) => {
      if (u) checkNudge(u.uid);
    });
    return () => {
      unsub();
      if (timer) clearTimeout(timer);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  function openModal() {
    setOpen(true);
    setNudgeShown(false);
    refreshCycle();
    if (!boardLoadedRef.current) loadBoard();
  }
  function closeModal() {
    setOpen(false);
  }

  function showPane(which: Pane) {
    setPane(which);
    if (which === "board" && !boardLoadedRef.current) loadBoard();
    if (which === "working" && !workingLoadedRef.current) loadWorking();
  }

  async function handleSubmit() {
    const trimmed = text.trim();
    setStatus({ kind: "idle", msg: "" });
    if (trimmed.length < 4) {
      setStatus({ kind: "err", msg: "Tell us a bit more first." });
      return;
    }
    setSubmitting(true);
    try {
      const data = await authedFetch<{ message?: string }>("feedback-submit", { text: trimmed });
      setStatus({ kind: "ok", msg: data.message || "Thanks!" });
      setText("");
      boardLoadedRef.current = false; // force refresh next time board is viewed
    } catch (err: any) {
      setStatus({ kind: "err", msg: err.message || "Something went wrong." });
    } finally {
      setSubmitting(false);
    }
  }

  async function handleVote(suggestionId: string, score: number) {
    setPendingVote(suggestionId);
    try {
      const data = await authedFetch<{ totalScore: number; voteCount: number; breakdown: Record<string, number> }>(
        "feedback-vote-existing",
        { suggestionId, score }
      );
      setBoard((prev) =>
        (prev || []).map((s) =>
          s.id === suggestionId
            ? { ...s, myVote: score, totalScore: data.totalScore, voteCount: data.voteCount, breakdown: data.breakdown }
            : s
        )
      );
    } catch (err) {
      console.error("[feedback] vote failed:", (err as Error).message);
    } finally {
      setPendingVote(null);
    }
  }

  return (
    <>
      <button id="fbLauncher" type="button" onClick={openModal} aria-label="Give feedback">
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2}>
          <path d="M21 15a2 2 0 01-2 2H7l-4 4V5a2 2 0 012-2h14a2 2 0 012 2z" />
        </svg>
        Feedback
      </button>

      {nudgeShown ? (
        <div id="fbNudge" className="fb-show">
          <div className="fb-nudge-txt">Got a minute? We&apos;d love to hear what you think could be better.</div>
          <div className="fb-nudge-row">
            <button
              className="fb-nudge-yes"
              type="button"
              onClick={() => {
                setNudgeShown(false);
                openModal();
              }}
            >
              Sure
            </button>
            <button className="fb-nudge-no" type="button" onClick={() => setNudgeShown(false)}>
              Not now
            </button>
          </div>
        </div>
      ) : null}

      {open ? (
        <FeedbackModal
          pane={pane}
          onShowPane={showPane}
          onClose={closeModal}
          explainerOpen={explainerOpen}
          onToggleExplainer={() => setExplainerOpen((v) => !v)}
          countdown={countdown}
          text={text}
          onTextChange={setText}
          status={status}
          submitting={submitting}
          onSubmit={handleSubmit}
          board={board}
          boardError={boardError}
          onRetryBoard={loadBoard}
          pendingVote={pendingVote}
          onVote={handleVote}
          archive={archive}
          archiveError={archiveError}
          onRetryArchive={loadWorking}
        />
      ) : null}
    </>
  );
}

function FeedbackModal({
  pane,
  onShowPane,
  onClose,
  explainerOpen,
  onToggleExplainer,
  countdown,
  text,
  onTextChange,
  status,
  submitting,
  onSubmit,
  board,
  boardError,
  onRetryBoard,
  pendingVote,
  onVote,
  archive,
  archiveError,
  onRetryArchive,
}: {
  pane: Pane;
  onShowPane: (p: Pane) => void;
  onClose: () => void;
  explainerOpen: boolean;
  onToggleExplainer: () => void;
  countdown: string;
  text: string;
  onTextChange: (v: string) => void;
  status: { kind: "idle" | "ok" | "err"; msg: string };
  submitting: boolean;
  onSubmit: () => void;
  board: Suggestion[] | null;
  boardError: string;
  onRetryBoard: () => void;
  pendingVote: string | null;
  onVote: (id: string, score: number) => void;
  archive: ArchiveItem[] | null;
  archiveError: string;
  onRetryArchive: () => void;
}) {
  // Local scroll lock — see the top-of-file note on why this doesn't use
  // a shared helper yet.
  useEffect(() => {
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = prev;
    };
  }, []);

  useEffect(() => {
    function onKeyDown(e: KeyboardEvent) {
      if (e.key === "Escape") onClose();
    }
    document.addEventListener("keydown", onKeyDown);
    return () => document.removeEventListener("keydown", onKeyDown);
  }, [onClose]);

  return (
    <div
      id="feedbackModal"
      className="fb-modal active"
      role="dialog"
      aria-modal="true"
      aria-label="Feedback"
      style={{
        position: "fixed",
        inset: 0,
        zIndex: 9995,
        display: "flex",
        alignItems: "flex-end",
        justifyContent: "center",
        background: "rgba(0,0,0,.6)",
      }}
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div
        style={{
          width: "100%",
          maxWidth: 480,
          maxHeight: "88vh",
          overflowY: "auto",
          background: "#0b0b12",
          border: "1px solid rgba(255,255,255,.1)",
          borderRadius: "18px 18px 0 0",
          padding: "20px 18px 26px",
        }}
      >
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 14 }}>
          <div style={{ fontSize: 16, fontWeight: 800, color: "#f0f0f5" }}>Feedback</div>
          <button
            id="fbCloseBtn"
            type="button"
            aria-label="Close"
            onClick={onClose}
            style={{
              background: "none",
              border: "none",
              color: "rgba(255,255,255,.5)",
              cursor: "pointer",
              padding: 4,
            }}
          >
            <svg width={18} height={18} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2.4}>
              <line x1={18} y1={6} x2={6} y2={18} />
              <line x1={6} y1={6} x2={18} y2={18} />
            </svg>
          </button>
        </div>

        {countdown ? (
          <div className="fb-countdown">
            <div>
              <div className="fb-countdown-label">Voting round ends in</div>
              <div className="fb-countdown-clock" id="fbCountdownClock">
                {countdown}
              </div>
            </div>
            <div className="fb-countdown-sub">Top 3 ideas move to &quot;Working On&quot; each week.</div>
          </div>
        ) : null}

        <div className={`fb-explainer${explainerOpen ? "" : " fb-explainer-collapsed"}`}>
          <div className="fb-explainer-title">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2}>
              <circle cx={12} cy={12} r={10} />
              <path d="M9.5 9a2.5 2.5 0 015 .5c0 1.5-2 2-2 3.5" />
              <path d="M12 17h.01" />
            </svg>
            How this works
          </div>
          <ol>
            <li>Submit an idea, or vote on existing ones below.</li>
            <li>Every 7 days, the top 3 ideas by score move to &quot;Working On&quot;.</li>
            <li>The board then clears and a new round starts.</li>
          </ol>
          <button className="fb-explainer-toggle" type="button" onClick={onToggleExplainer}>
            {explainerOpen ? "Show less" : "Show more"}
          </button>
        </div>

        <div className="fb-tabs">
          <button
            className={`fb-tab${pane === "compose" ? " fb-active" : ""}`}
            type="button"
            onClick={() => onShowPane("compose")}
          >
            Suggest
          </button>
          <button className={`fb-tab${pane === "board" ? " fb-active" : ""}`} type="button" onClick={() => onShowPane("board")}>
            Vote
          </button>
          <button
            className={`fb-tab${pane === "working" ? " fb-active" : ""}`}
            type="button"
            onClick={() => onShowPane("working")}
          >
            Working On
          </button>
        </div>

        {pane === "compose" ? (
          <div className="fb-compose">
            <textarea
              className="fb-textarea"
              placeholder="What should we build or fix?"
              value={text}
              maxLength={500}
              onChange={(e) => onTextChange(e.target.value)}
            />
            <div className="fb-char-count">{text.length}</div>
            <button className="fb-submit-btn" type="button" disabled={submitting} onClick={onSubmit}>
              {submitting ? "Sending…" : "Send suggestion"}
            </button>
            <div className={`fb-status${status.kind === "idle" ? "" : ` ${status.kind}`}`}>{status.msg}</div>
          </div>
        ) : null}

        {pane === "board" ? (
          <div className="fb-board">
            {board === null ? (
              <>
                <div className="fb-board-skel" />
                <div className="fb-board-skel" />
                <div className="fb-board-skel" />
              </>
            ) : boardError ? (
              <>
                <div className="fb-board-empty">Couldn&apos;t load the board right now — try again in a bit.</div>
                <button className="fb-submit-btn" type="button" onClick={onRetryBoard} style={{ marginTop: 10 }}>
                  Retry
                </button>
              </>
            ) : board.length === 0 ? (
              <div className="fb-board-empty">No suggestions yet — be the first!</div>
            ) : (
              board.map((s, i) => (
                <div className="fb-board-item" key={s.id}>
                  <div className="fb-board-score-row">
                    {i < 3 ? <span className="fb-board-rank">#{i + 1} — moves to &quot;working on&quot;</span> : <span />}
                    <span className="fb-board-score">
                      <span className="fb-board-score-n">
                        {s.totalScore > 0 ? "+" : ""}
                        {s.totalScore}
                      </span>{" "}
                      pts · {s.voteCount} vote{s.voteCount === 1 ? "" : "s"}
                    </span>
                  </div>
                  <div className="fb-board-txt">{s.text}</div>
                  <div className="fb-vote-row">
                    {VOTE_OPTIONS.map((opt) => (
                      <button
                        key={opt.score}
                        className={`fb-vote-btn${s.myVote === opt.score ? " fb-vote-selected" : ""}`}
                        data-score={opt.score}
                        type="button"
                        disabled={pendingVote === s.id}
                        style={pendingVote === s.id ? { pointerEvents: "none" } : undefined}
                        onClick={() => onVote(s.id, opt.score)}
                      >
                        <span className="fb-vote-label">{opt.label}</span>
                        <span className="fb-vote-count">{(s.breakdown && s.breakdown[opt.key]) || 0}</span>
                      </button>
                    ))}
                  </div>
                </div>
              ))
            )}
          </div>
        ) : null}

        {pane === "working" ? (
          <div className="fb-board">
            {archive === null ? (
              <>
                <div className="fb-board-skel" />
                <div className="fb-board-skel" />
                <div className="fb-board-skel" />
              </>
            ) : archiveError ? (
              <>
                <div className="fb-board-empty">Couldn&apos;t load this right now — try again in a bit.</div>
                <button className="fb-submit-btn" type="button" onClick={onRetryArchive} style={{ marginTop: 10 }}>
                  Retry
                </button>
              </>
            ) : archive.length === 0 ? (
              <div className="fb-board-empty">Nothing here yet — check back after the first 7-day round ends!</div>
            ) : (
              groupArchiveByWeek(archive).map((week, wi) => (
                <div key={wi}>
                  <div className="fb-archive-week-label">{week.label}</div>
                  {week.items.map((item, ii) => (
                    <div className="fb-archive-item" key={ii}>
                      <div className="fb-archive-badge">#{ii + 1}</div>
                      <div>
                        <div className="fb-archive-txt">{item.text}</div>
                        <div className="fb-archive-score">
                          Finished with {item.totalScore > 0 ? "+" : ""}
                          {item.totalScore} pts · {item.voteCount} vote{item.voteCount === 1 ? "" : "s"}
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              ))
            )}
          </div>
        ) : null}
      </div>
    </div>
  );
}

// Groups archive items into weekly batches of 3 (archived 3-at-a-time,
// newest batch first since items already arrive sorted desc) — same
// logic as fbRenderWorking in the original.
function groupArchiveByWeek(items: ArchiveItem[]) {
  const weeks: { label: string; items: ArchiveItem[] }[] = [];
  for (let i = 0; i < items.length; i += 3) {
    const batch = items.slice(i, i + 3);
    const label = batch[0].archivedAt
      ? new Date(batch[0].archivedAt).toLocaleDateString(undefined, { month: "short", day: "numeric", year: "numeric" })
      : "";
    weeks.push({ label: `Week of ${label}`, items: batch });
  }
  return weeks;
}
