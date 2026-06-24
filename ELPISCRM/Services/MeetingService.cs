using Elpis_CRM.Data;
using Elpis_CRM.Model;
using Microsoft.EntityFrameworkCore;
using System;
using System.Collections.Generic;
using System.Linq;
using System.Threading.Tasks;

namespace Elpis_CRM.Services
{
    public class MeetingService
    {
        private readonly AppDbContext _meetingDb;

        public MeetingService(AppDbContext meetingDb)
        {
            _meetingDb = meetingDb;
        }

        public async Task<List<MeetingModel>> GetAllMeetingsAsync()
        {
            return await _meetingDb.Meeting.ToListAsync();
        }

        public async Task<MeetingModel?> GetMeetingByIdAsync(int meetingId)
        {
            return await _meetingDb.Meeting.FindAsync(meetingId);
        }

        public async Task<List<MeetingModel>> GetMeetingsByContactIdAsync(long contactId)
        {
            return await _meetingDb.Meeting
                .Where(m => m.ContactId == contactId)
                .ToListAsync();
        }

        public async Task<List<MeetingModel>> GetMeetingsByAccountIdAsync(long accountId)
        {
            return await _meetingDb.Meeting
                .Where(m => m.AccountId == accountId)
                .ToListAsync();
        }

        public async Task<List<MeetingModel>> GetUpcomingMeetingsAsync()
        {
            var now = DateTime.UtcNow;

            return await _meetingDb.Meeting
                .Where(m => m.From >= now)
                .OrderBy(m => m.From)
                .ToListAsync();
        }

        public async Task<MeetingModel> CreateMeetingAsync(MeetingModel meeting)
        {
            meeting.CreatedAt = DateTime.UtcNow;
            meeting.UpdatedAt = DateTime.UtcNow;

            _meetingDb.Meeting.Add(meeting);
            await _meetingDb.SaveChangesAsync();

            return meeting;
        }

        public async Task<MeetingModel?> UpdateMeetingAsync(int meetingId, MeetingModel meeting)
        {
            var existing = await _meetingDb.Meeting.FindAsync(meetingId);

            if (existing == null)
                return null;

            existing.Title = meeting.Title;
            existing.From = meeting.From;
            existing.To = meeting.To;
            existing.TimeZone = meeting.TimeZone;
            existing.AddVideoConference = meeting.AddVideoConference;
            existing.Location = meeting.Location;
            existing.Description = meeting.Description;
            existing.Outcome = meeting.Outcome;
            existing.Notes = meeting.Notes;
            existing.RelatedTo = meeting.RelatedTo;
            existing.ContactId = meeting.ContactId;
            existing.AccountId = meeting.AccountId;
            existing.DealId = meeting.DealId;
           
            
    

            existing.UpdatedAt = DateTime.UtcNow;

            await _meetingDb.SaveChangesAsync();

            return existing;
        }

        public async Task<bool> DeleteMeetingAsync(int meetingId)
        {
            var meeting = await _meetingDb.Meeting.FindAsync(meetingId);

            if (meeting == null)
                return false;

            _meetingDb.Meeting.Remove(meeting);
            await _meetingDb.SaveChangesAsync();

            return true;
        }
    }
}