using Elpis_CRM.Data;
using Elpis_CRM.Dtos;
using Elpis_CRM.Model;
using Microsoft.AspNetCore.Http;
using Microsoft.EntityFrameworkCore;
using Sylvan.Data.Csv;
using Sylvan.Data.Excel;
using System;
using System.Data;
using System.Collections.Generic;
using System.Diagnostics;
using System.Globalization;
using System.IO;
using System.Linq;
using System.Text;
using System.Threading;
using System.Threading.Tasks;

namespace Elpis_CRM.Services
{
    public class DealsService
    {
        private readonly AppDbContext _dealDb;

        public DealsService(AppDbContext dealDb)
        {
            _dealDb = dealDb;
        }

        // GET ALL DEALS (optional server-side search — no pagination: Kanban shows all cards)
        public async Task<List<DealModel>> GetAllAsync(string? search = null)
        {
            var query = _dealDb.Deals.AsNoTracking();

            // Token-based search: each word must match at least one field (AND across tokens).
            if (!string.IsNullOrWhiteSpace(search) && search.Trim().Length >= 2)
            {
                var tokens = search.Trim().ToLowerInvariant()
                    .Split(' ', StringSplitOptions.RemoveEmptyEntries);
                foreach (var tok in tokens)
                {
                    var t = tok;
                    query = query.Where(d =>
                        (d.Name        != null && d.Name.ToLower().Contains(t))        ||
                        (d.AccountName != null && d.AccountName.ToLower().Contains(t)) ||
                        (d.ContactName != null && d.ContactName.ToLower().Contains(t)) ||
                        (d.DealStage   != null && d.DealStage.ToLower().Contains(t))   ||
                        (d.SalesOwner  != null && d.SalesOwner.ToLower().Contains(t))  ||
                        (d.Territory   != null && d.Territory.ToLower().Contains(t))   ||
                        (d.Tags        != null && d.Tags.ToLower().Contains(t))        ||
                        (d.DealPipeline!= null && d.DealPipeline.ToLower().Contains(t)));
                }
            }

            var deals = await query
                .OrderByDescending(d => d.UpdatedAt ?? d.CreatedAt)
                .ThenByDescending(d => d.CreatedAt)
                .ToListAsync();

            await EnrichDealContactFieldsAsync(deals);
            return deals;
        }

        /// <summary>
        /// Typeahead search for deals (min 2 characters). Returns up to <paramref name="limit"/> rows.
        /// </summary>
        public async Task<List<DealModel>> SearchAsync(string? q, int limit = 50)
        {
            if (string.IsNullOrWhiteSpace(q) || q.Trim().Length < 2)
                return new List<DealModel>();

            limit = Math.Clamp(limit, 1, 100);
            var term = q.Trim().ToLowerInvariant();
            var isNumeric = long.TryParse(term, out var idVal);

            var query = _dealDb.Deals.AsNoTracking().AsQueryable();

            if (isNumeric)
            {
                query = query.Where(d =>
                    d.Id == idVal ||
                    (d.Name        != null && d.Name.ToLower().Contains(term)) ||
                    (d.AccountName != null && d.AccountName.ToLower().Contains(term)));
            }
            else
            {
                var tokens = term.Split(' ', StringSplitOptions.RemoveEmptyEntries);
                foreach (var tok in tokens)
                {
                    var t = tok;
                    query = query.Where(d =>
                        (d.Name        != null && d.Name.ToLower().Contains(t))        ||
                        (d.AccountName != null && d.AccountName.ToLower().Contains(t)) ||
                        (d.ContactName != null && d.ContactName.ToLower().Contains(t)) ||
                        (d.DealStage   != null && d.DealStage.ToLower().Contains(t))   ||
                        (d.SalesOwner  != null && d.SalesOwner.ToLower().Contains(t))  ||
                        (d.Territory   != null && d.Territory.ToLower().Contains(t))   ||
                        (d.Tags        != null && d.Tags.ToLower().Contains(t)));
                }
            }

            var deals = await query
                .OrderByDescending(d => d.UpdatedAt ?? d.CreatedAt)
                .Take(limit)
                .ToListAsync();

            await EnrichDealContactFieldsAsync(deals);
            return deals;
        }

        // GET DEAL BY ID
        public async Task<DealModel> GetByIdAsync(long id)
        {
            var deal = await _dealDb.Deals.FirstOrDefaultAsync(x => x.Id == id);

            if (deal == null)
            {
                throw new KeyNotFoundException($"Deal with ID {id} not found");
            }
            await EnrichDealContactFieldsAsync(new List<DealModel> { deal });
            return deal;
        }

        // ADD DEAL
        public async Task<DealModel> AddAsync(DealModel deal)
        {
            try
            {
                Console.WriteLine($"[DealsService.AddAsync] Adding deal: Name='{deal.Name}', AccountId={deal.AccountId}, CreatedBy='{deal.CreatedBy}'");

                var now = DateTime.UtcNow;
                deal.CreatedAt = now;
                deal.UpdatedAt = null;
                deal.LastAssignedAt = deal.LastAssignedAt ?? now;
                deal.DealStage = string.IsNullOrWhiteSpace(deal.DealStage) ? "New Lead" : deal.DealStage;
                deal.DealPipeline = string.IsNullOrWhiteSpace(deal.DealPipeline) ? "default pipeline" : deal.DealPipeline;
                deal.DealValueInBaseCurrency ??= deal.DealValue;
                deal.SalesOwner = string.IsNullOrWhiteSpace(deal.SalesOwner) ? deal.CreatedBy : deal.SalesOwner;

                // Set CreatedBy from JWT if missing (security)
                if (string.IsNullOrEmpty(deal.CreatedBy))
                    deal.CreatedBy = "API User"; // TODO: Inject IHttpContextAccessor

                // Only set ExpectedCloseDate if not provided (reasonable default)
                if (deal.ExpectedCloseDate == null)
                    deal.ExpectedCloseDate = now.AddDays(30);

                if (deal.AccountId.HasValue)
                {
                    var account = await _dealDb.Accounts
                        .AsNoTracking()
                        .FirstOrDefaultAsync(a => a.AccountId == deal.AccountId.Value);

                    if (account == null)
                    {
                        throw new ArgumentException($"Account with ID {deal.AccountId.Value} was not found.");
                    }

                    if (string.IsNullOrWhiteSpace(deal.AccountName))
                    {
                        deal.AccountName = account.Name;
                    }
                }

                if (deal.Id <= 0)
                {
                    deal.Id = DateTimeOffset.UtcNow.ToUnixTimeMilliseconds() * 1000 + new Random().Next(0, 999);
                }

                await SyncDealContactsAsync(deal);

                Console.WriteLine($"[DealsService.AddAsync] Before SaveChanges: deal.Id={deal.Id}");

                _dealDb.Deals.Add(deal);
                await _dealDb.SaveChangesAsync();

                Console.WriteLine($"[DealsService.AddAsync] SUCCESS: Saved deal ID={deal.Id}");
                return deal;
            }
            catch (Exception ex)
            {
                Console.WriteLine($"[DealsService.AddAsync] ERROR: {ex.Message}");
                Console.WriteLine($"[DealsService.AddAsync] Stack: {ex.StackTrace}");
                if (ex.InnerException != null)
                {
                    Console.WriteLine($"[DealsService.AddAsync] Inner Exception: {ex.InnerException.Message}");
                    if (ex.InnerException.InnerException != null)
                        Console.WriteLine($"[DealsService.AddAsync] Deep Inner: {ex.InnerException.InnerException.Message}");
                }
                throw; // Re-throw for controller to handle
            }
        }

        // UPDATE DEAL
        public async Task<DealModel> UpdateAsync(long id, DealModel deal)
        {
            var existing = await _dealDb.Deals.FirstOrDefaultAsync(x => x.Id == id);

            if (existing == null)
            {
                throw new KeyNotFoundException($"Deal with ID {id} not found");
            }
            existing.Name = deal.Name;
            existing.DealValue = deal.DealValue;
            existing.Currency = deal.Currency;
            existing.DealValueInBaseCurrency = deal.DealValueInBaseCurrency;
            existing.ExpectedCloseDate = deal.ExpectedCloseDate;
            existing.ClosedDate = deal.ClosedDate;
            existing.Probability = deal.Probability;
            existing.LastActivityType = deal.LastActivityType;
            existing.LastActivityDate = deal.LastActivityDate;
            existing.RecentNote = deal.RecentNote;
            existing.DealPipeline = deal.DealPipeline;
            existing.DealStage = deal.DealStage;
            existing.LostReason = deal.LostReason;
            existing.WonReasons = deal.WonReasons;
            existing.PaymentStatus = deal.PaymentStatus;
            existing.Territory = deal.Territory;
            existing.Type = deal.Type;
            existing.Source = deal.Source;
            existing.Campaign = deal.Campaign;
            existing.ForecastCategory = deal.ForecastCategory;
            existing.ActiveSalesSequences = deal.ActiveSalesSequences;
            existing.CompletedSalesSequences = deal.CompletedSalesSequences;
            existing.WebForm = deal.WebForm;
            existing.UpcomingActivities = deal.UpcomingActivities;
            existing.DealStageUpdatedAt = deal.DealStageUpdatedAt;
            existing.LastAssignedAt = deal.LastAssignedAt;
            existing.ExpectedDealValue = deal.ExpectedDealValue;
            existing.AccountId = deal.AccountId;
            existing.AccountName = deal.AccountName;
            existing.ContactId = deal.ContactId;
            existing.ContactName = deal.ContactName;
            existing.SalesOwnerId = deal.SalesOwnerId;
            existing.SalesOwner = deal.SalesOwner;
            existing.UpdatedBy = deal.UpdatedBy;
            existing.UpdatedById = deal.UpdatedById;

            existing.ContactIds = deal.ContactIds ?? new List<long>();
            await SyncDealContactsAsync(existing);

            existing.ImportID = deal.ImportID;
            existing.EnquiryNumber = deal.EnquiryNumber;
            existing.Tags = deal.Tags;
            existing.AgeInDays = deal.AgeInDays;
            existing.UpdatedAt = DateTime.UtcNow;
            await _dealDb.SaveChangesAsync();

            return existing;
        }

        // DELETE DEAL
        public async Task DeleteAsync(long id)
        {
            var deal = await _dealDb.Deals.FirstOrDefaultAsync(x => x.Id == id);

            if (deal == null)
            {
                throw new KeyNotFoundException($"Deal with ID {id} not found");
            }

            var relatedCallLogs = await _dealDb.CallLog
                .Where(c => c.DealId == id)
                .ToListAsync();
            if (relatedCallLogs.Any())
            {
                _dealDb.CallLog.RemoveRange(relatedCallLogs);
            }

            var relatedMeetings = await _dealDb.Meeting
                .Where(m => m.DealId == id)
                .ToListAsync();
            if (relatedMeetings.Any())
            {
                _dealDb.Meeting.RemoveRange(relatedMeetings);
            }

            _dealDb.Deals.Remove(deal);
            await _dealDb.SaveChangesAsync();
        }

        // GET ALL TAGS
        public async Task<List<string>> GetAllTagsAsync()
        {
            var tags = await _dealDb.Deals
                .Where(d => !string.IsNullOrEmpty(d.Tags))
                .Select(d => d.Tags)
                .ToListAsync();

            return tags
                .SelectMany(t => t.Split(',', StringSplitOptions.RemoveEmptyEntries))
                .Select(t => t.Trim())
                .Distinct()
                .ToList();
        }

        // GET DEALS BY TAG
        public async Task<List<DealModel>> GetDealsByTagsAsync(string tags)
        {
            if (string.IsNullOrWhiteSpace(tags))
            {
                return new List<DealModel>();
            }
            var selectedTags = tags.Split(',')
                                   .Select(t => t.Trim())
                                   .ToList();

            var deals = await _dealDb.Deals
                .Where(d => !string.IsNullOrEmpty(d.Tags))
                .ToListAsync();

            return deals
                .Where(d => d.Tags.Split(',')
                    .Any(t => selectedTags.Contains(t.Trim())))
                .ToList();
        }

        // DEAL COUNT THIS WEEK
        public async Task<int> GetThisWeekDealCountAsync()
        {
            DateTime today = DateTime.Today;
            int diff = (int)today.DayOfWeek - 1;
            if (diff < 0) diff = 6;

            DateTime weekStart = today.AddDays(-diff);
            DateTime weekEnd = weekStart.AddDays(7);

            return await _dealDb.Deals
                .Where(d => d.CreatedAt >= weekStart && d.CreatedAt < weekEnd)
                .CountAsync();
        }

        // DEALS FOR LAST 3 WEEKS
        public async Task<List<int>> GetDealsForAllWeeksAsync()
        {
            var deals = await _dealDb.Deals.ToListAsync();

            DateTime today = DateTime.Today;
            int diff = (int)today.DayOfWeek - 1;
            if (diff < 0) diff = 6;

            DateTime currentWeekStart = today.AddDays(-diff);
            DateTime lastWeekStart = currentWeekStart.AddDays(-7);
            DateTime twoWeeksAgoStart = currentWeekStart.AddDays(-14);

            int twoWeeksAgo = deals.Count(d => d.CreatedAt >= twoWeeksAgoStart && d.CreatedAt < lastWeekStart);
            int lastWeek = deals.Count(d => d.CreatedAt >= lastWeekStart && d.CreatedAt < currentWeekStart);
            int currentWeek = deals.Count(d => d.CreatedAt >= currentWeekStart);

            return new List<int> { twoWeeksAgo, lastWeek, currentWeek };
        }

        // GET DEALS BY DEAL PIPELINE
        public async Task<List<DealModel>> GetByPipelineAsync(string pipeline)
        {
            if (string.IsNullOrWhiteSpace(pipeline))
            {
                Console.WriteLine("[DealsService.GetByPipelineAsync] Pipeline is null/empty, returning empty list");
                return new List<DealModel>();
            }

            try
            {
                Console.WriteLine($"[DealsService.GetByPipelineAsync] Filtering deals by pipeline: '{pipeline}'");

                // Case-insensitive comparison for pipeline
                var deals = await _dealDb.Deals
                    .Where(d => d.DealPipeline.ToLower() == pipeline.ToLower())
                    .OrderByDescending(d => d.UpdatedAt ?? d.CreatedAt)
                    .ThenByDescending(d => d.CreatedAt)
                    .ToListAsync();

                await EnrichDealContactFieldsAsync(deals);
                Console.WriteLine($"[DealsService.GetByPipelineAsync] Found {deals.Count} deals for pipeline '{pipeline}'");
                return deals;
            }
            catch (Exception ex)
            {
                Console.WriteLine($"[DealsService.GetByPipelineAsync] Error: {ex.Message}");
                throw;
            }
        }

        /// <summary>
        /// Updates existing deals from an Excel/CSV file with columns DealId (or Id) and ContactId.
        /// ContactName is resolved from the Contacts table (FirstName + LastName).
        /// </summary>
        public async Task<DealContactLinkImportResult> ImportContactLinksAsync(
            IFormFile file,
            CancellationToken ct = default)
        {
            var sw = Stopwatch.StartNew();
            var rowErrors = new List<string>();

            if (file is null || file.Length == 0)
            {
                return new DealContactLinkImportResult(
                    false, 0, 0, sw.Elapsed, "File is empty or missing.");
            }

            var ext = Path.GetExtension(file.FileName);
            if (!IsSupportedImportExtension(ext))
            {
                return new DealContactLinkImportResult(
                    false, 0, 0, sw.Elapsed,
                    $"Unsupported file type '{ext}'. Use .xlsx, .xlsb, .xls, or .csv.");
            }

            await using var stream = file.OpenReadStream();
            using var reader = await OpenImportReaderAsync(stream, ext, ct);

            // Sylvan: row 1 is headers (GetName); Read() starts at first data row — do not Read() before mapping.
            if (reader.FieldCount == 0)
            {
                return new DealContactLinkImportResult(
                    false, 0, 0, sw.Elapsed, "File has no columns.");
            }

            if (!TryMapDealContactHeaders(reader, out var dealCol, out var contactCol, out var headerError))
            {
                return new DealContactLinkImportResult(
                    false, 0, 0, sw.Elapsed, headerError);
            }

            var rows = new List<(long DealId, long ContactId)>();
            var rowNum = 1;

            while (reader.Read())
            {
                rowNum++;
                ct.ThrowIfCancellationRequested();

                var dealRaw = GetCellString(reader, dealCol);
                var contactRaw = GetCellString(reader, contactCol);

                if (string.IsNullOrWhiteSpace(dealRaw) && string.IsNullOrWhiteSpace(contactRaw))
                {
                    continue;
                }

                if (!TryParseInt64(dealRaw, out var dealId) || dealId <= 0)
                {
                    rowErrors.Add($"Row {rowNum}: invalid Deal Id '{dealRaw}'.");
                    continue;
                }

                if (!TryParseInt64(contactRaw, out var contactId) || contactId <= 0)
                {
                    rowErrors.Add($"Row {rowNum}: invalid Contact Id '{contactRaw}'.");
                    continue;
                }

                rows.Add((dealId, contactId));
            }

            if (rows.Count == 0)
            {
                return new DealContactLinkImportResult(
                    false, 0, rowErrors.Count, sw.Elapsed,
                    rowErrors.Count > 0
                        ? "No valid rows to import."
                        : "No data rows found. Add at least one row under the header with DealId and ContactId values.",
                    rowErrors);
            }

            var dealIds = rows.Select(r => r.DealId).Distinct().ToList();
            var contactIds = rows.Select(r => r.ContactId).Distinct().ToList();

            var dealsById = await _dealDb.Deals
                .Where(d => dealIds.Contains(d.Id))
                .ToDictionaryAsync(d => d.Id, ct);

            var contactsById = await _dealDb.Contacts
                .AsNoTracking()
                .Where(c => contactIds.Contains(c.ContactId))
                .ToDictionaryAsync(c => c.ContactId, ct);

            var now = DateTime.UtcNow;
            var updated = 0;
            var skipped = 0;

            foreach (var (dealId, contactId) in rows)
            {
                if (!dealsById.TryGetValue(dealId, out var deal))
                {
                    skipped++;
                    rowErrors.Add($"Deal Id {dealId}: not found in database.");
                    continue;
                }

                if (!contactsById.TryGetValue(contactId, out var contact))
                {
                    skipped++;
                    rowErrors.Add($"Deal Id {dealId}: Contact Id {contactId} not found.");
                    continue;
                }

                var linkExists = await _dealDb.DealContactLinks
                    .AnyAsync(x => x.DealId == dealId && x.ContactId == contactId, ct);

                if (!linkExists)
                {
                    _dealDb.DealContactLinks.Add(new DealContactLinkModel
                    {
                        DealId = dealId,
                        ContactId = contactId
                    });
                }

                if (!deal.ContactId.HasValue)
                {
                    deal.ContactId = contactId;
                    deal.ContactName = FormatContactDisplayName(contact);
                }
                deal.UpdatedAt = now;
                updated++;
            }

            if (updated > 0)
            {
                await _dealDb.SaveChangesAsync(ct);
            }
            sw.Stop();
            return new DealContactLinkImportResult(
                updated > 0 || skipped == 0,
                updated,
                skipped,
                sw.Elapsed,
                updated == 0 && rowErrors.Count > 0 ? "No deals were updated." : null,
                rowErrors.Count > 0 ? rowErrors : null);
        }

        private async Task SyncDealContactsAsync(DealModel deal)
        {
            if (deal == null) return;

            var contactIds = (deal.ContactIds ?? new List<long>())
                .Where(id => id > 0)
                .Distinct()
                .ToList();

            if (contactIds.Count == 0 && deal.ContactId.HasValue && deal.ContactId.Value > 0)
            {
                contactIds.Add(deal.ContactId.Value);
            }

            if (contactIds.Count == 0)
            {
                deal.ContactId = null;
                deal.ContactName = null;
                deal.ContactIds = new List<long>();
                deal.ContactNames = new List<string>();

                var currentLinks = await _dealDb.DealContactLinks
                    .Where(x => x.DealId == deal.Id)
                    .ToListAsync();
                if (currentLinks.Count > 0)
                {
                    _dealDb.DealContactLinks.RemoveRange(currentLinks);
                }
                return;
            }

            var contacts = await _dealDb.Contacts
                .AsNoTracking()
                .Where(c => contactIds.Contains(c.ContactId))
                .ToListAsync();

            var missingIds = contactIds.Except(contacts.Select(c => c.ContactId)).ToList();
            if (missingIds.Count > 0)
            {
                throw new ArgumentException($"Contact ID(s) {string.Join(", ", missingIds)} were not found.");
            }

            var orderedContacts = contactIds
                .Select(id => contacts.First(c => c.ContactId == id))
                .ToList();

            deal.ContactIds = orderedContacts.Select(c => c.ContactId).ToList();
            deal.ContactNames = orderedContacts
                .Select(FormatContactDisplayName)
                .Where(name => !string.IsNullOrWhiteSpace(name))
                .Select(name => name!)
                .ToList();
            deal.ContactId = orderedContacts[0].ContactId;
            deal.ContactName = string.Join(", ", deal.ContactNames);

            var existingLinks = await _dealDb.DealContactLinks
                .Where(x => x.DealId == deal.Id)
                .ToListAsync();

            var existingIds = existingLinks.Select(x => x.ContactId).ToHashSet();
            var nextIds = contactIds.ToHashSet();

            var linksToRemove = existingLinks.Where(x => !nextIds.Contains(x.ContactId)).ToList();
            if (linksToRemove.Count > 0)
            {
                _dealDb.DealContactLinks.RemoveRange(linksToRemove);
            }

            foreach (var contactId in contactIds.Where(id => !existingIds.Contains(id)))
            {
                _dealDb.DealContactLinks.Add(new DealContactLinkModel
                {
                    DealId = deal.Id,
                    ContactId = contactId
                });
            }
        }

        private async Task EnrichDealContactFieldsAsync(List<DealModel> deals)
        {
            if (deals.Count == 0) return;

            var dealIds = deals.Select(d => d.Id).ToList();
            var links = await _dealDb.DealContactLinks
                .AsNoTracking()
                .Where(x => dealIds.Contains(x.DealId))
                .Join(
                    _dealDb.Contacts.AsNoTracking(),
                    link => link.ContactId,
                    contact => contact.ContactId,
                    (link, contact) => new
                    {
                        link.DealId,
                        contact.ContactId,
                        ContactName = FormatContactDisplayName(contact)
                    })
                .ToListAsync();

            var linksByDeal = links
                .GroupBy(x => x.DealId)
                .ToDictionary(g => g.Key, g => g.ToList());

            foreach (var deal in deals)
            {
                if (linksByDeal.TryGetValue(deal.Id, out var dealLinks) && dealLinks.Count > 0)
                {
                    deal.ContactIds = dealLinks.Select(x => x.ContactId).Distinct().ToList();
                    deal.ContactNames = dealLinks
                        .Select(x => x.ContactName)
                        .Where(name => !string.IsNullOrWhiteSpace(name))
                        .Select(name => name!)
                        .Distinct()
                        .ToList();
                    deal.ContactId = deal.ContactIds.FirstOrDefault();
                    deal.ContactName = string.Join(", ", deal.ContactNames);
                }
                else if (deal.ContactId.HasValue)
                {
                    deal.ContactIds = new List<long> { deal.ContactId.Value };
                    deal.ContactNames = string.IsNullOrWhiteSpace(deal.ContactName)
                        ? new List<string>()
                        : new List<string> { deal.ContactName };
                }
            }
        }

        private static string? FormatContactDisplayName(ContactModel contact)
        {
            if (contact == null) return null;
            var full = $"{contact.FirstName} {contact.LastName}".Trim();
            if (!string.IsNullOrEmpty(full))
            {
                return full;
            }
            return string.IsNullOrWhiteSpace(contact.Account) ? null : contact.Account.Trim();
        }

        private static bool IsSupportedImportExtension(string ext) =>
            ext.Equals(".xlsx", StringComparison.OrdinalIgnoreCase)
            || ext.Equals(".xlsb", StringComparison.OrdinalIgnoreCase)
            || ext.Equals(".xls", StringComparison.OrdinalIgnoreCase)
            || ext.Equals(".csv", StringComparison.OrdinalIgnoreCase);

        private static async Task<IDataReader> OpenImportReaderAsync(Stream stream,string ext, CancellationToken ct)
        {
            if (ext.Equals(".csv", StringComparison.OrdinalIgnoreCase))
            {
                var textReader = new StreamReader(
                    stream,
                    Encoding.UTF8,
                    detectEncodingFromByteOrderMarks: true,
                    bufferSize: 65_536,
                    leaveOpen: true);

                var opts = new CsvDataReaderOptions
                {
                    HasHeaders = true,
                    BufferSize = 65_536,
                };

                return await CsvDataReader.CreateAsync(textReader, opts);
            }

            var type = ext.ToLowerInvariant() switch
            {
                ".xlsx" => ExcelWorkbookType.ExcelXml,
                ".xlsb" => ExcelWorkbookType.ExcelBinary,
                ".xls" => ExcelWorkbookType.Excel,
                _ => throw new NotSupportedException($"Unsupported format '{ext}'.")
            };
            return ExcelDataReader.Create(stream, type);
        }

        private static bool TryMapDealContactHeaders(IDataReader reader,out int dealCol,out int contactCol,out string? error)
        {
            dealCol = -1;
            contactCol = -1;
            error = null;

            for (int i = 0; i < reader.FieldCount; i++)
            {
                var h = reader.GetName(i)?.Trim() ?? "";
                if (h.Length == 0) continue;

                if (IsDealIdHeader(h))
                {
                    dealCol = i;
                }
                else if (IsContactIdHeader(h))
                {
                    contactCol = i;
                }
            }

            if (dealCol < 0 || contactCol < 0)
            {
                var found = new List<string>();
                for (int i = 0; i < reader.FieldCount; i++)
                {
                    var name = reader.GetName(i)?.Trim();
                    if (!string.IsNullOrEmpty(name))
                    {
                        found.Add(name);
                    }
                }
                var cols = found.Count > 0 ? string.Join(", ", found) : "(none)";
                error =
                    $"Required columns not found. Need DealId (or Id) and ContactId. Columns in file: {cols}.";
                return false;
            }
            return true;
        }

        private static bool IsDealIdHeader(string h)
        {
            var n = NormalizeHeader(h);
            return n is "id" or "dealid" or "dealsid";
        }

        private static bool IsContactIdHeader(string h)
        {
            var n = NormalizeHeader(h);
            return n is "contactid" or "contactsid";
        }

        private static string NormalizeHeader(string h) =>
            h.Replace(" ", "", StringComparison.Ordinal)
                .Replace("_", "", StringComparison.Ordinal)
                .ToLowerInvariant();

        private static string? GetCellString(IDataReader reader, int col)
        {
            if (col < 0 || reader.IsDBNull(col)) return null;
            var v = reader.GetValue(col);
            return v switch
            {
                null or DBNull => null,
                string s => s.Trim(),
                double d when Math.Abs(d - Math.Round(d)) < 0.0001 => ((long)Math.Round(d)).ToString(CultureInfo.InvariantCulture),
                float f when Math.Abs(f - Math.Round(f)) < 0.0001 => ((long)Math.Round(f)).ToString(CultureInfo.InvariantCulture),
                decimal m when m == decimal.Truncate(m) => ((long)m).ToString(CultureInfo.InvariantCulture),
                long l => l.ToString(CultureInfo.InvariantCulture),
                int i => i.ToString(CultureInfo.InvariantCulture),
                _ => v.ToString()?.Trim()
            };
        }

        private static bool TryParseInt64(string? raw, out long value)
        {
            value = 0;
            if (string.IsNullOrWhiteSpace(raw)) return false;
            raw = raw.Trim();
            if (long.TryParse(raw, NumberStyles.Integer, CultureInfo.InvariantCulture, out value))
                return true;
            if (double.TryParse(raw, NumberStyles.Float, CultureInfo.InvariantCulture, out var d)
                && Math.Abs(d - Math.Round(d)) < 0.0001)
            {
                value = (long)Math.Round(d);
                return true;
            }
            return false;
        }
        public async Task<List<DealModel>> GetByContactIdAsync(long contactId)
        {
            var linkedDealIds = await _dealDb.DealContactLinks
                .AsNoTracking()
                .Where(x => x.ContactId == contactId)
                .Select(x => x.DealId)
                .ToListAsync();

            var deals = await _dealDb.Deals
                .AsNoTracking()
                .Where(d => linkedDealIds.Contains(d.Id) || d.ContactId == contactId)
                .OrderByDescending(d => d.UpdatedAt ?? d.CreatedAt)
                .ToListAsync();

            await EnrichDealContactFieldsAsync(deals);
            return deals;
        }
    }
}
