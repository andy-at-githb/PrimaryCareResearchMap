# CHANGELOG

Shared change log for this app.

Purpose:
- give both Codex and Claude one readable place to record meaningful changes
- make handoff between tools simpler
- keep version notes close to the live app, while older full snapshots stay in `archive/`

Update rule:
- add the newest version at the top
- keep entries short and practical
- note security, deployment, data, and UI changes that will matter later

## v3.20.0 - 2026-06-05

- Status banner: removed the `localStorage` persistence on the dismiss button. The banner now shows on every page load regardless of previous dismissals. Reason: the user tested on mobile, dismissed the banner, then closed and reopened the browser — the banner stayed hidden because the dismissal persisted indefinitely. Since this banner is the main vehicle for communicating that the project is paused, it should always be visible to new viewers; per-session "remember" was too aggressive.
- Behavior now: dismiss button still hides the banner for the current view, but a refresh, new tab, or browser reopen will show it again.
- Storage key `project-status-banner-dismissed-v2` is no longer read or written; safe to ignore in any leftover browser storage.

## v3.19.0 - 2026-06-05

- UI/communication: added a sticky floating banner at the top of every page declaring **PROJECT NO LONGER IN ACTIVE DEVELOPMENT** with an explanation that this was an experimental feasibility project, a pointer to the existing Comments here button for feedback, and an italic **June 2026.** date marker.
- Style: banner uses the soft translucent-blue treatment that matches the existing `.suggestion-button` (`rgba(31, 86, 204, 0.12)` background, `--accent` text), not a strong colour block — the user explicitly preferred this subtler style over the initial amber and later strong-blue versions.
- Behavior: banner is dismissable via × in the top-right; dismissal persists in `localStorage` (key `project-status-banner-dismissed-v2`) so repeat visitors see it once unless they clear browser storage.
- Accessibility: dismiss button carries `aria-label="Dismiss notice"`; banner uses semantic heading + body paragraph structure; mobile breakpoint at 640px scales the text down.
- Context: this release reflects a decision by the user to pause active development. The app and all datasets remain functional; only the framing changes.

## v3.18.0 - 2026-06-02
- Security: fixed a remote crash — a malformed `Host` header made `new URL()` throw outside any handler, which on Node 18+ terminated the process. The request handler now guards URL parsing (returns 400) and an `unhandledRejection` handler keeps the process alive.
- Security/abuse: added a per-IP rate limit (40/min) to `/api/resolve-practice` and bounded the in-memory postcode geocode cache (max 5000, FIFO eviction) to prevent unbounded memory growth.
- Internal: de-duplicated the rate-limit logic into a shared `isWithinRateLimit()` helper (used by both the suggestion and resolve endpoints).
- Note: set `APP_ACTION_SECRET` in the Render dashboard so action tokens stay valid across restarts/instances.

## v3.17.0 - 2026-05-13

- fixed the archive workflow so `.env` secrets are no longer copied into version archives
- removed previously archived `.env` files from older snapshots
- hardened protected POST actions with session-bound action tokens instead of relying only on `Origin` or `Referer`
- added `/api/client-config` so the frontend can obtain short-lived action tokens for protected actions
- updated the smoke test to cover the new protected-action flow
- documented the shared archive and changelog workflow for future Codex or Claude handoff
- synced `package-lock.json` into `render-upload` and documented the live deploy path used by the desktop deploy app

## v3.16.0 - 2026-05-07

- baseline shared copy received from Claude Code
- includes the comments/suggestions modal and direct `render-upload` deploy workflow
