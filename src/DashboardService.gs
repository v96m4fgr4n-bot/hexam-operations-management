/**
 * At-a-glance KPIs derived from Trips and Clients/LoadBringers - nothing
 * here is tracked separately, it's all rolled up live so the dashboard is
 * always current the moment a trip is saved.
 */
function getDashboardSummary() {
  var trips = getTrips({});
  var settings = getSettings();
  var tz = Session.getScriptTimeZone();
  var now = new Date();
  var todayKey = Utilities.formatDate(now, tz, 'yyyy-MM-dd');
  var monthKey = Utilities.formatDate(now, tz, 'yyyy-MM');

  var summary = {
    currencySymbol: settings.currencySymbol,
    todayRevenue: 0, todayProfit: 0, todayTripCount: 0,
    monthRevenue: 0, monthProfit: 0, monthTripCount: 0,
    allTimeRevenue: 0, allTimeProfit: 0, allTimeTripCount: trips.length
  };

  trips.forEach(function (t) {
    var netProfit = round2_(t.marginAmount + t.brickCost - t.discountAmount);
    summary.allTimeRevenue = round2_(summary.allTimeRevenue + t.totalCost);
    summary.allTimeProfit = round2_(summary.allTimeProfit + netProfit);

    if (!t.tripDate) return;
    var tripDate = new Date(t.tripDate);
    var dayKey = Utilities.formatDate(tripDate, tz, 'yyyy-MM-dd');
    var mKey = Utilities.formatDate(tripDate, tz, 'yyyy-MM');

    if (dayKey === todayKey) {
      summary.todayRevenue = round2_(summary.todayRevenue + t.totalCost);
      summary.todayProfit = round2_(summary.todayProfit + netProfit);
      summary.todayTripCount += 1;
    }
    if (mKey === monthKey) {
      summary.monthRevenue = round2_(summary.monthRevenue + t.totalCost);
      summary.monthProfit = round2_(summary.monthProfit + netProfit);
      summary.monthTripCount += 1;
    }
  });

  summary.averageQuoteValue = trips.length ? round2_(summary.allTimeRevenue / trips.length) : 0;
  summary.activeClientCount = getClients(false).length;
  summary.activeLoadBringerCount = getLoadBringers(false).length;
  summary.recentTrips = trips.slice(0, 5);

  return summary;
}
