"use client";

import React, { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { useAuth } from "@/lib/AuthContext";
import { useConfirm } from "@/lib/useConfirm";
import {
  useDealChat,
  countdownParts,
  verifyCountdownText,
  deleteCountdownText,
  type DealMessage,
  type PaymentStatus,
} from "@/lib/useDealChat";
import { doc, deleteDoc, collection, getDocs, writeBatch, addDoc } from "firebase/firestore";
import { db, auth } from "@/lib/firebase";
import TransferDealModal from "./TransferDealModal";

// Ports the deal chat panel from Js/inbox.js (lines 937-2774): sticky
// item bar, escrow announcement bar + actions (pay/release/dispute),
// message list (text/image/link/file/transfer_zip bubbles), send box
// with attach menu, hamburger menu (report/cancel), countdowns, and the
// terminal outcome banner. The Transfer Deal checklist modal ("Mark
// Delivered" / "Transfer Deal") this panel opens into now lives in its
// own component, TransferDealModal.tsx — both buttons below open it.

const IMGUR_CLIENT_ID = "546c25a59c58ad7";

function fmtTime(ms: number): string {
  if (!ms) return "";
  return new Date(ms).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
}

function priceLabel(escrowAmount: number | null, listingPrice: number | null): string {
  const amt = escrowAmount ?? listingPrice;
  return amt != null ? "$" + Number(amt).toLocaleString() : "the agreed amount";
}

export default function DealChatPanel({ chatRoomId }: { chatRoomId: string }) {
  const router = useRouter();
  const { user } = useAuth();
  const chat = useDealChat(chatRoomId);
  const { confirm, prompt, alert, ConfirmHost } = useConfirm();

  const [input, setInput] = useState("");
  const [menuOpen, setMenuOpen] = useState(false);
  const [ctaBusy, setCtaBusy] = useState(false);
  const [deleteAfterCancel, setDeleteAfterCancel] = useState<{ deleteAt: number } | null>(null);
  const [deleteCountdown, setDeleteCountdown] = useState("");
  const [transferModalOpen, setTransferModalOpen] = useState(false);

  const messagesRef = useRef<HTMLDivElement>(null);
  const imageInputRef = useRef<HTMLInputElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const isSeller = !!(user && chat.room && user.uid === chat.room.sellerUid);

  useEffect(() => {
    const el = messagesRef.current;
    if (!el) return;
    const nearBottom = el.scrollHeight - el.scrollTop - el.clientHeight < 120;
    if (nearBottom) el.scrollTop = el.scrollHeight;
  }, [chat.messages]);

  useEffect(() => {
    if (!chat.room?.cancelled || chat.room.paymentStatus === "complete") {
      setDeleteAfterCancel(null);
      return;
    }
    const deleteAt = chat.room.deleteAt || (chat.room.cancelledAt || Date.now()) + 30 * 60 * 1000;
    setDeleteAfterCancel({ deleteAt });
  }, [chat.room?.cancelled, chat.room?.deleteAt, chat.room?.cancelledAt, chat.room?.paymentStatus]);

  useEffect(() => {
    if (!deleteAfterCancel) return;
    function tick() {
      const ms = deleteAfterCancel!.deleteAt - Date.now();
      if (ms <= 0) {
        setDeleteCountdown("deleting chat…");
        (async () => {
          try {
            const msgsSnap = await getDocs(collection(db, "dealChats", chatRoomId, "messages"));
            const batch = writeBatch(db);
            msgsSnap.forEach((m) => batch.delete(doc(db, "dealChats", chatRoomId, "messages", m.id)));
            await batch.commit().catch(() => {});
            if (chat.room?.sellerUid) await deleteDoc(doc(db, "users", chat.room.sellerUid, "threads", chatRoomId)).catch(() => {});
            if (chat.room?.buyerUid) await deleteDoc(doc(db, "users", chat.room.buyerUid, "threads", chatRoomId)).catch(() => {});
            await deleteDoc(doc(db, "dealChats", chatRoomId)).catch(() => {});
          } catch (e) {
            console.warn("auto-delete cancelled chat", e);
          }
          router.push("/messages?tab=deals");
        })();
        return;
      }
      setDeleteCountdown(deleteCountdownText(deleteAfterCancel!.deleteAt));
    }
    tick();
    const id = setInterval(tick, 1000);
    return () => clearInterval(id);
  }, [deleteAfterCancel, chatRoomId, chat.room, router]);

  function closeChat() {
    router.push("/messages?tab=deals");
  }

  async function handleSend() {
    const text = input;
    if (!text.trim()) return;
    if (chat.locked.locked) return;
    setInput("");
    const result = await chat.sendMessage(text);
    if (result?.blocked) {
      setInput(text);
      await alert({
        theme: "danger",
        title: "Message not sent",
        msg: "This looks like it may be a scam attempt: " + result.blocked + " Never pay or share credentials outside Siterifty's escrow flow.",
      });
    }
  }

  async function handlePay() {
    if (!chat.room) return;
    const amount = chat.room.escrowAmount ?? chat.room.listingPrice;
    if (!amount || amount <= 0) {
      await alert({ theme: "danger", title: "No amount set", msg: "Could not determine the deal amount. Please contact support." });
      return;
    }
    if (!chat.room.dealId) {
      await alert({ theme: "danger", title: "Missing deal info", msg: "This chat is missing its deal reference. Please reopen it from your Deals inbox." });
      return;
    }
    const ok = await confirm({
      theme: "success",
      title: "Pay Into Escrow",
      msg: `$${Number(amount).toLocaleString()} will be moved from your wallet into escrow for this deal. The seller can deliver once funded, and you'll confirm before it's released.`,
      confirmText: "Pay Now",
    });
    if (!ok) return;
    setCtaBusy(true);
    try {
      await chat.payEscrow(amount);
      await alert({ theme: "success", title: "Payment Sent", msg: `$${Number(amount).toLocaleString()} is now held in escrow. The seller has been notified.` });
    } catch (err) {
      await alert({ theme: "danger", title: "Payment Failed", msg: err instanceof Error ? err.message : "Something went wrong. Please try again." });
    } finally {
      setCtaBusy(false);
    }
  }

  async function handleRelease() {
    if (!chat.room) return;
    const label = priceLabel(chat.room.escrowAmount, chat.room.listingPrice);
    const ok = await confirm({
      theme: "success",
      title: "Release Funds",
      msg: `Confirm you've received and verified the item. This will release ${label} to the seller and cannot be undone from here — if there's a problem, raise a dispute instead.`,
      confirmText: "Release Funds",
    });
    if (!ok) return;
    setCtaBusy(true);
    try {
      await chat.releaseEscrow();
      await alert({ theme: "success", title: "Funds Released", msg: "The deal is now complete. Thanks for using Siterifty!" });
    } catch (err) {
      await alert({ theme: "danger", title: "Failed", msg: err instanceof Error ? err.message : "Something went wrong. Please try again." });
    } finally {
      setCtaBusy(false);
    }
  }

  async function handleDispute() {
    const reason = await prompt({
      theme: "warning",
      title: "Raise A Dispute",
      msg: "Briefly describe the issue. This freezes the escrowed funds and our team will review within 24-48 hours.",
      inputPlaceholder: "What went wrong?",
      confirmText: "Submit Dispute",
    });
    if (!reason) return;
    try {
      await chat.raiseDispute(reason);
      await alert({ theme: "warning", title: "Dispute Submitted", msg: "Funds are frozen and our team will review within 24-48 hours." });
    } catch (err) {
      await alert({ theme: "danger", title: "Failed", msg: err instanceof Error ? err.message : "Something went wrong. Please try again." });
    }
  }

  async function handleRemindBuyer() {
    if (!chat.room) return;
    const label = priceLabel(chat.room.escrowAmount, chat.room.listingPrice);
    setCtaBusy(true);
    try {
      await chat.remindBuyer(label);
      await alert({ theme: "success", title: "Request Sent", msg: "The buyer has been notified to complete payment." });
    } catch {
      await alert({ theme: "danger", title: "Failed", msg: "Could not send the request. Please try again." });
    } finally {
      setCtaBusy(false);
    }
  }

  async function handleCancelDeal() {
    const ok = await confirm({
      theme: "danger",
      title: "Cancel Deal",
      msg: "This will permanently end the deal chat and mark the deal as cancelled. This action cannot be undone.",
      confirmText: "Cancel Deal",
    });
    if (!ok) return;
    try {
      await chat.cancelDeal();
    } catch {
      await alert({ theme: "warning", title: "Action Failed", msg: "Could not cancel the deal. Please check your connection and try again." });
    }
  }

  async function handleReportUser() {
    if (!user || !chat.room) return;
    const otherUid = user.uid === chat.room.sellerUid ? chat.room.buyerUid : chat.room.sellerUid;
    const ok = await confirm({
      theme: "report",
      title: "Report User",
      msg: "Our team will review this deal and take action if needed. False reports may result in account restrictions.",
      confirmText: "Report",
    });
    if (!ok) return;
    try {
      const reportRef = await addDoc(collection(db, "reports"), {
        reporterUid: user.uid,
        reportedUid: otherUid || "",
        chatRoomId,
        reason: "deal_chat_report",
        status: "open",
        createdAt: Date.now(),
      });
      const idToken = await user.getIdToken();
      fetch("/api/aistudio", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "triage-report",
          idToken,
          reportId: reportRef.id,
          evidence: { reporterUid: user.uid, reportedUid: otherUid || "", chatRoomId, reason: "deal_chat_report" },
        }),
      }).catch(() => {});
    } catch (err) {
      console.warn("report write", err);
    }
    await alert({ theme: "report", title: "Report Submitted", msg: "Our team will review this within 24 hours. Thank you for keeping Siterifty safe." });
  }

  async function handleImagePick(file: File) {
    if (!chat.room || !user) return;
    try {
      const fd = new FormData();
      fd.append("image", file);
      const res = await fetch("https://api.imgur.com/3/image", { method: "POST", headers: { Authorization: "Client-ID " + IMGUR_CLIENT_ID }, body: fd });
      const json = await res.json();
      if (!json.success) {
        await alert({ theme: "warning", title: "Upload Failed", msg: "The image could not be uploaded. Please try a different file." });
        return;
      }
      const now = Date.now();
      await addDoc(collection(db, "dealChats", chatRoomId, "messages"), { uid: user.uid, type: "image", imageUrl: json.data.link, createdAt: now });
      await chat.syncThreads("📷 Image", chat.room.sellerUid, chat.room.buyerUid);
    } catch (e) {
      console.error("DCP image upload error:", e);
      await alert({ theme: "warning", title: "Upload Failed", msg: "Something went wrong uploading your image. Please try again." });
    }
  }

  async function uploadOneFile(file: File) {
    if (!user || !chat.room) return;
    if (file.type.startsWith("image/")) {
      await handleImagePick(file);
      return;
    }
    const ext = (file.name.match(/\.([a-zA-Z0-9]+)$/) || ["", ""])[1].toLowerCase();
    const textExts = ["html", "htm", "css", "js", "mjs", "json", "txt", "md", "svg"];
    const idToken = await user.getIdToken();

    let body: Record<string, string>;
    if (textExts.includes(ext)) {
      const text = await file.text();
      body = { filename: file.name, content: text, encoding: "utf8" };
    } else {
      const base64 = await new Promise<string>((resolve, reject) => {
        const r = new FileReader();
        r.onload = () => resolve((r.result as string).split(",")[1]);
        r.onerror = () => reject(new Error("Read failed"));
        r.readAsDataURL(file);
      });
      body = { filename: file.name, content: base64, encoding: "base64" };
    }

    const res = await fetch("/api/storage", {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${idToken}` },
      body: JSON.stringify(body),
    });
    const json = await res.json();
    if (!res.ok) throw new Error(json.error || "The file could not be uploaded.");

    const now = Date.now();
    if (json.storagePath) {
      await addDoc(collection(db, "dealChats", chatRoomId, "messages"), {
        uid: user.uid, type: "transfer_zip", fileName: file.name, storagePath: json.storagePath, fileSize: json.size || file.size, createdAt: now,
      }).catch(() => {});
    } else {
      await addDoc(collection(db, "dealChats", chatRoomId, "messages"), { uid: user.uid, type: "file", fileName: file.name, fileUrl: json.url, createdAt: now }).catch(() => {});
    }
    await chat.syncThreads("📎 " + file.name, chat.room.sellerUid, chat.room.buyerUid);
  }

  async function handleFilesPick(files: File[]) {
    const isCodeHandoff = chat.room?.transferMethods.includes("html_css_js");
    const toUpload = isCodeHandoff ? files.filter((f) => /\.(html|htm|css|js)$/i.test(f.name)) : files;
    if (!toUpload.length) {
      await alert({ theme: "warning", title: "Unsupported File", msg: "This deal only accepts .html, .css, and .js files." });
      return;
    }
    let failCount = 0;
    for (const file of toUpload) {
      try {
        await uploadOneFile(file);
      } catch (e) {
        console.error("DCP file upload error:", e);
        failCount++;
      }
    }
    if (failCount > 0) {
      await alert({
        theme: "warning",
        title: "Upload Failed",
        msg: failCount === toUpload.length ? "Something went wrong uploading your file(s). Please try again." : `${failCount} of ${toUpload.length} file(s) failed to upload. Please try again for those.`,
      });
    }
  }

  if (!user) {
    return (
      <div style={{ position: "fixed", inset: 0, background: "#06060e", display: "flex", alignItems: "center", justifyContent: "center", color: "#fff" }}>
        Sign in to view this chat.
      </div>
    );
  }

  const room = chat.room;

  return (
    <div id="dealChatPanel" style={{ display: "flex" }}>
      <ConfirmHost />
      {transferModalOpen && room ? (
        <TransferDealModal
          chatRoomId={chatRoomId}
          sellerUid={room.sellerUid}
          buyerUid={room.buyerUid}
          listingId={room.listingId || null}
          dealId={room.dealId || null}
          paymentStatus={room.paymentStatus}
          isSeller={isSeller}
          syncThreads={chat.syncThreads}
          onClose={() => setTransferModalOpen(false)}
        />
      ) : null}
      <div className="dcp-box">
        <div className="dcp-header">
          <div className="dcp-header-left">
            <button className="dcp-back-btn" onClick={closeChat} aria-label="Back">
              <svg viewBox="0 0 24 24"><path d="M19 12H5M12 19l-7-7 7-7" /></svg>
            </button>
            <div className="dcp-header-titles">
              <div className="dcp-title">{room?.chatName || "Deal Chat"}</div>
              {room?.expiresAt && !room.cancelled && room.paymentStatus !== "delivered" && room.paymentStatus !== "complete" && room.paymentStatus !== "refunded" ? (
                <HeaderCountdown expiresAt={room.expiresAt} paymentStatus={room.paymentStatus} />
              ) : room?.autoReleaseAt && room.paymentStatus === "delivered" ? (
                <VerifyCountdown autoReleaseAt={room.autoReleaseAt} />
              ) : null}
            </div>
          </div>
          <div style={{ position: "relative" }}>
            <button id="dcpMenuBtn" onClick={() => setMenuOpen((v) => !v)} aria-label="Menu">
              <svg viewBox="0 0 24 24"><circle cx="12" cy="5" r="1" /><circle cx="12" cy="12" r="1" /><circle cx="12" cy="19" r="1" /></svg>
            </button>
            <div id="dcpMenuDropdown" className={menuOpen ? "open" : ""}>
              <button className="dcp-menu-item" onClick={() => { setMenuOpen(false); handleReportUser(); }}>
                <svg viewBox="0 0 24 24"><path d="M4 15s1-1 4-1 5 2 8 2 4-1 4-1V3s-1 1-4 1-5-2-8-2-4 1-4 1z" /><line x1="4" y1="22" x2="4" y2="15" /></svg>
                Report User
              </button>
              {room && !(room.paymentStatus === "complete" || room.paymentStatus === "refunded") && !room.cancelled ? (
                <>
                  <div className="dcp-menu-divider" />
                  <button className="dcp-menu-item danger" onClick={() => { setMenuOpen(false); handleCancelDeal(); }}>
                    <svg viewBox="0 0 24 24"><circle cx="12" cy="12" r="10" /><line x1="15" y1="9" x2="9" y2="15" /><line x1="9" y1="9" x2="15" y2="15" /></svg>
                    End &amp; Cancel Deal
                  </button>
                </>
              ) : room?.paymentStatus === "complete" ? (
                <>
                  <div className="dcp-menu-divider" />
                  <button className="dcp-menu-item dcp-menu-item-exit" onClick={closeChat}>
                    <svg viewBox="0 0 24 24"><path d="M9 21H5a2 2 0 01-2-2V5a2 2 0 012-2h4" /><path d="M16 17l5-5-5-5" /><path d="M21 12H9" /></svg>
                    Exit Chat
                  </button>
                </>
              ) : null}
            </div>
          </div>
        </div>

        {room ? <ItemBar room={room} /> : null}

        {room && !room.cancelled && !deleteAfterCancel ? (
          <AnnouncementBar
            room={room}
            isSeller={isSeller}
            busy={ctaBusy}
            onPay={handlePay}
            onRelease={handleRelease}
            onDispute={handleDispute}
            onRemindBuyer={handleRemindBuyer}
            onMarkDelivered={() => setTransferModalOpen(true)}
          />
        ) : null}

        <div id="dcpMessages" ref={messagesRef}>
          {chat.chatError ? <div style={{ padding: "0.55rem 1rem", textAlign: "center", color: "#fecaca", fontSize: "0.75rem", fontWeight: 600, background: "#3f1d1d" }}>{chat.chatError}</div> : null}
          {chat.messagesLoading ? (
            <div style={{ padding: "1.5rem", textAlign: "center", color: "rgba(255,255,255,0.25)", fontSize: "0.8rem" }}>Loading…</div>
          ) : chat.messages.length === 0 ? (
            <div style={{ padding: "1.5rem", textAlign: "center", color: "rgba(255,255,255,0.2)", fontSize: "0.8rem" }}>No messages yet.</div>
          ) : (
            chat.messages.map((m) => (
              <MessageRow
                key={m.id}
                m={m}
                currentUid={user.uid}
                chatRoomId={chatRoomId}
                dealId={room?.dealId || null}
                onDelete={chat.deleteMessage}
                onReport={() => alert({ theme: "report", title: "Message Reported", msg: "Our moderation team will review this message within 24 hours." })}
              />
            ))
          )}
        </div>

        {chat.outcome ? (
          <div id="dcpExpiredBanner" className={chat.outcome.outcome === "successful" ? "dcp-outcome-successful" : "dcp-outcome-closed"} style={{ display: "flex" }}>
            {chat.outcome.outcome === "successful"
              ? chat.outcome.auto
                ? "✅ Deal Successful — the 72-hour verification window passed and funds were automatically released to the seller."
                : "✅ Deal Successful — the buyer confirmed receipt and funds were released to the seller."
              : chat.outcome.auto
              ? "🔒 Deal Closed — the 14-day delivery deadline passed without the deal being completed."
              : "🔒 Deal Closed — this deal was refunded and is now closed."}
          </div>
        ) : deleteAfterCancel ? (
          <div id="dcpExpiredBanner" style={{ display: "flex" }}>This deal was cancelled — {deleteCountdown || "chat will be deleted shortly."}</div>
        ) : chat.locked.locked ? (
          <div id="dcpExpiredBanner" style={{ display: "flex" }}>
            {chat.locked.reason === "cancelled" ? "This deal was cancelled — the chat is now closed." : "This deal chat expired — the delivery deadline passed and the deal was auto-closed."}
          </div>
        ) : null}

        {!chat.locked.locked && !chat.outcome && !deleteAfterCancel ? (
          <div id="dcpInputRow">
            <div id="dcpAttachRow">
              <button className="dcp-attach-pill" onClick={() => imageInputRef.current?.click()}>
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect x="3" y="3" width="18" height="18" rx="2" /><circle cx="8.5" cy="8.5" r="1.5" /><path d="M21 15l-5-5L5 21" /></svg>
                Image
              </button>
              <button className="dcp-attach-pill" onClick={() => fileInputRef.current?.click()}>
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M14 2H6a2 2 0 00-2 2v16a2 2 0 002 2h12a2 2 0 002-2V8z" /><polyline points="14 2 14 8 20 8" /></svg>
                File
              </button>
              {isSeller ? (
                <button id="dcpOptTransfer" className="dcp-attach-pill" onClick={() => setTransferModalOpen(true)}>
                  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M17 1l4 4-4 4" /><path d="M3 11V9a4 4 0 014-4h14" /><path d="M7 23l-4-4 4-4" /><path d="M21 13v2a4 4 0 01-4 4H3" /></svg>
                  Transfer Deal
                </button>
              ) : null}
            </div>
            <div id="dcpInputInner">
              <div className="dcp-textarea-wrap">
                <textarea
                  id="dcpInput"
                  placeholder="Message…"
                  value={input}
                  disabled={chat.sending}
                  onChange={(e) => setInput(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === "Enter" && !e.shiftKey) {
                      e.preventDefault();
                      handleSend();
                    }
                  }}
                  rows={1}
                />
                <button id="dcpSendBtn" onClick={handleSend} aria-label="Send">
                  <svg viewBox="0 0 24 24"><line x1="22" y1="2" x2="11" y2="13" /><polygon points="22 2 15 22 11 13 2 9 22 2" /></svg>
                </button>
              </div>
            </div>
          </div>
        ) : null}

        <input
          ref={imageInputRef}
          type="file"
          accept="image/*"
          hidden
          onChange={(e) => {
            const f = e.target.files?.[0];
            e.target.value = "";
            if (f) handleImagePick(f);
          }}
        />
        <input
          ref={fileInputRef}
          type="file"
          multiple={chat.room?.transferMethods.includes("html_css_js")}
          accept={chat.room?.transferMethods.includes("html_css_js") ? ".html,.htm,.css,.js" : "image/*,application/pdf,.doc,.docx,.txt,.zip,.html,.htm,.css,.js,.mjs,.json,.md,.svg"}
          hidden
          onChange={(e) => {
            const files = Array.from(e.target.files || []);
            e.target.value = "";
            if (files.length) handleFilesPick(files);
          }}
        />
      </div>
    </div>
  );
}

function HeaderCountdown({ expiresAt, paymentStatus }: { expiresAt: number; paymentStatus: PaymentStatus }) {
  const [text, setText] = useState(() => countdownParts(expiresAt - Date.now()));
  useEffect(() => {
    if (["delivered", "complete", "refunded"].includes(paymentStatus)) return;
    function tick() {
      const ms = expiresAt - Date.now();
      setText(ms <= 0 ? "Expired" : countdownParts(ms));
    }
    tick();
    const id = setInterval(tick, 30000);
    return () => clearInterval(id);
  }, [expiresAt, paymentStatus]);
  const remaining = expiresAt - Date.now();
  const color = remaining <= 0 ? "#f87171" : remaining < 43200000 ? "#f87171" : remaining < 172800000 ? "#fbbf24" : "#a3e635";
  return <div className="dcp-countdown" style={{ color }}>⏱ {text}</div>;
}

function VerifyCountdown({ autoReleaseAt }: { autoReleaseAt: number }) {
  const [text, setText] = useState(() => verifyCountdownText(autoReleaseAt));
  useEffect(() => {
    function tick() {
      setText(verifyCountdownText(autoReleaseAt));
    }
    tick();
    const id = setInterval(tick, 30000);
    return () => clearInterval(id);
  }, [autoReleaseAt]);
  const color = autoReleaseAt - Date.now() < 21600000 ? "#fbbf24" : "#a3e635";
  return <div className="dcp-countdown" style={{ color }}>⏱ {text}</div>;
}

function ItemBar({ room }: { room: { listingTitle: string; listingImage: string; listingPrice: number | null; listingId: string; chatName: string } }) {
  const price = room.listingPrice != null ? "$" + Number(room.listingPrice).toLocaleString() : "";
  return (
    <div id="dcpItemBar">
      {room.listingImage ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img id="dcpItemThumb" src={room.listingImage} alt="" style={{ display: "block" }} onError={(e) => (e.currentTarget.style.display = "none")} />
      ) : (
        <div id="dcpItemThumbFallback">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="10" /></svg>
        </div>
      )}
      <div id="dcpItemInfo">
        <div id="dcpItemTitle">{room.listingTitle || room.chatName || "Listing"}</div>
        <div id="dcpItemPrice">{price}</div>
      </div>
      {room.listingId ? (
        <a id="dcpViewListingBtn" href={`/listing/${room.listingId}`} target="_blank" rel="noopener noreferrer">
          View Listing
        </a>
      ) : null}
    </div>
  );
}

function AnnouncementBar({
  room,
  isSeller,
  busy,
  onPay,
  onRelease,
  onDispute,
  onRemindBuyer,
  onMarkDelivered,
}: {
  room: { paymentStatus: PaymentStatus; escrowAmount: number | null; listingPrice: number | null };
  isSeller: boolean;
  busy: boolean;
  onPay: () => void;
  onRelease: () => void;
  onDispute: () => void;
  onRemindBuyer: () => void;
  onMarkDelivered: () => void;
}) {
  const status = room.paymentStatus;
  if (status === "complete" || status === "refunded") return null;
  const price = priceLabel(room.escrowAmount, room.listingPrice);

  const ICON_SHIELD = <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z" />;
  const ICON_CARDS = (
    <>
      <path d="M12 2L2 7l10 5 10-5-10-5z" />
      <path d="M2 17l10 5 10-5" />
      <path d="M2 12l10 5 10-5" />
    </>
  );
  const ICON_BOX = (
    <>
      <rect x="3" y="3" width="18" height="14" rx="2" />
      <path d="M3 9h18" />
      <path d="M9 21l3-3 3 3" />
    </>
  );
  const ICON_CHECK = (
    <>
      <path d="M22 11.08V12a10 10 0 11-5.93-9.14" />
      <polyline points="22 4 12 14.01 9 11.01" />
    </>
  );
  const ICON_ALERT = (
    <>
      <path d="M10.29 3.86L1.82 18a2 2 0 001.71 3h16.94a2 2 0 001.71-3L13.71 3.86a2 2 0 00-3.42 0z" />
      <line x1="12" y1="9" x2="12" y2="13" />
      <line x1="12" y1="17" x2="12.01" y2="17" />
    </>
  );

  let mode: "seller-mode" | "buyer-mode" | "disputed-mode" = isSeller ? "seller-mode" : "buyer-mode";
  let icon: React.ReactNode = null;
  let label = "";
  let msg = "";
  let cta: { text: string; onClick: () => void } | null = null;
  let sub: { text: string; onClick: () => void } | null = null;

  if (status === "unfunded") {
    if (isSeller) {
      icon = ICON_SHIELD;
      label = "Awaiting Payment";
      msg = "Waiting for buyer to pay " + price + " into escrow";
      cta = { text: "Request Payment", onClick: onRemindBuyer };
    } else {
      icon = ICON_CARDS;
      label = "Payment Due";
      msg = "Pay " + price + " into escrow to start the deal";
      cta = { text: "Pay Now", onClick: onPay };
    }
  } else if (status === "funded") {
    if (isSeller) {
      icon = ICON_BOX;
      label = price + " Held In Escrow";
      msg = "Deliver the item, then mark as delivered";
      cta = { text: "Mark Delivered", onClick: onMarkDelivered };
      sub = { text: "Something wrong? Raise a dispute", onClick: onDispute };
    } else {
      icon = ICON_SHIELD;
      label = price + " Held In Escrow";
      msg = "Waiting for seller to deliver";
      sub = { text: "Something wrong? Raise a dispute", onClick: onDispute };
    }
  } else if (status === "delivered") {
    if (isSeller) {
      icon = ICON_BOX;
      label = "Delivered";
      msg = "Waiting for buyer to confirm and release " + price + " (auto-releases in 72h if no response)";
    } else {
      icon = ICON_CHECK;
      label = "Confirm Receipt";
      msg = "Release " + price + " to the seller once everything checks out — have questions first? Just ask in the chat.";
      cta = { text: "Release Funds", onClick: onRelease };
      sub = { text: "Not what you expected? Raise a dispute", onClick: onDispute };
    }
  } else if (status === "disputed") {
    mode = "disputed-mode";
    icon = ICON_ALERT;
    label = "Dispute Open";
    msg = "Funds are frozen while our team reviews this deal (24-48 hrs)";
  } else {
    return null;
  }

  return (
    <div id="dcpAnnouncementBar" className={mode}>
      <div className="dcp-ann-icon">
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">{icon}</svg>
      </div>
      <div className="dcp-ann-text">
        <div className="dcp-ann-label">{label}</div>
        <div className="dcp-ann-msg">{msg}</div>
        {sub ? (
          <div className="dcp-ann-sub-link" onClick={sub.onClick}>
            {sub.text}
          </div>
        ) : null}
      </div>
      {cta ? (
        <button className="dcp-ann-cta" disabled={busy} onClick={cta.onClick}>
          {busy ? "Processing…" : cta.text}
        </button>
      ) : null}
    </div>
  );
}

function stripEmoji(text: string): string {
  return (text || "").replace(/[\u{1F300}-\u{1FAFF}\u{2600}-\u{27BF}\u{2190}-\u{21FF}]\uFE0F?/gu, "").replace(/\s{2,}/g, " ").trim();
}

function systemMsgMeta(text: string): { theme: string; icon: React.ReactNode } {
  const t = text || "";
  const CHECK = <polyline points="20 6 9 17 4 12" />;
  const COINS = (
    <>
      <ellipse cx="12" cy="5" rx="9" ry="3" />
      <path d="M21 12c0 1.66-4 3-9 3s-9-1.34-9-3" />
      <path d="M3 5v14c0 1.66 4 3 9 3s9-1.34 9-3V5" />
    </>
  );
  const BOX = (
    <>
      <path d="M21 16V8a2 2 0 00-1-1.73l-7-4a2 2 0 00-2 0l-7 4A2 2 0 003 8v8a2 2 0 001 1.73l7 4a2 2 0 002 0l7-4A2 2 0 0021 16z" />
      <polyline points="3.27 6.96 12 12.01 20.73 6.96" />
      <line x1="12" y1="22.08" x2="12" y2="12" />
    </>
  );
  const REFUND = (
    <>
      <path d="M3 12a9 9 0 109-9 9.75 9.75 0 00-6.74 2.74L3 8" />
      <path d="M3 3v5h5" />
    </>
  );
  const ALERT = (
    <>
      <path d="M12 9v4" />
      <path d="M12 17h.01" />
      <path d="M10.29 3.86L1.82 18a2 2 0 001.71 3h16.94a2 2 0 001.71-3L13.71 3.86a2 2 0 00-3.42 0z" />
    </>
  );
  const CLOCK = (
    <>
      <circle cx="12" cy="12" r="10" />
      <polyline points="12 6 12 12 16 14" />
    </>
  );

  if (t.includes("has been accepted")) return { theme: "accepted", icon: CHECK };
  if (t.includes("placed in escrow")) return { theme: "paid", icon: COINS };
  if (t.includes("marked this deal as delivered")) return { theme: "delivered", icon: BOX };
  if (t.includes("released to the seller") || t.includes("Deal Successful") || t.includes("Deal complete")) return { theme: "released", icon: CHECK };
  if (t.includes("refunded to the buyer")) return { theme: "refunded", icon: REFUND };
  if (t.includes("dispute has been raised")) return { theme: "disputed", icon: ALERT };
  if (t.includes("deadline passed")) return { theme: "expired", icon: CLOCK };
  return { theme: "paid", icon: COINS };
}

function MessageRow({
  m,
  currentUid,
  chatRoomId,
  dealId,
  onDelete,
  onReport,
}: {
  m: DealMessage;
  currentUid: string;
  chatRoomId: string;
  dealId: string | null;
  onDelete: (id: string) => void;
  onReport: () => void;
}) {
  const [ctxOpen, setCtxOpen] = useState(false);

  if (m.type === "system") {
    const meta = systemMsgMeta(m.text || "");
    return (
      <div className={`dcp-msg-system theme-${meta.theme}`}>
        <span className="dcp-sys-icon">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">{meta.icon}</svg>
        </span>
        <span className="dcp-sys-text">{stripEmoji(m.text || "")}</span>
      </div>
    );
  }

  const isMine = m.uid === currentUid;

  return (
    <div className={`dcp-msg-row ${isMine ? "mine" : "theirs"}`}>
      <div className="dcp-msg-meta">
        {!isMine && m.senderName ? <span className="dcp-msg-name">{m.senderName}</span> : null}
        <span className="dcp-msg-time">{fmtTime(m.createdAt)}</span>
        <button className="dcp-msg-dots" onClick={(e) => { e.stopPropagation(); setCtxOpen((v) => !v); }}>
          <svg viewBox="0 0 24 24"><circle cx="12" cy="5" r="1" /><circle cx="12" cy="12" r="1" /><circle cx="12" cy="19" r="1" /></svg>
        </button>
        {ctxOpen ? (
          <div className="dcp-ctx-menu" onClick={(e) => e.stopPropagation()}>
            {isMine ? (
              <button className="dcp-ctx-item danger" onClick={() => { setCtxOpen(false); onDelete(m.id); }}>
                <svg viewBox="0 0 24 24"><polyline points="3 6 5 6 21 6" /><path d="M19 6l-1 14a2 2 0 01-2 2H8a2 2 0 01-2-2L5 6" /></svg>
                Delete
              </button>
            ) : (
              <button className="dcp-ctx-item danger" onClick={() => { setCtxOpen(false); onReport(); }}>
                <svg viewBox="0 0 24 24"><path d="M4 15s1-1 4-1 5 2 8 2 4-1 4-1V3s-1 1-4 1-5-2-8-2-4 1-4 1z" /><line x1="4" y1="22" x2="4" y2="15" /></svg>
                Report
              </button>
            )}
          </div>
        ) : null}
      </div>
      <MessageBubble m={m} isMine={isMine} chatRoomId={chatRoomId} dealId={dealId} />
    </div>
  );
}

function MessageBubble({ m, isMine, chatRoomId, dealId }: { m: DealMessage; isMine: boolean; chatRoomId: string; dealId: string | null }) {
  if (m.type === "image" && m.imageUrl) {
    return (
      <div className="dcp-bubble img-bubble">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src={m.imageUrl} alt="" onClick={() => window.open(m.imageUrl, "_blank", "noopener")} />
      </div>
    );
  }
  if (m.type === "link" && m.linkUrl) {
    return (
      <div className="dcp-bubble link-bubble">
        <div className="ibx-link-prev">
          {m.linkThumb ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={m.linkThumb} className="ibx-link-prev-img" alt="" onError={(e) => (e.currentTarget.style.display = "none")} />
          ) : null}
          <div className="ibx-link-prev-body">
            <div className="ibx-link-prev-title">{m.linkTitle || m.linkUrl}</div>
            <div className="ibx-link-prev-url">{m.linkUrl}</div>
          </div>
          <button className="ibx-link-prev-btn" onClick={(e) => { e.stopPropagation(); window.open(m.linkUrl, "_blank", "noopener"); }}>
            Visit link
          </button>
        </div>
      </div>
    );
  }
  if (m.type === "file") {
    return (
      <div className="dcp-bubble">
        <svg viewBox="0 0 24 24" style={{ width: 13, height: 13, stroke: "currentColor", fill: "none", strokeWidth: 2, strokeLinecap: "round", strokeLinejoin: "round", marginRight: 5, verticalAlign: "middle" }}>
          <path d="M14 2H6a2 2 0 00-2 2v16a2 2 0 002 2h12a2 2 0 002-2V8z" />
          <polyline points="14 2 14 8 20 8" />
        </svg>
        {m.fileUrl ? (
          <a href={m.fileUrl} target="_blank" rel="noopener" style={{ color: "inherit", textDecoration: "underline" }}>
            {m.fileName || "File"}
          </a>
        ) : (
          m.fileName || "File"
        )}
      </div>
    );
  }
  if (m.type === "transfer_zip" && m.storagePath) {
    return <TransferZipBubble m={m} isMine={isMine} chatRoomId={chatRoomId} dealId={dealId} />;
  }
  return <div className="dcp-bubble">{m.text || ""}</div>;
}

function TransferZipBubble({ m, isMine, chatRoomId, dealId }: { m: DealMessage; isMine: boolean; chatRoomId: string; dealId: string | null }) {
  const [downloading, setDownloading] = useState(false);
  const [downloaded, setDownloaded] = useState(false);

  const sizeLabel = m.fileSize ? (m.fileSize >= 1024 * 1024 ? (m.fileSize / 1024 / 1024).toFixed(1) + " MB" : Math.ceil(m.fileSize / 1024) + " KB") : "";
  const itemCount = Array.isArray(m.items) ? m.items.length : 0;
  const fileCount = typeof m.fileCount === "number" ? m.fileCount : null;
  const subParts = [m.fileName || "transfer.zip"];
  if (fileCount != null) subParts.push(`${fileCount} file${fileCount === 1 ? "" : "s"}`);
  if (sizeLabel) subParts.push(sizeLabel);

  async function handleDownload() {
    setDownloading(true);
    try {
      const user = auth.currentUser;
      if (!user) throw new Error("Not signed in");
      const idToken = await user.getIdToken();
      const resp = await fetch("/api/deal", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "escrow-get-download-url", idToken, chatRoomId, dealId, storagePath: m.storagePath }),
      });
      const json = await resp.json();
      if (!resp.ok) throw new Error(json.error || "Could not get download link");
      try {
        const res = await fetch(json.url);
        if (!res.ok) throw new Error("Download failed (" + res.status + ")");
        const blob = await res.blob();
        const blobUrl = URL.createObjectURL(blob);
        const a = document.createElement("a");
        a.href = blobUrl;
        a.download = m.fileName || "transfer.zip";
        document.body.appendChild(a);
        a.click();
        a.remove();
        setTimeout(() => URL.revokeObjectURL(blobUrl), 30000);
      } catch {
        window.open(json.url, "_blank", "noopener");
      }
      setDownloaded(true);
    } catch (e) {
      console.error(e);
    } finally {
      setDownloading(false);
    }
  }

  return (
    <div className="dcp-bubble tdm-zip-bubble">
      <div className="tdm-zip-card">
        <div className="tdm-zip-card-icon">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <path d="M21 8v13H3V8" /><path d="M1 3h22v5H1z" /><path d="M10 12h4" />
          </svg>
        </div>
        <div className="tdm-zip-card-body">
          <div className="tdm-zip-card-title">{itemCount ? `${itemCount} transfer item${itemCount === 1 ? "" : "s"}` : "Transfer package"}</div>
          <div className="tdm-zip-card-sub">{subParts.join(" · ")}</div>
        </div>
        {isMine ? (
          <div className="tdm-zip-readonly-badge" title="Only the buyer can download this file">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{ width: 15, height: 15 }}>
              <rect x="3" y="11" width="18" height="11" rx="2" ry="2" /><path d="M7 11V7a5 5 0 0 1 10 0v4" />
            </svg>
          </div>
        ) : downloaded ? (
          <div className="tdm-zip-readonly-badge" title="Downloaded — this file has been removed from storage">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{ width: 15, height: 15 }}>
              <polyline points="20 6 9 17 4 12" />
            </svg>
          </div>
        ) : (
          <button type="button" className="tdm-zip-download-btn" disabled={downloading} onClick={handleDownload}>
            {downloading ? "⋯" : (
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M21 15v4a2 2 0 01-2 2H5a2 2 0 01-2-2v-4" /><polyline points="7 10 12 15 17 10" /><line x1="12" y1="15" x2="12" y2="3" />
              </svg>
            )}
          </button>
        )}
      </div>
      {!isMine ? <div className="tdm-zip-onetime-notice">This file will be deleted from our system once you download it. If something goes wrong, open a dispute before downloading again.</div> : null}
    </div>
  );
}
