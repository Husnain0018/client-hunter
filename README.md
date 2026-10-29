# Client Hunter — separated secure full-stack rebuild

This repository contains a new backend and frontend based on the three supplied reference files:

- `reference/*Interface API*.json` — the n8n discovery, auditing, AI and email workflow.
- `reference/*WhatsApp (WAHA)*.json` — the n8n WhatsApp send/status/ACK workflow.
- `reference/*client-hunter-app.html` — the original single-file browser UI.

The implementation is deliberately split into `backend/` and `frontend/`. The browser never receives provider API keys, SMTP credentials, WAHA credentials, Google tokens, or the database file.

## What is implemented

- Fastify + strict TypeScript backend.
- SQLite with WAL mode, prepared statements, persistent runs, leads, events, email history, and WhatsApp state.
- Access-code login that issues a short-lived signed bearer token.
- Explicit CORS, security headers, rate limiting, request validation, HTML sanitization, and bounded request sizes.
- SSRF-protected website crawling with DNS checks, private-address blocking, redirect re-validation, timeouts, and response-size limits.
- Google Maps discovery through Apify when configured, otherwise a deterministic local fallback that keeps the product runnable without external keys.
- Website audit based on the original 17 checks, with a safe “Unverified” path for blocked websites.
- Optional Facebook/Instagram activity checks through Apify. Social failures do not fail the lead run.
- AI analysis through an optional OpenAI-compatible endpoint, with deterministic fact-only copywriting fallback.
- Email drafts, sanitized HTML preview, optional server-side SMTP send, and Gmail/mail-client compose links.
- WhatsApp one-lead/one-number sending through optional WAHA, write-before-send state locking, duplicate protection, timeout → `Unconfirmed`, and forward-only delivery ACK updates.
- Optional Google Sheet header validation and append sync through a server-side access token.
- React/Vite UI with live event polling, search history, filters, lead cards, CSV export, website/social details, email editor, and WhatsApp editor.

## Run locally

### Backend

```bash
cd backend
cp .env.example .env
# Change AUTH_SECRET and CLIENT_HUNTER_ACCESS_CODE.
npm install
npm run dev
```

The API starts on `http://127.0.0.1:8787` by default.

### Frontend

```bash
cd frontend
cp .env.example .env
npm install
npm run dev
```

Open `http://localhost:5173`. Use the access code from `backend/.env`.

The application is usable with no Apify, OpenAI, SMTP, WAHA, or Google Sheets credentials. Those connectors are opt-in and fail closed with a clear message.

## Optional connector configuration

All secrets belong in the backend environment only:

- `APIFY_API_TOKEN` — live Google Places and social scraping.
- `OPENAI_API_KEY`, `OPENAI_BASE_URL`, `OPENAI_MODEL` — model-assisted analysis.
- `SMTP_*` — server-side email delivery.
- `WAHA_BASE_URL`, `WAHA_API_KEY`, `WAHA_SESSION`, `WAHA_WEBHOOK_SECRET` — WhatsApp delivery and ACK tracking.
- `GOOGLE_SHEETS_ACCESS_TOKEN` — server-side Google Sheets metadata/header/append operations.

For production, put these values in a secret manager or process environment, use HTTPS, rotate the access code, and run the backend behind a reverse proxy with TLS.

## Checks

```bash
cd backend && npm run build && npm test
cd frontend && npm run build
```

See [`docs/ANALYSIS.md`](docs/ANALYSIS.md) for the point-by-point reverse engineering of the supplied n8n workflows and HTML application, plus the mapping from old behavior to the new architecture.
