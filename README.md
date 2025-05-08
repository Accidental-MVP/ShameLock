# 🧠 ShameLock

**The AI-powered browser extension that punishes your distractions by publicly documenting them.**

You know those productivity tools that gently remind you to stay focused?

Yeah, this isn't one of those.

**ShameLock** is an emotionally unstable Chrome extension that:
- Tracks your focus sessions
- Detects if you dare visit blocked sites (like YouTube, Twitter, etc.)
- Blasts your failures straight to GitHub as public issues
- Roasts you with AI-generated insults using Gemini
- Logs your mistakes daily in `FAIL_YYYY-MM-DD.md` files
- And yells at you with full-screen warning overlays because you clearly can’t be trusted

Built for the easily distracted, masochistically motivated, and anyone who thinks “accountability” should involve a Git history.

---

## 🚀 Features

### 🕒 Focus Timer
- Start a focus session for any duration
- Timer runs in the background, even if you close the popup
- Clean visual UI with countdown and progress ring

### 🔥 Distraction Detection
- Monitors all open tabs
- Fully customizable list of blocked domains
- Real-time detection when a blocked site is opened

### 🢨 Instant Shame Response
When you fail to focus, the app retaliates with:

1. **GitHub Issue Creation**  
   - Creates an issue in your chosen repo
   - Title: `Failed to focus: [site] at [time]`  
   - Body includes a **roast from Gemini**

2. **Fail Log File Append**  
   - Appends to `failed_logs/FAIL_YYYY-MM-DD.md`  
   - Logs site, time, and optional roast

3. **Fullscreen Site Blocker**  
   - Injects a dramatic fullscreen overlay into the tab  
   - Displays: `🚨 STOP WASTING TIME 🚨`  
   - Unmissable. Unskippable. Unapologetic.

4. **Browser Notification**  
   - Sends a Chrome notification like:  
     > “👿 Shame Detected”

### 🤖 Gemini-Powered Roasts
- Generates sarcastic and targeted one-liner roasts via Gemini API
- Optimized prompt for maximum passive-aggression
- Stored in issues and fail logs for eternal judgment

### 🔐 API Key Support
- Users can add their own Gemini API key
- Or use default key for testing
- Stored safely in `chrome.storage.local`

### 🧠 Configuration
- Add/remove blocked domains on the fly via popup
- Changes persist across sessions
- Live-updated blocking behavior

### 👷 Developer Stuff
- All errors are gracefully handled
- Clean file structure
- Modular, extensible codebase
- .gitignore, auth server hosted on Vercel, etc.

---

## 🧪 Why This Exists

Because:
- You said you'd "just check Twitter for a second"
- And now it's 47 minutes later
- And you deserve consequences

---

## 🧷 Installation

1. Clone the repo:
```bash
git clone https://github.com/accidental-mvp/shamelock
```

2. Load as unpacked extension in Chrome:
   - Go to `chrome://extensions`
   - Enable "Developer Mode"
   - Click "Load Unpacked"
   - Select the `shamelock-extension` folder

3. Add your Gemini API key (or not — it’ll use the fallback if you're just here to vibe)

4. Start a focus session and try not to disappoint yourself.

---

## 🧬 Notes
- This extension will not fix your life.
- But it will roast you when you ruin it yourself.

---

## 🤝 Contributions

PRs welcome. But only if you write code that insults people more effectively than I already do.

---

## 📜 License

MIT. Because shame should be open source.
