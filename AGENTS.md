# AuditIQ — AI Business Intelligence & Readiness Platform (`projects/auditiq/`)

Scoped operating instructions for the **AuditIQ** workspace inside MSL AI OS. Read this file before modifying any code, styles, or API routes in `projects/auditiq/`.

---

## 1. Purpose & Architecture

AuditIQ (`https://auditiq.ai.studio` / local server `http://localhost:4650`) is MSL AI Systems' flagship 4-step AI business diagnostic and executive blueprint generator.

- **Server (`server.mjs`):** Zero-dependency Node.js 24 HTTP/REST server with built-in security headers, sliding-window IP rate limiting, `32KB` body size cap, strict input sanitization (`src/validation.mjs`), and dual-mode diagnostic generation (`src/engine.mjs` — live Gemini `gemini-2.5-flash` when `GEMINI_API_KEY` is present, with deterministic industry-calibrated synthesis fallback).
- **Frontend (`public/`):**
  - `public/index.html` — Hardened entry point loading the upgraded AuditIQ SPA and `ui-ux-pro-max` / `enhance-ui` stylesheet.
  - `public/assets/app.js` — Patched & security-hardened AuditIQ React 19 application bundle with all 7 UI/state bugs resolved.
  - `public/assets/styles.css` — Base Tailwind v4 stylesheet.
  - `public/assets/ui-enhancements.css` — `ui-ux-pro-max` + `enhance-ui` design system refinements (focus-visible vs. selected card separation, sticky step bar spacing, interactive step pill indicators, executive score cards, and print stylesheet fixes).
- **Reverse-Engineered Baseline (`rea-bundle/`):** Point-in-time production capture from `https://auditiq.ai.studio` preserved for diffing and audit traceability.
- **Security & Bug Audit (`SECURITY.md`):** Full root-cause documentation and verification matrix for `BUG-01`–`BUG-07` and `SEC-01`–`SEC-04`.
- **Automated Test Suite (`tests/auditiq.test.mjs`):** Node `node:test` suite verifying security headers, input validation, prompt-injection stripping, rate limiting, `localStorage` hydration safety, UI fixes, and CLI pre-call flag parsing.

---

## 2. Design System Rules (`ui-ux-pro-max` + `enhance-ui`)

- **Palette Discipline (Executive Diagnostic Light Mode):**
  - Primary Brand Accent: `#3450FF` (AuditIQ Cobalt Blue)
  - Secondary ROI / Positive Accent: `#0EA47A` (Operational Emerald)
  - Primary Ink: `#14161B` (Executive Charcoal)
  - Muted Slate: `#4B5563` / `#6B7280`
  - Surface Canvas: `#F6F7F9` (Soft Mist) with `#FFFFFF` elevated cards
- **Anti-Regression Constraints ("Without Scattering Things"):**
  - Never alter the 4-step assessment sequence or 12-section executive report layout hierarchy.
  - Radio and Checkbox cards must use `:focus-visible` for keyboard focus rings and `aria-checked="true"` for selected borders so mouse clicks never leave a second "ghost blue border" on unselected cards (`BUG-01`).
  - Every view/step transition must scroll the viewport to `(0, 0)` so the sticky header never clips the top of Step 1–4 (`BUG-02`).
  - Step containers must reserve bottom clearance above the sticky action bar so Step 4's optional textarea and cancel controls are never overlapped (`BUG-03`).

---

## 3. Commands

```bash
# Run TDD & security verification suite
node --test projects/auditiq/tests/auditiq.test.mjs

# Start local AuditIQ server on http://localhost:4650
node projects/auditiq/server.mjs

# Run pre-call diagnostic for a specific prospect or JSON file
node scripts/run-auditiq-precall.cjs --prospect ckdigital
```
