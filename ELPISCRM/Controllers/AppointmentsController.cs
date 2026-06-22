using Elpis_CRM.Model;
using Elpis_CRM.Services;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.AspNetCore.Authentication.JwtBearer;
using System.Collections.Generic;
using System.Threading.Tasks;

namespace Elpis_CRM.Controllers
{
    /// <summary>
    /// Provides API endpoints to manage appointments.
    /// </summary>
    [Route("api/[controller]")]
    [ApiController]
    public class AppointmentsController : ControllerBase
    {
        private readonly AppointmentsService _appointmentsService;

        /// <summary>
        /// Initializes a new instance of the <see cref="AppointmentsController"/>.
        /// </summary>
        /// <param name="appointmentsService">Service for appointment operations.</param>
        public AppointmentsController(AppointmentsService appointmentsService)
        {
            _appointmentsService = appointmentsService;
        }

        /// <summary>
        /// Retrieves all appointments.
        /// </summary>
        /// <returns>A list of appointments.</returns>
        /// <response code="200">Appointments retrieved successfully</response>
        [HttpGet]
        [Authorize(AuthenticationSchemes = JwtBearerDefaults.AuthenticationScheme, Roles = "Admin,Manager,User")]
        public async Task<ActionResult<List<AppointmentsModel>>> GetAll()
        {
            var appointments = await _appointmentsService.GetAllAppointmentsAsync();
            return Ok(appointments);
        }

        /// <summary>
        /// Retrieves an appointment by its ID.
        /// </summary>
        /// <param name="id">The appointment ID.</param>
        /// <returns>The appointment details.</returns>
        /// <response code="200">Appointment found</response>
        /// <response code="404">Appointment not found</response>
        [HttpGet("{id:int}")]
        [Authorize(AuthenticationSchemes = JwtBearerDefaults.AuthenticationScheme, Roles = "Admin,Manager,User")]
        public async Task<ActionResult<AppointmentsModel>> GetById(int id)
        {
            var appointment = await _appointmentsService.GetAppointmentByIdAsync(id);
            if (appointment == null)
            {
                return NotFound($"Appointment with ID '{id}' not found.");
            }
            return Ok(appointment);
        }

        /// <summary>
        /// Retrieves appointments associated with a specific contact.
        /// </summary>
        /// <param name="contactId">The contact ID.</param>
        /// <returns>A list of appointments.</returns>
        /// <response code="200">Appointments retrieved successfully</response>
        [HttpGet("contact/{contactId:int}")]
        [Authorize(AuthenticationSchemes = JwtBearerDefaults.AuthenticationScheme, Roles = "Admin,Manager,User")]
        public async Task<ActionResult<List<AppointmentsModel>>> GetByContactId(int contactId)
        {
            var appointments = await _appointmentsService.GetAppointmentsByContactIdAsync(contactId);
            return Ok(appointments);
        }

        /// <summary>
        /// Retrieves appointments associated with a specific account.
        /// </summary>
        /// <param name="accountId">The account ID.</param>
        /// <returns>A list of appointments.</returns>
        /// <response code="200">Appointments retrieved successfully</response>
        [HttpGet("account/{accountId:int}")]
        [Authorize(AuthenticationSchemes = JwtBearerDefaults.AuthenticationScheme, Roles = "Admin,Manager,User")]
        public async Task<ActionResult<List<AppointmentsModel>>> GetByAccountId(int accountId)
        {
            var appointments = await _appointmentsService.GetAppointmentsByAccountIdAsync(accountId);
            return Ok(appointments);
        }

        /// <summary>
        /// Creates a new appointment.
        /// </summary>
        /// <param name="appointment">Appointment data.</param>
        /// <returns>The newly created appointment.</returns>
        /// <response code="201">Appointment created successfully</response>
        /// <response code="400">Invalid request data</response>
        [HttpPost]
        [Authorize(AuthenticationSchemes = JwtBearerDefaults.AuthenticationScheme, Roles = "Admin,Manager,User")]
        public async Task<ActionResult<AppointmentsModel>> Create([FromBody] AppointmentsModel appointment)
        {
            if (!ModelState.IsValid)
            {
                return BadRequest(ModelState);
            }

            var created = await _appointmentsService.CreateAppointmentAsync(appointment);
            return CreatedAtAction(nameof(GetById), new { id = created.AppointmentId }, created);
        }

        /// <summary>
        /// Updates an existing appointment.
        /// </summary>
        /// <param name="id">The appointment ID.</param>
        /// <param name="appointment">Updated appointment data.</param>
        /// <returns>The updated appointment.</returns>
        /// <response code="200">Appointment updated successfully</response>
        /// <response code="404">Appointment not found</response>
        [HttpPut("{id:int}")]
        [Authorize(AuthenticationSchemes = JwtBearerDefaults.AuthenticationScheme, Roles = "Admin,Manager,User")]
        public async Task<ActionResult<AppointmentsModel>> Update(int id, [FromBody] AppointmentsModel appointment)
        {
            var updated = await _appointmentsService.UpdateAppointmentAsync(id, appointment);
            if (updated == null)
            {
                return NotFound($"Appointment with ID '{id}' not found.");
            }
            return Ok(updated);
        }

        /// <summary>
        /// Deletes an appointment by its ID.
        /// </summary>
        /// <param name="id">The appointment ID.</param>
        /// <returns>Deletion result.</returns>
        /// <response code="200">Appointment deleted successfully</response>
        /// <response code="404">Appointment not found</response>
        [HttpDelete("{id:int}")]
        [Authorize(AuthenticationSchemes = JwtBearerDefaults.AuthenticationScheme, Roles = "Admin,Manager")]
        public async Task<ActionResult> Delete(int id)
        {
            var deleted = await _appointmentsService.DeleteAppointmentAsync(id);
            if (!deleted)
            {
                return NotFound($"Appointment with ID '{id}' not found.");
            }
            return Ok("Deleted Successfully");
        }
    }
}
