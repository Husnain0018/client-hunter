# Client Hunter — technical analysis and architecture mapping

## 1. Executive summary

The supplied system is a B2B prospecting and outreach application. It takes a seller profile, target niche, location, and lead count; discovers local businesses; filters and de-duplicates them; audits public website signals; optionally inspects Facebook/Instagram activity; generates fact-based sales drafts; stores the result in Google Sheets; and exposes a browser dashboard for review and outreach.

The original implementation is a pair of active n8n workflows plus a large single-file HTML application. The n8n workflows provide orchestration and integrations. The HTML file provides state, forms, rendering, polling, message editing, CSV export, and browser persistence.

The rebuild keeps the useful business behavior but changes the trust boundaries:

| Concern | Original | Rebuild |
| --- | --- | --- |
| Primary database | Google Sheets | SQLite WAL; Sheets is optional sync |
| Authentication | hard-coded `['ali']` access code | server-side scrypt verification + signed short-lived bearer token |
| Website fetching | n8n HTTP request directly follows redirects | DNS/IP SSRF guard, re-checks redirects, timeout, size limit |
| Secrets | workflow credentials plus frontend webhook/config values | backend environment only |
| Live progress | polling a Google Sheet `Live` tab | SQLite run events, polled by the React frontend |
| AI failure | custom n8n fallback inside `Build Lead Rows` | deterministic backend fallback is always available |
| Browser persistence | IndexedDB with in-memory fallback | server SQLite source of truth, browser only caches the session/form |
| WhatsApp safety | Sheet row lock and WAHA ACK lane | SQLite transaction lock and forward-only ACK state machine |

## 2. Interface API workflow

### 2.1 Entry point and validation

`POST /webhook/client-hunter-start` is accepted by `Start Webhook`. `Prepare Request` then:

1. Reads either `body` or the raw object.
2. Checks the hard-coded access code.
3. Validates a caller-supplied run ID.
4. Requires seller name, email, services, niche, area, and country.
5. Caps the requested count at 100, defaulting to 20.
6. Normalizes known duplicate IDs, domains, and phone keys.
7. Accepts optional sheet ID/tab, social audit, portfolio, phone, and email-summary flags.

The valid branch immediately returns `{ ok: true, run_id }` and then continues the longer pipeline. That gives the browser an asynchronous job model.

### 2.2 Google Maps discovery

`Run Google Maps Scraper` calls Apify's synchronous Google Places actor with the niche, location, language, closed-place filter, and a 1.5x over-fetch capped at 150.

`Normalize & Dedupe` applies the important business rules:

- government and public-service keyword/domain filtering;
- social, directory, `business.site`, `marham.pk`, `oladoc.com`, Yelp, TripAdvisor and similar domains are not treated as an owned website;
- stable lead ID from a DJB2-style hash of place ID or title/address;
- duplicate matching by lead ID, normalized website domain, and last nine phone digits;
- discard listings with no website, phone, or social profile;
- attach the top three nearby competitors by review count.

The rebuild retains those semantics, uses a SHA-256-derived stable ID, and performs the final duplicate check against SQLite before auditing. This prevents repeated leads across separate runs even if a caller does not send its browser duplicate memory.

### 2.3 Website fetch and 17-point audit

The original flow fetches a homepage and a detected contact page, then parses HTML with regular expressions. It extracts up to five emails, up to six phone values, social links, technology signals, and image URLs.

The scoring checks are:

1. HTTPS
2. responsive viewport
3. page title
4. meta description
5. H1
6. contact/enquiry form
7. WhatsApp/live chat
8. analytics/ad tracking
9. JSON-LD schema
10. Open Graph tags
11. image count
12. missing image alt text
13. old copyright year
14. thin text content
15. visible email/phone
16. social links
17. legacy table/deprecated HTML patterns

The score starts at 100 and subtracts the configured weights. It is labelled `Good`, `Needs Improvement`, or `Poor`. Blocked sites are `Unverified`, and non-responsive sites are `Not Loading`; those states are not presented as proof that a site is broken.

The new `websiteAuditor.ts` adds the missing security boundary: the URL is parsed, credentials and unsafe protocols are rejected, DNS is resolved, private/loopback/link-local/reserved ranges are blocked, and each redirect is checked again. This protects against localhost, LAN, cloud metadata, DNS-rebinding-style redirect hops, and unsafe ports.

### 2.4 Social activity

`Build Social Jobs` creates one Facebook job and one Instagram job per discovered profile when the option is enabled. It uses the Apify Facebook Posts and Instagram actors with a result limit of three.

`Attach Social Results` associates provider rows back to a lead and computes the newest post date. The original labels activity as:

- Active: 0–30 days
- Slow: 31–90 days
- Inactive: over 90 days

The rebuild keeps these labels and makes social scraping non-fatal. If the provider is absent or fails, the lead still gets an explicit `Not checked` or `No public posts found` result.

### 2.5 AI prompt and deterministic fallback

`Build AI Prompt` creates structured XML containing lead facts, website issues, contact availability, social activity, competitors, seller identity, and the exact services the seller offers. The agent prompt tells the model not to invent facts, to use only supplied competitor values, and to select only seller-provided services.

`Build Lead Rows` is the main reliability layer. It:

- tries to parse model JSON, including fenced/partial output;
- builds a fallback plan from scraped facts when the model fails;
- clamps scores to 0–100;
- validates recommended services against the seller's service list;
- generates email HTML/text, a comparison table, a WhatsApp draft, follow-up dates, and CRM fields;
- marks drafts as `Pending Review`, not automatically sent.

The rebuild keeps this principle but moves it to the backend. The optional model is called only from the server, and the deterministic plan is the source of truth when the model is unavailable or returns invalid data.

### 2.6 Google Sheets persistence and live progress

The original workflow writes master results and optionally writes to a client sheet. It also appends stage/lead events to a `Live` tab and exposes `POST /webhook/client-hunter-status` with a sequence cursor.

The rebuild uses SQLite run events with a monotonically increasing sequence. `GET /api/runs/:runId/events?after=N` is the same cursor pattern without using a spreadsheet as a queue. Google Sheets remains an optional append sync through a server-side token.

The original schema contains headings with large leading spaces such as `Website_Images`, `Competitors`, and `Google_Maps_URL`. That is a correctness risk because a frontend using trimmed names will not match those columns. The rebuild uses canonical, trimmed names in `LEAD_COLUMNS`.

### 2.7 Connect and send-email lanes

`POST /webhook/client-hunter-connect` extracts a sheet ID, calls the Sheets API metadata endpoint, reads the first row, and writes the 51 headings if the sheet is blank. It requires the sheet to be shared with the service Google account.

`POST /webhook/client-hunter-send` validates the recipient, subject, and body, sends through an n8n Gmail credential, then marks `Email_Status` and `Gmail_Thread_ID` in the master sheet.

The rebuild exposes `/api/integrations/sheets/connect` and `/api/leads/:leadId/email`. The backend sanitizes editable HTML, validates the recipient, and only sends if SMTP is configured. Without SMTP, the frontend still provides a Gmail compose link rather than pretending a server send succeeded.

## 3. WhatsApp / WAHA workflow

### 3.1 Send lane

`POST /webhook/client-hunter-wa-send` is intentionally single-recipient. `Prepare WA` rejects arrays, lists, comma-separated numbers, structured values, missing fields, invalid IDs, empty text, and messages over 1500 characters.

`Check Duplicate` searches the WhatsApp sheet by `Lead_ID`. It detects business/number conflicts, blocks a recent `Sending` row for 180 seconds, blocks previously sent/pending/unconfirmed messages unless `resend: true` is explicitly supplied, and returns a clear state instead of silently sending twice.

`Save WhatsApp Contact` is deliberately before the provider call. If the sheet write fails, the workflow routes to `Build Save Error1` and does not contact WAHA. This is the correct intent: establish the durable lock before sending.

The provider sequence is:

1. Read `WAHA Config`.
2. `GET /api/sessions/{session}` and require `WORKING`.
3. `GET /api/contacts/check-exists` and require `numberExists: true`.
4. Build `chatId` and call `POST /api/sendText` with `{ session, chatId, text }`.
5. Extract a short provider message ID and initial ACK.
6. Save the provider ID and status to the sheet.

Timeouts and ambiguous 5xx/tunnel failures are `Unconfirmed`, not `Failed`, because a provider may have accepted the message before the HTTP response was lost. The rebuild keeps that distinction and never auto-retries an unconfirmed send.

### 3.2 Status and ACK lanes

`POST /webhook/client-hunter-wa-status` is read-only. It never calls WAHA. It reads one lead row and maps `Sending`, `Pending`, `Sent`, `Delivered`, `Read`, `Played`, `Failed`, and `Unconfirmed` to user-facing messages. It changes an old `Sending` to `Unconfirmed` after 180 seconds.

`POST /webhook/waha-message-ack` accepts only `message.ack` events for messages sent by the owner. It extracts the provider ID, maps the numeric ACK (-1 through 4), finds the row by `Run_ID`, and updates only when the new status is later than the stored status. Out-of-order ACKs therefore cannot move `Read` back to `Delivered`.

The rebuild moves that state machine into SQLite and protects the webhook with a server-side `X-WAHA-Webhook-Secret` value. The rank is still forward-only.

## 4. Original frontend analysis

The supplied HTML is a complete application rather than a static mockup. It contains:

- a dark hero/top bar and responsive card layout;
- seller profile, service chips, target niche/location, lead slider, social toggle, summary toggle, and access code;
- optional Google Sheet connection with instructions to share the service account as Editor;
- a five-stage progress stepper and 5-second status polling;
- a live event log and progressively expanding table;
- IndexedDB stores named `kv` and `runs`, with an in-memory fallback;
- browser duplicate memory keyed by lead ID, website domain, and last nine phone digits;
- search history, KPIs, filters, sorting, expandable lead cards, tabbed details, email preview, WhatsApp editor, CSV export, and CRM status selectors;
- direct Gmail/mailto compose links and backend send buttons;
- a modal for editable email HTML and a modal for editable WhatsApp text.

Good practices already present include escaping displayed values, sandboxing the email iframe, stripping active tags/attributes from editable email HTML, generating random run IDs with `crypto.getRandomValues`, and warning about stalled workflows.

Important risks in the original frontend are:

1. The n8n base URL, share email, and brand configuration are hard-coded in the browser.
2. The access code is sent from the browser and compared against a workflow literal.
3. CORS is permissive in the WAHA workflow (`*`) and the browser sends directly to webhook URLs.
4. Browser IndexedDB is the durable-looking source for the dashboard; clearing browser data removes the local history.
5. The user can edit arbitrary recipient fields before sending; the server must remain the final authority.
6. A Cloudflare Quick Tunnel URL is stored in workflow configuration and changes when the tunnel restarts.
7. Provider credentials and Google Sheet sharing assumptions live in workflow configuration rather than a runtime secret manager.

The new React app keeps the useful review workflow but treats the backend as authoritative. Browser storage is limited to the short-lived token, non-secret form convenience values, and the optional connected-sheet label.

## 5. New project structure

```text
backend/
  src/config/env.ts
  src/db/database.ts
  src/security/{auth,ssrf,sanitize}.ts
  src/services/{mapsScraper,websiteAuditor,socialScraper,aiAnalyzer,emailService,wahaService,googleSheetsSync,runPipeline}.ts
  src/routes/{auth,api}.ts
  src/server.ts
  tests/
frontend/
  src/api/client.ts
  src/App.tsx
  src/styles.css
  src/types.ts
  src/main.tsx
reference/
  supplied n8n JSON files and HTML file
docs/ANALYSIS.md
```

## 6. Deliberate limitations and next production steps

- Google OAuth consent flows are not included; the optional Sheets connector expects a server-managed access token. Add OAuth only when the deployment has a secure callback/session store.
- SMTP is the server-side send connector. Gmail compose links work without it. A Gmail API adapter can be added behind the same `emailService` interface.
- Apify, OpenAI, WAHA, SMTP, and Sheets were not called during the local build because no private credentials were supplied.
- The fallback Maps source is clearly deterministic/demo data, not a claim that those businesses were found in Google Maps.
- For a public deployment, add HTTPS termination, a reverse proxy, structured audit logs with PII redaction, secret rotation, per-user tenancy, CSRF protection if cookie sessions are introduced, and provider-specific usage limits.
