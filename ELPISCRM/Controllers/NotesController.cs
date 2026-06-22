using Elpis_CRM.Model;
using Elpis_CRM.Services;
using Microsoft.AspNetCore.Authentication.JwtBearer;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using System.Threading.Tasks;
using Elpis_CRM.Model.DTOs;

namespace Elpis_CRM.Controllers
{
    /// <summary>
    /// Controller for managing Notes.
    /// </summary>
    [Route("api/[controller]")]
[ApiController]
[Authorize(AuthenticationSchemes = JwtBearerDefaults.AuthenticationScheme, Roles = "Admin,Manager,User")]
    public class NotesController : ControllerBase
    {
        private readonly NotesService _notesService;

        public NotesController(NotesService notesService)
        {
            _notesService = notesService;
        }

        /// <summary>
        /// Add note
        /// </summary>
        [HttpPost]
        public async Task<IActionResult> Add([FromBody] NotesModel note)
        {
            if (note == null)
            {
                return BadRequest("Invalid note data");
            }
            var created = await _notesService.AddNote(note);

            return CreatedAtAction(nameof(GetById), new { id = created.Id }, created);
        }

        /// <summary>
        /// Get all notes
        /// </summary>
        [HttpGet]
        public async Task<IActionResult> GetAll()
        {
            var notes = await _notesService.GetAllNotes();
            return Ok(notes);
        }

        /// <summary>
        /// Get note by id
        /// </summary>
        [HttpGet("{id:int}")]
        public async Task<IActionResult> GetById(int id)
        {
            var note = await _notesService.GetById(id);

            if (note == null)
            {
                return NotFound("Note not found");
            }
            return Ok(note);
        }

        /// <summary>
        /// get notes by contact id
        /// </summary>
        /// <param name="contactId"></param>
        /// <returns></returns>
        [HttpGet("contact/{contactId:long}")]
        public async Task<ActionResult<List<ContactNoteDto>>> GetByContact(long contactId)
        {
            var notes = await _notesService.GetNotesByContactAsync(contactId);
            return Ok(notes);
        }


        /// <summary>
        /// Update note
        /// </summary>
        [HttpPut("{id:int}")]
        public async Task<IActionResult> Update(int id, [FromBody] NotesModel note)
        {
            var updated = await _notesService.UpdateNote(id, note);

            if (updated == null)
            {
                return NotFound("Note not found");
            }
            return Ok(updated);
        }

        /// <summary>
        /// Delete note
        /// </summary>
        [HttpDelete("{id:int}")]
        [Authorize(AuthenticationSchemes = JwtBearerDefaults.AuthenticationScheme, Roles = "Admin")]
        public async Task<IActionResult> Delete(int id)
        {
            var deleted = await _notesService.DeleteNote(id);

            if (!deleted)
            {
                return NotFound("Note not found");
            }
            return Ok("Note deleted successfully");
        }

        /// <summary>
        /// Get notes by deal id.
        /// </summary>
        /// <param name="dealId">Deal id.</param>
        /// <returns>List of deal notes.</returns>
        [HttpGet("deal/{dealId:long}")]
        public async Task<ActionResult<List<DealNoteDto>>> GetByDeal(long dealId)
        {
            var notes = await _notesService.GetNotesByDealAsync(dealId);
            return Ok(notes);
        }
    }
}