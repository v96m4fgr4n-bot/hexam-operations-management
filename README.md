# hexam-operations-management

Hexam Bricks operational costs — a Google Apps Script web app, bound to a
Google Sheet, that costs a delivery trip for a client.

## Cost formula

```
round-trip distance (km) = one-way distance (km) x 2
fuel cost                = round-trip distance x FuelRatePerKm
total cost                = fuel cost + toll fee + ZRP fee + VID fee (+ optional other fee)
```

Toll/ZRP/VID fees default to values in the **Settings** sheet but can be
overridden per trip. Every save recomputes the full cost server-side from
the raw inputs (client name, one-way distance, fee overrides) — the app
never trusts a cost value sent from the browser.

## Sheets

**Settings** (key/value, editable directly in the sheet):

| Key | Default | Meaning |
| --- | --- | --- |
| `FuelRatePerKm` | 3.5 | Fuel cost per km, applied to round-trip distance |
| `DefaultTollFee` | 0 | Default toll fee, overridable per trip |
| `DefaultZrpFee` | 0 | Default ZRP fee, overridable per trip |
| `DefaultVidFee` | 0 | Default VID fee, overridable per trip |

**Trips** (append-only log written by the web app):

Trip ID, Timestamp, Client Name, One-Way Distance (km), Round-Trip Distance
(km), Fuel Rate/km, Fuel Cost, Toll Fee, ZRP Fee, VID Fee, Other Fee Label,
Other Fee Amount, Total Cost.

## Project layout

```
src/
  appsscript.json   Apps Script manifest
  Code.gs            Server-side logic (doGet, cost calc, save)
  Index.html         Form + breakdown UI
  Stylesheet.html    Styles (included into Index.html)
  JavaScript.html    Client-side logic (included into Index.html)
```

## Deploy

### Option A — clasp (recommended for iterating from this repo)

1. `npm install -g @google/clasp` and `clasp login`.
2. Create a new Google Sheet, then **Extensions > Apps Script** to get its
   container-bound script, and copy the script ID from **Project Settings**
   (or run `clasp create --type sheets --title "Hexam Ops"` to create a new
   bound Sheet + script from scratch).
3. Copy `.clasp.json.example` to `.clasp.json` and paste in the script ID
   (this file is gitignored — it's local machine config, not project code).
4. `clasp push` to upload `src/` to the script.
5. In the Apps Script editor: **Deploy > New deployment > Web app**.
   - Execute as: **User deploying**
   - Who has access: choose based on your org (e.g. "Anyone within
     [your domain]" for an internal tool). The manifest defaults to
     `DOMAIN` access — change it in the deploy dialog if that doesn't fit.
6. Open the Sheet once, use the **Hexam Ops > Initialize sheets** menu item
   to create the `Settings` and `Trips` tabs with default values.
7. Open the deployed web app URL to use the cost calculator.

### Option B — copy/paste into the Apps Script editor

1. Create a new Google Sheet.
2. **Extensions > Apps Script**.
3. Delete the default `Code.gs` content and create files matching those in
   `src/` (`Code.gs`, `Index.html`, `Stylesheet.html`, `JavaScript.html`),
   pasting in each file's contents. Update `appsscript.json` via
   **Project Settings > Show "appsscript.json"**.
4. Follow steps 5–7 from Option A.
