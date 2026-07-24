# Recall AI

A Chrome extension that captures your prompts across ChatGPT, Claude, Gemini, Perplexity, Copilot, Meta AI, and Grok, then surfaces them in a searchable dashboard and history view with AI-generated tags, summaries, and weekly insights.

- **Extension:** `recallai_fixed_extension/` (Manifest V3, vanilla JS/HTML/CSS)
- **Backend:** `backend/` (Node.js + Express + Supabase + Google Gemini)
- **Database:** Supabase (Postgres) — schema/migrations are the `.sql` files in the project root

---

## Project Structure

```
recallai_fixed_extension/
├── manifest.json            # MV3 manifest — permissions, content scripts, side panel
├── background.js            # Service worker (dedup layer 3, alarms)
├── content.js                # Injected into AI chat sites (dedup layers 1–2)
├── page-context.js           # MAIN-world script for network interception
├── auth-helper.js, i18n.js, debug.js/html
├── theme.js, theme-vars.css  # Shared design tokens (light/dark)
├── sidebar common/           # Shared sidebar markup/CSS/JS (unification work)
├── home-page/                # Signup
├── login-page/               # Login
├── forgot-page/              # Forgot password
├── onboarding-page/           # Onboarding
├── dashboard-page/            # Main dashboard
├── history-page/              # Prompt history + search
├── insights-page/             # Weekly AI insights
├── profile-page/              # Profile editing
├── setting-page/              # Settings (account, billing)
└── subscription-page/          # Subscription/upgrade

backend/
├── server.js                 # Express entry point
├── routes/
│   ├── authRoutes.js          # signup, login, /me
│   ├── searchRoutes.js        # save/search/stats/insight/share/semantic search
│   └── userRoutes.js          # password reset, email verification, settings,
│                               # subscription, export, account deletion
├── middleware/authMiddleware.js
├── supabaseClient.js
├── geminiClient.js            # Google Gemini (tagging, summaries, insights)
├── embeddingClient.js         # Embeddings for semantic search
└── .env                       # Local environment config (not committed in production)

*.sql (project root)           # Supabase schema + migrations, run in order noted below
```

---

## How It Works

1. **Capture** — `page-context.js` and `content.js` intercept prompts on supported AI sites. Three dedup layers prevent duplicate captures: an in-memory window, a `sessionStorage` TTL, and a background service-worker check.
2. **Sync** — Captured prompts are sent to the backend, tagged and summarized by Gemini, and stored in Supabase.
3. **Review** — The extension's dashboard, history, and insights pages let you browse, search (including semantic search), combine/summarize multiple prompts, and share individual entries via a public link.

> Note: DOM observers are disabled for Claude and ChatGPT (`NETWORK_ONLY_PLATFORMS`) to avoid duplicate captures — this relies on the network interceptor working correctly and has no DOM fallback if that interceptor is blocked (e.g. by CSP changes on the target site).

---

## Setup

### 1. Supabase

1. Create a free project at [supabase.com](https://supabase.com).
2. In **SQL Editor**, run the `.sql` files in the project root. Recommended order (base schema first, then incremental migrations/fixes):
   - `supabase_migration.sql`
   - `Profile_User_searches_Schema.sql`
   - `Auth_Setting_Billing_Offilinesync_table.sql`
   - `Add_Emailverification_Status.sql`
   - `Create_Password_Reset_Token_table.sql`
   - `Store_pending_Signup_Detail_OTP_Reset.sql`
   - `OTP_Passwoed_Reset_Storage.sql`
   - `OTP Reset Tracking.sql`
   - `OTP_reset_Tracking_EmailVerification_Repair.sql`
   - `add_profile_extended_fields.sql`
   - `add_source_url_migration.sql`
   - `short_title_migration.sql`
   - `semantic_search_migration.sql`
   - `combined_summaries_migration.sql`
   - `search_response.sql` / `supabase_serchresponse.sql`
   - `check_and_fix_bio_column.sql` / `fix_missing_columns.sql` (repair scripts — run only if you hit missing-column errors)
3. Under **Settings → API**, copy the Project URL, `anon` key, and `service_role` key.

### 2. Google Gemini API key

Get a free key at [aistudio.google.com](https://aistudio.google.com) → **Get API Key**.

### 3. Backend environment

Create/edit `backend/.env`:

```
SUPABASE_URL=https://xxxx.supabase.co
SUPABASE_ANON_KEY=eyJ...
SUPABASE_SERVICE_KEY=eyJ...
JWT_SECRET=any-long-random-string
GEMINI_API_KEY=AIza...
PORT=5000
FRONTEND_URL=*

# Email (Resend) — used for verification and password-reset emails
RESEND_API_KEY=re_...
RESEND_FROM_EMAIL=you@yourdomain.com   # must be on a verified Resend domain
```

> **Known issue:** email delivery is currently affected by unverified sender domains — `authRoutes.js` and `userRoutes.js` have `onboarding@resend.dev` hardcoded as a fallback `from` address in places. Verify your own domain in Resend and update those hardcoded addresses before relying on email flows in production.

### 4. Run the backend

```bash
cd backend
npm install
npm start        # or: npm run dev (nodemon)
```

Visit `http://localhost:5000` — you should get a JSON status response listing all available endpoints.

### 5. Load the extension

1. Go to `chrome://extensions`.
2. Enable **Developer mode**.
3. Click **Load unpacked** and select `recallai_fixed_extension/`.
4. Sign up via the extension's side panel, then log in.

### 6. Point the extension at a deployed backend

If you deploy the backend (e.g. to Render), update the backend URL used in the extension's JS files and add the deployed URL to `manifest.json` → `host_permissions`.

---

## API Reference

Base path assumes `http://localhost:5000` locally.

| Method | Endpoint | Auth | Description |
|---|---|---|---|
| POST | `/api/auth/signup` | No | Create account |
| POST | `/api/auth/login` | No | Login, returns JWT |
| GET | `/api/auth/me` | Yes | Get current user |
| POST | `/api/searches/save` | Yes | Save a search (AI-tagged) |
| GET | `/api/searches/` | Yes | Get all searches |
| GET | `/api/searches/?q=keyword` | Yes | Keyword search |
| GET | `/api/searches/semantic-search?q=` | Yes | Semantic (embedding) search |
| POST | `/api/searches/embed-all` | Yes | Backfill embeddings |
| POST | `/api/searches/retag-all` | Yes | Backfill AI tags |
| GET | `/api/searches/stats` | Yes | Dashboard stats |
| GET | `/api/searches/insight` | Yes | AI weekly insight |
| DELETE | `/api/searches/:id` | Yes | Delete a search |
| PATCH | `/api/searches/:id/share` | Yes | Make a search public |
| PATCH | `/api/searches/:id/unshare` | Yes | Revoke sharing |
| GET | `/api/searches/shared/:token` | No | View a shared search |
| POST | `/api/user/forgot-password` | No | Request OTP/reset |
| POST | `/api/user/reset-password` | No | Complete reset |
| POST | `/api/user/password` | Yes | Change password |
| POST | `/api/user/resend-verification` | Yes | Resend verification email |
| POST | `/api/user/verify-email` | Yes | Verify email |
| GET/POST | `/api/user/settings` | Yes | Read/save settings |
| GET | `/api/user/subscription` | Yes | Get subscription status |
| POST | `/api/user/subscription/upgrade` | Yes | Upgrade plan |
| POST | `/api/user/subscription/cancel` | Yes | Cancel plan |
| GET | `/api/user/export?format=json\|csv` | Yes | Export user data |
| DELETE | `/api/user/account` | Yes | Delete account (GDPR) |
| GET | `/api/ping` | No | Health check |

"Auth: Yes" means the request must include an `Authorization: Bearer <token>` header.

---

## Known Issues / In Progress

- **Sidebar unification** — Settings and Profile pages historically used a different sidebar implementation (240px width, different markup/IDs) from Dashboard, History, and Subscription (288px, shared structure). Shared `sidebar-common.css`/`sidebar-common.js`/`sidebar-markup.html` now exist under `recallai_fixed_extension/sidebar common/` — confirm all five pages have been updated to use them with the correct `data-page` active state.
- **`history.js` sidebar user info** — historically didn't populate sidebar user info despite the DOM IDs being present; verify this is fixed if working in that page.
- **Logout button placement** — previously lived only in the Settings sidebar; should be relocated to the Account tab once the sidebar is fully unified.
- **Email delivery** — see the Resend note in Setup step 3 above.
- **Dashboard combine-and-summarize** — the multi-select + merged AI summary feature was being ported from the History page to the Dashboard page; confirm parity if working on this area.

---

## Design System

Four-color palette (Off-White Ice / Deep Scholar Slate / Amber Marigold / Soft Fog) following a 60/30/10 rule, defined as CSS variables in `theme-vars.css`, with light mode as the default (`theme.js`).
