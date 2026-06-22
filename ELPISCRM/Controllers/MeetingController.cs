using Elpis_CRM.Model;
using Elpis_CRM.Services;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.AspNetCore.Authentication.JwtBearer;
using System.Collections.Generic;
using System.Threading.Tasks;

namespace Elpis_CRM.Controllers
{
    [Route("api/[controller]")]
    [ApiController]
    public class MeetingController : ControllerBase
    {
        private readonly MeetingService _meetingService;

        public MeetingController(MeetingService meetingService)
        {
            _meetingService = meetingService;
        }

        [HttpGet]
        [Authorize(AuthenticationSchemes = JwtBearerDefaults.AuthenticationScheme, Roles = "Admin,Manager,User")]
        public async Task<ActionResult<List<MeetingModel>>> GetAll()
        {
            var meetings = await _meetingService.GetAllMeetingsAsync();
            return Ok(meetings);
        }

        [HttpGet("{id:int}")]
        [Authorize(AuthenticationSchemes = JwtBearerDefaults.AuthenticationScheme, Roles = "Admin,Manager,User")]
        public async Task<ActionResult<MeetingModel>> GetById(int id)
        {
            var meeting = await _meetingService.GetMeetingByIdAsync(id);

            if (meeting == null)
            {
                return NotFound($"Meeting with ID '{id}' not found.");
            }
            return Ok(meeting);
        }

        [HttpGet("contact/{contactId:long}")]
        [Authorize(AuthenticationSchemes = JwtBearerDefaults.AuthenticationScheme, Roles = "Admin,Manager,User")]
        public async Task<ActionResult<List<MeetingModel>>> GetByContactId(long contactId)
        {
            var meetings = await _meetingService.GetMeetingsByContactIdAsync(contactId);
            return Ok(meetings);
        }

        [HttpGet("account/{accountId:long}")]
        [Authorize(AuthenticationSchemes = JwtBearerDefaults.AuthenticationScheme, Roles = "Admin,Manager,User")]
        public async Task<ActionResult<List<MeetingModel>>> GetByAccountId(long accountId)
        {
            var meetings = await _meetingService.GetMeetingsByAccountIdAsync(accountId);
            return Ok(meetings);
        }

        [HttpGet("upcoming")]
        [Authorize(AuthenticationSchemes = JwtBearerDefaults.AuthenticationScheme, Roles = "Admin,Manager,User")]
        public async Task<ActionResult<List<MeetingModel>>> GetUpcoming()
        {
            var meetings = await _meetingService.GetUpcomingMeetingsAsync();
            return Ok(meetings);
        }

        [HttpPost]
        [Authorize(AuthenticationSchemes = JwtBearerDefaults.AuthenticationScheme, Roles = "Admin,Manager,User")]
        public async Task<ActionResult<MeetingModel>> Create([FromBody] MeetingModel meeting)
        {
            if (!ModelState.IsValid)
            {
                return BadRequest(ModelState);
            }
            var created = await _meetingService.CreateMeetingAsync(meeting);

            return CreatedAtAction(nameof(GetById), new { id = created.MeetingId }, created);
        }

        [HttpPut("{id:int}")]
        [Authorize(AuthenticationSchemes = JwtBearerDefaults.AuthenticationScheme, Roles = "Admin,Manager,User")]
        public async Task<ActionResult<MeetingModel>> Update(int id, [FromBody] MeetingModel meeting)
        {
            var updated = await _meetingService.UpdateMeetingAsync(id, meeting);

            if (updated == null)
            {
                return NotFound($"Meeting with ID '{id}' not found.");
            }
            return Ok(updated);
        }

        [HttpDelete("{id:int}")]
        [Authorize(AuthenticationSchemes = JwtBearerDefaults.AuthenticationScheme, Roles = "Admin")]
        public async Task<ActionResult> Delete(int id)
        {
            var deleted = await _meetingService.DeleteMeetingAsync(id);

            if (!deleted)
            {
                return NotFound($"Meeting with ID '{id}' not found.");
            }
            return Ok("Deleted Successfully");
        }
    }
}