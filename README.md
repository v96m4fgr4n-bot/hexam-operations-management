# Hexam Bricks — Operations Management

A Google Apps Script web app for Hexam Bricks (brick delivery) to cost a
delivery trip for a client: **total cost = fuel cost + toll fee + ZRP fee +
VID fee (+ any other ad-hoc fee)**.

- **Fuel cost** = round-trip distance (one-way distance × 2, entered manually
  in km) × a configurable fuel rate per km.
- **Toll / ZRP / VID fees** each have a configurable default (set once in
  Settings) but can be overridden per trip.
- Data is stored in a Google Sheet created automatically on first setup.
- The app is a standalone Apps Script web app (not a Sheet sidebar) with its
  own URL.

## Project layout

```
src/
  appsscript.json      Manifest (web app config)
  Code.gs              doGet() entry point + HTML include helper
  Setup.gs             One-time initializeSpreadsheet() bootstrap
  SettingsService.gs   Fuel rate / default fee settings
  ClientService.gs     Client CRUD (soft-delete only)
  TripService.gs       Cost calculation + trip persistence + history
  Utils.gs             Shared validation/formatting helpers
  Index.html           SPA shell (topbar + sidebar + views)
  CSS.html             Styles
  JavaScript.html      Client-side logic (google.script.run wiring)
  Logo.html            Base64-encoded Hexham Bricks logo (used inline)
  NewTripView.html      "New Trip" form + live cost preview
  TripHistoryView.html  Trip history table
  ClientsView.html      Client list + add-client form
  SettingsView.html     Fuel rate / default fee form
```

## One-time setup

This repo contains the source code only — it can't create a live Google
Sheet or Apps Script project for you. Do this once, from your own Google
account:

1. Install clasp and log in:
   ```
   npm install
   npx clasp login
   ```
2. Create the Apps Script project (choose ONE):
   - Brand new project: `npx clasp create --type standalone --title "Hexam Bricks Operations" --rootDir src`
   - Or, if you already created a blank script in the browser: `npx clasp clone <scriptId> --rootDir src`

   Either command writes a `.clasp.json` with your real `scriptId`. If you
   used `clasp create`, it may place `.clasp.json` in the repo root already
   pointing at `rootDir: "src"` — if not, copy `.clasp.json.example` to
   `.clasp.json` and paste in the `scriptId` it printed.
3. Push the code:
   ```
   npx clasp push
   ```
4. Open the project in the Apps Script editor and run the setup function:
   ```
   npx clasp open
   ```
   In the editor, select **initializeSpreadsheet** from the function
   dropdown (top toolbar) and click **Run**. Approve the Google Sheets/Drive
   permission prompt the first time. Check **View > Logs** (or **Executions**)
   for the URL of the spreadsheet that was just created — bookmark it, since
   that's where all clients/trips/settings live.

   `initializeSpreadsheet` is safe to re-run — it only creates sheets or
   seeds settings that don't already exist yet.
5. Deploy the web app: **Deploy > New deployment**, type **Web app**,
   execute as **Me**, access **Anyone within [your domain]** (this repo's
   `appsscript.json` is preset with `access: "DOMAIN"`, which requires a
   Google Workspace account — switch it to `"ANYONE_ANONYMOUS"` first if
   you're on a personal Gmail account instead). Copy the resulting web app
   URL — that's the app.

## Making changes later

- `npx clasp push` uploads your local `src/` changes to the Apps Script
  project, but it does **not** update an already-published web app
  deployment on its own.
- After pushing, go to **Deploy > Manage deployments > Edit (pencil icon) >
  New version** (or `npx clasp deploy`) to publish the change to the live
  URL. Skipping this step means users keep hitting the old deployed code.

## Using the app

- **New Trip**: pick a client, enter the destination and one-way distance
  (km), review/adjust the toll/ZRP/VID fees (pre-filled from Settings), and
  save. The total is always recalculated on the server before saving.
- **Trip History**: every saved trip, newest first.
- **Clients**: add clients and deactivate ones you no longer use (past
  trips keep their history either way).
- **Settings**: fuel rate per km, currency symbol, and default toll/ZRP/VID
  fees used to pre-fill new trips.

## Extending

Toll/ZRP/VID fees follow the same shape: one `Settings` key + one `Trips`
column + one form field. A new recurring fee (e.g. a weighbridge fee) can be
added the same way. For a rare one-off fee, use the built-in "Other fee"
field on the New Trip form instead of adding a whole new fee type.
