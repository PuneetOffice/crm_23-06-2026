using Elpis_CRM.DTOs;
using Elpis_CRM.Services;
using Microsoft.AspNetCore.Mvc;

namespace Elpis_CRM.Controllers
{
    [ApiController]
    [Route("api/export")]
    public class ExportController : ControllerBase
    {
        private readonly ExportService _exportService;
        private readonly ILogger<ExportController> _logger;

        private const string ExcelContentType =
            "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet";

        public ExportController(ExportService exportService, ILogger<ExportController> logger)
        {
            _exportService = exportService;
            _logger = logger;
        }

        // ─── POST /api/export/accounts ──────────────────────────────────────────

        /// <summary>
        /// Export accounts to Excel.
        /// Optionally filter by <c>Search</c> (name/city/country/phone/website)
        /// or <c>Tag</c>. Pass <c>Columns</c> to restrict which fields appear.
        /// </summary>
        [HttpPost("accounts")]
        [ProducesResponseType(typeof(FileContentResult), StatusCodes.Status200OK)]
        [ProducesResponseType(StatusCodes.Status500InternalServerError)]
        public async Task<IActionResult> ExportAccounts([FromBody] ExportRequest request)
        {
            try
            {
                byte[] fileBytes = await _exportService.ExportAccountsAsync(
                    request.Search,
                    request.Tag,
                    request.Columns);

                string fileName = $"accounts_{DateTime.UtcNow:yyyyMMdd_HHmmss}.xlsx";
                return File(fileBytes, ExcelContentType, fileName);
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "Error exporting accounts");
                return StatusCode(StatusCodes.Status500InternalServerError,
                    new { message = "An error occurred while exporting accounts." });
            }
        }

        // ─── POST /api/export/contacts ──────────────────────────────────────────

        /// <summary>
        /// Export contacts to Excel.
        /// Optionally filter by <c>Search</c> (name/email/phone/city/country).
        /// Pass <c>Columns</c> to restrict which fields appear.
        /// Note: Tag filtering is not applicable for contacts.
        /// </summary>
        [HttpPost("contacts")]
        [ProducesResponseType(typeof(FileContentResult), StatusCodes.Status200OK)]
        [ProducesResponseType(StatusCodes.Status500InternalServerError)]
        public async Task<IActionResult> ExportContacts([FromBody] ExportRequest request)
        {
            try
            {
                byte[] fileBytes = await _exportService.ExportContactsAsync(
                    request.Search,
                    request.Columns);

                string fileName = $"contacts_{DateTime.UtcNow:yyyyMMdd_HHmmss}.xlsx";
                return File(fileBytes, ExcelContentType, fileName);
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "Error exporting contacts");
                return StatusCode(StatusCodes.Status500InternalServerError,
                    new { message = "An error occurred while exporting contacts." });
            }
        }
    }
}
