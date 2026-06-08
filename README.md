# Blind Typing Test

A real-time blind typing competition platform built at a college hackathon in ~2 hours, then refined post-event with production-grade AI integration.

> **Hackathon context:** Built solo in a 2-hour window. The core mechanic (blind input, admin/participant split, heartbeat tracking, localStorage sync) was all shipped in that window. Post-event I secured the AI layer, added a server-side proxy, built a model fallback chain, and added AI-powered post-test feedback.

---

## What it does

Participants register, wait for the admin to start a test, then type a given paragraph with their input hidden — no visual feedback while typing. The admin controls the test lifecycle, manages paragraphs, and can generate new ones on demand using AI. After each test, participants receive personalised AI coaching feedback based on their WPM, accuracy, and final score.

---

## Tech Stack

| Layer | Choice |
|-------|--------|
| Frontend | Pure HTML + CSS + JavaScript (no framework) |
| Backend | Node.js + Express |
| AI | OpenRouter API (free tier) — `liquid/lfm-2.5-1.2b-instruct` with fallbacks |
| Storage | `localStorage` (standalone mode) / `data.json` (server mode) |
| Security | `.env` for secrets, server-side AI proxy, rate limiting, input sanitisation |

---

## How to Run

```bash
npm install
npm start
# Participant: http://localhost:3000
# Admin:       http://localhost:3000/admin
```

Or just open `index.html` directly in a browser — it works fully client-side (uses localStorage + calls OpenRouter directly).

Admin login: `admin` / `admin123`

---

## Deploy to Vercel (Live Hosting)

The project is pre-configured for Vercel with serverless functions in `api/`.

**1. Push to GitHub**
```bash
git add .
git commit -m "ready for vercel deployment"
git push
```

**2. Import on Vercel**
- Go to [vercel.com](https://vercel.com) → New Project → Import your GitHub repo
- Vercel auto-detects the `api/` folder and `vercel.json`
- No build settings needed — leave everything default

**3. Add Environment Variables**
In your Vercel project → Settings → Environment Variables, add:

| Name | Value |
|------|-------|
| `OPENROUTER_API_KEY` | your OpenRouter key |
| `ADMIN_USERNAME` | `admin` |
| `ADMIN_PASSWORD` | your chosen password |

**4. Deploy**
Click Deploy. Your live URLs will be:
- Participant: `https://your-project.vercel.app`
- Admin: `https://your-project.vercel.app/admin`

> **State note:** The serverless functions use in-memory state which resets on cold starts (~5 min of inactivity). For a live typing competition session this is fine — start the server, run your rounds, done. If you need persistence across restarts, swap `api/_store.js` for Vercel KV.

---

## AI Design Decisions

This section explains the engineering choices behind the AI integration — the parts worth talking about in an interview.

### 1. Server-side API key proxy

The OpenRouter key lives in `.env` and never reaches the browser. The server exposes two endpoints — `/api/generate-paragraph` and `/api/ai-feedback` — which the client calls. This is the correct pattern for any production AI integration.

For the standalone `index.html` (no server), the key is embedded directly — acceptable for a free-tier hackathon key, but the README documents this as a known tradeoff.

### 2. Model fallback chain

Free-tier models get rate-limited (HTTP 429) under load, and some reasoning-only models return `content: null` when they exhaust their token budget on internal reasoning. Rather than hardcoding one model and hoping it's up, both the server and client maintain an ordered list:

```
liquid/lfm-2.5-1.2b-instruct:free   ← primary (confirmed non-reasoning, content always populated)
meta-llama/llama-3.3-70b-instruct:free
google/gemma-4-31b-it:free
meta-llama/llama-3.2-3b-instruct:free
```

Each model is tried in order. If it returns 4xx/5xx or empty content, the next is tried automatically. This was debugged live — the `openrouter/free` auto-router was picking a reasoning model whose output went to `reasoning` not `content`, causing silent failures.

### 3. System + user prompt split

Earlier versions used a single-turn prompt. The current implementation separates concerns:

- **System prompt** defines the output contract (plain text only, 50–80 words, factually accurate)
- **User prompt** encodes the specific request (topic, difficulty tier, punctuation/number options)
- A **few-shot example** is appended to the user prompt to anchor the output format

This reduces hallucinations like markdown headers, quoted text, and length violations.

### 4. Difficulty-aware prompt tiers

Three tiers map to reading-level instructions:

| Tier | Instruction |
|------|-------------|
| Easy | Grade 4–5 level, short sentences, no jargon |
| Medium | Grade 7–8 level, mixed sentence length |
| Hard | Grade 11+ level, complex sentences, precise terminology |

### 5. Prompt injection sanitisation

The topic input from the admin is sanitised before being injected into the prompt — backticks, quotes, and backslashes are stripped (`topic.replace(/['"\\`]/g, '')`). This prevents an admin from injecting instructions that override the system prompt.

### 6. AI post-test feedback

After a test ends, the participant's WPM, accuracy, and final score are sent to the AI with a coaching system prompt and benchmark context. The AI returns 2 sentences of personalised feedback. This is the key example of AI being applied to the app's own data rather than just generating content.

---

## Scoring Logic

```
accuracy     = correctChars / paragraph.length × 100
adjustedWpm  = rawWpm × (accuracy / 100)
speedScore   = min(adjustedWpm / 100, 1) × 100
finalScore   = accuracy × 0.6 + speedScore × 0.4
```

Speed is capped at 100 WPM equivalent to prevent speed-only strategies from dominating. Accuracy weighs 60% of the final score.

---

## Features

**Participant**
- Register by name, wait for admin to start
- Blind textarea — typed text hidden, paste disabled, right-click blocked
- Caps Lock warning indicator
- Countdown timer with colour-coded urgency (yellow at 30s, red + pulse at 10s)
- Auto-submit on timer expiry
- Results screen with WPM, CPM, accuracy, final score
- AI coaching feedback after every test

**Admin**
- Login (credentials in `.env`)
- Live participant list with heartbeat tracking — inactive users auto-removed after 15s
- Test control: select paragraph, set time limit, start/stop
- Paragraph management: add, edit, delete
- AI paragraph generation with topic, difficulty (Easy/Medium/Hard), punctuation toggle, numbers toggle
- Preview-before-save — admin reviews generated paragraph before it enters the pool
- Model badge on each AI-generated paragraph showing which model produced it
- Results dashboard with full leaderboard

**Infrastructure**
- Rate limiting on AI endpoints (10 req/min per IP)
- Input validation on all API routes
- `.gitignore` excludes `.env` and `data.json`

---

## Project Structure

```
blind-typing-test/
├── index.html          # Standalone single-file app (localStorage, direct OpenRouter calls)
├── server.js           # Express server with API routes and server-side AI proxy
├── public/
│   ├── participant.html  # Participant view (server-backed)
│   └── admin.html        # Admin dashboard (server-backed)
├── .env                # API key and admin credentials (not committed)
├── .gitignore
└── package.json
```

---

## Security Notes

- API key in `.env`, never in client code for the server version
- `data.json` excluded from git (runtime state, may contain participant names)
- Admin credentials configurable via `.env`
- All user input validated and sanitised server-side before use
