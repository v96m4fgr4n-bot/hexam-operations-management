# hexam-operations-management

Hexam Bricks operations management — a standalone Google Apps Script web
app covering trip quoting, accounting, and fleet/driver tracking. Not
bound to a spreadsheet as a container; it resolves its backing Google
Sheet by ID (see `Utils.gs`).

Started as a narrow trip-quoting MVP and has grown by direct request into
a broader ops tool: accounting, a dashboard, trend charts, and fleet/driver
management are all now in scope (see "Explicitly out of scope" for what
still isn't). Distance is currently entered manually; Google Maps-based
distance lookup is planned but not yet wired in (needs a Maps Platform API
key with billing enabled, plus a fixed origin point to measure from).

**Note:** this repo also contains an entirely separate, unrelated system —
"Hexam Express Trip Tracker" — which handles live driver/delivery
execution (GPS + odometer-verified deliveries, payment settlement). That
system is not part of this project; it has its own Apps Script project and
spreadsheet.

## Screens

- **Dashboard** (landing screen) — today/month revenue, profit, and trip
  counts, average quote value, active client/bringer counts, recent trips.
- **New Trip** — quote a trip; client and load bringer are both typed
  freehand (see below), with a live client-side cost preview.
- **Trip History** — every saved trip, newest first.
- **Clients** / **Load Bringers** — manage records created via New Trip
  (edit, deactivate/reactivate); Load Bringers also shows a running
  loads-brought/total-paid tally per person.
- **Accounting** — income/expense roll-up and per-trip ledger, derived
  live from Trips.
- **Trends** — 14-day revenue/profit and trip-volume charts, top clients
  by revenue, top load bringers by loads brought.
- **Fleet** — trucks, trailers, roadworthy/service due dates with
  expired/due-soon badges, status (Active / In Repair / Offline), and
  driver-to-truck assignment.
- **Settings** — fuel price/consumption, default trip expenses, margin,
  load levy, currency symbol.

## Quote formula

The app produces a client-facing quote, not just a raw cost total — fuel
cost is built up from price per litre and truck consumption (not a flat
rate), and a company margin is applied on top:

```
round-trip distance (km) = one-way distance (km) x 2
fuel rate per km          = fuel price per litre / fuel consumption (km per litre)
fuel cost                 = round-trip distance x fuel rate per km
trip expenses              = toll fee + ZRP fee + VID fee (+ optional other fee)
subtotal                  = fuel cost + trip expenses
margin amount              = subtotal x (company margin % / 100)
load levy                  = Settings' load levy amount, IF a load bringer
                            name was typed for this trip, else 0
total before discount      = subtotal + margin amount + load levy
quote total                = total before discount − discount amount
```

Toll/ZRP/VID fees default to values in **Settings** but can be overridden
per trip. Every amount is rounded to cents at each stage. The full quote
is always recomputed server-side from the raw inputs (client, distance,
fee overrides, load bringer name, discount) at save time, reading fuel
price/consumption/margin/load levy fresh from Settings — a live preview
updates as you type client-side, but that preview is never trusted as the
value that gets written to the record, and never creates a client or load
bringer record as a side effect (only an actual save does).

**Client & load bringer entry**: neither is picked from a dropdown. Both
are typed freehand on New Trip (with a datalist of existing names for
quick reuse); `findOrCreateClient_` / `findOrCreateLoadBringer_` reuse an
exact case-insensitive name match among active records or create a new
one when the trip is saved. Client name is required, load bringer is
optional — leave it blank when no one referred the load.

**Load levy**: when a trip's load was referred to Hexam by someone (a
"load bringer"), the configured levy is added to *that client's* total —
the client covers the referral payout, the company doesn't absorb it.
Load bringers are paid on the spot per load, not batched. The Load
Bringers screen shows a running tally (loads brought + total paid) per
bringer, derived live from Trips, as a historical record of what's gone
out to each person.

**Discount**: an optional flat amount taken off a trip's total (revealed by
an "Add discount" button on the New Trip screen), validated so it can never
exceed the pre-discount total.

## Sheets

**Settings** (key/value, editable directly in the sheet or via the
Settings screen):

| Key | Default | Meaning |
| --- | --- | --- |
| `FUEL_PRICE_PER_LITRE` | 1.5 | Cost of fuel per litre |
| `FUEL_CONSUMPTION_KM_PER_L` | 2.5 | Truck consumption, km per litre (round-trip average) |
| `DEFAULT_TOLL_FEE` | 0 | Default toll fee, overridable per trip |
| `DEFAULT_ZRP_FEE` | 0 | Default ZRP fee, overridable per trip |
| `DEFAULT_VID_FEE` | 0 | Default VID fee, overridable per trip |
| `COMPANY_MARGIN_PERCENT` | 15 | Margin applied to (fuel cost + trip expenses) to produce the quote |
| `LOAD_LEVY_AMOUNT` | 10 | Paid to whoever brought the load; added to the client's total when a load bringer is named |
| `CURRENCY_SYMBOL` | `$` | Symbol shown next to amounts (display only) |

**Clients**: ClientId, ClientName, ContactPerson, Phone, Email, Address,
Active, CreatedAt. Soft-deleted (Active flag) rather than removed, since
historical trips reference them by ID and must keep working even if a
client goes inactive; quoting under a name that was deliberately
deactivated creates a fresh client rather than silently reactivating it.

**LoadBringers**: LoadBringerId, Name, Phone, Active, CreatedAt. Same
soft-delete pattern as Clients. `getLoadBringerSummary()` groups by
bringer for a running paid-total record.

**Trucks**: TruckId, RegNumber, RoadworthyExpiry, NextServiceDue, Status,
CreatedAt. Status is one of `Active` / `In Repair` / `Offline`. No driver
field — `getTrucks()` derives the assigned driver (if any) by looking for
the Driver record whose AssignedTruckId matches, so the assignment always
has a single source of truth.

**Trailers**: TrailerId, RegNumber, RoadworthyExpiry, NextServiceDue,
Status, CreatedAt. Same shape as Trucks, tracked as a separate fleet asset
(no pairing to a specific truck, since trailers can be swapped between
trucks).

**Drivers**: DriverId, Name, Phone, AssignedTruckId, Active, CreatedAt.
Soft-deleted like Clients/LoadBringers. Assigning a truck already assigned
to a different active driver is rejected rather than silently allowing two
drivers on one truck.

**Trips** (append-only log written by the web app): TripId, TripDate,
ClientId, ClientName, Destination, OneWayDistanceKm, RoundTripDistanceKm,
FuelPricePerLitre, FuelConsumptionKmPerL, FuelRatePerKm, FuelCost,
TollFee, ZrpFee, VidFee, OtherFeesDescription, OtherFeesAmount,
TripExpenses, Subtotal, MarginPercent, MarginAmount, LoadBringerId,
LoadBringerName, LoadLevyAmount, TotalBeforeDiscount, DiscountAmount,
DiscountReason, TotalCost, Notes, CreatedAt.

All sheets, and any Settings keys not yet present, are created/added
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
  ClientService.gs        getClients / addClient / updateClient / (de)reactivateClient /
                          findOrCreateClient_
  LoadBringerService.gs    getLoadBringers / addLoadBringer / updateLoadBringer /
                          (de)reactivateLoadBringer / getLoadBringerSummary /
                          findOrCreateLoadBringer_
  TripService.gs          computeTripQuote_ / getTripQuote / saveTrip / getTrips
  AccountingService.gs    getAccountingSummary(): income/expense roll-up from Trips
  DashboardService.gs      getDashboardSummary(): today/month KPIs, derived live
  TrendsService.gs         getTrendsData(): 14-day trend + top clients/bringers
  FleetService.gs          Trucks/Trailers/Drivers CRUD, dateStatus_() for
                          roadworthy/service due badges
  Index.html               Sidebar+topbar shell (mobile-collapsible)
  CSS.html                 Hexham Bricks-branded styles
  JavaScript.html          Client-side logic: nav, forms, live quote preview,
                          inline SVG charts, API calls
  DashboardView.html      Landing screen: today/month KPIs + recent trips
  NewTripView.html         New Trip screen (client & load bringer entered freehand)
  TripHistoryView.html     Trip History screen
  ClientsView.html          Clients screen (edit/deactivate/reactivate)
  LoadBringersView.html    Load Bringers screen (add/edit/deactivate/reactivate + paid tally)
  AccountingView.html      Accounting screen (income/expense summary + ledger)
  TrendsView.html          Trends screen (revenue/profit/trips charts, top clients/bringers)
  FleetView.html           Fleet screen (trucks/trailers/drivers)
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

Brick inventory, invoicing/billing, dispatch/scheduling (assigning a
specific truck+driver to an upcoming trip), multi-currency conversion, and
user accounts/roles beyond Workspace-domain access. Automated distance
calculation via Google Maps is planned (needs a Maps Platform API key with
billing enabled, and a fixed origin address) but not yet implemented —
`oneWayDistanceKm` is a manual input for now. The Load Bringers/Fleet
"totals" and "due" badges are read-only derived views, not workflows —
there's no "mark levy as paid" or "mark service done" action; the
underlying date/record is edited directly to update them. None of the
out-of-scope items were requested for this build.
