# Blind Typing Test – Hackathon Project

A small but complete web app for running a **blind typing competition** with separate **Participant** and **Admin** views, real‑time tracking, and AI‑generated paragraphs.

---

## 1. Tech Stack

- **Frontend:** Pure `HTML`, `CSS`, `JavaScript` (no frameworks)
- **Storage:** Browser `localStorage` for paragraphs, results, and test state
- **AI:** Google Gemini API (`gemini-2.0-flash-lite`) via `fetch`
- **Deployment:** Single‑page app (`index.html`) – runs on any static server

Files:
- `index.html` – full app (UI + logic)
- `server.js`, `package.json` – optional small Node server if you want to run via `npm start`

---

## 2. How to Run

### Option A – Easiest (open directly)

1. Locate `index.html`.
2. Double‑click to open it in a modern browser (Chrome recommended).
3. App is fully client‑side, so it works directly from the file system.

> Use this in the lab: copy the folder to each machine and open `index.html`.

### Option B – Run with Node.js (optional)

If you want a local server:

1. Install Node.js (if not already installed).
2. In this project folder, run:

```powershell
npm install
npm start
```

3. Open the shown URL in your browser (usually `http://localhost:3000`).

---

## 3. Roles & Flows

### Participant View

1. Click **“Participant”** in the top navigation (default view).
2. **Register:**
   - Enter your name.
   - Read the **Competition Rules** below the form.
   - Click **Register**.
3. **Waiting Screen:**
   - See your name and “Waiting for Admin to Start Test…”.
   - Review quick reminders.
   - A **Caps Lock warning badge** will appear if Caps Lock is ON.
4. **During Test:**
   - When admin starts a test, the typing screen appears automatically.
   - Top shows a **countdown timer**.
   - Paragraph is visible; your input box is a **blind input**:
     - Typed text is hidden.
     - Copy/paste and right‑click are disabled.
   - A character counter shows how many characters you typed.
5. **Submission & Results:**
   - Test auto‑submits when time runs out or when you finish early.
   - Results screen shows:
     - WPM (words per minute)
     - CPM (characters per minute)
     - Accuracy %
     - Final score (accuracy + speed)
   - Click **“Take Another Test”** to go back to waiting for the next round.

### Admin View

1. Click **“Admin”** in the top navigation.
2. Log in with default credentials:
   - Username: `admin`
   - Password: `admin123`
3. Admin Dashboard has three main sections:

#### a) Logged‑In Participants

- Shows all active participants with:
  - Name
  - A small status dot and “time since login” (e.g., `30s ago`).
- Uses a **heartbeat system**:
  - Each participant sends a heartbeat every 2 seconds.
  - Inactive participants (no heartbeat > 15 seconds) are automatically removed.

#### b) Test Control

- **Select Paragraph** from the dropdown.
- Set **Time Limit (seconds)** (between 10 and 600).
- Use buttons:
  - **Start Test** – Launches the test for all waiting participants.
  - **Stop Test** – Force‑stops the test.
- Status bar shows whether the test is **active** or **not active**.

#### c) Paragraph Management + AI Generation

- Scroll down to “Paragraph Management”.
- Features:
  - **Paragraph List** – shows current paragraphs with:
    - `Edit` button: opens a modal to change text.
    - `Del` button: deletes the paragraph.
  - **Add Paragraph** – textarea + button to add manually.

##### AI Paragraph Generation

- “✨ Generate with AI” section:
  - Topic input, e.g., “technology”, “sports”, “nature”.
  - Toggles:
    - **Include Punctuation** (on by default)
    - **Include Numbers**
  - Click **“🤖 Generate Paragraph”**:
    - Sends a prompt to the **Gemini API**.
    - Shows loading spinner while generating.
    - Automatically adds the new paragraph to the paragraph list.
- If the API key quota is exceeded, you’ll see a clear error popup.

---

## 4. Scoring Logic

- Raw metrics:
  - `charsTyped` – total characters typed.
  - Raw WPM and CPM computed from `charsTyped` and elapsed time.
- Accuracy:
  - Compares typed text with the original paragraph.
- **Adjusted WPM:**  
  `finalWpm = rawWpm × (accuracy / 100)`
- Final Score:
  - Combines **60% accuracy** + **40% speed score** (speed capped for fairness).

---

## 5. Design & UX Highlights

- Modern **glassmorphism** design:
  - Blurred cards, gradient backgrounds, soft shadows.
- **Dark & Light themes**:
  - Theme toggle button at top‑right.
  - Theme choice saved in `localStorage`.
- **Accessibility & UX touches**:
  - Focus outlines, reduced motion friendly.
  - Clear error/success alerts.
  - Caps Lock indicator on waiting and test screens.
  - Competition rules visible before and during the test.

---

## 6. Configuration Notes

- **AI Key:**  
  - Gemini API key is embedded in `index.html` for hackathon/demo use.
  - For production, move it server‑side or use a proxy to protect the key.
- **Admin Credentials:**  
  - Default: `admin / admin123`  
  - Can be changed in the JavaScript `DEFAULT_DATA.admin` section.

---

## 7. Pitch Summary (for judges)

> “This is a fully client‑side blind typing competition app built with pure HTML, CSS and JavaScript. It uses `localStorage` to persist participants, paragraphs, and results, plus a heartbeat and polling system to track active users in real time without a backend. The admin can manage tests, see logged‑in participants, and generate new practice paragraphs on the fly using the Gemini API, with options for punctuation and numbers. The interface uses a modern glassmorphism design with dark/light themes, Caps Lock detection, and clear competition rules to provide a polished, hackathon‑ready experience.”
