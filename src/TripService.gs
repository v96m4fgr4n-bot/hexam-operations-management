/**
 * Trips sheet: TripId | TripDate | ClientId | ClientName | Destination |
 * OneWayDistanceKm | RoundTripDistanceKm | FuelRatePerKm | FuelCost |
 * TollFee | ZrpFee | VidFee | OtherFeesDescription | OtherFeesAmount |
 * TotalMiscFees | TotalCost | Notes | CreatedAt
 */

/**
 * Computes the cost breakdown for a trip. Always re-reads the fuel rate
 * from Settings server-side so a stale client-side value can never be
 * submitted as truth. Does not persist anything.
 *
 * input: { oneWayDistanceKm, tollFee, zrpFee, vidFee, otherFeesAmount }
 */
function computeTripCost(input) {
  input = input || {};
  var settings = getSettings();

  var oneWayDistanceKm = validatePositiveNumber_(input.oneWayDistanceKm, 'Distance');
  var tollFee = validateNonNegativeNumber_(input.tollFee !== undefined ? input.tollFee : settings.defaultTollFee, 'Toll fee');
  var zrpFee = validateNonNegativeNumber_(input.zrpFee !== undefined ? input.zrpFee : settings.defaultZrpFee, 'ZRP fee');
  var vidFee = validateNonNegativeNumber_(input.vidFee !== undefined ? input.vidFee : settings.defaultVidFee, 'VID fee');
  var otherFeesAmount = validateNonNegativeNumber_(input.otherFeesAmount || 0, 'Other fees');

  var roundTripDistanceKm = round2_(oneWayDistanceKm * 2);
  var fuelCost = round2_(roundTripDistanceKm * settings.fuelRatePerKm);
  var totalMiscFees = round2_(tollFee + zrpFee + vidFee + otherFeesAmount);
  var totalCost = round2_(fuelCost + totalMiscFees);

  return {
    oneWayDistanceKm: oneWayDistanceKm,
    roundTripDistanceKm: roundTripDistanceKm,
    fuelRatePerKm: settings.fuelRatePerKm,
    fuelCost: fuelCost,
    tollFee: tollFee,
    zrpFee: zrpFee,
    vidFee: vidFee,
    otherFeesAmount: otherFeesAmount,
    totalMiscFees: totalMiscFees,
    totalCost: totalCost,
    currencySymbol: settings.currencySymbol
  };
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

  var cost = computeTripCost(tripInput);

  var lock = LockService.getScriptLock();
  lock.waitLock(10000);
  try {
    var sheet = getSpreadsheet_().getSheetByName('Trips');
    var tripId = generateId_('trip');
    var now = new Date();

    sheet.appendRow([
      tripId,
      now,
      client.id,
      client.name,
      destination,
      cost.oneWayDistanceKm,
      cost.roundTripDistanceKm,
      cost.fuelRatePerKm,
      cost.fuelCost,
      cost.tollFee,
      cost.zrpFee,
      cost.vidFee,
      tripInput.otherFeesDescription || '',
      cost.otherFeesAmount,
      cost.totalMiscFees,
      cost.totalCost,
      tripInput.notes || '',
      now
    ]);

    return { success: true, trip: tripRowToObject_({
      TripId: tripId, TripDate: now, ClientId: client.id, ClientName: client.name,
      Destination: destination, OneWayDistanceKm: cost.oneWayDistanceKm,
      RoundTripDistanceKm: cost.roundTripDistanceKm, FuelRatePerKm: cost.fuelRatePerKm,
      FuelCost: cost.fuelCost, TollFee: cost.tollFee, ZrpFee: cost.zrpFee, VidFee: cost.vidFee,
      OtherFeesDescription: tripInput.otherFeesDescription || '', OtherFeesAmount: cost.otherFeesAmount,
      TotalMiscFees: cost.totalMiscFees, TotalCost: cost.totalCost, Notes: tripInput.notes || '',
      CreatedAt: now
    }) };
  } finally {
    lock.releaseLock();
  }
}

function tripRowToObject_(row) {
  return {
    id: row.TripId,
    tripDate: row.TripDate,
    clientId: row.ClientId,
    clientName: row.ClientName,
    destination: row.Destination,
    oneWayDistanceKm: Number(row.OneWayDistanceKm),
    roundTripDistanceKm: Number(row.RoundTripDistanceKm),
    fuelRatePerKm: Number(row.FuelRatePerKm),
    fuelCost: Number(row.FuelCost),
    tollFee: Number(row.TollFee),
    zrpFee: Number(row.ZrpFee),
    vidFee: Number(row.VidFee),
    otherFeesDescription: row.OtherFeesDescription || '',
    otherFeesAmount: Number(row.OtherFeesAmount) || 0,
    totalMiscFees: Number(row.TotalMiscFees),
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
