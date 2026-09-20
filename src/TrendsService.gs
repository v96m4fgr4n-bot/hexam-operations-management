/**
 * Trend data derived from Trips - daily revenue/profit/trip volume for the
 * last 14 days, plus who's driving the business: top clients by revenue
 * and top load bringers by loads brought.
 */
function getTrendsData() {
  var trips = getTrips({});
  var settings = getSettings();
  var tz = Session.getScriptTimeZone();

  var days = [];
  var dayIndex = {};
  for (var i = 13; i >= 0; i--) {
    var d = new Date();
    d.setDate(d.getDate() - i);
    var key = Utilities.formatDate(d, tz, 'yyyy-MM-dd');
    var entry = { date: key, label: Utilities.formatDate(d, tz, 'MMM d'), revenue: 0, profit: 0, tripCount: 0 };
    days.push(entry);
    dayIndex[key] = entry;
  }

  var clientTotals = {};
  var bringerTotals = {};

  trips.forEach(function (t) {
    var netProfit = round2_(t.marginAmount + t.brickCost - t.discountAmount - t.otherExpenseAmount);

    if (t.tripDate) {
      var entry = dayIndex[Utilities.formatDate(new Date(t.tripDate), tz, 'yyyy-MM-dd')];
      if (entry) {
        entry.revenue = round2_(entry.revenue + t.totalCost);
        entry.profit = round2_(entry.profit + netProfit);
        entry.tripCount += 1;
      }
    }

    clientTotals[t.clientName] = round2_((clientTotals[t.clientName] || 0) + t.totalCost);
    if (t.loadBringerName) {
      bringerTotals[t.loadBringerName] = (bringerTotals[t.loadBringerName] || 0) + 1;
    }
  });

  var topClients = Object.keys(clientTotals)
    .map(function (name) { return { name: name, revenue: clientTotals[name] }; })
    .sort(function (a, b) { return b.revenue - a.revenue; })
    .slice(0, 6);

  var topLoadBringers = Object.keys(bringerTotals)
    .map(function (name) { return { name: name, tripCount: bringerTotals[name] }; })
    .sort(function (a, b) { return b.tripCount - a.tripCount; })
    .slice(0, 6);

  return {
    currencySymbol: settings.currencySymbol,
    dailyTrend: days,
    topClients: topClients,
    topLoadBringers: topLoadBringers
  };
}
