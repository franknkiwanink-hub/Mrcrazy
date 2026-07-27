# Siterifty — Fix Bundle

This zip contains ONLY the files that were changed or added. Drop each file
back into the same path in your project (overwriting the existing one),
except the two brand-new files noted below.

## 1. Boot / loading screen redesign
Removed the mascot robot glyph and the falling green glitter particles
(the "floating things") and replaced them with a clean monogram + wordmark
on a calm dark background — meant to read as a serious, professional
marketplace rather than a mascot-driven app.

- `components/layout/BootOverlay.tsx` — dropped the glitter-particle
  generator/effects and the `<img src="/boot-mark-glyph.png">` mascot;
  added an inline SVG "S" monogram instead.
- `app/styles/base.css` — replaced the `#appBootOverlay` block: removed
  `.boot-glitter*` keyframes/classes and `.boot-skel-*` skeleton lines,
  simplified `.boot-content`/`.boot-mark-glyph`/`.boot-ring-wrap` for the
  new look.

Note: three other overlays (`MaintenanceOverlay.tsx`, `AccountAppealOverlay.tsx`,
`AccountStatusOverlay.tsx`) also reference the old `/boot-mark-glyph.png`
mascot image. Those weren't part of this request so they're untouched —
say the word if you'd like those redesigned too.

## 2. Fixed false API/Agent capability claims in Settings
`components/settings/panels/ApiPanel.tsx` said API keys let users
"delete/pin messages" and "moderate groups" — that's not what the API
does. Traced the real behavior through `AgentModal.tsx`/`app/aiagent` and
corrected all four spots to describe what the Agent actually automates:
auto-reply to buyers, auto-accept/reject deals, smart negotiation,
buyer trust scoring, auto-relist, and timed price drops.

(Checked `WebhooksPanel.tsx` too — no false claims there, so it's not
included.)

## 3. Notification bell + fullscreen notification center
New bell icon 🔔 added to the announcement bar, left of the username.
Tapping it opens a fullscreen modal listing all notifications (messages,
deal offers/accepts/rejects, escrow/payment updates), grouped by day,
with filter tabs (All / Messages / Deals / Payments) and a live unread
badge — built on top of the `users/{uid}/notifications` collection that
already existed for the toast/"missed" system.

- `lib/notifications.ts` — added `useNotificationCenter` (full list +
  mark-all-read) and `useUnreadNotificationCount` (live badge count).
  Existing exports/behavior untouched.
- `components/notifications/NotificationBellButton.tsx` — **new file**.
- `components/notifications/NotificationCenterModal.tsx` — **new file**.
- `components/layout/AnnouncementBar.tsx` — renders `NotificationBellButton`
  before the username.
- `app/styles/notifications.css` — added `.ab-bell-*` (bell + badge) and
  `#notifCenterOverlay`/`.notif-center-*` (fullscreen modal) styles.
  (`.ab-bell-*` classes actually live in `app/styles/base.css`, next to
  the rest of the announcement-bar CSS — see that file.)

All changes were checked with `tsc --noEmit` (isolated syntax pass — no
`node_modules` available in this sandbox to run a full Next.js build) and
came back clean of any real errors.
