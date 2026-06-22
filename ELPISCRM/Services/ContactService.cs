using Elpis_CRM.Data;
using Elpis_CRM.Model;
using Microsoft.EntityFrameworkCore;
using System;
using System.Collections.Generic;
using System.Linq;
using System.Threading.Tasks;

namespace Elpis_CRM.Services
{
    public class ContactService
    {
        private readonly AppDbContext _contactContext;

        public ContactService(AppDbContext context)
        {
            _contactContext = context;
        }

        // Get Contacts with Pagination (optional server-side search)
        public async Task<(List<ContactModel> items, int totalCount)> GetAllAsync(int page = 1, int pageSize = 150, string? search = null)
        {
            if (page < 1) page = 1;
            if (pageSize < 1) pageSize = 150;
            if (pageSize > 500) pageSize = 500;

            var query = _contactContext.Contacts.AsNoTracking();

            // Token-based search: each word must match at least one field (AND across tokens).
            // "Appa Rao" → "appa" in FirstName AND "rao" in LastName → match.
            if (!string.IsNullOrWhiteSpace(search) && search.Trim().Length >= 2)
            {
                var tokens = search.Trim().ToLowerInvariant()
                    .Split(' ', StringSplitOptions.RemoveEmptyEntries);
                foreach (var tok in tokens)
                {
                    var t = tok;
                    query = query.Where(c =>
                        (c.FirstName  != null && c.FirstName.ToLower().Contains(t))  ||
                        (c.LastName   != null && c.LastName.ToLower().Contains(t))   ||
                        (c.WorkEmail  != null && c.WorkEmail.ToLower().Contains(t))  ||
                        (c.WorkPhone  != null && c.WorkPhone.ToLower().Contains(t))  ||
                        (c.Mobile     != null && c.Mobile.ToLower().Contains(t))     ||
                        (c.Account    != null && c.Account.ToLower().Contains(t))    ||
                        (c.SalesOwner != null && c.SalesOwner.ToLower().Contains(t)) ||
                        (c.Territory  != null && c.Territory.ToLower().Contains(t))  ||
                        (c.Tags       != null && c.Tags.ToLower().Contains(t)));
                }
            }

            var totalCount = await query.CountAsync();
            var items = await query
                .OrderByDescending(c => c.CreatedAt ?? DateTime.MinValue)
                .Skip((page - 1) * pageSize)
                .Take(pageSize)
                .ToListAsync();
            return (items, totalCount);
        }

        // Get contact by ID
        public async Task<ContactModel?> GetByIdAsync(long id)
        {
            return await _contactContext.Contacts
                .FirstOrDefaultAsync(c => c.ContactId == id);
        }

        // Get contacts by account ID (optional name/email filter + cap for large accounts)
        public async Task<List<ContactModel>> GetContactsByAccountIdAsync(long accountId, string? q = null, int limit = 300)
        {
            limit = Math.Clamp(limit, 1, 500);
            var query = _contactContext.Contacts
                .AsNoTracking()
                .Where(c => c.AccountId == accountId);

            if (!string.IsNullOrWhiteSpace(q))
            {
                var t = q.Trim().ToLowerInvariant();
                if (t.Length >= 1)
                {
                    query = query.Where(c =>
                        (c.FirstName != null && c.FirstName.ToLower().Contains(t)) ||
                        (c.LastName != null && c.LastName.ToLower().Contains(t)) ||
                        (c.WorkEmail != null && c.WorkEmail.ToLower().Contains(t)) ||
                        (c.Mobile != null && c.Mobile.ToLower().Contains(t)) ||
                        (c.WorkPhone != null && c.WorkPhone.ToLower().Contains(t)));
                }
            }

            return await query
                .OrderBy(c => c.FirstName)
                .ThenBy(c => c.LastName)
                .Take(limit)
                .Select(c => new ContactModel
                {
                    ContactId = c.ContactId,
                    FirstName = c.FirstName,
                    LastName = c.LastName,
                    WorkEmail = c.WorkEmail,
                    Account = c.Account
                })
                .ToListAsync();
        }

        /// <summary>
        /// Global contact typeahead (min 2 characters on <paramref name="q"/>).
        /// </summary>
        public async Task<List<ContactModel>> SearchAsync(string? q, int limit = 50)
        {
            if (string.IsNullOrWhiteSpace(q) || q.Trim().Length < 2)
                return new List<ContactModel>();

            limit = Math.Clamp(limit, 1, 100);
            var term = q.Trim().ToLowerInvariant();
            var isNumeric = long.TryParse(term, out var idVal);

            var query = _contactContext.Contacts.AsNoTracking().AsQueryable();

            if (isNumeric)
            {
                query = query.Where(c =>
                    c.ContactId == idVal ||
                    (c.FirstName != null && c.FirstName.ToLower().Contains(term)) ||
                    (c.LastName != null && c.LastName.ToLower().Contains(term)) ||
                    (c.WorkEmail != null && c.WorkEmail.ToLower().Contains(term)) ||
                    (c.Account != null && c.Account.ToLower().Contains(term)));
            }
            else
            {
                // Token-based: each word must match some field
                var tokens = term.Split(' ', StringSplitOptions.RemoveEmptyEntries);
                foreach (var tok in tokens)
                {
                    var t = tok;
                    query = query.Where(c =>
                        (c.FirstName != null && c.FirstName.ToLower().Contains(t)) ||
                        (c.LastName  != null && c.LastName.ToLower().Contains(t))  ||
                        (c.WorkEmail != null && c.WorkEmail.ToLower().Contains(t)) ||
                        (c.Mobile    != null && c.Mobile.ToLower().Contains(t))    ||
                        (c.WorkPhone != null && c.WorkPhone.ToLower().Contains(t)) ||
                        (c.Account   != null && c.Account.ToLower().Contains(t)));
                }
            }

            return await query
                .OrderBy(c => c.LastName)
                .ThenBy(c => c.FirstName)
                .Take(limit)
                .ToListAsync();
        }

        /// <summary>
        /// Aggregated lifecycle counts for dashboard charts (full table scan count only, no row payload).
        /// </summary>
        public async Task<Dictionary<string, int>> GetLifeCycleStageCountsAsync()
        {
            var groups = await _contactContext.Contacts
                .AsNoTracking()
                .GroupBy(c => c.LifeCycleStage ?? "")
                .Select(g => new { Stage = g.Key, Count = g.Count() })
                .ToListAsync();

            var prospect = 0;
            var engaged = 0;
            var customer = 0;
            var promoter = 0;
            var other = 0;

            foreach (var row in groups)
            {
                var s = (row.Stage ?? "").Trim();
                if (string.IsNullOrEmpty(s))
                {
                    other += row.Count;
                    continue;
                }

                switch (s.ToLowerInvariant())
                {
                    case "prospect":
                        prospect += row.Count;
                        break;
                    case "engaged":
                        engaged += row.Count;
                        break;
                    case "customer":
                        customer += row.Count;
                        break;
                    case "promoter":
                        promoter += row.Count;
                        break;
                    default:
                        other += row.Count;
                        break;
                }
            }

            return new Dictionary<string, int>
            {
                ["prospect"] = prospect,
                ["engaged"] = engaged,
                ["customer"] = customer,
                ["promoter"] = promoter,
                ["other"] = other
            };
        }

        // Get all unique tags
        public async Task<List<string>> GetAllTagsAsync()
        {
            var tags = await _contactContext.Contacts
                .Where(c => !string.IsNullOrEmpty(c.Tags))
                .Select(c => c.Tags)
                .ToListAsync();

            return tags
                .SelectMany(t => t.Split(',', StringSplitOptions.RemoveEmptyEntries))
                .Select(t => t.Trim())
                .Distinct()
                .ToList();
        }

        // Get emails by tags
        public async Task<string> GetEmailsByTagsAsync(string tags)
        {
            var selectedTags = tags.Split(',', StringSplitOptions.RemoveEmptyEntries)
                                   .Select(t => t.Trim())
                                   .ToList();

            var contacts = await _contactContext.Contacts
                .Where(c => !string.IsNullOrEmpty(c.WorkEmail) && !string.IsNullOrEmpty(c.Tags))
                .ToListAsync();

            var emails = contacts
                .Where(c => c.Tags.Split(',', StringSplitOptions.RemoveEmptyEntries)
                .Select(t => t.Trim())
                .Any(tag => selectedTags.Contains(tag)))
                .Select(c => c.WorkEmail)
                .Distinct()
                .ToList();

            return string.Join(",", emails);
        }

        // Get contacts by tags
        public async Task<List<ContactModel>> GetContactsByTagsAsync(string tags)
        {
            if (string.IsNullOrWhiteSpace(tags))
                return new List<ContactModel>();

            var selectedTags = tags.Split(',', StringSplitOptions.RemoveEmptyEntries)
                                   .Select(t => t.Trim())
                                   .ToList();

            var contacts = await _contactContext.Contacts
                .Where(c => !string.IsNullOrEmpty(c.Tags))
                .ToListAsync();

            return contacts
                .Where(c => c.Tags.Split(',', StringSplitOptions.RemoveEmptyEntries)
                .Select(t => t.Trim())
                .Any(tag => selectedTags.Contains(tag)))
                .ToList();
        }

        /// <summary>
        /// When the client sends <see cref="ContactModel.Account"/> but not <see cref="ContactModel.AccountId"/>,
        /// resolve the FK from Accounts (fixes deals / GetContactsByAccountId empty lists).
        /// </summary>
        private async Task EnsureAccountIdResolvedAsync(ContactModel contact)
        {
            if (contact == null)
            {
                return;
            }
            if (contact.AccountId.HasValue && contact.AccountId.Value > 0)
            {
                return;
            }
            if (string.IsNullOrWhiteSpace(contact.Account)) 
            {
                return;
            }
            var trimmed = contact.Account.Trim();
            var acc = await _contactContext.Accounts.AsNoTracking().FirstOrDefaultAsync(a => a.Name != null && a.Name == trimmed);
            if (acc == null)
            {
                var lower = trimmed.ToLowerInvariant();
                acc = await _contactContext.Accounts
                    .AsNoTracking()
                    .FirstOrDefaultAsync(a => a.Name != null && a.Name.ToLower() == lower);
            }

            if (acc != null)
            {
                contact.AccountId = acc.AccountId;
            }
        }

        // Create contact
        public async Task<ContactModel> AddAsync(ContactModel contact)
        {
            var now = DateTime.UtcNow;

            contact.CreatedAt = now;
            contact.UpdatedAt = now;

            if (contact.LastActivityDate == null) contact.LastActivityDate = now;
            if (contact.LastAssignedAt == null) contact.LastAssignedAt = now;
            if (contact.FirstSeenOnChat == null) contact.FirstSeenOnChat = now;
            if (contact.LastSeenOnChat == null) contact.LastSeenOnChat = now;
            if (contact.LastSeenOnWeb == null) contact.LastSeenOnWeb = now;
            if (contact.LastContactedTime == null) contact.LastContactedTime = now;

            await EnsureAccountIdResolvedAsync(contact);

            // Generate ID only if not provided (manual add).
            // Import provides its own IDs from the Excel file.
            if (contact.ContactId <= 0)
            {
                // Timestamp and random suffix to avoid duplicates within same millisecond
                contact.ContactId = DateTimeOffset.UtcNow.ToUnixTimeMilliseconds() * 1000 + new Random().Next(0, 999);
            }
            else
            {
                // Import: if contact with this ID already exists, update instead
                var existing = await _contactContext.Contacts
                    .FirstOrDefaultAsync(c => c.ContactId == contact.ContactId);
                if (existing != null)
                {
                    return await UpdateAsync(contact.ContactId, contact) ?? contact;
                }
            
            }

            _contactContext.Contacts.Add(contact);
            await _contactContext.SaveChangesAsync();

            return contact;
        }

        // Update contact
        public async Task<ContactModel?> UpdateAsync(long id, ContactModel contact)
        {
            var existing = await _contactContext.Contacts
                .FirstOrDefaultAsync(c => c.ContactId == id);

            if (existing == null)
            {
                return null;
            }

            await EnsureAccountIdResolvedAsync(contact);

            existing.FirstName = contact.FirstName;
            existing.LastName = contact.LastName;
            existing.JobTitle = contact.JobTitle;
            existing.WorkPhone = contact.WorkPhone;
            existing.Mobile = contact.Mobile;
            existing.WorkEmail = contact.WorkEmail;
            existing.Address = contact.Address;
            existing.City = contact.City;
            existing.State = contact.State;
            existing.Zipcode = contact.Zipcode;
            existing.Country = contact.Country;
            existing.LinkedIn = contact.LinkedIn;
            existing.Facebook = contact.Facebook;
            existing.Twitter = contact.Twitter;
            existing.Source = contact.Source;
            existing.Campaign = contact.Campaign;
            existing.Territory = contact.Territory;
            existing.LifeCycleStage = contact.LifeCycleStage;
            existing.Status = contact.Status;
            existing.LostReason = contact.LostReason;
            existing.Tags = contact.Tags;
            existing.Lists = contact.Lists;
            existing.Emails = contact.Emails;
            existing.Products = contact.Products;
            existing.Message = contact.Message;
            existing.AccountId = contact.AccountId;
            existing.Account = contact.Account;
            existing.SalesOwnerId = contact.SalesOwnerId;
            existing.SalesOwner = contact.SalesOwner;
            // existing.CreatedById = contact.CreatedById;         // IMMUTABLE - preserve original
            // existing.CreatedBy = contact.CreatedBy;             // IMMUTABLE - preserve original
            // existing.UpdatedById = contact.UpdatedById;         // Backend sets from current user
            // existing.UpdatedBy = contact.UpdatedBy;             // Backend sets from current user
            existing.ImportID = contact.ImportID;

            var now = DateTime.UtcNow;
            existing.LastActivityDate = now;
            existing.LastSeenOnChat = now;
            existing.LastSeenOnWeb = now;
            existing.LastContactedTime = now;
            existing.UpdatedAt = now;

            await _contactContext.SaveChangesAsync();
            return existing;
        }

        // Delete contact
        public async Task<bool> DeleteAsync(long id)
        {
            var contact = await _contactContext.Contacts
                .FirstOrDefaultAsync(c => c.ContactId == id);

            if (contact == null)
            {
                return false;
            }

            //  Handle foreign key constraints: Delete related records first
            try
            {
                // Delete related CallLogs
                var relatedCallLogs = await _contactContext.CallLog
                    .Where(cl => cl.ContactId == id)
                    .ToListAsync();
                if (relatedCallLogs.Any())
                {
                    _contactContext.CallLog.RemoveRange(relatedCallLogs);
                }

                // Delete related Tasks
                var relatedTasks = await _contactContext.Tasks
                    .Where(t => t.Id == id)
                    .ToListAsync();
                if (relatedTasks.Any())
                {
                    _contactContext.Tasks.RemoveRange(relatedTasks);
                }

                // Delete related Notes
                var relatedNotes = await _contactContext.Notes
                    .Where(n => n.Id == id)
                    .ToListAsync();
                if (relatedNotes.Any())
                {
                    _contactContext.Notes.RemoveRange(relatedNotes);
                }

                // Now delete the contact
                _contactContext.Contacts.Remove(contact);
                await _contactContext.SaveChangesAsync();
                return true;
            }
            catch (Exception)
            {
                // If any foreign key constraints still fail, just remove the contact
                _contactContext.Contacts.Remove(contact);
                await _contactContext.SaveChangesAsync();
                return true;
            }
        }
            // Get contacts by CreatedAt date
        public async Task<List<ContactModel>> GetContactsByCreatedAtAsync(DateTime createdAt)
        {
            var start = createdAt.Date;
            var end = start.AddDays(1);

            return await _contactContext.Contacts
                .Where(c => c.CreatedAt >= start && c.CreatedAt < end)
                .ToListAsync();
        }
    }
}