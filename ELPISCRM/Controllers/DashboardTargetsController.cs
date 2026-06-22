using Elpis_CRM.Dtos;
using Microsoft.AspNetCore.Mvc;
using System.Text.Json;

namespace Elpis_CRM.Controllers
{
    [Route("api/[controller]")]
    [ApiController]
    public class DashboardTargetsController : ControllerBase
    {
        private static readonly SemaphoreSlim _fileLock = new SemaphoreSlim(1, 1);
        private readonly string _filePath;

        public DashboardTargetsController(IWebHostEnvironment env)
        {
            // ContentRootPath is always correct on any server
            _filePath = Path.Combine(
                env.ContentRootPath,
                "Data",
                "dashboard-targets.json"
            );
        }

        [HttpGet("dashboard-targets")]
        public async Task<IActionResult> GetTargets()
        {
            await _fileLock.WaitAsync();

            try
            {
                if (!System.IO.File.Exists(_filePath))
                    return NotFound("Targets file not found.");

                var json = await System.IO.File.ReadAllTextAsync(_filePath);

                return Content(json, "application/json");
            }
            finally
            {
                _fileLock.Release();
            }
        }

        [HttpPut("dashboard-targets/{quarter}")]
        public async Task<IActionResult> UpdateQuarter(
            string quarter,
            [FromBody] QuarterTargetDto request)
        {
            await _fileLock.WaitAsync();

            try
            {
                if (!System.IO.File.Exists(_filePath))
                    return NotFound("Targets file not found.");

                var json = await System.IO.File.ReadAllTextAsync(_filePath);

                var options = new JsonSerializerOptions
                {
                    PropertyNameCaseInsensitive = true,
                    WriteIndented = true
                };

                var targets = JsonSerializer.Deserialize<DashboardTargetsDto>(
                    json,
                    options
                ) ?? new DashboardTargetsDto();

                switch (quarter.ToLower())
                {
                    case "q1":
                        targets.Q1 = request.Target;
                        break;

                    case "q2":
                        targets.Q2 = request.Target;
                        break;

                    case "q3":
                        targets.Q3 = request.Target;
                        break;

                    case "q4":
                        targets.Q4 = request.Target;
                        break;

                    default:
                        return BadRequest("Invalid quarter. Use q1–q4.");
                }

                var updatedJson = JsonSerializer.Serialize(targets, options);

                await System.IO.File.WriteAllTextAsync(_filePath, updatedJson);

                return Ok(targets);
            }
            finally
            {
                _fileLock.Release();
            }
        }
    }
}