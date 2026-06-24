using Elpis_CRM.Data;
using Elpis_CRM.Model;
using Microsoft.EntityFrameworkCore;
using System;
using System.Collections.Generic;
using System.Linq;
using System.Threading.Tasks;

namespace Elpis_CRM.Services
{
    public class AccountService
    {
        private readonly AppDbContext _accountDb;

        public AccountService(AppDbContext accountDb)
        {
            _accountDb = accountDb;
        }

        // Get all accounts with pagination (optional server-side search)
        public async Task<(List<AccountModel> Items, int TotalCount)> GetAllAsync(
            int page = 1, int pageSize = 150, string? search = null)
        {
            page     = Math.Max(page, 1);
            pageSize = Math.Clamp(pageSize, 1, 500);

            var query = _accountDb.Accounts.AsNoTracking();

            // Token-based search: each word must match at least one field (AND across tokens).
            if (!string.IsNullOrWhiteSpace(search) && search.Trim().Length >= 2)
            {
                var tokens = search.Trim().ToLowerInvariant()
                    .Split(' ', StringSplitOptions.RemoveEmptyEntries);
                foreach (var tok in tokens)
                {
                    var t = tok;
                    query = query.Where(a =>
                        (a.Name        != null && a.Name.ToLower().Contains(t))        ||
                        (a.Phone       != null && a.Phone.ToLower().Contains(t))       ||
                        (a.DisplayPhone!= null && a.DisplayPhone.ToLower().Contains(t))||
                        (a.Website     != null && a.Website.ToLower().Contains(t))     ||
                        (a.City        != null && a.City.ToLower().Contains(t))        ||
                        (a.Country     != null && a.Country.ToLower().Contains(t))     ||
                        (a.SalesOwner  != null && a.SalesOwner.ToLower().Contains(t))  ||
                        (a.Territory   != null && a.Territory.ToLower().Contains(t))   ||
                        (a.Tags        != null && a.Tags.ToLower().Contains(t))        ||
                        (a.IndustryType!= null && a.IndustryType.ToLower().Contains(t)));
                }
            }

            var totalCount = await query.CountAsync();

            var items = await query
                .OrderByDescending(a => a.CreatedAt ?? DateTime.MinValue)
                .Skip((page - 1) * pageSize)
                .Take(pageSize)
                .ToListAsync();

            return (items, totalCount);
        }

        /// <summary>
        /// Typeahead search for accounts (min 2 characters). Returns up to <paramref name="limit"/> rows.
        /// </summary>
        public async Task<List<AccountModel>> SearchAsync(string? q, int limit = 50)
        {
            if (string.IsNullOrWhiteSpace(q) || q.Trim().Length < 2)
                return new List<AccountModel>();

            limit = Math.Clamp(limit, 1, 100);
            var term = q.Trim().ToLowerInvariant();
            var isNumeric = long.TryParse(term, out var idVal);

            var query = _accountDb.Accounts.AsNoTracking().AsQueryable();

            if (isNumeric)
            {
                query = query.Where(a =>
                    a.AccountId == idVal ||
                    (a.Name != null && a.Name.ToLower().Contains(term)) ||
                    (a.Phone != null && a.Phone.ToLower().Contains(term)) ||
                    (a.DisplayPhone != null && a.DisplayPhone.ToLower().Contains(term)) ||
                    (a.Website != null && a.Website.ToLower().Contains(term)));
            }
            else
            {
                var tokens = term.Split(' ', StringSplitOptions.RemoveEmptyEntries);
                foreach (var tok in tokens)
                {
                    var t = tok;
                    query = query.Where(a =>
                        (a.Name        != null && a.Name.ToLower().Contains(t))        ||
                        (a.Phone       != null && a.Phone.ToLower().Contains(t))       ||
                        (a.DisplayPhone!= null && a.DisplayPhone.ToLower().Contains(t))||
                        (a.Website     != null && a.Website.ToLower().Contains(t))     ||
                        (a.Territory   != null && a.Territory.ToLower().Contains(t))   ||
                        (a.SalesOwner  != null && a.SalesOwner.ToLower().Contains(t))  ||
                        (a.IndustryType!= null && a.IndustryType.ToLower().Contains(t)));
                }
            }

            return await query
                .OrderBy(a => a.Name)
                .Take(limit)
                .ToListAsync();
        }

        // Get all unique tags
        public async Task<List<string>> GetAllTagsAsync()
        {
            var tags = await _accountDb.Accounts
                .Where(a => !string.IsNullOrEmpty(a.Tags))
                .Select(a => a.Tags)
                .ToListAsync();

            return tags
                .SelectMany(t => t.Split(',', StringSplitOptions.RemoveEmptyEntries))
                .Select(t => t.Trim())
                .Distinct()
                .ToList();
        }

        // Get accounts by tags
        public async Task<List<AccountModel>> GetAccountsByTagsAsync(string tags)
        {
            var selectedTags = tags.Split(',', StringSplitOptions.RemoveEmptyEntries)
                                   .Select(t => t.Trim())
                                   .ToList();

            var accounts = await _accountDb.Accounts
                .Where(a => !string.IsNullOrEmpty(a.Tags))
                .ToListAsync();

            return accounts
                .Where(a => a.Tags.Split(',', StringSplitOptions.RemoveEmptyEntries)
                                  .Select(t => t.Trim())
                                  .Any(tag => selectedTags.Contains(tag)))
                .ToList();
        }

        // Get account by Id
        public async Task<AccountModel?> GetByIdAsync(long accountId)
        {
            return await _accountDb.Accounts
                .FirstOrDefaultAsync(a => a.AccountId == accountId);
        }

        // Add new account (handles both manual entry and imported accounts)
        public async Task<AccountModel> AddAsync(AccountModel account)
        {
            var now = DateTime.UtcNow;

            // Always ensure AccountId is set — never allow NULL insert
            if (account.AccountId <= 0)
            {
                account.AccountId = DateTimeOffset.UtcNow.ToUnixTimeMilliseconds() * 1000 + new Random().Next(0, 999);
            }
            else
            {
                // Imported account with pre-defined ID — check if it already exists
                var existingAccount = await _accountDb.Accounts
                    .FirstOrDefaultAsync(a => a.AccountId == account.AccountId);

                if (existingAccount != null)
                {
                    return await UpdateAsync(account.AccountId, account);
                }
            }

            account.CreatedAt = now;
            account.UpdatedAt = now;
            account.LastContactedTime = account.LastContactedTime ?? now;
            account.LastActivityDate = account.LastActivityDate ?? now;

            _accountDb.Accounts.Add(account);
            await _accountDb.SaveChangesAsync();

            return account;
        }

        // Bulk import accounts with pre-defined IDs
        public async Task<BulkImportResult> BulkImportAsync(List<AccountModel> accounts)
        {
            var result = new BulkImportResult
            {
                TotalRecords = accounts.Count,
                InsertedRecords = new List<AccountModel>(),
                UpdatedRecords = new List<AccountModel>(),
                FailedRecords = new List<ImportFailure>()
            };

            var now = DateTime.UtcNow;

            foreach (var account in accounts)
            {
                try
                {
                    // Validate account has an ID
                    if (account.AccountId <= 0)
                    {
                        result.FailedRecords.Add(new ImportFailure
                        {
                            AccountId = account.AccountId,
                            Name = account.Name,
                            Reason = "Invalid or missing AccountId for import"
                        });
                        continue;
                    }

                    // Check if account already exists
                    var existingAccount = await _accountDb.Accounts
                        .FirstOrDefaultAsync(a => a.AccountId == account.AccountId);

                    if (existingAccount != null)
                    {
                        // Update existing account
                        existingAccount.Name = account.Name;
                        existingAccount.NumberOfEmployees = account.NumberOfEmployees;
                        existingAccount.AnnualRevenue = account.AnnualRevenue;
                        existingAccount.Website = account.Website;
                        existingAccount.Phone = account.Phone;
                        existingAccount.DisplayPhone = account.DisplayPhone;
                        existingAccount.Address = account.Address;
                        existingAccount.City = account.City;
                        existingAccount.State = account.State;
                        existingAccount.Zipcode = account.Zipcode;
                        existingAccount.Country = account.Country;
                        existingAccount.Facebook = account.Facebook;
                        existingAccount.Twitter = account.Twitter;
                        existingAccount.LinkedIn = account.LinkedIn;
                        existingAccount.LastContactedMode = account.LastContactedMode;
                        existingAccount.LastContactedTime = account.LastContactedTime ?? now;
                        existingAccount.LastActivityType = account.LastActivityType;
                        existingAccount.LastActivityDate = account.LastActivityDate ?? now;
                        existingAccount.RecentNote = account.RecentNote;
                        existingAccount.IndustryType = account.IndustryType;
                        existingAccount.BusinessType = account.BusinessType;
                        existingAccount.Territory = account.Territory;
                        existingAccount.ActiveSalesSequences = account.ActiveSalesSequences;
                        existingAccount.CompletedSalesSequences = account.CompletedSalesSequences;
                        existingAccount.ParentAccountId = account.ParentAccountId;
                        existingAccount.ParentAccount = account.ParentAccount;
                        existingAccount.SalesOwnerId = account.SalesOwnerId;
                        existingAccount.SalesOwner = account.SalesOwner;
                        existingAccount.ImportID = account.ImportID;
                        existingAccount.Tags = account.Tags;
                        existingAccount.LastAssignedAt = account.LastAssignedAt;

                        existingAccount.UpdatedAt = now;

                        result.UpdatedRecords.Add(existingAccount);
                    }
                    else
                    {
                        // Insert new account with provided ID
                        account.CreatedAt = now;
                        account.UpdatedAt = now;
                        account.LastContactedTime = account.LastContactedTime ?? now;
                        account.LastActivityDate = account.LastActivityDate ?? now;

                        _accountDb.Accounts.Add(account);
                        result.InsertedRecords.Add(account);
                    }
                }
                catch (Exception ex)
                {
                    result.FailedRecords.Add(new ImportFailure
                    {
                        AccountId = account.AccountId,
                        Name = account.Name,
                        Reason = ex.Message
                    });
                }
            }

            // Save all changes
            await _accountDb.SaveChangesAsync();

            result.SuccessCount = result.InsertedRecords.Count + result.UpdatedRecords.Count;
            result.FailureCount = result.FailedRecords.Count;

            return result;
        }

        // Get accounts by CreatedAt date (UTC based)
        public async Task<List<AccountModel>> GetAccountsByCreatedAtAsync(DateTime createdAt)
        {
            var start = createdAt.Date;
            var end = start.AddDays(1);

            return await _accountDb.Accounts
                .AsNoTracking()
                .Where(a => a.CreatedAt >= start && a.CreatedAt < end)
                .ToListAsync();
        }
        // Update account
        public async Task<AccountModel?> UpdateAsync(long accountId, AccountModel updatedAccount)
        {
            var existing = await _accountDb.Accounts
                .FirstOrDefaultAsync(a => a.AccountId == accountId);

            if (existing == null)
            {
                return null;
            }

            existing.Name = updatedAccount.Name;
            existing.NumberOfEmployees = updatedAccount.NumberOfEmployees;
            existing.AnnualRevenue = updatedAccount.AnnualRevenue;
            existing.Website = updatedAccount.Website;
            existing.Phone = updatedAccount.Phone;
            existing.DisplayPhone = updatedAccount.DisplayPhone;
            existing.Address = updatedAccount.Address;
            existing.City = updatedAccount.City;
            existing.State = updatedAccount.State;
            existing.Zipcode = updatedAccount.Zipcode;
            existing.Country = updatedAccount.Country;
            existing.Facebook = updatedAccount.Facebook;
            existing.Twitter = updatedAccount.Twitter;
            existing.LinkedIn = updatedAccount.LinkedIn;
            existing.LastContactedMode = updatedAccount.LastContactedMode;
            existing.LastContactedTime = updatedAccount.LastContactedTime;
            existing.LastActivityType = updatedAccount.LastActivityType;
            existing.LastActivityDate = updatedAccount.LastActivityDate;
            existing.RecentNote = updatedAccount.RecentNote;
            existing.IndustryType = updatedAccount.IndustryType;
            existing.BusinessType = updatedAccount.BusinessType;
            existing.Territory = updatedAccount.Territory;
            existing.ActiveSalesSequences = updatedAccount.ActiveSalesSequences;
            existing.CompletedSalesSequences = updatedAccount.CompletedSalesSequences;
            existing.ParentAccountId = updatedAccount.ParentAccountId;
            existing.ParentAccount = updatedAccount.ParentAccount;
            existing.SalesOwnerId = updatedAccount.SalesOwnerId;
            existing.SalesOwner = updatedAccount.SalesOwner;
            existing.ImportID = updatedAccount.ImportID;
            existing.Tags = updatedAccount.Tags;
            existing.LastAssignedAt = updatedAccount.LastAssignedAt;

            var now = DateTime.UtcNow;
            existing.UpdatedAt = now;

            await _accountDb.SaveChangesAsync();
            return existing;
        }

        // Delete account
        public async Task<bool> DeleteAsync(long accountId)
        {
            var account = await _accountDb.Accounts
                .FirstOrDefaultAsync(a => a.AccountId == accountId);

            if (account == null)
            {
                return false;
            }

            // Handle foreign key constraint: Delete or orphan related Deals first
            var relatedDeals = await _accountDb.Deals
                .Where(d => d.AccountId == accountId)
                .ToListAsync();

            if (relatedDeals.Any())
            {
                // Delete related Deals (cascading delete)
                _accountDb.Deals.RemoveRange(relatedDeals);
            }

            _accountDb.Accounts.Remove(account);
            await _accountDb.SaveChangesAsync();

            return true;
        }

        public async Task DeleteAllAsync()
        {
            try
            {
                // First, delete all related Deals to handle foreign key constraints
                var allDeals = await _accountDb.Deals.ToListAsync();
                if (allDeals.Any())
                {
                    _accountDb.Deals.RemoveRange(allDeals);
                    await _accountDb.SaveChangesAsync();
                }

                // Then delete all Accounts
                var allAccounts = await _accountDb.Accounts.ToListAsync();
                if (allAccounts.Any())
                {
                    _accountDb.Accounts.RemoveRange(allAccounts);
                    await _accountDb.SaveChangesAsync();
                }
            }
            catch (Exception ex)
            {
                // Log error or rethrow for controller to handle
                throw new InvalidOperationException("Error deleting all accounts", ex);
            }
        }

        // Bulk delete multiple accounts by IDs
        public async Task<int> DeleteMultipleAsync(List<long> accountIds)
        {
            try
            {
                if (accountIds == null || !accountIds.Any())
                {
                    return 0;
                }

                // Delete related Deals for all accounts first
                var relatedDeals = await _accountDb.Deals
                    .Where(d => accountIds.Contains(d.AccountId.Value))
                    .ToListAsync();

                if (relatedDeals.Any())
                {
                    _accountDb.Deals.RemoveRange(relatedDeals);
                    await _accountDb.SaveChangesAsync();
                }

                // Delete all the accounts
                var accountsToDelete = await _accountDb.Accounts
                    .Where(a => accountIds.Contains(a.AccountId))
                    .ToListAsync();

                int countToDelete = accountsToDelete.Count;
                if (countToDelete > 0)
                {
                    _accountDb.Accounts.RemoveRange(accountsToDelete);
                    await _accountDb.SaveChangesAsync();
                }

                return countToDelete;
            }
            catch (Exception ex)
            {
                throw new InvalidOperationException("Error deleting multiple accounts", ex);
            }
        }

        // Get next available AccountId (useful for UI to show next ID)
        public Task<long> GetNextAccountIdAsync()
        {
            return Task.FromResult(DateTimeOffset.UtcNow.ToUnixTimeMilliseconds());
        }
    }

    // Helper classes for bulk import result
    public class BulkImportResult
    {
        public int TotalRecords { get; set; }
        public int SuccessCount { get; set; }
        public int FailureCount { get; set; }
        public List<AccountModel> InsertedRecords { get; set; } = new List<AccountModel>();
        public List<AccountModel> UpdatedRecords { get; set; } = new List<AccountModel>();
        public List<ImportFailure> FailedRecords { get; set; } = new List<ImportFailure>();
    }

    public class ImportFailure
    {
        public long AccountId { get; set; }
        public string? Name { get; set; }
        public string? Reason { get; set; }
    }
}
