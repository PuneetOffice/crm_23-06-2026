using Elpis_CRM.Data;
using Elpis_CRM.Model;
using Microsoft.EntityFrameworkCore;
using System;
using System.Collections.Generic;
using System.Linq;
using System.Threading.Tasks;

namespace Elpis_CRM.Services
{
    /// <summary>
    /// Service for managing appointments in the CRM system.
    /// </summary>
    public class AppointmentsService
    {
        private readonly AppDbContext _appointmentsDb;

        /// <summary>
        /// Initializes a new instance of <see cref="AppointmentsService"/>.
        /// </summary>
        /// <param name="appointmentsDb">Database context for appointments.</param>
        public AppointmentsService(AppDbContext appointmentsDb)
        {
            _appointmentsDb = appointmentsDb;
        }

        /// <summary>
        /// Retrieves all appointments from the database.
        /// </summary>
        /// <returns>A list of <see cref="AppointmentsModel"/> objects.</returns>
        public async Task<List<AppointmentsModel>> GetAllAppointmentsAsync()
        {
            return await _appointmentsDb.Appointments.ToListAsync();
        }

        /// <summary>
        /// Retrieves an appointment by its ID.
        /// </summary>
        /// <param name="appointmentId">The ID of the appointment.</param>
        /// <returns>The <see cref="AppointmentsModel"/> if found; otherwise, <c>null</c>.</returns>
        public async Task<AppointmentsModel?> GetAppointmentByIdAsync(int appointmentId)
        {
            return await _appointmentsDb.Appointments.FindAsync(appointmentId);
        }

        /// <summary>
        /// Retrieves appointments associated with a specific contact ID.
        /// </summary>
        /// <param name="contactId">The ID of the contact.</param>
        /// <returns>A list of <see cref="AppointmentsModel"/> objects.</returns>
        public async Task<List<AppointmentsModel>> GetAppointmentsByContactIdAsync(int contactId)
        {
            return await _appointmentsDb.Appointments
                .Where(a => a.ContactId == contactId)
                .ToListAsync();
        }

        /// <summary>
        /// Retrieves appointments associated with a specific account ID.
        /// </summary>
        /// <param name="accountId">The ID of the account.</param>
        /// <returns>A list of <see cref="AppointmentsModel"/> objects.</returns>
        public async Task<List<AppointmentsModel>> GetAppointmentsByAccountIdAsync(int accountId)
        {
            return await _appointmentsDb.Appointments
                .Where(a => a.AccountId == accountId)
                .ToListAsync();
        }

        /// <summary>
        /// Creates a new appointment in the database.
        /// </summary>
        /// <param name="appointment">The appointment data to create.</param>
        /// <returns>The created <see cref="AppointmentsModel"/> object.</returns>
        public async Task<AppointmentsModel> CreateAppointmentAsync(AppointmentsModel appointment)
        {
            appointment.CreatedAt = DateTime.UtcNow;
            appointment.UpdatedAt = DateTime.UtcNow;

            _appointmentsDb.Appointments.Add(appointment);
            await _appointmentsDb.SaveChangesAsync();
            return appointment;
        }

        /// <summary>
        /// Updates an existing appointment by its ID.
        /// </summary>
        /// <param name="appointmentId">The ID of the appointment to update.</param>
        /// <param name="appointment">The updated appointment data.</param>
        /// <returns>The updated <see cref="AppointmentsModel"/> if found; otherwise, <c>null</c>.</returns>
        public async Task<AppointmentsModel?> UpdateAppointmentAsync(int appointmentId, AppointmentsModel appointment)
        {
            var existing = await _appointmentsDb.Appointments.FindAsync(appointmentId);

            if (existing == null)
            {
                return null;
            }

            existing.MeetingOwner = appointment.MeetingOwner;
            existing.UpdatedBy = appointment.UpdatedBy;
            existing.ContactEmailStatus = appointment.ContactEmailStatus;
            existing.ContactJobTitle = appointment.ContactJobTitle;
            existing.ContactAddress = appointment.ContactAddress;
            existing.OpenDealsAmount = appointment.OpenDealsAmount;
            existing.FirstContacted = appointment.FirstContacted;
            existing.FirstAssignedAt = appointment.FirstAssignedAt;
            existing.Tags = appointment.Tags;
            existing.EmailIDs = appointment.EmailIDs;
            existing.UpdatedAt = DateTime.UtcNow;
            existing.AccountId = appointment.AccountId;
            existing.ContactId = appointment.ContactId;

            await _appointmentsDb.SaveChangesAsync();
            return existing;
        }

        /// <summary>
        /// Deletes an appointment by its ID.
        /// </summary>
        /// <param name="appointmentId">The ID of the appointment to delete.</param>
        /// <returns><c>true</c> if deleted successfully; <c>false</c> if not found.</returns>
        public async Task<bool> DeleteAppointmentAsync(int appointmentId)
        {
            var appointment = await _appointmentsDb.Appointments.FindAsync(appointmentId);

            if (appointment == null)
            {
                return false;
            }

            _appointmentsDb.Appointments.Remove(appointment);
            await _appointmentsDb.SaveChangesAsync();
            return true;
        }
    }
}
