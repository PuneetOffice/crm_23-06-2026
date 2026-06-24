using Elpis_CRM.Services;
using Microsoft.AspNetCore.Mvc;
using System.Threading.Tasks;

namespace Elpis_CRM.Controllers
{
    /// <summary>
    /// Provides forecasting data and deal analysis based on month, quarter, and year.
    /// </summary>
    [ApiController]
    [Route("api/forecast")]
    public class ForecastController : ControllerBase
    {
        private readonly ForecastService _forecastService;

        /// <summary>
        /// Initializes a new instance of the <see cref="ForecastController"/>.
        /// </summary>
        /// <param name="service">Forecast service instance.</param>
        public ForecastController(ForecastService service)
        {
            _forecastService = service;
        }

        /// <summary>
        /// Retrieves forecast data for a specific month and year.
        /// </summary>
        /// <param name="month">Month name (e.g., January).</param>
        /// <param name="year">Year.</param>
        /// <returns>Monthly forecast data.</returns>
        /// <response code="200">Monthly forecast retrieved successfully</response>
            //  AFTER
        [HttpGet("month/{month}/{year}")]
        public async Task<IActionResult> Monthly(string month, int year)
            => Ok(await _forecastService.MonthlyAsync(month, year));


        /// <summary>
        /// Retrieves forecast data for a specific quarter and year.
        /// </summary>
        /// <param name="quarter">Quarter (e.g., Q1, Q2).</param>
        /// <param name="year">Year.</param>
        /// <returns>Quarterly forecast data.</returns>
        /// <response code="200">Quarterly forecast retrieved successfully</response>

        //  AFTER
        [HttpGet("quarter/{quarter}/{year}")]
        public async Task<IActionResult> Quarterly(string quarter, int year)
            => Ok(await _forecastService.QuarterlyAsync(quarter, year));

        /// <summary>
        /// Retrieves forecast data for a specific year.
        /// </summary>
        /// <param name="year">Year.</param>
        /// <returns>Yearly forecast data.</returns>
        /// <response code="200">Yearly forecast retrieved successfully</response>

        // AFTER
        [HttpGet("year/{year}")]
        public async Task<IActionResult> Yearly(int year)
            => Ok(await _forecastService.YearlyAsync(year));

        /// <summary>
        /// Retrieves deal names for a specific month and year.
        /// </summary>
        /// <param name="monthName">Month name (e.g., January).</param>
        /// <param name="year">Year.</param>
        /// <returns>List of deal names.</returns>
        /// <response code="200">Monthly deal names retrieved successfully</response>
        [HttpGet("monthly/deals")]
        public async Task<IActionResult> GetMonthlyDeals([FromQuery] string monthName, [FromQuery] int year)
        {
            var deals = await _forecastService.MonthlyDealNamesAsync(monthName, year);
            return Ok(deals);
        }

        /// <summary>
        /// Retrieves deal names for a specific quarter and year.
        /// </summary>
        /// <param name="quarter">Quarter (e.g., Q1, Q2).</param>
        /// <param name="year">Year.</param>
        /// <returns>List of deal names.</returns>
        /// <response code="200">Quarterly deal names retrieved successfully</response>
        [HttpGet("quarterly/deals")]
        public async Task<IActionResult> GetQuarterlyDeals([FromQuery] string quarter, [FromQuery] int year)
        {
            var deals = await _forecastService.QuarterlyDealNamesAsync(quarter, year);
            return Ok(deals);
        }

        /// <summary>
        /// Retrieves deal names for a specific year.
        /// </summary>
        /// <param name="year">Year.</param>
        /// <returns>List of deal names.</returns>
        /// <response code="200">Yearly deal names retrieved successfully</response>
        [HttpGet("yearly/deals")]
        public async Task<IActionResult> GetYearlyDeals([FromQuery] int year)
        {
            var deals = await _forecastService.YearlyDealNamesAsync(year);
            return Ok(deals);
        }

        /// <summary>
        /// Retrieves 6-month trend chart data: Actual Revenue vs Expected Pipeline.
        /// </summary>
        /// <returns>Monthly trend data for last 6 months.</returns>
        /// <response code="200">Trend data retrieved successfully</response>
        [HttpGet("sixmonthtrend")]
        public async Task<IActionResult> SixMonthTrend()
        {
            var trendData = await _forecastService.SixMonthTrendAsync();
            return Ok(trendData);
        }
    }
}
