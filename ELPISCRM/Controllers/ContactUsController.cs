using Elpis_CRM.Dtos;
using Elpis_CRM.Services;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using System;
using System.Threading.Tasks;

namespace Elpis_CRM.Controllers
{
    /// <summary>
    /// Public endpoint that receives "Contact Us" form submissions from the
    /// external website. Matches the submitter against existing contacts and
    /// either creates a deal on the existing contact, or creates a new contact
    /// and a deal for it.
    /// </summary>
    [Route("api/[controller]")]
    [ApiController]
    public class ContactUsController : ControllerBase
    {
        private readonly ContactUsService _contactUsService;

        public ContactUsController(ContactUsService contactUsService)
        {
            _contactUsService = contactUsService;
        }

        /// <summary>
        /// Submits a Contact Us enquiry.
        /// </summary>
        /// <param name="form">The form fields entered by the website visitor.</param>
        /// <returns>Result describing whether the contact was matched or created and the new deal.</returns>
        /// <response code="200">Enquiry processed; contact and deal resolved.</response>
        /// <response code="400">Invalid form data.</response>
        [HttpPost]
        [AllowAnonymous]
        public async Task<IActionResult> SubmitAsync([FromBody] ContactUsFormDto form)
        {
            if (form == null)
            {
                return BadRequest("Form data cannot be null.");
            }

            if (!ModelState.IsValid)
            {
                return BadRequest(ModelState);
            }

            try
            {
                var result = await _contactUsService.SubmitAsync(form);
                return Ok(result);
            }
            catch (ArgumentException ex)
            {
                return BadRequest(new { message = ex.Message });
            }
            catch (Exception ex)
            {
                return StatusCode(500, new { message = ex.Message, detail = ex.InnerException?.Message });
            }
        }
    }
}
