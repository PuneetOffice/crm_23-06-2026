using Elpis_CRM.Model;
using Elpis_CRM.Services;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using System.Collections.Generic;
using System.Threading.Tasks;
using Microsoft.AspNetCore.Authentication.JwtBearer;

namespace Elpis_CRM.Controllers
{
    [ApiController]
    [Route("api/[controller]")]
    public class AccountController : ControllerBase
    {
        private readonly AccountService _accountService;

        public AccountController(AccountService accountService)
        {
            _accountService = accountService;
        }

        /// <summary>
        /// Retrieves accounts with pagination.
        /// </summary>
        /// <param name="page">Page number (1-based)</param>
        /// <param name="pageSize">Number of records per page</param>
        /// <returns>Paginated list of accounts</returns>
        [HttpGet]
        [Authorize(AuthenticationSchemes = JwtBearerDefaults.AuthenticationScheme,Roles = "Admin,Manager,User")]
        public async Task<IActionResult> GetAll([FromQuery] int page     = 1, [FromQuery] int pageSize = 150,[FromQuery] string? search = null)
        {
            page     = Math.Max(page, 1);
            pageSize = Math.Clamp(pageSize, 1, 500);

            var (items, totalCount) = await _accountService.GetAllAsync(page, pageSize, search);

            return Ok(new
            {
                Page      = page,
                PageSize  = pageSize,
                TotalCount = totalCount,
                TotalPages = (int)Math.Ceiling((double)totalCount / pageSize),
                Items     = items
            });
        }

        /// <summary>
        /// Search accounts for typeahead (query min length 2).
        /// </summary>
        [HttpGet("search")]
        [Authorize(AuthenticationSchemes = JwtBearerDefaults.AuthenticationScheme, Roles = "Admin,Manager,User")]
        public async Task<ActionResult<List<AccountModel>>> Search([FromQuery] string q, [FromQuery] int limit = 50)
        {
            var results = await _accountService.SearchAsync(q, limit);
            return Ok(results);
        }

        /// <summary>
        /// Retrieves accounts by CreatedAt date (UTC based).
        /// </summary>
        /// <param name="createdAt">Date to filter (yyyy-MM-dd recommended).</param>
        /// <returns>List of accounts created on that date.</returns>
        [HttpGet("createdAt")]
        [Authorize(AuthenticationSchemes = JwtBearerDefaults.AuthenticationScheme, Roles = "Admin,Manager,User")]
        public async Task<ActionResult<List<AccountModel>>> GetByCreatedAt([FromQuery] DateTime createdAt)
        {
            var accounts = await _accountService.GetAccountsByCreatedAtAsync(createdAt);
            return Ok(accounts);
        }

        [HttpGet("tags/all")]
        [Authorize(AuthenticationSchemes = JwtBearerDefaults.AuthenticationScheme, Roles = "Admin,Manager,User")]
        public async Task<ActionResult<List<string>>> GetAllTagsAsync()
        {
            var tags = await _accountService.GetAllTagsAsync();
            return Ok(tags);
        }

        [HttpGet("tags/accounts")]
        [Authorize(AuthenticationSchemes = JwtBearerDefaults.AuthenticationScheme, Roles = "Admin,Manager,User")]
        public async Task<ActionResult<List<AccountModel>>> GetAccountsByTagsAsync([FromQuery] string tags)
        {
            if (string.IsNullOrWhiteSpace(tags))
                return BadRequest("Tags parameter is required.");
            var accounts = await _accountService.GetAccountsByTagsAsync(tags);
            return Ok(accounts);
        }

        [HttpGet("{id:long}")]
        [Authorize(AuthenticationSchemes = JwtBearerDefaults.AuthenticationScheme, Roles = "Admin,Manager,User")]
        public async Task<ActionResult<AccountModel>> GetById(long id)
        {
            var account = await _accountService.GetByIdAsync(id);
            if (account == null) return NotFound();
            return Ok(account);
        }

        [HttpPost]
        [Authorize(AuthenticationSchemes = JwtBearerDefaults.AuthenticationScheme, Roles = "Admin,Manager,User")]
        public async Task<ActionResult<AccountModel>> Create([FromBody] AccountModel account)
        {
            if (account == null) return BadRequest("Account payload is required.");
            account.AccountId = 0;
            var created = await _accountService.AddAsync(account);
            return CreatedAtAction(nameof(GetById), new { id = created.AccountId }, created);
        }

        [HttpPut("{id:long}")]
        [Authorize(AuthenticationSchemes = JwtBearerDefaults.AuthenticationScheme, Roles = "Admin,Manager,User")]
        public async Task<ActionResult<AccountModel>> Update(long id, [FromBody] AccountModel account)
        {
            var updated = await _accountService.UpdateAsync(id, account);
            if (updated == null) return NotFound();
            return Ok(updated);
        }

        [HttpDelete("{id:long}")]
        [Authorize(AuthenticationSchemes = JwtBearerDefaults.AuthenticationScheme, Roles = "Admin")]
        public async Task<IActionResult> Delete(long id)
        {
            var deleted = await _accountService.DeleteAsync(id);
            if (!deleted) return NotFound();
            return NoContent();
        }

        [HttpDelete("delete-all")]
        [Authorize(AuthenticationSchemes = JwtBearerDefaults.AuthenticationScheme, Roles = "Admin")]
        public async Task<ActionResult> DeleteAllAsync()
        {
            try
            {
                await _accountService.DeleteAllAsync();
                return Ok(new { message = "All accounts deleted successfully" });
            }
            catch (Exception ex)
            {
                return StatusCode(500, new { message = "Error deleting accounts", error = ex.Message });
            }
        }

        // POST: api/account/bulk-delete  body: { "ids": [1, 2, 3] }
        [HttpPost("bulk-delete")]
        [Authorize(AuthenticationSchemes = JwtBearerDefaults.AuthenticationScheme, Roles = "Admin")]
        public async Task<ActionResult> BulkDeleteAsync([FromBody] DeleteBulkRequest request)
        {
            var idsToDelete = request?.ids;
            if (idsToDelete == null || idsToDelete.Count == 0)
                return BadRequest("At least one account ID is required.");
            try
            {
                int deletedCount = await _accountService.DeleteMultipleAsync(idsToDelete);
                return Ok(new { message = $"{deletedCount} accounts deleted successfully", deletedCount });
            }
            catch (Exception ex)
            {
                return StatusCode(500, new { message = "Error deleting accounts", error = ex.Message });
            }
        }

        // DELETE: api/account/bulk?ids=1&ids=2&ids=3
        [HttpDelete("bulk")]
        [Authorize(AuthenticationSchemes = JwtBearerDefaults.AuthenticationScheme, Roles = "Admin")]
        public async Task<ActionResult> BulkDeleteQueryAsync([FromQuery] List<long> ids)
        {
            if (ids == null || ids.Count == 0)
                return BadRequest("At least one account ID is required.");
            try
            {
                int deletedCount = await _accountService.DeleteMultipleAsync(ids);
                return Ok(new { message = $"{deletedCount} accounts deleted successfully", deletedCount });
            }
            catch (Exception ex)
            {
                return StatusCode(500, new { message = "Error deleting accounts", error = ex.Message });
            }
        }
    }
}
