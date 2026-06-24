using Elpis_CRM.Model;
using Elpis_CRM.Services;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.AspNetCore.Authentication.JwtBearer;
using System.Threading.Tasks;

namespace Elpis_CRM.Controllers
{
    [Route("api/[controller]")]
    [ApiController]
    public class CallLogController : ControllerBase
    {
        private readonly CallLogService _callLogService;

        public CallLogController(CallLogService callLogService)
        {
            _callLogService = callLogService;
        }

        // GET: api/CallLog
        [HttpGet]
        [Authorize(AuthenticationSchemes = JwtBearerDefaults.AuthenticationScheme, Roles = "Admin,Manager,User")]
        public async Task<IActionResult> GetAll()
        {
            var logs = await _callLogService.GetAllCallLogsAsync();
            return Ok(logs);
        }

        // GET: api/CallLog/contact/5
        [HttpGet("contact/{contactId}")]
        [Authorize(AuthenticationSchemes = JwtBearerDefaults.AuthenticationScheme, Roles = "Admin,Manager,User")]
        public async Task<IActionResult> GetByContactId(long contactId)
        {
            var logs = await _callLogService.GetCallLogsByContactIdAsync(contactId);
            return Ok(logs);
        }

        // GET: api/CallLog/5
        [HttpGet("{id}")]
        [Authorize(AuthenticationSchemes = JwtBearerDefaults.AuthenticationScheme, Roles = "Admin,Manager,User")]
        public async Task<IActionResult> GetById(long id)
        {
            var log = await _callLogService.GetCallLogByIdAsync(id);

            if (log == null)
            {
                return NotFound(new { message = $"Call log with ID {id} not found" });
            }
            return Ok(log);
        }

        // POST: api/CallLog
        [HttpPost]
        [Authorize(AuthenticationSchemes = JwtBearerDefaults.AuthenticationScheme, Roles = "Admin,Manager,User")]
        public async Task<IActionResult> Create([FromBody] CallLogModel callLog)
        {
            if (callLog == null)
            {
                return BadRequest("Invalid call log data");
            }

            var createdLog = await _callLogService.CreateCallLogAsync(callLog);

            return CreatedAtAction(
                nameof(GetById),
                new { id = createdLog.CallLogId },
                createdLog
            );
        }

        // PUT: api/CallLog/5
        [HttpPut("{id}")]
        [Authorize(AuthenticationSchemes = JwtBearerDefaults.AuthenticationScheme, Roles = "Admin,Manager,User")]
        public async Task<IActionResult> Update(long id, [FromBody] CallLogModel callLog)
        {
            if (callLog == null || id != callLog.CallLogId)
            {
                return BadRequest("CallLog ID mismatch");
            }

            var updatedLog = await _callLogService.UpdateCallLogAsync(callLog);

            if (updatedLog == null)
            {
                return NotFound(new { message = $"Call log with ID {id} not found" });
            }

            return Ok(updatedLog);
        }

        // DELETE: api/CallLog/5
        [HttpDelete("{id}")]
        [Authorize(AuthenticationSchemes = JwtBearerDefaults.AuthenticationScheme, Roles = "Admin")]
        public async Task<IActionResult> Delete(long id)
        {
            var deleted = await _callLogService.DeleteCallLogAsync(id);

            if (!deleted)
            {
                return NotFound(new { message = $"Call log with ID {id} not found" });
            }

            return Ok(new { message = "Call log deleted successfully" });
        }
    }
}