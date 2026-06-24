using Elpis_CRM.Model;
using Elpis_CRM.Service;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.AspNetCore.Authentication.JwtBearer;
using System.Collections.Generic;
using System.Threading.Tasks;
using Elpis_CRM.Services;

namespace Elpis_CRM.Controllers
{
    /// <summary>
    /// Provides API endpoints to manage contacts and contact-related tags.
    /// </summary>
    [Route("api/[controller]")]
    [ApiController]
    public class ContactController : ControllerBase
    {
        private readonly ContactService _contactService;

        /// <summary>
        /// Initializes a new instance of the <see cref="ContactController"/>.
        /// </summary>
        /// <param name="contactService">Service for contact operations.</param>
        public ContactController(ContactService contactService)
        {
            _contactService = contactService;
        }

        /// <summary>
        /// Retrieves contacts with optional pagination.
        /// </summary>
        /// <param name="page">Page number (1-based). Default: 1</param>
        /// <param name="pageSize">Records per page. Default: 50, Max: 500</param>
        /// <returns>Paginated list of contacts with total count</returns>
        /// <response code="200">Contacts retrieved successfully</response>
        [HttpGet]
        [Authorize(AuthenticationSchemes = JwtBearerDefaults.AuthenticationScheme, Roles = "Admin,Manager,User")]
        public async Task<IActionResult> GetAllAsync(
            [FromQuery] int page = 1,
            [FromQuery] int pageSize = 150,
            [FromQuery] string? search = null)
        {
            // Validation
            page = Math.Max(page, 1);
            pageSize = Math.Clamp(pageSize, 1, 500);

            var (contacts, totalCount) =
                await _contactService.GetAllAsync(page, pageSize, search);

            return Ok(new
            {
                Page = page,
                PageSize = pageSize,
                TotalCount = totalCount,
                TotalPages = (int)Math.Ceiling((double)totalCount / pageSize),
                Items = contacts
            });
        }

        /// <summary>
        /// Typeahead search across contacts (query min length 2).
        /// </summary>
        [HttpGet("search")]
        [Authorize(AuthenticationSchemes = JwtBearerDefaults.AuthenticationScheme, Roles = "Admin,Manager,User")]
        public async Task<ActionResult<List<ContactModel>>> SearchAsync([FromQuery] string q, [FromQuery] int limit = 50)
        {
            var results = await _contactService.SearchAsync(q, limit);
            return Ok(results);
        }

        /// <summary>
        /// Lifecycle stage counts for dashboard charts.
        /// </summary>
        [HttpGet("stats/lifecycle")]
        [Authorize(AuthenticationSchemes = JwtBearerDefaults.AuthenticationScheme, Roles = "Admin,Manager,User")]
        public async Task<ActionResult<Dictionary<string, int>>> GetLifeCycleStatsAsync()
        {
            var stats = await _contactService.GetLifeCycleStageCountsAsync();
            return Ok(stats);
        }

        /// <summary>
        /// Retrieves contacts by CreatedAt date (UTC based).
        /// </summary>
        /// <param name="createdAt">Date to filter (yyyy-MM-dd recommended).</param>
        /// <returns>List of contacts created on that date.</returns>
        [HttpGet("createdAt")]
        [Authorize(AuthenticationSchemes = JwtBearerDefaults.AuthenticationScheme, Roles = "Admin,Manager,User")]
        public async Task<ActionResult<List<ContactModel>>> GetByCreatedAt([FromQuery] DateTime createdAt)
        {
            var contacts = await _contactService.GetContactsByCreatedAtAsync(createdAt);
            return Ok(contacts);
        }

        /// <summary>
        /// Retrieves all distinct tags associated with contacts.
        /// </summary>
        /// <returns>A list of contact tags.</returns>
        /// <response code="200">Tags retrieved successfully</response>
        [HttpGet("tags/all")]
        [Authorize(AuthenticationSchemes = JwtBearerDefaults.AuthenticationScheme, Roles = "Admin,Manager,User")]
        public async Task<ActionResult<List<string>>> GetAllTagsAsync()
        {
            var tags = await _contactService.GetAllTagsAsync();
            return Ok(tags);
        }

        /// <summary>
        /// Retrieves email addresses of contacts associated with the specified tags.
        /// </summary>
        /// <param name="tags">Comma-separated list of tags.</param>
        /// <returns>Email addresses of matching contacts.</returns>
        /// <response code="200">Emails retrieved successfully</response>
        /// <response code="400">Tags parameter is missing or invalid</response>
        [HttpGet("tags/emails")]
        [Authorize(AuthenticationSchemes = JwtBearerDefaults.AuthenticationScheme, Roles = "Admin,Manager,User")]
        public async Task<ActionResult<string>> GetEmailsByTagsAsync([FromQuery] string tags)
        {
            if (string.IsNullOrWhiteSpace(tags))
            {
                return BadRequest("Tags parameter is required.");
            }

            var emails = await _contactService.GetEmailsByTagsAsync(tags);
            return Ok(emails);
        }

        /// <summary>
        /// Retrieves contact names associated with the specified tags.
        /// </summary>
        /// <param name="tags">Comma-separated list of tags.</param>
        /// <returns>Contact names matching the provided tags.</returns>
        /// <response code="200">Contact names retrieved successfully</response>
        /// <response code="400">Tags parameter is missing or invalid</response>
        [HttpGet("tags/contactName")]
        [Authorize(AuthenticationSchemes = JwtBearerDefaults.AuthenticationScheme, Roles = "Admin,Manager,User")]
        public async Task<ActionResult<string>> GetContactsByTags([FromQuery] string tags)
        {
            if (string.IsNullOrWhiteSpace(tags))
            {
                return BadRequest("Tags parameter is required.");
            }

            var contactNames = await _contactService.GetContactsByTagsAsync(tags);
            return Ok(contactNames);
        }

        /// <summary>
        /// Retrieves full contact objects associated with the specified tags.
        /// </summary>
        /// <param name="tags">Comma-separated list of tags.</param>
        /// <returns>Full contact objects matching the provided tags.</returns>
        /// <response code="200">Contacts retrieved successfully</response>
        /// <response code="400">Tags parameter is missing or invalid</response>
        [HttpGet("tags/contacts")]
        [Authorize(AuthenticationSchemes = JwtBearerDefaults.AuthenticationScheme, Roles = "Admin,Manager,User")]
        public async Task<ActionResult<List<ContactModel>>> GetContactsByTagsFullAsync([FromQuery] string tags)
        {
            if (string.IsNullOrWhiteSpace(tags))
            {
                return BadRequest("Tags parameter is required.");
            }

            var contacts = await _contactService.GetContactsByTagsAsync(tags);
            return Ok(contacts);
        }

        /// <summary>
        /// Retrieves a contact by its unique ID.
        /// </summary>
        /// <param name="contactId">The contact ID.</param>
        /// <returns>The requested contact.</returns>
        /// <response code="200">Contact found</response>
        /// <response code="404">Contact not found</response>
        [HttpGet("{contactId:long}")]
        [Authorize(AuthenticationSchemes = JwtBearerDefaults.AuthenticationScheme, Roles = "Admin,Manager,User")]
        public async Task<ActionResult<ContactModel>> GetByIdAsync(long contactId)
        {
            var contact = await _contactService.GetByIdAsync(contactId);

            if (contact == null)
            {
                return NotFound($"Contact with ID '{contactId}' not found.");
            }

            return Ok(contact);
        }

        /// <summary>
        /// Retrieves contacts associated with a specific account.
        /// </summary>
        /// <param name="accountId">The account ID.</param>
        /// <returns>List of contacts for the account.</returns>
        /// <response code="200">Contacts retrieved successfully</response>
        [HttpGet("account/{accountId:long}")]
        [Authorize(AuthenticationSchemes = JwtBearerDefaults.AuthenticationScheme, Roles = "Admin,Manager,User")]
        public async Task<ActionResult<List<ContactModel>>> GetContactsByAccountIdAsync(long accountId, [FromQuery] string? q = null, [FromQuery] int limit = 300)
        {
            var contacts = await _contactService.GetContactsByAccountIdAsync(accountId, q, limit);
            return Ok(contacts);
        }

        /// <summary>
        /// Creates a new contact.
        /// </summary>
        /// <param name="contact">Contact data.</param>
        /// <param name="generateEnquiryNo">If true, the system generates a sequential EnquiryNo (e.g. EITSPL-EQ-003).</param>
        /// <returns>The newly created contact.</returns>
        /// <response code="200">Contact created successfully</response>
        /// <response code="400">Invalid contact data</response>
        [HttpPost]
        [Authorize(AuthenticationSchemes = JwtBearerDefaults.AuthenticationScheme, Roles = "Admin,Manager,User")]
        public async Task<ActionResult<ContactModel>> CreateAsync(
    [FromBody] ContactModel contact,
    [FromQuery] bool generateEnquiryNo = false)
        {
            if (contact == null)
            {
                return BadRequest("Contact data cannot be null.");
            }

            try
            {
                var created = await _contactService.AddAsync(contact, generateEnquiryNo);
                return Ok(created);
            }
            catch (InvalidOperationException ex)
            {
                return BadRequest(new
                {
                    message = ex.Message
                });
            }
            catch (Exception ex)
            {
                return StatusCode(500, new
                {
                    message = "An unexpected error occurred.",
                    detail = ex.InnerException?.Message ?? ex.Message
                });
            }
        }


        /// <summary>
        /// Updates an existing contact.
        /// </summary>
        /// <param name="contactId">The contact ID.</param>
        /// <param name="contact">Updated contact data.</param>
        /// <param name="generateEnquiryNo">If true, the system generates a fresh sequential EnquiryNo (e.g. EITSPL-EQ-003), overwriting any existing value. If false, the existing EnquiryNo is left untouched.</param>
        /// <returns>Update confirmation and updated contact.</returns>
        /// <response code="200">Contact updated successfully</response>
        /// <response code="400">Invalid contact data</response>
        /// <response code="404">Contact not found</response>
        [HttpPut("{contactId:long}")]
        [Authorize(AuthenticationSchemes = JwtBearerDefaults.AuthenticationScheme, Roles = "Admin,Manager,User")]
        public async Task<ActionResult> UpdateAsync(
            long contactId,
            [FromBody] ContactModel contact,
            [FromQuery] bool generateEnquiryNo = false)
        {
            if (contact == null)
            {
                return BadRequest("Contact data cannot be null.");
            }

            var updated = await _contactService.UpdateAsync(contactId, contact, generateEnquiryNo);

            if (updated == null)
            {
                return NotFound($"Contact with ID '{contactId}' not found.");
            }

            return Ok(new
            {
                Message = "Contact updated successfully",
                Contact = updated
            });
        }

        /// <summary>
        /// Deletes a contact by its ID.
        /// </summary>
        /// <param name="contactId">The contact ID.</param>
        /// <returns>Deletion confirmation message.</returns>
        /// <response code="200">Contact deleted successfully</response>
        /// <response code="404">Contact not found</response>
        [HttpDelete("{contactId:long}")]
        [Authorize(AuthenticationSchemes = JwtBearerDefaults.AuthenticationScheme, Roles = "Admin")]
        public async Task<ActionResult> DeleteAsync(long contactId)
        {
            var deleted = await _contactService.DeleteAsync(contactId);

            if (!deleted)
            {
                return NotFound($"Contact with ID '{contactId}' not found.");
            }

            return Ok(new
            {
                Message = "Contact deleted successfully"
            });
        }

        [HttpGet("{contactId:long}/image/{imageType}")]
        [Authorize(AuthenticationSchemes = JwtBearerDefaults.AuthenticationScheme, Roles = "Admin,Manager,User")]
        public async Task<IActionResult> GetImage(long contactId, string imageType)
        {
            var contact = await _contactService.GetByIdAsync(contactId);

            if (contact == null)
                return NotFound("Contact not found.");

            byte[]? imageBytes = imageType.ToLower() switch
            {
                "front" => contact.FrontImage,
                "back" => contact.BackImage,
                _ => null
            };

            if (imageBytes == null)
                return NotFound($"{imageType} image not found.");

            return File(imageBytes, "image/jpeg");
        }

        [HttpPost("enquiry-numbers")]
        [Authorize(AuthenticationSchemes = JwtBearerDefaults.AuthenticationScheme, Roles = "Admin,Manager,User")]
        public async Task<ActionResult<List<string>>> GetEnquiryNumbers(
    [FromBody] List<long> contactIds)
        {
            var enquiryNumbers = await _contactService.GetEnquiryNumbersAsync(contactIds);
            return Ok(enquiryNumbers);
        }


    }
}
