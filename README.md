# Siterifty — Desktop Layout Fix Bundle

Only the files changed/added for this round. Drop each back into the
same path in your project (overwriting the existing one), except
`lib/useIsDesktop.ts` which is brand new.

## 1. /sell — was 1 card per row on any screen size
`app/sell/SellPickerClient.tsx` had the 5 listing-type cards in a fixed
`flexDirection:"column"` stack with `maxWidth:640`, so it looked
identical on a phone and a 27" monitor.

- Switched to a `.sell-type-grid` (new CSS in `app/styles/sell-picker.css`):
  1 column under 640px, 2 columns 640–980px, 3 columns 980px+.
- Widened the page container from 640px to 1160px max-width.

## 2. /myprofile — hard-capped at 440px (phone width) on any screen
Every direct child of the profile modal (`.pm-identity`, `.pm-quick-row`,
`.pm-plan-card`, tabs, listings grid, bottom buttons) was capped at
`max-width: 440px` with no larger breakpoint — so on desktop the whole
page sat as a narrow phone-width card in a sea of empty background.

- `app/styles/profile.css`: added two breakpoints — 900px+ widens
  everything to 720px and makes the listings grid 2 columns; 1280px+
  widens to 980px and makes listings 3 columns.
- Also found and removed a **dead duplicate** `.pm-bottom-actions` CSS
  block further down the file that was silently overriding the new
  widened version (same class, later in source order, always won). This
  was a landmine independent of this task — worth knowing about.

## 3. /messages — the big one: real split-view like Settings
This was architecturally different from Settings. Chat/Group panels
(`DealChatPanel.tsx` ~1300 lines, `GroupChatPanel.tsx` ~590 lines) were
fully self-contained, route-owning, fullscreen components — their own
scroll-lock, their own `position:fixed;inset:0`, their own back-button
navigation to their own routes (`/messages/deal/[id]`, `/messages/group/[id]`).

Rather than fake it with a wider list and no real pane, did the actual
refactor:

- **`DealChatPanel.tsx` / `GroupChatPanel.tsx`** — added optional
  `embedded` and `onBack` props. When `embedded`, the panel renders as a
  plain flex-fill pane instead of a fixed fullscreen overlay, skips the
  body scroll-lock (parent manages that), and "back" calls `onBack()`
  instead of navigating away from `/messages`. Checkout/transfer
  sub-flows still navigate to their own real routes either way — those
  are genuine full-page steps, not just "closing" the panel. **Mobile
  behavior is 100% unchanged** — these props default to off, so the
  routed `/messages/deal/[id]` and `/messages/group/[id]` pages render
  exactly as before.
- **`InboxShell.tsx`** — on a desktop viewport (≥1000px, via new
  `lib/useIsDesktop.ts`), tapping a row no longer navigates away: it sets
  local `selected` state and the chosen thread renders as an embedded
  pane on the right, list staying visible on the left — same pattern as
  Settings. A sensible first thread auto-selects per tab (first accepted
  deal, first deal-chat, or the first group) so the pane is never empty
  on load. Selected row gets a highlight. Below 1000px, every code path
  is untouched — same route-push behavior as before.
- **CSS** (`inbox.css`, `deal-chat.css`, `group-chat.css`) — added the
  split-view layout (`.ibx-box-split`, `.ibx-list-pane` at 380px,
  `.ibx-detail-pane` filling the rest, empty-state placeholder,
  selected-row highlight) and the `.dcp-embedded`/`.gcp-embedded` panel
  variants. All net-new classes/rules — nothing existing was removed
  beyond what's noted above.

Plain 1:1 DM rows (not deal chats — no dedicated panel exists for those
yet) still navigate to the seller's profile page as a real route change
on both mobile and desktop, since there's no panel to embed them as.

All changes were checked with `tsc --noEmit` (isolated syntax pass — no
`node_modules` available in this sandbox for a full Next.js build) and
came back clean of real errors; the swarm of errors on the raw check
output are all missing-`@types/react` noise (JSX intrinsics, `key` prop
warnings), confirmed by the fact the exact same patterns already existed
untouched elsewhere in the original code.
