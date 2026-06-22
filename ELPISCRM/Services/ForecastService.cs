using Elpis_CRM.Data;
using Microsoft.EntityFrameworkCore;
using System;
using System.Collections.Generic;
using System.Globalization;
using System.Linq;
using System.Threading.Tasks;

namespace Elpis_CRM.Services
{
    /// <summary>
    /// Service to generate sales forecasts and deal summaries for monthly, quarterly, and yearly periods.
    /// </summary>
    public class ForecastService
    {
        private readonly AppDbContext _context;

        /// <summary>
        /// Initializes a new instance of <see cref="ForecastService"/>.
        /// </summary>
        /// <param name="context">The database context.</param>
        public ForecastService(AppDbContext context)
        {
            _context = context;
        }

        #region Totals

        /// <summary>
        /// Gets the total deals for a given month and year.
        /// </summary>
        /// <param name="monthName">The month name (e.g., "January").</param>
        /// <param name="year">The year (e.g., 2026).</param>
        /// <returns>An object containing the period label and total deals.</returns>
        public async Task<object> MonthlyAsync(string monthName, int year)
        {
            int month = ParseMonthName(monthName);
            DateTime start = new DateTime(year, month, 1, 0, 0, 0, DateTimeKind.Utc);
            DateTime end = start.AddMonths(1).AddDays(-1);

            return await BuildResultAsync(start, end, $"{CultureInfo.CurrentCulture.DateTimeFormat.GetMonthName(month)} {year}");
        }

        /// <summary>
        /// Gets the total deals for a given quarter and year.
        /// </summary>
        /// <param name="quarter">The quarter ("Q1", "Q2", "Q3", "Q4").</param>
        /// <param name="year">The year.</param>
        /// <returns>An object containing the period label and total deals.</returns>
        public async Task<object> QuarterlyAsync(string quarter, int year)
        {
            int startMonth = quarter.ToUpper() switch
            {
                "Q1" => 1,
                "Q2" => 4,
                "Q3" => 7,
                "Q4" => 10,
                _ => throw new ArgumentException("Invalid quarter")
            };

            DateTime start = new DateTime(year, startMonth, 1, 0, 0, 0, DateTimeKind.Utc);
            DateTime end = start.AddMonths(3).AddDays(-1);

            string label = $"{start:MMM}–{end:MMM} {year}";
            return await BuildResultAsync(start, end, label);
        }

        /// <summary>
        /// Gets the total deals for a given year.
        /// </summary>
        /// <param name="year">The year.</param>
        /// <returns>An object containing the period label and total deals.</returns>
        public async Task<object> YearlyAsync(int year)
        {
            DateTime start = new DateTime(year, 1, 1, 0, 0, 0, DateTimeKind.Utc);
            DateTime end = new DateTime(year, 12, 31, 23, 59, 59, DateTimeKind.Utc);

            return await BuildResultAsync(start, end, year.ToString());
        }

        /// <summary>
        /// Builds a result object containing total deals in the specified period.
        /// </summary>
        private async Task<object> BuildResultAsync(DateTime start, DateTime end, string label)
        {
            int totalDeals = await _context.Deals
                .CountAsync(d => d.CreatedAt >= start && d.CreatedAt <= end);

            return new
            {
                period = label,
                totalDeals
            };
        }

        #endregion

        #region Six Month Trend

        /// <summary>
        /// Gets 6-month trend data: Actual Revenue vs Expected Pipeline Conversion.
        /// Actual: Closed paid deals. Expected: Weighted open pipeline.
        /// </summary>
        public async Task<List<object>> SixMonthTrendAsync()
        {
            var endDate = DateTime.UtcNow.Date;
            var startDate = endDate.AddMonths(-6).Date;

            // Load all relevant deals first to avoid EF complex query issues
            var deals = await _context.Deals
                .Where(d => (d.ClosedDate.HasValue && d.ClosedDate.Value.Date >= startDate) ||
                           (d.ExpectedCloseDate.HasValue && d.ExpectedCloseDate.Value.Date >= startDate))
                .ToListAsync();

            var trendData = deals
                .GroupBy(d => new {
                    Year = d.ClosedDate?.Year ?? d.ExpectedCloseDate!.Value.Year,
                    Month = d.ClosedDate?.Month ?? d.ExpectedCloseDate!.Value.Month
                })
                .Select(g => {
                    var actualRevenue = g.Where(d => d.ClosedDate.HasValue &&
                                                    (d.PaymentStatus == "Paid" || d.PaymentStatus == "Won") &&
                                                    d.DealValue.HasValue)
                                        .Sum(d => (double)(d.DealValue!.Value));

                    var expectedPipeline = g.Where(d => !d.ClosedDate.HasValue &&
                                                       d.ExpectedCloseDate.HasValue &&
                                                       d.Probability.HasValue &&
                                                       d.DealValue.HasValue)
                                          .Sum(d => (double)(d.DealValue!.Value * (d.Probability!.Value / 100)));

                    string monthName = g.Key.Month switch
                    {
                        1 => "Jan",
                        2 => "Feb",
                        3 => "Mar",
                        4 => "Apr",
                        5 => "May",
                        6 => "Jun",
                        7 => "Jul",
                        8 => "Aug",
                        9 => "Sep",
                        10 => "Oct",
                        11 => "Nov",
                        12 => "Dec",
                        _ => "???"
                    };

                    return new
                    {
                        month = $"{monthName} {g.Key.Year}",
                        actualRevenue = actualRevenue,
                        expectedPipeline = expectedPipeline
                    };
                })
                .OrderBy(x => x.month)
                .ToList<object>();

            return trendData;
        }

        #endregion

        #region Deal Names

        /// <summary>
        /// Gets distinct deal names for a specific month.
        /// </summary>
        public async Task<List<string?>> MonthlyDealNamesAsync(string monthName, int year)
        {
            int month = ParseMonthName(monthName);
            DateTime start = new DateTime(year, month, 1);
            DateTime end = start.AddMonths(1).AddDays(-1);

            return await GetDealNamesForPeriodAsync(start, end);
        }

        /// <summary>
        /// Gets distinct deal names for a specific quarter.
        /// </summary>
        public async Task<List<string?>> QuarterlyDealNamesAsync(string quarter, int year)
        {
            int startMonth = quarter.ToUpper() switch
            {
                "Q1" => 1,
                "Q2" => 4,
                "Q3" => 7,
                "Q4" => 10,
                _ => throw new ArgumentException("Invalid quarter")
            };

            DateTime start = new DateTime(year, startMonth, 1);
            DateTime end = start.AddMonths(3).AddDays(-1);

            return await GetDealNamesForPeriodAsync(start, end);
        }

        /// <summary>
        /// Gets distinct deal names for a specific year.
        /// </summary>
        public async Task<List<string?>> YearlyDealNamesAsync(int year)
        {
            DateTime start = new DateTime(year, 1, 1);
            DateTime end = new DateTime(year, 12, 31);

            return await GetDealNamesForPeriodAsync(start, end);
        }

        /// <summary>
        /// Common method to get distinct deal names for a date range.
        /// </summary>
        private async Task<List<string?>> GetDealNamesForPeriodAsync(DateTime start, DateTime end)
        {
            return await _context.Deals
                .Where(d => d.CreatedAt >= start && d.CreatedAt <= end)
                .Select(d => d.Name)
                .Distinct()
                .ToListAsync();
        }

        #endregion

        #region Helpers

        /// <summary>
        /// Parses the full month name into an integer (1–12).
        /// </summary>
        /// <param name="monthName">Full month name (e.g., "January")</param>
        private int ParseMonthName(string monthName)
        {
            if (string.IsNullOrWhiteSpace(monthName))
                throw new ArgumentException("Month name cannot be empty.");

            monthName = monthName.Trim().Replace("\"", "");
            return DateTime.ParseExact(monthName, "MMMM", CultureInfo.InvariantCulture).Month;
        }

        #endregion
    }
}
