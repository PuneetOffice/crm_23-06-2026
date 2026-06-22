using Elpis_CRM.Data;
using Elpis_CRM.Model;
using Microsoft.EntityFrameworkCore;
using System;
using System.Collections.Generic;
using System.Linq;
using System.Threading.Tasks;

namespace Elpis_CRM.Services
{
    public class CallLogService
    {
        private readonly AppDbContext _callLogContext;

        public CallLogService(AppDbContext callLogContext)
        {
            _callLogContext = callLogContext;
        }

        // Create Call Log
        public async Task<CallLogModel> CreateCallLogAsync(CallLogModel callLog)
        {
            // Only set CreatedAt to current time if not provided by the client
            if (callLog.CreatedAt == null)
            {
                callLog.CreatedAt = DateTime.UtcNow;
            }

            _callLogContext.CallLog.Add(callLog);
            await _callLogContext.SaveChangesAsync();

            return callLog;
        }

        // Get All Call Logs
        public async Task<List<CallLogModel>> GetAllCallLogsAsync()
        {
            return await _callLogContext.CallLog.ToListAsync();
        }

        // Get CallLog By Id
        public async Task<CallLogModel?> GetCallLogByIdAsync(long id)
        {
            return await _callLogContext.CallLog
                .FirstOrDefaultAsync(c => c.CallLogId == id);
        }

        // Get CallLogs By ContactId
        public async Task<List<CallLogModel>> GetCallLogsByContactIdAsync(long contactId)
        {
            return await _callLogContext.CallLog
                .Where(c => c.ContactId == contactId)
                .OrderByDescending(c => c.CreatedAt)
                .ToListAsync();
        }

        // Update CallLog
        public async Task<CallLogModel?> UpdateCallLogAsync(CallLogModel callLog)
        {
            var existing = await _callLogContext.CallLog
                .FirstOrDefaultAsync(c => c.CallLogId == callLog.CallLogId);

            if (existing == null)
            {
                return null;
            }

            existing.CallOwner = callLog.CallOwner;
            existing.CallDirection = callLog.CallDirection;
            existing.CallStatus = callLog.CallStatus;
            existing.CallDuration = callLog.CallDuration;
            existing.Outcome = callLog.Outcome;
            existing.Phone = callLog.Phone;
            existing.CallType = callLog.CallType;
            existing.Notes = callLog.Notes;
            existing.AssociatedWithCall = callLog.AssociatedWithCall;
 
            existing.ContactId = callLog.ContactId;
            existing.AccountId = callLog.AccountId;
            existing.DealId = callLog.DealId;

            await _callLogContext.SaveChangesAsync();

            return existing;
        }

        // Delete CallLog
        public async Task<bool> DeleteCallLogAsync(long id)
        {
            var existing = await _callLogContext.CallLog
                .FirstOrDefaultAsync(c => c.CallLogId == id);

            if (existing == null)
            {
                return false;
            }

            _callLogContext.CallLog.Remove(existing);
            await _callLogContext.SaveChangesAsync();

            return true;
        }
    }
}