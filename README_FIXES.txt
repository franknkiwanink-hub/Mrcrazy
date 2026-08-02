FIX — deploy to the SAME relative path, overwrite the originals.

lib/useDealChat.ts
components/messages/DealChatPanel.tsx

WHAT CHANGED
"Request Payment" (seller reminding the buyer to pay into escrow) was a
lifetime-once send per deal — paymentRequestPending was set to true on
first send and nothing ever cleared it, so the button stayed stuck on
"Request Sent" forever, blocking the seller from ever nudging the buyer
again.

Now it's a 1-hour rolling cooldown based on paymentRequestedAt:
- Sending is blocked only while less than 1 hour has passed since the
  last request.
- The button shows a live "Try again in Xh Ym" countdown during the
  cooldown (ticks every 30s, no page refresh needed) and re-enables on
  its own once the hour is up.
- Still fully blocks rapid repeat sends/spamming — just no longer a
  permanent lockout.

To change the cooldown length, edit PAYMENT_REQUEST_COOLDOWN_MS at the
top of lib/useDealChat.ts (currently 60 * 60 * 1000 = 1 hour).
