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
