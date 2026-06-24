using CsvHelper;
using Microsoft.Data.SqlClient;
using Sylvan.Data.Csv;
using Sylvan.Data.Excel;
using System.Data;
using System.Diagnostics;
using System.Runtime.CompilerServices;
using System.Text;

namespace Elpis_CRM.Services;


public sealed record ImportResult(
    bool Success,
    int RowsImported,
    int RowsSkipped,
    TimeSpan Elapsed,
    string? Error = null,
    IReadOnlyList<string>? RowErrors = null);

public sealed record ImportProgress(int RowsProcessed, int BatchesCompleted);

public sealed record ImportOptions
{
    /// <summary>Rows per SqlBulkCopy batch. 5 000–10 000 is optimal for most workloads.</summary>
    public int BatchSize { get; init; } = 5_000;

    /// <summary>When true, rows that throw during conversion are skipped and logged instead of aborting the import.</summary>
    public bool SkipBadRows { get; init; } = false;

    /// <summary>Max retry attempts on transient SQL errors (exponential back-off: 2 s, 4 s, 8 s…).</summary>
    public int MaxRetryAttempts { get; init; } = 3;

    /// <summary>
    /// Files larger than this (bytes) will have non-clustered indexes disabled before insert
    /// and rebuilt after. Acts as a proxy for "large file" since we stream without knowing row count.
    /// Default: 5 MB ≈ ~50 k rows for typical CRM data.
    /// </summary>
    public long IndexDisableThresholdBytes { get; init; } = 5 * 1_024 * 1_024;

    /// <summary>Optional progress sink — called after every <see cref="BatchSize"/> rows.</summary>
    public IProgress<ImportProgress>? Progress { get; init; }
}



internal sealed class ImportColumnDef
{
    public required string SqlColumnName { get; init; }
    public required Type ClrType { get; init; }
    public bool IsNullable { get; init; }

    /// <summary>
    /// Pre-compiled value converter: raw Excel / CSV cell value → SQL-ready object.
    /// Called in the hot row-read loop. Must have ZERO reflection, ZERO regex,
    /// ZERO per-call heap allocations beyond the inescapable boxing of value types.
    /// </summary>
    public required Func<object?, object?> Converter { get; init; }
}

internal sealed class ImportTableSchema
{
    public required string TableName { get; init; }
    public required ImportColumnDef[] Columns { get; init; }
}



internal static class SchemaRegistry
{
 
    private static readonly Func<object?, object?> Str =
        static v => v is null or DBNull ? (object)DBNull.Value : v.ToString()!;

    private static Func<object?, object?> Int(bool nullable) => nullable
        ? static v => v switch
        {
            null or DBNull => (object)DBNull.Value,
            int i => (object)i,
            long l => (object)(int)l,
            double d => (object)(int)d,
            string s => int.TryParse(s, out var r) ? (object)r : (object)DBNull.Value,
            _ => (object)Convert.ToInt32(v)
        }
        : static v => v switch
        {
            null or DBNull => (object)0,
            int i => (object)i,
            long l => (object)(int)l,
            double d => (object)(int)d,
            string s => int.TryParse(s, out var r) ? (object)r : (object)0,
            _ => (object)Convert.ToInt32(v)
        };

    private static Func<object?, object?> Long(bool nullable) => nullable
        ? static v => v switch
        {
            null or DBNull => (object)DBNull.Value,
            long l => (object)l,
            int i => (object)(long)i,
            double d => (object)(long)d,
            string s => long.TryParse(s, out var r) ? (object)r : (object)DBNull.Value,
            _ => (object)Convert.ToInt64(v)
        }
        : static v => v switch
        {
            null or DBNull => (object)0L,
            long l => (object)l,
            int i => (object)(long)i,
            double d => (object)(long)d,
            string s => long.TryParse(s, out var r) ? (object)r : (object)0L,
            _ => (object)Convert.ToInt64(v)
        };

    private static Func<object?, object?> Dec(bool nullable) => nullable
        ? static v => v switch
        {
            null or DBNull => (object)DBNull.Value,
            decimal dm => (object)dm,
            double d => (object)(decimal)d,
            int i => (object)(decimal)i,
            long l => (object)(decimal)l,
            string s => decimal.TryParse(s,
                                  System.Globalization.NumberStyles.Any,
                                  System.Globalization.CultureInfo.InvariantCulture,
                                  out var r)
                              ? (object)r : (object)DBNull.Value,
            _ => (object)Convert.ToDecimal(v)
        }
        : static v => v switch
        {
            null or DBNull => (object)0m,
            decimal dm => (object)dm,
            double d => (object)(decimal)d,
            int i => (object)(decimal)i,
            long l => (object)(decimal)l,
            string s => decimal.TryParse(s,
                                  System.Globalization.NumberStyles.Any,
                                  System.Globalization.CultureInfo.InvariantCulture,
                                  out var r)
                              ? (object)r : (object)0m,
            _ => (object)Convert.ToDecimal(v)
        };

    private static Func<object?, object?> Dt(bool nullable)
    {
        static object? ParseDateString(string s, bool isNullable)
        {
            // Handle strings with " UTC" suffix (e.g., "2026-01-02 09:55:31 UTC")
            var trimmed = s.EndsWith(" UTC") ? s[..^4].Trim() : s;
            var parsed = DateTime.TryParse(trimmed,
                                  System.Globalization.CultureInfo.InvariantCulture,
                                  System.Globalization.DateTimeStyles.AssumeUniversal,
                                  out var r);
            return parsed ? (object)r : (isNullable ? (object)DBNull.Value : (object)DateTime.UtcNow);
        }

        return nullable
            ? static v => v switch
            {
                null or DBNull => (object)DBNull.Value,
                DateTime dt => (object)dt,
                double d => (object)DateTime.FromOADate(d),
                string s => ParseDateString(s, true),
                _ => (object)Convert.ToDateTime(v)
            }
            : static v => v switch
            {
                null or DBNull => (object)DateTime.UtcNow,
                DateTime dt => (object)dt,
                double d => (object)DateTime.FromOADate(d),
                string s => ParseDateString(s, false),
                _ => (object)Convert.ToDateTime(v)
            };
    }

    // ── Date-only (SQL date column) — stored as DateTime at midnight ─────────

    // private static readonly Func<object?, object?> DateOnly =
    //     static v => v switch
    //     {
    //         null or DBNull => (object)DBNull.Value,
    //         DateTime dt => (object)dt.Date,
    //         double d => (object)DateTime.FromOADate(d).Date,
    //         string s => DateTime.TryParse(s,
    //                               System.Globalization.CultureInfo.InvariantCulture,
    //                               System.Globalization.DateTimeStyles.None,
    //                               out var r)
    //                           ? (object)r.Date : (object)DBNull.Value,
    //         _ => (object)DBNull.Value
    //     };
 private static readonly Func<object?, object?> DateOnly =
        static v => v switch
        {
            null or DBNull => (object)DBNull.Value,
            DateTime dt => (object)dt.Date,
            double d => (object)DateTime.FromOADate(d).Date,
            string s => DateTime.TryParse(
                              s.EndsWith(" UTC", StringComparison.OrdinalIgnoreCase) ? s[..^4] : s,
                              System.Globalization.CultureInfo.InvariantCulture,
                              System.Globalization.DateTimeStyles.AssumeUniversal | System.Globalization.DateTimeStyles.AdjustToUniversal,
                              out var r)
                          ? (object)r.Date : (object)DBNull.Value,
            _ => (object)DBNull.Value
        };
    // ── Table definitions ────────────────────────────────────────────────────
    // Rules:
    //   • Identity columns (AccountId, ContactId, Id) are OMITTED — SqlBulkCopy rejects them.
    //   • is_nullable = 0  → IsNullable = false  (file MUST supply this column)
    //   • is_nullable = 1  → IsNullable = true   (missing cell → DBNull → DB DEFAULT / NULL)
    //   • nvarchar         → Str
    //   • int nullable     → Int(true)   | int not-null → Int(false)
    //   • decimal nullable → Dec(true)
    //   • datetime nullable→ Dt(true)
    //   • date nullable    → DateOnly   (SQL date type; we strip the time component)

    public static readonly IReadOnlyDictionary<string, ImportTableSchema> All =
        new Dictionary<string, ImportTableSchema>(StringComparer.OrdinalIgnoreCase)
        {
            // ════════════════════════════════════════════════════════════════
            // Accounts  (AccountId is NOT identity — must be imported from file)
            // ════════════════════════════════════════════════════════════════
            ["Accounts"] = new()
            {
                TableName = "Accounts",
                Columns =
                [
                    new() { SqlColumnName = "AccountId",                 ClrType = typeof(long),     IsNullable = false,  Converter = Long(true) },
                    new() { SqlColumnName = "Name",                      ClrType = typeof(string),   IsNullable = false, Converter = Str       },
                    new() { SqlColumnName = "NumberOfEmployees",         ClrType = typeof(int),      IsNullable = true,  Converter = Int(true) },
                    new() { SqlColumnName = "AnnualRevenue",             ClrType = typeof(decimal),  IsNullable = true,  Converter = Dec(true) },
                    new() { SqlColumnName = "Website",                   ClrType = typeof(string),   IsNullable = true,  Converter = Str       },
                    new() { SqlColumnName = "Phone",                     ClrType = typeof(string),   IsNullable = true,  Converter = Str       },
                    new() { SqlColumnName = "DisplayPhone",              ClrType = typeof(string),   IsNullable = true,  Converter = Str       },
                    new() { SqlColumnName = "Address",                   ClrType = typeof(string),   IsNullable = true,  Converter = Str       },
                    new() { SqlColumnName = "City",                      ClrType = typeof(string),   IsNullable = true,  Converter = Str       },
                    new() { SqlColumnName = "State",                     ClrType = typeof(string),   IsNullable = true,  Converter = Str       },
                    new() { SqlColumnName = "Zipcode",                   ClrType = typeof(string),   IsNullable = true,  Converter = Str       },
                    new() { SqlColumnName = "Country",                   ClrType = typeof(string),   IsNullable = true,  Converter = Str       },
                    new() { SqlColumnName = "Facebook",                  ClrType = typeof(string),   IsNullable = true,  Converter = Str       },
                    new() { SqlColumnName = "Twitter",                   ClrType = typeof(string),   IsNullable = true,  Converter = Str       },
                    new() { SqlColumnName = "LinkedIn",                  ClrType = typeof(string),   IsNullable = true,  Converter = Str       },
                    new() { SqlColumnName = "LastContactedTime",         ClrType = typeof(DateTime), IsNullable = true,  Converter = Dt(true)  },
                    new() { SqlColumnName = "LastContactedMode",         ClrType = typeof(string),   IsNullable = true,  Converter = Str       },
                    new() { SqlColumnName = "LastActivityType",          ClrType = typeof(string),   IsNullable = true,  Converter = Str       },
                    new() { SqlColumnName = "LastActivityDate",          ClrType = typeof(DateTime), IsNullable = true,  Converter = Dt(true)  },
                    new() { SqlColumnName = "RecentNote",                ClrType = typeof(string),   IsNullable = true,  Converter = Str       },
                    new() { SqlColumnName = "IndustryType",              ClrType = typeof(string),   IsNullable = true,  Converter = Str       },
                    new() { SqlColumnName = "BusinessType",              ClrType = typeof(string),   IsNullable = true,  Converter = Str       },
                    new() { SqlColumnName = "Territory",                 ClrType = typeof(string),   IsNullable = true,  Converter = Str       },
                    new() { SqlColumnName = "CreatedAt",                 ClrType = typeof(DateTime), IsNullable = true,  Converter = Dt(true)  },
                    new() { SqlColumnName = "UpdatedAt",                 ClrType = typeof(DateTime), IsNullable = true,  Converter = Dt(true)  },
                    new() { SqlColumnName = "ActiveSalesSequences",      ClrType = typeof(int),      IsNullable = true,  Converter = Int(true) },
                    new() { SqlColumnName = "CompletedSalesSequences",   ClrType = typeof(int),      IsNullable = true,  Converter = Int(true) },
                    new() { SqlColumnName = "LastAssignedAt",            ClrType = typeof(DateTime), IsNullable = true,  Converter = Dt(true)  },
                    new() { SqlColumnName = "ParentAccountId",           ClrType = typeof(long),      IsNullable = true,  Converter = Long(true) },
                    new() { SqlColumnName = "ParentAccount",             ClrType = typeof(string),   IsNullable = true,  Converter = Str       },
                    new() { SqlColumnName = "SalesOwnerId",              ClrType = typeof(long),     IsNullable = true,  Converter = Long(true) },
                    new() { SqlColumnName = "SalesOwner",                ClrType = typeof(string),   IsNullable = true,  Converter = Str       },
                    new() { SqlColumnName = "CreatedById",               ClrType = typeof(long),      IsNullable = true,  Converter = Long(true) },
                    new() { SqlColumnName = "CreatedBy",                 ClrType = typeof(string),   IsNullable = true,  Converter = Str       },
                    new() { SqlColumnName = "UpdatedById",               ClrType = typeof(long),      IsNullable = true,  Converter = Long(true) },
                    new() { SqlColumnName = "UpdatedBy",                 ClrType = typeof(string),   IsNullable = true,  Converter = Str       },
                    new() { SqlColumnName = "ImportID",                  ClrType = typeof(string),   IsNullable = true,  Converter = Str       },
                    new() { SqlColumnName = "Tags",                      ClrType = typeof(string),   IsNullable = true,  Converter = Str       },
                ]
            },

            // ════════════════════════════════════════════════════════════════
            // Contacts  (ContactId is NOT identity — must be imported from file)
            // ════════════════════════════════════════════════════════════════
            ["Contacts"] = new()
            {
                TableName = "Contacts",
                Columns =
                [
                    new() { SqlColumnName = "ContactId",                 ClrType = typeof(long),     IsNullable = false,  Converter = Long(true) },
                    new() { SqlColumnName = "FirstName",                  ClrType = typeof(string),   IsNullable = true,  Converter = Str       },
                    new() { SqlColumnName = "LastName",                   ClrType = typeof(string),   IsNullable = true,  Converter = Str       },
                    new() { SqlColumnName = "JobTitle",                   ClrType = typeof(string),   IsNullable = true,  Converter = Str       },
                    new() { SqlColumnName = "WorkPhone",                  ClrType = typeof(string),   IsNullable = true,  Converter = Str       },
                    new() { SqlColumnName = "Mobile",                     ClrType = typeof(string),   IsNullable = true,  Converter = Str       },
                    new() { SqlColumnName = "LastSeenOnChat",             ClrType = typeof(DateTime), IsNullable = true,  Converter = Dt(true)  },
                    new() { SqlColumnName = "Locale",                     ClrType = typeof(string),   IsNullable = true,  Converter = Str       },
                    new() { SqlColumnName = "TotalChatSessions",          ClrType = typeof(int),      IsNullable = true,  Converter = Int(true) },
                    new() { SqlColumnName = "FirstSeenOnChat",            ClrType = typeof(DateTime), IsNullable = true,  Converter = Dt(true)  },
                    new() { SqlColumnName = "ExternalID",                 ClrType = typeof(string),   IsNullable = true,  Converter = Str       },
                    new() { SqlColumnName = "TimeZone",                   ClrType = typeof(string),   IsNullable = true,  Converter = Str       },
                    new() { SqlColumnName = "Address",                    ClrType = typeof(string),   IsNullable = true,  Converter = Str       },
                    new() { SqlColumnName = "City",                       ClrType = typeof(string),   IsNullable = true,  Converter = Str       },
                    new() { SqlColumnName = "State",                      ClrType = typeof(string),   IsNullable = true,  Converter = Str       },
                    new() { SqlColumnName = "Zipcode",                    ClrType = typeof(string),   IsNullable = true,  Converter = Str       },
                    new() { SqlColumnName = "Country",                    ClrType = typeof(string),   IsNullable = true,  Converter = Str       },
                    new() { SqlColumnName = "Facebook",                   ClrType = typeof(string),   IsNullable = true,  Converter = Str       },
                    new() { SqlColumnName = "Twitter",                    ClrType = typeof(string),   IsNullable = true,  Converter = Str       },
                    new() { SqlColumnName = "LinkedIn",                   ClrType = typeof(string),   IsNullable = true,  Converter = Str       },
                    new() { SqlColumnName = "Medium",                     ClrType = typeof(string),   IsNullable = true,  Converter = Str       },
                    new() { SqlColumnName = "Keyword",                    ClrType = typeof(string),   IsNullable = true,  Converter = Str       },
                    new() { SqlColumnName = "LastContactedTime",          ClrType = typeof(DateTime), IsNullable = true,  Converter = Dt(true)  },
                    new() { SqlColumnName = "LastContactedMode",          ClrType = typeof(string),   IsNullable = true,  Converter = Str       },
                    new() { SqlColumnName = "LastActivityType",           ClrType = typeof(string),   IsNullable = true,  Converter = Str       },
                    new() { SqlColumnName = "LastActivityDate",           ClrType = typeof(DateTime), IsNullable = true,  Converter = Dt(true)  },
                    new() { SqlColumnName = "LastSeenOnWeb",              ClrType = typeof(DateTime), IsNullable = true,  Converter = Dt(true)  },
                    new() { SqlColumnName = "Score",                      ClrType = typeof(int),      IsNullable = true,  Converter = Int(true) },
                    new() { SqlColumnName = "SubscriptionStatus",         ClrType = typeof(string),   IsNullable = true,  Converter = Str       },
                    new() { SqlColumnName = "UnsubscribeReason",          ClrType = typeof(string),   IsNullable = true,  Converter = Str       },
                    new() { SqlColumnName = "OtherUnsubscribeReasons",    ClrType = typeof(string),   IsNullable = true,  Converter = Str       },
                    new() { SqlColumnName = "WhatsAppSubscriptionStatus", ClrType = typeof(string),   IsNullable = true,  Converter = Str       },
                    new() { SqlColumnName = "SMSSubscriptionStatus",      ClrType = typeof(string),   IsNullable = true,  Converter = Str       },
                    new() { SqlColumnName = "RecentNote",                 ClrType = typeof(string),   IsNullable = true,  Converter = Str       },
                    new() { SqlColumnName = "CreatedAt",                  ClrType = typeof(DateTime), IsNullable = true,  Converter = Dt(true)  },
                    new() { SqlColumnName = "UpdatedAt",                  ClrType = typeof(DateTime), IsNullable = true,  Converter = Dt(true)  },
                    new() { SqlColumnName = "Source",                     ClrType = typeof(string),   IsNullable = true,  Converter = Str       },
                    new() { SqlColumnName = "Campaign",                   ClrType = typeof(string),   IsNullable = true,  Converter = Str       },
                    new() { SqlColumnName = "Territory",                  ClrType = typeof(string),   IsNullable = true,  Converter = Str       },
                    new() { SqlColumnName = "LifeCycleStage",             ClrType = typeof(string),   IsNullable = true,  Converter = Str       },
                    new() { SqlColumnName = "Status",                     ClrType = typeof(string),   IsNullable = true,  Converter = Str       },
                    new() { SqlColumnName = "LostReason",                 ClrType = typeof(string),   IsNullable = true,  Converter = Str       },
                    new() { SqlColumnName = "OriginalCampaign",           ClrType = typeof(string),   IsNullable = true,  Converter = Str       },
                    new() { SqlColumnName = "OriginalMedium",             ClrType = typeof(string),   IsNullable = true,  Converter = Str       },
                    new() { SqlColumnName = "OriginalSource",             ClrType = typeof(string),   IsNullable = true,  Converter = Str       },
                    new() { SqlColumnName = "CreatedThroughCampaign",     ClrType = typeof(string),   IsNullable = true,  Converter = Str       },
                    new() { SqlColumnName = "CreatedFromMedium",          ClrType = typeof(string),   IsNullable = true,  Converter = Str       },
                    new() { SqlColumnName = "CreatedFromSource",          ClrType = typeof(string),   IsNullable = true,  Converter = Str       },
                    new() { SqlColumnName = "MostRecentCampaign",         ClrType = typeof(string),   IsNullable = true,  Converter = Str       },
                    new() { SqlColumnName = "MostRecentMedium",           ClrType = typeof(string),   IsNullable = true,  Converter = Str       },
                    new() { SqlColumnName = "MostRecentSource",           ClrType = typeof(string),   IsNullable = true,  Converter = Str       },
                    new() { SqlColumnName = "WorkEmail",                  ClrType = typeof(string),   IsNullable = true,  Converter = Str       },
                    new() { SqlColumnName = "ActiveSalesSequences",       ClrType = typeof(int),      IsNullable = true,  Converter = Int(true) },
                    new() { SqlColumnName = "CompletedSalesSequences",    ClrType = typeof(int),      IsNullable = true,  Converter = Int(true) },
                    new() { SqlColumnName = "CustomerFit",                ClrType = typeof(string),   IsNullable = true,  Converter = Str       },
                    new() { SqlColumnName = "WebForms",                   ClrType = typeof(string),   IsNullable = true,  Converter = Str       },
                    new() { SqlColumnName = "LastAssignedAt",             ClrType = typeof(DateTime), IsNullable = true,  Converter = Dt(true)  },
                    new() { SqlColumnName = "AccountId",                  ClrType = typeof(long),     IsNullable = true,  Converter = Long(true) },
                    new() { SqlColumnName = "Account",                    ClrType = typeof(string),   IsNullable = true,  Converter = Str       },
                    new() { SqlColumnName = "SalesOwnerId",               ClrType = typeof(long),     IsNullable = true,  Converter = Long(true) },
                    new() { SqlColumnName = "SalesOwner",                 ClrType = typeof(string),   IsNullable = true,  Converter = Str       },
                    new() { SqlColumnName = "CreatedById",                ClrType = typeof(long),     IsNullable = true,  Converter = Long(true) },
                    new() { SqlColumnName = "CreatedBy",                  ClrType = typeof(string),   IsNullable = true,  Converter = Str       },
                    new() { SqlColumnName = "UpdatedById",                ClrType = typeof(long),     IsNullable = true,  Converter = Long(true) },
                    new() { SqlColumnName = "UpdatedBy",                  ClrType = typeof(string),   IsNullable = true,  Converter = Str       },
                    new() { SqlColumnName = "ImportID",                   ClrType = typeof(string),   IsNullable = true,  Converter = Str       },
                    new() { SqlColumnName = "Emails",                     ClrType = typeof(string),   IsNullable = true,  Converter = Str       },
                    new() { SqlColumnName = "Products",                   ClrType = typeof(string),   IsNullable = true,  Converter = Str       },
                    new() { SqlColumnName = "Message",                    ClrType = typeof(string),   IsNullable = true,  Converter = Str       },
                    new() { SqlColumnName = "Tags",                       ClrType = typeof(string),   IsNullable = true,  Converter = Str       },
                    new() { SqlColumnName = "Lists",                      ClrType = typeof(string),   IsNullable = true,  Converter = Str       },
                ]
            },

            // ════════════════════════════════════════════════════════════════
            // Deals  (Id is NOT identity — must be imported from file)
            // ════════════════════════════════════════════════════════════════
            ["Deals"] = new()
            {
                TableName = "Deals",
                Columns =
                [
                    new() { SqlColumnName = "Id",                      ClrType = typeof(long),     IsNullable = false,  Converter = Long(true) },
                    new() { SqlColumnName = "Name",                    ClrType = typeof(string),   IsNullable = true,  Converter = Str       },
                    new() { SqlColumnName = "DealValue",               ClrType = typeof(decimal),  IsNullable = true,  Converter = Dec(true) },
                    new() { SqlColumnName = "Currency",                ClrType = typeof(string),   IsNullable = true,  Converter = Str       },
                    new() { SqlColumnName = "DealValueInBaseCurrency", ClrType = typeof(decimal),  IsNullable = true,  Converter = Dec(true) },
                    new() { SqlColumnName = "ExpectedCloseDate",       ClrType = typeof(DateTime), IsNullable = true,  Converter = DateOnly  },
                    new() { SqlColumnName = "ClosedDate",              ClrType = typeof(DateTime), IsNullable = true,  Converter = DateOnly  },
                    new() { SqlColumnName = "Probability",             ClrType = typeof(int),      IsNullable = true,  Converter = Int(true) },
                    new() { SqlColumnName = "LastActivityType",        ClrType = typeof(string),   IsNullable = true,  Converter = Str       },
                    new() { SqlColumnName = "LastActivityDate",        ClrType = typeof(DateTime), IsNullable = true,  Converter = Dt(true)  },
                    new() { SqlColumnName = "RecentNote",              ClrType = typeof(string),   IsNullable = true,  Converter = Str       },
                    new() { SqlColumnName = "CreatedAt",               ClrType = typeof(DateTime), IsNullable = true,  Converter = Dt(true)  },
                    new() { SqlColumnName = "UpdatedAt",               ClrType = typeof(DateTime), IsNullable = true,  Converter = Dt(true)  },
                    new() { SqlColumnName = "DealPipeline",            ClrType = typeof(string),   IsNullable = true,  Converter = Str       },
                    new() { SqlColumnName = "DealStage",               ClrType = typeof(string),   IsNullable = true,  Converter = Str       },
                    new() { SqlColumnName = "LostReason",              ClrType = typeof(string),   IsNullable = true,  Converter = Str       },
                    new() { SqlColumnName = "PaymentStatus",           ClrType = typeof(string),   IsNullable = true,  Converter = Str       },
                    new() { SqlColumnName = "Territory",               ClrType = typeof(string),   IsNullable = true,  Converter = Str       },
                    new() { SqlColumnName = "Type",                    ClrType = typeof(string),   IsNullable = true,  Converter = Str       },
                    new() { SqlColumnName = "Source",                  ClrType = typeof(string),   IsNullable = true,  Converter = Str       },
                    new() { SqlColumnName = "Campaign",                ClrType = typeof(string),   IsNullable = true,  Converter = Str       },
                    new() { SqlColumnName = "ForecastCategory",        ClrType = typeof(string),   IsNullable = true,  Converter = Str       },
                    new() { SqlColumnName = "ActiveSalesSequences",    ClrType = typeof(int),      IsNullable = true,  Converter = Int(true) },
                    new() { SqlColumnName = "CompletedSalesSequences", ClrType = typeof(int),      IsNullable = true,  Converter = Int(true) },
                    new() { SqlColumnName = "WebForm",                 ClrType = typeof(string),   IsNullable = true,  Converter = Str       },
                    new() { SqlColumnName = "UpcomingActivities",      ClrType = typeof(string),   IsNullable = true,  Converter = Str       },
                    new() { SqlColumnName = "DealStageUpdatedAt",      ClrType = typeof(DateTime), IsNullable = true,  Converter = Dt(true)  },
                    new() { SqlColumnName = "LastAssignedAt",          ClrType = typeof(DateTime), IsNullable = true,  Converter = Dt(true)  },
                    new() { SqlColumnName = "ExpectedDealValue",       ClrType = typeof(decimal),  IsNullable = true,  Converter = Dec(true) },
                    new() { SqlColumnName = "AccountId",               ClrType = typeof(long),     IsNullable = true,  Converter = Long(true) },
                    new() { SqlColumnName = "AccountName",             ClrType = typeof(string),   IsNullable = true,  Converter = Str       },
                    new() { SqlColumnName = "ContactId",               ClrType = typeof(long),     IsNullable = true,  Converter = Long(true) },
                    new() { SqlColumnName = "ContactName",             ClrType = typeof(string),   IsNullable = true,  Converter = Str       },
                    new() { SqlColumnName = "SalesOwnerId",            ClrType = typeof(long),     IsNullable = true,  Converter = Long(true) },
                    new() { SqlColumnName = "SalesOwner",              ClrType = typeof(string),   IsNullable = true,  Converter = Str       },
                    new() { SqlColumnName = "CreatedById",             ClrType = typeof(long),     IsNullable = true,  Converter = Long(true) },
                    new() { SqlColumnName = "CreatedBy",               ClrType = typeof(string),   IsNullable = true,  Converter = Str       },
                    new() { SqlColumnName = "UpdatedById",             ClrType = typeof(long),     IsNullable = true,  Converter = Long(true) },
                    new() { SqlColumnName = "UpdatedBy",               ClrType = typeof(string),   IsNullable = true,  Converter = Str       },
                    new() { SqlColumnName = "ImportID",                ClrType = typeof(string),   IsNullable = true,  Converter = Str       },
                    new() { SqlColumnName = "EnquiryNumber",           ClrType = typeof(string),   IsNullable = true,  Converter = Str       },
                    new() { SqlColumnName = "Tags",                    ClrType = typeof(string),   IsNullable = true,  Converter = Str       },
                    new() { SqlColumnName = "AgeInDays",               ClrType = typeof(int),      IsNullable = true,  Converter = Int(true) },
                ]
            },

            // CallLog (CallLogId is IDENTITY — excluded)
            ["DealContactLinks"] = new()
            {
                TableName = "DealContactLinks",
                Columns =
                [
                    new() { SqlColumnName = "DealId",    ClrType = typeof(long), IsNullable = false, Converter = Long(true) },
                    new() { SqlColumnName = "ContactId", ClrType = typeof(long), IsNullable = false, Converter = Long(true) },
                ]
            },

            ["CallLogs"] = new()
            {
                TableName = "CallLog",
                Columns =
                [
                    new() { SqlColumnName = "CallOwner",          ClrType = typeof(string),   IsNullable = true,  Converter = Str        },
                    new() { SqlColumnName = "CreatedAt",          ClrType = typeof(DateTime), IsNullable = true,  Converter = Dt(true)   },
                    new() { SqlColumnName = "CallDirection",      ClrType = typeof(string),   IsNullable = true,  Converter = Str        },
                    new() { SqlColumnName = "CallStatus",         ClrType = typeof(string),   IsNullable = true,  Converter = Str        },
                    new() { SqlColumnName = "CallDuration",       ClrType = typeof(string),   IsNullable = true,  Converter = Str        },
                    new() { SqlColumnName = "Outcome",            ClrType = typeof(string),   IsNullable = true,  Converter = Str        },
                    new() { SqlColumnName = "Phone",              ClrType = typeof(string),   IsNullable = true,  Converter = Str        },
                    new() { SqlColumnName = "CallType",           ClrType = typeof(string),   IsNullable = true,  Converter = Str        },
                    new() { SqlColumnName = "Notes",              ClrType = typeof(string),   IsNullable = true,  Converter = Str        },
                    new() { SqlColumnName = "AssociatedWithCall", ClrType = typeof(string),   IsNullable = true,  Converter = Str        },
                    new() { SqlColumnName = "ContactId",          ClrType = typeof(long),     IsNullable = true,  Converter = Long(true) },
                    new() { SqlColumnName = "AccountId",          ClrType = typeof(long),     IsNullable = true,  Converter = Long(true) },
                    new() { SqlColumnName = "DealId",             ClrType = typeof(long),     IsNullable = true,  Converter = Long(true) },
                ]
            },

            // Notes (Id is IDENTITY — excluded)
            ["Notes"] = new()
            {
                TableName = "Notes",
                Columns =
                [
                    new() { SqlColumnName = "Description",   ClrType = typeof(string),   IsNullable = true,  Converter = Str       },
                    new() { SqlColumnName = "CreatedById",   ClrType = typeof(long),      IsNullable = true,  Converter = Long(true) },
                    new() { SqlColumnName = "CreatedAt",     ClrType = typeof(DateTime), IsNullable = true,  Converter = Dt(true)  },
                    new() { SqlColumnName = "UpdatedAt",     ClrType = typeof(DateTime), IsNullable = true,  Converter = Dt(true)  },
                    new() { SqlColumnName = "ContactId",     ClrType = typeof(long),     IsNullable = true,  Converter = Long(true) },
                    new() { SqlColumnName = "RelatedToType", ClrType = typeof(string),   IsNullable = true,  Converter = Str       },
                ]
            },

            // Tasks (Id is IDENTITY — excluded)
            ["Tasks"] = new()
            {
                TableName = "Tasks",
                Columns =
                [
                    new() { SqlColumnName = "Title",            ClrType = typeof(string),   IsNullable = true,  Converter = Str       },
                    new() { SqlColumnName = "Description",      ClrType = typeof(string),   IsNullable = true,  Converter = Str       },
                    new() { SqlColumnName = "Status",           ClrType = typeof(string),   IsNullable = true,  Converter = Str       },
                    new() { SqlColumnName = "TaskType",         ClrType = typeof(string),   IsNullable = true,  Converter = Str       },
                    new() { SqlColumnName = "DueDate",          ClrType = typeof(DateTime), IsNullable = true,  Converter = Dt(true)  },
                    new() { SqlColumnName = "CompletedDate",    ClrType = typeof(DateTime), IsNullable = true,  Converter = Dt(true)  },
                    new() { SqlColumnName = "Outcome",          ClrType = typeof(string),   IsNullable = true,  Converter = Str       },
                    new() { SqlColumnName = "OwnerId",          ClrType = typeof(long),     IsNullable = true,  Converter = Long(true) },
                    new() { SqlColumnName = "CreatedById",      ClrType = typeof(long),     IsNullable = true,  Converter = Long(true) },
                    new() { SqlColumnName = "UpdatedById",      ClrType = typeof(long),     IsNullable = true,  Converter = Long(true) },
                    new() { SqlColumnName = "CreatedAt",        ClrType = typeof(DateTime), IsNullable = true,  Converter = Dt(true)  },
                    new() { SqlColumnName = "UpdatedAt",        ClrType = typeof(DateTime), IsNullable = true,  Converter = Dt(true)  },
                    new() { SqlColumnName = "ContactId",        ClrType = typeof(long),     IsNullable = true,  Converter = Long(true) },
                ]
            },
        };
    }

// ───────────────────────────────────────────────────────────────────────────────
// Header Mapper
// Called ONCE before the row loop. Never touches the hot path.
// ───────────────────────────────────────────────────────────────────────────────

internal static class HeaderMapper
{
    /// <summary>
    /// Normalizes a header string for fuzzy matching.
    /// Strips spaces, underscores, dashes, parentheses, slashes and lowercases.
    /// Uses stackalloc — zero heap allocation for headers ≤ 256 chars.
    /// "Account Name" → "accountname"  |  "account_name" → "accountname"
    /// </summary>
    [MethodImpl(MethodImplOptions.AggressiveInlining)]
    public static string Normalize(ReadOnlySpan<char> header)
    {
        Span<char> buf = stackalloc char[Math.Min(header.Length, 256)];
        int pos = 0;
        foreach (char c in header)
        {
            if (c is not (' ' or '_' or '-' or '(' or ')' or '/' or '\\'))
                buf[pos++] = char.ToLowerInvariant(c);
        }
        return new string(buf[..pos]);
    }

    /// <summary>
    /// Builds the source-column index map for a single import.
    /// Returns int[] where result[i] = source file column index for output column i,
    /// or -1 when the column is absent (nullable → sends DBNull; non-nullable → error).
    /// </summary>
    public static int[] BuildMap(IDataReader source, ImportTableSchema schema, out List<string> errors)
    {
        errors = [];

        // Build normalized lookup from file headers (one Dictionary allocation, done once)
        int fieldCount = source.FieldCount;
        var lookup = new Dictionary<string, int>(fieldCount, StringComparer.Ordinal);
        for (int i = 0; i < fieldCount; i++)
            lookup.TryAdd(Normalize(source.GetName(i)), i); // first occurrence wins on duplicates

        var map = new int[schema.Columns.Length];
        for (int i = 0; i < schema.Columns.Length; i++)
        {
            var col = schema.Columns[i];
            if (lookup.TryGetValue(Normalize(col.SqlColumnName), out int srcIdx))
            {
                map[i] = srcIdx;
            }
            else if (!col.IsNullable)
            {
                errors.Add($"Required column '{col.SqlColumnName}' not found in file.");
                map[i] = -1;
            }
            else
            {
                // Missing optional column → -1 → GetValue returns DBNull
                // SqlBulkCopy (without KeepNulls) will apply the DB column's DEFAULT.
                map[i] = -1;
            }
        }

        return map;
    }
}

// ───────────────────────────────────────────────────────────────────────────────
// MappedDataReader
// The IDataReader handed directly to SqlBulkCopy.WriteToServerAsync().
// HOT PATH: Read() + GetValue() are called 100 000+ times per import.
// Design constraints:
//   • No reflection           • No Regex           • No per-row heap allocations
//   • No dynamic type checks  • No dictionary reads inside GetValue
// ───────────────────────────────────────────────────────────────────────────────

internal sealed class MappedDataReader : IDataReader
{
    private readonly IDataReader _src;
    private readonly int[] _map;   // output col i → source col index (-1 = DBNull)
    private readonly Func<object?, object?>[] _conv;  // pre-compiled converter per output column
    private readonly string[] _names;
    private readonly Type[] _types;
    private readonly IProgress<ImportProgress>? _progress;
    private readonly int _batchSize;

    // Stats (read after import completes)
    public int RowsRead { get; private set; }
    public int RowsSkipped { get; private set; }
    public List<string> RowErrors { get; } = [];

    public MappedDataReader(
        IDataReader source,
        int[] columnMap,
        ImportColumnDef[] columns,
        int batchSize = 5_000,
        IProgress<ImportProgress>? progress = null)
    {
        _src = source;
        _map = columnMap;
        _conv = Array.ConvertAll(columns, static c => c.Converter);
        _names = Array.ConvertAll(columns, static c => c.SqlColumnName);
        _types = Array.ConvertAll(columns, static c => c.ClrType);
        _batchSize = batchSize;
        _progress = progress;
    }

    // ── Hot path ─────────────────────────────────────────────────────────────

    public bool Read()
    {
        bool ok = _src.Read();
        if (ok)
        {
            RowsRead++;
            if (_progress is not null && RowsRead % _batchSize == 0)
                _progress.Report(new ImportProgress(RowsRead, RowsRead / _batchSize));
        }
        return ok;
    }

    [MethodImpl(MethodImplOptions.AggressiveInlining)]
    public object GetValue(int i)
    {
        int srcIdx = _map[i];
        if (srcIdx < 0) return DBNull.Value;     // missing optional column

        object? raw;
        try { raw = _src.GetValue(srcIdx); }
        catch { return DBNull.Value; }           // unreadable cell → null-safe

        // Delegate dispatch — inlined by JIT after first few calls per column.
        // No reflection, no boxing beyond what the delegate itself decides.
        object? result = _conv[i](raw is DBNull ? null : raw);
        return result ?? DBNull.Value;
    }

    [MethodImpl(MethodImplOptions.AggressiveInlining)]
    public bool IsDBNull(int i)
    {
        int srcIdx = _map[i];
        return srcIdx < 0 || _src.IsDBNull(srcIdx);
    }

    // ── IDataReader plumbing (SqlBulkCopy only uses Read / GetValue / FieldCount) ──

    public int FieldCount => _map.Length;
    public string GetName(int i) => _names[i];
    public Type GetFieldType(int i) => _types[i];
    public int GetOrdinal(string name)
    {
        for (int i = 0; i < _names.Length; i++)
            if (string.Equals(_names[i], name, StringComparison.OrdinalIgnoreCase)) return i;
        throw new IndexOutOfRangeException($"Column '{name}' not found.");
    }

    public int GetValues(object[] values)
    {
        int count = Math.Min(values.Length, FieldCount);
        for (int i = 0; i < count; i++) values[i] = GetValue(i);
        return count;
    }

    // Typed accessors — SqlBulkCopy routes through GetValue so these rarely fire,
    // but IDataReader requires them.
    public string GetString(int i) => (string)GetValue(i);
    public bool GetBoolean(int i) => (bool)GetValue(i);
    public byte GetByte(int i) => (byte)GetValue(i);
    public char GetChar(int i) => (char)GetValue(i);
    public short GetInt16(int i) => (short)GetValue(i);
    public int GetInt32(int i) => (int)GetValue(i);
    public long GetInt64(int i) => (long)GetValue(i);
    public float GetFloat(int i) => (float)GetValue(i);
    public double GetDouble(int i) => (double)GetValue(i);
    public decimal GetDecimal(int i) => (decimal)GetValue(i);
    public DateTime GetDateTime(int i) => (DateTime)GetValue(i);
    public Guid GetGuid(int i) => (Guid)GetValue(i);

    public string GetDataTypeName(int i) => _types[i].Name;
    public long GetBytes(int i, long fo, byte[]? buf, int bo, int len) => 0;
    public long GetChars(int i, long fo, char[]? buf, int bo, int len) => 0;
    public IDataReader GetData(int i) => throw new NotSupportedException();
    public DataTable? GetSchemaTable() => null;

    public object this[int i] => GetValue(i);
    public object this[string name] => GetValue(GetOrdinal(name));

    // Lifecycle — source lifetime is managed by ImportService.
    public void Close() { }
    public void Dispose() { }
    public int Depth => 0;
    public bool IsClosed => false;
    public int RecordsAffected => -1;
    public bool NextResult() => false;
}

// ───────────────────────────────────────────────────────────────────────────────
// Index Manager
// Disables non-clustered indexes before a large insert and rebuilds afterward.
// Runs on a separate SqlConnection command (not inside the BulkCopy).
// ───────────────────────────────────────────────────────────────────────────────

internal static class IndexManager
{
    private const string FindQuery = """
        SELECT i.name
        FROM   sys.indexes  i
        JOIN   sys.objects  o ON i.object_id = o.object_id
        WHERE  o.name               = @t
          AND  i.type_desc          = 'NONCLUSTERED'
          AND  i.is_disabled        = 0
          AND  i.is_primary_key     = 0
          AND  i.is_unique_constraint = 0;
        """;

    public static async Task<string[]> DisableAsync(
        SqlConnection conn, string table, CancellationToken ct)
    {
        var names = new List<string>();

        await using (var cmd = new SqlCommand(FindQuery, conn))
        {
            cmd.Parameters.Add("@t", SqlDbType.NVarChar, 128).Value = table;
            await using var rdr = await cmd.ExecuteReaderAsync(ct);
            while (await rdr.ReadAsync(ct))
                names.Add(rdr.GetString(0));
        }

        foreach (string name in names)
        {
            await using var cmd =
                new SqlCommand($"ALTER INDEX [{name}] ON [{table}] DISABLE;", conn);
            await cmd.ExecuteNonQueryAsync(ct);
        }

        return [.. names];
    }

    public static async Task RebuildAsync(
        SqlConnection conn, string table, string[] indexes, CancellationToken ct)
    {
        foreach (string name in indexes)
        {
            // Remove ONLINE = OFF if not supported by your SQL Server edition.
            await using var cmd = new SqlCommand(
                $"ALTER INDEX [{name}] ON [{table}] REBUILD WITH (ONLINE = OFF);", conn);
            cmd.CommandTimeout = 600; // index rebuilds can be slow on large tables
            await cmd.ExecuteNonQueryAsync(ct);
        }
    }
}

// ───────────────────────────────────────────────────────────────────────────────
// Import Service — public entry point
// Thread-safe: stateless beyond injected _cs/_log (both immutable after ctor).
// ───────────────────────────────────────────────────────────────────────────────

public sealed class ImportService
{
    private readonly string _cs;
    private readonly ILogger<ImportService> _log;

    private static readonly HashSet<string> AllowedExtensions =
        new(StringComparer.OrdinalIgnoreCase) { ".xlsx", ".xlsb", ".xls", ".csv" };

    public ImportService(IConfiguration cfg, ILogger<ImportService> log)
    {
        _cs = cfg.GetConnectionString("DefaultConnection")
               ?? throw new InvalidOperationException("'DefaultConnection' missing from configuration.");
        _log = log;
    }

    // ─────────────────────────────────────────────────────────────────────────
    // Public entry point
    // ─────────────────────────────────────────────────────────────────────────

    public async Task<ImportResult> ImportAsync(
        IFormFile file,
        string tableName,
        ImportOptions? options = null,
        CancellationToken ct = default)
    {
        options ??= new ImportOptions();
        var sw = Stopwatch.StartNew();

        // ── Fast-fail validation ───────────────────────────────────────────────
        if (file is null || file.Length == 0)
            return Fail("File is empty or missing.", sw);

        var ext = Path.GetExtension(file.FileName);
        if (!AllowedExtensions.Contains(ext))
            return Fail($"Unsupported file type '{ext}'. Supported: {string.Join(", ", AllowedExtensions)}", sw);

        if (!SchemaRegistry.All.TryGetValue(tableName, out var schema))
            return Fail($"No import schema registered for table '{tableName}'.", sw);

        // ── Open the file reader ──────────────────────────────────────────────
        // ASP.NET Core spools uploads > 64 KB to disk, so OpenReadStream() is seekable.
        await using var stream = file.OpenReadStream();

        IDataReader srcReader;
        try
        {
            srcReader = ext.Equals(".csv", StringComparison.OrdinalIgnoreCase)
                ? await OpenCsvAsync(stream, ct)
                : OpenExcel(stream, ext);
        }
        catch (Exception ex)
        {
            _log.LogError(ex, "Cannot open file '{File}'", file.FileName);
            return Fail($"Cannot open file: {ex.Message}", sw);
        }

        // srcReader owns its resources; MappedDataReader is a non-owning view over it.
        using (srcReader)
        {
            // ── Build header map — executed ONCE, before the row loop ──────────
            var sourceIndices = HeaderMapper.BuildMap(srcReader, schema, out var mapErrors);
            if (mapErrors.Count > 0)
                return Fail(string.Join(" | ", mapErrors), sw);

            _log.LogInformation(
                "Import start → [{Table}] | {File} ({Size:N0} bytes) | {Cols} columns mapped",
                tableName, file.FileName, file.Length, schema.Columns.Length);

            var reader = new MappedDataReader(
                srcReader, sourceIndices, schema.Columns, options.BatchSize, options.Progress);

            // ── SQL connection + optional index management ─────────────────────
            await using var conn = new SqlConnection(_cs);
            await conn.OpenAsync(ct);

            bool disableIdx = file.Length >= options.IndexDisableThresholdBytes;
            string[]? disabledIdx = null;

            if (disableIdx)
            {
                _log.LogInformation(
                    "File ≥ threshold ({Bytes:N0} bytes) — disabling non-clustered indexes on [{Table}]…",
                    file.Length, schema.TableName);

                disabledIdx = await IndexManager.DisableAsync(conn, schema.TableName, ct);

                _log.LogInformation("Disabled {N} index(es).", disabledIdx.Length);
            }

            // ── Bulk insert with retry ────────────────────────────────────────
            Exception? bulkError = null;
            try
            {
                await RunWithRetryAsync(
                    _ => BulkInsertAsync(conn, schema.TableName, reader, options, ct),
                    options.MaxRetryAttempts, ct);
            }
            catch (Exception ex)
            {
                bulkError = ex;
                _log.LogError(ex, "Bulk insert failed for [{Table}]", schema.TableName);
            }
            finally
            {
                // Always attempt index rebuild — even after a failed import.
                if (disabledIdx?.Length > 0)
                {
                    _log.LogInformation(
                        "Rebuilding {N} index(es) on [{Table}]…", disabledIdx.Length, schema.TableName);
                    try
                    {
                        // Use CancellationToken.None — we must attempt rebuild regardless of caller cancel.
                        await IndexManager.RebuildAsync(conn, schema.TableName, disabledIdx, CancellationToken.None);
                    }
                    catch (Exception ex)
                    {
                        _log.LogError(ex,
                            "Index rebuild failed on [{Table}] — manual intervention required. " +
                            "Run: ALTER INDEX ALL ON [{Table}] REBUILD;", schema.TableName, schema.TableName);
                    }
                }
            }

            if (bulkError is not null)
                return Fail($"Bulk insert error: {bulkError.Message}", sw);

            sw.Stop();

            int imported = reader.RowsRead - reader.RowsSkipped;
            _log.LogInformation(
                "Import complete → [{Table}] | {Imported:N0} rows in {Elapsed:0.00}s ({Rate:N0} rows/s)",
                tableName, imported, sw.Elapsed.TotalSeconds,
                sw.Elapsed.TotalSeconds > 0 ? imported / sw.Elapsed.TotalSeconds : 0);

            return new ImportResult(
                Success: true,
                RowsImported: imported,
                RowsSkipped: reader.RowsSkipped,
                Elapsed: sw.Elapsed,
                RowErrors: reader.RowErrors.Count > 0 ? reader.RowErrors : null);
        }
    }

    // ─────────────────────────────────────────────────────────────────────────
    // Bulk insert
    // ─────────────────────────────────────────────────────────────────────────

    private static async Task BulkInsertAsync(
        SqlConnection conn,
        string tableName,
        MappedDataReader reader,
        ImportOptions options,
        CancellationToken ct)
    {
        // TableLock         → exclusive table lock for the duration; prevents row-lock overhead.
        // UseInternalTransaction → each batch is auto-committed; no external transaction needed.
        // CheckConstraints / FireTriggers intentionally omitted for maximum throughput.
        // Add them if your schema strictly requires constraint enforcement at insert time.
        const SqlBulkCopyOptions BulkOpts =
            SqlBulkCopyOptions.TableLock |
            SqlBulkCopyOptions.UseInternalTransaction;

        using var bulk = new SqlBulkCopy(conn, BulkOpts, externalTransaction: null)
        {
            DestinationTableName = $"[{tableName}]",
            BatchSize = options.BatchSize,
            EnableStreaming = true,
            BulkCopyTimeout = 600,
        };

        // Name-to-name column mappings — SqlBulkCopy resolves case-insensitively.
        for (int i = 0; i < reader.FieldCount; i++)
        {
            string colName = reader.GetName(i);
            bulk.ColumnMappings.Add(colName, colName);
        }

        await bulk.WriteToServerAsync(reader, ct);
    }

    // ─────────────────────────────────────────────────────────────────────────
    // File readers
    // ─────────────────────────────────────────────────────────────────────────

    private static IDataReader OpenExcel(Stream stream, string ext)
    {
        // Sylvan reads row 1 as headers by default; GetName(i) returns those values.
        // Read() starts at row 2 (first data row). No manual header handling needed.
        var type = ext.ToLowerInvariant() switch
        {
            ".xlsx" => ExcelWorkbookType.ExcelXml,
            ".xlsb" => ExcelWorkbookType.ExcelBinary,
            ".xls" => ExcelWorkbookType.Excel,
            _ => throw new NotSupportedException($"Unsupported Excel format '{ext}'.")
        };
        return ExcelDataReader.Create(stream, type);
    }

    private static async Task<IDataReader> OpenCsvAsync(Stream stream, CancellationToken _)
    {
        // detectEncodingFromByteOrderMarks handles UTF-8 BOM from Excel CSV exports.
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
            // Sylvan auto-detects comma / tab delimiter; override here if needed:
            // Delimiter = ',',
        };

        return await Sylvan.Data.Csv.CsvDataReader.CreateAsync(textReader, opts);
    }

    // ─────────────────────────────────────────────────────────────────────────
    // Retry with exponential back-off (transient SQL errors only)
    // ─────────────────────────────────────────────────────────────────────────

    private static async Task RunWithRetryAsync(
        Func<int, Task> action, int maxAttempts, CancellationToken ct)
    {
        for (int attempt = 1; ; attempt++)
        {
            try
            {
                await action(attempt);
                return;
            }
            catch (SqlException ex) when (attempt < maxAttempts && IsTransient(ex))
            {
                // Exponential back-off: 2 s → 4 s → 8 s
                await Task.Delay(TimeSpan.FromSeconds(Math.Pow(2, attempt)), ct);
            }
        }
    }

    /// <summary>
    /// Returns true for known transient SQL Server / Azure SQL error codes.
    /// Non-transient errors (schema mismatch, FK violation, etc.) propagate immediately.
    /// </summary>
    private static bool IsTransient(SqlException ex) => ex.Number is
        1205 or  // deadlock victim
        -2 or  // timeout
        233 or  // connection broken
        10053 or
        10054 or
        10060 or
        40197 or  // Azure: service busy
        40501 or  // Azure: throttled
        40613;    // Azure: database unavailable

    // ─────────────────────────────────────────────────────────────────────────
    // Helpers
    // ─────────────────────────────────────────────────────────────────────────

    private static ImportResult Fail(string error, Stopwatch sw) =>
        new(false, 0, 0, sw.Elapsed, error);
}
