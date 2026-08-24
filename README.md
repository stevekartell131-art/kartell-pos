# KARTELL POS — Website Prototype (fixed build)

A front-end prototype based on the Kartell POS PRD, now with real state instead of a static mockup.

## Run
Open `index.html` in Chrome/Edge/Firefox. No build step required.

## What changed from the original mockup
- **Persistence**: all orders, tables, payments, and settings are saved to `localStorage` (key `kartellPOS_v1`) and survive a reload.
- **Login gate**: sign-in screen wired to the "Require login" setting, with 4 demo staff accounts and PINs (shown on the login screen).
- **Real table binding**: clicking a table opens the order modal for *that* table, not a hardcoded "Table 02".
- **Split billing**: the payment modal has a real split-by-guest-count flow that creates one payment record per guest.
- **M-Pesa flow**: phone number validation + a simulated STK push sequence (sending → waiting for PIN → confirmed) before the order is marked paid.
- **KOT board wired to real orders**: new → preparing → ready → served stages actually drive what shows on the Kitchen page, Orders page, and Dashboard.
- **Orders/category filters work**: the filter and category tab buttons in Orders and Menu were previously decorative; they now filter the underlying data.
- **Settings persist and apply**: restaurant name/currency/footer/toggles save to state and update the sidebar and dashboard live.

## Known limitations (still a prototype)
- Menu items are a hardcoded array — no add/edit/delete UI yet, despite the "+ Add Menu Item" button (it just shows a toast).
- M-Pesa is simulated client-side; there is no Daraja API call.
- No multi-device sync — `localStorage` is per-browser, per-device.
- No real auth — PINs are hardcoded in the front-end source, fine for a demo, not for production.

## Next integration
Recommended production architecture:
Renderer UI → preload/contextBridge → IPC → better-sqlite3 → SQLite

Replace the `load()`/`save()` functions in `app.js` with IPC calls to the Electron main process, and replace the M-Pesa simulation in `confirmPayment()` with a real Daraja STK push request from the backend.
