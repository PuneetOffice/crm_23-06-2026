using Elpis_CRM.Services;
using Microsoft.AspNetCore.Authentication.JwtBearer;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;

namespace Elpis_CRM.Controllers;

[ApiController]
[Route("api/import")]
[Authorize(AuthenticationSchemes = JwtBearerDefaults.AuthenticationScheme, Roles = "Admin")]
[RequestSizeLimit(52_428_800)]               // 50 MB hard cap — sync with ImportOptions if changed
[RequestFormLimits(MultipartBodyLengthLimit = 52_428_800)]
public sealed class ImportController(
    ImportService importService,
    DealsService dealsService,
    ILogger<ImportController> logger) : ControllerBase
{

    [HttpPost("accounts"), Consumes("multipart/form-data")]
    public Task<IActionResult> Accounts(IFormFile file, CancellationToken ct)
        => RunImport(file, "Accounts", ct);

    [HttpPost("contacts"), Consumes("multipart/form-data")]
    public Task<IActionResult> Contacts(IFormFile file, CancellationToken ct)
        => RunImport(file, "Contacts", ct);

    [HttpPost("deals"), Consumes("multipart/form-data")]
    public Task<IActionResult> Deals(IFormFile file, CancellationToken ct)
        => RunImport(file, "Deals", ct);

    /// <summary>
    /// Links existing deals to contacts from a two-column file (DealId + ContactId).
    /// Contact names are resolved from the Contacts table.
    /// </summary>
    [HttpPost("deals/link-contacts"), Consumes("multipart/form-data")]
    public async Task<IActionResult> LinkDealContacts(IFormFile file, CancellationToken ct)
    {
        if (file is null || file.Length == 0)
            return BadRequest(new { error = "No file provided or file is empty." });

        logger.LogInformation(
            "Deal contact link import | {File} | {Size:N0} bytes | User: {User}",
            file.FileName, file.Length, User.Identity?.Name ?? "unknown");

        var result = await dealsService.ImportContactLinksAsync(file, ct);

        if (result.Success)
        {
            return Ok(new
            {
                success = true,
                table = "DealContactLinks",
                rowsImported = result.RowsUpdated,
                rowsSkipped = result.RowsSkipped,
                elapsedMs = (long)result.Elapsed.TotalMilliseconds,
                rowErrors = result.RowErrors,
            });
        }

        return BadRequest(new
        {
            success = false,
            table = "DealContactLinks",
            error = result.Error,
            rowsImported = result.RowsUpdated,
            rowsSkipped = result.RowsSkipped,
            rowErrors = result.RowErrors,
        });
    }

    [HttpPost("calllogs"), Consumes("multipart/form-data")]
    public Task<IActionResult> CallLogs(IFormFile file, CancellationToken ct)
        => RunImport(file, "CallLogs", ct);

[HttpPost("notes"), Consumes("multipart/form-data")]
    public Task<IActionResult> Notes(IFormFile file, CancellationToken ct)
        => RunImport(file, "Notes", ct);

    [HttpPost("tasks"), Consumes("multipart/form-data")]
    public Task<IActionResult> Tasks(IFormFile file, CancellationToken ct)
        => RunImport(file, "Tasks", ct);

    // Add more tables by:
    //   1. Adding an ImportTableSchema entry to SchemaRegistry.All in ImportService.cs
    //   2. Adding an endpoint here that calls RunImport(file, "TableName", ct)
    //
    // Example:
    // [HttpPost("products"), Consumes("multipart/form-data")]
    // public Task<IActionResult> Products(IFormFile file, CancellationToken ct)
    //     => RunImport(file, "Products", ct);

    // ── Status (public — useful for health probes / front-end upload hints) ───

    [HttpGet("status"), AllowAnonymous]
    public IActionResult Status() => Ok(new
    {
        status = "running",
        allowedTables = new[] { "Accounts", "Contacts", "Deals", "DealContactLinks", "CallLogs", "Notes", "Tasks" },
        maxFileSizeMb = 50,
        supportedFormats = new[] { ".xlsx", ".xlsb", ".xls", ".csv" },
        defaultBatchSize = 5_000,
    });


    private async Task<IActionResult> RunImport(
        IFormFile file, string table, CancellationToken ct)
    {
        if (file is null || file.Length == 0)
            return BadRequest(new { error = "No file provided or file is empty." });

        logger.LogInformation(
            "Import request → [{Table}] | {File} | {Size:N0} bytes | User: {User}",
            table, file.FileName, file.Length, User.Identity?.Name ?? "unknown");

        // Customise per-request if needed (e.g. read batch size from a header / query param).
        var options = new ImportOptions
        {
            BatchSize = 5_000,
            SkipBadRows = false,
            MaxRetryAttempts = 3,
            IndexDisableThresholdBytes = 5 * 1_024 * 1_024, // 5 MB
        };

        var result = await importService.ImportAsync(file, table, options, ct);

        if (result.Success)
        {
            logger.LogInformation(
                "Import succeeded → [{Table}] | {Rows:N0} rows in {Elapsed:0.00}s",
                table, result.RowsImported, result.Elapsed.TotalSeconds);

            return Ok(new
            {
                success = true,
                table,
                rowsImported = result.RowsImported,
                rowsSkipped = result.RowsSkipped,
                elapsedMs = (long)result.Elapsed.TotalMilliseconds,
                rowErrors = result.RowErrors,
            });
        }

        logger.LogWarning(
            "Import failed → [{Table}] | {Error}", table, result.Error);

        return BadRequest(new
        {
            success = false,
            table,
            error = result.Error,
            rowErrors = result.RowErrors,
        });
    }
}