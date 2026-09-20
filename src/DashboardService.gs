/**
 * At-a-glance KPIs derived from Trips, Expenses, and Clients/LoadBringers -
 * nothing here is tracked separately, it's all rolled up live so the
 * dashboard is always current the moment a trip or expense is saved.
 *
 * "Profit" is true net profit, not just trip margin: each trip contributes
 * marginAmount + brickCost - discountAmount - otherExpenseAmount (its own
 * real costs already netted out - see TripService.gs), and manually-
 * recorded business expenses (repairs, insurance, salaries, etc. - see
 * ExpenseService.gs) are then subtracted on top, matched to a period by
 * the expense's own date, the same way AccountingService.gs's netProfit
 * does it.
 */
function getDashboardSummary() {
  var trips = getTrips({});
  var expenses = getExpenses({});
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
    var tripProfit = round2_(t.marginAmount + t.brickCost - t.discountAmount - t.otherExpenseAmount);
    summary.allTimeRevenue = round2_(summary.allTimeRevenue + t.totalCost);
    summary.allTimeProfit = round2_(summary.allTimeProfit + tripProfit);

    if (!t.tripDate) return;
    var tripDate = new Date(t.tripDate);
    var dayKey = Utilities.formatDate(tripDate, tz, 'yyyy-MM-dd');
    var mKey = Utilities.formatDate(tripDate, tz, 'yyyy-MM');

    if (dayKey === todayKey) {
      summary.todayRevenue = round2_(summary.todayRevenue + t.totalCost);
      summary.todayProfit = round2_(summary.todayProfit + tripProfit);
      summary.todayTripCount += 1;
    }
    if (mKey === monthKey) {
      summary.monthRevenue = round2_(summary.monthRevenue + t.totalCost);
      summary.monthProfit = round2_(summary.monthProfit + tripProfit);
      summary.monthTripCount += 1;
    }
  });

  expenses.forEach(function (e) {
    summary.allTimeProfit = round2_(summary.allTimeProfit - e.amount);
    if (!e.date) return;
    var expenseDate = new Date(e.date);
    var dayKey = Utilities.formatDate(expenseDate, tz, 'yyyy-MM-dd');
    var mKey = Utilities.formatDate(expenseDate, tz, 'yyyy-MM');

    if (dayKey === todayKey) summary.todayProfit = round2_(summary.todayProfit - e.amount);
    if (mKey === monthKey) summary.monthProfit = round2_(summary.monthProfit - e.amount);
  });

  summary.averageQuoteValue = trips.length ? round2_(summary.allTimeRevenue / trips.length) : 0;
  summary.activeClientCount = getClients(false).length;
  summary.activeLoadBringerCount = getLoadBringers(false).length;
  summary.activeDriverCount = getDrivers(false).length;
  summary.recentTrips = trips.slice(0, 5);

  return summary;
}
