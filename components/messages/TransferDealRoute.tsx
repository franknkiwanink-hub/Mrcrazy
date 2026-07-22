"use client";

import { useRouter } from "next/navigation";
import { useAuth } from "@/lib/AuthContext";
import { useDealChat } from "@/lib/useDealChat";
import TransferDealModal from "./TransferDealModal";
import SignInRequired from "@/components/auth/SignInRequired";

// Gives the Transfer Deals flow its own URL (/messages/deal/[id]/transfer)
// instead of living purely as useState inside DealChatPanel. Reason: as a
// modal-on-modal (chat -> Transfer Deals -> item cover -> item panel),
// there was no real navigation entry for any of it, so the Android back
// button closed the whole chat instead of stepping back one level. This
// route reconstructs the same room/isSeller/syncThreads context
// DealChatPanel already builds (same useDealChat(chatRoomId) call, same
// isSeller derivation) so TransferDealModal itself is unchanged — it
// still just needs those props, it doesn't know or care whether its
// parent is a route or a useState flag.
export default function TransferDealRoute({ chatRoomId }: { chatRoomId: string }) {
  const router = useRouter();
  const { user, loading } = useAuth();
  const chat = useDealChat(chatRoomId);

  const isSeller = !!(user && chat.room && user.uid === chat.room.sellerUid);

  function goBackToChat() {
    // router.back() first so a real "forward" entry exists to return to
    // if the person got here by a shared/bookmarked link rather than by
    // clicking through the chat (no history to pop in that case).
    if (typeof window !== "undefined" && window.history.length > 1) {
      router.back();
    } else {
      router.replace(`/messages/deal/${chatRoomId}`);
    }
  }

  if (loading) {
    // Still resolving auth — avoid flashing SignInRequired for a
    // signed-in user whose session hasn't finished loading yet.
    return null;
  }

  if (!user) {
    return (
      <div style={{ minHeight: "100dvh", display: "flex", alignItems: "center", justifyContent: "center" }}>
        <SignInRequired
          fullScreen={false}
          title="Sign in to continue this transfer"
          description="This deal's transfer checklist is only visible to the buyer and seller once signed in."
        />
      </div>
    );
  }

  if (!chat.room) {
    return null;
  }

  return (
    <TransferDealModal
      chatRoomId={chatRoomId}
      sellerUid={chat.room.sellerUid}
      buyerUid={chat.room.buyerUid}
      listingId={chat.room.listingId || null}
      dealId={chat.room.dealId || null}
      paymentStatus={chat.room.paymentStatus}
      isSeller={isSeller}
      syncThreads={chat.syncThreads}
      onClose={goBackToChat}
    />
  );
}
