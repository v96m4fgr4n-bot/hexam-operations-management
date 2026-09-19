# Hexam Bricks — Operations Management

A Google Apps Script web app for Hexam Bricks (brick delivery) to cost a
delivery trip for a client: **total cost = fuel cost + toll fee + ZRP fee +
VID fee (+ any other ad-hoc fee)**.

- **Fuel cost** = round-trip distance (one-way distance × 2, entered manually
  in km) × a configurable fuel rate per km.
- **Toll / ZRP / VID fees** each have a configurable default (set once in
  Settings) but can be overridden per trip.
- Data is stored in a Google Sheet, pre-wired to a spreadsheet already
  created for this deployment (falls back to auto-creating one if that
  sheet isn't reachable — see "One-time setup").
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
   permission prompt the first time.

   `src/Utils.gs` has `DEFAULT_SPREADSHEET_ID` pre-set to a spreadsheet
   already created for this deployment — `initializeSpreadsheet` opens that
   sheet and adds the `Settings`/`Clients`/`Trips` tabs to it, rather than
   creating a brand-new spreadsheet (it only creates a new one if that ID
   can't be opened, e.g. it's ever deleted or unshared). Check **View >
   Logs** (or **Executions**) to confirm the spreadsheet URL it used.

   To point the app at a *different* sheet instead (e.g. a separate
   test/staging copy), open **Project Settings > Script Properties** and add
   a `SPREADSHEET_ID` property with that sheet's ID — it takes priority over
   the default.

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
