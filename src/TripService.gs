/**
 * Trips sheet: TripId | TripDate | ClientId | ClientName | Destination |
 * OneWayDistanceKm | RoundTripDistanceKm |
 * FuelPricePerLitre | FuelConsumptionKmPerL | FuelRatePerKm | FuelCost |
 * TollFee | ZrpFee | VidFee | OtherFeesDescription | OtherFeesAmount | TripExpenses |
 * Subtotal | MarginPercent | MarginAmount | TotalCost |
 * Notes | CreatedAt
 *
 * Quote build-up (all client-facing pricing derives from Settings, never
 * from a client-submitted number):
 *   fuelRatePerKm = fuelPricePerLitre / fuelConsumptionKmPerL
 *   fuelCost      = roundTripDistanceKm x fuelRatePerKm
 *   tripExpenses  = tollFee + zrpFee + vidFee + otherFeesAmount
 *   subtotal      = fuelCost + tripExpenses
 *   marginAmount  = subtotal x (companyMarginPercent / 100)
 *   totalCost     = subtotal + marginAmount   <- the quote given to the client
 */

/**
 * Computes the full quote breakdown. Always re-reads fuel price, fuel
 * consumption, and margin from Settings server-side so a stale client-side
 * value can never be submitted as truth. Does not persist anything.
 *
 * input: { oneWayDistanceKm, tollFee, zrpFee, vidFee, otherFeesAmount }
 */
function computeTripQuote_(input) {
  input = input || {};
  var settings = getSettings();

  var oneWayDistanceKm = validatePositiveNumber_(input.oneWayDistanceKm, 'Distance');
  var tollFee = validateNonNegativeNumber_(input.tollFee !== undefined ? input.tollFee : settings.defaultTollFee, 'Toll fee');
  var zrpFee = validateNonNegativeNumber_(input.zrpFee !== undefined ? input.zrpFee : settings.defaultZrpFee, 'ZRP fee');
  var vidFee = validateNonNegativeNumber_(input.vidFee !== undefined ? input.vidFee : settings.defaultVidFee, 'VID fee');
  var otherFeesAmount = validateNonNegativeNumber_(input.otherFeesAmount || 0, 'Other fees');

  if (!(settings.fuelConsumptionKmPerL > 0)) {
    throw new Error('Fuel consumption (km per litre) must be set to a positive number in Settings before quoting a trip.');
  }

  var roundTripDistanceKm = round2_(oneWayDistanceKm * 2);
  var fuelRatePerKm = round2_(settings.fuelPricePerLitre / settings.fuelConsumptionKmPerL);
  var fuelCost = round2_(roundTripDistanceKm * fuelRatePerKm);
  var tripExpenses = round2_(tollFee + zrpFee + vidFee + otherFeesAmount);
  var subtotal = round2_(fuelCost + tripExpenses);
  var marginAmount = round2_(subtotal * settings.companyMarginPercent / 100);
  var totalCost = round2_(subtotal + marginAmount);

  return {
    oneWayDistanceKm: oneWayDistanceKm,
    roundTripDistanceKm: roundTripDistanceKm,
    fuelPricePerLitre: settings.fuelPricePerLitre,
    fuelConsumptionKmPerL: settings.fuelConsumptionKmPerL,
    fuelRatePerKm: fuelRatePerKm,
    fuelCost: fuelCost,
    tollFee: tollFee,
    zrpFee: zrpFee,
    vidFee: vidFee,
    otherFeesAmount: otherFeesAmount,
    tripExpenses: tripExpenses,
    subtotal: subtotal,
    marginPercent: settings.companyMarginPercent,
    marginAmount: marginAmount,
    totalCost: totalCost,
    currencySymbol: settings.currencySymbol
  };
}

/** Client-callable: live quote preview, nothing persisted. */
function getTripQuote(input) {
  return computeTripQuote_(input);
}

/**
 * Validates, computes, and persists a trip record.
 *
 * tripInput: { clientId, destination, oneWayDistanceKm, tollFee, zrpFee, vidFee,
 *              otherFeesDescription, otherFeesAmount, notes }
 */
function saveTrip(tripInput) {
  tripInput = tripInput || {};

  var clientId = validateNonEmptyString_(tripInput.clientId, 'Client');
  var client = getClient(clientId);
  if (!client || !client.active) {
    throw new Error('Selected client is not valid or is no longer active.');
  }
  var destination = validateNonEmptyString_(tripInput.destination, 'Destination');
  var otherFeesDescription = String(tripInput.otherFeesDescription || '').trim();
  var notes = String(tripInput.notes || '').trim();

  var quote = computeTripQuote_(tripInput);

  var sheet = getSpreadsheet_().getSheetByName('Trips');
  var id = generateId_('trip');
  var now = new Date();

  sheet.appendRow([
    id, now, clientId, client.name, destination,
    quote.oneWayDistanceKm, quote.roundTripDistanceKm,
    quote.fuelPricePerLitre, quote.fuelConsumptionKmPerL, quote.fuelRatePerKm, quote.fuelCost,
    quote.tollFee, quote.zrpFee, quote.vidFee, otherFeesDescription, quote.otherFeesAmount, quote.tripExpenses,
    quote.subtotal, quote.marginPercent, quote.marginAmount, quote.totalCost,
    notes, now
  ]);

  return {
    success: true,
    trip: tripRowToObject_({
      TripId: id, TripDate: now, ClientId: clientId, ClientName: client.name, Destination: destination,
      OneWayDistanceKm: quote.oneWayDistanceKm, RoundTripDistanceKm: quote.roundTripDistanceKm,
      FuelPricePerLitre: quote.fuelPricePerLitre, FuelConsumptionKmPerL: quote.fuelConsumptionKmPerL,
      FuelRatePerKm: quote.fuelRatePerKm, FuelCost: quote.fuelCost,
      TollFee: quote.tollFee, ZrpFee: quote.zrpFee, VidFee: quote.vidFee,
      OtherFeesDescription: otherFeesDescription, OtherFeesAmount: quote.otherFeesAmount,
      TripExpenses: quote.tripExpenses, Subtotal: quote.subtotal,
      MarginPercent: quote.marginPercent, MarginAmount: quote.marginAmount, TotalCost: quote.totalCost,
      Notes: notes, CreatedAt: now
    })
  };
}

function tripRowToObject_(row) {
  return {
    tripId: row.TripId,
    tripDate: row.TripDate,
    clientId: row.ClientId,
    clientName: row.ClientName,
    destination: row.Destination,
    oneWayDistanceKm: Number(row.OneWayDistanceKm),
    roundTripDistanceKm: Number(row.RoundTripDistanceKm),
    fuelPricePerLitre: Number(row.FuelPricePerLitre),
    fuelConsumptionKmPerL: Number(row.FuelConsumptionKmPerL),
    fuelRatePerKm: Number(row.FuelRatePerKm),
    fuelCost: Number(row.FuelCost),
    tollFee: Number(row.TollFee),
    zrpFee: Number(row.ZrpFee),
    vidFee: Number(row.VidFee),
    otherFeesDescription: row.OtherFeesDescription || '',
    otherFeesAmount: Number(row.OtherFeesAmount) || 0,
    tripExpenses: Number(row.TripExpenses),
    subtotal: Number(row.Subtotal),
    marginPercent: Number(row.MarginPercent),
    marginAmount: Number(row.MarginAmount),
    totalCost: Number(row.TotalCost),
    notes: row.Notes || '',
    createdAt: row.CreatedAt
  };
}

/**
 * options: { clientId, limit }
 * Returns trips newest first.
 */
function getTrips(options) {
  options = options || {};
  var sheet = getSpreadsheet_().getSheetByName('Trips');
  var rows = sheetToObjects_(sheet).map(tripRowToObject_);

  if (options.clientId) {
    rows = rows.filter(function (t) { return t.clientId === options.clientId; });
  }

  rows.sort(function (a, b) { return new Date(b.tripDate) - new Date(a.tripDate); });

  if (options.limit) {
    rows = rows.slice(0, options.limit);
  }

  return rows;
}
