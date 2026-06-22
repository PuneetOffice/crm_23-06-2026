using Elpis_CRM.Model;
using Elpis_CRM.Services;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using System;
using System.Collections.Generic;
using System.Threading.Tasks;
using System.Security.Claims;
using Elpis_CRM.Data;
using Microsoft.EntityFrameworkCore;

namespace Elpis_CRM.Controllers
{
    /// <summary>
    /// Provides API endpoints to manage deals and deal analytics.
    /// </summary>
    [Route("api/[controller]")]
    [ApiController]
    public class DealController : ControllerBase
    {
        private const string JwtScheme = "Bearer";
        private readonly DealsService _dealService;
        private readonly AppDbContext _dealsDb;

        /// <summary>
        /// Initializes a new instance of the <see cref="DealController"/>.
        /// </summary>
        /// <param name="dealService">Service for deal operations.</param>
        /// <param name="dealsDb">Application database context.</param>
        public DealController(DealsService dealService, AppDbContext dealsDb)
        {
            _dealService = dealService;
            _dealsDb = dealsDb;
        }

        /// <summary>
        /// Retrieves a deal by its unique ID.
        /// </summary>
        /// <param name="dealId">The deal ID.</param>
        /// <returns>The requested deal.</returns>
        /// <response code="200">Deal found</response>
        /// <response code="404">Deal not found</response>
        [HttpGet("{dealId:long}")]
        [Authorize(AuthenticationSchemes = JwtScheme, Roles = "Admin,Manager,User")]
        public async Task<ActionResult<DealModel>> GetById(long dealId)
        {
            try
            {
                var deal = await _dealService.GetByIdAsync(dealId);
                return Ok(deal);
            }
            catch (KeyNotFoundException)
            {
                return NotFound($"Deal with ID '{dealId}' not found.");
            }
        }

        /// <summary>
        /// Retrieves all deals with optional server-side search.
        /// No pagination — Kanban board needs all cards across all stages.
        /// </summary>
        /// <param name="search">Optional search term (min 2 chars) — filters Name, AccountName, ContactName, Stage, Owner, Territory, Tags, Pipeline.</param>
        /// <returns>Flat list of matching deals</returns>
        /// <response code="200">Deals retrieved successfully</response>
        [HttpGet]
        [Authorize(AuthenticationSchemes = JwtScheme, Roles = "Admin,Manager,User")]
        public async Task<ActionResult<List<DealModel>>> GetAll([FromQuery] string? search = null)
        {
            var deals = await _dealService.GetAllAsync(search);
            return Ok(deals);
        }

        /// <summary>
        /// Typeahead search for deals (query min length 2).
        /// </summary>
        [HttpGet("search")]
        [Authorize(AuthenticationSchemes = JwtScheme, Roles = "Admin,Manager,User")]
        public async Task<ActionResult<List<DealModel>>> Search([FromQuery] string q, [FromQuery] int limit = 50)
        {
            var results = await _dealService.SearchAsync(q, limit);
            return Ok(results);
        }

        /// <summary>
        /// Retrieves all distinct tags associated with deals.
        /// </summary>
        /// <returns>A list of deal tags.</returns>
        /// <response code="200">Tags retrieved successfully</response>
        [HttpGet("tags/all")]
        [Authorize(AuthenticationSchemes = JwtScheme, Roles = "Admin,Manager,User")]
        public async Task<ActionResult<List<string>>> GetAllTagsAsync()
        {
            var tags = await _dealService.GetAllTagsAsync();
            return Ok(tags);
        }

        /// <summary>
        /// Retrieves deal names associated with the specified tags.
        /// </summary>
        /// <param name="tags">Comma-separated list of tags.</param>
        /// <returns>Deal names matching the provided tags.</returns>
        /// <response code="200">Deal names retrieved successfully</response>
        /// <response code="400">Tags parameter is missing or invalid</response>
        [HttpGet("tags/dealName")]
        [Authorize(AuthenticationSchemes = JwtScheme, Roles = "Admin,Manager,User")]
        public async Task<ActionResult<string>> GetDealByTag([FromQuery] string tags)
        {
            if (string.IsNullOrWhiteSpace(tags))
            {
                return BadRequest("Tags parameter is required.");
            }

            var dealName = await _dealService.GetDealsByTagsAsync(tags);
            return Ok(dealName);
        }

        /// <summary>
        /// Retrieves the number of deals created in the current week.
        /// </summary>
        /// <returns>Count of this week's deals.</returns>
        /// <response code="200">Deal count retrieved successfully</response>
        [HttpGet("ThisWeek/count")]
        [Authorize(AuthenticationSchemes = JwtScheme, Roles = "Admin,Manager,User")]
        public async Task<ActionResult<int>> GetThisWeekDealCount()
        {
            int count = await _dealService.GetThisWeekDealCountAsync();
            return Ok(count);
        }

        /// <summary>
        /// Retrieves deal analytics for all weeks.
        /// </summary>
        /// <returns>A list of deal counts grouped by week.</returns>
        /// <response code="200">Weekly deal analytics retrieved successfully</response>
        [HttpGet("AllWeeks/Analysis")]
        [Authorize(AuthenticationSchemes = JwtScheme, Roles = "Admin,Manager,User")]
        public async Task<ActionResult<List<int>>> GetAllWeeksDeals()
        {
            var result = await _dealService.GetDealsForAllWeeksAsync();
            return Ok(result);
        }

        /// <summary>
        /// Creates a new deal.
        /// </summary>
        /// <param name="deal">Deal data.</param>
        /// <returns>The newly created deal.</returns>
        /// <response code="201">Deal created successfully</response>
        /// <response code="400">Invalid deal data</response>
        [HttpPost]
        [Authorize(AuthenticationSchemes = JwtScheme, Roles = "Admin,Manager,User")]
        public async Task<ActionResult<DealModel>> Create([FromBody] DealModel deal)
        {
            try
            {
                var createdByClaimValue = User.FindFirst(ClaimTypes.Name)?.Value;
                var createdByIdClaimValue = User.FindFirst(ClaimTypes.NameIdentifier)?.Value;

                if (!string.IsNullOrWhiteSpace(createdByClaimValue))
                {
                    deal.CreatedBy = createdByClaimValue;
                }

                if (long.TryParse(createdByIdClaimValue, out var createdById))
                {
                    deal.CreatedById = createdById;
                }

                Console.WriteLine($"[DealsController.Create] Incoming payload: Name='{deal.Name}', Value={deal.DealValue}, AccountId={deal.AccountId}");

                if (!ModelState.IsValid)
                {
                    var errors = ModelState.Values.SelectMany(v => v.Errors).Select(e => e.ErrorMessage);
                    Console.WriteLine($"[DealsController.Create] ModelState invalid: {string.Join(", ", errors)}");
                    return BadRequest(ModelState);
                }

                var created = await _dealService.AddAsync(deal);
                Console.WriteLine($"[DealsController.Create] SUCCESS: Created deal ID={created.Id}");

                return CreatedAtAction(
                    nameof(GetById),
                    new { dealId = created.Id },
                    created
                );
            }
            catch (ArgumentException ex)
            {
                Console.WriteLine($"[DealsController.Create] VALIDATION ERROR: {ex.Message}");
                return BadRequest(new { error = ex.Message });
            }
            catch (Exception ex)
            {
                Console.WriteLine($"[DealsController.Create] ERROR: {ex.Message}");
                if (ex.InnerException != null){
                    Console.WriteLine($"[DealsController.Create] Inner: {ex.InnerException.Message}");
                }
                return StatusCode(500, new
                {
                    error = "Internal server error",
                    details = ex.Message,
                    inner = ex.InnerException?.Message
                });
            }
        }

        /// <summary>
        /// Updates an existing deal.
        /// </summary>
        /// <param name="dealId">The deal ID.</param>
        /// <param name="deal">Updated deal data.</param>
        /// <returns>The updated deal.</returns>
        /// <response code="200">Deal updated successfully</response>
        /// <response code="404">Deal not found</response>
        [HttpPut("{dealId:long}")]
        [Authorize(AuthenticationSchemes = JwtScheme, Roles = "Admin,Manager,User")]
        public async Task<ActionResult<DealModel>> Update(long dealId, [FromBody] DealModel deal)
        {
            try
            {
                var updatedByClaim = User.FindFirst(ClaimTypes.Name)?.Value;
                if (!string.IsNullOrWhiteSpace(updatedByClaim))
                {
                    deal.UpdatedBy = updatedByClaim;
                }

                if (long.TryParse(User.FindFirst(ClaimTypes.NameIdentifier)?.Value, out var updatedById))
                {
                    deal.UpdatedById = updatedById;
                }

                var updated = await _dealService.UpdateAsync(dealId, deal);
                return Ok(updated);
            }
            catch (KeyNotFoundException)
            {
                return NotFound($"Deal with ID '{dealId}' not found.");
            }
        }

        /// <summary>
        /// Deletes a deal by its ID.
        /// </summary>
        /// <param name="dealId">The deal ID.</param>
        /// <returns>Deletion confirmation message.</returns>
        /// <response code="200">Deal deleted successfully</response>
        /// <response code="404">Deal not found</response>
        [HttpDelete("{dealId:long}")]
        [Authorize(AuthenticationSchemes = JwtScheme, Roles = "Admin")]
        public async Task<ActionResult> Delete(long dealId)
        {
            try
            {
                await _dealService.DeleteAsync(dealId);
                return Ok("Deleted Successfully");
            }
            catch (KeyNotFoundException)
            {
                return NotFound($"Deal with ID '{dealId}' not found.");
            }
        }

        /// <summary>
        /// Retrieves deals created by the currently authenticated user.
        /// </summary>
        /// <returns>A list of deals created by the current user.</returns>
        /// <response code="200">User deals retrieved successfully</response>
        /// <response code="400">User identity not found in token</response>
        [Authorize(AuthenticationSchemes = JwtScheme)]
        [HttpGet("my-deals")]
        public async Task<IActionResult> GetMyDeals()
        {
            var createdByClaimValue = User.FindFirst(ClaimTypes.Name)?.Value;
            if (string.IsNullOrEmpty(createdByClaimValue))
            {
                return BadRequest("User name not found in token");
            }

            var deals = await _dealsDb.Deals
                .Where(d => d.CreatedBy == createdByClaimValue)
                .OrderByDescending(d => d.UpdatedAt ?? d.CreatedAt)
                .ThenByDescending(d => d.CreatedAt)
                .ToListAsync();

            return Ok(deals);
        }
        /// <summary>
        /// Retrieves deals filtered by deal pipeline.
        /// </summary>
        /// <param name="pipeline">Pipeline name (example: software, hardware, default).</param>
        /// <returns>A list of deals in the specified pipeline.</returns>
        /// <response code="200">Deals retrieved successfully</response>
        [HttpGet("pipeline/deals")]
        [Authorize(AuthenticationSchemes = JwtScheme, Roles = "Admin,Manager,User")]
        public async Task<ActionResult<List<DealModel>>> GetDealsByPipeline([FromQuery] string pipeline)
        {
            try
            {
                Console.WriteLine($"[DealsController.GetDealsByPipeline] Called with pipeline: '{pipeline}'");
                var deals = await _dealService.GetByPipelineAsync(pipeline);
                Console.WriteLine($"[DealsController.GetDealsByPipeline] Returned {deals.Count} deals");
                return Ok(deals);
            }
            catch (Exception ex)
            {
                Console.WriteLine($"[DealsController.GetDealsByPipeline] Error: {ex.Message}");
                return StatusCode(500, new { error = ex.Message });
            }
        }

        [HttpGet("contact/{contactId}")]
        public async Task<IActionResult> GetByContact(long contactId)
        {
            var deals = await _dealService.GetByContactIdAsync(contactId);
            return Ok(deals);
        }
    }
}
