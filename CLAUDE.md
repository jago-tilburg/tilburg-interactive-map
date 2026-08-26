# tilburg-interactive-map

Single-file food/shop map for Tilburg. Live at **https://2happies.nl**.

## Two codebases in this repo

- **`main`** (prod, what's actually live): the description below — everything in
  `public/index.html`, no build step.
- **`staging-next`**: a from-scratch React/Next.js/TypeScript rewrite in `web/`, not yet
  merged to `main` or live. Has its own build step, its own tests (`web/tests/`, run via
  `npm test` inside `web/`), and its own Firestore-backed data model alongside the legacy
  RTDB one. See `PLAN-INLOGGEN.md` in the repo root for the login rework currently in
  progress there. If you're working in `web/`, this file's Architecture/Deployment
  sections below don't apply — nothing in `web/` touches `public/index.html`, and pushing
  `staging-next` does not deploy anything (only `main` does, via the Action below).

## Architecture (main / prod)

- Everything lives in `public/index.html` — HTML/CSS/JS combined, no build step, no framework, no `node_modules`.
- Google Maps JS API (Places lib) for the map.
- Firebase Realtime Database (compat SDK) for data: shops, events, requests, ratings, comments, likes, shop view counts, admin users.
- Firebase Auth for admin login. GA4 for analytics. Instagram embed script for per-shop Instagram posts.

## Deployment

- `git push origin main` triggers the `Deploy to Firebase Hosting on merge` GitHub Action (`.github/workflows/firebase-hosting-merge.yml`), which pushes `public/` straight to Firebase Hosting's `live` channel. No manual `firebase deploy`, no build step. Finishes in ~30-45s.
- Verify a deploy with `gh run list --workflow="firebase-hosting-merge.yml"` or `gh run watch <id>`, and confirm it's actually live with `curl -s https://2happies.nl`.
- Custom domain `2happies.nl` is configured in the Firebase console, not in this repo — `tilburg-interactive-map.web.app` is the Firebase default domain and also serves the same content.
- Work happens as direct commits to `main` — a PR-preview Action exists (`firebase-hosting-pull-request.yml`) but isn't actually used in practice.

## Workflow preference

Commit and push finished, verified changes without waiting for explicit "commit"/"push" instructions each time — this is a solo project with a fast, low-risk auto-deploy, and the user has asked for this to just happen. Standard git safety rules still apply otherwise (no force-push, no history rewriting, no skipping hooks) unless separately authorized.
