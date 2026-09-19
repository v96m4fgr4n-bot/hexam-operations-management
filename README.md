# hexam-operations-management

Hexam Bricks operations management — a Google Apps Script web app, bound to
a Google Sheet, for costing delivery trips. Standalone 4-screen app (New
Trip, Trip History, Clients, Settings) with its own URL, restricted to the
Hexam Bricks Google Workspace domain.

This is a deliberately narrow MVP: trip costing plus the minimum supporting
structure (clients, settings, history) needed to make it usable day-to-day.
Fleet/driver management, invoicing, dispatch, automated distance lookup,
and reporting/analytics are all out of scope for this build.

## Cost formula

```
round-trip distance (km) = one-way distance (km) x 2
fuel cost                = round-trip distance x FuelRatePerKm
total cost                = fuel cost + toll fee + ZRP fee + VID fee (+ optional other fee)
```

Toll/ZRP/VID fees default to values in the **Settings** sheet but can be
overridden per trip. Every fee component is rounded to cents individually
(summed in integer cents), so the line items on screen always add up
exactly to the displayed total. The full cost is always recomputed
server-side from the raw inputs (client, distance, fee overrides) at save
time — a live preview updates as you type, but that preview is never
trusted as the value that gets written to the record.

## Sheets

**Settings** (key/value, editable directly in the sheet or via the
Settings screen):

| Key | Default | Meaning |
| --- | --- | --- |
| `FuelRatePerKm` | 0.5 | Fuel cost per km, applied to round-trip distance |
| `CurrencySymbol` | `$` | Symbol shown next to costs (display only) |
| `DefaultTollFee` | 0 | Default toll fee, overridable per trip |
| `DefaultZrpFee` | 0 | Default ZRP fee, overridable per trip |
| `DefaultVidFee` | 0 | Default VID fee, overridable per trip |

**Clients**: Client ID, Name, Contact Person, Phone, Email, Address,
Active. Clients are soft-deleted (Active flag) rather than removed, since
historical trips reference them by ID and must keep working even if a
client goes inactive.

**Trips** (append-only log written by the web app): Trip ID, Timestamp,
Client ID, Client Name, Destination, One-Way Distance (km), Round-Trip
Distance (km), Fuel Rate/km, Fuel Cost, Toll Fee, ZRP Fee, VID Fee, Other
Fee Label, Other Fee Amount, Total Cost, Notes.

All three sheets are created automatically (with Settings defaults) the
first time the web app is opened — no manual setup step required. A
**Hexam Ops > Initialize sheets** spreadsheet menu item runs the same
idempotent setup manually if needed.

## Project layout

```
src/
  appsscript.json   Apps Script manifest
  Code.gs            Server-side logic (doGet, sheet setup, cost calc,
                      clients, settings, trip history)
  Index.html         Sidebar+topbar shell, 4 screens
  Stylesheet.html    Styles (included into Index.html)
  JavaScript.html    Client-side logic: nav, forms, API calls
```

## Deploy

### Option A — clasp (recommended for iterating from this repo)

1. `npm install -g @google/clasp` and `clasp login`.
2. Create a new Google Sheet, then **Extensions > Apps Script** to get its
   container-bound script, and copy the script ID from **Project Settings**
   (or run `clasp create --type sheets --title "Hexam Ops" --parentId <existing-sheet-id>`
   — note `--parentId` does not attach to an existing spreadsheet; it
   always creates a new one, so the simplest path is letting `clasp create`
   make the Sheet for you).
3. Copy `.clasp.json.example` to `.clasp.json` and paste in the script ID
   (this file is gitignored — it's local machine config, not project code).
4. `clasp push` to upload `src/` to the script.
5. `clasp deploy --description "..."` (or **Deploy > New deployment > Web
   app** in the Apps Script editor).
   - Execute as: **User deploying**
   - Who has access: choose based on your org (e.g. "Anyone within
     [your domain]" for an internal tool). The manifest defaults to
     `DOMAIN` access — change it in the deploy dialog if that doesn't fit.
6. Open the deployed web app URL — the `Settings`/`Clients`/`Trips` sheets
   are created automatically on first load.

To ship a code change to an existing deployment (keeping its URL stable),
redeploy to the same deployment ID: `clasp deploy -i <deploymentId>`.

### Option B — copy/paste into the Apps Script editor

1. Create a new Google Sheet.
2. **Extensions > Apps Script**.
3. Delete the default `Code.gs` content and create files matching those in
   `src/` (`Code.gs`, `Index.html`, `Stylesheet.html`, `JavaScript.html`),
   pasting in each file's contents. Update `appsscript.json` via
   **Project Settings > Show "appsscript.json"**.
4. Follow steps 5–6 from Option A.

## Explicitly out of scope

Fleet/vehicle management, driver management, brick inventory, invoicing,
dispatch/scheduling, automated distance calculation (Maps API), reporting/
analytics, multi-currency conversion, and user accounts/roles beyond
Workspace-domain access. None of these were requested for this build.
