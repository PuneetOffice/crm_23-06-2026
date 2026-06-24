using Elpis_CRM.Data;
using Elpis_CRM.Model;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;

namespace Elpis_CRM.Controllers
{
    [ApiController]
    [Route("api/[controller]")]

    public class SearchController : ControllerBase
    {
        private readonly AppDbContext _db;
        private readonly ILogger<SearchController> _logger;

        public SearchController(AppDbContext db, ILogger<SearchController> logger)
        {
            _db = db;
            _logger = logger;
        }

        [HttpGet]
        [AllowAnonymous]
        public async Task<IActionResult> Search(
            [FromQuery] string query,
            [FromQuery] string? contactStatus,
            [FromQuery] string? contactTerritory,
            [FromQuery] string? contactTags,
            [FromQuery] long? contactSalesOwnerId,
            [FromQuery] string? contactSalesOwner,

            [FromQuery] string? accountTerritory,
            [FromQuery] string? accountTags,
            [FromQuery] long? accountSalesOwnerId,
            [FromQuery] string? accountSalesOwner,
            [FromQuery] string? dealStage,
            [FromQuery] string? dealTerritory,
            [FromQuery] string? dealTags,
            [FromQuery] long? dealSalesOwnerId,
            [FromQuery] string? dealSalesOwner,

            [FromQuery] string? productCategory,
            [FromQuery] string? productActive)
        {
            try
            {
                _logger.LogDebug("Search requested: {Query}", query);

                if (string.IsNullOrWhiteSpace(query) || query.Trim().Length < 2)
                {
                    return Ok(new List<object>());
                }

                var trimmedQuery = query.Trim();
                var loweredQuery = trimmedQuery.ToLowerInvariant();
                var results = new List<object>();

                // Token-based: each word in the query must match at least one field.
                // "Appa Rao" → token "appa" must match some field AND "rao" must match some field.
                var queryTokens = loweredQuery.Split(' ', StringSplitOptions.RemoveEmptyEntries);
                var contactsQuery = _db.Contacts.AsNoTracking();
                foreach (var tok in queryTokens)
                {
                    var t = tok; // capture loop variable for lambda
                    contactsQuery = contactsQuery.Where(c =>
                        (c.FirstName != null && c.FirstName.ToLower().Contains(t)) ||
                        (c.LastName  != null && c.LastName.ToLower().Contains(t))  ||
                        (c.WorkEmail != null && c.WorkEmail.ToLower().Contains(t)) ||
                        (c.WorkPhone != null && c.WorkPhone.ToLower().Contains(t)) ||
                        (c.Mobile    != null && c.Mobile.ToLower().Contains(t))    ||
                        (c.Account   != null && c.Account.ToLower().Contains(t))   ||
                        (c.EnquiryNo != null && c.EnquiryNo.ToLower().Contains(t)));
                }

                if (!string.IsNullOrWhiteSpace(contactStatus))
                {
                    var v = contactStatus.Trim().ToLowerInvariant();
                    contactsQuery = contactsQuery.Where(c => c.Status != null && c.Status.ToLower().Contains(v));
                }

                if (!string.IsNullOrWhiteSpace(contactTerritory))
                {
                    var v = contactTerritory.Trim().ToLowerInvariant();
                    contactsQuery = contactsQuery.Where(c => c.Territory != null && c.Territory.ToLower().Contains(v));
                }

                if (!string.IsNullOrWhiteSpace(contactTags))
                {
                    var v = contactTags.Trim().ToLowerInvariant();
                    contactsQuery = contactsQuery.Where(c => c.Tags != null && c.Tags.ToLower().Contains(v));
                }

                if (contactSalesOwnerId.HasValue)
                {
                    var v = contactSalesOwnerId.Value;
                    contactsQuery = contactsQuery.Where(c => c.SalesOwnerId == v);
                }

                if (!string.IsNullOrWhiteSpace(contactSalesOwner))
                {
                    var v = contactSalesOwner.Trim().ToLowerInvariant();
                    contactsQuery = contactsQuery.Where(c => c.SalesOwner != null && c.SalesOwner.ToLower().Contains(v));
                }

                var contacts = await contactsQuery
                    .Select(c => new
                    {
                        c.ContactId,
                        c.FirstName,
                        c.LastName,
                        c.WorkEmail,
                        c.WorkPhone,
                        c.Mobile,
                        c.JobTitle,
                        c.Account,
                        c.Status,
                        c.Territory,
                        c.Tags,
                        c.EnquiryNo
                    })
                    .ToListAsync();

                // Rank: exact full-name match → starts-with name → starts-with email → rest
                var contactsRanked = contacts
                    .OrderByDescending(c =>
                    {
                        var full  = $"{c.FirstName} {c.LastName}".Trim().ToLowerInvariant();
                        var email = (c.WorkEmail ?? "").ToLowerInvariant();
                        if (full == loweredQuery)                    return 4;
                        if (full.StartsWith(loweredQuery))           return 3;
                        if (email.StartsWith(loweredQuery))          return 2;
                        return 1;
                    })
                    .ToList();

                foreach (var c in contactsRanked)
                {
                    results.Add(BuildResult(
                        c.ContactId,
                        "contact",
                        $"{c.FirstName} {c.LastName}".Trim(),
                        loweredQuery,
                        ("First Name", c.FirstName),
                        ("Last Name", c.LastName),
                        ("Email", c.WorkEmail),
                        ("Phone", c.WorkPhone ?? c.Mobile),
                        ("Job Title", c.JobTitle),
                        ("Account", c.Account),
                        ("Status", c.Status),
                        ("Territory", c.Territory),
                        ("Enquiry No", c.EnquiryNo),
                        ("Tags", c.Tags)));
                }

                var accountsQuery = _db.Accounts.AsNoTracking();
                foreach (var tok in queryTokens)
                {
                    var t = tok;
                    accountsQuery = accountsQuery.Where(a =>
                        (a.Name       != null && a.Name.ToLower().Contains(t))       ||
                        (a.Phone      != null && a.Phone.ToLower().Contains(t))      ||
                        (a.Website    != null && a.Website.ToLower().Contains(t))    ||
                        (a.City       != null && a.City.ToLower().Contains(t))       ||
                        (a.Country    != null && a.Country.ToLower().Contains(t))    ||
                        (a.SalesOwner != null && a.SalesOwner.ToLower().Contains(t)) ||
                        (a.Tags       != null && a.Tags.ToLower().Contains(t)));
                }

                if (!string.IsNullOrWhiteSpace(accountTerritory))
                {
                    var v = accountTerritory.Trim().ToLowerInvariant();
                    accountsQuery = accountsQuery.Where(a => a.Territory != null && a.Territory.ToLower().Contains(v));
                }

                if (!string.IsNullOrWhiteSpace(accountTags))
                {
                    var v = accountTags.Trim().ToLowerInvariant();
                    accountsQuery = accountsQuery.Where(a => a.Tags != null && a.Tags.ToLower().Contains(v));
                }

                if (accountSalesOwnerId.HasValue)
                {
                    var v = accountSalesOwnerId.Value;
                    accountsQuery = accountsQuery.Where(a => a.SalesOwnerId == v);
                }

                if (!string.IsNullOrWhiteSpace(accountSalesOwner))
                {
                    var v = accountSalesOwner.Trim().ToLowerInvariant();
                    accountsQuery = accountsQuery.Where(a => a.SalesOwner != null && a.SalesOwner.ToLower().Contains(v));
                }

                var accounts = await accountsQuery
                    .Select(a => new
                    {
                        a.AccountId,
                        a.Name,
                        a.Phone,
                        a.Website,
                        a.City,
                        a.Country,
                        a.IndustryType,
                        a.Territory,
                        a.SalesOwner,
                        a.Tags
                    })
                    .ToListAsync();

                // Rank: exact name match → starts-with name → starts-with phone → rest
                var accountsRanked = accounts
                    .OrderByDescending(a =>
                    {
                        var name  = (a.Name  ?? "").ToLowerInvariant();
                        var phone = (a.Phone ?? "").ToLowerInvariant();
                        if (name == loweredQuery)           return 4;
                        if (name.StartsWith(loweredQuery))  return 3;
                        if (phone.StartsWith(loweredQuery)) return 2;
                        return 1;
                    })
                    .ToList();

                foreach (var a in accountsRanked)
                {
                    results.Add(BuildResult(
                        a.AccountId,
                        "account",
                        a.Name,
                        loweredQuery,
                        ("Name", a.Name),
                        ("Phone", a.Phone),
                        ("Website", a.Website),
                        ("City", a.City),
                        ("Country", a.Country),
                        ("Industry", a.IndustryType),
                        ("Territory", a.Territory),
                        ("Sales Owner", a.SalesOwner),
                        ("Tags", a.Tags)));
                }

                var dealsQuery = _db.Deals.AsNoTracking();
                foreach (var tok in queryTokens)
                {
                    var t = tok;
                    dealsQuery = dealsQuery.Where(d =>
                        (d.Name        != null && d.Name.ToLower().Contains(t))        ||
                        (d.AccountName != null && d.AccountName.ToLower().Contains(t)) ||
                        (d.ContactName != null && d.ContactName.ToLower().Contains(t)) ||
                        (d.DealStage   != null && d.DealStage.ToLower().Contains(t))   ||
                        (d.SalesOwner  != null && d.SalesOwner.ToLower().Contains(t))  ||
                        (d.Tags        != null && d.Tags.ToLower().Contains(t)));
                }

                if (!string.IsNullOrWhiteSpace(dealStage))
                {
                    var v = dealStage.Trim().ToLowerInvariant();
                    dealsQuery = dealsQuery.Where(d => d.DealStage != null && d.DealStage.ToLower().Contains(v));
                }

                if (!string.IsNullOrWhiteSpace(dealTerritory))
                {
                    var v = dealTerritory.Trim().ToLowerInvariant();
                    dealsQuery = dealsQuery.Where(d => d.Territory != null && d.Territory.ToLower().Contains(v));
                }

                if (!string.IsNullOrWhiteSpace(dealTags))
                {
                    var v = dealTags.Trim().ToLowerInvariant();
                    dealsQuery = dealsQuery.Where(d => d.Tags != null && d.Tags.ToLower().Contains(v));
                }

                if (dealSalesOwnerId.HasValue)
                {
                    var v = dealSalesOwnerId.Value;
                    dealsQuery = dealsQuery.Where(d => d.SalesOwnerId == v);
                }

                if (!string.IsNullOrWhiteSpace(dealSalesOwner))
                {
                    var v = dealSalesOwner.Trim().ToLowerInvariant();
                    dealsQuery = dealsQuery.Where(d => d.SalesOwner != null && d.SalesOwner.ToLower().Contains(v));
                }

                var deals = await dealsQuery
                    .Select(d => new
                    {
                        d.Id,
                        d.Name,
                        d.AccountName,
                        d.DealStage,
                        d.SalesOwner,
                        d.Territory,
                        d.Tags
                    })
                    .ToListAsync();

                // Rank: exact name match → starts-with name → rest
                var dealsRanked = deals
                    .OrderByDescending(d =>
                    {
                        var name = (d.Name ?? "").ToLowerInvariant();
                        if (name == loweredQuery)          return 4;
                        if (name.StartsWith(loweredQuery)) return 3;
                        return 1;
                    })
                    .ToList();

                foreach (var d in dealsRanked)
                {
                    results.Add(BuildResult(
                        d.Id,
                        "deal",
                        d.Name,
                        loweredQuery,
                        ("Deal Name", d.Name),
                        ("Account", d.AccountName),
                        ("Stage", d.DealStage),
                        ("Owner", d.SalesOwner),
                        ("Territory", d.Territory),
                        ("Tags", d.Tags)));
                }

                var productsQuery = _db.Products
                    .AsNoTracking()
                    .Where(p =>
                        (p.Name != null && p.Name.ToLower().Contains(loweredQuery)) ||
                        (p.Category != null && p.Category.ToLower().Contains(loweredQuery)));

                if (!string.IsNullOrWhiteSpace(productCategory))
                {
                    var v = productCategory.Trim().ToLowerInvariant();
                    productsQuery = productsQuery.Where(p => p.Category != null && p.Category.ToLower().Contains(v));
                }

                if (!string.IsNullOrWhiteSpace(productActive))
                {
                    var v = productActive.Trim().ToLowerInvariant();
                    productsQuery = productsQuery.Where(p => p.Active != null && p.Active.ToLower().Contains(v));
                }

                var products = await productsQuery
                    .Select(p => new
                    {
                        p.ProductId,
                        p.Name,
                        p.Category
                    })
                    .ToListAsync();

                // Rank: exact match → starts-with name → rest
                var productsRanked = products
                    .OrderByDescending(p =>
                    {
                        var name = (p.Name ?? "").ToLowerInvariant();
                        if (name == loweredQuery)          return 4;
                        if (name.StartsWith(loweredQuery)) return 3;
                        return 1;
                    })
                    .ToList();

                foreach (var p in productsRanked)
                {
                    results.Add(BuildResult(
                        p.ProductId,
                        "product",
                        p.Name,
                        loweredQuery,
                        ("Name", p.Name),
                        ("Category", p.Category)));
                }

                return Ok(results);
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "Search failed for query {Query}", query);
                return StatusCode(500, new { message = "Search failed." });
            }
        }

        private static object BuildResult(
            object id,
            string type,
            string? name,
            string loweredQuery,
            params (string Field, string? Value)[] fields)
        {
            var allFields = new Dictionary<string, string>();
            var matchedFields = new List<object>();

            foreach (var (field, value) in fields)
            {
                if (string.IsNullOrWhiteSpace(value))
                {
                    continue;
                }

                allFields[field] = value;
                if (value.ToLowerInvariant().Contains(loweredQuery))
                {
                    matchedFields.Add(new { field, value });
                }
            }

            return new
            {
                id,
                type,
                name = name ?? string.Empty,
                allFields,
                matchedFields
            };
        }

        /// <summary>
        /// Returns the version of the published backend
        /// </summary>
        [HttpGet("version")]
        [AllowAnonymous]
        public IActionResult GetVersion()
        {
            var version = new
            {
                version = "1.0.8.0",
                timestamp = "18-06-2026",
                environment = Environment.GetEnvironmentVariable("ASPNETCORE_ENVIRONMENT") ?? "Production"
            };
            return Ok(version);
        }
    }
}
