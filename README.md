# hexam-operations-management

Hexam Bricks operations management — a standalone Google Apps Script web
app for quoting delivery trips. Not bound to a spreadsheet as a container;
it resolves its backing Google Sheet by ID (see `Utils.gs`).

This is a deliberately narrow MVP: trip quoting plus the minimum
supporting structure (clients, settings, history) needed to make it usable
day-to-day. Fleet/driver management, invoicing, dispatch, and reporting/
analytics are out of scope for this build. Distance is currently entered
manually; Google Maps-based distance lookup is planned but not yet wired
in (needs a Maps Platform API key with billing enabled, plus a fixed
origin point to measure from).

**Note:** this repo also contains an entirely separate, unrelated system —
"Hexam Express Trip Tracker" — which handles live driver/delivery
execution (GPS + odometer-verified deliveries, payment settlement). That
system is not part of this project; it has its own Apps Script project and
spreadsheet.

## Quote formula

The app produces a client-facing quote, not just a raw cost total — fuel
cost is built up from price per litre and truck consumption (not a flat
rate), and a company margin is applied on top:

```
round-trip distance (km) = one-way distance (km) x 2
fuel rate per km          = fuel price per litre x fuel consumption (litres/km)
fuel cost                 = round-trip distance x fuel rate per km
trip expenses              = toll fee + ZRP fee + VID fee (+ optional other fee)
subtotal                  = fuel cost + trip expenses
margin amount              = subtotal x (company margin % / 100)
quote total                = subtotal + margin amount
```

Toll/ZRP/VID fees default to values in **Settings** but can be overridden
per trip. Every amount is rounded to cents at each stage. The full quote
is always recomputed server-side from the raw inputs (client, distance,
fee overrides) at save time, reading fuel price/consumption/margin fresh
from Settings — a live preview updates as you type client-side, but that
preview is never trusted as the value that gets written to the record.

## Sheets

**Settings** (key/value, editable directly in the sheet or via the
Settings screen):

| Key | Default | Meaning |
| --- | --- | --- |
| `FUEL_PRICE_PER_LITRE` | 1.5 | Cost of fuel per litre |
| `FUEL_CONSUMPTION_L_PER_KM` | 0.4 | Truck consumption, litres per km (round-trip average) |
| `DEFAULT_TOLL_FEE` | 0 | Default toll fee, overridable per trip |
| `DEFAULT_ZRP_FEE` | 0 | Default ZRP fee, overridable per trip |
| `DEFAULT_VID_FEE` | 0 | Default VID fee, overridable per trip |
| `COMPANY_MARGIN_PERCENT` | 15 | Margin applied to (fuel cost + trip expenses) to produce the quote |
| `CURRENCY_SYMBOL` | `$` | Symbol shown next to amounts (display only) |

**Clients**: ClientId, ClientName, ContactPerson, Phone, Email, Address,
Active, CreatedAt. Clients are soft-deleted (Active flag, toggleable from
the Clients screen) rather than removed, since historical trips reference
them by ID and must keep working even if a client goes inactive. Trips
can only be quoted for an active client.

**Trips** (append-only log written by the web app): TripId, TripDate,
ClientId, ClientName, Destination, OneWayDistanceKm, RoundTripDistanceKm,
FuelPricePerLitre, FuelConsumptionLPerKm, FuelRatePerKm, FuelCost,
TollFee, ZrpFee, VidFee, OtherFeesDescription, OtherFeesAmount,
TripExpenses, Subtotal, MarginPercent, MarginAmount, TotalCost, Notes,
CreatedAt.

All three sheets, and any Settings keys not yet present, are created/added
automatically the first time the web app is opened (`initializeSpreadsheet`,
called from `doGet()`). It's additive and idempotent — it never overwrites
a value someone has already edited, and can also be run manually from the
Apps Script editor.

## Project layout

```
src/
  appsscript.json      Apps Script manifest (standalone, DOMAIN-restricted web app)
  Code.gs               doGet/include
  Utils.gs               Spreadsheet resolution, validation, rounding, currency formatting
  Setup.gs                initializeSpreadsheet(): sheet + Settings bootstrap, migration-safe
  SettingsService.gs      getSettings / updateSettings
  ClientService.gs        getClients / getClient / addClient / updateClient /
                          deactivateClient / reactivateClient
  TripService.gs          computeTripQuote_ / getTripQuote / saveTrip / getTrips
  Index.html               Sidebar+topbar shell (mobile-collapsible)
  CSS.html                 Hexham Bricks-branded styles
  JavaScript.html          Client-side logic: nav, forms, live quote preview, API calls
  NewTripView.html         New Trip screen
  TripHistoryView.html     Trip History screen
  ClientsView.html          Clients screen (add/edit/deactivate/reactivate)
  SettingsView.html        Settings screen
```

## Deploy

1. `npm install -g @google/clasp` and `clasp login`.
2. Copy `.clasp.json.example` to `.clasp.json` and paste in the target
   script ID (this file is gitignored — it's local machine config, not
   project code).
3. `clasp push` to upload `src/` to the script.
4. `clasp deploy -i <deploymentId>` to ship to the existing stable
   deployment URL (omit `-i` to create a new deployment/URL instead).
5. Open the deployed web app URL — sheets and Settings are created/migrated
   automatically on first load.

Access is restricted to the `DOMAIN` (Google Workspace) the script's owner
belongs to. If a signed-in user gets a generic "unable to open" error
instead of a normal permission prompt, it usually means their Google
account isn't recognized as a member of that Workspace domain, not that
the app is broken.

## Explicitly out of scope

Fleet/vehicle management, driver management, brick inventory, invoicing,
dispatch/scheduling, reporting/analytics, multi-currency conversion, and
user accounts/roles beyond Workspace-domain access. Automated distance
calculation via Google Maps is planned (needs a Maps Platform API key with
billing enabled, and a fixed origin address) but not yet implemented —
`oneWayDistanceKm` is a manual input for now. None of the out-of-scope
items were requested for this build.
