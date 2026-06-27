# Won Spent — KRW → USD Expense Tracker

A tiny iPhone-friendly web app (PWA) for logging how much you've spent in
**Korean Won (₩)** and seeing the running total in **US Dollars ($)**.

- 🧮 **Running total** — every expense you add accumulates into one big total.
- 💾 **Saves automatically** — your data is stored on your phone and survives
  closing/reopening the app (uses the browser's `localStorage`).
- 💱 **Editable + live exchange rate** — starts at a sensible default, fetches
  the latest rate when online, and you can override it by hand anytime.
- 📴 **Works offline** — once added to your home screen, it opens without a
  connection (a Service Worker caches the app).
- 🗑️ **Manage history** — delete a single expense or clear everything.

## How the money math works

Each expense is converted to USD using the exchange rate **at the moment you
add it**, and that dollar amount is stored with the entry. Changing the rate
later (or fetching a new live rate) affects *future* entries only — it never
silently rewrites what you already spent. Your total is the sum of all entries.

## Put it on your iPhone (no App Store needed)

This is a website that behaves like a real app. To install it:

1. **Host the files.** The easiest free option is **GitHub Pages**:
   - In this repo on GitHub, go to **Settings → Pages**.
   - Under *Build and deployment*, set **Source = Deploy from a branch**.
   - Pick the branch (e.g. `main` after this is merged) and folder **`/ (root)`**, then **Save**.
   - After a minute, GitHub gives you a URL like
     `https://<your-username>.github.io/what-/`.
2. **Open that URL in Safari on your iPhone.**
3. Tap the **Share** button (the square with an arrow).
4. Tap **Add to Home Screen** → **Add**.
5. You'll now have a **Won Spent** icon on your home screen that opens
   full-screen like a normal app.

> Tip: Use **Safari** for the install step — Add to Home Screen on iOS only
> works from Safari. After installing you can open it from the icon anytime.

## Files

| File | What it is |
|------|------------|
| `index.html` | The entire app (UI + logic). |
| `manifest.json` | Makes it installable as a home-screen app. |
| `sw.js` | Service Worker for offline use. |
| `icons/` | App icons. |
| `tools/make-icons.js` | Regenerates the PNG icons (run `node tools/make-icons.js`). |
| `tools/test-app.js` | Automated browser test of the app (run `node tools/test-app.js`). |

## Developing / testing locally

```bash
# Serve the folder on http://localhost:8000 (Python 3)
python3 -m http.server 8000
# then open http://localhost:8000 in your browser

# Run the automated test suite (installs/uses Playwright)
npm install playwright
node tools/test-app.js
```
